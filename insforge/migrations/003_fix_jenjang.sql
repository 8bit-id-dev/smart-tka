-- Cek dulu (jalankan query ini):
-- select column_name, data_type, udt_name
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'profiles'
-- order by ordinal_position;

-- Tambah kolom jika belum ada
alter table public.profiles
  add column if not exists jenjang public.jenjang;

-- Jika enum public.jenjang tidak ada, pakai teks:
-- alter table public.profiles add column if not exists jenjang text;

-- Insert admin TANPA enum bermasalah (jalankan setelah kolom ada).
-- Ganti UUID.
--
-- insert into public.profiles (user_id, full_name, role, school_id, jenjang)
-- values (
--   'UUID-USER-DARI-AUTH',
--   'Admin Demo',
--   'admin'::public.user_role,
--   '11111111-1111-1111-1111-111111111111',
--   'smp'::public.jenjang
-- );
