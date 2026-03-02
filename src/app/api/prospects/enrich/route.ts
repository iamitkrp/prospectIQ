import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scrapeWebsite } from "@/lib/enrichment";
import { getDecryptedEnrichKey } from "@/app/(dashboard)/settings/actions";

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
        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body", details: { stage: "parse_body" } },
                { status: 400 }
            );
        }

        const { prospectId, url: manualUrl } = body as {
            prospectId: string;
            url?: string;
        };

        if (!prospectId) {
            return NextResponse.json(
                { error: "prospectId is required", details: { stage: "validation" } },
                { status: 400 }
            );
        }

        // 2. Auth check
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                {
                    error: "Unauthorized",
                    details: {
                        stage: "auth",
                        reason: authError?.message ?? "No authenticated user session",
                    },
                },
                { status: 401 }
            );
        }

        // 3. Fetch the prospect
        const { data: prospect, error: fetchError } = await supabase
            .from("prospects")
            .select("id, first_name, last_name, email, company_name, role, linkedin_url, raw_data")
            .eq("id", prospectId)
            .single();

        if (fetchError || !prospect) {
            return NextResponse.json(
                {
                    error: "Prospect not found",
                    details: {
                        stage: "fetch_prospect",
                        prospectId,
                        dbError: fetchError?.message ?? "No matching row",
                    },
                },
                { status: 404 }
            );
        }

        // 4. Determine URL to scrape
        const scrapeUrl = resolveUrl(manualUrl, prospect);

        if (!scrapeUrl) {
            return NextResponse.json(
                {
                    error:
                        "No URL to scrape. Add a company name or LinkedIn URL to the prospect, or provide a url in the request body.",
                    details: {
                        stage: "resolve_url",
                        companyName: prospect.company_name,
                        linkedinUrl: prospect.linkedin_url,
                        manualUrl: manualUrl ?? null,
                    },
                },
                { status: 422 }
            );
        }

        // 5. Fetch user's Enrich Layer API Key (if any)
        const userApiKey = await getDecryptedEnrichKey(user.id);

        // 6. Scrape
        console.log(`[enrich] Scraping URL: ${scrapeUrl} for prospect ${prospectId}`);
        const { data: enrichment, error: scrapeError } =
            await scrapeWebsite(scrapeUrl, userApiKey);

        if (scrapeError || !enrichment) {
            console.error(`[enrich] Scrape failed for ${scrapeUrl}: ${scrapeError}`);
            return NextResponse.json(
                {
                    error: `Scrape failed: ${scrapeError}`,
                    details: {
                        stage: "scrape",
                        attemptedUrl: scrapeUrl,
                        scrapeError,
                        isLinkedIn: /linkedin\.com/i.test(scrapeUrl),
                        hint: /linkedin\.com/i.test(scrapeUrl)
                            ? "LinkedIn blocks direct scraping. Google cache was attempted but may not have this profile cached. Try adding a company website URL instead."
                            : "The website may be down, blocking automated requests, or the domain might not exist.",
                    },
                },
                { status: 502 }
            );
        }

        // 6. Merge with existing raw_data
        const existingRawData =
            (prospect.raw_data as Record<string, unknown>) ?? {};
        const updatedRawData = {
            ...existingRawData,
            enrichment,
            enrichedAt: new Date().toISOString(),
        };

        // 6b. Auto-fill empty prospect fields from enrichment data
        const autoFill: Record<string, string> = {};

        // Extract name from enrichment headings (first heading is usually full name)
        if (enrichment.headings?.length && (!prospect.first_name || !prospect.last_name)) {
            const fullName = enrichment.headings[0];
            if (fullName && !fullName.includes("—")) {
                const parts = fullName.split(/\s+/);
                if (!prospect.first_name && parts[0]) autoFill.first_name = parts[0];
                if (!prospect.last_name && parts.length > 1) autoFill.last_name = parts.slice(1).join(" ");
            }
        }

        // Extract company from experience (keyParagraphs usually has "Experience: Title — Company")  
        if (!prospect.company_name && enrichment.keyParagraphs?.length) {
            for (const p of enrichment.keyParagraphs) {
                if (p.startsWith("Experience:")) {
                    const parts = p.replace("Experience: ", "").split(" — ");
                    if (parts[1]) {
                        autoFill.company_name = parts[1].split(" — ")[0]; // first company
                        if (!prospect.role && parts[0]) autoFill.role = parts[0]; // job title
                        break;
                    }
                }
            }
        }

        // Extract role from headline if still empty
        if (!prospect.role && !autoFill.role && enrichment.headings?.[1]) {
            autoFill.role = enrichment.headings[1]; // headline is usually the 2nd heading
        }

        // Extract email from enrichment social links
        if (enrichment.socialLinks?.email) {
            // Only auto-fill if the current email looks like a placeholder
            if (!prospect.email || prospect.email === "") {
                autoFill.email = enrichment.socialLinks.email;
            }
        }

        // 7. Save to DB (raw_data + auto-filled fields)
        const updatePayload: Record<string, unknown> = { raw_data: updatedRawData };
        if (Object.keys(autoFill).length > 0) {
            Object.assign(updatePayload, autoFill);
            console.log(`[enrich] Auto-filling fields for prospect ${prospectId}:`, autoFill);
        }

        const { error: updateError } = await supabase
            .from("prospects")
            .update(updatePayload)
            .eq("id", prospectId);

        if (updateError) {
            console.error(`[enrich] DB update failed for prospect ${prospectId}: ${updateError.message}`);
            return NextResponse.json(
                {
                    error: `Database update failed: ${updateError.message}`,
                    details: {
                        stage: "db_update",
                        prospectId,
                        dbError: updateError.message,
                    },
                },
                { status: 500 }
            );
        }

        // 8. Success
        console.log(`[enrich] Success for prospect ${prospectId} via ${scrapeUrl}`);
        return NextResponse.json({
            success: true,
            enrichment,
            scrapedUrl: scrapeUrl,
        });
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "Internal server error";
        const stack = err instanceof Error ? err.stack : undefined;
        console.error(`[enrich] Unhandled error:`, message, stack);
        return NextResponse.json(
            {
                error: message,
                details: {
                    stage: "unhandled_exception",
                    stack: process.env.NODE_ENV === "development" ? stack : undefined,
                },
            },
            { status: 500 }
        );
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
