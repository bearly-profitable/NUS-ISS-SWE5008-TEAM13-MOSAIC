-- Adds segment membership tracking so the Guardian's consent/suppression
-- check (stage 6) can look at the real customers behind a segment, instead
-- of being purely segment-level metadata.
-- Run in the Supabase SQL Editor same as 0001_init.sql.

alter table customer_profile
  add column if not exists segment_brief_id text references segment_brief(id) on delete set null;

create index if not exists customer_profile_segment_idx on customer_profile(segment_brief_id);

-- Persists the Guardian's full per-check breakdown (not just the aggregate
-- verdict) so the Approval Queue's "Why this email" panel can render it
-- after a page refresh, without recomputing anything.
alter table ledger_entry
  add column if not exists checks jsonb;

-- Tracks exactly which copy_version an approval applies to (the original
-- schema only had campaign-level scope), so the Approval Queue can show
-- per-item approved/pending state instead of one blanket campaign approval.
alter table approval
  add column if not exists target_id text;
