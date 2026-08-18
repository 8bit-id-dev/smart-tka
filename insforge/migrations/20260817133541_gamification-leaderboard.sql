-- SMART-TKA gamification & leaderboard (minimal v1)
-- Only tables, indexes, RLS enable, and policies

create table if not exists public.gamification_profiles (
  profile_id  uuid primary key references public.profiles(id) on delete cascade,
  xp          integer not null default 0,
  level       integer not null default 1,
  streak_current integer not null default 0,
  streak_best    integer not null default 0,
  last_active_date date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.achievements (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  title         text not null,
  description   text,
  icon          text,
  criteria_type text not null,
  criteria_value integer not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.user_achievements (
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  earned_at      timestamptz not null default now(),
  primary key (profile_id, achievement_id)
);

create index if not exists gamification_profiles_xp_idx on public.gamification_profiles(xp desc, level desc);
create index if not exists user_achievements_profile_idx on public.user_achievements(profile_id);
create index if not exists achievements_code_idx on public.achievements(code);

alter table public.gamification_profiles enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

-- Gamification profiles: student owns
drop policy if exists gp_self on public.gamification_profiles;
create policy gp_self on public.gamification_profiles
  for all using (
    profile_id in (select id from public.profiles where user_id = public.smart_uid()::text)
  )
  with check (
    profile_id in (select id from public.profiles where user_id = public.smart_uid()::text)
  );

drop policy if exists gp_school_staff on public.gamification_profiles;
create policy gp_school_staff on public.gamification_profiles
  for all using (
    profile_id in (
      select id from public.profiles p
      where p.school_id in (
        select school_id from public.profiles
        where user_id = public.smart_uid()::text
        and role in ('guru', 'admin', 'kepsek', 'konten')
      )
    )
  );

-- Achievements: everyone can read
drop policy if exists ach_read on public.achievements;
create policy ach_read on public.achievements
  for select using (public.smart_uid() is not null);

-- User achievements: student owns; school staff can read
drop policy if exists ua_read on public.user_achievements;
create policy ua_read on public.user_achievements
  for select using (
    profile_id in (select id from public.profiles where user_id = public.smart_uid()::text)
    or profile_id in (
      select id from public.profiles p
      where p.school_id in (
        select school_id from public.profiles
        where user_id = public.smart_uid()::text
        and role in ('guru', 'admin', 'kepsek', 'konten')
      )
    )
  );

drop policy if exists ua_write_self on public.user_achievements;
create policy ua_write_self on public.user_achievements
  for insert with check (
    profile_id in (select id from public.profiles where user_id = public.smart_uid()::text)
  );

-- Seed achievements
insert into public.achievements (code, title, description, icon, criteria_type, criteria_value) values
  ('first_attempt', 'Pelajaran Pertama', 'Selesaikan latihan pertama Anda', '🎯', 'attempts', 1),
  ('correct_10', '10 Benar Berturut-turut', 'Jawab 10 soal benar berturut-turut', '🔥', 'streak', 10),
  ('xp_100', 'Level 1', 'Kumpulkan 100 XP', '1', 'xp', 100),
  ('xp_250', 'Level 2', 'Kumpulkan 250 XP', '2', 'xp', 250),
  ('xp_500', 'Level 3', 'Kumpulkan 500 XP', '3', 'xp', 500),
  ('xp_1000', 'Level 4', 'Kumpulkan 1000 XP', '4', 'xp', 1000),
  ('simulasi_1', 'Simulasi Perdana', 'Selesaikan simulasi TKA pertama', '📝', 'attempts', 1),
  ('daily_streak_3', 'Konsisten 3 Hari', 'Belajar 3 hari berturut-turut', '📅', 'streak', 3),
  ('daily_streak_7', 'Konsisten 7 Hari', 'Belajar 7 hari berturut-turut', '📅', 'streak', 7),
  ('daily_streak_30', 'Konsisten 30 Hari', 'Belajar 30 hari berturut-turut', '📅', 'streak', 30)
on conflict (code) do nothing;
