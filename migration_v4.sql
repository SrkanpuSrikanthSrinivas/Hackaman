-- HackFest Hub — Migration v5: Conference Page Sections
-- Run in Neon SQL Editor

ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS tagline        VARCHAR(255);
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS banner_color   VARCHAR(20)  DEFAULT '#0f172a';
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS prize_pool     VARCHAR(100);
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS max_teams      INTEGER;
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS tracks         TEXT;
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS website_about  TEXT;
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS website_prizes TEXT;

DROP TABLE IF EXISTS page_speakers  CASCADE;
DROP TABLE IF EXISTS page_partners  CASCADE;
DROP TABLE IF EXISTS page_team      CASCADE;

-- Speakers table (keynotes + session chairs share this, differentiated by type)
CREATE TABLE IF NOT EXISTS page_speakers (
  id           VARCHAR(20)  PRIMARY KEY,
  hackathon_id VARCHAR(20)  NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  type         VARCHAR(30)  NOT NULL CHECK (type IN ('keynote','session_chair','judge_panel')),
  name         VARCHAR(255) NOT NULL,
  title        VARCHAR(255),
  org          VARCHAR(255),
  bio          TEXT,
  avatar_url   TEXT,
  linkedin_url VARCHAR(500),
  twitter_url  VARCHAR(500),
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Partners / sponsors
CREATE TABLE IF NOT EXISTS page_partners (
  id           VARCHAR(20)  PRIMARY KEY,
  hackathon_id VARCHAR(20)  NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  tier         VARCHAR(50)  DEFAULT 'general',  -- platinum, gold, silver, bronze, general, media
  logo_url     TEXT,
  website_url  VARCHAR(500),
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Organizing team
CREATE TABLE IF NOT EXISTS page_team (
  id           VARCHAR(20)  PRIMARY KEY,
  hackathon_id VARCHAR(20)  NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  role         VARCHAR(255),
  org          VARCHAR(255),
  avatar_url   TEXT,
  linkedin_url VARCHAR(500),
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speakers_h ON page_speakers (hackathon_id, type);
CREATE INDEX IF NOT EXISTS idx_partners_h ON page_partners (hackathon_id);
CREATE INDEX IF NOT EXISTS idx_team_h     ON page_team     (hackathon_id);

-- Public endpoints will be added to API