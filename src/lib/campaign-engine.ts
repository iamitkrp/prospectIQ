import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/brevo";
import { getGroqClient, GROQ_MODEL } from "@/lib/groq";
import {
    buildUserPrompt,
    getSystemPrompt,
    type PromptVariables,
} from "@/lib/prompts";
import { qstash } from "@/lib/qstash";

const SECONDS_PER_DAY = 86_400;
const DAILY_SEND_LIMIT = parseInt(process.env.DAILY_SEND_LIMIT ?? "300", 10);

/** Error codes that should NOT be retried by QStash */
const PERMANENT_ERROR_CODES = new Set(["INVALID_EMAIL", "DAILY_LIMIT"]);

export type ExecuteStepResult = {
    executed: boolean;
    sent?: boolean;
    error?: string;
    errorCode?: string;
    reason?: string;
    permanent?: boolean;
    stepOrder?: number;
    nextScheduled?: boolean;
    qstashMessageId?: string | null;
    skipped?: boolean;
};

/**
 * Shared logic to execute a single campaign step for a prospect.
 * This can be called from QStash via an API Route, or directly from 
 * a Server Action to avoid Next.js dev server deadlock on Windows.
 */
export async function executeCampaignStep(
    campaignId: string,
    prospectId: string,
    stepOrder: number
): Promise<ExecuteStepResult> {
    console.log(`[executeCampaignStep] Campaign=${campaignId} Prospect=${prospectId} Step=${stepOrder}`);

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
        console.log(`[executeCampaignStep] ❌ Step ${stepOrder} not found (Error: ${stepErr?.message}).`);
        return { executed: false, skipped: true, reason: "NO_STEP" };
    }

    const logSkip = async (reason: string) => {
        const { error: logErr } = await supabase.from("email_logs").insert({
            prospect_id: prospectId,
            campaign_id: campaignId,
            step_id: step.id,
            status: "FAILED",
            sent_at: new Date().toISOString(),
            subject: `Skipped: ${reason}`,
            body: `Execution skipped silently. Reason: ${reason}`,
            qstash_message_id: null
        });
        if (logErr) console.error(`[executeCampaignStep] Failed to insert logSkip:`, logErr);
    };

    /* ── 2. Check campaign is ACTIVE ── */
    const { data: campaign } = await supabase
        .from("campaigns")
        .select("id, status, user_id")
        .eq("id", campaignId)
        .single();

    if (!campaign || campaign.status !== "ACTIVE") {
        console.log(`[executeCampaignStep] Campaign not active (status=${campaign?.status}). Skipping.`);
        await logSkip(`CAMPAIGN_NOT_ACTIVE (status=${campaign?.status})`);
        return { executed: false, skipped: true, reason: "CAMPAIGN_NOT_ACTIVE" };
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
        console.log(`[executeCampaignStep] Prospect ${prospectId} already replied. Skipping.`);
        await logSkip("ALREADY_REPLIED");
        return { executed: false, skipped: true, reason: "ALREADY_REPLIED" };
    }

    /* ── 3b. 24-hour guard ── */
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentSend } = await supabase
        .from("email_logs")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("prospect_id", prospectId)
        .eq("status", "SENT")
        .gte("sent_at", twentyFourHoursAgo)
        .limit(1)
        .maybeSingle();

    if (recentSend) {
        console.log(`[executeCampaignStep] Prospect ${prospectId} already emailed within 24h. Skipping.`);
        await logSkip("RATE_LIMITED_24H");
        return { executed: false, skipped: true, reason: "RATE_LIMITED_24H" };
    }

    /* ── 3c. Daily send limit guard ── */
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todaySent } = await supabase
        .from("email_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "SENT")
        .gte("sent_at", todayStart.toISOString());

    if ((todaySent ?? 0) >= DAILY_SEND_LIMIT) {
        console.log(`[executeCampaignStep] Daily send limit (${DAILY_SEND_LIMIT}) reached.`);
        await logSkip("DAILY_LIMIT_REACHED");
        return { executed: false, skipped: true, reason: "DAILY_LIMIT_REACHED" };
    }

    /* ── 4. Fetch prospect details ── */
    const { data: prospect, error: prospectErr } = await supabase
        .from("prospects")
        .select("id, first_name, last_name, company_name, role, email, raw_data")
        .eq("id", prospectId)
        .single();

    if (prospectErr || !prospect || !prospect.email) {
        console.log(`[executeCampaignStep] Prospect ${prospectId} invalid/no email. Skipping.`);
        await logSkip("PROSPECT_INVALID");
        return { executed: false, skipped: true, reason: "PROSPECT_INVALID" };
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
        console.error("[executeCampaignStep] Empty Groq response");
        throw new Error("AI generation returned empty response.");
    }

    let subject: string;
    let emailBody: string;
    try {
        const parsed = JSON.parse(raw);
        subject = parsed.subject;
        emailBody = parsed.body;
        if (!subject || !emailBody) throw new Error("Missing subject/body");
    } catch {
        console.error("[executeCampaignStep] Failed to parse Groq response:", raw.slice(0, 200));
        throw new Error("AI returned unparseable response.");
    }

    /* ── 6. Send via Brevo ── */
    const recipientName = [prospect.first_name, prospect.last_name].filter(Boolean).join(" ") || undefined;

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
        qstash_message_id: null as string | null,
    };

    const { data: insertedLog, error: logError } = await supabase
        .from("email_logs")
        .insert(logEntry)
        .select("id")
        .single();

    if (logError) {
        console.error("[executeCampaignStep] Failed to write email_logs:", logError);
    }

    if (!sendResult.success) {
        const errorCode = sendResult.code ?? "UNKNOWN";
        const isPermanent = PERMANENT_ERROR_CODES.has(errorCode);

        console.error(`[executeCampaignStep] Send failed (${errorCode}, permanent=${isPermanent}): ${sendResult.error}`);

        return {
            executed: true,
            sent: false,
            error: sendResult.error,
            errorCode,
            permanent: isPermanent,
            stepOrder,
        };
    }

    console.log(`[executeCampaignStep] Step ${stepOrder} sent to ${prospect.email}`);

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
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

        const res = await qstash.publishJSON({
            url: `${appUrl}/api/campaign/execute`,
            body: { campaignId, prospectId, stepOrder: nextStepOrder },
            delay: delaySeconds,
        });

        qstashMessageId = res.messageId;

        if (insertedLog) {
            await supabase
                .from("email_logs")
                .update({ qstash_message_id: qstashMessageId })
                .eq("id", insertedLog.id);
        }
    }

    return {
        executed: true,
        sent: true,
        stepOrder,
        nextScheduled: !!nextStep,
        qstashMessageId,
    };
}
