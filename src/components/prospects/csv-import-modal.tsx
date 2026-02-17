"use client";

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import Papa from "papaparse";

/* ── Types ── */

export interface CsvRow {
    [key: string]: string;
}

export interface CsvParseResult {
    headers: string[];
    rows: CsvRow[];
    fileName: string;
    totalRows: number;
}

interface CsvImportModalProps {
    onClose: () => void;
    onParsed: (result: CsvParseResult) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PREVIEW_ROWS = 50;

/* ── Component ── */

export function CsvImportModal({ onClose, onParsed }: CsvImportModalProps) {
    const [dragActive, setDragActive] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<CsvParseResult | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    /* ── File handling ── */

    const processFile = useCallback((file: File) => {
        setError(null);

        // Validate file type
        if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
            setError("Please upload a .csv file.");
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            setError("File too large. Maximum size is 10 MB.");
            return;
        }

        setParsing(true);

        Papa.parse<CsvRow>(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim(),
            complete: (results) => {
                setParsing(false);

                if (results.errors.length > 0 && results.data.length === 0) {
                    setError(`CSV parse error: ${results.errors[0].message}`);
                    return;
                }

                const headers = results.meta.fields ?? [];
                if (headers.length === 0) {
                    setError("No headers found. Make sure your CSV has a header row.");
                    return;
                }

                const parsed: CsvParseResult = {
                    headers,
                    rows: results.data,
                    fileName: file.name,
                    totalRows: results.data.length,
                };

                setPreview(parsed);
            },
            error: (err) => {
                setParsing(false);
                setError(`Failed to parse CSV: ${err.message}`);
            },
        });
    }, []);

    /* ── Drag handlers ── */

    const onDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    }, []);

    const onDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    }, []);

    const onDrop = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) processFile(file);
        },
        [processFile]
    );

    const onFileChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
        },
        [processFile]
    );

    /* ── Render: Upload View ── */

    function renderUpload() {
        return (
            <>
                <div
                    className={`csv-dropzone ${dragActive ? "csv-dropzone-active" : ""}`}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => inputRef.current?.click()}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".csv,text/csv"
                        onChange={onFileChange}
                        style={{ display: "none" }}
                    />

                    <div className="csv-dropzone-icon">📄</div>
                    <div className="csv-dropzone-title">
                        Drag & drop your CSV here
                    </div>
                    <div className="csv-dropzone-desc">
                        or <span className="csv-dropzone-link">browse files</span>
                    </div>
                    <div className="csv-dropzone-hint">
                        .csv only · Max 10 MB
                    </div>
                </div>

                {parsing && (
                    <div className="csv-parsing">
                        <div className="spin" style={{ fontSize: "1.25rem" }}>⏳</div>
                        Parsing CSV…
                    </div>
                )}

                {error && (
                    <div className="form-error">⚠️ {error}</div>
                )}
            </>
        );
    }

    /* ── Render: Preview View ── */

    function renderPreview() {
        if (!preview) return null;

        const displayRows = preview.rows.slice(0, MAX_PREVIEW_ROWS);
        const truncated = preview.totalRows > MAX_PREVIEW_ROWS;

        return (
            <>
                <div className="csv-preview-info">
                    <span className="csv-file-badge">📄 {preview.fileName}</span>
                    <span className="csv-row-count">
                        {preview.totalRows.toLocaleString()} row{preview.totalRows !== 1 ? "s" : ""} · {preview.headers.length} column{preview.headers.length !== 1 ? "s" : ""}
                    </span>
                </div>

                <div className="csv-preview-table-wrap">
                    <table className="data-table csv-preview-table">
                        <thead>
                            <tr>
                                <th className="csv-row-num">#</th>
                                {preview.headers.map((h) => (
                                    <th key={h}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayRows.map((row, i) => (
                                <tr key={i}>
                                    <td className="csv-row-num">{i + 1}</td>
                                    {preview.headers.map((h) => (
                                        <td key={h}>{row[h] || "—"}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {truncated && (
                    <div className="csv-truncated-hint">
                        Showing first {MAX_PREVIEW_ROWS} of {preview.totalRows.toLocaleString()} rows
                    </div>
                )}

                <div className="modal-actions">
                    <button
                        className="btn-secondary"
                        onClick={() => {
                            setPreview(null);
                            setError(null);
                        }}
                    >
                        ← Pick Different File
                    </button>
                    <button
                        className="btn-primary"
                        onClick={() => onParsed(preview)}
                    >
                        Continue with {preview.totalRows.toLocaleString()} rows →
                    </button>
                </div>
            </>
        );
    }

    /* ── Main Render ── */

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className={`modal-card ${preview ? "csv-modal-wide" : ""}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="csv-modal-header">
                    <h2 className="modal-title">
                        {preview ? "Preview Import" : "Import CSV"}
                    </h2>
                    <button className="btn-icon" onClick={onClose}>✕</button>
                </div>

                {preview ? renderPreview() : renderUpload()}
            </div>
        </div>
    );
}
