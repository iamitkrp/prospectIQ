"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PipelineEntry } from "@/app/campaigns/actions";
import { markAsReplied } from "@/app/campaigns/actions";

interface ProspectPipelineProps {
    entries: PipelineEntry[];
    totalSteps: number;
    campaignId: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    SENT: { label: "Sent", className: "pipe-sent" },
    FAILED: { label: "Failed", className: "pipe-failed" },
    REPLIED: { label: "Replied", className: "pipe-replied" },
    WAITING: { label: "Waiting", className: "pipe-waiting" },
    PENDING: { label: "Pending", className: "pipe-waiting" },
    QUEUED: { label: "Queued", className: "pipe-waiting" },
};

function formatTime(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function ProspectPipeline({ entries, totalSteps, campaignId }: ProspectPipelineProps) {
    const router = useRouter();
    const [repliedIds, setRepliedIds] = useState<Set<string>>(new Set());
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

    async function handleMarkReplied(prospectId: string) {
        setLoadingId(prospectId);
        setMessage(null);
        const { error } = await markAsReplied(campaignId, prospectId);
        if (error) {
            setMessage({ type: "error", text: `Failed to mark as replied: ${error}` });
        } else {
            setRepliedIds((prev) => new Set(prev).add(prospectId));
            setMessage({ type: "success", text: "Marked as replied — their sequence is now stopped." });
        }
        setLoadingId(null);
        router.refresh();
    }

    if (entries.length === 0) {
        return (
            <div className="pipeline-section">
                <h3 className="section-label">🎯 Prospect Pipeline</h3>
                <div className="pipeline-empty">
                    No prospects assigned to this campaign.
                </div>
            </div>
        );
    }

    return (
        <div className="pipeline-section">
            <h3 className="section-label">🎯 Prospect Pipeline</h3>

            {message && (
                <div
                    className={`campaign-message ${message.type === "error" ? "campaign-message-error" : "campaign-message-success"}`}
                    onClick={() => setMessage(null)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") setMessage(null); }}
                >
                    {message.text}
                    <span className="campaign-message-dismiss">✕</span>
                </div>
            )}

            <div className="pipeline-table-wrap">
                <table className="prospects-table">
                    <thead>
                        <tr>
                            <th>Prospect</th>
                            <th>Email</th>
                            <th>Progress</th>
                            <th>Status</th>
                            <th>Last Activity</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((e) => {
                            const isReplied = e.last_status === "REPLIED" || repliedIds.has(e.prospect_id);
                            const config = isReplied
                                ? STATUS_CONFIG.REPLIED
                                : (STATUS_CONFIG[e.last_status] ?? STATUS_CONFIG.WAITING);
                            const progressPct = totalSteps > 0 ? (e.current_step / totalSteps) * 100 : 0;

                            return (
                                <tr key={e.prospect_id}>
                                    <td className="pipeline-name">{e.name}</td>
                                    <td className="pipeline-email">{e.email}</td>
                                    <td>
                                        <div className="pipeline-progress">
                                            <div className="pipeline-bar">
                                                <div
                                                    className={`pipeline-bar-fill ${config.className}`}
                                                    style={{ width: `${progressPct}%` }}
                                                />
                                            </div>
                                            <span className="pipeline-step-label">
                                                {e.current_step}/{totalSteps}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`pipeline-badge ${config.className}`}>
                                            {isReplied ? "Replied" : config.label}
                                        </span>
                                    </td>
                                    <td className="pipeline-time">
                                        {formatTime(e.last_sent_at)}
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                        {!isReplied && (
                                            <button
                                                className="btn-ghost btn-xs"
                                                onClick={() => handleMarkReplied(e.prospect_id)}
                                                disabled={loadingId === e.prospect_id}
                                                title="Mark this prospect as replied — stops their sequence"
                                            >
                                                {loadingId === e.prospect_id ? "…" : "💬 Replied"}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

