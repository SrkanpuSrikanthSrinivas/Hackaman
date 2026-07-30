-- ============================================================
-- HackFest Hub — Schema v3 additions
-- Run this against your existing DB (safe, uses IF NOT EXISTS)
-- ============================================================

-- Public landing page content per hackathon
CREATE TABLE IF NOT EXISTS hackathon_public (
  hackathon_id   VARCHAR(20)  PRIMARY KEY REFERENCES hackathons(id) ON DELETE CASCADE,
  slug           VARCHAR(100) UNIQUE,
  tagline        VARCHAR(255),
  banner_color   VARCHAR(7)   DEFAULT '#2563eb',
  prizes         JSONB        DEFAULT '[]',
  schedule       JSONB        DEFAULT '[]',
  rules          TEXT,
  registration_url TEXT,
  sponsors       JSONB        DEFAULT '[]',
  is_published   BOOLEAN      DEFAULT false,
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- OAuth provider accounts linked to users
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id            VARCHAR(20)  PRIMARY KEY,
  user_id       VARCHAR(20)  REFERENCES users(id) ON DELETE CASCADE,
  provider      VARCHAR(20)  NOT NULL,
  provider_id   VARCHAR(255) NOT NULL,
  email         VARCHAR(255),
  avatar_url    TEXT,
  display_name  VARCHAR(255),
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_hp_slug    ON hackathon_public (slug);

-- Seed public pages for existing hackathons
INSERT INTO hackathon_public (hackathon_id, slug, tagline, banner_color, is_published, prizes, schedule)
VALUES
  ('h1', 'hackfest-2025', 'Build the future in 48 hours', '#2563eb', true,
   '[{"place":"1st","amount":"$5,000","label":"Grand Prize"},{"place":"2nd","amount":"$2,500","label":"Runner Up"},{"place":"3rd","amount":"$1,000","label":"3rd Place"}]',
   '[{"date":"May 1","label":"Kickoff & team formation"},{"date":"May 2","label":"Hacking begins"},{"date":"May 2","label":"Midpoint check-in"},{"date":"May 3","label":"Submissions due"},{"date":"May 3","label":"Judging & awards"}]'),
  ('h2', 'buildit-spring', '48 hours to ship something real', '#7c3aed', false,
   '[{"place":"1st","amount":"$3,000","label":"Grand Prize"}]',
   '[{"date":"Jun 15","label":"Kickoff"},{"date":"Jun 16","label":"Demo day"}]')
ON CONFLICT DO NOTHING;
