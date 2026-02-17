"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCampaigns, addProspectsToCampaign } from "@/app/campaigns/actions";
import type { Campaign } from "@/types/database";

interface AddToCampaignModalProps {
    prospectIds: string[];
    onClose: () => void;
    onDone: () => void;
}

/**
 * Modal to pick a campaign and bulk-add selected prospects.
 */
export function AddToCampaignModal({ prospectIds, onClose, onDone }: AddToCampaignModalProps) {
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Fetch campaigns on mount
    useEffect(() => {
        async function load() {
            const { data, error: err } = await getCampaigns();
            if (err) {
                setError(err);
            } else {
                setCampaigns(data);
                // Auto-select first DRAFT campaign
                const draft = data.find((c) => c.status === "DRAFT");
                if (draft) setSelectedCampaignId(draft.id);
            }
            setLoading(false);
        }
        load();
    }, []);

    async function handleAdd() {
        if (!selectedCampaignId) return;
        setSubmitting(true);
        setError(null);

        const { count, error: err } = await addProspectsToCampaign(
            selectedCampaignId,
            prospectIds
        );

        if (err) {
            setError(err);
            setSubmitting(false);
            return;
        }

        setSuccess(`Added ${count} prospect${count !== 1 ? "s" : ""} to campaign.`);
        setSubmitting(false);
        router.refresh();
        setTimeout(() => onDone(), 1200);
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="csv-modal-header">
                    <h2 className="modal-title">Add to Campaign</h2>
                    <button className="btn-icon" onClick={onClose}>✕</button>
                </div>

                <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                    {prospectIds.length} prospect{prospectIds.length !== 1 ? "s" : ""} selected
                </p>

                {loading ? (
                    <div className="csv-parsing">
                        <div className="spin" style={{ fontSize: "1.25rem" }}>⏳</div>
                        Loading campaigns…
                    </div>
                ) : campaigns.length === 0 ? (
                    <div className="form-error">
                        No campaigns found. Create a campaign first.
                    </div>
                ) : (
                    <div className="campaign-picker-list">
                        {campaigns.map((c) => (
                            <label
                                key={c.id}
                                className={`campaign-picker-item ${selectedCampaignId === c.id ? "selected" : ""}`}
                            >
                                <input
                                    type="radio"
                                    name="campaign"
                                    value={c.id}
                                    checked={selectedCampaignId === c.id}
                                    onChange={() => setSelectedCampaignId(c.id)}
                                />
                                <div className="campaign-picker-info">
                                    <span className="campaign-picker-name">{c.name}</span>
                                    <span className={`campaign-picker-status status-${c.status.toLowerCase()}`}>
                                        {c.status}
                                    </span>
                                </div>
                            </label>
                        ))}
                    </div>
                )}

                {error && <div className="form-error">⚠️ {error}</div>}
                {success && <div className="form-success">✅ {success}</div>}

                <div className="modal-actions">
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn-primary"
                        onClick={handleAdd}
                        disabled={!selectedCampaignId || submitting || !!success}
                    >
                        {submitting ? "Adding…" : `Add ${prospectIds.length} Prospect${prospectIds.length !== 1 ? "s" : ""}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
