export default function AuthLoading() {
    return (
        <div className="auth-card" style={{ textAlign: "center", padding: "3rem 2.5rem" }}>
            <div className="loading-pulse">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <rect width="32" height="32" rx="8" fill="url(#loading-grad)" />
                    <path d="M10 16L14 20L22 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <defs>
                        <linearGradient id="loading-grad" x1="0" y1="0" x2="32" y2="32">
                            <stop stopColor="#6366f1" />
                            <stop offset="1" stopColor="#8b5cf6" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.875rem", marginTop: "1rem" }}>
                Loading…
            </p>
        </div>
    );
}
