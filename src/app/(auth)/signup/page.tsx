import { AuthForm } from "@/components/auth/auth-form";
import { signUp } from "@/app/auth/actions";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign Up — ProspectIQ",
    description: "Create your free ProspectIQ account to start outreach campaigns.",
};

export default function SignupPage() {
    return <AuthForm mode="signup" action={signUp} />;
}
