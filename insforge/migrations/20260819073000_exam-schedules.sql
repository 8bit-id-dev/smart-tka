-- SMART-TKA: exam schedules (uji) - schedules a package so students can only attempt during a time window

create table if not exists public.exam_schedules (
  id          uuid primary key default gen_random_uuid(),
  package_id  uuid not null references public.packages(id) on delete cascade,
  title       text,
  subject     text,
  materi      text,
  duration_sec integer,
  info        text,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  token       text,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create index if not exists exam_schedules_package_idx on public.exam_schedules(package_id);
create index if not exists exam_schedules_subject_idx on public.exam_schedules(subject);
create index if not exists exam_schedules_window_idx on public.exam_schedules(start_at, end_at);

alter table public.exam_schedules enable row level security;

-- Siswa/bisa melihat jadwal ujian yang aktif dan dalam window relevant
drop policy if exists es_read on public.exam_schedules;
create policy es_read on public.exam_schedules
  for select using (
    is_active = true
    and start_at <= now() + interval '1 hour'
    and end_at >= now() - interval '1 hour'
  );

-- Admin/kepsek/konten/guru bisa kelola semua jadwal
drop policy if exists es_manage on public.exam_schedules;
create policy es_manage on public.exam_schedules
  for all using (
    (select role from public.profiles where user_id = public.smart_uid()::text limit 1) in ('admin','kepsek','konten','guru')
  )
  with check (
    (select role from public.profiles where user_id = public.smart_uid()::text limit 1) in ('admin','kepsek','konten','guru')
  );
