-- Migration: Add support for Email Approval Workflow
-- Run this in Supabase SQL Editor

-- 1. Add require_approval to campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS require_approval boolean default false;

-- 2. Update email_logs status constraint to allow 'DRAFT' and 'REJECTED'
-- Drop the existing constraint (Postgres auto-names it based on table and column)
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_status_check;

-- Add the new constraint with the expanded list of valid statuses
ALTER TABLE email_logs ADD CONSTRAINT email_logs_status_check 
  CHECK (status in ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'REPLIED', 'DRAFT', 'REJECTED'));
