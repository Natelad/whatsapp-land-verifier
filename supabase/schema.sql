-- Landbot WhatsApp Verification Schema (Supabase / Postgres)
-- Run in Supabase SQL Editor.

create extension if not exists "uuid-ossp";

-- Optional: store verified land plots/master records.
-- You can skip this table if your workflow only verifies submissions against an existing master list.
create table if not exists public.land_records (
  id uuid primary key default uuid_generate_v4(),
  plot_number text not null,
  owner_name text,
  national_id text,
  status text not null default 'Unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plot_number)
);

create index if not exists land_records_plot_number_idx on public.land_records (plot_number);

-- Incoming WhatsApp Flow submissions awaiting admin verification.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'land_submission_status'
  ) THEN
    CREATE TYPE public.land_submission_status AS ENUM ('Pending', 'Verified', 'Rejected');
  END IF;
END;
$$;

create table if not exists public.land_submissions (
  id uuid primary key default uuid_generate_v4(),

  -- Identifier to match existing land record (or for later manual review)
  plot_number text not null,

  -- Separate name & surname
  first_name text,
  last_name text,

  -- Farm details
  farm_name text,
  gender text,
  province text,
  district text,
  tenure_type text,
  tenure_type_other text,

  national_id text,

  -- Who submitted via WhatsApp / Meta
  wa_id text not null,        -- WhatsApp ID/phone identifier from WhatsApp Cloud API
  from_phone text,           -- optional: human-readable phone if available

  -- Admin decision
  status public.land_submission_status not null default 'Pending',

  -- Admin metadata
  verified_by text,
  verified_at timestamptz,

  rejected_by text,
  rejected_at timestamptz,
  rejection_reason text,

  -- WhatsApp-specific linkage (helps debugging / traceability)
  wa_message_id text,
  wa_flow_token text,
  raw_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fast lookups
create index if not exists land_submissions_plot_number_idx on public.land_submissions (plot_number);
create index if not exists land_submissions_status_idx on public.land_submissions (status);
create index if not exists land_submissions_wa_id_idx on public.land_submissions (wa_id);

alter table if exists public.land_submissions add column if not exists province text;
alter table if exists public.land_submissions add column if not exists district text;
alter table if exists public.land_submissions add column if not exists tenure_type text;
alter table if exists public.land_submissions add column if not exists tenure_type_other text;

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_land_submissions_updated_at on public.land_submissions;
create trigger trg_land_submissions_updated_at
before update on public.land_submissions
for each row execute function public.set_updated_at();

-- RLS is important in production.
-- For this scaffold, we’ll keep it permissive by default (you should tighten later).
alter table public.land_submissions enable row level security;
alter table public.land_records enable row level security;

-- Allow service role to access everything (service key bypasses RLS in Supabase).
-- Admin UI should use service role via backend, not directly.
