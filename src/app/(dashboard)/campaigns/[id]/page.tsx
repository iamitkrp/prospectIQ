import {
    getCampaignWithSteps,
    getCampaignProspectCount,
    getCampaignActivity,
    getCampaignProspectPipeline,
} from "@/app/campaigns/actions";
import { StepBuilder } from "@/components/campaigns/step-builder";
import { CampaignControls } from "@/components/campaigns/campaign-controls";
import { ActivityLog } from "@/components/campaigns/activity-log";
import { ProspectPipeline } from "@/components/campaigns/prospect-pipeline";
import Link from "next/link";
import { notFound } from "next/navigation";
import "../campaigns.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Campaign Detail — ProspectIQ",
    description: "View and edit your campaign sequence.",
};

interface CampaignDetailPageProps {
    params: Promise<{ id: string }>;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: string }> = {
    DRAFT: { label: "Draft", className: "badge-draft", icon: "📝" },
    ACTIVE: { label: "Active", className: "badge-active", icon: "🟢" },
    PAUSED: { label: "Paused", className: "badge-paused", icon: "⏸️" },
    COMPLETED: { label: "Completed", className: "badge-completed", icon: "✅" },
};

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
    const { id } = await params;
    const [{ campaign, steps, error }, prospectCount] = await Promise.all([
        getCampaignWithSteps(id),
        getCampaignProspectCount(id),
    ]);

    if (!campaign) {
        notFound();
    }

    if (error && error !== "Not authenticated") {
        throw new Error(error);
    }

    const config = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.DRAFT;
    const created = new Date(campaign.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });

    // Fetch monitoring data for non-DRAFT campaigns
    const isDraft = campaign.status === "DRAFT";
    const [activity, pipeline] = isDraft
        ? [[], []]
        : await Promise.all([
            getCampaignActivity(id),
            getCampaignProspectPipeline(id, steps.length),
        ]);

    return (
        <>
            {/* Breadcrumb */}
            <div className="detail-breadcrumb">
                <Link href="/campaigns" className="detail-breadcrumb-link">
                    ← Campaigns
                </Link>
            </div>

            {/* Campaign Header */}
            <div className="detail-header">
                <div className="detail-header-info">
                    <h1 className="page-title">{campaign.name}</h1>
                    <div className="detail-meta">
                        <span className={`campaign-badge ${config.className}`}>
                            {config.icon} {config.label}
                        </span>
                        <span className="detail-meta-date">Created {created}</span>
                    </div>
                </div>
            </div>

            {/* Controls: Add Prospects + Status Toggle */}
            <CampaignControls
                campaign={campaign}
                prospectCount={prospectCount}
                stepCount={steps.length}
            />

            {/* Monitoring — only for non-DRAFT campaigns */}
            {!isDraft && (
                <>
                    <ProspectPipeline entries={pipeline} totalSteps={steps.length} campaignId={id} />
                    <ActivityLog entries={activity} />
                </>
            )}

            {/* Step Builder */}
            <StepBuilder
                campaignId={campaign.id}
                initialSteps={steps}
                readOnly={campaign.status !== "DRAFT"}
            />
        </>
    );
}
