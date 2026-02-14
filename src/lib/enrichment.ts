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
    url: string
): Promise<{ data: EnrichmentResult | null; error: string | null }> {
    try {
        // Normalise URL
        let normalised = url.trim();
        if (!/^https?:\/\//i.test(normalised)) {
            normalised = "https://" + normalised;
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
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
            return { data: null, error: "Request timed out (10s)" };
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        return { data: null, error: message };
    }
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
