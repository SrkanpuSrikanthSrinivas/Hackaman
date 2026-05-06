-- ============================================================
-- HackFest Hub — Neon PostgreSQL Schema
-- Run this in your Neon SQL Editor to set up the database
-- ============================================================

-- Drop existing tables (safe re-run)
DROP TABLE IF EXISTS feedbacks   CASCADE;
DROP TABLE IF EXISTS criteria    CASCADE;
DROP TABLE IF EXISTS teams       CASCADE;
DROP TABLE IF EXISTS judges      CASCADE;
DROP TABLE IF EXISTS hackathons  CASCADE;

-- ── HACKATHONS ───────────────────────────────────────────────
CREATE TABLE hackathons (
  id           VARCHAR(20)  PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  start_date   DATE,
  end_date     DATE,
  location     VARCHAR(255),
  status       VARCHAR(20)  NOT NULL DEFAULT 'upcoming'
                            CHECK (status IN ('upcoming','active','completed')),
  description  TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── JUDGES ───────────────────────────────────────────────────
CREATE TABLE judges (
  id          VARCHAR(20)  PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  org         VARCHAR(255),
  role        VARCHAR(255),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── TEAMS ────────────────────────────────────────────────────
CREATE TABLE teams (
  id            VARCHAR(20)  PRIMARY KEY,
  hackathon_id  VARCHAR(20)  NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  project       VARCHAR(255),
  category      VARCHAR(100),
  members       TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── CRITERIA ─────────────────────────────────────────────────
CREATE TABLE criteria (
  id            VARCHAR(20)  PRIMARY KEY,
  hackathon_id  VARCHAR(20)  NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  max_score     INTEGER      NOT NULL DEFAULT 10,
  weight        INTEGER      NOT NULL DEFAULT 20,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── FEEDBACKS ────────────────────────────────────────────────
CREATE TABLE feedbacks (
  id            VARCHAR(20)  PRIMARY KEY,
  hackathon_id  VARCHAR(20)  NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  team_id       VARCHAR(20)  NOT NULL REFERENCES teams(id)      ON DELETE CASCADE,
  judge_id      VARCHAR(20)  NOT NULL REFERENCES judges(id)     ON DELETE CASCADE,
  scores        JSONB        NOT NULL DEFAULT '{}',
  comments      JSONB        NOT NULL DEFAULT '{}',
  overall       TEXT,
  submitted_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (hackathon_id, team_id, judge_id)
);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX idx_teams_hackathon     ON teams     (hackathon_id);
CREATE INDEX idx_criteria_hackathon  ON criteria  (hackathon_id);
CREATE INDEX idx_feedbacks_hackathon ON feedbacks (hackathon_id);
CREATE INDEX idx_feedbacks_team      ON feedbacks (team_id);
CREATE INDEX idx_feedbacks_judge     ON feedbacks (judge_id);

-- ── UPDATED_AT TRIGGER ───────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_hackathons_updated  BEFORE UPDATE ON hackathons  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_judges_updated      BEFORE UPDATE ON judges      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_teams_updated       BEFORE UPDATE ON teams       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_criteria_updated    BEFORE UPDATE ON criteria     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_feedbacks_updated   BEFORE UPDATE ON feedbacks   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── SEED DATA ────────────────────────────────────────────────
INSERT INTO hackathons (id, name, start_date, end_date, location, status, description) VALUES
  ('h1', 'HackFest 2025',    '2025-05-01', '2025-05-03', 'McKinney, TX', 'active',    'Annual regional innovation hackathon for students and professionals.'),
  ('h2', 'BuildIt Spring',   '2025-06-15', '2025-06-16', 'Dallas, TX',   'upcoming',  '48-hour developer tools hackathon.');

INSERT INTO judges (id, name, org, role) VALUES
  ('j1', 'Dr. Sarah Mitchell', 'Andreessen Horowitz', 'Partner'),
  ('j2', 'Srikanth R.',        'Caesars Digital',     'Senior Architect'),
  ('j3', 'Priya Nair',         'Google DeepMind',     'Research Lead');

INSERT INTO teams (id, hackathon_id, name, project, category, members) VALUES
  ('t1', 'h1', 'Jackson''s Team', 'NeuroSync AI',         'AI/ML',         'Jackson Lee, Priya Kumar, Alex Chen'),
  ('t2', 'h1', 'ByteWave',        'GreenGrid Protocol',   'Sustainability', 'Maria Santos, Dev Patel'),
  ('t3', 'h1', 'QuantumLeap',     'ZK-Auth Shield',       'Security',       'Ravi Gupta, Sofia Reyes'),
  ('t4', 'h1', 'HorizonX',        'CivicPulse Platform',  'Social Impact',  'Zoe Williams, Kai Nakamura');

INSERT INTO criteria (id, hackathon_id, name, description, max_score, weight) VALUES
  ('c1', 'h1', 'Innovation',      'Originality and creativity of the solution',          10, 25),
  ('c2', 'h1', 'Technical Depth', 'Quality of implementation and technical complexity',  10, 25),
  ('c3', 'h1', 'Impact',          'Potential real-world impact and scalability',          10, 20),
  ('c4', 'h1', 'Presentation',    'Clarity, structure, and delivery of pitch',            10, 15),
  ('c5', 'h1', 'Feasibility',     'Realistic path to market or deployment',               10, 15);

INSERT INTO feedbacks (id, hackathon_id, team_id, judge_id, scores, comments, overall, submitted_at) VALUES
  ('fb1', 'h1', 't1', 'j1',
    '{"c1":9,"c2":8,"c3":9,"c4":7,"c5":8}',
    '{"c1":"Novel approach to neural sync latency.","c2":"Clean, well-abstracted architecture.","c3":"Strong healthcare market potential.","c4":"Good narrative, demo felt rushed.","c5":"Clear MVP roadmap presented."}',
    'Impressive domain expertise. Strong contender for top spot.',
    '2025-05-01 09:15:00'),
  ('fb2', 'h1', 't1', 'j3',
    '{"c1":10,"c2":9,"c3":8,"c4":8,"c5":7}',
    '{"c1":"Best innovation I saw today.","c2":"Solid ML pipeline and model choices.","c3":"B2B angle could unlock faster revenue.","c4":"Demo was compelling.","c5":"Regulatory path needs more thought."}',
    'Top contender. Needs go-to-market polish.',
    '2025-05-01 10:30:00'),
  ('fb3', 'h1', 't2', 'j2',
    '{"c1":7,"c2":8,"c3":9,"c4":8,"c5":9}',
    '{"c1":"Solid idea, not entirely novel.","c2":"Good technical execution.","c3":"Strong sustainability angle.","c4":"Clear and concise pitch.","c5":"Achievable deployment milestones."}',
    'Practical and impactful. Well-executed pitch.',
    '2025-05-01 11:00:00');
