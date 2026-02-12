/**
 * General utility functions.
 * Add shared helpers here (formatters, validators, etc.)
 */

/**
 * Combines class names, filtering out falsy values.
 * Useful for conditional Tailwind classes.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(" ");
}
