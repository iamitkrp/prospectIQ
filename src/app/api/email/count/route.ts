import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/email/count
 *
 * Returns today's send count for the daily quota badge.
 * Response: { sentToday: number, limit: 300 }
 */

const DAILY_LIMIT = 300;

export async function GET() {
    try {
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

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { count } = await supabase
            .from("email_logs")
            .select("id", { count: "exact", head: true })
            .eq("status", "SENT")
            .gte("sent_at", todayStart.toISOString());

        return NextResponse.json({
            sentToday: count ?? 0,
            limit: DAILY_LIMIT,
        });
    } catch (err) {
        console.error("[email/count] Error:", err);
        return NextResponse.json(
            { sentToday: 0, limit: DAILY_LIMIT },
            { status: 200 }
        );
    }
}
