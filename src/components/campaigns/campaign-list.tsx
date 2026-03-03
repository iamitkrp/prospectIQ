"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createCampaign, deleteCampaign } from "@/app/campaigns/actions";
import type { CampaignWithStats } from "@/app/campaigns/actions";

/* ── Status config ── */

const STATUS_CONFIG: Record<
    CampaignWithStats["status"],
    { label: string; className: string; icon: string }
> = {
    DRAFT: { label: "Draft", className: "badge-draft", icon: "📝" },
    ACTIVE: { label: "Active", className: "badge-active", icon: "🟢" },
    PAUSED: { label: "Paused", className: "badge-paused", icon: "⏸️" },
    COMPLETED: { label: "Completed", className: "badge-completed", icon: "✅" },
};

/* ── Props ── */

interface CampaignListProps {
    campaigns: CampaignWithStats[];
}

export function CampaignList({ campaigns: initial }: CampaignListProps) {
    const router = useRouter();
    const [campaigns, setCampaigns] = useState(initial);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [requireApproval, setRequireApproval] = useState(false);
    const [creating, setCreating] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    /* ── Create ── */
    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);
        setError(null);

        const { data, error: err } = await createCampaign(newName.trim(), requireApproval);
        if (err) {
            setError(err);
            setCreating(false);
            return;
        }
        if (data) {
            const newCampaign: CampaignWithStats = {
                ...data,
                stats: { prospectCount: 0, sent: 0, replied: 0 },
            };
            setCampaigns([newCampaign, ...campaigns]);
        }
        setNewName("");
        setRequireApproval(false);
        setShowCreate(false);
        setCreating(false);
        router.refresh();
    }

    /* ── Delete ── */
    async function handleDelete(id: string) {
        const { error: err } = await deleteCampaign(id);
        if (err) {
            setError(err);
        } else {
            setCampaigns(campaigns.filter((c) => c.id !== id));
        }
        setDeletingId(null);
        router.refresh();
    }

    return (
        <div className="campaigns-container">
            {/* Header actions */}
            <div className="campaigns-actions">
                <button
                    className="btn-primary"
                    onClick={() => setShowCreate(!showCreate)}
                >
                    {showCreate ? "Cancel" : "+ New Campaign"}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="alert-error" style={{ marginBottom: "1rem" }}>
                    {error}
                </div>
            )}

            {/* Create Form */}
            {showCreate && (
                <form className="campaign-create-form" onSubmit={handleCreate}>
                    <input
                        type="text"
                        className="campaign-create-input"
                        placeholder="Campaign name, e.g. 'Q1 CTO Outreach'"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        autoFocus
                    />
                    <label className="campaign-create-checkbox">
                        <input
                            type="checkbox"
                            checked={requireApproval}
                            onChange={(e) => setRequireApproval(e.target.checked)}
                        />
                        Require manual approval before emails are sent
                    </label>
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={creating || !newName.trim()}
                    >
                        {creating ? "Creating…" : "Create"}
                    </button>
                </form>
            )}

            {/* Campaign Cards */}
            {campaigns.length === 0 ? (
                <div className="campaigns-empty">
                    <div className="campaigns-empty-icon">📋</div>
                    <h3>No campaigns yet</h3>
                    <p>Create your first campaign to start automated outreach sequences.</p>
                </div>
            ) : (
                <div className="campaigns-grid">
                    {campaigns.map((campaign) => {
                        const config = STATUS_CONFIG[campaign.status];
                        const created = new Date(campaign.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        });

                        return (
                            <div key={campaign.id} className="campaign-card">
                                <div className="campaign-card-header">
                                    <Link href={`/campaigns/${campaign.id}`} className="campaign-card-name">
                                        {campaign.name}
                                    </Link>
                                    <span className={`campaign-badge ${config.className}`}>
                                        {config.icon} {config.label}
                                    </span>
                                </div>

                                <div className="campaign-card-meta">
                                    <span className="campaign-card-date">Created {created}</span>
                                </div>

                                <div className="campaign-card-stats">
                                    <div className="campaign-stat-item">
                                        <div className="campaign-stat-value">{campaign.stats.prospectCount}</div>
                                        <div className="campaign-stat-label">Prospects</div>
                                    </div>
                                    <div className="campaign-stat-item">
                                        <div className="campaign-stat-value">{campaign.stats.sent}</div>
                                        <div className="campaign-stat-label">Sent</div>
                                    </div>
                                    <div className="campaign-stat-item">
                                        <div className="campaign-stat-value">{campaign.stats.replied}</div>
                                        <div className="campaign-stat-label">Replied</div>
                                    </div>
                                </div>

                                <div className="campaign-card-actions">
                                    <Link href={`/campaigns/${campaign.id}`} className="btn-secondary btn-sm">
                                        Open
                                    </Link>
                                    <button
                                        className="btn-danger btn-sm"
                                        onClick={() => setDeletingId(campaign.id)}
                                    >
                                        Delete
                                    </button>
                                </div>

                                {/* Delete confirm */}
                                {deletingId === campaign.id && (
                                    <div className="campaign-delete-confirm">
                                        <p>Delete &ldquo;{campaign.name}&rdquo;?</p>
                                        <div className="campaign-delete-actions">
                                            <button className="btn-danger btn-sm" onClick={() => handleDelete(campaign.id)}>
                                                Yes, Delete
                                            </button>
                                            <button className="btn-secondary btn-sm" onClick={() => setDeletingId(null)}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
