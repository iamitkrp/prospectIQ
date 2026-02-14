"use client";

import { useState, useEffect } from "react";

/**
 * EmailQuotaBadge — shows daily send usage (X / 300) in the sidebar.
 * Fetches count on mount and re-fetches every 60 seconds.
 * Changes color at warning (250+) and danger (300) thresholds.
 */

export function EmailQuotaBadge() {
    const [sentToday, setSentToday] = useState<number | null>(null);
    const [limit, setLimit] = useState(300);

    useEffect(() => {
        let active = true;

        async function fetchCount() {
            try {
                const res = await fetch("/api/email/count");
                if (res.ok) {
                    const data = await res.json();
                    if (active) {
                        setSentToday(data.sentToday);
                        setLimit(data.limit);
                    }
                }
            } catch {
                /* silent — badge is non-critical */
            }
        }

        fetchCount();
        const interval = setInterval(fetchCount, 60_000); // poll every 60s

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    if (sentToday === null) return null; // loading

    const pct = Math.round((sentToday / limit) * 100);
    const isWarning = sentToday >= 250;
    const isDanger = sentToday >= limit;

    return (
        <div className={`quota-badge ${isDanger ? "danger" : isWarning ? "warning" : ""}`}>
            <div className="quota-header">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4l7 5 7-5" />
                    <rect x="1" y="3" width="14" height="10" rx="1.5" />
                </svg>
                <span className="quota-label">Emails Today</span>
            </div>
            <div className="quota-bar-track">
                <div
                    className="quota-bar-fill"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>
            <span className="quota-count">
                {sentToday} / {limit}
            </span>
        </div>
    );
}
