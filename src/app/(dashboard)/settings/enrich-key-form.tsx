"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveEnrichKey, deleteEnrichKey } from "./actions";

interface EnrichKeyFormProps {
    hasKey: boolean;
    lastFour: string | null;
}

export function EnrichKeyForm({ hasKey, lastFour }: EnrichKeyFormProps) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    async function handleSave() {
        if (!apiKey.trim()) return;
        setSaving(true);
        setError(null);
        setSuccess(null);

        const result = await saveEnrichKey(apiKey.trim());
        if (result.error) {
            setError(result.error);
        } else {
            setSuccess("API key saved and encrypted.");
            setApiKey("");
            setShowForm(false);
            router.refresh();
        }
        setSaving(false);
    }

    async function handleDelete() {
        setDeleting(true);
        setError(null);
        setSuccess(null);

        const result = await deleteEnrichKey();
        if (result.error) {
            setError(result.error);
        } else {
            setSuccess("API key removed.");
            router.refresh();
        }
        setDeleting(false);
    }

    return (
        <div className="smtp-form">
            {/* Status */}
            {hasKey ? (
                <div className="smtp-status connected">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <div>
                        <span className="smtp-status-title">Connected</span>
                        <span className="smtp-status-email">Key ending in ••••{lastFour}</span>
                    </div>
                </div>
            ) : showForm ? null : (
                <div className="smtp-status" style={{
                    background: "rgba(148, 163, 184, 0.08)",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    color: "var(--text-muted)",
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>Not connected — LinkedIn enrichment is disabled</span>
                </div>
            )}

            {/* Error / Success messages */}
            {error && (
                <div className="smtp-status error">{error}</div>
            )}
            {success && (
                <div className="smtp-status success">{success}</div>
            )}

            {/* Input form */}
            {showForm && (
                <div className="smtp-field">
                    <label className="smtp-label">API Key</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <input
                            type={showKey ? "text" : "password"}
                            className="smtp-input"
                            placeholder="Paste your Enrich Layer API key"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            autoFocus
                        />
                        <button
                            type="button"
                            className="smtp-btn danger"
                            onClick={() => setShowKey(!showKey)}
                            title={showKey ? "Hide key" : "Show key"}
                            style={{ padding: "0.5rem 0.75rem", flexShrink: 0 }}
                        >
                            {showKey ? "🙈" : "👁"}
                        </button>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="smtp-actions" style={{ display: "flex", gap: "0.5rem" }}>
                {showForm ? (
                    <>
                        <button
                            className="smtp-btn primary"
                            onClick={handleSave}
                            disabled={saving || !apiKey.trim()}
                        >
                            {saving ? (
                                <>
                                    <svg className="smtp-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                    </svg>
                                    Encrypting…
                                </>
                            ) : (
                                "Save Key"
                            )}
                        </button>
                        <button
                            className="smtp-btn danger"
                            onClick={() => { setShowForm(false); setApiKey(""); setError(null); }}
                        >
                            Cancel
                        </button>
                    </>
                ) : hasKey ? (
                    <>
                        <button
                            className="smtp-btn primary"
                            onClick={() => setShowForm(true)}
                        >
                            Update Key
                        </button>
                        <button
                            className="smtp-btn danger"
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting ? "Removing…" : "Remove Key"}
                        </button>
                    </>
                ) : (
                    <button
                        className="smtp-btn primary"
                        onClick={() => setShowForm(true)}
                    >
                        Connect API Key
                    </button>
                )}
            </div>
        </div>
    );
}
