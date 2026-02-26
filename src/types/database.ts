/**
 * Prospect entity type — maps to the `prospects` Supabase table.
 * Schema defined in MASTER_PLAN.md §4.
 */
export interface Prospect {
    id: string;
    user_id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    linkedin_url: string | null;
    role: string | null;
    raw_data: Record<string, unknown>;
    created_at: string;
}

/**
 * Campaign entity type — maps to the `campaigns` Supabase table.
 */
export interface Campaign {
    id: string;
    user_id: string;
    name: string;
    status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
    require_approval: boolean;
    created_at: string;
}

/**
 * Campaign step — maps to the `campaign_steps` Supabase table.
 */
export interface CampaignStep {
    id: string;
    campaign_id: string;
    step_order: number;
    delay_days: number;
    prompt_template: string | null;
}

/**
 * Email log — maps to the `email_logs` Supabase table.
 * Tracks the state machine for each prospect×step combination.
 */
export interface EmailLog {
    id: string;
    campaign_id: string;
    prospect_id: string;
    step_id: string;
    status: "PENDING" | "QUEUED" | "SENT" | "FAILED" | "REPLIED" | "DRAFT" | "REJECTED";
    sent_at: string | null;
    qstash_message_id: string | null;
}

/**
 * Campaign-prospect junction — tracks which prospects are assigned to a campaign.
 */
export interface CampaignProspect {
    id: string;
    campaign_id: string;
    prospect_id: string;
    added_at: string;
}
