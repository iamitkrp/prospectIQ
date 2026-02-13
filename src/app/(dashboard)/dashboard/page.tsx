import Link from "next/link";
import { getUser } from "@/app/auth/actions";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Dashboard — ProspectIQ",
    description: "Your ProspectIQ outreach dashboard overview.",
};

export default async function DashboardPage() {
    const user = await getUser();

    const firstName = user?.email?.split("@")[0] ?? "there";

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Welcome back, {firstName} 👋</h1>
                <p className="page-subtitle">
                    Here&apos;s an overview of your outreach pipeline.
                </p>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Total Prospects</div>
                    <div className="stat-value">0</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Active Campaigns</div>
                    <div className="stat-value">0</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Emails Sent Today</div>
                    <div className="stat-value">0</div>
                    <div className="stat-change positive">↑ 300 remaining</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Reply Rate</div>
                    <div className="stat-value">—</div>
                </div>
            </div>

            {/* Quick Actions */}
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem", color: "var(--text-primary)" }}>
                Quick Actions
            </h2>
            <div className="quick-actions">
                <Link href="/prospects" className="quick-action-card">
                    <div className="quick-action-icon purple">
                        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="7" cy="6" r="3" />
                            <path d="M1 17c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                            <path d="M15 6v6M12 9h6" />
                        </svg>
                    </div>
                    <div>
                        <div className="quick-action-title">Add Prospects</div>
                        <div className="quick-action-desc">Import or add contacts manually</div>
                    </div>
                </Link>

                <Link href="/campaigns/new" className="quick-action-card">
                    <div className="quick-action-icon green">
                        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 4h16M2 4v12a2 2 0 002 2h12a2 2 0 002-2V4" />
                            <path d="M6 1v3M14 1v3" />
                            <path d="M10 9v4M8 11h4" />
                        </svg>
                    </div>
                    <div>
                        <div className="quick-action-title">Start Campaign</div>
                        <div className="quick-action-desc">Create an automated email sequence</div>
                    </div>
                </Link>

                <Link href="/prospects/import" className="quick-action-card">
                    <div className="quick-action-icon blue">
                        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2z" />
                            <path d="M10 7v6M7 10h6" />
                        </svg>
                    </div>
                    <div>
                        <div className="quick-action-title">Import CSV</div>
                        <div className="quick-action-desc">Bulk import prospects from a file</div>
                    </div>
                </Link>
            </div>
        </>
    );
}
