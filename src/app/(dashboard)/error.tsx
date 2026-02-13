"use client";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div style={{ maxWidth: "480px" }}>
            <div className="page-header">
                <h1 className="page-title">Something went wrong</h1>
                <p className="page-subtitle">
                    {error.message || "An unexpected error occurred while loading this page."}
                </p>
            </div>
            <button
                onClick={reset}
                style={{
                    padding: "0.625rem 1.5rem",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    border: "none",
                    borderRadius: "10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                }}
            >
                Try again
            </button>
        </div>
    );
}
