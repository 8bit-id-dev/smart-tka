-- SMART-TKA: package_items had RLS enabled but no policies, so students could not
-- read package soal links (resulting in "Paket belum berisi soal") and teachers
-- could not write links on save. Add read (school-scoped via packages) + write (teacher).
drop policy if exists package_items_school on public.package_items;
create policy package_items_school on public.package_items
  for select using (
    exists (
      select 1 from public.packages p
      where p.id = package_items.package_id
        and p.school_id = (select school_id from public.profiles where user_id = public.smart_uid()::text limit 1)
    )
  );

drop policy if exists package_items_teacher_write on public.package_items;
create policy package_items_teacher_write on public.package_items
  for all using (
    exists (
      select 1 from public.packages p
      where p.id = package_items.package_id
        and p.created_by in (
          select id from public.profiles
          where user_id = public.smart_uid()::text
            and role in ('guru', 'admin')
          limit 1
        )
    )
  );
