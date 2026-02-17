"use client";

import { useState } from "react";
import { CsvImportModal, type CsvParseResult } from "./csv-import-modal";

interface ImportCsvButtonProps {
    onParsed: (result: CsvParseResult) => void;
}

/**
 * Client-side button that opens the CSV import modal.
 * Used by the prospects page header.
 */
export function ImportCsvButton({ onParsed }: ImportCsvButtonProps) {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <button
                className="btn-primary"
                onClick={() => setShowModal(true)}
            >
                📤 Import CSV
            </button>

            {showModal && (
                <CsvImportModal
                    onClose={() => setShowModal(false)}
                    onParsed={(result) => {
                        setShowModal(false);
                        onParsed(result);
                    }}
                />
            )}
        </>
    );
}
