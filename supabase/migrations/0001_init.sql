-- MOSAIC — initial schema
-- Run this once in the Supabase Dashboard: Project -> SQL Editor -> New query
-- -> paste this whole file -> Run.
--
-- Covers two things:
--   1. The email builder's own tables (ported unchanged from CampaignOS),
--      extended with campaign_id / segment_brief_id so an assembled segment
--      email links back to the campaign that produced it.
--   2. The campaign pipeline tables
--      (Segmentation -> Creative -> Copy -> Guardian -> Approval -> Ledger).
--
-- RLS note: this app does not use Supabase Auth (see
-- frontend/src/contexts/AuthContext.tsx — a lightweight named-identity
-- picker instead), so auth.uid() is always null here. Policies below are
-- intentionally permissive (anon + authenticated can read/write everything)
-- — access control for this academic demonstrator is enforced at the app
-- layer, not the DB layer. Tighten this before any real deployment.

-- ─────────────────────────────────────────────────────────────
-- Email builder tables (Tier 2 of the porting guide)
-- ─────────────────────────────────────────────────────────────

create table if not exists email_template_folder (
  id          text primary key,
  name        text not null,
  description text not null default '',
  owner_id    uuid,
  is_private  boolean not null default false,
  color_key   text not null default 'orange',
  parent_id   text references email_template_folder(id) on delete cascade,
  folder_type text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists email_template (
  id               text primary key,
  name             text not null,
  subject          text not null default '',
  preheader        text,
  blocks           jsonb not null default '[]'::jsonb,
  background       jsonb,
  folder_id        text references email_template_folder(id) on delete set null,
  owner_id         uuid,
  is_private       boolean not null default false,
  created_by       text,
  last_modified_by text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- MOSAIC additions: link an assembled email back to the campaign/segment
  -- that produced it. Null for standalone templates built outside a campaign run.
  campaign_id      text,
  segment_brief_id text
);

create table if not exists email_template_tag (
  id text primary key,
  name text not null,
  color_key text not null default 'blue',
  category  text not null default 'general'
);

create table if not exists email_template_tag_map (
  template_id text references email_template(id) on delete cascade,
  tag_id      text references email_template_tag(id) on delete cascade,
  primary key (template_id, tag_id)
);

create table if not exists email_template_version (
  id text primary key,
  template_id text references email_template(id) on delete cascade,
  version_num int not null default 1,
  name text, subject text,
  blocks jsonb, background jsonb,
  saved_by text, note text default '',
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Campaign pipeline tables
-- ─────────────────────────────────────────────────────────────

create table if not exists brand_guideline_pack (
  id text primary key,
  name text not null,
  voice_exemplars jsonb default '[]'::jsonb,
  defaults jsonb default '{}'::jsonb, -- colour/logo/social defaults feeding BLOCK_DEFAULTS
  created_at timestamptz not null default now()
);

create table if not exists campaign (
  id text primary key,
  name text not null,
  objective text not null default '',
  budget_ceiling numeric not null default 150,
  brand_guideline_pack_id text references brand_guideline_pack(id) on delete set null,
  status text not null default 'planning', -- planning | generating | review | approved | dispatched
  created_by text,
  created_at timestamptz not null default now()
);

alter table email_template
  add constraint email_template_campaign_fk
  foreign key (campaign_id) references campaign(id) on delete set null;

create table if not exists offer_catalogue (
  id text primary key,
  campaign_id text references campaign(id) on delete cascade,
  name text not null,
  terms text default '',
  eligibility_rules jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists customer_profile (
  id text primary key,
  campaign_id text references campaign(id) on delete cascade,
  structured_attrs jsonb default '{}'::jsonb,
  behavioural jsonb default '{}'::jsonb,
  psychographic jsonb default '{}'::jsonb,
  free_text text default '',
  consent_state text not null default 'active' -- active | withdrawn
);

create table if not exists segment_brief (
  id text primary key,
  campaign_id text references campaign(id) on delete cascade,
  motivation text default '',
  tone_guidance text default '',
  visual_direction text default '',
  exclusions text default '',
  size int default 0,
  confidence numeric default 0,
  rationale text default '',
  feature_contributions jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table email_template
  add constraint email_template_segment_fk
  foreign key (segment_brief_id) references segment_brief(id) on delete set null;

create table if not exists asset_candidate (
  id text primary key,
  segment_brief_id text references segment_brief(id) on delete cascade,
  image_url text,
  prompt_used text,
  status text not null default 'approved', -- approved | rejected
  critique_verdict text,
  rejection_reason text,
  model_version text,
  created_at timestamptz not null default now()
);

create table if not exists asset_set (
  id text primary key,
  segment_brief_id text references segment_brief(id) on delete cascade,
  approved_candidate_ids text[] default '{}',
  alt_text text default ''
);

create table if not exists copy_version (
  id text primary key,
  segment_brief_id text references segment_brief(id) on delete cascade,
  subject text default '',
  preheader text default '',
  body_slots jsonb default '{}'::jsonb,
  cta text default '',
  cited_offer_ids text[] default '{}',
  model_version text,
  created_at timestamptz not null default now()
);

create table if not exists consent_suppression (
  customer_id text primary key references customer_profile(id) on delete cascade,
  consent_state text not null default 'active',
  suppressed_at timestamptz
);

create table if not exists ledger_entry (
  id text primary key,
  campaign_id text references campaign(id) on delete cascade,
  stage text not null,
  agent text not null,
  input_artifact_ids text[] default '{}',
  output_artifact_id text,
  prompt_version text,
  model_version text,
  verdict text, -- PASS | REVISE | BLOCK, null for non-adjudication stages
  actor text,   -- named human, for approvals/overrides
  created_at timestamptz not null default now()
);

create table if not exists approval (
  id text primary key,
  campaign_id text references campaign(id) on delete cascade,
  scope text not null default 'segment', -- segment | recipient-sample | override
  approver_name text not null,
  decision text not null default 'approved', -- approved | changes-requested
  created_at timestamptz not null default now()
);

create table if not exists manipulation_score (
  message_id text primary key references copy_version(id) on delete cascade,
  urgency numeric default 0,
  scarcity numeric default 0,
  loss_framing numeric default 0,
  social_proof numeric default 0,
  total numeric default 0,
  threshold_breached boolean default false
);

create table if not exists proxy_check_result (
  segment_brief_id text primary key references segment_brief(id) on delete cascade,
  protected_attribute text,
  correlation numeric,
  flagged boolean default false
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security — permissive for this demo (see note at top)
-- ─────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'email_template_folder', 'email_template', 'email_template_tag',
    'email_template_tag_map', 'email_template_version',
    'brand_guideline_pack', 'campaign', 'offer_catalogue',
    'customer_profile', 'segment_brief', 'asset_candidate', 'asset_set',
    'copy_version', 'consent_suppression', 'ledger_entry', 'approval',
    'manipulation_score', 'proxy_check_result'
  ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for all to anon, authenticated using (true) with check (true);',
      t || '_allow_all', t
    );
  end loop;
end $$;
