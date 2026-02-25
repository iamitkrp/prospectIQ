import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Auth callback handler.
 * Supabase redirects here after email confirmation or OAuth.
 * Exchanges the auth code for a session, then redirects to dashboard.
 */
export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";

    // Use the canonical app URL if available, otherwise fall back to request origin
    const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        origin;

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            return NextResponse.redirect(`${baseUrl}${next}`);
        }
    }

    // If something went wrong, redirect to login with error
    return NextResponse.redirect(`${baseUrl}/login?error=auth_callback_failed`);
}
