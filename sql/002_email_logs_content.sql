-- Migration: Add subject and body columns to email_logs
-- Run this in Supabase SQL Editor before testing campaigns

ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS body text;
