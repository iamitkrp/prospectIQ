"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type PendingApproval, approveEmailTask, rejectEmailTask } from "@/app/campaigns/actions";

interface PendingApprovalsProps {
    initialApprovals: PendingApproval[];
}

export function PendingApprovals({ initialApprovals }: PendingApprovalsProps) {
    const router = useRouter();
    const [approvals, setApprovals] = useState(initialApprovals);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedDraft = approvals.find((a) => a.id === selectedId);

    function openReview(draft: PendingApproval) {
        setSelectedId(draft.id);
        setSubject(draft.subject);
        setBody(draft.body);
        setError(null);
    }

    function closeReview() {
        setSelectedId(null);
        setSubject("");
        setBody("");
        setError(null);
    }

    async function handleApprove() {
        if (!selectedId) return;
        setSubmitting(true);
        setError(null);

        const { error: err } = await approveEmailTask(selectedId, subject, body);
        if (err) {
            setError(err);
            setSubmitting(false);
            return;
        }

        // Successfully sent, remove from list
        setApprovals((prev) => prev.filter((a) => a.id !== selectedId));
        closeReview();
        setSubmitting(false);
        router.refresh(); // Refresh to update pipeline/activity stream
    }

    async function handleReject(id: string) {
        if (!window.confirm("Reject and cancel this email?")) return;

        const { error: err } = await rejectEmailTask(id);
        if (err) {
            alert("Failed to reject: " + err);
            return;
        }

        setApprovals((prev) => prev.filter((a) => a.id !== id));
        if (selectedId === id) closeReview();
        router.refresh();
    }

    if (approvals.length === 0) return null;

    return (
        <div className="campaign-widget">
            <div className="campaign-widget-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <h2 className="campaign-widget-title" style={{ color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span role="img" aria-label="alert">🔔</span>
                    Pending Approvals ({approvals.length})
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    These AI-generated emails are waiting for your review before they are sent.
                </p>
            </div>

            <div className="approvals-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {approvals.map(draft => (
                    <div key={draft.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {draft.prospect.first_name} {draft.prospect.last_name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({draft.prospect.email})</span>
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Step {draft.step.step_order} • Drafted {new Date(draft.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-secondary btn-sm" onClick={() => openReview(draft)}>
                                Review
                            </button>
                            <button className="btn-danger btn-sm" onClick={() => handleReject(draft.id)} title="Cancel this email">
                                Reject
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Review Modal */}
            {selectedDraft && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-content" style={{ background: 'var(--bg-layer-1)', width: '800px', maxWidth: '95vw', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        <div className="modal-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Review Email</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                                    To {selectedDraft.prospect.first_name} ({selectedDraft.prospect.email})
                                </p>
                            </div>
                            <button onClick={closeReview} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
                        </div>

                        <div className="modal-body" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {error && (
                                <div className="alert-error">{error}</div>
                            )}

                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Subject</label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-layer-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}
                                />
                            </div>

                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Body</label>
                                <textarea
                                    value={body}
                                    onChange={e => setBody(e.target.value)}
                                    style={{ width: '100%', minHeight: '300px', flex: 1, padding: '0.75rem', background: 'var(--bg-layer-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                                />
                            </div>
                        </div>

                        <div className="modal-footer" style={{ padding: '1.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button className="btn-secondary" onClick={closeReview} disabled={submitting}>
                                Cancel
                            </button>
                            <button className="btn-primary" onClick={handleApprove} disabled={submitting || !subject.trim() || !body.trim()}>
                                {submitting ? "Sending..." : "Approve & Send Now"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
