import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGroqClient, GROQ_MODEL } from "@/lib/groq";
import {
    buildUserPrompt,
    getSystemPrompt,
    type PromptVariables,
    type GeneratedEmail,
} from "@/lib/prompts";

/**
 * POST /api/ai/generate
 *
 * Generate a personalised cold outreach email for a prospect using Groq.
 *
 * Body: { prospectId: string, tone?: string, senderName?: string, senderCompany?: string }
 *
 * Returns: { email: GeneratedEmail } or { error, code, retryAfter? }
 *
 * Error codes returned to the UI:
 *   RATE_LIMITED  — Groq 429, UI should show "busy, retrying…"
 *   TIMEOUT      — Groq took too long
 *   BAD_RESPONSE — AI returned unparseable JSON
 *   AUTH_ERROR    — not logged in
 *   NOT_FOUND    — prospect doesn't exist
 *   SERVER_ERROR  — catch-all
 */

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000; // 2s between retries

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
        const {
            prospectId,
            tone,
            senderName,
            senderCompany,
        } = body as {
            prospectId: string;
            tone?: "professional" | "casual" | "friendly" | "bold";
            senderName?: string;
            senderCompany?: string;
        };

        if (!prospectId) {
            return NextResponse.json(
                { error: "prospectId is required", code: "BAD_REQUEST" },
                { status: 400 }
            );
        }

        /* ── Fetch prospect (RLS-scoped) ── */
        const { data: prospect, error: fetchError } = await supabase
            .from("prospects")
            .select("id, first_name, last_name, company_name, role, email, raw_data")
            .eq("id", prospectId)
            .single();

        if (fetchError || !prospect) {
            return NextResponse.json(
                { error: "Prospect not found", code: "NOT_FOUND" },
                { status: 404 }
            );
        }

        /* ── Build prompts ── */
        const vars: PromptVariables = {
            first_name: prospect.first_name ?? "",
            last_name: prospect.last_name ?? undefined,
            company_name: prospect.company_name ?? undefined,
            role: prospect.role ?? undefined,
            email: prospect.email ?? undefined,
            raw_data: prospect.raw_data as Record<string, unknown> | null,
            sender_name: senderName,
            sender_company: senderCompany,
            tone,
        };

        const systemPrompt = getSystemPrompt();
        const userPrompt = buildUserPrompt(vars);

        /* ── Call Groq with retry ── */
        const groq = getGroqClient();
        let lastError: unknown = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const completion = await groq.chat.completions.create({
                    model: GROQ_MODEL,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt },
                    ],
                    temperature: 0.7,
                    max_tokens: 1024,
                    response_format: { type: "json_object" },
                });

                const raw = completion.choices?.[0]?.message?.content;

                if (!raw) {
                    lastError = new Error("Empty response from Groq");
                    continue; // retry
                }

                /* ── Parse JSON response ── */
                const parsed = parseGeneratedEmail(raw);

                if (!parsed) {
                    lastError = new Error(`Unparseable AI response: ${raw.slice(0, 200)}`);
                    continue; // retry with hope of better output
                }

                /* ── Store the draft in raw_data ── */
                const existingRaw = (prospect.raw_data as Record<string, unknown>) ?? {};
                const updatedRaw = {
                    ...existingRaw,
                    lastDraft: {
                        ...parsed,
                        generatedAt: new Date().toISOString(),
                        model: GROQ_MODEL,
                        tone: tone ?? "professional",
                    },
                };

                await supabase
                    .from("prospects")
                    .update({ raw_data: updatedRaw })
                    .eq("id", prospectId);

                return NextResponse.json({ email: parsed });
            } catch (err: unknown) {
                lastError = err;

                /* ── Rate limit (429) ── */
                if (isRateLimited(err)) {
                    const retryAfter = extractRetryAfter(err);

                    if (attempt < MAX_RETRIES) {
                        // Wait and retry
                        await sleep(retryAfter ?? RETRY_DELAY_MS);
                        continue;
                    }

                    // Out of retries — tell the UI to show "busy, retrying…"
                    return NextResponse.json(
                        {
                            error: "Groq rate limit reached. Please wait a moment and try again.",
                            code: "RATE_LIMITED",
                            retryAfter: retryAfter ? Math.ceil(retryAfter / 1000) : 5,
                        },
                        { status: 429 }
                    );
                }

                /* ── Timeout ── */
                if (isTimeout(err)) {
                    if (attempt < MAX_RETRIES) {
                        await sleep(RETRY_DELAY_MS);
                        continue;
                    }
                    return NextResponse.json(
                        {
                            error: "AI generation timed out. Please try again.",
                            code: "TIMEOUT",
                        },
                        { status: 504 }
                    );
                }

                // Other errors — retry once, then fail
                if (attempt < MAX_RETRIES) {
                    await sleep(RETRY_DELAY_MS);
                    continue;
                }
            }
        }

        /* ── All retries exhausted ── */
        const message =
            lastError instanceof Error ? lastError.message : "Generation failed";
        console.error("[ai/generate] All retries failed:", lastError);

        return NextResponse.json(
            { error: message, code: "SERVER_ERROR" },
            { status: 500 }
        );
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "Internal server error";
        console.error("[ai/generate] Unexpected error:", err);
        return NextResponse.json(
            { error: message, code: "SERVER_ERROR" },
            { status: 500 }
        );
    }
}

/* ──────── Helpers ──────── */

/**
 * Parse the AI's JSON response into a GeneratedEmail.
 * Returns null if the response is malformed.
 */
function parseGeneratedEmail(raw: string): GeneratedEmail | null {
    try {
        const obj = JSON.parse(raw);
        if (
            typeof obj.subject === "string" &&
            typeof obj.body === "string" &&
            obj.subject.length > 0 &&
            obj.body.length > 0
        ) {
            return {
                subject: obj.subject,
                body: obj.body,
                rationale: typeof obj.rationale === "string" ? obj.rationale : "",
            };
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Check if an error is a 429 rate limit from Groq.
 */
function isRateLimited(err: unknown): boolean {
    if (err && typeof err === "object") {
        // groq-sdk throws APIError with status
        if ("status" in err && (err as { status: number }).status === 429) return true;
        if ("code" in err && (err as { code: string }).code === "rate_limit_exceeded") return true;
    }
    return false;
}

/**
 * Check if an error is a timeout.
 */
function isTimeout(err: unknown): boolean {
    if (err && typeof err === "object") {
        if ("code" in err && (err as { code: string }).code === "ETIMEDOUT") return true;
        if ("code" in err && (err as { code: string }).code === "ECONNABORTED") return true;
        const msg = err instanceof Error ? err.message : "";
        if (msg.toLowerCase().includes("timeout")) return true;
    }
    return false;
}

/**
 * Extract retry-after header value (in ms) from a Groq error, if present.
 */
function extractRetryAfter(err: unknown): number | null {
    if (err && typeof err === "object" && "headers" in err) {
        const headers = (err as { headers: Record<string, string> }).headers;
        const val = headers?.["retry-after"];
        if (val) {
            const seconds = parseFloat(val);
            if (!isNaN(seconds)) return seconds * 1000;
        }
    }
    return null;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
