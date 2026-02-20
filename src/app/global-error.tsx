"use client";

import Link from "next/link";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="en">
            <body style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#0a0a0f",
                color: "#e5e5e5",
                fontFamily: "system-ui, -apple-system, sans-serif",
            }}>
                <div style={{
                    textAlign: "center",
                    padding: "2rem",
                    maxWidth: "480px",
                }}>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>💥</div>
                    <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                        Critical Error
                    </h1>
                    <p style={{ color: "#888", fontSize: "0.9375rem", marginBottom: "1.5rem" }}>
                        {error.message || "Something went seriously wrong. Please try refreshing."}
                    </p>
                    <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
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
                            }}
                        >
                            Try Again
                        </button>
                        <Link
                            href="/dashboard"
                            style={{
                                padding: "0.625rem 1.5rem",
                                background: "rgba(255,255,255,0.06)",
                                color: "#e5e5e5",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "10px",
                                textDecoration: "none",
                            }}
                        >
                            Go to Dashboard
                        </Link>
                    </div>
                </div>
            </body>
        </html>
    );
}
