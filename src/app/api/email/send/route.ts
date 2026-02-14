import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/brevo";

/**
 * POST /api/email/send
 *
 * Send a transactional email via Brevo and log it in `email_logs`.
 *
 * Body: {
 *   prospectId: string,
 *   subject: string,
 *   body: string,
 *   campaignId?: string,   — optional, for campaign-linked sends
 *   stepId?: string,       — optional, for campaign step sends
 * }
 *
 * Returns: { success, messageId? } or { error, code }
 *
 * Error codes:
 *   AUTH_ERROR    — not logged in
 *   BAD_REQUEST   — missing fields
 *   NOT_FOUND     — prospect doesn't exist
 *   DAILY_LIMIT   — Brevo 300/day reached
 *   INVALID_EMAIL — recipient email invalid
 *   API_DOWN      — Brevo 5xx
 *   SEND_FAILED   — generic send failure
 */

const DAILY_LIMIT = 300;
const WARNING_THRESHOLD = 250;

export async function POST(request: NextRequest) {
    try {
        /* ── Auth ── */
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Unauthorized", code: "AUTH_ERROR" },
                { status: 401 }
            );
        }

        /* ── Parse body ── */
        const body = await request.json();
        const { prospectId, subject, body: emailBody, campaignId, stepId } = body as {
            prospectId: string;
            subject: string;
            body: string;
            campaignId?: string;
            stepId?: string;
        };

        if (!prospectId || !subject?.trim() || !emailBody?.trim()) {
            return NextResponse.json(
                { error: "prospectId, subject, and body are required.", code: "BAD_REQUEST" },
                { status: 400 }
            );
        }

        /* ── Fetch prospect (RLS-scoped) ── */
        const { data: prospect, error: fetchError } = await supabase
            .from("prospects")
            .select("id, first_name, last_name, email")
            .eq("id", prospectId)
            .single();

        if (fetchError || !prospect) {
            return NextResponse.json(
                { error: "Prospect not found.", code: "NOT_FOUND" },
                { status: 404 }
            );
        }

        if (!prospect.email) {
            return NextResponse.json(
                { error: "Prospect has no email address.", code: "INVALID_EMAIL" },
                { status: 400 }
            );
        }

        /* ── Check daily send limit ── */
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { count: todayCount } = await supabase
            .from("email_logs")
            .select("id", { count: "exact", head: true })
            .eq("status", "SENT")
            .gte("sent_at", todayStart.toISOString());

        const sentToday = todayCount ?? 0;

        if (sentToday >= DAILY_LIMIT) {
            return NextResponse.json(
                {
                    error: `Daily limit of ${DAILY_LIMIT} emails reached. Try again tomorrow.`,
                    code: "DAILY_LIMIT",
                    sentToday,
                },
                { status: 429 }
            );
        }

        /* ── Send via Brevo ── */
        const recipientName = [prospect.first_name, prospect.last_name]
            .filter(Boolean)
            .join(" ") || undefined;

        const result = await sendEmail({
            to: prospect.email,
            toName: recipientName,
            subject,
            body: emailBody,
        });

        /* ── Log to email_logs ── */
        const logEntry = {
            prospect_id: prospectId,
            campaign_id: campaignId ?? null,
            step_id: stepId ?? null,
            status: result.success ? "SENT" : "FAILED",
            sent_at: result.success ? new Date().toISOString() : null,
            qstash_message_id: result.messageId ?? null,
        };

        const { error: logError } = await supabase
            .from("email_logs")
            .insert(logEntry);

        if (logError) {
            console.error("[email/send] Failed to write email_logs:", logError);
            // Don't fail the request — the email was already sent
        }

        /* ── Return result ── */
        if (!result.success) {
            return NextResponse.json(
                {
                    error: result.error,
                    code: result.code ?? "SEND_FAILED",
                },
                { status: result.code === "DAILY_LIMIT" ? 429 : 500 }
            );
        }

        return NextResponse.json({
            success: true,
            messageId: result.messageId,
            sentToday: sentToday + 1,
            warning: sentToday + 1 >= WARNING_THRESHOLD
                ? `You've sent ${sentToday + 1}/${DAILY_LIMIT} emails today.`
                : undefined,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal server error";
        console.error("[email/send] Unexpected error:", err);
        return NextResponse.json(
            { error: message, code: "SEND_FAILED" },
            { status: 500 }
        );
    }
}
