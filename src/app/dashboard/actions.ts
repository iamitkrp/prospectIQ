"use server";

import { createClient } from "@/lib/supabase/server";

export interface DashboardStats {
    totalProspects: number;
    activeCampaigns: number;
    emailsSentToday: number;
    /** Campaign-level analytics */
    campaignAnalytics: {
        campaignId: string;
        campaignName: string;
        status: string;
        prospectCount: number;
        sent: number;
        pending: number;
        failed: number;
        replied: number;
    }[];
    /** Overall reply rate as a percentage (or null if no emails sent) */
    replyRate: number | null;
}

/**
 * Fetch dashboard overview + campaign analytics for the authenticated user.
 */
export async function getDashboardStats(): Promise<{
    data: DashboardStats | null;
    error: string | null;
}> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { data: null, error: "Not authenticated" };
    }

    // 1. Total prospects
    const { count: totalProspects } = await supabase
        .from("prospects")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

    // 2. Active campaigns
    const { count: activeCampaigns } = await supabase
        .from("campaigns")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "ACTIVE");

    // 3. Emails sent today (UTC date boundary)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: emailsSentToday } = await supabase
        .from("email_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "SENT")
        .gte("sent_at", todayStart.toISOString());

    // 4. All campaigns for this user (for analytics)
    const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id, name, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    // 5. Build per-campaign analytics
    const campaignAnalytics: DashboardStats["campaignAnalytics"] = [];
    let totalSent = 0;
    let totalReplied = 0;

    if (campaigns && campaigns.length > 0) {
        const campaignIds = campaigns.map((c: { id: string }) => c.id);

        // Prospect counts per campaign
        const { data: cpRows } = await supabase
            .from("campaign_prospects")
            .select("campaign_id")
            .in("campaign_id", campaignIds);

        // Email log status counts per campaign
        const { data: logRows } = await supabase
            .from("email_logs")
            .select("campaign_id, status")
            .in("campaign_id", campaignIds);

        // Aggregate
        const prospectCounts = new Map<string, number>();
        (cpRows ?? []).forEach((r: { campaign_id: string }) => {
            prospectCounts.set(r.campaign_id, (prospectCounts.get(r.campaign_id) ?? 0) + 1);
        });

        const statusCounts = new Map<string, Record<string, number>>();
        (logRows ?? []).forEach((r: { campaign_id: string; status: string }) => {
            if (!statusCounts.has(r.campaign_id)) {
                statusCounts.set(r.campaign_id, { SENT: 0, PENDING: 0, QUEUED: 0, FAILED: 0, REPLIED: 0 });
            }
            const counts = statusCounts.get(r.campaign_id)!;
            counts[r.status] = (counts[r.status] ?? 0) + 1;
        });

        for (const c of campaigns) {
            const counts = statusCounts.get(c.id) ?? { SENT: 0, PENDING: 0, QUEUED: 0, FAILED: 0, REPLIED: 0 };
            const sent = counts.SENT ?? 0;
            const replied = counts.REPLIED ?? 0;
            totalSent += sent + replied;
            totalReplied += replied;

            campaignAnalytics.push({
                campaignId: c.id,
                campaignName: c.name,
                status: c.status,
                prospectCount: prospectCounts.get(c.id) ?? 0,
                sent,
                pending: (counts.PENDING ?? 0) + (counts.QUEUED ?? 0),
                failed: counts.FAILED ?? 0,
                replied,
            });
        }
    }

    const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : null;

    return {
        data: {
            totalProspects: totalProspects ?? 0,
            activeCampaigns: activeCampaigns ?? 0,
            emailsSentToday: emailsSentToday ?? 0,
            campaignAnalytics,
            replyRate,
        },
        error: null,
    };
}

/* ─────────────────────────────────────────────────────────
   4.3.3 — Email activity (last 30 days)
   ───────────────────────────────────────────────────────── */

export interface DailyEmailCount {
    date: string;      // YYYY-MM-DD
    sent: number;
    failed: number;
    replied: number;
}

/**
 * Aggregate emails sent per day for the last 30 days.
 */
export async function getEmailActivity(): Promise<{
    data: DailyEmailCount[];
    error: string | null;
}> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { data: [], error: "Not authenticated" };
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const { data: logs, error } = await supabase
        .from("email_logs")
        .select("status, sent_at")
        .in("status", ["SENT", "FAILED", "REPLIED"])
        .gte("sent_at", thirtyDaysAgo.toISOString());

    if (error) {
        return { data: [], error: error.message };
    }

    // Aggregate by date
    const buckets = new Map<string, { sent: number; failed: number; replied: number }>();

    // Pre-fill all 30 days
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        buckets.set(key, { sent: 0, failed: 0, replied: 0 });
    }

    (logs ?? []).forEach((row: { status: string; sent_at: string | null }) => {
        if (!row.sent_at) return;
        const key = row.sent_at.split("T")[0];
        const bucket = buckets.get(key);
        if (!bucket) return;

        if (row.status === "SENT") bucket.sent++;
        else if (row.status === "FAILED") bucket.failed++;
        else if (row.status === "REPLIED") bucket.replied++;
    });

    const data: DailyEmailCount[] = Array.from(buckets.entries()).map(
        ([date, counts]) => ({ date, ...counts })
    );

    return { data, error: null };
}

/* ─────────────────────────────────────────────────────────
   4.3.4 — Brevo quota info
   ───────────────────────────────────────────────────────── */

export interface BrevoQuota {
    dailyLimit: number;
    dailyUsed: number;
    dailyRemaining: number;
    monthlyLimit: number;
    monthlyUsed: number;
    monthlyRemaining: number;
}

/**
 * Get Brevo quota (daily + monthly usage).
 */
export async function getBrevoQuota(): Promise<{
    data: BrevoQuota | null;
    error: string | null;
}> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { data: null, error: "Not authenticated" };
    }

    const dailyLimit = parseInt(process.env.DAILY_SEND_LIMIT ?? "300", 10);
    const monthlyLimit = 9000; // Brevo free tier

    // Today's count
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: dailyUsed } = await supabase
        .from("email_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "SENT")
        .gte("sent_at", todayStart.toISOString());

    // This month's count
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count: monthlyUsed } = await supabase
        .from("email_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "SENT")
        .gte("sent_at", monthStart.toISOString());

    const dUsed = dailyUsed ?? 0;
    const mUsed = monthlyUsed ?? 0;

    return {
        data: {
            dailyLimit,
            dailyUsed: dUsed,
            dailyRemaining: Math.max(0, dailyLimit - dUsed),
            monthlyLimit,
            monthlyUsed: mUsed,
            monthlyRemaining: Math.max(0, monthlyLimit - mUsed),
        },
        error: null,
    };
}

