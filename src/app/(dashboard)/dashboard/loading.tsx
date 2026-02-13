export default function DashboardLoading() {
    return (
        <div className="loading-container">
            {/* Page header skeleton */}
            <div className="page-header">
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-subtitle" />
            </div>

            {/* Stats grid skeleton */}
            <div className="stats-grid">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="stat-card">
                        <div className="skeleton skeleton-label" />
                        <div className="skeleton skeleton-value" />
                    </div>
                ))}
            </div>

            {/* Quick actions skeleton */}
            <div className="skeleton skeleton-section-title" style={{ marginBottom: "1rem" }} />
            <div className="quick-actions">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="stat-card" style={{ height: "72px" }} />
                ))}
            </div>
        </div>
    );
}
