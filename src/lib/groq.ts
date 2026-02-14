import Groq from "groq-sdk";

/**
 * Groq client singleton.
 *
 * Reads GROQ_API_KEY from the environment (set in .env / .env.local).
 * Re-uses a single instance across all server-side calls to avoid
 * creating new connections on every request in development.
 */

let client: Groq | null = null;

export function getGroqClient(): Groq {
    if (!client) {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error(
                "GROQ_API_KEY is not set. Add it to your .env.local file."
            );
        }
        client = new Groq({ apiKey });
    }
    return client;
}

/** Default model — Llama 3.3 70B (fast, high quality) */
export const GROQ_MODEL = "llama-3.3-70b-versatile";
