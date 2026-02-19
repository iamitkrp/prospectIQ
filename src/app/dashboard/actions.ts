"use server";

import { createClient } from "@/utils/supabase/server";

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
        const campaignIds = campaigns.map((c) => c.id);

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
        (cpRows ?? []).forEach((r) => {
            prospectCounts.set(r.campaign_id, (prospectCounts.get(r.campaign_id) ?? 0) + 1);
        });

        const statusCounts = new Map<string, Record<string, number>>();
        (logRows ?? []).forEach((r) => {
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
