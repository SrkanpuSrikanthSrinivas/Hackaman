-- ============================================================
-- HackFest Hub — Neon PostgreSQL Schema v2 (with Auth)
-- ============================================================
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS hackathon_judges  CASCADE;
DROP TABLE IF EXISTS users             CASCADE;
DROP TABLE IF EXISTS feedbacks         CASCADE;
DROP TABLE IF EXISTS criteria          CASCADE;
DROP TABLE IF EXISTS teams             CASCADE;
DROP TABLE IF EXISTS judges            CASCADE;
DROP TABLE IF EXISTS hackathons        CASCADE;

CREATE TABLE hackathons (
  id VARCHAR(20) PRIMARY KEY, name VARCHAR(255) NOT NULL,
  start_date DATE, end_date DATE, location VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','completed')),
  description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE judges (
  id VARCHAR(20) PRIMARY KEY, name VARCHAR(255) NOT NULL, org VARCHAR(255), role VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE teams (
  id VARCHAR(20) PRIMARY KEY, hackathon_id VARCHAR(20) NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, project VARCHAR(255), category VARCHAR(100), members TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE criteria (
  id VARCHAR(20) PRIMARY KEY, hackathon_id VARCHAR(20) NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, description TEXT, max_score INTEGER NOT NULL DEFAULT 10,
  weight INTEGER NOT NULL DEFAULT 20, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE feedbacks (
  id VARCHAR(20) PRIMARY KEY,
  hackathon_id VARCHAR(20) NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  team_id VARCHAR(20) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  judge_id VARCHAR(20) NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  scores JSONB NOT NULL DEFAULT '{}', comments JSONB NOT NULL DEFAULT '{}', overall TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hackathon_id, team_id, judge_id)
);
CREATE TABLE users (
  id VARCHAR(20) PRIMARY KEY, name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'judge' CHECK (role IN ('admin','judge')),
  judge_id VARCHAR(20) REFERENCES judges(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE hackathon_judges (
  hackathon_id VARCHAR(20) NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  user_id VARCHAR(20) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (hackathon_id, user_id)
);
CREATE TABLE user_permissions (
  id VARCHAR(20) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hackathon_id VARCHAR(20) REFERENCES hackathons(id) ON DELETE CASCADE,
  page VARCHAR(50) NOT NULL, granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teams_hack      ON teams            (hackathon_id);
CREATE INDEX idx_criteria_hack   ON criteria         (hackathon_id);
CREATE INDEX idx_fb_hack         ON feedbacks        (hackathon_id);
CREATE INDEX idx_fb_team         ON feedbacks        (team_id);
CREATE INDEX idx_fb_judge        ON feedbacks        (judge_id);
CREATE INDEX idx_hj_user         ON hackathon_judges (user_id);
CREATE INDEX idx_up_user         ON user_permissions (user_id);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_h BEFORE UPDATE ON hackathons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_j BEFORE UPDATE ON judges     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_t BEFORE UPDATE ON teams      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_c BEFORE UPDATE ON criteria   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_f BEFORE UPDATE ON feedbacks  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_u BEFORE UPDATE ON users      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO hackathons (id,name,start_date,end_date,location,status,description) VALUES
  ('h1','HackFest 2025','2025-05-01','2025-05-03','McKinney, TX','active','Annual regional innovation hackathon.'),
  ('h2','BuildIt Spring','2025-06-15','2025-06-16','Dallas, TX','upcoming','48-hour developer tools hackathon.');
INSERT INTO judges (id,name,org,role) VALUES
  ('j1','Dr. Sarah Mitchell','Andreessen Horowitz','Partner'),
  ('j2','Srikanth R.','Caesars Digital','Senior Architect'),
  ('j3','Priya Nair','Google DeepMind','Research Lead');
INSERT INTO teams (id,hackathon_id,name,project,category,members) VALUES
  ('t1','h1','Jackson''s Team','NeuroSync AI','AI/ML','Jackson Lee, Priya Kumar, Alex Chen'),
  ('t2','h1','ByteWave','GreenGrid Protocol','Sustainability','Maria Santos, Dev Patel'),
  ('t3','h1','QuantumLeap','ZK-Auth Shield','Security','Ravi Gupta, Sofia Reyes'),
  ('t4','h1','HorizonX','CivicPulse Platform','Social Impact','Zoe Williams, Kai Nakamura');
INSERT INTO criteria (id,hackathon_id,name,description,max_score,weight) VALUES
  ('c1','h1','Innovation','Originality and creativity',10,25),
  ('c2','h1','Technical Depth','Quality of implementation',10,25),
  ('c3','h1','Impact','Real-world impact and scalability',10,20),
  ('c4','h1','Presentation','Clarity and delivery',10,15),
  ('c5','h1','Feasibility','Realistic path to market',10,15);
-- admin123
INSERT INTO users (id,name,email,password_hash,role) VALUES
  ('u1','Admin','admin@hackfest.com','$2b$10$BubsZXTlkwWzXmsz2EZYwemAK.T4O2h6rmcfUml3ySg2ttqO3GuSi','admin');
-- judge123
INSERT INTO users (id,name,email,password_hash,role,judge_id) VALUES
  ('u2','Dr. Sarah Mitchell','sarah@hackfest.com','$2b$10$3p1.Iuf9PzpD7F2XBvHeeuBkWKVWThwAxS.XtmyiOsjNjBwY4vj7i','judge','j1'),
  ('u3','Srikanth R.','srikanth@hackfest.com','$2b$10$3p1.Iuf9PzpD7F2XBvHeeuBkWKVWThwAxS.XtmyiOsjNjBwY4vj7i','judge','j2'),
  ('u4','Priya Nair','priya@hackfest.com','$2b$10$3p1.Iuf9PzpD7F2XBvHeeuBkWKVWThwAxS.XtmyiOsjNjBwY4vj7i','judge','j3');
INSERT INTO hackathon_judges (hackathon_id,user_id) VALUES ('h1','u2'),('h1','u3'),('h1','u4');
INSERT INTO feedbacks (id,hackathon_id,team_id,judge_id,scores,comments,overall,submitted_at) VALUES
  ('fb1','h1','t1','j1','{"c1":9,"c2":8,"c3":9,"c4":7,"c5":8}','{"c1":"Novel approach.","c2":"Clean architecture.","c3":"Strong healthcare potential.","c4":"Good narrative.","c5":"Clear roadmap."}','Impressive domain expertise.','2025-05-01 09:15:00'),
  ('fb2','h1','t1','j3','{"c1":10,"c2":9,"c3":8,"c4":8,"c5":7}','{"c1":"Best innovation today.","c2":"Solid ML pipeline.","c3":"B2B angle unlocks revenue.","c4":"Compelling demo.","c5":"Regulatory path needs work."}','Top contender.','2025-05-01 10:30:00'),
  ('fb3','h1','t2','j2','{"c1":7,"c2":8,"c3":9,"c4":8,"c5":9}','{"c1":"Solid, not entirely novel.","c2":"Good execution.","c3":"Strong sustainability angle.","c4":"Clear pitch.","c5":"Achievable milestones."}','Practical and impactful.','2025-05-01 11:00:00');
