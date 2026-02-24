"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SmtpForm({ initialSettings, saveSettings, disconnectSettings, verifyConnection }: {
    initialSettings: any,
    saveSettings: any,
    disconnectSettings: any,
    verifyConnection: any
}) {
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
            if (!email || !password) {
                throw new Error("Email and App Password are required.");
            }
            if (password.replace(/\s/g, '').length !== 16) {
                throw new Error("App Password must be exactly 16 characters.");
            }

            const cleanPassword = password.replace(/\s/g, ''); // Google sometimes adds spaces

            const res = await saveSettings({ email, password: cleanPassword });
            if (res.error) throw new Error(res.error);

            setSuccess("Successfully connected your Gmail account!");
            setPassword("");
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Failed to connect to SMTP server.");
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await disconnectSettings();
            if (res.error) throw new Error(res.error);
            setEmail("");
            setPassword("");
            setSuccess("Successfully disconnected your SMTP account.");
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Failed to disconnect.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleConnect} className="space-y-4">
            {isConnected ? (
                <div className="bg-green-50 text-green-800 p-4 rounded-xl border border-green-200">
                    <div className="flex items-center gap-2 mb-2 font-semibold">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Connected to Gmail
                    </div>
                    <p className="text-sm">You are currently sending emails as <strong>{initialSettings.smtp_email}</strong>.</p>
                </div>
            ) : null}

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 text-sm">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-50 text-green-600 p-3 rounded-xl border border-green-100 text-sm">
                    {success}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gmail Address</label>
                <input
                    type="email"
                    required
                    disabled={isConnected || loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g., you@domain.com"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
            </div>

            {!isConnected && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">16-Letter App Password</label>
                    <input
                        type="password"
                        required
                        disabled={loading}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="abcd efgh ijkl mnop"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>
            )}

            <div className="pt-2 flex items-center gap-3">
                {!isConnected ? (
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? (
                            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : null}
                        Save & Connect
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleDisconnect}
                        disabled={loading}
                        className="px-6 py-2 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                        Disconnect
                    </button>
                )}
            </div>
        </form>
    )
}
