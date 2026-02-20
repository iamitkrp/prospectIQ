import type { BrevoQuota } from "@/app/dashboard/actions";

interface BrevoQuotaWidgetProps {
    quota: BrevoQuota;
}

/**
 * Shows daily and monthly Brevo email quota usage with progress bars.
 */
export function BrevoQuotaWidget({ quota }: BrevoQuotaWidgetProps) {
    const dailyPct = Math.min(100, Math.round((quota.dailyUsed / quota.dailyLimit) * 100));
    const monthlyPct = Math.min(100, Math.round((quota.monthlyUsed / quota.monthlyLimit) * 100));

    return (
        <div className="quota-card">
            <h3 className="chart-title">Brevo Email Quota</h3>

            <div className="quota-row">
                <div className="quota-header">
                    <span className="quota-label">Daily</span>
                    <span className="quota-numbers">
                        {quota.dailyUsed} / {quota.dailyLimit}
                    </span>
                </div>
                <div className="quota-bar-track">
                    <div
                        className={`quota-bar-fill ${dailyPct > 80 ? "warning" : ""} ${dailyPct >= 100 ? "danger" : ""}`}
                        style={{ width: `${dailyPct}%` }}
                    />
                </div>
                <div className="quota-remaining">
                    {quota.dailyRemaining} remaining
                </div>
            </div>

            <div className="quota-row">
                <div className="quota-header">
                    <span className="quota-label">Monthly</span>
                    <span className="quota-numbers">
                        {quota.monthlyUsed.toLocaleString()} / {quota.monthlyLimit.toLocaleString()}
                    </span>
                </div>
                <div className="quota-bar-track">
                    <div
                        className={`quota-bar-fill monthly ${monthlyPct > 80 ? "warning" : ""} ${monthlyPct >= 100 ? "danger" : ""}`}
                        style={{ width: `${monthlyPct}%` }}
                    />
                </div>
                <div className="quota-remaining">
                    {quota.monthlyRemaining.toLocaleString()} remaining
                </div>
            </div>
        </div>
    );
}
