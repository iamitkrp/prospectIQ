import { AuthForm } from "@/components/auth/auth-form";
import { signUp } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign Up — ProspectIQ",
    description: "Create your free ProspectIQ account to start outreach campaigns.",
};

export default async function SignupPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const code = typeof params.code === "string" ? params.code : undefined;

    // If Supabase sent an auth code here (email confirmation),
    // exchange it for a session and redirect to dashboard
    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            redirect("/dashboard");
        }
    }

    return <AuthForm mode="signup" action={signUp} />;
}
