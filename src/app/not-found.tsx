import Link from "next/link";

export default function NotFound() {
    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "1rem",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                textAlign: "center",
                padding: "2rem",
            }}
        >
            <h1 style={{ fontSize: "4rem", fontWeight: 800, letterSpacing: "-0.05em", opacity: 0.2 }}>
                404
            </h1>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Page not found</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9375rem" }}>
                The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            <Link
                href="/dashboard"
                style={{
                    marginTop: "0.5rem",
                    padding: "0.625rem 1.5rem",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    borderRadius: "10px",
                    textDecoration: "none",
                }}
            >
                Go to Dashboard
            </Link>
        </div>
    );
}
