-- HackFest Hub v4 — Run in Neon SQL Editor
DROP TABLE IF EXISTS registrations CASCADE;
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS hackathon_judges CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS feedbacks CASCADE;
DROP TABLE IF EXISTS criteria CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS judges CASCADE;
DROP TABLE IF EXISTS hackathons CASCADE;

CREATE TABLE hackathons (
  id VARCHAR(20) PRIMARY KEY, name VARCHAR(255) NOT NULL,
  start_date DATE, end_date DATE, location VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','completed')),
  description TEXT, tagline VARCHAR(255), prize_pool VARCHAR(100),
  max_teams INTEGER, tracks TEXT, published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE judges (
  id VARCHAR(20) PRIMARY KEY, name VARCHAR(255) NOT NULL,
  org VARCHAR(255), role VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE teams (
  id VARCHAR(20) PRIMARY KEY,
  hackathon_id VARCHAR(20) NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, project VARCHAR(255), category VARCHAR(100), members TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE criteria (
  id VARCHAR(20) PRIMARY KEY,
  hackathon_id VARCHAR(20) NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, description TEXT,
  max_score INTEGER NOT NULL DEFAULT 10, weight INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE feedbacks (
  id VARCHAR(20) PRIMARY KEY,
  hackathon_id VARCHAR(20) NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  team_id VARCHAR(20) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  judge_id VARCHAR(20) NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  scores JSONB NOT NULL DEFAULT '{}',
  comments JSONB NOT NULL DEFAULT '{}',
  overall TEXT,
  submission_number VARCHAR(100),
  demo_video_link VARCHAR(500),
  github_repo VARCHAR(500),
  live_project_link VARCHAR(500),
  ppts_photos VARCHAR(500),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hackathon_id, team_id, judge_id)
);

CREATE TABLE users (
  id VARCHAR(20) PRIMARY KEY, name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'judge' CHECK (role IN ('admin','judge')),
  judge_id VARCHAR(20) REFERENCES judges(id) ON DELETE SET NULL,
  oauth_provider VARCHAR(50), oauth_id VARCHAR(150), avatar_url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_users_oauth ON users(oauth_provider, oauth_id) WHERE oauth_provider IS NOT NULL;

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
  page VARCHAR(50) NOT NULL, granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, hackathon_id, page)
);

CREATE TABLE registrations (
  id VARCHAR(20) PRIMARY KEY,
  hackathon_id VARCHAR(20) NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL,
  org VARCHAR(255), type VARCHAR(20) NOT NULL DEFAULT 'team' CHECK (type IN ('team','judge')),
  team_name VARCHAR(255), team_size INTEGER, message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hackathon_id, email)
);

CREATE INDEX idx_teams_h ON teams(hackathon_id);
CREATE INDEX idx_crit_h ON criteria(hackathon_id);
CREATE INDEX idx_fb_h ON feedbacks(hackathon_id);
CREATE INDEX idx_fb_t ON feedbacks(team_id);
CREATE INDEX idx_fb_j ON feedbacks(judge_id);
CREATE INDEX idx_hj_u ON hackathon_judges(user_id);
CREATE INDEX idx_up_u ON user_permissions(user_id);
CREATE INDEX idx_reg_h ON registrations(hackathon_id);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_h BEFORE UPDATE ON hackathons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_j BEFORE UPDATE ON judges FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_t BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_c BEFORE UPDATE ON criteria FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_f BEFORE UPDATE ON feedbacks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_u BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO hackathons (id,name,start_date,end_date,location,status,description,tagline,prize_pool,tracks,published) VALUES
  ('h1','HackFest 2025','2025-05-01','2025-05-03','McKinney, TX','active',
   'Annual regional innovation hackathon for students and professionals.',
   'Build the future in 48 hours','$25,000 in prizes',
   'AI/ML,Sustainability,Security,Social Impact',true),
  ('h2','BuildIt Spring','2025-06-15','2025-06-16','Dallas, TX','upcoming',
   '48-hour developer tools hackathon.','Ship something real',
   '$10,000 in prizes','DevTools,Open Source,APIs',false);

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
  ('c1','h1','Innovation & Creativity','Originality, creative thinking, and novelty of the solution',10,30),
  ('c2','h1','Technical Implementation','Code quality, architecture, and complexity of implementation',10,25),
  ('c3','h1','Impact & Use Case','Real-world applicability, potential impact, and scalability',10,20),
  ('c4','h1','UI/UX & Design','User experience, interface design, and presentation quality',10,15),
  ('c5','h1','Demo Quality','Quality of demo, pitch clarity, and documentation',10,10);

-- admin: admin123
INSERT INTO users (id,name,email,password_hash,role) VALUES
  ('u1','Admin','admin@hackfest.com','$2a$10$s7Cl7w92p/ar5PGTpgX2iucVlhbezVO2rHoybJVnhPZq3XjaHgcjq','admin');
-- judges: judge123
INSERT INTO users (id,name,email,password_hash,role,judge_id) VALUES
  ('u2','Dr. Sarah Mitchell','sarah@hackfest.com','$2a$10$1/z/HjWHw1J1xksO6sGeJu0PmfqhFjAfWqhCIMePQQaUte/kynD5y','judge','j1'),
  ('u3','Srikanth R.','srikanth@hackfest.com','$2a$10$1/z/HjWHw1J1xksO6sGeJu0PmfqhFjAfWqhCIMePQQaUte/kynD5y','judge','j2'),
  ('u4','Priya Nair','priya@hackfest.com','$2a$10$1/z/HjWHw1J1xksO6sGeJu0PmfqhFjAfWqhCIMePQQaUte/kynD5y','judge','j3');

-- No default judge assignments — assign judges manually via User Management

INSERT INTO feedbacks (id,hackathon_id,team_id,judge_id,scores,comments,overall,submission_number,demo_video_link,github_repo,live_project_link) VALUES
  ('fb1','h1','t1','j1',
   '{"c1":9,"c2":8,"c3":9,"c4":7,"c5":8}',
   '{"c1":"Genuinely novel neural sync approach","c2":"Clean architecture","c3":"Strong healthcare potential","c4":"Good UI flow","c5":"Polished demo"}',
   'Impressive domain expertise. Strong contender.','SUB-001','https://youtube.com/demo1','https://github.com/team1/neurosync','NA'),
  ('fb2','h1','t1','j3',
   '{"c1":10,"c2":9,"c3":8,"c4":8,"c5":7}',
   '{"c1":"Best innovation today","c2":"Solid ML pipeline","c3":"B2B angle unlocks revenue","c4":"Compelling visuals","c5":"Good but rushed"}',
   'Top contender. Needs go-to-market polish.','SUB-001','NA','https://github.com/team1/neurosync','NA'),
  ('fb3','h1','t2','j2',
   '{"c1":7,"c2":8,"c3":9,"c4":8,"c5":9}',
   '{"c1":"Solid, not entirely novel","c2":"Good execution","c3":"Strong sustainability angle","c4":"Clean interface","c5":"Very clear pitch"}',
   'Practical and impactful. Well executed.','SUB-002','https://youtube.com/demo2','https://github.com/team2/greengrid','https://greengrid.demo.app');

INSERT INTO registrations (id,hackathon_id,name,email,org,type,team_name,team_size,message,status) VALUES
  ('r1','h1','Rahul Sharma','rahul@example.com','IIT Delhi','team','DataDriven',3,'Strong ML background and prior hackathon wins.','pending'),
  ('r2','h1','Emily Chen','emily@techco.com','TechCorp','judge','',0,'10 years in product innovation and venture.','approved');
