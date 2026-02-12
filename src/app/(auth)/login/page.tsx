import { AuthForm } from "@/components/auth/auth-form";
import { signIn } from "@/app/auth/actions";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign In — ProspectIQ",
    description: "Sign in to your ProspectIQ account to manage outreach campaigns.",
};

export default function LoginPage() {
    return <AuthForm mode="login" action={signIn} />;
}
