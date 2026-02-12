"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/**
 * Sign up a new user with email and password.
 *
 * If Supabase has email confirmation enabled (default), the user
 * won't have a session yet — they need to click the link in their
 * inbox first. In that case we return a success message instead of
 * redirecting to /dashboard (which would bounce to /login).
 */
export async function signUp(formData: FormData) {
    const supabase = await createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { error: "Email and password are required." };
    }

    if (password.length < 6) {
        return { error: "Password must be at least 6 characters." };
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        return { error: error.message };
    }

    // If email confirmation is enabled, Supabase returns a user
    // but with an empty session. We check for that.
    if (data.user && !data.session) {
        return {
            success: "Check your email for a confirmation link.",
        };
    }

    // If email confirmation is disabled, user gets a session immediately
    revalidatePath("/", "layout");
    redirect("/dashboard");
}

/**
 * Sign in an existing user with email and password.
 */
export async function signIn(formData: FormData) {
    const supabase = await createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { error: "Email and password are required." };
    }

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/", "layout");
    redirect("/dashboard");
}

/**
 * Sign out the current user.
 */
export async function signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/login");
}

/**
 * Get the current authenticated user.
 * Returns null if not authenticated.
 */
export async function getUser() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return user;
}
