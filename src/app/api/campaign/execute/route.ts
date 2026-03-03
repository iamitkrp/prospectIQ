import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { executeCampaignStep } from "@/lib/campaign-engine";

/**
 * POST /api/campaign/execute
 *
 * The campaign execution engine. Called by QStash (or "Start Campaign")
 * to execute a single step for a single prospect.
 *
 * SECURITY: Every request must pass ONE of:
 *   1. QStash signature verification (for scheduled callbacks)
 *   2. Internal secret header (for server-side "Start Campaign" calls)
 *
 * Body: {
 *   campaignId: string,
 *   prospectId: string,
 *   stepOrder:  number,   — which step to execute (1-based)
 * }
 *
 * Flow:
 *   0. Verify caller identity (QStash signature OR internal secret)
 *   1. Validate input
 *   2. Reply-check guard — skip if prospect already replied
 *   2b. 24-hour guard — skip if email sent to this prospect within 24h
 *   2c. Daily limit guard — skip if daily send limit reached
 *   3. Fetch campaign, step, and prospect data
 *   4. Generate email via Groq using step's prompt_template
 *   5. Send via user's SMTP
 *   6. Log to email_logs (classify permanent vs transient errors)
 *   7. Schedule next step via QStash (if one exists)
 */




/* ── QStash signature receiver (lazy-init to avoid crash if env is missing in dev) ── */
let _receiver: Receiver | null = null;
function getReceiver(): Receiver | null {
    if (_receiver) return _receiver;
    const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
    if (!currentKey || !nextKey) return null;
    _receiver = new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
    return _receiver;
}

/**
 * Verify that the request is from a trusted source.
 * Returns null if verified, or a NextResponse with 401 if not.
 */
async function verifyRequest(request: NextRequest, rawBody: string): Promise<NextResponse | null> {
    // Path 1: Internal server-side call with shared secret
    const internalSecret = process.env.CAMPAIGN_INTERNAL_SECRET;
    const authHeader = request.headers.get("x-campaign-secret");
    if (internalSecret && authHeader && internalSecret === authHeader) {
        return null; // ✅ Verified via internal secret
    }

    // Path 2: QStash signature verification
    const receiver = getReceiver();
    if (!receiver) {
        // In development without QStash keys, only allow internal secret
        if (process.env.NODE_ENV === "development" && !internalSecret) {
            console.warn("[execute] ⚠️  No QSTASH signing keys or CAMPAIGN_INTERNAL_SECRET set — allowing in dev only");
            return null;
        }
        console.error("[execute] Server misconfigured: no QStash signing keys.");
        return NextResponse.json(
            { error: "Server misconfigured: no QStash signing keys." },
            { status: 500 }
        );
    }

    const signature = request.headers.get("upstash-signature");
    if (!signature) {
        console.error("[execute] Unauthorized: missing signature.");
        return NextResponse.json(
            { error: "Unauthorized: missing signature." },
            { status: 401 }
        );
    }

    try {
        await receiver.verify({
            signature,
            body: rawBody,
        });
        return null; // ✅ Verified via QStash
    } catch (err) {
        console.error("[execute] QStash signature verification failed:", err);
        return NextResponse.json(
            { error: "Unauthorized: invalid signature." },
            { status: 401 }
        );
    }
}

export async function POST(request: NextRequest) {
    console.log("================= [execute] POST STARTED =================");
    try {
        const rawBody = await request.text();

        const authResult = await verifyRequest(request, rawBody);
        if (authResult) {
            console.log(`[execute] Auth failed, returning status: ${authResult.status}`);
            return authResult; // 401
        }

        const body = JSON.parse(rawBody);
        const { campaignId, prospectId, stepOrder } = body as {
            campaignId: string;
            prospectId: string;
            stepOrder: number;
        };

        if (!campaignId || !prospectId || typeof stepOrder !== "number") {
            return NextResponse.json(
                { error: "campaignId, prospectId, and stepOrder are required." },
                { status: 400 }
            );
        }

        const result = await executeCampaignStep(campaignId, prospectId, stepOrder);

        if (result.error && result.permanent) {
            // Permanent error, 200 so QStash doesn't retry
            return NextResponse.json(result, { status: 200 });
        } else if (result.error) {
            // Transient error, 500 so QStash retries
            return NextResponse.json(result, { status: 500 });
        }

        return NextResponse.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal server error";
        console.error("[execute] Unexpected error:", err);
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
