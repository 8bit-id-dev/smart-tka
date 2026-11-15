-- IRT 2PL columns for items
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS irt_a NUMERIC(4,3),  -- discrimination (0.5-2.5)
  ADD COLUMN IF NOT EXISTS irt_b NUMERIC(4,3),  -- difficulty (-3 to +3)
  ADD COLUMN IF NOT EXISTS irt_c NUMERIC(4,3) DEFAULT 0;  -- guessing (for 3PL)

-- IRT results for attempts
ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS irt_theta NUMERIC(5,3),  -- ability estimate
  ADD COLUMN IF NOT EXISTS irt_se NUMERIC(5,3),     -- standard error
  ADD COLUMN IF NOT EXISTS irt_score NUMERIC(5,2);  -- 0-100 scale

-- Partial credit for PGK/PBS (fractional scoring bridge)
ALTER TABLE attempt_answers
  ADD COLUMN IF NOT EXISTS partial_score NUMERIC(4,3);  -- 0.000-1.000 per item

-- Index for IRT calibration queries
CREATE INDEX IF NOT EXISTS idx_items_irt ON items (irt_a, irt_b) WHERE irt_a IS NOT NULL AND irt_b IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attempts_irt ON attempts (irt_theta) WHERE irt_theta IS NOT NULL;

COMMENT ON COLUMN items.irt_a IS 'IRT 2PL discrimination parameter (slope)';
COMMENT ON COLUMN items.irt_b IS 'IRT 2PL difficulty parameter (location)';
COMMENT ON COLUMN items.irt_c IS 'IRT 3PL guessing parameter (lower asymptote)';
COMMENT ON COLUMN attempts.irt_theta IS 'IRT ability estimate (theta)';
COMMENT ON COLUMN attempts.irt_se IS 'IRT standard error of theta';
COMMENT ON COLUMN attempts.irt_score IS 'IRT score transformed to 0-100 scale';
COMMENT ON COLUMN attempt_answers.partial_score IS 'Fractional score per item (for PGK/PBS partial credit)';