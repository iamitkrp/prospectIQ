"use server";

import { createClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash";
import { executeCampaignStep } from "@/lib/campaign-engine";
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
export async function createCampaign(name: string, requireApproval: boolean = false): Promise<{
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
        .insert({ name, user_id: user.id, status: "DRAFT", require_approval: requireApproval })
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

    // 4. Call the execute engine directly for each prospect (Step 1)
    let triggered = 0;

    console.log(`[startCampaign] Executing Step 1 for ${cpRows.length} prospects...`);
    const results = await Promise.allSettled(
        cpRows.map((row) => executeCampaignStep(campaignId, row.prospect_id, 1))
    );

    for (const [index, r] of results.entries()) {
        const prospectId = cpRows[index].prospect_id;
        if (r.status === "fulfilled") {
            const result = r.value;
            if (result.error) {
                console.error(`[startCampaign] Execution error for ${prospectId}:`, result.error);
            } else if (result.skipped) {
                console.log(`[startCampaign] Execution skipped for ${prospectId}:`, result.reason);
            } else {
                triggered++;
            }
        } else {
            console.error(`[startCampaign] Unhandled promise rejection for ${prospectId}:`, r.reason);
        }
    }

    console.log(`[startCampaign] Triggered ${triggered}/${cpRows.length} prospects for campaign ${campaignId}`);

    return { error: null, triggered };
}

/* ═══════════════════════════════════════════════
   Campaign Monitoring (Sprint 3.3)
   ═══════════════════════════════════════════════ */

export interface ActivityEntry {
    id: string;
    prospect_name: string;
    prospect_email: string;
    step_order: number;
    status: string;
    sent_at: string | null;
    subject: string | null;
    body: string | null;
}

/**
 * Fetch campaign activity feed (email events), newest first.
 */
export async function getCampaignActivity(
    campaignId: string
): Promise<ActivityEntry[]> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return [];

    const { data, error } = await supabase
        .from("email_logs")
        .select(`
            id,
            status,
            sent_at,
            subject,
            body,
            prospect_id,
            step_id,
            prospects!inner( first_name, last_name, email ),
            campaign_steps!inner( step_order )
        `)
        .eq("campaign_id", campaignId)
        .order("sent_at", { ascending: false, nullsFirst: false })
        .limit(100);

    if (error || !data) {
        console.error("[getCampaignActivity]", error);
        return [];
    }

    return data.map((row: Record<string, unknown>) => {
        const prospect = row.prospects as { first_name: string | null; last_name: string | null; email: string } | null;
        const step = row.campaign_steps as { step_order: number } | null;
        return {
            id: row.id as string,
            prospect_name: [prospect?.first_name, prospect?.last_name].filter(Boolean).join(" ") || "Unknown",
            prospect_email: prospect?.email ?? "",
            step_order: step?.step_order ?? 0,
            status: row.status as string,
            sent_at: row.sent_at as string | null,
            subject: (row.subject as string | null) ?? null,
            body: (row.body as string | null) ?? null,
        };
    });
}

export interface PipelineEntry {
    prospect_id: string;
    name: string;
    email: string;
    current_step: number;
    last_status: string;
    last_sent_at: string | null;
}

/**
 * Build the prospect pipeline — where each prospect stands in the campaign sequence.
 */
export async function getCampaignProspectPipeline(
    campaignId: string,
    totalSteps: number
): Promise<PipelineEntry[]> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return [];

    // 1. Get all assigned prospects
    const { data: cpRows } = await supabase
        .from("campaign_prospects")
        .select("prospect_id, prospects!inner( first_name, last_name, email )")
        .eq("campaign_id", campaignId);

    if (!cpRows?.length) return [];

    // 2. Get all email logs for this campaign
    const { data: logs } = await supabase
        .from("email_logs")
        .select("prospect_id, status, sent_at, campaign_steps!inner( step_order )")
        .eq("campaign_id", campaignId)
        .order("sent_at", { ascending: false, nullsFirst: false });

    // 3. Build a map: prospectId → latest log
    const logMap = new Map<string, { step_order: number; status: string; sent_at: string | null }>();
    for (const log of (logs ?? []) as Array<Record<string, unknown>>) {
        const pid = log.prospect_id as string;
        if (!logMap.has(pid)) {
            const step = log.campaign_steps as { step_order: number } | null;
            logMap.set(pid, {
                step_order: step?.step_order ?? 0,
                status: log.status as string,
                sent_at: log.sent_at as string | null,
            });
        }
    }

    // 4. Build pipeline entries
    return cpRows.map((row: Record<string, unknown>) => {
        const pid = row.prospect_id as string;
        const prospect = row.prospects as { first_name: string | null; last_name: string | null; email: string } | null;
        const latest = logMap.get(pid);

        return {
            prospect_id: pid,
            name: [prospect?.first_name, prospect?.last_name].filter(Boolean).join(" ") || "Unknown",
            email: prospect?.email ?? "",
            current_step: latest?.step_order ?? 0,
            last_status: latest?.status ?? "WAITING",
            last_sent_at: latest?.sent_at ?? null,
        };
    });
}

/**
 * Pause a campaign: set status to PAUSED and cancel all pending QStash messages.
 */
export async function pauseCampaign(
    campaignId: string
): Promise<{ error: string | null; cancelled: number }> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: "Not authenticated", cancelled: 0 };
    }

    // 1. Set status to PAUSED
    const { error: updateErr } = await supabase
        .from("campaigns")
        .update({ status: "PAUSED" })
        .eq("id", campaignId);

    if (updateErr) {
        return { error: updateErr.message, cancelled: 0 };
    }

    // 2. Find all pending QStash message IDs for this campaign
    const { data: logs } = await supabase
        .from("email_logs")
        .select("id, qstash_message_id")
        .eq("campaign_id", campaignId)
        .not("qstash_message_id", "is", null);

    if (!logs?.length) {
        return { error: null, cancelled: 0 };
    }

    // 3. Cancel each QStash message
    let cancelled = 0;
    for (const log of logs) {
        if (!log.qstash_message_id) continue;
        try {
            await qstash.messages.delete(log.qstash_message_id);
            cancelled++;
            // Clear the message ID since it's been cancelled
            await supabase
                .from("email_logs")
                .update({ qstash_message_id: null })
                .eq("id", log.id);
        } catch (err) {
            // Message may have already been delivered or expired — that's fine
            console.warn(`[pauseCampaign] Failed to cancel QStash message ${log.qstash_message_id}:`, err);
        }
    }

    console.log(`[pauseCampaign] Paused campaign ${campaignId}, cancelled ${cancelled} QStash messages`);
    return { error: null, cancelled };
}

/**
 * Mark a prospect as "replied" within a campaign.
 * Inserts a REPLIED email_log entry — the execute endpoint's reply-check guard
 * will then skip this prospect for all future steps.
 */
export async function markAsReplied(
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

    // Check if already marked as replied
    const { data: existing } = await supabase
        .from("email_logs")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("prospect_id", prospectId)
        .eq("status", "REPLIED")
        .limit(1)
        .maybeSingle();

    if (existing) {
        return { error: null }; // Already replied, no-op
    }

    // Get the first step ID (we just need a valid step reference)
    const { data: step } = await supabase
        .from("campaign_steps")
        .select("id")
        .eq("campaign_id", campaignId)
        .order("step_order", { ascending: true })
        .limit(1)
        .single();

    if (!step) {
        return { error: "No steps found in campaign" };
    }

    // Insert a REPLIED log entry
    const { error: insertErr } = await supabase
        .from("email_logs")
        .insert({
            campaign_id: campaignId,
            prospect_id: prospectId,
            step_id: step.id,
            status: "REPLIED",
            sent_at: new Date().toISOString(),
        });

    if (insertErr) {
        return { error: insertErr.message };
    }

    // Also cancel any pending QStash message for this prospect
    const { data: pendingLogs } = await supabase
        .from("email_logs")
        .select("id, qstash_message_id")
        .eq("campaign_id", campaignId)
        .eq("prospect_id", prospectId)
        .not("qstash_message_id", "is", null);

    for (const log of pendingLogs ?? []) {
        if (!log.qstash_message_id) continue;
        try {
            await qstash.messages.delete(log.qstash_message_id);
            await supabase
                .from("email_logs")
                .update({ qstash_message_id: null })
                .eq("id", log.id);
        } catch {
            // Already delivered or expired
        }
    }

    console.log(`[markAsReplied] Prospect ${prospectId} marked as replied in campaign ${campaignId}`);
    return { error: null };
}

/* ================================================================
   APPROVAL WORKFLOW
   ================================================================ */

export interface PendingApproval {
    id: string;
    campaign_id: string;
    prospect_id: string;
    step_id: string;
    subject: string;
    body: string;
    prospect: {
        first_name: string | null;
        last_name: string | null;
        email: string;
    };
    step: {
        step_order: number;
    };
}

/**
 * Fetch all drafted emails awaiting manual approval for a campaign.
 */
export async function getPendingApprovals(campaignId: string): Promise<{ data: PendingApproval[]; error: string | null }> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { data: [], error: "Not authenticated" };
    }

    const { data, error } = await supabase
        .from("email_logs")
        .select(`
            id, campaign_id, prospect_id, step_id, subject, body,
            prospect:prospects!inner(first_name, last_name, email),
            step:campaign_steps!inner(step_order)
        `)
        .eq("campaign_id", campaignId)
        .eq("status", "DRAFT")
        .order("id", { ascending: true });

    if (error) {
        return { data: [], error: error.message };
    }

    return { data: data as any as PendingApproval[], error: null };
}

/**
 * Reject a drafted email, preventing it from sending and stopping the sequence for this prospect.
 */
export async function rejectEmailTask(logId: string): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: "Not authenticated" };
    }

    const { error } = await supabase
        .from("email_logs")
        .update({ status: "REJECTED" })
        .eq("id", logId);

    if (error) {
        return { error: error.message };
    }

    return { error: null };
}

/**
 * Approve and send a drafted email. 
 * This calls `approveAndSendEmail` from campaign-engine, which emails the prospect and schedules the next step.
 */
export async function approveEmailTask(logId: string, subject: string, body: string): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: "Not authenticated" };
    }

    try {
        // We will implement approveAndSendEmail in campaign-engine.ts
        const { approveAndSendEmail } = await import("@/lib/campaign-engine");
        await approveAndSendEmail(logId, subject, body);
        return { error: null };
    } catch (err: any) {
        return { error: err.message || "Failed to approve and send email" };
    }
}
