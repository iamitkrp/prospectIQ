"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface SearchBarProps {
    /** Current search result count */
    resultCount: number;
    /** Query response time in ms (from server) */
    queryTimeMs: number;
}

/**
 * Debounced search bar.
 * Updates the `q` URL search param after 300ms of inactivity.
 * Shows result count and query response time.
 */
export function SearchBar({ resultCount, queryTimeMs }: SearchBarProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get("q") ?? "";

    const [value, setValue] = useState(initialQuery);
    const [isSearching, setIsSearching] = useState(false);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const firstRender = useRef(true);

    // Debounced URL update
    useEffect(() => {
        // Skip the initial render
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());

            if (value.trim()) {
                params.set("q", value.trim());
                params.set("page", "1"); // Reset to page 1 on new search
            } else {
                params.delete("q");
            }

            router.push(`/prospects?${params.toString()}`);
            setIsSearching(false);
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

    const hasQuery = !!searchParams.get("q");

    return (
        <div className="search-bar-wrapper">
            <div className="search-bar">
                <span className="search-bar-icon">{isSearching ? "⏳" : "🔍"}</span>
                <input
                    type="text"
                    className="search-bar-input"
                    placeholder='Search prospects… e.g. "CTO Fintech"'
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        setIsSearching(true);
                    }}
                    autoComplete="off"
                    spellCheck={false}
                />
                {value && (
                    <button
                        className="search-bar-clear"
                        onClick={() => {
                            setValue("");
                            setIsSearching(true);
                        }}
                        title="Clear search"
                    >
                        ✕
                    </button>
                )}
            </div>

            {!isSearching && (
                <div className="search-result-count">
                    {hasQuery ? (
                        resultCount === 0
                            ? <>No results found <span className="search-time">· {queryTimeMs}ms</span></>
                            : <>{resultCount.toLocaleString()} result{resultCount !== 1 ? "s" : ""} <span className="search-time">· {queryTimeMs}ms</span></>
                    ) : (
                        <>{resultCount.toLocaleString()} prospect{resultCount !== 1 ? "s" : ""} <span className="search-time">· {queryTimeMs}ms</span></>
                    )}
                </div>
            )}
        </div>
    );
}

