-- SMART-TKA core schema (InsForge Postgres + RLS)
-- Apply on STAGING first. Verify auth.uid() exists; if InsForge uses another
-- helper, replace function smart_uid() below after `cli metadata`.

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Auth helper (adjust if InsForge documents a different JWT claim)
-- ---------------------------------------------------------------------------
create or replace function public.smart_uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

create or replace function public.smart_profile_id()
returns uuid
language sql
stable
as $$
  select id from public.profiles where user_id = public.smart_uid() limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum (
    'siswa', 'orang_tua', 'guru', 'admin', 'kepsek', 'konten', 'ops'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.jenjang as enum (
    'sd', 'smp', 'sma', 'smk', 'paket_a', 'paket_b', 'paket_c'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.package_kind as enum (
    'latihan', 'simulasi', 'ujian_kelas', 'diagnostik', 'lab_25'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attempt_status as enum (
    'in_progress', 'submitted', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.item_scope as enum ('smart', 'school', 'class');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tenancy & people
-- ---------------------------------------------------------------------------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null,
  full_name text,
  role public.user_role not null default 'siswa',
  school_id uuid references public.schools(id),
  date_of_birth date,
  jenjang public.jenjang,
  created_at timestamptz not null default now()
);

create index if not exists profiles_school_idx on public.profiles(school_id);
create index if not exists profiles_user_idx on public.profiles(user_id);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  jenjang public.jenjang not null,
  invite_code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.class_teachers (
  class_id uuid not null references public.classes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (class_id, profile_id)
);

create table if not exists public.class_students (
  class_id uuid not null references public.classes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (class_id, profile_id)
);

create table if not exists public.parent_links (
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending', -- pending | accepted | rejected
  code text,
  expires_at timestamptz,
  primary key (parent_id, student_id)
);

-- ---------------------------------------------------------------------------
-- Curriculum & items
-- ---------------------------------------------------------------------------
create table if not exists public.competencies (
  id uuid primary key default gen_random_uuid(),
  jenjang public.jenjang not null,
  mapel text not null,
  code text not null,
  title text not null,
  unique (jenjang, mapel, code)
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  scope public.item_scope not null default 'school',
  school_id uuid references public.schools(id),
  class_id uuid references public.classes(id),
  author_id uuid references public.profiles(id),
  jenjang public.jenjang not null,
  mapel text not null,
  competency_id uuid references public.competencies(id),
  item_type text not null default 'single', -- single | group_child
  group_id uuid,
  stem text not null,
  stimulus text,
  choices jsonb,
  correct_key text not null,
  rationale text not null,
  difficulty smallint default 2,
  status text not null default 'draft', -- draft | published | retired
  created_at timestamptz not null default now()
);

create index if not exists items_school_mapel on public.items(school_id, mapel, status);

-- ---------------------------------------------------------------------------
-- Packages (guru)
-- ---------------------------------------------------------------------------
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  kind public.package_kind not null,
  mapel text not null,
  jenjang public.jenjang not null,
  title text not null,
  item_count int not null check (item_count > 0),
  duration_sec int, -- null = latihan tanpa countdown ketat
  shuffle boolean not null default false,
  discuss_after_each boolean not null default false,
  created_at timestamptz not null default now()
);

-- discuss_after_each true only for latihan/diagnostik; simulasi/ujian false
create table if not exists public.package_items (
  package_id uuid not null references public.packages(id) on delete cascade,
  item_id uuid not null references public.items(id),
  position int not null,
  primary key (package_id, item_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Attempts (timer server = started_at + duration)
-- ---------------------------------------------------------------------------
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id),
  student_id uuid not null references public.profiles(id),
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  submitted_at timestamptz,
  score numeric(5,2),
  unique (package_id, student_id, started_at)
);

create table if not exists public.attempt_answers (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  item_id uuid not null references public.items(id),
  answer text,
  is_correct boolean,
  locked_at timestamptz,
  primary key (attempt_id, item_id)
);

create table if not exists public.readiness_scores (
  student_id uuid not null references public.profiles(id),
  mapel text not null,
  score numeric(5,2) not null,
  updated_at timestamptz not null default now(),
  primary key (student_id, mapel)
);

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  title text not null,
  body text not null,
  priority text not null default 'normal',
  requires_ack boolean not null default false,
  published_at timestamptz default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.announcement_acks (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  acked_at timestamptz not null default now(),
  primary key (announcement_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_teachers enable row level security;
alter table public.class_students enable row level security;
alter table public.parent_links enable row level security;
alter table public.competencies enable row level security;
alter table public.items enable row level security;
alter table public.packages enable row level security;
alter table public.package_items enable row level security;
alter table public.assignments enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.readiness_scores enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_acks enable row level security;

-- Profiles: self read/update; same school staff read
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for select using (
    user_id = public.smart_uid()
    or school_id in (select school_id from public.profiles p where p.user_id = public.smart_uid())
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (user_id = public.smart_uid());

-- Competencies: readable by all logged-in
drop policy if exists competencies_read on public.competencies;
create policy competencies_read on public.competencies
  for select using (public.smart_uid() is not null);

-- Items: published SMART global; or same school
drop policy if exists items_read on public.items;
create policy items_read on public.items
  for select using (
    (scope = 'smart' and status = 'published')
    or school_id in (select school_id from public.profiles where user_id = public.smart_uid())
  );

drop policy if exists items_write_teacher on public.items;
create policy items_write_teacher on public.items
  for all using (
    author_id in (select id from public.profiles where user_id = public.smart_uid() and role in ('guru','admin','konten'))
  )
  with check (
    author_id in (select id from public.profiles where user_id = public.smart_uid())
    and scope in ('school', 'class')
  );

-- Attempts: student owns; teacher of class can select submitted
drop policy if exists attempts_student on public.attempts;
create policy attempts_student on public.attempts
  for all using (
    student_id in (select id from public.profiles where user_id = public.smart_uid())
  );

-- Answers: student during attempt; pembahasan fields (correct_key) should be
-- selected by client ONLY after lock (latihan) or after submit (simulasi).
-- Enforce discuss rules in Edge Function, not only RLS.
drop policy if exists answers_student on public.attempt_answers;
create policy answers_student on public.attempt_answers
  for all using (
    attempt_id in (
      select id from public.attempts a
      where a.student_id in (select id from public.profiles where user_id = public.smart_uid())
    )
  );

-- Packages readable in school
drop policy if exists packages_school on public.packages;
create policy packages_school on public.packages
  for select using (
    school_id in (select school_id from public.profiles where user_id = public.smart_uid())
  );

drop policy if exists packages_teacher_write on public.packages;
create policy packages_teacher_write on public.packages
  for all using (
    created_by in (select id from public.profiles where user_id = public.smart_uid() and role in ('guru','admin'))
  );

-- Announcements: school members
drop policy if exists ann_read on public.announcements;
create policy ann_read on public.announcements
  for select using (
    school_id in (select school_id from public.profiles where user_id = public.smart_uid())
  );

comment on table public.items is 'Rasional/kunci: jangan di-select klien saat attempt simulasi in_progress';
