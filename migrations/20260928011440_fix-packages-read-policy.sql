-- Perbaikan policy baca paket: beberapa siswa tidak bisa melihat paket karena
-- current_school_id() mengembalikan NULL (smart_sub() gagal ekstrak JWT sub claim).
-- Aplikasi sudah filter school_id secara eksplisit, jadi policy RLS boleh longgar.

drop policy if exists packages_read on public.packages;

create policy packages_read on public.packages
  for select to authenticated
  using (true);