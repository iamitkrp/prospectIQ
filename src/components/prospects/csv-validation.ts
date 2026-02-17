/**
 * CSV Import — Validation & Mapping Utilities
 *
 * Pure functions, no server interaction.
 */

import type { CsvRow } from "./csv-import-modal";

/* ── Prospect field definitions ── */

export interface ProspectField {
    key: string;
    label: string;
    required: boolean;
    /** Hint shown to help user identify the right column */
    hint: string;
}

export const PROSPECT_FIELDS: ProspectField[] = [
    { key: "email", label: "Email", required: true, hint: "e.g. john@company.com" },
    { key: "first_name", label: "First Name", required: true, hint: "e.g. John" },
    { key: "last_name", label: "Last Name", required: false, hint: "e.g. Doe" },
    { key: "company_name", label: "Company", required: false, hint: "e.g. Acme Corp" },
    { key: "role", label: "Role / Title", required: false, hint: "e.g. CTO, Product Manager" },
    { key: "linkedin_url", label: "LinkedIn URL", required: false, hint: "e.g. linkedin.com/in/johndoe" },
];

/* ── Column mapping type ── */

/** Maps a prospect field key to the CSV header name (or null = skip) */
export type ColumnMapping = Record<string, string | null>;

/* ── Auto-detect column mapping ── */

const HEADER_ALIASES: Record<string, string[]> = {
    email: ["email", "e-mail", "email_address", "emailaddress", "mail", "email address"],
    first_name: ["first_name", "firstname", "first name", "first", "given_name", "given name", "name"],
    last_name: ["last_name", "lastname", "last name", "last", "surname", "family_name", "family name"],
    company_name: ["company_name", "company", "companyname", "organization", "org", "company name"],
    role: ["role", "title", "job_title", "jobtitle", "position", "job title", "job_role"],
    linkedin_url: ["linkedin_url", "linkedin", "linkedinurl", "linkedin url", "linkedin_profile"],
};

/**
 * Try to auto-detect which CSV headers map to which prospect fields.
 * Returns a mapping with best guesses (null for unmatched fields).
 */
export function autoDetectMapping(csvHeaders: string[]): ColumnMapping {
    const mapping: ColumnMapping = {};
    const usedHeaders = new Set<string>();

    for (const field of PROSPECT_FIELDS) {
        const aliases = HEADER_ALIASES[field.key] ?? [];
        const match = csvHeaders.find((h) => {
            const norm = h.toLowerCase().trim();
            return !usedHeaders.has(h) && aliases.includes(norm);
        });

        if (match) {
            mapping[field.key] = match;
            usedHeaders.add(match);
        } else {
            mapping[field.key] = null;
        }
    }

    return mapping;
}

/* ── Validation ── */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidatedRow {
    email: string;
    first_name: string;
    last_name: string | null;
    company_name: string | null;
    role: string | null;
    linkedin_url: string | null;
    /** All original CSV columns stored as raw_data */
    raw_data: Record<string, unknown>;
}

export interface ValidationError {
    rowIndex: number;
    reason: string;
    row: CsvRow;
}

export interface ValidationResult {
    valid: ValidatedRow[];
    errors: ValidationError[];
    duplicateEmails: number;
}

/**
 * Validate and transform raw CSV rows using the column mapping.
 *
 * Checks:
 * - Required fields present (email, first_name)
 * - Email format valid
 * - Duplicate email detection (keeps first occurrence)
 */
export function validateRows(
    rows: CsvRow[],
    mapping: ColumnMapping
): ValidationResult {
    const valid: ValidatedRow[] = [];
    const errors: ValidationError[] = [];
    const seenEmails = new Set<string>();
    let duplicateEmails = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Extract mapped values
        const email = (mapping.email ? row[mapping.email] : "")?.trim() ?? "";
        const firstName = (mapping.first_name ? row[mapping.first_name] : "")?.trim() ?? "";
        const lastName = (mapping.last_name ? row[mapping.last_name] : null)?.trim() || null;
        const companyName = (mapping.company_name ? row[mapping.company_name] : null)?.trim() || null;
        const role = (mapping.role ? row[mapping.role] : null)?.trim() || null;
        const linkedinUrl = (mapping.linkedin_url ? row[mapping.linkedin_url] : null)?.trim() || null;

        // Required: email
        if (!email) {
            errors.push({ rowIndex: i + 1, reason: "Missing email", row });
            continue;
        }

        // Email format
        if (!EMAIL_REGEX.test(email)) {
            errors.push({ rowIndex: i + 1, reason: `Invalid email: "${email}"`, row });
            continue;
        }

        // Required: first_name
        if (!firstName) {
            errors.push({ rowIndex: i + 1, reason: "Missing first name", row });
            continue;
        }

        // Duplicate check (within this file)
        const emailLower = email.toLowerCase();
        if (seenEmails.has(emailLower)) {
            duplicateEmails++;
            errors.push({ rowIndex: i + 1, reason: `Duplicate email: "${email}"`, row });
            continue;
        }
        seenEmails.add(emailLower);

        valid.push({
            email,
            first_name: firstName,
            last_name: lastName,
            company_name: companyName,
            role,
            linkedin_url: linkedinUrl,
            raw_data: { ...row },
        });
    }

    return { valid, errors, duplicateEmails };
}
