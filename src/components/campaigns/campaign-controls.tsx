"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Campaign } from "@/types/database";
import { updateCampaignStatus, startCampaign, pauseCampaign } from "@/app/campaigns/actions";
import { AddProspectsModal } from "./add-prospects-modal";

interface CampaignControlsProps {
    campaign: Campaign;
    prospectCount: number;
    stepCount: number;
}

export function CampaignControls({ campaign, prospectCount: initialCount, stepCount }: CampaignControlsProps) {
    const router = useRouter();
    const [status, setStatus] = useState(campaign.status);
    const [updating, setUpdating] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [pCount, setPCount] = useState(initialCount);

    async function handleStatusChange(newStatus: Campaign["status"]) {
        setUpdating(true);
        const { error } = await updateCampaignStatus(campaign.id, newStatus);
        if (!error) {
            setStatus(newStatus);
        }
        setUpdating(false);
        router.refresh();
    }

    async function handleStartCampaign() {
        setUpdating(true);
        const { error, triggered } = await startCampaign(campaign.id);
        if (error) {
            alert(`Failed to start: ${error}`);
        } else {
            setStatus("ACTIVE");
            alert(`🚀 Campaign started! Step 1 triggered for ${triggered} prospect${triggered !== 1 ? "s" : ""}.`);
        }
        setUpdating(false);
        router.refresh();
    }

    async function handlePauseCampaign() {
        setUpdating(true);
        const { error, cancelled } = await pauseCampaign(campaign.id);
        if (error) {
            alert(`Failed to pause: ${error}`);
        } else {
            setStatus("PAUSED");
            alert(`⏸️ Campaign paused. ${cancelled} scheduled message${cancelled !== 1 ? "s" : ""} cancelled.`);
        }
        setUpdating(false);
        router.refresh();
    }

    const canActivate = status === "DRAFT" && stepCount > 0 && pCount > 0;
    const canPause = status === "ACTIVE";
    const canResume = status === "PAUSED";
    const canComplete = status === "ACTIVE" || status === "PAUSED";
    const isDraft = status === "DRAFT";

    return (
        <>
            <div className="campaign-controls">
                {/* Prospect count + Add button */}
                <div className="campaign-controls-left">
                    <span className="campaign-prospect-count">
                        👥 {pCount} prospect{pCount !== 1 ? "s" : ""}
                    </span>
                    {isDraft && (
                        <button
                            className="btn-secondary btn-sm"
                            onClick={() => setShowAddModal(true)}
                        >
                            + Add Prospects
                        </button>
                    )}
                </div>

                {/* Status controls */}
                <div className="campaign-controls-right">
                    {isDraft && (
                        <button
                            className={`btn-primary btn-sm ${!canActivate ? "btn-disabled-hint" : ""}`}
                            onClick={() => canActivate && handleStartCampaign()}
                            disabled={!canActivate || updating}
                            title={
                                !canActivate
                                    ? stepCount === 0
                                        ? "Add at least 1 step first"
                                        : pCount === 0
                                            ? "Add prospects first"
                                            : ""
                                    : "Launch this campaign"
                            }
                        >
                            {updating ? "Updating…" : "🚀 Start Campaign"}
                        </button>
                    )}

                    {canPause && (
                        <button
                            className="btn-warning btn-sm"
                            onClick={() => handlePauseCampaign()}
                            disabled={updating}
                        >
                            {updating ? "Updating…" : "⏸️ Pause"}
                        </button>
                    )}

                    {canResume && (
                        <button
                            className="btn-primary btn-sm"
                            onClick={() => handleStatusChange("ACTIVE")}
                            disabled={updating}
                        >
                            {updating ? "Updating…" : "▶️ Resume"}
                        </button>
                    )}

                    {canComplete && (
                        <button
                            className="btn-secondary btn-sm"
                            onClick={() => handleStatusChange("COMPLETED")}
                            disabled={updating}
                        >
                            {updating ? "Updating…" : "✅ Complete"}
                        </button>
                    )}
                </div>
            </div>

            {/* Add Prospects Modal */}
            {showAddModal && (
                <AddProspectsModal
                    campaignId={campaign.id}
                    onClose={() => setShowAddModal(false)}
                    onAdded={(count) => {
                        setPCount((prev) => prev + count);
                        router.refresh();
                    }}
                />
            )}
        </>
    );
}
