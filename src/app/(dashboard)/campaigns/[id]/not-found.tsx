import Link from "next/link";

export default function CampaignNotFound() {
    return (
        <div className="error-boundary">
            <div className="error-icon">📋</div>
            <h1 className="error-title">Campaign not found</h1>
            <p className="error-message">
                This campaign may have been deleted or the link is incorrect.
            </p>
            <div className="error-actions">
                <Link href="/campaigns" className="error-btn primary">
                    View All Campaigns
                </Link>
                <Link href="/dashboard" className="error-btn secondary">
                    Go to Dashboard
                </Link>
            </div>
        </div>
    );
}
