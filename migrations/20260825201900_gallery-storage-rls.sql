-- Gallery bucket: RLS untuk foto hasil sinkronisasi galeri HP siswa.
-- Bucket 'gallery' harus dibuat PRIVAT (bukan publik) di dashboard/CLI.
--
-- Alur akses:
--   - Upload : aplikasi Android memakai write token (anon key / service role)
--              -> uploaded_by = NULL / anon, diizinkan via policy INSERT anon.
--   - Select : web viewer memakai JWT user login; HANYA role 'admin' yang
--              boleh melihat (bukan 'kepsek', bukan publik).
-- Jika memakai Service Role API key sebagai write token, RLS di-bypass saat
-- upload sehingga policy INSERT tidak diperlukan.

-- Hapus policy default owner-only bila ada (tidak cocok untuk galeri bersama)
DROP POLICY IF EXISTS storage_objects_owner_select ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_insert ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_update ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_delete ON storage.objects;

-- Idempotent; fresh install punya RLS nonaktif sehingga wajib di-enable
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- SELECT: HANYA role 'admin' (via auth JWT) yang boleh melihat foto anak.
-- 'kepsek' sengaja dikecualikan (keputusan produk: galeri khusus admin).
DROP POLICY IF EXISTS gallery_select_admin ON storage.objects;
CREATE POLICY gallery_select_admin ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket = 'gallery'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.jwt() ->> 'sub')
        AND p.role = 'admin'
    )
  );

-- INSERT: diizinkan untuk client anon (sync HP memakai anon/write token).
-- Tidak perlu mengecek uploaded_by karena belum ada autentikasi per-device.
DROP POLICY IF EXISTS gallery_insert_anon ON storage.objects;
CREATE POLICY gallery_insert_anon ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket = 'gallery');

GRANT SELECT ON storage.objects TO authenticated;
GRANT INSERT ON storage.objects TO anon;
GRANT USAGE ON SCHEMA storage TO anon, authenticated;
