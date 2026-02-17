"use client";

import { useState, useMemo } from "react";
import type { CsvParseResult } from "./csv-import-modal";
import {
    PROSPECT_FIELDS,
    autoDetectMapping,
    validateRows,
    type ColumnMapping,
    type ValidationResult,
    type ValidatedRow,
} from "./csv-validation";

interface ColumnMappingModalProps {
    parsed: CsvParseResult;
    onClose: () => void;
    /** Called with validated rows ready for import */
    onValidated: (rows: ValidatedRow[]) => void;
}

export function ColumnMappingModal({ parsed, onClose, onValidated }: ColumnMappingModalProps) {
    /* ── State ── */
    const [mapping, setMapping] = useState<ColumnMapping>(() =>
        autoDetectMapping(parsed.headers)
    );
    const [showErrors, setShowErrors] = useState(false);

    /* ── Run validation whenever mapping changes ── */
    const validation: ValidationResult = useMemo(
        () => validateRows(parsed.rows, mapping),
        [parsed.rows, mapping]
    );

    const { valid, errors, duplicateEmails } = validation;
    const hasRequiredMappings = !!mapping.email && !!mapping.first_name;

    /* ── Handlers ── */

    function updateMapping(fieldKey: string, csvHeader: string | null) {
        setMapping((prev) => ({ ...prev, [fieldKey]: csvHeader }));
    }

    function handleContinue() {
        if (valid.length === 0) {
            alert("No valid rows to import. Check your mapping and data.");
            return;
        }
        onValidated(valid);
    }

    /* ── Already-used headers (prevent double-mapping) ── */
    const usedHeaders = new Set(
        Object.values(mapping).filter((v): v is string => v !== null)
    );

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card mapping-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="csv-modal-header">
                    <div>
                        <h2 className="modal-title">Map Columns</h2>
                        <p className="mapping-subtitle">
                            Match your CSV columns to prospect fields
                        </p>
                    </div>
                    <button className="btn-icon" onClick={onClose}>✕</button>
                </div>

                {/* File info */}
                <div className="csv-preview-info">
                    <span className="csv-file-badge">📄 {parsed.fileName}</span>
                    <span className="csv-row-count">
                        {parsed.totalRows.toLocaleString()} rows · {parsed.headers.length} columns
                    </span>
                </div>

                {/* Mapping Table */}
                <div className="mapping-grid">
                    <div className="mapping-grid-header">
                        <span>Prospect Field</span>
                        <span>CSV Column</span>
                        <span>Sample Value</span>
                    </div>

                    {PROSPECT_FIELDS.map((field) => {
                        const selectedHeader = mapping[field.key];
                        const sampleValue = selectedHeader
                            ? parsed.rows[0]?.[selectedHeader] ?? "—"
                            : "—";

                        return (
                            <div key={field.key} className="mapping-row">
                                <div className="mapping-field">
                                    <span className="mapping-field-label">
                                        {field.label}
                                        {field.required && <span className="mapping-required">*</span>}
                                    </span>
                                    <span className="mapping-field-hint">{field.hint}</span>
                                </div>

                                <select
                                    className="mapping-select"
                                    value={selectedHeader ?? ""}
                                    onChange={(e) =>
                                        updateMapping(field.key, e.target.value || null)
                                    }
                                >
                                    <option value="">— Skip —</option>
                                    {parsed.headers.map((h) => (
                                        <option
                                            key={h}
                                            value={h}
                                            disabled={usedHeaders.has(h) && mapping[field.key] !== h}
                                        >
                                            {h}
                                            {usedHeaders.has(h) && mapping[field.key] !== h ? " (used)" : ""}
                                        </option>
                                    ))}
                                </select>

                                <div className="mapping-sample" title={sampleValue}>
                                    {sampleValue}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Validation Summary */}
                <div className="validation-summary">
                    <div className={`validation-stat ${valid.length > 0 ? "stat-good" : "stat-warn"}`}>
                        ✅ {valid.length.toLocaleString()} valid
                    </div>
                    {errors.length > 0 && (
                        <button
                            className="validation-stat stat-bad"
                            onClick={() => setShowErrors(!showErrors)}
                        >
                            ❌ {errors.length.toLocaleString()} error{errors.length !== 1 ? "s" : ""}
                            {duplicateEmails > 0 && ` (${duplicateEmails} duplicate${duplicateEmails !== 1 ? "s" : ""})`}
                            <span className="validation-toggle">{showErrors ? "▲" : "▼"}</span>
                        </button>
                    )}
                </div>

                {/* Error details */}
                {showErrors && errors.length > 0 && (
                    <div className="validation-errors">
                        <table className="data-table validation-errors-table">
                            <thead>
                                <tr>
                                    <th>Row</th>
                                    <th>Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {errors.slice(0, 25).map((e, i) => (
                                    <tr key={i}>
                                        <td className="csv-row-num">{e.rowIndex}</td>
                                        <td>{e.reason}</td>
                                    </tr>
                                ))}
                                {errors.length > 25 && (
                                    <tr>
                                        <td colSpan={2} className="csv-truncated-hint">
                                            …and {errors.length - 25} more errors
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Required fields warning */}
                {!hasRequiredMappings && (
                    <div className="form-error">
                        ⚠️ You must map <strong>Email</strong> and <strong>First Name</strong> to continue.
                    </div>
                )}

                {/* Actions */}
                <div className="modal-actions">
                    <button className="btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleContinue}
                        disabled={!hasRequiredMappings || valid.length === 0}
                    >
                        Import {valid.length.toLocaleString()} Prospect{valid.length !== 1 ? "s" : ""} →
                    </button>
                </div>
            </div>
        </div>
    );
}
