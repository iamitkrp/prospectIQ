-- ===========================================
-- ProspectIQ — Database Schema (v2.0)
-- ===========================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard → SQL Editor → New Query → Paste → Run
-- ===========================================

-- 1. Enable Extensions
create extension if not exists vector;   -- For future RAG / embeddings
create extension if not exists pg_trgm;  -- For fuzzy / trigram search

-- ===========================================
-- 2. PROSPECTS (The Search Index)
-- ===========================================
create table if not exists prospects (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  first_name text,
  last_name text,
  company_name text,
  linkedin_url text,
  role text,
  raw_data jsonb default '{}'::jsonb,

  -- Auto-generated tsvector for full-text search
  search_text tsvector generated always as (
    to_tsvector('english',
      coalesce(first_name, '') || ' ' ||
      coalesce(last_name, '') || ' ' ||
      coalesce(company_name, '') || ' ' ||
      coalesce(role, '')
    )
  ) stored,

  created_at timestamp with time zone default now()
);

-- GIN index for fast full-text search
create index if not exists prospects_search_idx on prospects using gin(search_text);

-- Trigram index for fuzzy "LIKE" search on email/name
create index if not exists prospects_email_trgm_idx on prospects using gin(email gin_trgm_ops);

-- ===========================================
-- 3. CAMPAIGNS (The Container)
-- ===========================================
create table if not exists campaigns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  status text default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED')),
  created_at timestamp with time zone default now()
);

-- ===========================================
-- 4. CAMPAIGN STEPS (The Sequence Logic)
-- ===========================================
create table if not exists campaign_steps (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references campaigns(id) on delete cascade,
  step_order int not null,
  delay_days int default 2,
  prompt_template text,

  -- Prevent duplicate step orders within a campaign
  unique (campaign_id, step_order)
);

-- ===========================================
-- 5. EMAIL LOGS (The State Machine)
-- ===========================================
create table if not exists email_logs (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references campaigns(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete cascade,
  step_id uuid references campaign_steps(id) on delete set null,
  status text default 'PENDING' check (status in ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'REPLIED')),
  sent_at timestamp with time zone,
  qstash_message_id text,

  -- Safety: max 1 email per prospect per step
  unique (campaign_id, prospect_id, step_id)
);

-- Index for quick reply-check lookups
create index if not exists email_logs_prospect_status_idx on email_logs(prospect_id, status);

-- ===========================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ===========================================
-- Enable RLS on all tables
alter table prospects enable row level security;
alter table campaigns enable row level security;
alter table campaign_steps enable row level security;
alter table email_logs enable row level security;

-- Campaigns: users can only see their own
create policy "Users can view own campaigns"
  on campaigns for select
  using (auth.uid() = user_id);

create policy "Users can insert own campaigns"
  on campaigns for insert
  with check (auth.uid() = user_id);

create policy "Users can update own campaigns"
  on campaigns for update
  using (auth.uid() = user_id);

create policy "Users can delete own campaigns"
  on campaigns for delete
  using (auth.uid() = user_id);

-- Prospects: all authenticated users can access (shared pool)
create policy "Authenticated users can view prospects"
  on prospects for select
  to authenticated
  using (true);

create policy "Authenticated users can insert prospects"
  on prospects for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update prospects"
  on prospects for update
  to authenticated
  using (true);

-- Campaign Steps: inherit access from parent campaign
create policy "Users can view own campaign steps"
  on campaign_steps for select
  using (exists (
    select 1 from campaigns where campaigns.id = campaign_steps.campaign_id and campaigns.user_id = auth.uid()
  ));

create policy "Users can manage own campaign steps"
  on campaign_steps for all
  using (exists (
    select 1 from campaigns where campaigns.id = campaign_steps.campaign_id and campaigns.user_id = auth.uid()
  ));

-- Email Logs: inherit access from parent campaign
create policy "Users can view own email logs"
  on email_logs for select
  using (exists (
    select 1 from campaigns where campaigns.id = email_logs.campaign_id and campaigns.user_id = auth.uid()
  ));

create policy "Users can manage own email logs"
  on email_logs for all
  using (exists (
    select 1 from campaigns where campaigns.id = email_logs.campaign_id and campaigns.user_id = auth.uid()
  ));
