"use client";

import { useState, useCallback } from "react";
import { ImportCsvButton } from "@/components/prospects/import-csv-button";
import type { CsvParseResult } from "@/components/prospects/csv-import-modal";
import { ColumnMappingModal } from "@/components/prospects/column-mapping-modal";
import type { ValidatedRow } from "@/components/prospects/csv-validation";

interface ProspectsHeaderProps {
    count: number;
}

type ImportStage =
    | { step: "idle" }
    | { step: "parsed"; data: CsvParseResult }
    | { step: "mapped"; rows: ValidatedRow[]; fileName: string };

/**
 * Client component for the prospects page header.
 * Manages the full CSV import flow: parse → map → validate → ready.
 */
export function ProspectsHeader({ count }: ProspectsHeaderProps) {
    const [stage, setStage] = useState<ImportStage>({ step: "idle" });

    const handleParsed = useCallback((result: CsvParseResult) => {
        setStage({ step: "parsed", data: result });
    }, []);

    const handleValidated = useCallback((rows: ValidatedRow[], fileName: string) => {
        setStage({ step: "mapped", rows, fileName });
        console.log(`[import] ${rows.length} validated rows ready for import`);
    }, []);

    return (
        <>
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1 className="page-title">Prospects</h1>
                    <p className="page-subtitle">{count} contact{count !== 1 ? "s" : ""} in your database</p>
                </div>
                <ImportCsvButton onParsed={handleParsed} />
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
                            ✅ {stage.rows.length.toLocaleString()} prospect{stage.rows.length !== 1 ? "s" : ""} validated & ready to import
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
                            disabled
                            title="Batch import coming in 4.1.5"
                        >
                            Import to Database →
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
