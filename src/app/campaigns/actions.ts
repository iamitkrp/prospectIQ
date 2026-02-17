"use server";

import { createClient } from "@/lib/supabase/server";
import type { Campaign, CampaignStep, Prospect } from "@/types/database";

/**
 * Fetch all campaigns for the authenticated user, newest first.
 */
export async function getCampaigns(): Promise<{
    data: Campaign[];
    error: string | null;
}> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { data: [], error: "Not authenticated" };
    }

    const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        return { data: [], error: error.message };
    }

    return { data: (data ?? []) as Campaign[], error: null };
}

/**
 * Create a new campaign (defaults to DRAFT status).
 */
export async function createCampaign(name: string): Promise<{
    data: Campaign | null;
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

    const { data, error } = await supabase
        .from("campaigns")
        .insert({ name, user_id: user.id, status: "DRAFT" })
        .select()
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    return { data: data as Campaign, error: null };
}

/**
 * Update campaign status (DRAFT → ACTIVE → PAUSED → COMPLETED).
 */
export async function updateCampaignStatus(
    campaignId: string,
    status: Campaign["status"]
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: "Not authenticated" };
    }

    const { error } = await supabase
        .from("campaigns")
        .update({ status })
        .eq("id", campaignId);

    if (error) {
        return { error: error.message };
    }

    return { error: null };
}

/**
 * Delete a campaign (and cascade to steps/logs).
 */
export async function deleteCampaign(
    campaignId: string
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: "Not authenticated" };
    }

    const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", campaignId);

    if (error) {
        return { error: error.message };
    }

    return { error: null };
}

/* ================================================================
   STEP ACTIONS
   ================================================================ */

/**
 * Fetch a single campaign with its ordered steps.
 */
export async function getCampaignWithSteps(campaignId: string): Promise<{
    campaign: Campaign | null;
    steps: CampaignStep[];
    error: string | null;
}> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { campaign: null, steps: [], error: "Not authenticated" };
    }

    const { data: campaign, error: campErr } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();

    if (campErr || !campaign) {
        return { campaign: null, steps: [], error: campErr?.message ?? "Campaign not found" };
    }

    const { data: steps, error: stepsErr } = await supabase
        .from("campaign_steps")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("step_order", { ascending: true });

    if (stepsErr) {
        return { campaign: campaign as Campaign, steps: [], error: stepsErr.message };
    }

    return {
        campaign: campaign as Campaign,
        steps: (steps ?? []) as CampaignStep[],
        error: null,
    };
}

/**
 * Add a new step to a campaign at the end.
 */
export async function addStep(
    campaignId: string,
    stepOrder: number,
    delayDays: number,
    promptTemplate: string
): Promise<{ data: CampaignStep | null; error: string | null }> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { data: null, error: "Not authenticated" };
    }

    const { data, error } = await supabase
        .from("campaign_steps")
        .insert({
            campaign_id: campaignId,
            step_order: stepOrder,
            delay_days: delayDays,
            prompt_template: promptTemplate || null,
        })
        .select()
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    return { data: data as CampaignStep, error: null };
}

/**
 * Update a step's delay and prompt template.
 */
export async function updateStep(
    stepId: string,
    delayDays: number,
    promptTemplate: string
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: "Not authenticated" };
    }

    const { error } = await supabase
        .from("campaign_steps")
        .update({
            delay_days: delayDays,
            prompt_template: promptTemplate || null,
        })
        .eq("id", stepId);

    if (error) {
        return { error: error.message };
    }

    return { error: null };
}

/**
 * Remove a step and re-order remaining steps.
 */
export async function removeStep(
    stepId: string,
    campaignId: string
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: "Not authenticated" };
    }

    // Delete the step
    const { error: delErr } = await supabase
        .from("campaign_steps")
        .delete()
        .eq("id", stepId);

    if (delErr) {
        return { error: delErr.message };
    }

    // Re-order remaining steps
    const { data: remaining } = await supabase
        .from("campaign_steps")
        .select("id, step_order")
        .eq("campaign_id", campaignId)
        .order("step_order", { ascending: true });

    if (remaining) {
        for (let i = 0; i < remaining.length; i++) {
            if (remaining[i].step_order !== i + 1) {
                await supabase
                    .from("campaign_steps")
                    .update({ step_order: i + 1 })
                    .eq("id", remaining[i].id);
            }
        }
    }

    return { error: null };
}

/* ================================================================
   CAMPAIGN ↔ PROSPECT ACTIONS
   ================================================================ */

/**
 * Get prospects NOT already in this campaign, for the "Add Prospects" modal.
 */
export async function getAvailableProspects(campaignId: string): Promise<{
    data: Prospect[];
    error: string | null;
}> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { data: [], error: "Not authenticated" };
    }

    // Get IDs already assigned
    const { data: assigned } = await supabase
        .from("campaign_prospects")
        .select("prospect_id")
        .eq("campaign_id", campaignId);

    const assignedIds = (assigned ?? []).map((r) => r.prospect_id);

    // Fetch all user prospects, filter out assigned
    let query = supabase
        .from("prospects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (assignedIds.length > 0) {
        // Supabase doesn't have "not in" natively via .not() with arrays easily,
        // so we filter client-side for simplicity
        const { data: all, error } = await query;
        if (error) return { data: [], error: error.message };
        const filtered = (all ?? []).filter((p) => !assignedIds.includes(p.id));
        return { data: filtered as Prospect[], error: null };
    }

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as Prospect[], error: null };
}

/**
 * Count prospects assigned to a campaign.
 */
export async function getCampaignProspectCount(campaignId: string): Promise<number> {
    const supabase = await createClient();
    const { count } = await supabase
        .from("campaign_prospects")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId);

    return count ?? 0;
}

/**
 * Bulk-add prospects to a campaign.
 */
export async function addProspectsToCampaign(
    campaignId: string,
    prospectIds: string[]
): Promise<{ count: number; error: string | null }> {
    if (prospectIds.length === 0) {
        return { count: 0, error: "No prospects selected" };
    }

    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { count: 0, error: "Not authenticated" };
    }

    const rows = prospectIds.map((pid) => ({
        campaign_id: campaignId,
        prospect_id: pid,
    }));

    const { error } = await supabase
        .from("campaign_prospects")
        .insert(rows);

    if (error) {
        return { count: 0, error: error.message };
    }

    return { count: prospectIds.length, error: null };
}

/**
 * Remove a prospect from a campaign.
 */
export async function removeProspectFromCampaign(
    campaignId: string,
    prospectId: string
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: "Not authenticated" };
    }

    const { error } = await supabase
        .from("campaign_prospects")
        .delete()
        .eq("campaign_id", campaignId)
        .eq("prospect_id", prospectId);

    if (error) {
        return { error: error.message };
    }

    return { error: null };
}

/**
 * Start a campaign: set status to ACTIVE, then trigger Step 1
 * for every assigned prospect via the execute endpoint.
 */
export async function startCampaign(
    campaignId: string
): Promise<{ error: string | null; triggered: number }> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: "Not authenticated", triggered: 0 };
    }

    // 1. Verify campaign is DRAFT and belongs to user
    const { data: campaign, error: campErr } = await supabase
        .from("campaigns")
        .select("id, status")
        .eq("id", campaignId)
        .single();

    if (campErr || !campaign) {
        return { error: "Campaign not found", triggered: 0 };
    }

    if (campaign.status !== "DRAFT") {
        return { error: "Campaign is not in DRAFT status", triggered: 0 };
    }

    // 2. Set status to ACTIVE
    const { error: updateErr } = await supabase
        .from("campaigns")
        .update({ status: "ACTIVE" })
        .eq("id", campaignId);

    if (updateErr) {
        return { error: updateErr.message, triggered: 0 };
    }

    // 3. Fetch all assigned prospect IDs
    const { data: cpRows, error: cpErr } = await supabase
        .from("campaign_prospects")
        .select("prospect_id")
        .eq("campaign_id", campaignId);

    if (cpErr || !cpRows?.length) {
        return { error: cpErr?.message ?? "No prospects assigned", triggered: 0 };
    }

    // 4. Call the execute endpoint for each prospect (Step 1)
    const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000");

    const internalSecret = process.env.CAMPAIGN_INTERNAL_SECRET ?? "";

    let triggered = 0;

    // Fire all Step 1 calls concurrently
    const results = await Promise.allSettled(
        cpRows.map((row) =>
            fetch(`${appUrl}/api/campaign/execute`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-campaign-secret": internalSecret,
                },
                body: JSON.stringify({
                    campaignId,
                    prospectId: row.prospect_id,
                    stepOrder: 1,
                }),
            })
        )
    );

    for (const r of results) {
        if (r.status === "fulfilled" && r.value.ok) {
            triggered++;
        }
    }

    console.log(`[startCampaign] Triggered ${triggered}/${cpRows.length} prospects for campaign ${campaignId}`);

    return { error: null, triggered };
}

