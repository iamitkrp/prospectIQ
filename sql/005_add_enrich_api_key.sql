-- ===========================================
-- Add Enrich Layer API key column to user_settings
-- ===========================================
-- Run this in Supabase SQL Editor

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS enrich_api_key text;

-- Note: enrich_api_key is stored AES-256-CBC encrypted.
-- The Node.js backend handles encryption/decryption.
