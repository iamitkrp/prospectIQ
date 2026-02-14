"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Fetch all prospects for the authenticated user.
 * Sorted by newest first. Supports pagination.
 */
export async function getProspects(page = 1, perPage = 15) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { data: [], count: 0, error: "Not authenticated" };
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, count, error } = await supabase
        .from("prospects")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error) {
        return { data: [], count: 0, error: error.message };
    }

    return { data: data ?? [], count: count ?? 0, error: null };
}

/**
 * Create a new prospect.
 */
export async function createProspect(formData: FormData) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "Not authenticated" };
    }

    const email = (formData.get("email") as string)?.trim();
    const first_name = (formData.get("first_name") as string)?.trim() || null;
    const last_name = (formData.get("last_name") as string)?.trim() || null;
    const company_name = (formData.get("company_name") as string)?.trim() || null;
    const role = (formData.get("role") as string)?.trim() || null;
    const linkedin_url = (formData.get("linkedin_url") as string)?.trim() || null;

    if (!email) {
        return { error: "Email is required." };
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: "Please enter a valid email address." };
    }

    const { error } = await supabase.from("prospects").insert({
        user_id: user.id,
        email,
        first_name,
        last_name,
        company_name,
        role,
        linkedin_url,
    });

    if (error) {
        if (error.code === "23505") {
            return { error: "A prospect with this email already exists." };
        }
        return { error: error.message };
    }

    revalidatePath("/prospects");
    return { success: "Prospect added successfully." };
}

/**
 * Update an existing prospect.
 */
export async function updateProspect(id: string, formData: FormData) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "Not authenticated" };
    }

    const email = (formData.get("email") as string)?.trim();
    const first_name = (formData.get("first_name") as string)?.trim() || null;
    const last_name = (formData.get("last_name") as string)?.trim() || null;
    const company_name = (formData.get("company_name") as string)?.trim() || null;
    const role = (formData.get("role") as string)?.trim() || null;
    const linkedin_url = (formData.get("linkedin_url") as string)?.trim() || null;

    if (!email) {
        return { error: "Email is required." };
    }

    const { error } = await supabase
        .from("prospects")
        .update({ email, first_name, last_name, company_name, role, linkedin_url })
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        if (error.code === "23505") {
            return { error: "A prospect with this email already exists." };
        }
        return { error: error.message };
    }

    revalidatePath("/prospects");
    return { success: "Prospect updated." };
}

/**
 * Delete a prospect by ID.
 */
export async function deleteProspect(id: string) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "Not authenticated" };
    }

    const { error } = await supabase
        .from("prospects")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/prospects");
    return { success: "Prospect deleted." };
}
