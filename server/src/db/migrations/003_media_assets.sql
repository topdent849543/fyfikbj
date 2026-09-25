CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bucket VARCHAR(100) NOT NULL,
  storage_path VARCHAR(500) NOT NULL UNIQUE,
  public_url VARCHAR(500) NOT NULL UNIQUE,
  content_type VARCHAR(100) NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  width INTEGER,
  height INTEGER,
  attached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_assets_owner_unattached ON media_assets(owner_id, created_at) WHERE attached_at IS NULL;
