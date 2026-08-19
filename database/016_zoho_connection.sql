-- =========================================================
-- ZOHO CONNECTION
-- Stores OAuth connection only.
-- Does NOT modify projects, members or tasks.
-- =========================================================

CREATE TABLE IF NOT EXISTS zoho_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    portal_id VARCHAR(200) NOT NULL UNIQUE,
    portal_name VARCHAR(255),

    -- AES encrypted by application code.
    -- Never store the plain refresh token.
    refresh_token_ciphertext TEXT NOT NULL,

    api_domain VARCHAR(500),

    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zoho_connections_portal
ON zoho_connections(portal_id);