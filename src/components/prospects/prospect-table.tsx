"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createProspect, updateProspect, deleteProspect } from "@/app/prospects/actions";
import type { Prospect } from "@/types";

interface ProspectTableProps {
    prospects: Prospect[];
    currentPage: number;
    totalPages: number;
    totalCount: number;
}

export function ProspectTable({ prospects, currentPage, totalPages, totalCount }: ProspectTableProps) {
    const router = useRouter();
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

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

    return (
        <>
            {/* Toolbar */}
            <div className="prospects-toolbar">
                <button className="btn-primary" onClick={() => { clearMessages(); setShowAddModal(true); }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M8 3v10M3 8h10" />
                    </svg>
                    Add Prospect
                </button>
            </div>

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
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Company</th>
                                    <th>Role</th>
                                    <th style={{ width: "100px" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {prospects.map((p) => (
                                    <tr key={p.id}>
                                        <td className="cell-name">
                                            {[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}
                                        </td>
                                        <td className="cell-email">{p.email}</td>
                                        <td>{p.company_name || "—"}</td>
                                        <td>{p.role || "—"}</td>
                                        <td>
                                            <div className="row-actions">
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
                        <label htmlFor="modal_email" className="form-label">Email *</label>
                        <input id="modal_email" name="email" type="email" className="form-input" placeholder="david@neopay.com" required defaultValue={defaults?.email ?? ""} />
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
