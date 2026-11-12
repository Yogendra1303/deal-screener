-- Fund Hub: Supabase schema. Safe to paste into the SQL editor more than once.
-- The app talks to these tables from the server with SUPABASE_SERVICE_ROLE_KEY (never from the browser).

create table if not exists public.deals (
  id text primary key,
  slug text,
  company_name text not null,
  sector text,
  sub_category text,
  stage text,
  country text,
  city text,
  ask_amount numeric,
  currency text,
  status text,
  band text,
  founder_fit text,
  owner text,
  received_at timestamptz,
  is_historical boolean not null default false,
  record_json jsonb,
  intake_json jsonb,
  decision_json jsonb,
  research_pack_json jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists deals_sector_idx on public.deals (sector);
create index if not exists deals_status_idx on public.deals (status);
create index if not exists deals_received_idx on public.deals (received_at desc);

create table if not exists public.deal_files (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null references public.deals (id) on delete cascade,
  -- deck_pdf, monthly_csv, intake_form, registry_json, audit_html, or the key of a file a founder sent through a link.
  file_type text not null,
  file_name text not null,
  mime_type text,
  storage_path text not null,
  raw_content text,
  created_at timestamptz not null default now()
);
create index if not exists deal_files_deal_idx on public.deal_files (deal_id);

create table if not exists public.deal_signals (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null references public.deals (id) on delete cascade,
  event_type text not null,
  title text not null,
  publisher text,
  source_url text,
  event_date date,
  relevance_note text,
  points int,
  created_at timestamptz not null default now()
);
create index if not exists deal_signals_deal_idx on public.deal_signals (deal_id);

create table if not exists public.workspace_settings (
  id int primary key default 1 check (id = 1),
  workspace_mode text check (workspace_mode in ('FULL_90', 'TEST_10', 'ZERO', 'ZERO_LIVE')),
  fund_rules_json jsonb,
  ai_mode text check (ai_mode in ('ACCOUNT_BRIDGE', 'API_KEY')),
  updated_at timestamptz not null default now()
);
insert into public.workspace_settings (id, workspace_mode, ai_mode) values (1, 'FULL_90', 'ACCOUNT_BRIDGE') on conflict (id) do nothing;

-- Each screen's working state (statuses, notes, overrules, founder requests, uploads, questions), one row per store.
-- This is what makes a change in one browser show up in every other browser.
create table if not exists public.app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Uploaded decks and sheets live in a private bucket; the app serves them through /api/files.
insert into storage.buckets (id, name, public) values ('deal-files', 'deal-files', false) on conflict (id) do nothing;

-- Lock the tables down. The service role key bypasses RLS, which is how the server reads and writes.
alter table public.deals enable row level security;
alter table public.deal_files enable row level security;
alter table public.deal_signals enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.app_state enable row level security;

-- Only if you set NEXT_PUBLIC_SUPABASE_ANON_KEY instead of the service role key, uncomment these so the anon key can write.
-- Anyone who finds the key could then read and change the data, so prefer the service role key.
-- create policy "anon all deals" on public.deals for all to anon using (true) with check (true);
-- create policy "anon all deal_files" on public.deal_files for all to anon using (true) with check (true);
-- create policy "anon all deal_signals" on public.deal_signals for all to anon using (true) with check (true);
-- create policy "anon all workspace_settings" on public.workspace_settings for all to anon using (true) with check (true);
-- create policy "anon all app_state" on public.app_state for all to anon using (true) with check (true);
-- create policy "anon all storage" on storage.objects for all to anon using (bucket_id = 'deal-files') with check (bucket_id = 'deal-files');
