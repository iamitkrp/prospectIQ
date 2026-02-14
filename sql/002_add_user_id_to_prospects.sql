-- ===========================================
-- ProspectIQ — Migration: Add user_id to prospects
-- ===========================================
-- Run this in Supabase SQL Editor to fix:
--   "column prospects.user_id does not exist"
-- ===========================================

-- 1. Add user_id column (nullable first for existing rows)
alter table prospects add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2. If you have existing rows, assign them to your user:
-- UPDATE prospects SET user_id = 'YOUR-USER-UUID-HERE' WHERE user_id IS NULL;

-- 3. Drop old permissive RLS policies
drop policy if exists "Authenticated users can view prospects" on prospects;
drop policy if exists "Authenticated users can insert prospects" on prospects;
drop policy if exists "Authenticated users can update prospects" on prospects;

-- 4. Create user-scoped RLS policies
create policy "Users can view own prospects"
  on prospects for select
  using (auth.uid() = user_id);

create policy "Users can insert own prospects"
  on prospects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own prospects"
  on prospects for update
  using (auth.uid() = user_id);

create policy "Users can delete own prospects"
  on prospects for delete
  using (auth.uid() = user_id);

-- 5. Add index on user_id for fast lookups
create index if not exists prospects_user_id_idx on prospects(user_id);

-- 6. Make email unique per user (not globally)
-- First drop the old global unique constraint
alter table prospects drop constraint if exists prospects_email_key;
-- Add per-user unique constraint
alter table prospects add constraint prospects_user_email_unique unique (user_id, email);
