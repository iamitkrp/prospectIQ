import { Client } from "@upstash/qstash";

/**
 * QStash client — used to schedule delayed campaign step executions.
 *
 * Requires QSTASH_TOKEN in environment variables.
 * Get your token from: https://console.upstash.com/qstash
 */

if (!process.env.QSTASH_TOKEN) {
    throw new Error("Missing QSTASH_TOKEN environment variable");
}

export const qstash = new Client({
    token: process.env.QSTASH_TOKEN,
});
