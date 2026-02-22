"use client";

import { useState } from "react";
import type { ActivityEntry } from "@/app/campaigns/actions";

interface ActivityLogProps {
    entries: ActivityEntry[];
}

const STATUS_ICON: Record<string, string> = {
    SENT: "✅",
    FAILED: "❌",
    REPLIED: "💬",
    PENDING: "⏳",
    QUEUED: "📤",
};

const STATUS_CLASS: Record<string, string> = {
    SENT: "log-status-sent",
    FAILED: "log-status-failed",
    REPLIED: "log-status-replied",
    PENDING: "log-status-pending",
    QUEUED: "log-status-pending",
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

function ActivityRow({ entry }: { entry: ActivityEntry }) {
    const [expanded, setExpanded] = useState(false);
    const hasEmail = entry.subject || entry.body;

    return (
        <div className="activity-row-wrapper">
            <div
                className={`activity-row ${hasEmail ? "activity-row-clickable" : ""}`}
                onClick={() => hasEmail && setExpanded(!expanded)}
                role={hasEmail ? "button" : undefined}
                tabIndex={hasEmail ? 0 : undefined}
                onKeyDown={(e) => {
                    if (hasEmail && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        setExpanded(!expanded);
                    }
                }}
            >
                <span className="activity-time">{formatTime(entry.sent_at)}</span>
                <span className={`activity-status ${STATUS_CLASS[entry.status] ?? ""}`}>
                    {STATUS_ICON[entry.status] ?? "•"} {entry.status}
                </span>
                <span className="activity-step">Step {entry.step_order}</span>
                <span className="activity-prospect" title={entry.prospect_email}>
                    {entry.prospect_name}
                </span>
                {hasEmail && (
                    <span className="activity-expand-hint">
                        {expanded ? "▾" : "▸"} {expanded ? "Hide" : "View"} email
                    </span>
                )}
            </div>

            {expanded && hasEmail && (
                <div className="activity-email-preview">
                    {entry.subject && (
                        <div className="email-preview-subject">
                            <strong>Subject:</strong> {entry.subject}
                        </div>
                    )}
                    {entry.body && (
                        <div className="email-preview-body">
                            {entry.body}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function ActivityLog({ entries }: ActivityLogProps) {
    if (entries.length === 0) {
        return (
            <div className="activity-log">
                <h3 className="section-label">📡 Activity Log</h3>
                <div className="activity-empty">
                    No activity yet. Start the campaign to see events here.
                </div>
            </div>
        );
    }

    return (
        <div className="activity-log">
            <h3 className="section-label">📡 Activity Log</h3>
            <div className="activity-terminal">
                {entries.map((e) => (
                    <ActivityRow key={e.id} entry={e} />
                ))}
            </div>
        </div>
    );
}
