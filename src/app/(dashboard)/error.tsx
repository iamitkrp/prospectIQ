"use client";

import Link from "next/link";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="error-boundary">
            <div className="error-icon">⚠️</div>
            <h1 className="error-title">Something went wrong</h1>
            <p className="error-message">
                {error.message || "An unexpected error occurred while loading this page."}
            </p>
            {error.digest && (
                <p className="error-digest">Error ID: {error.digest}</p>
            )}
            <div className="error-actions">
                <button onClick={reset} className="error-btn primary">
                    Try Again
                </button>
                <Link href="/dashboard" className="error-btn secondary">
                    Go to Dashboard
                </Link>
            </div>
        </div>
    );
}
