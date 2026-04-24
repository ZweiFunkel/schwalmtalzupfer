-- Ensure all tables exist (idempotent)

CREATE TABLE IF NOT EXISTS page (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS page_section (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES page(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    position INT NOT NULL,
    content JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_section_page_id ON page_section(page_id);

CREATE TABLE IF NOT EXISTS member (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    iban_encrypted TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invitation_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

