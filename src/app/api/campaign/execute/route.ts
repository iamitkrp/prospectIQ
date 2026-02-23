import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/brevo";
import { getGroqClient, GROQ_MODEL } from "@/lib/groq";
import {
    buildUserPrompt,
    getSystemPrompt,
    type PromptVariables,
} from "@/lib/prompts";
import { qstash } from "@/lib/qstash";

/**
 * POST /api/campaign/execute
 *
 * The campaign execution engine. Called by QStash (or "Start Campaign")
 * to execute a single step for a single prospect.
 *
 * SECURITY: Every request must pass ONE of:
 *   1. QStash signature verification (for scheduled callbacks)
 *   2. Internal secret header (for server-side "Start Campaign" calls)
 *
 * Body: {
 *   campaignId: string,
 *   prospectId: string,
 *   stepOrder:  number,   — which step to execute (1-based)
 * }
 *
 * Flow:
 *   0. Verify caller identity (QStash signature OR internal secret)
 *   1. Validate input
 *   2. Reply-check guard — skip if prospect already replied
 *   2b. 24-hour guard — skip if email sent to this prospect within 24h
 *   2c. Daily limit guard — skip if daily send limit reached
 *   3. Fetch campaign, step, and prospect data
 *   4. Generate email via Groq using step's prompt_template
 *   5. Send via Brevo
 *   6. Log to email_logs (classify permanent vs transient errors)
 *   7. Schedule next step via QStash (if one exists)
 */

const SECONDS_PER_DAY = 86_400;
const DAILY_SEND_LIMIT = parseInt(process.env.DAILY_SEND_LIMIT ?? "300", 10);

/** Error codes that should NOT be retried by QStash */
const PERMANENT_ERROR_CODES = new Set(["INVALID_EMAIL", "DAILY_LIMIT"]);

/* ── QStash signature receiver (lazy-init to avoid crash if env is missing in dev) ── */
let _receiver: Receiver | null = null;
function getReceiver(): Receiver | null {
    if (_receiver) return _receiver;
    const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
    if (!currentKey || !nextKey) return null;
    _receiver = new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
    return _receiver;
}

/**
 * Verify that the request is from a trusted source.
 * Returns null if verified, or a NextResponse with 401 if not.
 */
async function verifyRequest(request: NextRequest, rawBody: string): Promise<NextResponse | null> {
    // Path 1: Internal server-side call with shared secret
    const internalSecret = process.env.CAMPAIGN_INTERNAL_SECRET;
    const authHeader = request.headers.get("x-campaign-secret");
    if (internalSecret && authHeader && internalSecret === authHeader) {
        return null; // ✅ Verified via internal secret
    }

    // Path 2: QStash signature verification
    const receiver = getReceiver();
    if (!receiver) {
        // In development without QStash keys, only allow internal secret
        if (process.env.NODE_ENV === "development" && !internalSecret) {
            console.warn("[execute] ⚠️  No QSTASH signing keys or CAMPAIGN_INTERNAL_SECRET set — allowing in dev only");
            return null;
        }
        return NextResponse.json(
            { error: "Server misconfigured: no QStash signing keys." },
            { status: 500 }
        );
    }

    const signature = request.headers.get("upstash-signature");
    if (!signature) {
        return NextResponse.json(
            { error: "Unauthorized: missing signature." },
            { status: 401 }
        );
    }

    try {
        await receiver.verify({
            signature,
            body: rawBody,
        });
        return null; // ✅ Verified via QStash
    } catch (err) {
        console.error("[execute] QStash signature verification failed:", err);
        return NextResponse.json(
            { error: "Unauthorized: invalid signature." },
            { status: 401 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        /* ── 0. Read raw body for signature verification ── */
        const rawBody = await request.text();

        const authResult = await verifyRequest(request, rawBody);
        if (authResult) return authResult; // 401

        /* ── Parse body ── */
        const body = JSON.parse(rawBody);
        const { campaignId, prospectId, stepOrder } = body as {
            campaignId: string;
            prospectId: string;
            stepOrder: number;
        };

        if (!campaignId || !prospectId || !stepOrder) {
            return NextResponse.json(
                { error: "campaignId, prospectId, and stepOrder are required." },
                { status: 400 }
            );
        }

        console.log(`[execute] Campaign=${campaignId} Prospect=${prospectId} Step=${stepOrder}`);

        /* ── Supabase client (service-level, no user auth needed) ── */
        const supabase = await createAdminClient();

        /* ── 1. Fetch campaign step FIRST so we can log skips ── */
        const { data: step, error: stepErr } = await supabase
            .from("campaign_steps")
            .select("id, step_order, delay_days, prompt_template")
            .eq("campaign_id", campaignId)
            .eq("step_order", stepOrder)
            .single();

        if (stepErr || !step) {
            console.log(`[execute] Step ${stepOrder} not found. Campaign sequence complete.`);
            return NextResponse.json({ skipped: true, reason: "NO_STEP" });
        }

        const logSkip = async (reason: string) => {
            await supabase.from("email_logs").insert({
                prospect_id: prospectId,
                campaign_id: campaignId,
                step_id: step.id,
                status: "FAILED",
                sent_at: new Date().toISOString(),
                subject: `Skipped: ${reason}`,
                body: `Execution skipped silently. Reason: ${reason}`,
                qstash_message_id: null
            });
        };

        /* ── 2. Check campaign is ACTIVE ── */
        const { data: campaign } = await supabase
            .from("campaigns")
            .select("id, status, user_id")
            .eq("id", campaignId)
            .single();

        if (!campaign || campaign.status !== "ACTIVE") {
            console.log(`[execute] Campaign not active (status=${campaign?.status}). Skipping.`);
            await logSkip(`CAMPAIGN_NOT_ACTIVE (status=${campaign?.status})`);
            // Return 400 so startCampaign knows it actually failed
            return NextResponse.json({ error: "CAMPAIGN_NOT_ACTIVE" }, { status: 400 });
        }

        /* ── 3. Reply-check guard ── */
        const { data: repliedLog } = await supabase
            .from("email_logs")
            .select("id")
            .eq("campaign_id", campaignId)
            .eq("prospect_id", prospectId)
            .eq("status", "REPLIED")
            .limit(1)
            .maybeSingle();

        if (repliedLog) {
            console.log(`[execute] Prospect ${prospectId} already replied. Skipping.`);
            await logSkip("ALREADY_REPLIED");
            return NextResponse.json({ skipped: true, reason: "ALREADY_REPLIED" });
        }

        /* ── 3b. 24-hour guard (3.3.5) ── */
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentSend } = await supabase
            .from("email_logs")
            .select("id")
            .eq("campaign_id", campaignId) // Scope to this campaign so concurrent testing works
            .eq("prospect_id", prospectId)
            .eq("status", "SENT")
            .gte("sent_at", twentyFourHoursAgo)
            .limit(1)
            .maybeSingle();

        if (recentSend) {
            console.log(`[execute] Prospect ${prospectId} already emailed within 24h testing scope. Skipping.`);
            await logSkip("RATE_LIMITED_24H");
            return NextResponse.json({ skipped: true, reason: "RATE_LIMITED_24H" });
        }

        /* ── 3c. Daily send limit guard (3.3.6) ── */
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count: todaySent } = await supabase
            .from("email_logs")
            .select("id", { count: "exact", head: true })
            .eq("status", "SENT")
            .gte("sent_at", todayStart.toISOString());

        if ((todaySent ?? 0) >= DAILY_SEND_LIMIT) {
            console.log(`[execute] Daily send limit (${DAILY_SEND_LIMIT}) reached. Skipping.`);
            await logSkip("DAILY_LIMIT_REACHED");
            return NextResponse.json({ skipped: true, reason: "DAILY_LIMIT_REACHED" });
        }

        /* ── 4. Fetch prospect details ── */
        const { data: prospect, error: prospectErr } = await supabase
            .from("prospects")
            .select("id, first_name, last_name, company_name, role, email, raw_data")
            .eq("id", prospectId)
            .single();

        if (prospectErr || !prospect || !prospect.email) {
            console.log(`[execute] Prospect ${prospectId} not found or no email. Skipping.`);
            await logSkip("PROSPECT_INVALID");
            return NextResponse.json({ skipped: true, reason: "PROSPECT_INVALID" });
        }

        /* ── 5. Generate email via Groq ── */
        const vars: PromptVariables = {
            first_name: prospect.first_name ?? "",
            last_name: prospect.last_name ?? undefined,
            company_name: prospect.company_name ?? undefined,
            role: prospect.role ?? undefined,
            email: prospect.email ?? undefined,
            raw_data: prospect.raw_data as Record<string, unknown> | null,
        };

        // Build the user prompt, prepending the step's custom instructions
        const basePrompt = buildUserPrompt(vars);
        const stepInstructions = step.prompt_template?.trim();
        const userPrompt = stepInstructions
            ? `CAMPAIGN STEP ${stepOrder} INSTRUCTIONS:\n${stepInstructions}\n\n---\n\n${basePrompt}`
            : basePrompt;

        const groq = getGroqClient();
        const completion = await groq.chat.completions.create({
            model: GROQ_MODEL,
            messages: [
                { role: "system", content: getSystemPrompt() },
                { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 1024,
            response_format: { type: "json_object" },
        });

        const raw = completion.choices?.[0]?.message?.content;
        if (!raw) {
            console.error("[execute] Empty Groq response");
            return NextResponse.json(
                { error: "AI generation returned empty response." },
                { status: 500 }
            );
        }

        let subject: string;
        let emailBody: string;
        try {
            const parsed = JSON.parse(raw);
            subject = parsed.subject;
            emailBody = parsed.body;
            if (!subject || !emailBody) throw new Error("Missing subject/body");
        } catch {
            console.error("[execute] Failed to parse Groq response:", raw.slice(0, 200));
            return NextResponse.json(
                { error: "AI returned unparseable response." },
                { status: 500 }
            );
        }

        /* ── 6. Send via Brevo ── */
        const recipientName = [prospect.first_name, prospect.last_name]
            .filter(Boolean)
            .join(" ") || undefined;

        const sendResult = await sendEmail({
            to: prospect.email,
            toName: recipientName,
            subject,
            body: emailBody,
            tags: ["prospectiq", "campaign", `campaign-${campaignId}`, `step-${stepOrder}`],
        });

        /* ── 7. Log to email_logs ── */
        const logEntry = {
            prospect_id: prospectId,
            campaign_id: campaignId,
            step_id: step.id,
            status: sendResult.success ? "SENT" : "FAILED",
            sent_at: sendResult.success ? new Date().toISOString() : null,
            subject,
            body: emailBody,
            qstash_message_id: null as string | null, // filled below if next step scheduled
        };

        const { data: insertedLog, error: logError } = await supabase
            .from("email_logs")
            .insert(logEntry)
            .select("id")
            .single();

        if (logError) {
            console.error("[execute] Failed to write email_logs:", logError);
        }

        if (!sendResult.success) {
            const errorCode = sendResult.code ?? "UNKNOWN";
            const isPermanent = PERMANENT_ERROR_CODES.has(errorCode);

            console.error(`[execute] Send failed (${errorCode}, permanent=${isPermanent}): ${sendResult.error}`);

            // Return 200 for permanent errors → QStash will NOT retry
            // Return 500 for transient errors → QStash WILL retry (built-in backoff)
            return NextResponse.json(
                {
                    executed: true,
                    sent: false,
                    error: sendResult.error,
                    errorCode,
                    permanent: isPermanent,
                    stepOrder,
                },
                { status: isPermanent ? 200 : 500 }
            );
        }

        console.log(`[execute] Step ${stepOrder} sent to ${prospect.email}`);

        /* ── 8. Schedule next step via QStash ── */
        const nextStepOrder = stepOrder + 1;

        const { data: nextStep } = await supabase
            .from("campaign_steps")
            .select("id, delay_days")
            .eq("campaign_id", campaignId)
            .eq("step_order", nextStepOrder)
            .maybeSingle();

        let qstashMessageId: string | null = null;

        if (nextStep) {
            const delaySeconds = (nextStep.delay_days ?? 1) * SECONDS_PER_DAY;

            // Get the app URL for the callback
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : "http://localhost:3000");

            const res = await qstash.publishJSON({
                url: `${appUrl}/api/campaign/execute`,
                body: {
                    campaignId,
                    prospectId,
                    stepOrder: nextStepOrder,
                },
                delay: delaySeconds,
            });

            qstashMessageId = res.messageId;

            console.log(
                `[execute] Scheduled step ${nextStepOrder} in ${nextStep.delay_days}d (QStash ID: ${qstashMessageId})`
            );

            // Update the log entry with the qstash message ID
            if (insertedLog?.id && qstashMessageId) {
                await supabase
                    .from("email_logs")
                    .update({ qstash_message_id: qstashMessageId })
                    .eq("id", insertedLog.id);
            }
        } else {
            console.log(`[execute] No more steps after ${stepOrder}. Sequence complete for prospect.`);
        }

        return NextResponse.json({
            executed: true,
            sent: true,
            stepOrder,
            nextStepScheduled: !!nextStep,
            qstashMessageId,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal server error";
        console.error("[execute] Unexpected error:", err);
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
