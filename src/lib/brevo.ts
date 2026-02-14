import * as Brevo from "@getbrevo/brevo";

/**
 * Brevo transactional email wrapper.
 *
 * Provides a singleton `TransactionalEmailsApi` instance and a
 * simplified `sendEmail()` helper used by the send endpoint.
 */

let _api: Brevo.TransactionalEmailsApi | null = null;

export function getTransactionalApi(): Brevo.TransactionalEmailsApi {
    if (_api) return _api;

    const key = process.env.BREVO_API_KEY;
    if (!key) {
        throw new Error(
            "BREVO_API_KEY is not set. Add it to your .env file."
        );
    }

    _api = new Brevo.TransactionalEmailsApi();
    _api.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, key);
    return _api;
}

/* ──────── Types ──────── */

export interface SendEmailParams {
    /** Recipient email */
    to: string;
    /** Recipient display name (optional) */
    toName?: string;
    /** Email subject */
    subject: string;
    /** Plain text body */
    body: string;
    /** Sender email (defaults to env or noreply) */
    senderEmail?: string;
    /** Sender display name */
    senderName?: string;
    /** Tags for Brevo analytics */
    tags?: string[];
}

export interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
    /** Error code from Brevo for UI handling */
    code?: "INVALID_EMAIL" | "DAILY_LIMIT" | "API_DOWN" | "UNKNOWN";
}

/* ──────── Send helper ──────── */

/**
 * Send a transactional email via Brevo.
 * Returns a structured result so the caller can handle errors gracefully.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const api = getTransactionalApi();

    const emailPayload = new Brevo.SendSmtpEmail();
    emailPayload.sender = {
        email: params.senderEmail ?? process.env.BREVO_SENDER_EMAIL ?? "noreply@prospectiq.app",
        name: params.senderName ?? "ProspectIQ",
    };
    emailPayload.to = [{ email: params.to, name: params.toName }];
    emailPayload.subject = params.subject;
    emailPayload.textContent = params.body;
    emailPayload.tags = params.tags ?? ["prospectiq", "cold-outreach"];

    try {
        const result = await api.sendTransacEmail(emailPayload);
        const messageId = (result.body as { messageId?: string })?.messageId;
        return { success: true, messageId: messageId ?? undefined };
    } catch (err: unknown) {
        return classifyBrevoError(err);
    }
}

/* ──────── Error classifier ──────── */

function classifyBrevoError(err: unknown): SendEmailResult {
    const message = err instanceof Error ? err.message : String(err);

    // Brevo SDK wraps HTTP errors with statusCode on the body
    let statusCode = 0;
    if (err && typeof err === "object" && "statusCode" in err) {
        statusCode = (err as { statusCode: number }).statusCode;
    }

    // Invalid email (400 with "email" in message)
    if (statusCode === 400 && message.toLowerCase().includes("email")) {
        return { success: false, error: "Invalid recipient email address.", code: "INVALID_EMAIL" };
    }

    // Rate / daily limit (429 or 403 with "limit")
    if (statusCode === 429 || (statusCode === 403 && message.toLowerCase().includes("limit"))) {
        return { success: false, error: "Daily email limit reached. Try again tomorrow.", code: "DAILY_LIMIT" };
    }

    // Server errors (5xx)
    if (statusCode >= 500) {
        return { success: false, error: "Brevo API is temporarily unavailable.", code: "API_DOWN" };
    }

    // Catch-all
    console.error("[brevo] Send failed:", err);
    return { success: false, error: message, code: "UNKNOWN" };
}
