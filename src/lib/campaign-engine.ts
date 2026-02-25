import { createAdminClient } from "@/lib/supabase/server";
import { getGroqClient, GROQ_MODEL } from "@/lib/groq";
import nodemailer from "nodemailer";
import * as crypto from "crypto";
import {
    buildUserPrompt,
    getSystemPrompt,
    type PromptVariables,
} from "@/lib/prompts";
import { qstash } from "@/lib/qstash";

const SECONDS_PER_DAY = 86_400;
const TEST_MODE = process.env.CAMPAIGN_TEST_MODE === "true";
const TEST_DELAY_SECONDS = 300; // 5 minutes
const DAILY_SEND_LIMIT = parseInt(process.env.DAILY_SEND_LIMIT ?? "300", 10);

/** Error codes that should NOT be retried by QStash */
/** Error codes that should NOT be retried by QStash */
const PERMANENT_ERROR_CODES = new Set(["INVALID_EMAIL", "DAILY_LIMIT"]);

// --- Encryption logic (should match settings actions) ---
const ENCRYPTION_KEY = process.env.SMTP_ENCRYPTION_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 32) || "fallback-key-should-be-32-chars-long";

function decrypt(text: string) {
    try {
        const normalizedKey = ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32);
        const textParts = text.split(":");
        const iv = Buffer.from(textParts.shift() as string, "hex");
        const encryptedText = Buffer.from(textParts.join(":"), "hex");
        const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(normalizedKey), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        return null;
    }
}

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
    // Bypass 24-hour guard if we are in test mode and trying to test 5-minute delays
    if (!TEST_MODE) {
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

    /* ── 4b. Fetch User's Custom SMTP Settings ── */
    const { data: userSettings } = await supabase
        .from("user_settings")
        .select("smtp_email, smtp_app_password, is_smtp_verified")
        .eq("user_id", campaign.user_id)
        .single();

    if (!userSettings || !userSettings.is_smtp_verified || !userSettings.smtp_app_password) {
        console.error(`[executeCampaignStep] SMTP_DISCONNECTED for user ${campaign.user_id}. Pausing campaign.`);

        // 1. Pause the campaign
        await supabase
            .from("campaigns")
            .update({ status: "PAUSED" })
            .eq("id", campaignId);

        // 2. Log error
        await logSkip("SMTP_DISCONNECTED");
        return { executed: false, skipped: true, reason: "SMTP_DISCONNECTED" };
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

    /* ── 6. Send via User's SMTP ── */
    const recipientName = [prospect.first_name, prospect.last_name].filter(Boolean).join(" ") || undefined;

    const decryptedPassword = decrypt(userSettings.smtp_app_password);
    if (!decryptedPassword) {
        console.error(`[executeCampaignStep] Failed to decrypt SMTP password for user ${campaign.user_id}. Pausing campaign.`);
        await supabase.from("campaigns").update({ status: "PAUSED" }).eq("id", campaignId);
        await logSkip("SMTP_DISCONNECTED_DECRYPTION_FAILED");
        return { executed: false, skipped: true, reason: "SMTP_DISCONNECTED" };
    }

    let sendSuccess = false;
    let sendErrorMsg = "";
    let sendErrorCode = "";

    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: userSettings.smtp_email,
                pass: decryptedPassword
            }
        });

        const fromString = `"${process.env.APP_NAME || 'ProspectIQ'}" <${userSettings.smtp_email}>`;

        await transporter.sendMail({
            from: fromString,
            to: prospect.email,
            subject: subject,
            text: emailBody, // Default to plain text body as generated by Groq
            html: emailBody.replace(/\n/g, '<br/>'), // Very basic HTML formatting
        });
        sendSuccess = true;
    } catch (err: any) {
        sendSuccess = false;
        sendErrorMsg = err.message || "Unknown SMTP Error";
        sendErrorCode = err.code || "SMTP_ERROR";
        console.error("[executeCampaignStep] SMTP Send Error:", err);
    }

    /* ── 7. Log to email_logs ── */
    const logEntry = {
        prospect_id: prospectId,
        campaign_id: campaignId,
        step_id: step.id,
        status: sendSuccess ? "SENT" : "FAILED",
        sent_at: sendSuccess ? new Date().toISOString() : null,
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

    if (!sendSuccess) {
        // If authentication failed halfway, we should pause the campaign
        if (sendErrorCode === "EAUTH" || sendErrorCode === "OAUTH2") {
            console.error(`[executeCampaignStep] SMTP Authentication Failed during campaign. Pausing campaign.`);
            await supabase.from("campaigns").update({ status: "PAUSED" }).eq("id", campaignId);

            // Log a secondary error note if needed, but it's already in the email_logs
            return {
                executed: true,
                sent: false,
                error: "SMTP Authentication failed. Campaign Paused.",
                errorCode: "SMTP_DISCONNECTED",
                permanent: true,
                stepOrder,
            };
        }

        const isPermanent = PERMANENT_ERROR_CODES.has(sendErrorCode);

        console.error(`[executeCampaignStep] Send failed (${sendErrorCode}, permanent=${isPermanent}): ${sendErrorMsg}`);

        return {
            executed: true,
            sent: false,
            error: sendErrorMsg,
            errorCode: sendErrorCode,
            permanent: isPermanent,
            stepOrder,
        };
    }

    console.log(`[executeCampaignStep] Step ${stepOrder} sent to ${prospect.email} via ${userSettings.smtp_email}`);

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
        const delaySeconds = TEST_MODE ? TEST_DELAY_SECONDS : (nextStep.delay_days ?? 1) * SECONDS_PER_DAY;
        console.log(`[executeCampaignStep] Scheduling next step ${nextStepOrder} with delay=${delaySeconds}s ${TEST_MODE ? '(TEST MODE)' : ''}`);
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
