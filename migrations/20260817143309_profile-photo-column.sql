-- Add photo_url to profiles for avatar upload

alter table public.profiles
  add column if not exists photo_url text;

comment on column public.profiles.photo_url is 'Public URL of uploaded profile photo from profile-photos bucket.';
