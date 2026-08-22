-- ─────────────────────────────────────────────────────────────
-- 0007 — Real dispatch
--
-- The Approval Queue now sends approved emails for real, through Resend
-- (backend/app/mailer.py). One row per dispatch attempt, successful or not:
-- the queue reads it back to show what has already gone out, so an operator
-- can't quietly send the same email to the same person twice without seeing it.
--
-- manipulation_score is left in place but no longer written — the Guardian's
-- lexicon scorer was replaced by the pre-flight checks in guardian.py, which
-- gate on consent, unsubscribe, PII, grounding, merge tags and deliverability.
-- ─────────────────────────────────────────────────────────────

create table if not exists email_send (
  id           text primary key,
  campaign_id  text not null references campaign(id) on delete cascade,
  email_id     text not null,          -- segment_email.id (no FK: a send is a
                                       -- historical record and must survive a
                                       -- regenerate that drops the draft)
  segment_brief_id text,
  recipient    text not null,
  subject      text not null default '',
  status       text not null default 'sent',   -- sent | failed
  provider     text not null default 'resend',
  provider_id  text,                   -- Resend's message id, when it accepted
  error        text,                   -- provider message, when it didn't
  created_at   timestamptz not null default now()
);

create index if not exists email_send_email_idx on email_send(email_id);
create index if not exists email_send_created_idx on email_send(created_at desc);

alter table email_send enable row level security;
drop policy if exists email_send_allow_all on email_send;
create policy email_send_allow_all on email_send
  for all to anon, authenticated using (true) with check (true);
