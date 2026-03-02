import * as cheerio from "cheerio";

/**
 * Enrichment data extracted from a website.
 */
export interface EnrichmentResult {
    /** Page title */
    title: string | null;
    /** Meta description */
    description: string | null;
    /** Open Graph / social image */
    ogImage: string | null;
    /** Key paragraphs from the page body */
    keyParagraphs: string[];
    /** Headings (h1–h3) found on the page */
    headings: string[];
    /** Technologies / frameworks detected from meta tags or script sources */
    detectedTech: string[];
    /** Social links found on the page */
    socialLinks: Record<string, string>;
    /** The URL that was scraped */
    sourceUrl: string;
    /** When the scrape was performed */
    scrapedAt: string;
}

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const TIMEOUT_MS = 10_000;
const MAX_BODY_SIZE = 500_000; // 500 KB — don't download massive pages

/**
 * Scrape a website and extract structured enrichment data.
 *
 * @param url - The URL to scrape (e.g. "https://neopay.com")
 * @returns Enrichment data or an error message
 */
export async function scrapeWebsite(
    url: string,
    apiKey?: string | null
): Promise<{ data: EnrichmentResult | null; error: string | null }> {
    try {
        // Normalise URL
        let normalised = url.trim();
        if (!/^https?:\/\//i.test(normalised)) {
            normalised = "https://" + normalised;
        }

        // LinkedIn URLs → route through Google cache or dedicated parser
        if (/linkedin\.com\/in\//i.test(normalised)) {
            return scrapeLinkedIn(normalised, apiKey);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(normalised, {
            headers: {
                "User-Agent": USER_AGENT,
                Accept: "text/html,application/xhtml+xml",
            },
            signal: controller.signal,
            redirect: "follow",
        });

        clearTimeout(timeout);

        if (!response.ok) {
            return { data: null, error: `HTTP ${response.status}: ${response.statusText}` };
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
            return { data: null, error: `Not an HTML page (${contentType})` };
        }

        // Read body with size limit
        const text = await readBodyWithLimit(response, MAX_BODY_SIZE);

        const $ = cheerio.load(text);

        // --- Extract data ---

        const title = $("title").first().text().trim() || null;

        const description =
            $('meta[name="description"]').attr("content")?.trim() ||
            $('meta[property="og:description"]').attr("content")?.trim() ||
            null;

        const ogImage =
            $('meta[property="og:image"]').attr("content")?.trim() ||
            null;

        // Key paragraphs: get the most substantive ones
        const keyParagraphs = extractKeyParagraphs($);

        // Headings: h1, h2, h3
        const headings: string[] = [];
        $("h1, h2, h3").each((_, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 2 && text.length < 200) {
                headings.push(text);
            }
        });

        // Technology detection
        const detectedTech = detectTechnologies($, text);

        // Social links
        const socialLinks = extractSocialLinks($);

        const result: EnrichmentResult = {
            title,
            description,
            ogImage,
            keyParagraphs: keyParagraphs.slice(0, 8), // max 8 paragraphs
            headings: headings.slice(0, 15), // max 15 headings
            detectedTech,
            socialLinks,
            sourceUrl: normalised,
            scrapedAt: new Date().toISOString(),
        };

        return { data: result, error: null };
    } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
            return { data: null, error: "Request timed out (10s)" };
        }
        const message = err instanceof Error ? err.message : "Unknown error";

        // Node's native fetch throws a generic "fetch failed" on DNS or connection errors
        if (message === "fetch failed" || (err as { cause?: { code?: string } })?.cause?.code === "ENOTFOUND") {
            return { data: null, error: "Website unreachable (domain may not exist or blocked access)" };
        }

        return { data: null, error: message };
    }
}

/**
 * Fetch a LinkedIn profile via the Enrich Layer API (Proxycurl-compatible).
 * Requires user-provided API key or PROXYCURL_API_KEY env var fallback.
 * Docs: https://enrichlayer.com/docs/api/person-profile-endpoint
 */
async function scrapeLinkedIn(
    linkedinUrl: string,
    userApiKey?: string | null
): Promise<{ data: EnrichmentResult | null; error: string | null }> {
    const apiKey = userApiKey || process.env.PROXYCURL_API_KEY;
    if (!apiKey) {
        return {
            data: null,
            error: "Please connect your Enrich Layer API key in Settings to enable LinkedIn enrichment.",
        };
    }

    try {
        console.log(`[enrich] Fetching LinkedIn profile via Enrich Layer: ${linkedinUrl}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);

        const response = await fetch(
            `https://enrichlayer.com/api/v2/profile?linkedin_profile_url=${encodeURIComponent(linkedinUrl)}&extra=include`,
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
                signal: controller.signal,
            }
        );

        clearTimeout(timeout);

        if (!response.ok) {
            const errBody = await response.text();
            console.error(`[enrich] Proxycurl error (${response.status}):`, errBody);

            if (response.status === 401 || response.status === 403) {
                return { data: null, error: "Proxycurl API key is invalid or expired." };
            }
            if (response.status === 404) {
                return { data: null, error: "LinkedIn profile not found via Proxycurl. Check the URL." };
            }
            if (response.status === 429) {
                return { data: null, error: "Proxycurl rate limit hit. Try again later." };
            }
            return { data: null, error: `Proxycurl returned HTTP ${response.status}: ${errBody.slice(0, 200)}` };
        }

        const profile = await response.json();

        // Build structured paragraphs from the profile data
        const keyParagraphs: string[] = [];

        if (profile.headline) {
            keyParagraphs.push(`Headline: ${profile.headline}`);
        }
        if (profile.summary) {
            keyParagraphs.push(profile.summary);
        }

        // Experience entries
        if (profile.experiences?.length) {
            for (const exp of profile.experiences.slice(0, 4)) {
                const parts = [exp.title, exp.company, exp.description?.slice(0, 300)].filter(Boolean);
                if (parts.length) {
                    keyParagraphs.push(`Experience: ${parts.join(" — ")}`);
                }
            }
        }

        // Education
        if (profile.education?.length) {
            for (const edu of profile.education.slice(0, 2)) {
                const parts = [edu.degree_name, edu.field_of_study, edu.school].filter(Boolean);
                if (parts.length) {
                    keyParagraphs.push(`Education: ${parts.join(", ")}`);
                }
            }
        }

        // Skills
        if (profile.skills?.length) {
            keyParagraphs.push(`Skills: ${profile.skills.join(", ")}`);
        }

        // Headings from profile
        const headings: string[] = [];
        if (profile.full_name) headings.push(profile.full_name);
        if (profile.headline) headings.push(profile.headline);
        if (profile.occupation) headings.push(profile.occupation);

        // Social links
        const socialLinks: Record<string, string> = { linkedin: linkedinUrl };
        if (profile.personal_emails?.length) {
            socialLinks.email = profile.personal_emails[0];
        }
        if (profile.github_profile_id) {
            socialLinks.github = `https://github.com/${profile.github_profile_id}`;
        }
        if (profile.twitter_profile_id) {
            socialLinks.twitter = `https://x.com/${profile.twitter_profile_id}`;
        }

        const title = profile.full_name
            ? `${profile.full_name}${profile.headline ? ` — ${profile.headline}` : ""}`
            : null;

        const description = profile.summary?.slice(0, 500) || profile.headline || null;

        const result: EnrichmentResult = {
            title,
            description,
            ogImage: profile.profile_pic_url || null,
            keyParagraphs: keyParagraphs.slice(0, 10),
            headings: headings.slice(0, 5),
            detectedTech: [],
            socialLinks,
            sourceUrl: linkedinUrl,
            scrapedAt: new Date().toISOString(),
        };

        // ── Step 2: Auto-scrape company website if found in profile ──
        const companyUrl = extractCompanyUrl(profile);
        if (companyUrl) {
            console.log(`[enrich] Found company website from LinkedIn: ${companyUrl}, scraping...`);
            const { data: siteData } = await scrapeWebsite(companyUrl);
            if (siteData) {
                // Merge website data into the LinkedIn result
                result.keyParagraphs = [
                    ...result.keyParagraphs,
                    ...siteData.keyParagraphs.map((p) => `[Company] ${p}`),
                ].slice(0, 15);

                result.headings = [
                    ...result.headings,
                    ...siteData.headings.map((h) => `[Company] ${h}`),
                ].slice(0, 10);

                if (siteData.description) {
                    result.description = `${result.description ?? ""}\n\nCompany: ${siteData.description}`;
                }

                result.detectedTech = siteData.detectedTech;
                result.socialLinks = { ...siteData.socialLinks, ...result.socialLinks };

                // Add company site as a social link
                result.socialLinks.website = companyUrl;

                console.log(`[enrich] Merged company website data from ${companyUrl}`);
            }
        }

        console.log(`[enrich] Enrichment complete for ${linkedinUrl}: ${result.keyParagraphs.length} total paragraphs`);
        return { data: result, error: null };
    } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
            return { data: null, error: "Proxycurl request timed out (20s). Try again." };
        }
        console.error(`[enrich] Proxycurl exception:`, err);
        return {
            data: null,
            error: `Proxycurl request failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        };
    }
}

/**
 * Extract the best company/personal website URL from a LinkedIn profile response.
 * Checks: experiences[0].company_linkedin_profile_url domain, personal websites, etc.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCompanyUrl(profile: Record<string, any>): string | null {
    // 1. Check if the current company has a website in its LinkedIn data
    if (profile.experiences?.length) {
        const current = profile.experiences[0]; // most recent experience
        // Some profiles include the company's website
        if (current.company_linkedin_profile_url) {
            // We can't scrape LinkedIn company pages either, but the company name helps
        }
        // Try to derive website from company name
        if (current.company) {
            const companySlug = current.company.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
            if (companySlug && companySlug.length > 1) {
                // Common pattern: company name → companyname.com
                return `https://${companySlug}.com`;
            }
        }
    }

    // 2. Check personal websites from the profile
    if (profile.personal_urls?.length) {
        for (const urlObj of profile.personal_urls) {
            const url = typeof urlObj === "string" ? urlObj : urlObj?.url;
            if (url && !url.includes("linkedin.com")) {
                return url.startsWith("http") ? url : `https://${url}`;
            }
        }
    }

    // 3. Check websites array
    if (profile.websites?.length) {
        for (const site of profile.websites) {
            const url = typeof site === "string" ? site : site?.url;
            if (url && !url.includes("linkedin.com")) {
                return url.startsWith("http") ? url : `https://${url}`;
            }
        }
    }

    return null;
}

/**
 * Read the response body up to a size limit.
 */
async function readBodyWithLimit(response: Response, limit: number): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return await response.text();

    const decoder = new TextDecoder();
    let result = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        if (result.length > limit) {
            reader.cancel();
            break;
        }
    }

    return result;
}

/**
 * Extract the most meaningful paragraphs from the page.
 * Filters out short/boilerplate text.
 */
function extractKeyParagraphs($: cheerio.CheerioAPI): string[] {
    const paragraphs: string[] = [];

    // Remove noise elements
    $("nav, footer, header, script, style, noscript, iframe, form, .cookie, .nav, .menu, .footer").remove();

    $("p, [class*='description'], [class*='about'], [class*='summary']").each((_, el) => {
        const text = $(el).text().trim();
        // Keep paragraphs that are meaningful (30+ chars, not too long)
        if (text.length >= 30 && text.length <= 1000) {
            // Skip common boilerplate
            const lower = text.toLowerCase();
            if (
                lower.includes("cookie") ||
                lower.includes("privacy policy") ||
                lower.includes("terms of service") ||
                lower.includes("all rights reserved") ||
                lower.includes("subscribe to") ||
                lower.includes("sign up for")
            ) {
                return;
            }
            paragraphs.push(text);
        }
    });

    // Deduplicate
    return [...new Set(paragraphs)];
}

/**
 * Detect technologies from page source.
 */
function detectTechnologies($: cheerio.CheerioAPI, html: string): string[] {
    const tech: Set<string> = new Set();

    // Meta generator
    const generator = $('meta[name="generator"]').attr("content");
    if (generator) tech.add(generator.split(/\s/)[0]);

    // Script source detection
    const techPatterns: [RegExp, string][] = [
        [/react/i, "React"],
        [/vue/i, "Vue.js"],
        [/angular/i, "Angular"],
        [/next/i, "Next.js"],
        [/nuxt/i, "Nuxt.js"],
        [/svelte/i, "Svelte"],
        [/wordpress/i, "WordPress"],
        [/shopify/i, "Shopify"],
        [/webflow/i, "Webflow"],
        [/squarespace/i, "Squarespace"],
        [/wix/i, "Wix"],
        [/stripe/i, "Stripe"],
        [/intercom/i, "Intercom"],
        [/hubspot/i, "HubSpot"],
        [/google-analytics|gtag/i, "Google Analytics"],
        [/segment/i, "Segment"],
        [/hotjar/i, "Hotjar"],
    ];

    $("script[src]").each((_, el) => {
        const src = $(el).attr("src") ?? "";
        for (const [pattern, name] of techPatterns) {
            if (pattern.test(src)) tech.add(name);
        }
    });

    // Check the HTML itself for some patterns
    const htmlPatterns: [RegExp, string][] = [
        [/__NEXT_DATA__/i, "Next.js"],
        [/data-reactroot/i, "React"],
        [/ng-version/i, "Angular"],
        [/nuxt/i, "Nuxt.js"],
    ];

    for (const [pattern, name] of htmlPatterns) {
        if (pattern.test(html)) tech.add(name);
    }

    return [...tech];
}

/**
 * Extract social media links from the page.
 */
function extractSocialLinks($: cheerio.CheerioAPI): Record<string, string> {
    const links: Record<string, string> = {};
    const socialPatterns: [RegExp, string][] = [
        [/linkedin\.com/i, "linkedin"],
        [/twitter\.com|x\.com/i, "twitter"],
        [/facebook\.com/i, "facebook"],
        [/instagram\.com/i, "instagram"],
        [/github\.com/i, "github"],
        [/youtube\.com/i, "youtube"],
    ];

    $("a[href]").each((_, el) => {
        const href = $(el).attr("href") ?? "";
        for (const [pattern, name] of socialPatterns) {
            if (pattern.test(href) && !links[name]) {
                links[name] = href;
            }
        }
    });

    return links;
}
