-- SMART-TKA: add sub_materi column to items for granular distribution

ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS sub_materi TEXT;

CREATE INDEX IF NOT EXISTS items_sub_materi_idx ON public.items(sub_materi);

COMMENT ON COLUMN public.items.sub_materi IS 'Sub-materi untuk distribusi soal granular (mis. "Persamaan Linier" di bawah materi "Aljabar")';