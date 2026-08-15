-- MOSAIC — workspace revamp
-- Run in the Supabase SQL Editor, same as 0001/0002, AFTER both of those.
--
-- What this changes:
--   1. Budget ceilings are gone entirely (no cost gate anywhere in the app).
--   2. AI image generation is gone — asset_candidate / asset_set drop out, and
--      "creative" now means a *direction* (tonality, language, CTA, design
--      style, palette) rather than a generated picture.
--   3. copy_version is replaced by segment_email, which holds a real editable
--      EmailBlock[] the ported builder can load directly.
--   4. The campaign concept collapses to ONE implicit workspace row, so the
--      existing campaign_id foreign keys keep working with no UI for it.
--   5. New activity_log backs the Logs tab (user actions, alongside the
--      agent-side ledger_entry rows).

-- ─────────────────────────────────────────────────────────────
-- 1. Budget removal
-- ─────────────────────────────────────────────────────────────

alter table campaign drop column if exists budget_ceiling;

-- ─────────────────────────────────────────────────────────────
-- 2. Image generation removal
-- ─────────────────────────────────────────────────────────────

drop table if exists asset_set cascade;
drop table if exists asset_candidate cascade;

-- ─────────────────────────────────────────────────────────────
-- 2b. Segments get a human-readable name; visual_direction is dead weight
--     now that no imagery is generated.
-- ─────────────────────────────────────────────────────────────

alter table segment_brief add column if not exists name text not null default '';
alter table segment_brief drop column if exists visual_direction;

-- ─────────────────────────────────────────────────────────────
-- 3. Creative direction (replaces the old generated-image stage)
-- ─────────────────────────────────────────────────────────────

create table if not exists creative_direction (
  segment_brief_id text primary key references segment_brief(id) on delete cascade,
  tonality         text not null default '',
  language_style   text not null default '',
  cta_style        text not null default '',
  design_style     text not null default '',
  -- {primary, accent, background, text} — seeded from the workspace brand
  -- palette, overridable per segment in the Creative Review tab.
  palette          jsonb not null default '{}'::jsonb,
  rationale        text not null default '',
  model_version    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 4. Segment emails (replaces copy_version)
-- ─────────────────────────────────────────────────────────────

-- manipulation_score.message_id pointed at copy_version; re-point it at
-- segment_email below, so drop the old table and its dependents first.
drop table if exists manipulation_score cascade;
drop table if exists copy_version cascade;

create table if not exists segment_email (
  id               text primary key,
  segment_brief_id text references segment_brief(id) on delete cascade,
  subject          text not null default '',
  preheader        text not null default '',
  -- EmailBlock[] exactly as frontend/src/types/email-builder.ts defines it,
  -- so the builder can load/save this with no translation layer.
  blocks           jsonb not null default '[]'::jsonb,
  background       jsonb,
  cited_offer_ids  text[] not null default '{}',
  status           text not null default 'draft', -- draft | edited | approved
  model_version    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists segment_email_segment_idx on segment_email(segment_brief_id);

create table if not exists manipulation_score (
  message_id         text primary key references segment_email(id) on delete cascade,
  urgency            numeric default 0,
  scarcity           numeric default 0,
  loss_framing       numeric default 0,
  social_proof       numeric default 0,
  total              numeric default 0,
  threshold_breached boolean default false
);

-- ─────────────────────────────────────────────────────────────
-- 5. Workspace settings (objective + offers + brand palette live here now,
--    since Brief Intake is gone)
-- ─────────────────────────────────────────────────────────────

create table if not exists app_setting (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 6. Activity log — the Logs tab's user-action half
-- ─────────────────────────────────────────────────────────────

create table if not exists activity_log (
  id          text primary key,
  actor       text not null default 'Operator',
  action      text not null,          -- e.g. segments.generate, email.edit, email.approve
  target_type text,                   -- segment | email | setting | audience
  target_id   text,
  detail      text not null default '',
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_created_idx on activity_log(created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 7. The single implicit workspace
-- ─────────────────────────────────────────────────────────────

insert into campaign (id, name, objective, status)
values (
  'mosaic-workspace',
  'MOSAIC Workspace',
  'Re-engage at-risk and price-sensitive customers with relevant plan upgrades and bundle offers.',
  'active'
)
on conflict (id) do nothing;

-- approver_name is no longer collected (the "Acting as" picker is gone);
-- everything is attributed to a generic operator.
alter table approval alter column approver_name set default 'Operator';

-- ─────────────────────────────────────────────────────────────
-- 8. RLS for the new tables (permissive, same as 0001)
-- ─────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'creative_direction', 'segment_email', 'manipulation_score',
    'app_setting', 'activity_log'
  ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I on %I;', t || '_allow_all', t);
    execute format(
      'create policy %I on %I for all to anon, authenticated using (true) with check (true);',
      t || '_allow_all', t
    );
  end loop;
end $$;
