"use server";

import { createClient } from "@/lib/supabase/server";
import * as crypto from "crypto";
import nodemailer from "nodemailer";

const ENCRYPTION_KEY = process.env.SMTP_ENCRYPTION_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 32) || "fallback-key-should-be-32-chars-long";

// Helper: Encrypt
function encrypt(text: string) {
    const normalizedKey = ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(normalizedKey), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
}

// Helper: Decrypt (Internal only, not exported since it's in a 'use server' file and sync)
function decrypt(text: string) {
    try {
        const normalizedKey = ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32);
        const textParts = text.split(":");
        const iv = Buffer.from(textParts.shift() as string, "hex");
        const encryptedText = Buffer.from(textParts.join(":"), "hex");
        const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(normalizedKey), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        return null;
    }
}

export async function getUserSettings() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
        .from("user_settings")
        .select("smtp_email, is_smtp_verified, smtp_provider")
        .eq("user_id", user.id)
        .single();

    return data;
}

export async function verifySmtpConnection({ email, password }: { email: string, password: string }) {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: email,
                pass: password,
            },
        });

        await transporter.verify();
        return { success: true };
    } catch (error: any) {
        return { error: error.message || "Failed to verify connection to Gmail." };
    }
}

export async function saveSmtpSettings({ email, password }: { email: string, password: string }) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: "Unauthorized" };

        // 1. Verify credentials first
        const verification = await verifySmtpConnection({ email, password });
        if (verification.error) return { error: verification.error };

        // 2. Encrypt password
        const encryptedPassword = encrypt(password);

        // 3. Save to database
        const { error } = await supabase
            .from("user_settings")
            .upsert({
                user_id: user.id,
                smtp_email: email,
                smtp_app_password: encryptedPassword,
                smtp_provider: "gmail",
                is_smtp_verified: true,
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        return { error: error.message || "Something went wrong saving settings." };
    }
}

export async function disconnectSmtpSettings() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: "Unauthorized" };

        const { error } = await supabase
            .from("user_settings")
            .delete()
            .eq("user_id", user.id);

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        return { error: error.message || "Failed to disconnect settings." };
    }
}
