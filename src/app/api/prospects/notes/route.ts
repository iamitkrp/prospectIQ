import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/prospects/notes
 *
 * Saves user-written notes for a prospect into raw_data.notes.
 * Body: { prospectId: string, notes: string }
 */
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { prospectId, notes } = body as {
            prospectId: string;
            notes: string;
        };

        if (!prospectId) {
            return NextResponse.json(
                { error: "prospectId is required" },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Fetch current raw_data so we don't overwrite enrichment
        const { data: prospect, error: fetchError } = await supabase
            .from("prospects")
            .select("id, raw_data")
            .eq("id", prospectId)
            .single();

        if (fetchError || !prospect) {
            return NextResponse.json(
                { error: "Prospect not found" },
                { status: 404 }
            );
        }

        const existing = (prospect.raw_data as Record<string, unknown>) ?? {};
        const updated = {
            ...existing,
            notes: notes.trim(),
            notesUpdatedAt: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
            .from("prospects")
            .update({ raw_data: updated })
            .eq("id", prospectId);

        if (updateError) {
            return NextResponse.json(
                { error: `Update failed: ${updateError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
