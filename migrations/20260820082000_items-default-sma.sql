-- SMART-TKA: pastikan semua soal di bank soal memiliki jenjang SMA
-- Aturan baru: jenjang dipilih saat membuat soal; soal lama diasumsikan SMA.
UPDATE public.items
   SET jenjang = 'sma'
 WHERE jenjang IS NULL;
