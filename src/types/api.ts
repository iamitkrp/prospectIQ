/**
 * API response wrapper types for consistent error/success handling.
 */

export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
}

export interface ApiErrorResponse {
    success: false;
    error: string;
    code?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * AI-generated email draft structure from Groq.
 */
export interface GeneratedDraft {
    subject: string;
    body: string;
    rationale: string;
}
