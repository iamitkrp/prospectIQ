"use client";

import { useState, useCallback } from "react";
import { ImportCsvButton } from "@/components/prospects/import-csv-button";
import type { CsvParseResult } from "@/components/prospects/csv-import-modal";

interface ProspectsHeaderProps {
    count: number;
}

/**
 * Client component for the prospects page header.
 * Holds import state and shows parsed CSV summary.
 */
export function ProspectsHeader({ count }: ProspectsHeaderProps) {
    const [importResult, setImportResult] = useState<CsvParseResult | null>(null);

    const handleParsed = useCallback((result: CsvParseResult) => {
        setImportResult(result);
        console.log("[import] Parsed CSV:", result.headers, `${result.totalRows} rows`);
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

            {importResult && (
                <div className="csv-import-banner">
                    <div className="csv-import-banner-left">
                        <span className="csv-file-badge">📄 {importResult.fileName}</span>
                        <span>{importResult.totalRows.toLocaleString()} rows · {importResult.headers.length} columns ready to import</span>
                    </div>
                    <div className="csv-import-banner-actions">
                        <button
                            className="btn-secondary btn-sm"
                            onClick={() => setImportResult(null)}
                        >
                            Discard
                        </button>
                        <button
                            className="btn-primary btn-sm"
                            disabled
                            title="Column mapping coming in 4.1.3"
                        >
                            Map Columns →
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
