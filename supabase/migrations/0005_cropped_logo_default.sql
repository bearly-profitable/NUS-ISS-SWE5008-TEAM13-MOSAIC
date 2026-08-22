-- MOSAIC — cropped logo as the brand default
-- Run in the Supabase SQL Editor after 0004.
--
-- mosaic_logo.png carries a wide white margin, so it renders small inside an
-- email header. mosaic_logo_cropped.png is the same mark with the margin
-- removed, which reads much larger at the same height.
--
-- Existing rows store the URL per segment, so the old default is rewritten
-- here. Anything the user uploaded themselves is left alone.

alter table creative_direction
  alter column logo_url set default '/mosaic_logo_cropped.png';

update creative_direction
  set logo_url = '/mosaic_logo_cropped.png'
  where logo_url is null
     or logo_url = ''
     or logo_url = '/mosaic_logo.png';
