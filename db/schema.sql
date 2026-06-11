-- Backtester Supabase schema (idempotent)
-- Run via: node scripts/setup-supabase.mjs
-- Or paste into Supabase dashboard > SQL Editor

-- ── backtest_runs ──────────────────────────────────────────────────────────
create table if not exists public.backtest_runs (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null    default now(),
  kind          text        not null,   -- 'single' | 'mtf'
  strategy_id   text        not null,
  strategy_label text       not null,
  symbol        text        not null,
  interval      text        not null,
  max_candles   int         not null,
  params        jsonb       not null    default '{}',
  settings      jsonb       not null    default '{}',
  result        jsonb       not null    default '{}',
  note          text        not null    default ''
);

alter table public.backtest_runs enable row level security;

drop policy if exists "anon_all_backtest_runs" on public.backtest_runs;
create policy "anon_all_backtest_runs"
  on public.backtest_runs
  for all
  to anon
  using (true)
  with check (true);

-- ── app_settings ──────────────────────────────────────────────────────────
create table if not exists public.app_settings (
  id         text        primary key default 'global',
  data       jsonb       not null    default '{}',
  updated_at timestamptz not null    default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "anon_all_app_settings" on public.app_settings;
create policy "anon_all_app_settings"
  on public.app_settings
  for all
  to anon
  using (true)
  with check (true);

-- seed the singleton row so upsert always finds something
insert into public.app_settings (id, data)
values ('global', '{}')
on conflict (id) do nothing;
