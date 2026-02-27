import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scrapeWebsite } from "@/lib/enrichment";

/**
 * POST /api/prospects/enrich
 *
 * Accepts { prospectId } in the JSON body.
 * 1. Looks up the prospect (must belong to the authenticated user via RLS).
 * 2. Determines a URL to scrape (company website from linkedin_url domain, or company_name search).
 * 3. Scrapes the URL with the enrichment utility.
 * 4. Stores the result in the prospect's raw_data JSONB column.
 * 5. Returns the enrichment data.
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Parse body
        const body = await request.json();
        const { prospectId, url: manualUrl } = body as {
            prospectId: string;
            url?: string;
        };

        if (!prospectId) {
            return NextResponse.json(
                { error: "prospectId is required" },
                { status: 400 }
            );
        }

        // 2. Auth check — get authenticated user
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // 3. Fetch the prospect (RLS ensures user can only access their own)
        const { data: prospect, error: fetchError } = await supabase
            .from("prospects")
            .select("id, company_name, linkedin_url, raw_data")
            .eq("id", prospectId)
            .single();

        if (fetchError || !prospect) {
            return NextResponse.json(
                { error: "Prospect not found" },
                { status: 404 }
            );
        }

        // 4. Determine URL to scrape
        const scrapeUrl = resolveUrl(manualUrl, prospect);

        if (!scrapeUrl) {
            return NextResponse.json(
                {
                    error:
                        "No URL to scrape. Provide a url in the request body, or add a company name / LinkedIn URL to the prospect.",
                },
                { status: 422 }
            );
        }

        // 5. Scrape
        const { data: enrichment, error: scrapeError } =
            await scrapeWebsite(scrapeUrl);

        if (scrapeError || !enrichment) {
            return NextResponse.json(
                { error: `Scrape failed: ${scrapeError}` },
                { status: 502 }
            );
        }

        // 6. Merge with existing raw_data (don't overwrite manual notes)
        const existingRawData =
            (prospect.raw_data as Record<string, unknown>) ?? {};
        const updatedRawData = {
            ...existingRawData,
            enrichment,
            enrichedAt: new Date().toISOString(),
        };

        // 7. Save to DB
        const { error: updateError } = await supabase
            .from("prospects")
            .update({ raw_data: updatedRawData })
            .eq("id", prospectId);

        if (updateError) {
            return NextResponse.json(
                { error: `Database update failed: ${updateError.message}` },
                { status: 500 }
            );
        }

        // 8. Return enrichment data
        return NextResponse.json({
            success: true,
            enrichment,
            scrapedUrl: scrapeUrl,
        });
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/**
 * Determine the best URL to scrape for a prospect.
 * Priority: manual URL > company website > LinkedIn (last resort).
 * LinkedIn is deprioritised because it returns HTTP 999 for server-side fetches.
 */
function resolveUrl(
    manualUrl: string | undefined,
    prospect: { company_name: string | null; linkedin_url: string | null }
): string | null {
    // 1. Manual URL provided in the request
    if (manualUrl?.trim()) {
        return manualUrl.trim();
    }

    // 2. Company name — try the company's likely website
    if (prospect.company_name?.trim()) {
        let name = prospect.company_name.trim().toLowerCase();

        // If the company name already looks like a domain (e.g., "amitkp.com")
        if (name.includes(".")) {
            name = name.replace(/\s+/g, ""); // Remove spaces just in case
            return `https://${name}`;
        }

        const slug = name.replace(/[^a-z0-9]+/g, "");
        if (slug) {
            return `https://${slug}.com`;
        }
    }

    // 3. LinkedIn — last resort (often blocked with HTTP 999)
    if (prospect.linkedin_url?.trim()) {
        return prospect.linkedin_url.trim();
    }

    return null;
}
