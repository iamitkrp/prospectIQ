"use server";

import { createClient } from "@/lib/supabase/server";
import type { Campaign } from "@/types/database";

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
