"use server";

import { createClient } from "@/lib/supabase/server";
import type { Campaign, CampaignStep } from "@/types/database";

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

