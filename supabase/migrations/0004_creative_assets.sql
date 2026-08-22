-- MOSAIC — creative assets on the direction
-- Run in the Supabase SQL Editor after 0003.
--
-- Creative Review now lets the user pick a logo and hero image per segment.
-- Nothing is AI-generated: these are either the Mosaic defaults from the
-- frontend public folder, or a file the user uploaded to the email-images
-- bucket. The email composer centres whichever pair is set.

alter table creative_direction
  add column if not exists logo_url text not null default '/mosaic_logo.png';

alter table creative_direction
  add column if not exists hero_image_url text not null default '/mosaic_hero.png';

-- Existing rows predate these columns and would otherwise render an empty
-- header/hero until the user touched each segment.
update creative_direction
  set logo_url = '/mosaic_logo.png'
  where logo_url is null or logo_url = '';

update creative_direction
  set hero_image_url = '/mosaic_hero.png'
  where hero_image_url is null or hero_image_url = '';
