"use client";

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
                    <div key={e.id} className="activity-row">
                        <span className="activity-time">{formatTime(e.sent_at)}</span>
                        <span className={`activity-status ${STATUS_CLASS[e.status] ?? ""}`}>
                            {STATUS_ICON[e.status] ?? "•"} {e.status}
                        </span>
                        <span className="activity-step">Step {e.step_order}</span>
                        <span className="activity-prospect" title={e.prospect_email}>
                            {e.prospect_name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
