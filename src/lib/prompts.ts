import { buildEnrichmentContext } from "./prompt-context";

/**
 * Prompt template system for AI email generation.
 *
 * Builds system + user prompts for Groq, injecting prospect data,
 * enrichment context, and sender info for personalised cold outreach.
 */

/* ──────── Types ──────── */

export interface PromptVariables {
    /** Prospect fields */
    first_name: string;
    last_name?: string;
    company_name?: string;
    role?: string;
    email?: string;
    /** Enrichment raw_data (JSONB from DB) */
    raw_data?: Record<string, unknown> | null;
    /** Sender / user info */
    sender_name?: string;
    sender_company?: string;
    /** Optional tone override */
    tone?: "professional" | "casual" | "friendly" | "bold";
}

export interface GeneratedEmail {
    subject: string;
    body: string;
    rationale: string;
}

/* ──────── System Prompt ──────── */

const SYSTEM_PROMPT = `You are an elite cold outreach copywriter. Your emails are concise, human, and get replies.

RULES:
1. Keep the subject line under 50 characters — curiosity-driven, no clickbait.
2. Keep the body under 120 words — short paragraphs, conversational tone.
3. Open with a specific, personalised hook referencing the prospect's company/role/tech stack.
4. Clearly state the value proposition in 1-2 sentences.
5. End with a low-friction CTA (e.g. "Worth a 15-min chat?" not "Schedule a demo").
6. Do NOT use these words: "synergy", "leverage", "revolutionize", "game-changer", "circle back".
7. Do NOT include [brackets] or {{placeholders}} — write the final email ready to send.
8. Sound like a real person, not a sales bot.

RESPOND IN VALID JSON with exactly these keys:
{
  "subject": "...",
  "body": "...",
  "rationale": "One sentence explaining your personalisation angle"
}`;

/* ──────── User Prompt Builder ──────── */

/**
 * Build the user prompt with prospect context + optional enrichment.
 */
export function buildUserPrompt(vars: PromptVariables): string {
    const lines: string[] = [];

    lines.push("Write a cold outreach email for this prospect:");
    lines.push("");

    // Enrichment context (scraped data + notes)
    const enrichmentBlock = buildEnrichmentContext(vars.raw_data ?? null, {
        first_name: vars.first_name,
        last_name: vars.last_name,
        company_name: vars.company_name,
        role: vars.role,
        email: vars.email,
    });
    lines.push(enrichmentBlock);

    // Sender info
    if (vars.sender_name || vars.sender_company) {
        lines.push("");
        lines.push("## Sender");
        if (vars.sender_name) lines.push(`- **Name:** ${vars.sender_name}`);
        if (vars.sender_company) lines.push(`- **Company:** ${vars.sender_company}`);
    }

    // Tone
    if (vars.tone) {
        lines.push("");
        lines.push(`## Tone: ${vars.tone}`);
    }

    return lines.join("\n");
}

/**
 * Get the full system prompt.
 */
export function getSystemPrompt(): string {
    return SYSTEM_PROMPT;
}
