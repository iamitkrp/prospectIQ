import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import nodemailer from "nodemailer";
import * as crypto from "crypto";

/**
 * POST /api/email/send
 *
 * Send a single email via the user's connected SMTP (Gmail App Password).
 * If the user has no SMTP configured, returns an error prompting them to connect.
 *
 * Body: {
 *   prospectId: string,
 *   subject: string,
 *   body: string,
 *   campaignId?: string,
 *   stepId?: string,
 * }
 *
 * Error codes:
 *   AUTH_ERROR      — not logged in
 *   BAD_REQUEST     — missing fields
 *   NOT_FOUND       — prospect doesn't exist
 *   SMTP_DISCONNECTED — user has no SMTP configured or credentials are invalid
 *   DAILY_LIMIT     — daily send limit reached
 *   INVALID_EMAIL   — recipient email invalid
 *   SEND_FAILED     — generic send failure
 */

const DAILY_LIMIT = 300;
const WARNING_THRESHOLD = 250;

// --- Encryption logic (must match settings actions) ---
const ENCRYPTION_KEY = process.env.SMTP_ENCRYPTION_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 32) || "fallback-key-should-be-32-chars-long";

function decrypt(text: string): string | null {
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
        const reqBody = await request.json();
        const { prospectId, subject, body: emailBody, campaignId, stepId } = reqBody as {
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

        /* ── Fetch user's SMTP settings ── */
        const { data: userSettings } = await supabase
            .from("user_settings")
            .select("smtp_email, smtp_app_password, is_smtp_verified")
            .eq("user_id", user.id)
            .single();

        if (!userSettings || !userSettings.is_smtp_verified || !userSettings.smtp_app_password) {
            return NextResponse.json(
                {
                    error: "No SMTP connected. Go to Settings → Email Sending to connect your Gmail.",
                    code: "SMTP_DISCONNECTED",
                },
                { status: 400 }
            );
        }

        const decryptedPassword = decrypt(userSettings.smtp_app_password);
        if (!decryptedPassword) {
            return NextResponse.json(
                { error: "Failed to decrypt SMTP credentials. Please reconnect in Settings.", code: "SMTP_DISCONNECTED" },
                { status: 500 }
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

        /* ── Send via User's SMTP ── */
        let sendSuccess = false;
        let sendError = "";

        try {
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: userSettings.smtp_email,
                    pass: decryptedPassword,
                },
            });

            const fromString = `"${process.env.APP_NAME || 'ProspectIQ'}" <${userSettings.smtp_email}>`;

            await transporter.sendMail({
                from: fromString,
                to: prospect.email,
                subject: subject,
                text: emailBody,
                html: emailBody.replace(/\n/g, '<br/>'),
            });
            sendSuccess = true;
        } catch (err: any) {
            sendSuccess = false;
            sendError = err.message || "SMTP send failed.";
            console.error("[email/send] SMTP error:", err);
        }

        /* ── Log to email_logs ── */
        const logEntry = {
            prospect_id: prospectId,
            campaign_id: campaignId ?? null,
            step_id: stepId ?? null,
            status: sendSuccess ? "SENT" : "FAILED",
            sent_at: sendSuccess ? new Date().toISOString() : null,
            subject,
            body: emailBody,
            qstash_message_id: null,
        };

        const { error: logError } = await supabase
            .from("email_logs")
            .insert(logEntry);

        if (logError) {
            console.error("[email/send] Failed to write email_logs:", logError);
        }

        /* ── Return result ── */
        if (!sendSuccess) {
            return NextResponse.json(
                { error: sendError, code: "SEND_FAILED" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
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
