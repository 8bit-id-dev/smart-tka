ALTER TABLE items ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS items_external_id_key ON items (external_id);