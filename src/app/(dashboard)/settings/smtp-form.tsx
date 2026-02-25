"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSmtpSettings, disconnectSmtpSettings } from "./actions";

export function SmtpForm({ initialSettings }: { initialSettings: any }) {
    const [email, setEmail] = useState(initialSettings?.smtp_email || "");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const isConnected = initialSettings?.is_smtp_verified;
    const router = useRouter();

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            if (!email || !password) throw new Error("Email and App Password are required.");
            if (password.replace(/\s/g, "").length !== 16)
                throw new Error("App Password must be exactly 16 characters.");

            const cleanPassword = password.replace(/\s/g, "");
            const res = await saveSmtpSettings({ email, password: cleanPassword });
            if (res.error) throw new Error(res.error);

            setSuccess("Gmail connected successfully!");
            setPassword("");
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Failed to connect.");
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await disconnectSmtpSettings();
            if (res.error) throw new Error(res.error);
            setEmail("");
            setPassword("");
            setSuccess("Disconnected successfully.");
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Failed to disconnect.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleConnect} className="smtp-form">
            {/* Status Banner */}
            {isConnected && (
                <div className="smtp-status connected">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <div>
                        <span className="smtp-status-title">Connected</span>
                        <span className="smtp-status-email">{initialSettings.smtp_email}</span>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="smtp-status error">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                        <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <span>{error}</span>
                </div>
            )}

            {/* Success */}
            {success && (
                <div className="smtp-status success">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <span>{success}</span>
                </div>
            )}

            {/* Fields */}
            <div className="smtp-field">
                <label className="smtp-label">Gmail Address</label>
                <input
                    type="email"
                    required
                    disabled={isConnected || loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="smtp-input"
                />
            </div>

            {!isConnected && (
                <div className="smtp-field">
                    <label className="smtp-label">16-Letter App Password</label>
                    <input
                        type="password"
                        required
                        disabled={loading}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="abcd efgh ijkl mnop"
                        className="smtp-input"
                    />
                </div>
            )}

            {/* Actions */}
            <div className="smtp-actions">
                {!isConnected ? (
                    <button type="submit" disabled={loading} className="smtp-btn primary">
                        {loading && (
                            <svg className="smtp-spinner" width="16" height="16" viewBox="0 0 24 24">
                                <circle
                                    cx="12" cy="12" r="10"
                                    stroke="currentColor" strokeWidth="3" fill="none"
                                    strokeDasharray="31.4" strokeDashoffset="10"
                                />
                            </svg>
                        )}
                        Save &amp; Connect
                    </button>
                ) : (
                    <button type="button" onClick={handleDisconnect} disabled={loading} className="smtp-btn danger">
                        Disconnect
                    </button>
                )}
            </div>
        </form>
    );
}
