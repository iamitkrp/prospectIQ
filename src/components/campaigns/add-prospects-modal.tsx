"use client";

import { useState, useEffect } from "react";
import type { Prospect } from "@/types/database";
import { getAvailableProspects, addProspectsToCampaign } from "@/app/campaigns/actions";

interface AddProspectsModalProps {
    campaignId: string;
    onClose: () => void;
    onAdded: (count: number) => void;
}

export function AddProspectsModal({ campaignId, onClose, onAdded }: AddProspectsModalProps) {
    const [prospects, setProspects] = useState<Prospect[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            const { data, error: err } = await getAvailableProspects(campaignId);
            if (err) setError(err);
            setProspects(data);
            setLoading(false);
        }
        load();
    }, [campaignId]);

    /* ── Filter by search ── */
    const filtered = prospects.filter((p) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            (p.first_name?.toLowerCase().includes(q)) ||
            (p.last_name?.toLowerCase().includes(q)) ||
            (p.email?.toLowerCase().includes(q)) ||
            (p.company_name?.toLowerCase().includes(q)) ||
            (p.role?.toLowerCase().includes(q))
        );
    });

    /* ── Toggle select ── */
    function toggleSelect(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleAll() {
        if (selected.size === filtered.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filtered.map((p) => p.id)));
        }
    }

    /* ── Submit ── */
    async function handleAdd() {
        setSubmitting(true);
        setError(null);

        const { count, error: err } = await addProspectsToCampaign(
            campaignId,
            Array.from(selected)
        );

        if (err) {
            setError(err);
            setSubmitting(false);
            return;
        }

        onAdded(count);
        onClose();
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card add-prospects-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Add Prospects to Campaign</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                {/* Search */}
                <div className="add-prospects-search">
                    <input
                        type="text"
                        placeholder="Search by name, email, company, role…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="campaign-create-input"
                        autoFocus
                    />
                </div>

                {error && <div className="alert-error" style={{ margin: "0.5rem 0" }}>{error}</div>}

                {/* Table */}
                <div className="add-prospects-table-wrap">
                    {loading ? (
                        <div className="add-prospects-loading">Loading prospects…</div>
                    ) : filtered.length === 0 ? (
                        <div className="add-prospects-empty">
                            {prospects.length === 0
                                ? "All prospects are already in this campaign."
                                : "No prospects match your search."}
                        </div>
                    ) : (
                        <table className="prospects-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "40px" }}>
                                        <input
                                            type="checkbox"
                                            checked={selected.size === filtered.length && filtered.length > 0}
                                            onChange={toggleAll}
                                        />
                                    </th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Company</th>
                                    <th>Role</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((p) => (
                                    <tr
                                        key={p.id}
                                        className={selected.has(p.id) ? "row-selected" : ""}
                                        onClick={() => toggleSelect(p.id)}
                                        style={{ cursor: "pointer" }}
                                    >
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selected.has(p.id)}
                                                onChange={() => toggleSelect(p.id)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td className="cell-name">
                                            {[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}
                                        </td>
                                        <td className="cell-email">{p.email}</td>
                                        <td>{p.company_name || "—"}</td>
                                        <td>{p.role || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="add-prospects-footer">
                    <span className="add-prospects-count">
                        {selected.size} selected
                    </span>
                    <div className="add-prospects-actions">
                        <button className="btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleAdd}
                            disabled={selected.size === 0 || submitting}
                        >
                            {submitting
                                ? "Adding…"
                                : `Add ${selected.size} Prospect${selected.size !== 1 ? "s" : ""}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
