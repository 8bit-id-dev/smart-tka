-- SMART-TKA: teacher subject restriction (table + policy only)

create table if not exists public.teacher_subjects (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  school_id  uuid not null references public.schools(id) on delete cascade,
  subject    text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (profile_id, subject)
);

create index if not exists teacher_subjects_profile_idx on public.teacher_subjects(profile_id);
create index if not exists teacher_subjects_school_idx on public.teacher_subjects(school_id);
create index if not exists teacher_subjects_subject_idx on public.teacher_subjects(subject);

alter table public.teacher_subjects enable row level security;

drop policy if exists ts_read on public.teacher_subjects;
create policy ts_read on public.teacher_subjects
  for select using (
    profile_id in (select id from public.profiles where user_id = public.smart_uid()::text)
    or school_id in (
      select school_id from public.profiles
      where user_id = public.smart_uid()::text
      and role in ('admin', 'kepsek')
    )
  );

drop policy if exists ts_manage on public.teacher_subjects;
create policy ts_manage on public.teacher_subjects
  for all using (
    school_id in (
      select school_id from public.profiles
      where user_id = public.smart_uid()::text
      and role in ('admin', 'kepsek')
    )
  )
  with check (
    school_id in (
      select school_id from public.profiles
      where user_id = public.smart_uid()::text
      and role in ('admin', 'kepsek')
    )
  );

-- Helper function: guru boleh tulis item hanya untuk subject yang diajar
create or replace function public.user_can_write_item(p_author uuid, p_mapel text)
returns boolean
language sql
stable
as $$
  select
    case
      when (select role from public.profiles where user_id = public.smart_uid()::text limit 1)
           in ('admin', 'konten', 'kepsek') then true
      else
        public.smart_uid() is not null
        and p_author in (select id from public.profiles where user_id = public.smart_uid()::text and role in ('guru','admin','konten'))
        and p_mapel in (select ts.subject from public.teacher_subjects ts where ts.profile_id = p_author and ts.is_active)
    end;
$$;

grant execute on function public.user_can_write_item to authenticated;

-- Update items policy: guru restricted to their subjects
drop policy if exists items_write_teacher on public.items;
create policy items_write_teacher on public.items
  for all using (
    author_id in (select id from public.profiles where user_id = public.smart_uid()::text and role in ('guru','admin','konten'))
    and public.user_can_write_item(author_id, mapel)
  )
  with check (
    author_id in (select id from public.profiles where user_id = public.smart_uid()::text)
    and scope in ('school', 'class')
    and public.user_can_write_item(author_id, mapel)
  );
