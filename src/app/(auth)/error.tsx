"use client";

export default function AuthError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="auth-card" style={{ textAlign: "center" }}>
            <div style={{ marginBottom: "1.5rem" }}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: "0 auto" }}>
                    <circle cx="24" cy="24" r="22" stroke="#ef4444" strokeWidth="2" opacity="0.3" />
                    <path d="M24 16v8M24 28v2" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
            </div>
            <h2 style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Something went wrong
            </h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem", marginBottom: "1.5rem", lineHeight: 1.5 }}>
                {error.message || "An unexpected error occurred. Please try again."}
            </p>
            <button onClick={reset} className="form-button" style={{ maxWidth: "200px", margin: "0 auto" }}>
                Try again
            </button>
        </div>
    );
}
