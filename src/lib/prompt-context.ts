import type { EnrichmentResult } from "./enrichment";

/**
 * Builds a structured context block from a prospect's enrichment data + notes
 * that can be injected into an AI prompt for personalised email generation.
 *
 * @param rawData - The prospect's raw_data JSONB value
 * @param prospect - Basic prospect info (name, company, role)
 * @returns A formatted string ready to paste into a system/user prompt
 */
export function buildEnrichmentContext(
    rawData: Record<string, unknown> | null | undefined,
    prospect: {
        first_name?: string | null;
        last_name?: string | null;
        company_name?: string | null;
        role?: string | null;
        email?: string | null;
    }
): string {
    const lines: string[] = [];

    const name = [prospect.first_name, prospect.last_name]
        .filter(Boolean)
        .join(" ");

    lines.push("## Prospect Context");
    lines.push("");

    if (name) lines.push(`- **Name:** ${name}`);
    if (prospect.email) lines.push(`- **Email:** ${prospect.email}`);
    if (prospect.company_name) lines.push(`- **Company:** ${prospect.company_name}`);
    if (prospect.role) lines.push(`- **Role:** ${prospect.role}`);

    if (!rawData) {
        lines.push("");
        lines.push("_No enrichment data available._");
        return lines.join("\n");
    }

    // Enrichment (scraped)
    const enrichment = rawData.enrichment as EnrichmentResult | undefined;

    if (enrichment) {
        lines.push("");
        lines.push("### Company Website Insights");

        if (enrichment.title) {
            lines.push(`- **Website Title:** ${enrichment.title}`);
        }

        if (enrichment.description) {
            lines.push(`- **Description:** ${enrichment.description}`);
        }

        if (enrichment.detectedTech.length > 0) {
            lines.push(`- **Tech Stack:** ${enrichment.detectedTech.join(", ")}`);
        }

        if (Object.keys(enrichment.socialLinks).length > 0) {
            const links = Object.entries(enrichment.socialLinks)
                .map(([platform, url]) => `${platform}: ${url}`)
                .join(", ");
            lines.push(`- **Social:** ${links}`);
        }

        if (enrichment.keyParagraphs.length > 0) {
            lines.push("");
            lines.push("### What They Do");
            enrichment.keyParagraphs.slice(0, 4).forEach((p) => {
                lines.push(`> ${p}`);
            });
        }

        if (enrichment.headings.length > 0) {
            lines.push("");
            lines.push("### Page Sections");
            enrichment.headings.slice(0, 8).forEach((h) => {
                lines.push(`- ${h}`);
            });
        }
    }

    // Manual notes
    const notes = rawData.notes as string | undefined;
    if (notes?.trim()) {
        lines.push("");
        lines.push("### Sender's Notes");
        lines.push(notes.trim());
    }

    return lines.join("\n");
}
