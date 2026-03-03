"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ImportCsvButton } from "@/components/prospects/import-csv-button";
import type { CsvParseResult } from "@/components/prospects/csv-import-modal";
import { ColumnMappingModal } from "@/components/prospects/column-mapping-modal";
import type { ValidatedRow } from "@/components/prospects/csv-validation";

/* ── Constants ── */

const CHUNK_SIZE = 200;

const SAMPLE_CSV = [
    "email,first_name,last_name,company_name,role,linkedin_url",
    "john.doe@acme.com,John,Doe,Acme Corp,CTO,https://linkedin.com/in/johndoe",
    "jane.smith@globex.io,Jane,Smith,Globex Inc,VP Engineering,https://linkedin.com/in/janesmith",
    "bob.wilson@startup.co,Bob,Wilson,Startup Co,Head of Product,",
].join("\n");

/* ── Types ── */

interface ProspectsHeaderProps {
    count: number;
}

type ImportStage =
    | { step: "idle" }
    | { step: "parsed"; data: CsvParseResult }
    | { step: "mapped"; rows: ValidatedRow[]; fileName: string }
    | { step: "importing"; fileName: string; total: number; imported: number; errors: string[] }
    | { step: "done"; fileName: string; imported: number; errors: string[] };

/**
 * Client component for the prospects page header.
 * Manages the full CSV import flow: parse → map → validate → import → done.
 */
export function ProspectsHeader({ count }: ProspectsHeaderProps) {
    const [stage, setStage] = useState<ImportStage>({ step: "idle" });
    const abortRef = useRef(false);
    const router = useRouter();

    const handleParsed = useCallback((result: CsvParseResult) => {
        setStage({ step: "parsed", data: result });
    }, []);

    const handleValidated = useCallback((rows: ValidatedRow[], fileName: string) => {
        setStage({ step: "mapped", rows, fileName });
    }, []);

    /* ── Chunked import ── */

    const startImport = useCallback(async (rows: ValidatedRow[], fileName: string) => {
        abortRef.current = false;
        const total = rows.length;
        let imported = 0;
        const errors: string[] = [];

        setStage({ step: "importing", fileName, total, imported: 0, errors: [] });

        // Split into chunks
        for (let i = 0; i < total; i += CHUNK_SIZE) {
            if (abortRef.current) {
                errors.push("Import cancelled by user.");
                break;
            }

            const chunk = rows.slice(i, i + CHUNK_SIZE);

            try {
                const res = await fetch("/api/prospects/import", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prospects: chunk }),
                });

                const data = await res.json();

                if (!res.ok) {
                    errors.push(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${data.error || "Unknown error"}`);
                } else {
                    imported += data.imported ?? 0;
                    if (data.errors?.length) {
                        errors.push(...data.errors);
                    }
                }
            } catch {
                errors.push(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1}: Network error`);
            }

            // Update progress after each chunk
            setStage((prev) =>
                prev.step === "importing"
                    ? { ...prev, imported, errors: [...errors] }
                    : prev
            );
        }

        setStage({ step: "done", fileName, imported, errors });
        router.refresh(); // Refresh server data to show new prospects
    }, [router]);

    /* ── Sample CSV download ── */

    const downloadSample = useCallback(() => {
        const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "prospectiq-sample.csv";
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    /* ── Render helpers ── */

    function renderImporting() {
        if (stage.step !== "importing") return null;
        const percent = stage.total > 0 ? Math.round((stage.imported / stage.total) * 100) : 0;

        return (
            <div className="csv-import-banner csv-importing-banner">
                <div className="csv-import-banner-left" style={{ flex: 1 }}>
                    <span className="csv-file-badge">📄 {stage.fileName}</span>
                    <span>Importing… {stage.imported.toLocaleString()} / {stage.total.toLocaleString()}</span>
                </div>
                <div className="import-progress-bar">
                    <div
                        className="import-progress-fill"
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <span className="import-progress-pct">{percent}%</span>
                <button
                    className="btn-secondary btn-sm"
                    onClick={() => { abortRef.current = true; }}
                >
                    Cancel
                </button>
            </div>
        );
    }

    function renderDone() {
        if (stage.step !== "done") return null;

        return (
            <div className="csv-import-banner csv-done-banner">
                <div className="csv-import-banner-left">
                    <span className="csv-file-badge">📄 {stage.fileName}</span>
                    <span>
                        ✅ {stage.imported.toLocaleString()} prospect{stage.imported !== 1 ? "s" : ""} imported
                        {stage.errors.length > 0 && (
                            <> · <span className="import-error-count">❌ {stage.errors.length} error{stage.errors.length !== 1 ? "s" : ""}</span></>
                        )}
                    </span>
                </div>
                <div className="csv-import-banner-actions">
                    {stage.errors.length > 0 && (
                        <details className="import-errors-details">
                            <summary className="btn-secondary btn-sm">View Errors</summary>
                            <ul className="import-errors-list">
                                {stage.errors.map((e, i) => (
                                    <li key={i}>{e}</li>
                                ))}
                            </ul>
                        </details>
                    )}
                    <button
                        className="btn-primary btn-sm"
                        onClick={() => setStage({ step: "idle" })}
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1 className="page-title">Prospects</h1>
                    <p className="page-subtitle">{count} contact{count !== 1 ? "s" : ""} in your database</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <button
                        className="btn-secondary btn-sm"
                        onClick={downloadSample}
                        title="Download a sample CSV template"
                    >
                        📥 Sample CSV
                    </button>
                    <ImportCsvButton onParsed={handleParsed} />
                </div>
            </div>

            {/* Column Mapping Modal */}
            {stage.step === "parsed" && (
                <ColumnMappingModal
                    parsed={stage.data}
                    onClose={() => setStage({ step: "idle" })}
                    onValidated={(rows) => handleValidated(rows, stage.data.fileName)}
                />
            )}

            {/* Post-validation banner — ready for import */}
            {stage.step === "mapped" && (
                <div className="csv-import-banner">
                    <div className="csv-import-banner-left">
                        <span className="csv-file-badge">📄 {stage.fileName}</span>
                        <span>
                            ✅ {stage.rows.length.toLocaleString()} prospect{stage.rows.length !== 1 ? "s" : ""} validated & ready
                        </span>
                    </div>
                    <div className="csv-import-banner-actions">
                        <button
                            className="btn-secondary btn-sm"
                            onClick={() => setStage({ step: "idle" })}
                        >
                            Discard
                        </button>
                        <button
                            className="btn-primary btn-sm"
                            onClick={() => startImport(stage.rows, stage.fileName)}
                        >
                            Import to Database →
                        </button>
                    </div>
                </div>
            )}

            {/* Progress bar during import */}
            {renderImporting()}

            {/* Completion summary */}
            {renderDone()}
        </>
    );
}
