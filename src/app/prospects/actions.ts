"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Fetch prospects for the authenticated user.
 * Supports pagination, full-text search, and field filters.
 *
 * @param page     - 1-indexed page number
 * @param perPage  - results per page  
 * @param query    - optional search query (uses websearch_to_tsquery)
 * @param filters  - optional field filters (role, company)
 */
export async function getProspects(
    page = 1,
    perPage = 15,
    query?: string,
    filters?: { role?: string; company?: string }
) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { data: [], count: 0, durationMs: 0, error: "Not authenticated" };
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let builder = supabase
        .from("prospects")
        .select("*", { count: "exact" })
        .eq("user_id", user.id);

    // Full-text search when query is provided
    const trimmed = query?.trim();
    if (trimmed) {
        builder = builder.textSearch("search_text", trimmed, {
            type: "websearch",
            config: "english",
        });
    }

    // Field filters
    if (filters?.role) {
        builder = builder.eq("role", filters.role);
    }
    if (filters?.company) {
        builder = builder.eq("company_name", filters.company);
    }

    const start = performance.now();

    const { data, count, error } = await builder
        .order("created_at", { ascending: false })
        .range(from, to);

    const durationMs = Math.round(performance.now() - start);

    if (error) {
        return { data: [], count: 0, durationMs, error: error.message };
    }

    return { data: data ?? [], count: count ?? 0, durationMs, error: null };
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

/**
 * Delete multiple prospects by IDs.
 */
export async function bulkDeleteProspects(ids: string[]) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "Not authenticated" };
    }

    if (ids.length === 0) {
        return { error: "No prospects selected." };
    }

    const { error } = await supabase
        .from("prospects")
        .delete()
        .in("id", ids)
        .eq("user_id", user.id);

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/prospects");
    return { success: `${ids.length} prospect${ids.length !== 1 ? "s" : ""} deleted.` };
}
