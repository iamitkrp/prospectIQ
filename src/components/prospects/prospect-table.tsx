"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createProspect, updateProspect, deleteProspect, bulkDeleteProspects } from "@/app/prospects/actions";
import { AddToCampaignModal } from "@/components/prospects/add-to-campaign-modal";
import type { Prospect } from "@/types";
import type { EnrichmentResult } from "@/lib/enrichment";
import type { GeneratedEmail } from "@/lib/prompts";

interface ProspectTableProps {
    prospects: Prospect[];
    currentPage: number;
    totalPages: number;
    totalCount: number;
    searchQuery?: string;
}

/** Highlight matched search terms by wrapping them in <mark> */
function highlightText(text: string, query?: string): React.ReactNode {
    if (!query || !text) return text;
    // Extract words from the query, ignoring quotes
    const words = query.replace(/["']/g, "").split(/\s+/).filter(Boolean);
    if (words.length === 0) return text;
    const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    const parts = text.split(pattern);
    return parts.map((part, i) =>
        pattern.test(part) ? <mark key={i} className="search-highlight">{part}</mark> : part
    );
}

export function ProspectTable({ prospects, currentPage, totalPages, totalCount, searchQuery }: ProspectTableProps) {
    const router = useRouter();
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [enrichingId, setEnrichingId] = useState<string | null>(null);
    const [detailProspect, setDetailProspect] = useState<Prospect | null>(null);
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [draftProspect, setDraftProspect] = useState<Prospect | null>(null);
    const [draftData, setDraftData] = useState<GeneratedEmail | null>(null);
    const [draftError, setDraftError] = useState<{ message: string; code: string; retryAfter?: number } | null>(null);
    const [retrying, setRetrying] = useState(false);
    // Multi-select
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    // Filters
    const searchParams = useSearchParams();

    function clearMessages() {
        setError(null);
        setSuccess(null);
    }

    async function handleCreate(formData: FormData) {
        clearMessages();
        setLoading(true);
        const result = await createProspect(formData);
        setLoading(false);
        if (result.error) {
            setError(result.error);
        } else {
            setSuccess(result.success ?? "Created!");
            setShowAddModal(false);
            router.refresh();
        }
    }

    async function handleUpdate(formData: FormData) {
        if (!editingProspect) return;
        clearMessages();
        setLoading(true);
        const result = await updateProspect(editingProspect.id, formData);
        setLoading(false);
        if (result.error) {
            setError(result.error);
        } else {
            setSuccess(result.success ?? "Updated!");
            setEditingProspect(null);
            router.refresh();
        }
    }

    async function handleDelete() {
        if (!deletingId) return;
        clearMessages();
        setLoading(true);
        const result = await deleteProspect(deletingId);
        setLoading(false);
        if (result.error) {
            setError(result.error);
        } else {
            setSuccess(result.success ?? "Deleted!");
            setDeletingId(null);
            router.refresh();
        }
    }

    async function handleBulkDelete() {
        if (selectedIds.size === 0) return;
        const count = selectedIds.size;
        if (!confirm(`Delete ${count} prospect${count !== 1 ? "s" : ""}? This cannot be undone.`)) return;
        clearMessages();
        setLoading(true);
        const result = await bulkDeleteProspects(Array.from(selectedIds));
        setLoading(false);
        if (result.error) {
            setError(result.error);
        } else {
            setSuccess(result.success ?? "Deleted!");
            setSelectedIds(new Set());
            router.refresh();
        }
    }

    async function handleEnrich(prospect: Prospect) {
        clearMessages();
        setEnrichingId(prospect.id);
        try {
            const res = await fetch("/api/prospects/enrich", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prospectId: prospect.id }),
            });
            const json = await res.json();
            if (!res.ok) {
                // Log full details to browser console for debugging
                console.error("[enrich] Error response:", json);
                const hint = json.details?.hint;
                const attemptedUrl = json.details?.attemptedUrl;
                let msg = json.error ?? "Enrichment failed";
                if (hint) msg += ` — ${hint}`;
                if (attemptedUrl) msg += ` (URL: ${attemptedUrl})`;
                setError(msg);
            } else {
                setSuccess("Research complete!");
                const enrichedProspect = {
                    ...prospect,
                    raw_data: {
                        ...(prospect.raw_data ?? {}),
                        enrichment: json.enrichment,
                        enrichedAt: new Date().toISOString(),
                    },
                };
                setDetailProspect(enrichedProspect);
                router.refresh();
            }
        } catch (err) {
            console.error("[enrich] Network error:", err);
            setError("Network error — could not reach the server.");
        } finally {
            setEnrichingId(null);
        }
    }

    async function handleGenerate(prospect: Prospect) {
        clearMessages();
        setGeneratingId(prospect.id);
        setDraftError(null);
        setDraftData(null);
        setRetrying(false);

        try {
            const res = await fetch("/api/ai/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prospectId: prospect.id }),
            });
            const json = await res.json();

            if (!res.ok) {
                const errCode = json.code ?? "SERVER_ERROR";

                // Auto-retry on rate limit
                if (errCode === "RATE_LIMITED" && json.retryAfter) {
                    setRetrying(true);
                    const waitMs = (json.retryAfter as number) * 1000;
                    await new Promise((r) => setTimeout(r, waitMs));
                    setRetrying(false);
                    // One more attempt
                    const retry = await fetch("/api/ai/generate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ prospectId: prospect.id }),
                    });
                    const retryJson = await retry.json();
                    if (retry.ok) {
                        setDraftData(retryJson.email as GeneratedEmail);
                        setDraftProspect(prospect);
                        setSuccess("Draft generated!");
                        return;
                    }
                    setDraftError({ message: retryJson.error, code: retryJson.code, retryAfter: retryJson.retryAfter });
                    setDraftProspect(prospect);
                    return;
                }

                setDraftError({ message: json.error, code: errCode, retryAfter: json.retryAfter });
                setDraftProspect(prospect);
                return;
            }

            setDraftData(json.email as GeneratedEmail);
            setDraftProspect(prospect);
            setSuccess("Draft generated!");
        } catch {
            setDraftError({ message: "Network error — could not reach the server.", code: "NETWORK" });
            setDraftProspect(prospect);
        } finally {
            setGeneratingId(null);
        }
    }

    // ── Selection helpers ──
    const allSelected = prospects.length > 0 && prospects.every((p) => selectedIds.has(p.id));
    function toggleAll() {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(prospects.map((p) => p.id)));
        }
    }
    function toggleOne(id: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    // ── Filter chips ──
    const uniqueRoles = useMemo(() => {
        const set = new Set<string>();
        prospects.forEach((p) => { if (p.role) set.add(p.role); });
        return Array.from(set).sort();
    }, [prospects]);

    const uniqueCompanies = useMemo(() => {
        const set = new Set<string>();
        prospects.forEach((p) => { if (p.company_name) set.add(p.company_name); });
        return Array.from(set).sort();
    }, [prospects]);

    const activeRole = searchParams.get("role") ?? "";
    const activeCompany = searchParams.get("company") ?? "";

    function setFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        params.set("page", "1");
        router.push(`/prospects?${params.toString()}`);
    }

    return (
        <>
            {/* Selection toolbar */}
            <div className="prospects-toolbar">
                {selectedIds.size > 0 ? (
                    <div className="selection-toolbar">
                        <span className="selection-count">
                            {selectedIds.size} selected
                        </span>
                        <button
                            className="btn-primary btn-sm"
                            onClick={() => setShowCampaignModal(true)}
                        >
                            Add to Campaign
                        </button>
                        <button
                            className="btn-danger btn-sm"
                            onClick={handleBulkDelete}
                            disabled={loading}
                        >
                            {loading ? "Deleting…" : "Delete"}
                        </button>
                        <button
                            className="btn-secondary btn-sm"
                            onClick={() => setSelectedIds(new Set())}
                        >
                            Clear
                        </button>
                    </div>
                ) : (
                    <button className="btn-primary" onClick={() => { clearMessages(); setShowAddModal(true); }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M8 3v10M3 8h10" />
                        </svg>
                        Add Prospect
                    </button>
                )}
            </div>

            {/* Filter chips */}
            {(uniqueRoles.length > 0 || uniqueCompanies.length > 0) && (
                <div className="filter-chips-bar">
                    {uniqueRoles.length > 0 && (
                        <div className="filter-chip-group">
                            <span className="filter-chip-label">Role:</span>
                            {uniqueRoles.slice(0, 8).map((r) => (
                                <button
                                    key={r}
                                    className={`filter-chip ${activeRole === r ? "active" : ""}`}
                                    onClick={() => setFilter("role", activeRole === r ? "" : r)}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    )}
                    {uniqueCompanies.length > 0 && (
                        <div className="filter-chip-group">
                            <span className="filter-chip-label">Company:</span>
                            {uniqueCompanies.slice(0, 8).map((c) => (
                                <button
                                    key={c}
                                    className={`filter-chip ${activeCompany === c ? "active" : ""}`}
                                    onClick={() => setFilter("company", activeCompany === c ? "" : c)}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    )}
                    {(activeRole || activeCompany) && (
                        <button
                            className="filter-chip-clear"
                            onClick={() => {
                                const params = new URLSearchParams(searchParams.toString());
                                params.delete("role");
                                params.delete("company");
                                params.set("page", "1");
                                router.push(`/prospects?${params.toString()}`);
                            }}
                        >
                            ✕ Clear filters
                        </button>
                    )}
                </div>
            )}

            {/* Toast messages */}
            {error && (
                <div className="form-error" style={{ marginBottom: "1rem" }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="form-success" style={{ marginBottom: "1rem" }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.22 5.97l-4 4a.75.75 0 01-1.06 0l-2-2a.75.75 0 111.06-1.06L6.69 9.4l3.47-3.47a.75.75 0 111.06 1.06z" />
                    </svg>
                    <span>{success}</span>
                </div>
            )}

            {/* Empty state */}
            {prospects.length === 0 && totalCount === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="20" cy="16" r="7" />
                            <path d="M6 40c0-7.7 6.3-14 14-14s14 6.3 14 14" />
                            <circle cx="36" cy="16" r="5" />
                            <path d="M42 40c0-5.5-3.6-10-8.5-11.5" />
                        </svg>
                    </div>
                    <h3 className="empty-state-title">No prospects yet</h3>
                    <p className="empty-state-desc">
                        Add your first prospect to start building your outreach pipeline.
                    </p>
                    <button className="btn-primary" onClick={() => { clearMessages(); setShowAddModal(true); }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M8 3v10M3 8h10" />
                        </svg>
                        Add Your First Prospect
                    </button>
                </div>
            ) : (
                <>
                    {/* Table */}
                    <div className="table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 36 }}>
                                        <input
                                            type="checkbox"
                                            className="row-checkbox"
                                            checked={allSelected}
                                            onChange={toggleAll}
                                            title="Select all"
                                        />
                                    </th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Company</th>
                                    <th>Role</th>
                                    <th style={{ width: "160px" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {prospects.map((p) => (
                                    <tr key={p.id} className={selectedIds.has(p.id) ? "row-selected" : ""}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                className="row-checkbox"
                                                checked={selectedIds.has(p.id)}
                                                onChange={() => toggleOne(p.id)}
                                            />
                                        </td>
                                        <td className="cell-name">
                                            {highlightText([p.first_name, p.last_name].filter(Boolean).join(" ") || "—", searchQuery)}
                                        </td>
                                        <td className="cell-email">{p.email}</td>
                                        <td>{highlightText(p.company_name || "—", searchQuery)}</td>
                                        <td>{highlightText(p.role || "—", searchQuery)}</td>
                                        <td>
                                            <div className="row-actions">
                                                <button
                                                    className={`btn-icon btn-icon-research ${enrichingId === p.id ? "researching" : ""}`}
                                                    title="Research"
                                                    onClick={() => handleEnrich(p)}
                                                    disabled={enrichingId === p.id}
                                                >
                                                    {enrichingId === p.id ? (
                                                        <svg width="16" height="16" viewBox="0 0 16 16" className="spin">
                                                            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
                                                        </svg>
                                                    ) : (
                                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="7" cy="7" r="5" />
                                                            <path d="M14 14l-3.5-3.5" />
                                                        </svg>
                                                    )}
                                                </button>
                                                <button
                                                    className="btn-icon"
                                                    title="View Detail"
                                                    onClick={() => { clearMessages(); setDetailProspect(p); }}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
                                                        <circle cx="8" cy="8" r="2" />
                                                    </svg>
                                                </button>
                                                <button
                                                    className={`btn-icon btn-icon-generate ${generatingId === p.id ? "generating" : ""}`}
                                                    title="Generate Draft"
                                                    onClick={() => handleGenerate(p)}
                                                    disabled={generatingId === p.id}
                                                >
                                                    {generatingId === p.id ? (
                                                        retrying ? (
                                                            <svg width="16" height="16" viewBox="0 0 16 16" className="spin">
                                                                <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
                                                            </svg>
                                                        ) : (
                                                            <svg width="16" height="16" viewBox="0 0 16 16" className="spin">
                                                                <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
                                                            </svg>
                                                        )
                                                    ) : (
                                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1z" />
                                                            <path d="M12 10l.75 1.75L14.5 12.5l-1.75.75L12 15l-.75-1.75-1.75-.75 1.75-.75L12 10z" />
                                                        </svg>
                                                    )}
                                                </button>
                                                <button
                                                    className="btn-icon"
                                                    title="Edit"
                                                    onClick={() => { clearMessages(); setEditingProspect(p); }}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M11.5 1.5l3 3L5 14H2v-3l9.5-9.5z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    className="btn-icon btn-icon-danger"
                                                    title="Delete"
                                                    onClick={() => { clearMessages(); setDeletingId(p.id); }}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M2 4h12M5.5 4V2.5a1 1 0 011-1h3a1 1 0 011 1V4M13 4v9a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 13V4" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Add to Campaign modal */}
                    {showCampaignModal && (
                        <AddToCampaignModal
                            prospectIds={Array.from(selectedIds)}
                            onClose={() => setShowCampaignModal(false)}
                            onDone={() => {
                                setShowCampaignModal(false);
                                setSelectedIds(new Set());
                            }}
                        />
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination">
                            <Link
                                href={`/prospects?page=${currentPage - 1}`}
                                className={`pagination-btn ${currentPage <= 1 ? "disabled" : ""}`}
                                aria-disabled={currentPage <= 1}
                            >
                                ← Previous
                            </Link>
                            <span className="pagination-info">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Link
                                href={`/prospects?page=${currentPage + 1}`}
                                className={`pagination-btn ${currentPage >= totalPages ? "disabled" : ""}`}
                                aria-disabled={currentPage >= totalPages}
                            >
                                Next →
                            </Link>
                        </div>
                    )}
                </>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <ProspectModal
                    title="Add Prospect"
                    submitLabel="Add Prospect"
                    onSubmit={handleCreate}
                    onClose={() => setShowAddModal(false)}
                    loading={loading}
                    error={error}
                />
            )}

            {/* Edit Modal */}
            {editingProspect && (
                <ProspectModal
                    title="Edit Prospect"
                    submitLabel="Save Changes"
                    onSubmit={handleUpdate}
                    onClose={() => setEditingProspect(null)}
                    loading={loading}
                    error={error}
                    defaults={editingProspect}
                />
            )}

            {/* Delete Confirm */}
            {deletingId && (
                <div className="modal-overlay" onClick={() => setDeletingId(null)}>
                    <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
                        <h2 className="modal-title">Delete Prospect</h2>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
                            Are you sure? This action cannot be undone.
                        </p>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setDeletingId(null)} disabled={loading}>
                                Cancel
                            </button>
                            <button className="btn-danger" onClick={handleDelete} disabled={loading}>
                                {loading ? "Deleting…" : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prospect Detail Drawer */}
            {detailProspect && (
                <ProspectDetailDrawer
                    prospect={detailProspect}
                    onClose={() => setDetailProspect(null)}
                    onEnrich={() => handleEnrich(detailProspect)}
                    enriching={enrichingId === detailProspect.id}
                />
            )}

            {/* Draft Preview Modal */}
            {draftProspect && (draftData || draftError) && (
                <DraftPreviewModal
                    prospect={draftProspect}
                    draft={draftData}
                    error={draftError}
                    onClose={() => { setDraftProspect(null); setDraftData(null); setDraftError(null); }}
                    onRegenerate={() => handleGenerate(draftProspect)}
                    generating={generatingId === draftProspect.id}
                    retrying={retrying}
                />
            )}
        </>
    );
}

/* ──────── Prospect Form Modal ──────── */

interface ProspectModalProps {
    title: string;
    submitLabel: string;
    onSubmit: (formData: FormData) => Promise<void>;
    onClose: () => void;
    loading: boolean;
    error: string | null;
    defaults?: Partial<Prospect>;
}

function ProspectModal({ title, submitLabel, onSubmit, onClose, loading, defaults }: ProspectModalProps) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <h2 className="modal-title">{title}</h2>
                <form action={onSubmit} className="modal-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="first_name" className="form-label">First Name</label>
                            <input id="first_name" name="first_name" type="text" className="form-input" placeholder="David" defaultValue={defaults?.first_name ?? ""} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="last_name" className="form-label">Last Name</label>
                            <input id="last_name" name="last_name" type="text" className="form-input" placeholder="Chen" defaultValue={defaults?.last_name ?? ""} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="modal_email" className="form-label">Email</label>
                        <input id="modal_email" name="email" type="email" className="form-input" placeholder="david@neopay.com" defaultValue={defaults?.email ?? ""} />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="company_name" className="form-label">Company</label>
                            <input id="company_name" name="company_name" type="text" className="form-input" placeholder="NeoPay" defaultValue={defaults?.company_name ?? ""} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="role" className="form-label">Role</label>
                            <input id="role" name="role" type="text" className="form-input" placeholder="CTO" defaultValue={defaults?.role ?? ""} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="linkedin_url" className="form-label">LinkedIn URL</label>
                        <input id="linkedin_url" name="linkedin_url" type="url" className="form-input" placeholder="https://linkedin.com/in/davidchen" defaultValue={defaults?.linkedin_url ?? ""} />
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>Either email or LinkedIn URL is required</span>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? "Saving…" : submitLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ──────── Prospect Detail Drawer ──────── */

interface ProspectDetailDrawerProps {
    prospect: Prospect;
    onClose: () => void;
    onEnrich: () => void;
    enriching: boolean;
}

function ProspectDetailDrawer({ prospect, onClose, onEnrich, enriching }: ProspectDetailDrawerProps) {
    const router = useRouter();
    const name = [prospect.first_name, prospect.last_name].filter(Boolean).join(" ") || "Unnamed";
    const rawData = prospect.raw_data as Record<string, unknown> | null;
    const enrichment = rawData?.enrichment as EnrichmentResult | undefined;
    const [notes, setNotes] = useState((rawData?.notes as string) ?? "");
    const [savingNotes, setSavingNotes] = useState(false);
    const [notesSaved, setNotesSaved] = useState(false);

    async function handleSaveNotes() {
        setSavingNotes(true);
        setNotesSaved(false);
        try {
            const res = await fetch("/api/prospects/notes", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prospectId: prospect.id, notes }),
            });
            if (res.ok) {
                setNotesSaved(true);
                router.refresh();
                setTimeout(() => setNotesSaved(false), 2000);
            }
        } catch { /* ignore */ } finally {
            setSavingNotes(false);
        }
    }

    return (
        <div className="drawer-overlay" onClick={onClose}>
            <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="drawer-header">
                    <div>
                        <h2 className="drawer-title">{name}</h2>
                        <p className="drawer-subtitle">{prospect.role ?? ""}{prospect.role && prospect.company_name ? " at " : ""}{prospect.company_name ?? ""}</p>
                    </div>
                    <button className="btn-icon" onClick={onClose} title="Close">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M5 5l10 10M15 5L5 15" />
                        </svg>
                    </button>
                </div>

                {/* Contact Info */}
                <div className="drawer-section">
                    <h3 className="drawer-section-label">Contact</h3>
                    <div className="drawer-field">
                        <span className="drawer-field-label">Email</span>
                        <a href={`mailto:${prospect.email}`} className="drawer-link">{prospect.email}</a>
                    </div>
                    {prospect.linkedin_url && (
                        <div className="drawer-field">
                            <span className="drawer-field-label">LinkedIn</span>
                            <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer" className="drawer-link">
                                {prospect.linkedin_url.replace(/https?:\/\/(www\.)?/, "").slice(0, 40)}
                            </a>
                        </div>
                    )}
                </div>

                {/* Enrichment Data */}
                {enrichment ? (
                    <>
                        <div className="drawer-section">
                            <h3 className="drawer-section-label">
                                🔍 Research Results
                                <span className="drawer-enriched-badge">Enriched</span>
                            </h3>

                            {enrichment.title && (
                                <div className="drawer-field">
                                    <span className="drawer-field-label">Page Title</span>
                                    <span>{enrichment.title}</span>
                                </div>
                            )}

                            {enrichment.description && (
                                <div className="drawer-field">
                                    <span className="drawer-field-label">Description</span>
                                    <p className="drawer-text">{enrichment.description}</p>
                                </div>
                            )}

                            {enrichment.detectedTech.length > 0 && (
                                <div className="drawer-field">
                                    <span className="drawer-field-label">Tech Stack</span>
                                    <div className="drawer-tags">
                                        {enrichment.detectedTech.map((t, i) => (
                                            <span key={i} className="drawer-tag">{t}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {Object.keys(enrichment.socialLinks).length > 0 && (
                                <div className="drawer-field">
                                    <span className="drawer-field-label">Social Links</span>
                                    <div className="drawer-tags">
                                        {Object.entries(enrichment.socialLinks).map(([name, url]) => (
                                            <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="drawer-tag drawer-tag-link">
                                                {name}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {enrichment.keyParagraphs.length > 0 && (
                            <div className="drawer-section">
                                <h3 className="drawer-section-label">Key Info</h3>
                                <div className="drawer-paragraphs">
                                    {enrichment.keyParagraphs.slice(0, 5).map((p, i) => (
                                        <p key={i} className="drawer-text">{p}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {enrichment.headings.length > 0 && (
                            <div className="drawer-section">
                                <h3 className="drawer-section-label">Page Structure</h3>
                                <ul className="drawer-headings">
                                    {enrichment.headings.slice(0, 10).map((h, i) => (
                                        <li key={i}>{h}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="drawer-section">
                            <p className="drawer-meta">
                                Scraped from <a href={enrichment.sourceUrl} target="_blank" rel="noopener noreferrer" className="drawer-link">{enrichment.sourceUrl}</a>
                                {" — "}{new Date(enrichment.scrapedAt).toLocaleDateString()}
                            </p>
                            <button className="btn-secondary" onClick={onEnrich} disabled={enriching} style={{ marginTop: "0.5rem" }}>
                                {enriching ? "Researching…" : "🔄 Re-Research"}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="drawer-section drawer-empty-research">
                        <div className="drawer-empty-icon">🔍</div>
                        <h3 className="drawer-empty-title">No research data yet</h3>
                        <p className="drawer-empty-desc">
                            Click below to scrape this prospect{"'"}s company website and gather context for AI emails.
                        </p>
                        <button className="btn-primary" onClick={onEnrich} disabled={enriching}>
                            {enriching ? "Researching…" : "🔍 Research This Prospect"}
                        </button>
                    </div>
                )}

                {/* Manual Notes */}
                <div className="drawer-section">
                    <h3 className="drawer-section-label">
                        📝 Your Notes
                        {notesSaved && <span className="drawer-enriched-badge" style={{ background: "rgba(34,197,94,0.12)", color: "#86efac" }}>Saved</span>}
                    </h3>
                    <textarea
                        className="drawer-notes"
                        placeholder="Paste your research, talking points, or context for the AI here..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={5}
                    />
                    <button
                        className="btn-secondary"
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        style={{ marginTop: "0.5rem", alignSelf: "flex-start" }}
                    >
                        {savingNotes ? "Saving…" : "💾 Save Notes"}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ──────── Draft Preview Modal ──────── */

interface DraftPreviewModalProps {
    prospect: Prospect;
    draft: GeneratedEmail | null;
    error: { message: string; code: string; retryAfter?: number } | null;
    onClose: () => void;
    onRegenerate: () => void;
    generating: boolean;
    retrying: boolean;
}

function DraftPreviewModal({
    prospect,
    draft,
    error,
    onClose,
    onRegenerate,
    generating,
    retrying,
}: DraftPreviewModalProps) {
    const name = [prospect.first_name, prospect.last_name].filter(Boolean).join(" ") || "Unnamed";
    const [editSubject, setEditSubject] = useState(draft?.subject ?? "");
    const [editBody, setEditBody] = useState(draft?.body ?? "");
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [sendToast, setSendToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);

    // Sync when draft changes (e.g. after regenerate)
    useEffect(() => {
        if (draft?.subject) setEditSubject(draft.subject);
        if (draft?.body) setEditBody(draft.body);
    }, [draft?.subject, draft?.body]);

    async function handleSend() {
        if (!editSubject.trim() || !editBody.trim()) {
            setSendToast({ message: "Subject and body cannot be empty.", type: "error" });
            return;
        }
        setSending(true);
        setSendToast(null);

        try {
            const res = await fetch("/api/email/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prospectId: prospect.id,
                    subject: editSubject,
                    body: editBody,
                }),
            });
            const json = await res.json();

            if (!res.ok) {
                const code = json.code ?? "SEND_FAILED";
                const toastMap: Record<string, { message: string; type: "error" | "warning" }> = {
                    DAILY_LIMIT: { message: "\u26d4 Daily email limit reached (300). Try again tomorrow.", type: "error" },
                    INVALID_EMAIL: { message: "\u274c Invalid recipient email address.", type: "error" },
                    API_DOWN: { message: "\u26a0\ufe0f Brevo is temporarily unavailable. Try later.", type: "warning" },
                };
                setSendToast(toastMap[code] ?? { message: json.error ?? "Send failed.", type: "error" });
                return;
            }

            const countMsg = json.warning ?? `${json.sentToday}/300 emails sent today.`;
            setSendToast({ message: `\u2705 Email sent! ${countMsg}`, type: "success" });
            setSent(true);
        } catch {
            setSendToast({ message: "Network error \u2014 could not reach the server.", type: "error" });
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card draft-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="draft-modal-header">
                    <div>
                        <h2 className="modal-title">✨ AI Draft</h2>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginTop: "0.125rem" }}>
                            For {name}{prospect.company_name ? ` at ${prospect.company_name}` : ""}
                        </p>
                    </div>
                    <button className="btn-icon" onClick={onClose} title="Close">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M5 5l10 10M15 5L5 15" />
                        </svg>
                    </button>
                </div>

                {/* Error State */}
                {error && (
                    <div className="draft-error-block">
                        <div className="draft-error-icon">
                            {error.code === "RATE_LIMITED" ? "⏳" : "⚠️"}
                        </div>
                        <div>
                            <p className="draft-error-title">
                                {error.code === "RATE_LIMITED" ? "AI is busy" :
                                    error.code === "TIMEOUT" ? "Request timed out" :
                                        "Generation failed"}
                            </p>
                            <p className="draft-error-msg">{error.message}</p>
                        </div>
                        <button
                            className="btn-primary"
                            onClick={onRegenerate}
                            disabled={generating}
                            style={{ marginTop: "0.75rem" }}
                        >
                            {generating
                                ? retrying ? "⏳ Retrying…" : "Generating…"
                                : "🔄 Try Again"}
                        </button>
                    </div>
                )}

                {/* Draft Content */}
                {draft && !error && (
                    <>
                        {/* Rationale */}
                        {draft.rationale && (
                            <div className="draft-rationale">
                                <span className="draft-rationale-label">🧠 AI Strategy:</span>{" "}
                                {draft.rationale}
                            </div>
                        )}

                        {/* Subject */}
                        <div className="draft-field">
                            <label className="draft-field-label">Subject</label>
                            <input
                                type="text"
                                className="draft-input"
                                value={editSubject}
                                onChange={(e) => setEditSubject(e.target.value)}
                            />
                        </div>

                        {/* Body */}
                        <div className="draft-field">
                            <label className="draft-field-label">Body</label>
                            <textarea
                                className="draft-textarea"
                                value={editBody}
                                onChange={(e) => setEditBody(e.target.value)}
                                rows={10}
                            />
                        </div>

                        {/* Actions */}
                        <div className="draft-actions">
                            <button
                                className="btn-secondary"
                                onClick={onRegenerate}
                                disabled={generating || sending}
                            >
                                {generating
                                    ? retrying ? "⏳ Retrying…" : "✨ Generating…"
                                    : "🔄 Regenerate"}
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleSend}
                                disabled={sending || sent || generating}
                            >
                                {sending ? "Sending…" : sent ? "✅ Sent" : "📧 Send Email"}
                            </button>
                        </div>

                        {/* Toast */}
                        {sendToast && (
                            <div className={`draft-toast draft-toast-${sendToast.type}`}>
                                {sendToast.message}
                            </div>
                        )}
                    </>
                )}

                {/* Generating state (modal opened while still generating) */}
                {generating && !draft && !error && (
                    <div className="draft-generating">
                        <svg width="32" height="32" viewBox="0 0 32 32" className="spin">
                            <circle cx="16" cy="16" r="12" fill="none" stroke="var(--brand-500)" strokeWidth="3" strokeDasharray="56" strokeDashoffset="16" strokeLinecap="round" />
                        </svg>
                        <p>{retrying ? "AI is busy — retrying…" : "Crafting your email…"}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
