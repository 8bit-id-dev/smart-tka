-- AI-based per-student question selection for packages
-- Allows guru to configure AI random selection of N questions per student

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS use_ai_selection BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS jumlah_soal_soal INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT NULL;

-- Backfill: existing packages default to FALSE
UPDATE packages SET use_ai_selection = FALSE WHERE use_ai_selection IS NULL;

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_packages_ai_selection ON packages (use_ai_selection);
CREATE INDEX IF NOT EXISTS idx_packages_jumlah_soal ON packages (jumlah_soal_soal);
