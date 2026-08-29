-- ─────────────────────────────────────────────────────────────
-- 0008 — Agent evaluation runs
--
-- Append-only scores for the four decision agents (segmentation,
-- creative direction, email composer, Guardian). Each row is one
-- scoring pass over the current workspace artifacts so a prompt or
-- model change can be compared to the previous run.
--
-- Run in the Supabase SQL Editor after 0007.
-- ─────────────────────────────────────────────────────────────

create table if not exists eval_run (
  id              text primary key,
  campaign_id    text not null references campaign(id) on delete cascade,
  rubric_version  text not null,
  judge_model     text,
  scores          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists eval_run_created_idx
  on eval_run (campaign_id, created_at desc);

alter table eval_run enable row level security;
drop policy if exists eval_run_allow_all on eval_run;
create policy eval_run_allow_all on eval_run
  for all to anon, authenticated using (true) with check (true);
