import Link from "next/link";
import { getUser } from "@/app/auth/actions";
import { getDashboardStats, getEmailActivity, getBrevoQuota } from "@/app/dashboard/actions";
import { EmailActivityChart } from "@/components/dashboard/email-activity-chart";
import { BrevoQuotaWidget } from "@/components/dashboard/brevo-quota-widget";
import type { Metadata } from "next";
import "./dashboard.css";

export const metadata: Metadata = {
    title: "Dashboard — ProspectIQ",
    description: "Your ProspectIQ outreach dashboard overview.",
};

export default async function DashboardPage() {
    const user = await getUser();
    const firstName = user?.email?.split("@")[0] ?? "there";

    const { data: stats } = await getDashboardStats();
    const { data: activity } = await getEmailActivity();
    const { data: quota } = await getBrevoQuota();

    const dailyLimit = parseInt(process.env.DAILY_SEND_LIMIT ?? "300", 10);
    const remaining = Math.max(0, dailyLimit - (stats?.emailsSentToday ?? 0));

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
                    <div className="stat-value">{stats?.totalProspects?.toLocaleString() ?? 0}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Active Campaigns</div>
                    <div className="stat-value">{stats?.activeCampaigns ?? 0}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Emails Sent Today</div>
                    <div className="stat-value">{stats?.emailsSentToday ?? 0}</div>
                    <div className="stat-change positive">↑ {remaining} remaining</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Reply Rate</div>
                    <div className="stat-value">
                        {stats?.replyRate !== null && stats?.replyRate !== undefined ? `${stats.replyRate}%` : "—"}
                    </div>
                </div>
            </div>

            {/* Campaign Analytics (4.3.2) */}
            {stats?.campaignAnalytics && stats.campaignAnalytics.length > 0 && (
                <>
                    <h2 className="section-title">Campaign Analytics</h2>
                    <div className="table-wrapper">
                        <table className="data-table campaign-analytics-table">
                            <thead>
                                <tr>
                                    <th>Campaign</th>
                                    <th>Status</th>
                                    <th>Prospects</th>
                                    <th>Sent</th>
                                    <th>Pending</th>
                                    <th>Failed</th>
                                    <th>Replied</th>
                                    <th>Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.campaignAnalytics.map((c) => {
                                    const total = c.sent + c.replied;
                                    const rate = total > 0 ? Math.round((c.replied / total) * 100) : null;
                                    return (
                                        <tr key={c.campaignId}>
                                            <td className="cell-name">
                                                <Link href={`/campaigns/${c.campaignId}`} className="analytics-link">
                                                    {c.campaignName}
                                                </Link>
                                            </td>
                                            <td>
                                                <span className={`status-badge status-${c.status.toLowerCase()}`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td className="num-cell">{c.prospectCount}</td>
                                            <td className="num-cell sent">{c.sent}</td>
                                            <td className="num-cell pending">{c.pending}</td>
                                            <td className="num-cell failed">{c.failed}</td>
                                            <td className="num-cell replied">{c.replied}</td>
                                            <td className="num-cell">
                                                {rate !== null ? `${rate}%` : "—"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
            {/* Email Activity Chart + Quota Widget (4.3.3 + 4.3.4) */}
            <div className="dashboard-widgets">
                <EmailActivityChart data={activity ?? []} />
                {quota && <BrevoQuotaWidget quota={quota} />}
            </div>

            {/* Quick Actions */}
            <h2 className="section-title">Quick Actions</h2>
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

                <Link href="/guide" className="quick-action-card">
                    <div className="quick-action-icon blue">
                        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2z" />
                            <path d="M7 7h6M7 10h6M7 13h4" />
                        </svg>
                    </div>
                    <div>
                        <div className="quick-action-title">Setup Guide</div>
                        <div className="quick-action-desc">Follow the step-by-step walkthrough</div>
                    </div>
                </Link>
            </div>
        </>
    );
}
