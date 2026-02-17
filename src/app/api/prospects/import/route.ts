import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/prospects/import
 *
 * Accepts an array of prospect objects and upserts them into the database.
 * Uses ON CONFLICT (email) DO UPDATE to handle duplicates gracefully.
 *
 * Body: {
 *   prospects: Array<{
 *     email: string;
 *     first_name: string;
 *     last_name?: string | null;
 *     company_name?: string | null;
 *     role?: string | null;
 *     linkedin_url?: string | null;
 *     raw_data?: Record<string, unknown>;
 *   }>
 * }
 *
 * Returns: { imported: number, updated: number, errors: string[] }
 */

const MAX_BATCH_SIZE = 200;

interface ProspectInput {
    email: string;
    first_name: string;
    last_name?: string | null;
    company_name?: string | null;
    role?: string | null;
    linkedin_url?: string | null;
    raw_data?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Not authenticated" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const prospects: ProspectInput[] = body.prospects;

        if (!Array.isArray(prospects) || prospects.length === 0) {
            return NextResponse.json(
                { error: "prospects array is required and must not be empty." },
                { status: 400 }
            );
        }

        if (prospects.length > MAX_BATCH_SIZE) {
            return NextResponse.json(
                { error: `Batch too large. Maximum ${MAX_BATCH_SIZE} prospects per request.` },
                { status: 400 }
            );
        }

        // Prepare rows for upsert
        const rows = prospects.map((p) => ({
            user_id: user.id,
            email: p.email.trim().toLowerCase(),
            first_name: p.first_name?.trim() || null,
            last_name: p.last_name?.trim() || null,
            company_name: p.company_name?.trim() || null,
            role: p.role?.trim() || null,
            linkedin_url: p.linkedin_url?.trim() || null,
            raw_data: p.raw_data ?? {},
        }));

        // Upsert: insert or update on email conflict
        const { data, error: upsertError } = await supabase
            .from("prospects")
            .upsert(rows, {
                onConflict: "email",
                ignoreDuplicates: false,
            })
            .select("id");

        if (upsertError) {
            console.error("[import] Upsert error:", upsertError);
            return NextResponse.json(
                { error: upsertError.message },
                { status: 500 }
            );
        }

        const importedCount = data?.length ?? 0;

        console.log(`[import] Upserted ${importedCount} prospects for user ${user.id}`);

        return NextResponse.json({
            imported: importedCount,
            errors: [],
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal server error";
        console.error("[import] Unexpected error:", err);
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
