-- SMART-TKA: allow deleting a package even when attempts exist.
-- Removing a package (esp. sample/seed paket such as MTK-001) must not fail with
-- "update or delete on table packages violates foreign key constraint
-- attempts_package_id_fkey". attempts -> package_items already cascade; make
-- attempts cascade on package delete too so attempt_answers is cleaned up transitively.
alter table public.attempts
  drop constraint if exists attempts_package_id_fkey,
  add constraint attempts_package_id_fkey
  foreign key (package_id)
  references public.packages (id)
  on delete cascade;
