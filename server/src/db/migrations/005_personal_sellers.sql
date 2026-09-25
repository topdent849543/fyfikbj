ALTER TABLE merchants ADD COLUMN IF NOT EXISTS is_personal_seller BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_merchants_personal_seller ON merchants(is_personal_seller) WHERE is_personal_seller = TRUE;
