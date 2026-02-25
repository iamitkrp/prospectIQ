-- ===========================================
-- Add user_settings table for SMTP credentials
-- ===========================================

create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  smtp_email text,
  smtp_app_password text,
  smtp_provider text default 'gmail',
  is_smtp_verified boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Note: smtp_app_password will be stored encrypted. The Node.js backend handles
-- encryption/decryption before saving or reading.

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================
alter table user_settings enable row level security;

-- Users can only see their own settings
create policy "Users can view own settings"
  on user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on user_settings for update
  using (auth.uid() = user_id);

create policy "Users can delete own settings"
  on user_settings for delete
  using (auth.uid() = user_id);
