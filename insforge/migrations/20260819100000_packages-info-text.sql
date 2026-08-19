-- SMART-TKA: add landing description to packages for the pre-exam info page

alter table public.packages
  add column if not exists info text;

comment on column public.packages.info is
  'Deskripsi singkat paket yang ditampilkan pada landing page sebelum mengerjakan soal';
