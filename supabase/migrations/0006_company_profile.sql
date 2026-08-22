-- MOSAIC — company profile & bring-your-own audience
-- Run in the Supabase SQL Editor after 0005.
--
-- What this changes:
--   1. The audience is no longer a fixed synthetic base. Operators upload
--      their own CSV, whose columns are profiled at ingest time
--      (backend/app/csv_ingest.py) rather than mapped to known names.
--      customer_profile needs no schema change for this — structured_attrs /
--      behavioural are already jsonb — but the rows written by the old
--      loader describe a company that is no longer this workspace's, so they
--      are cleared along with everything derived from them.
--   2. Step 1 (Company Info) collects the company name, website, description,
--      campaign intent and the personalisation column. These live in one
--      app_setting row, `company_profile`, which every agent prompt reads.
--      The old standalone `objective` setting folds into it.
--   3. Brand assets (logo, hero) are uploaded per company in Creative Review,
--      so the Mosaic-branded defaults on creative_direction are dropped —
--      an empty asset now means "leave the block out", not "use ours".

-- ─────────────────────────────────────────────────────────────
-- 1. Seed the company profile, carrying over the old objective
-- ─────────────────────────────────────────────────────────────

insert into app_setting (key, value)
values (
  'company_profile',
  jsonb_build_object(
    'name', '',
    'website', '',
    'description', '',
    'campaign_intent', coalesce(
      (select value ->> 'text' from app_setting where key = 'objective'),
      ''
    ),
    'dynamic_attribute', '',
    'logo_url', '',
    'hero_image_url', '',
    'columns', '[]'::jsonb,
    'csv_filename', '',
    'csv_row_count', 0,
    'uploaded_at', null
  )
)
on conflict (key) do nothing;

delete from app_setting where key = 'objective';

-- ─────────────────────────────────────────────────────────────
-- 2. Brand assets are the operator's, not ours
-- ─────────────────────────────────────────────────────────────

alter table creative_direction alter column logo_url set default '';
alter table creative_direction alter column hero_image_url set default '';

update creative_direction
  set logo_url = ''
  where logo_url in ('/mosaic_logo.png', '/mosaic_logo_cropped.png');

update creative_direction
  set hero_image_url = ''
  where hero_image_url = '/mosaic_hero.png';

-- ─────────────────────────────────────────────────────────────
-- 3. Clear the synthetic base
--
-- segment_brief cascades to creative_direction, segment_email,
-- proxy_check_result and manipulation_score, so this leaves a clean
-- workspace waiting on an upload rather than a half-migrated one where
-- segments describe contacts that no longer exist.
-- ─────────────────────────────────────────────────────────────

delete from segment_brief where campaign_id = 'mosaic-workspace';
delete from customer_profile where campaign_id = 'mosaic-workspace';

-- The offer catalogue is now the operator's own, collected in step 1
-- alongside the campaign intent. The seeded Mosaic offers would otherwise be
-- cited by emails for a company that has never heard of them.
delete from offer_catalogue where campaign_id = 'mosaic-workspace';
