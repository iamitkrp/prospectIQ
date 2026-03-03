"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Campaign } from "@/types/database";
import { updateCampaignStatus, startCampaign, pauseCampaign, deleteCampaign } from "@/app/campaigns/actions";
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
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    function clearMessage() {
        setMessage(null);
    }

    async function handleStatusChange(newStatus: Campaign["status"]) {
        clearMessage();
        setUpdating(true);
        const { error } = await updateCampaignStatus(campaign.id, newStatus);
        if (error) {
            setMessage({ type: "error", text: `Failed to update status: ${error}` });
        } else {
            setStatus(newStatus);
            setMessage({ type: "success", text: `Campaign status changed to ${newStatus}.` });
        }
        setUpdating(false);
        router.refresh();
    }

    async function handleStartCampaign() {
        clearMessage();
        setUpdating(true);
        const { error, triggered } = await startCampaign(campaign.id);
        if (error) {
            setMessage({ type: "error", text: `Failed to start campaign: ${error}` });
        } else {
            setStatus("ACTIVE");
            if (triggered === 0) {
                setMessage({
                    type: "success",
                    text: "Campaign is ACTIVE. All prospects have already been emailed for Step 1 — follow-ups are scheduled automatically.",
                });
            } else {
                setMessage({
                    type: "success",
                    text: `🚀 Campaign started! Step 1 triggered for ${triggered} prospect${triggered !== 1 ? "s" : ""}. Check the Activity Log below for delivery status.`,
                });
            }
        }
        setUpdating(false);
        router.refresh();
    }

    async function handlePauseCampaign() {
        clearMessage();
        setUpdating(true);
        const { error, cancelled } = await pauseCampaign(campaign.id);
        if (error) {
            setMessage({ type: "error", text: `Failed to pause: ${error}` });
        } else {
            setStatus("PAUSED");
            setMessage({
                type: "success",
                text: `⏸️ Campaign paused. ${cancelled} scheduled message${cancelled !== 1 ? "s" : ""} cancelled.`,
            });
        }
        setUpdating(false);
        router.refresh();
    }

    async function handleDeleteCampaign() {
        if (!window.confirm(`Are you sure you want to delete "${campaign.name}"? All prospects, steps, and activity will be lost.`)) {
            return;
        }
        clearMessage();
        setUpdating(true);
        const { error } = await deleteCampaign(campaign.id);
        if (error) {
            setMessage({ type: "error", text: `Failed to delete campaign: ${error}` });
            setUpdating(false);
        } else {
            // Redirect back to campaigns list since this one is gone
            router.push("/campaigns");
        }
    }

    const canActivate = status === "DRAFT" && stepCount > 0 && pCount > 0;
    const canPause = status === "ACTIVE";
    const canResume = status === "PAUSED";
    const canComplete = status === "ACTIVE" || status === "PAUSED";
    const isDraft = status === "DRAFT";

    return (
        <>
            {/* Status message banner */}
            {message && (
                <div
                    className={`campaign-message ${message.type === "error" ? "campaign-message-error" : "campaign-message-success"}`}
                    onClick={clearMessage}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") clearMessage(); }}
                >
                    {message.text}
                    <span className="campaign-message-dismiss">✕</span>
                </div>
            )}

            <div className="campaign-controls">
                {/* Prospect count + Add button */}
                <div className="campaign-controls-left">
                    <span className="campaign-prospect-count">
                        👥 {pCount} prospect{pCount !== 1 ? "s" : ""}
                    </span>
                    <button
                        className="btn-secondary btn-sm"
                        onClick={() => setShowAddModal(true)}
                    >
                        + Add Prospects
                    </button>
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
                            {updating ? "Starting…" : "🚀 Start Campaign"}
                        </button>
                    )}

                    {canPause && (
                        <button
                            className="btn-warning btn-sm"
                            onClick={() => handlePauseCampaign()}
                            disabled={updating}
                        >
                            {updating ? "Pausing…" : "⏸️ Pause"}
                        </button>
                    )}

                    {canResume && (
                        <button
                            className="btn-primary btn-sm"
                            onClick={() => handleStatusChange("ACTIVE")}
                            disabled={updating}
                        >
                            {updating ? "Resuming…" : "▶️ Resume"}
                        </button>
                    )}

                    {canComplete && (
                        <button
                            className="btn-secondary btn-sm"
                            onClick={() => handleStatusChange("COMPLETED")}
                            disabled={updating}
                        >
                            {updating ? "Completing…" : "✅ Complete"}
                        </button>
                    )}

                    <button
                        className="btn-danger btn-sm"
                        onClick={handleDeleteCampaign}
                        disabled={updating}
                        title="Permanently delete this campaign"
                    >
                        🗑️ Delete
                    </button>
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
