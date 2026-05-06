require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const fetch    = require("node-fetch");
const { Pool } = require("pg");

const JWT_SECRET   = process.env.JWT_SECRET || "hackfest-dev-secret";
const FRONTEND_URL = process.env.FRONTEND_URL || "";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });
async function q(sql, p = []) {
  const client = await pool.connect();
  try { return await client.query(sql, p); } finally { client.release(); }
}
const toCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
function camel(row) {
  if (!row) return null;
  const o = {};
  for (const [k, v] of Object.entries(row)) o[toCamel(k)] = v;
  return o;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

async function buildUserPayload(user) {
  const { rows: hj }    = await q("SELECT hackathon_id FROM hackathon_judges WHERE user_id=$1", [user.id]);
  const { rows: perms } = await q("SELECT hackathon_id, page FROM user_permissions WHERE user_id=$1", [user.id]);
  return {
    id: user.id, name: user.name, email: user.email,
    role: user.role, judgeId: user.judge_id, avatarUrl: user.avatar_url,
    assignedHackathons: hj.map(r => r.hackathon_id),
    permissions: perms.map(r => ({ hackathonId: r.hackathon_id, page: r.page })),
  };
}

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "*", credentials: true }));
app.use(express.json());

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid or expired token" }); }
}
function admin(req, res, next) {
  auth(req, res, () => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    next();
  });
}

// ─── HEALTH ──────────────────────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  try { const { rows } = await q("SELECT NOW() AS t"); res.json({ status: "ok", db: "connected", time: rows[0].t }); }
  catch (e) { res.status(503).json({ status: "error", message: e.message }); }
});

// ─── AUTH: EMAIL ─────────────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  try {
    const { rows } = await q("SELECT * FROM users WHERE email=$1", [email.toLowerCase().trim()]);
    const user = rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: "Invalid email or password" });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });
    const payload = await buildUserPayload(user);
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
    res.json({ token, user: payload });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/auth/me", auth, async (req, res) => {
  try {
    const { rows } = await q("SELECT * FROM users WHERE id=$1", [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(await buildUserPayload(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── OAUTH UPSERT ─────────────────────────────────────────────────────────────
async function upsertOAuth(provider, oauthId, name, email, avatarUrl) {
  // 1. match by oauth
  const { rows: byOauth } = await q(
    "SELECT * FROM users WHERE oauth_provider=$1 AND oauth_id=$2", [provider, String(oauthId)]
  );
  if (byOauth[0]) {
    await q("UPDATE users SET avatar_url=$1 WHERE id=$2", [avatarUrl, byOauth[0].id]);
    return { ...byOauth[0], avatar_url: avatarUrl };
  }
  // 2. match by email
  if (email) {
    const { rows: byEmail } = await q("SELECT * FROM users WHERE email=$1", [email.toLowerCase()]);
    if (byEmail[0]) {
      const { rows } = await q(
        "UPDATE users SET oauth_provider=$1,oauth_id=$2,avatar_url=$3 WHERE id=$4 RETURNING *",
        [provider, String(oauthId), avatarUrl, byEmail[0].id]
      );
      return rows[0];
    }
  }
  // 3. create new judge account
  const { rows } = await q(
    "INSERT INTO users (id,name,email,role,oauth_provider,oauth_id,avatar_url) VALUES ($1,$2,$3,'judge',$4,$5,$6) RETURNING *",
    [uid(), name || "User", email || `${oauthId}@${provider}.oauth`, provider, String(oauthId), avatarUrl]
  );
  return rows[0];
}

function oauthCallback(token) {
  return `${FRONTEND_URL}/?token=${encodeURIComponent(token)}`;
}

// ─── GITHUB OAUTH ─────────────────────────────────────────────────────────────
app.get("/api/auth/github", (req, res) => {
  if (!process.env.GITHUB_CLIENT_ID) return res.status(503).json({ error: "GitHub OAuth not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET env vars." });
  const state = jwt.sign({ n: uid() }, JWT_SECRET, { expiresIn: "10m" });
  const u = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user:email&state=${encodeURIComponent(state)}`;
  res.redirect(u);
});

app.get("/api/auth/github/callback", async (req, res) => {
  try {
    jwt.verify(req.query.state, JWT_SECRET);
    const tr = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code: req.query.code }),
    });
    const { access_token } = await tr.json();
    const [ur, er] = await Promise.all([
      fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${access_token}` } }),
      fetch("https://api.github.com/user/emails", { headers: { Authorization: `Bearer ${access_token}` } }),
    ]);
    const ghUser = await ur.json();
    const emails = await er.json();
    const email = (Array.isArray(emails) ? emails.find(e => e.primary)?.email : null) || ghUser.email;
    const user = await upsertOAuth("github", ghUser.id, ghUser.name || ghUser.login, email, ghUser.avatar_url);
    const payload = await buildUserPayload(user);
    res.redirect(oauthCallback(jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" })));
  } catch (e) { console.error("GitHub OAuth:", e.message); res.redirect(`${FRONTEND_URL}/?error=oauth_failed`); }
});

// ─── GOOGLE OAUTH ─────────────────────────────────────────────────────────────
app.get("/api/auth/google", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: "Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars." });
  const state = jwt.sign({ n: uid() }, JWT_SECRET, { expiresIn: "10m" });
  const cb = `${FRONTEND_URL}/api/auth/google/callback`;
  const p = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, response_type: "code", scope: "openid email profile", redirect_uri: cb, state });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
});

app.get("/api/auth/google/callback", async (req, res) => {
  try {
    jwt.verify(req.query.state, JWT_SECRET);
    const cb = `${FRONTEND_URL}/api/auth/google/callback`;
    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: req.query.code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: cb, grant_type: "authorization_code" }),
    });
    const { access_token } = await tr.json();
    const ur = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
    const g = await ur.json();
    const user = await upsertOAuth("google", g.sub, g.name, g.email, g.picture);
    const payload = await buildUserPayload(user);
    res.redirect(oauthCallback(jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" })));
  } catch (e) { console.error("Google OAuth:", e.message); res.redirect(`${FRONTEND_URL}/?error=oauth_failed`); }
});

// ─── GITLAB OAUTH ─────────────────────────────────────────────────────────────
app.get("/api/auth/gitlab", (req, res) => {
  if (!process.env.GITLAB_CLIENT_ID) return res.status(503).json({ error: "GitLab OAuth not configured. Add GITLAB_CLIENT_ID and GITLAB_CLIENT_SECRET env vars." });
  const state = jwt.sign({ n: uid() }, JWT_SECRET, { expiresIn: "10m" });
  const cb = `${FRONTEND_URL}/api/auth/gitlab/callback`;
  const p = new URLSearchParams({ client_id: process.env.GITLAB_CLIENT_ID, response_type: "code", scope: "read_user email", redirect_uri: cb, state });
  res.redirect(`https://gitlab.com/oauth/authorize?${p}`);
});

app.get("/api/auth/gitlab/callback", async (req, res) => {
  try {
    jwt.verify(req.query.state, JWT_SECRET);
    const cb = `${FRONTEND_URL}/api/auth/gitlab/callback`;
    const tr = await fetch("https://gitlab.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: req.query.code, client_id: process.env.GITLAB_CLIENT_ID, client_secret: process.env.GITLAB_CLIENT_SECRET, redirect_uri: cb, grant_type: "authorization_code" }),
    });
    const { access_token } = await tr.json();
    const ur = await fetch("https://gitlab.com/api/v4/user", { headers: { Authorization: `Bearer ${access_token}` } });
    const g = await ur.json();
    const user = await upsertOAuth("gitlab", g.id, g.name, g.email, g.avatar_url);
    const payload = await buildUserPayload(user);
    res.redirect(oauthCallback(jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" })));
  } catch (e) { console.error("GitLab OAuth:", e.message); res.redirect(`${FRONTEND_URL}/?error=oauth_failed`); }
});

// ─── USERS ────────────────────────────────────────────────────────────────────
app.get("/api/users", admin, async (_req, res) => {
  try {
    const { rows: users } = await q("SELECT id,name,email,role,judge_id,avatar_url,oauth_provider,created_at FROM users ORDER BY role,name");
    const { rows: hj }    = await q("SELECT user_id,hackathon_id FROM hackathon_judges");
    const { rows: perms } = await q("SELECT id,user_id,hackathon_id,page FROM user_permissions");
    res.json(users.map(u => ({
      ...camel(u),
      assignedHackathons: hj.filter(r => r.user_id === u.id).map(r => r.hackathon_id),
      permissions: perms.filter(r => r.user_id === u.id).map(r => ({ id: r.id, hackathonId: r.hackathon_id, page: r.page })),
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/users", admin, async (req, res) => {
  const { name, email, password, role = "judge", judgeId } = req.body;
  if (!name?.trim() || !email?.trim() || !password?.trim()) return res.status(400).json({ error: "name, email, and password required" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await q(
      "INSERT INTO users (id,name,email,password_hash,role,judge_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,email,role,judge_id",
      [uid(), name, email.toLowerCase(), hash, role, judgeId || null]
    );
    res.status(201).json({ ...camel(rows[0]), assignedHackathons: [], permissions: [] });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Email already in use" });
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/users/:id", admin, async (req, res) => {
  const { name, email, password, role, judgeId } = req.body;
  try {
    const params = password
      ? [name, email.toLowerCase(), await bcrypt.hash(password, 10), role, judgeId || null, req.params.id]
      : [name, email.toLowerCase(), role, judgeId || null, req.params.id];
    const sql = password
      ? "UPDATE users SET name=$1,email=$2,password_hash=$3,role=$4,judge_id=$5 WHERE id=$6 RETURNING id,name,email,role,judge_id"
      : "UPDATE users SET name=$1,email=$2,role=$3,judge_id=$4 WHERE id=$5 RETURNING id,name,email,role,judge_id";
    const { rows } = await q(sql, params);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(camel(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/users/:id", admin, async (req, res) => {
  try { await q("DELETE FROM users WHERE id=$1", [req.params.id]); res.json({ deleted: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────
// FIX: explicit validation + clear error messages so the root cause is visible
app.post("/api/assignments", admin, async (req, res) => {
  const { hackathonId, userId } = req.body;
  if (!hackathonId || !userId) return res.status(400).json({ error: "hackathonId and userId are both required" });
  try {
    // Verify both records exist before inserting
    const { rows: hRows } = await q("SELECT id FROM hackathons WHERE id=$1", [hackathonId]);
    if (!hRows.length) return res.status(404).json({ error: `Hackathon '${hackathonId}' not found` });
    const { rows: uRows } = await q("SELECT id FROM users WHERE id=$1", [userId]);
    if (!uRows.length) return res.status(404).json({ error: `User '${userId}' not found` });
    await q(
      "INSERT INTO hackathon_judges (hackathon_id, user_id) VALUES ($1, $2) ON CONFLICT (hackathon_id, user_id) DO NOTHING",
      [hackathonId, userId]
    );
    res.status(201).json({ assigned: true });
  } catch (e) {
    console.error("Assignment error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/assignments/:hackathonId/:userId", admin, async (req, res) => {
  try {
    await q("DELETE FROM hackathon_judges WHERE hackathon_id=$1 AND user_id=$2", [req.params.hackathonId, req.params.userId]);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PERMISSIONS ──────────────────────────────────────────────────────────────
app.post("/api/permissions", admin, async (req, res) => {
  const { userId, hackathonId, page } = req.body;
  if (!userId || !page) return res.status(400).json({ error: "userId and page required" });
  try {
    const { rows } = await q(
      "INSERT INTO user_permissions (id,user_id,hackathon_id,page) VALUES ($1,$2,$3,$4) ON CONFLICT(user_id,hackathon_id,page) DO NOTHING RETURNING *",
      [uid(), userId, hackathonId || null, page]
    );
    res.status(201).json(rows[0] ? camel(rows[0]) : { skipped: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/permissions/:id", admin, async (req, res) => {
  try { await q("DELETE FROM user_permissions WHERE id=$1", [req.params.id]); res.json({ deleted: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── HACKATHONS ───────────────────────────────────────────────────────────────
app.get("/api/hackathons", auth, async (req, res) => {
  try {
    const { rows } = await q("SELECT * FROM hackathons ORDER BY start_date DESC");
    const all = rows.map(camel);
    if (req.user.role === "judge") {
      const ok = new Set(req.user.assignedHackathons || []);
      return res.json(all.filter(h => ok.has(h.id)));
    }
    res.json(all);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/hackathons", admin, async (req, res) => {
  const { name, startDate, endDate, location, status = "upcoming", description, tagline, prizePool, maxTeams, tracks, published = false } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  try {
    const { rows } = await q(
      "INSERT INTO hackathons (id,name,start_date,end_date,location,status,description,tagline,prize_pool,max_teams,tracks,published) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
      [uid(), name, startDate || null, endDate || null, location, status, description, tagline, prizePool, maxTeams || null, tracks, Boolean(published)]
    );
    res.status(201).json(camel(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/hackathons/:id", admin, async (req, res) => {
  const { name, startDate, endDate, location, status, description, tagline, prizePool, maxTeams, tracks, published } = req.body;
  try {
    const { rows } = await q(
      "UPDATE hackathons SET name=$1,start_date=$2,end_date=$3,location=$4,status=$5,description=$6,tagline=$7,prize_pool=$8,max_teams=$9,tracks=$10,published=$11 WHERE id=$12 RETURNING *",
      [name, startDate || null, endDate || null, location, status, description, tagline, prizePool, maxTeams || null, tracks, Boolean(published), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(camel(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/hackathons/:id", admin, async (req, res) => {
  try { await q("DELETE FROM hackathons WHERE id=$1", [req.params.id]); res.json({ deleted: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── JUDGES / TEAMS / CRITERIA (standard CRUD) ───────────────────────────────
app.get("/api/judges", auth, async (_req, res) => {
  try { const { rows } = await q("SELECT * FROM judges ORDER BY name"); res.json(rows.map(camel)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/judges", admin, async (req, res) => {
  const { name, org, role } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  try { const { rows } = await q("INSERT INTO judges (id,name,org,role) VALUES ($1,$2,$3,$4) RETURNING *", [uid(), name, org, role]); res.status(201).json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/judges/:id", admin, async (req, res) => {
  const { name, org, role } = req.body;
  try { const { rows } = await q("UPDATE judges SET name=$1,org=$2,role=$3 WHERE id=$4 RETURNING *", [name, org, role, req.params.id]); if (!rows.length) return res.status(404).json({ error: "Not found" }); res.json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/judges/:id", admin, async (req, res) => {
  try { await q("DELETE FROM judges WHERE id=$1", [req.params.id]); res.json({ deleted: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/teams", auth, async (req, res) => {
  try { const { hackathonId } = req.query; const { rows } = hackathonId ? await q("SELECT * FROM teams WHERE hackathon_id=$1 ORDER BY name", [hackathonId]) : await q("SELECT * FROM teams ORDER BY name"); res.json(rows.map(camel)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/teams", admin, async (req, res) => {
  const { hackathonId, name, project, category, members } = req.body;
  if (!name?.trim() || !hackathonId?.trim()) return res.status(400).json({ error: "name and hackathonId required" });
  try { const { rows } = await q("INSERT INTO teams (id,hackathon_id,name,project,category,members) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [uid(), hackathonId, name, project, category, members]); res.status(201).json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/teams/:id", admin, async (req, res) => {
  const { name, project, category, members } = req.body;
  try { const { rows } = await q("UPDATE teams SET name=$1,project=$2,category=$3,members=$4 WHERE id=$5 RETURNING *", [name, project, category, members, req.params.id]); if (!rows.length) return res.status(404).json({ error: "Not found" }); res.json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/teams/:id", admin, async (req, res) => {
  try { await q("DELETE FROM teams WHERE id=$1", [req.params.id]); res.json({ deleted: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/criteria", auth, async (req, res) => {
  try { const { hackathonId } = req.query; const { rows } = hackathonId ? await q("SELECT * FROM criteria WHERE hackathon_id=$1 ORDER BY weight DESC", [hackathonId]) : await q("SELECT * FROM criteria ORDER BY weight DESC"); res.json(rows.map(camel)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/criteria", admin, async (req, res) => {
  const { hackathonId, name, description, maxScore = 10, weight = 20 } = req.body;
  if (!name?.trim() || !hackathonId?.trim()) return res.status(400).json({ error: "name and hackathonId required" });
  try { const { rows } = await q("INSERT INTO criteria (id,hackathon_id,name,description,max_score,weight) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [uid(), hackathonId, name, description, Number(maxScore), Number(weight)]); res.status(201).json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/criteria/:id", admin, async (req, res) => {
  const { name, description, maxScore, weight } = req.body;
  try { const { rows } = await q("UPDATE criteria SET name=$1,description=$2,max_score=$3,weight=$4 WHERE id=$5 RETURNING *", [name, description, Number(maxScore), Number(weight), req.params.id]); if (!rows.length) return res.status(404).json({ error: "Not found" }); res.json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/criteria/:id", admin, async (req, res) => {
  try { await q("DELETE FROM criteria WHERE id=$1", [req.params.id]); res.json({ deleted: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FEEDBACKS (with extra metadata fields) ───────────────────────────────────
app.get("/api/feedbacks", auth, async (req, res) => {
  try { const { hackathonId } = req.query; const { rows } = hackathonId ? await q("SELECT * FROM feedbacks WHERE hackathon_id=$1 ORDER BY submitted_at DESC", [hackathonId]) : await q("SELECT * FROM feedbacks ORDER BY submitted_at DESC"); res.json(rows.map(camel)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/feedbacks", auth, async (req, res) => {
  const { hackathonId, teamId, judgeId, scores, comments, overall,
          submissionNumber, demoVideoLink, githubRepo, liveProjectLink, pptsPhotos } = req.body;
  if (!hackathonId || !teamId || !judgeId) return res.status(400).json({ error: "hackathonId, teamId, judgeId required" });
  if (req.user.role === "judge" && !req.user.assignedHackathons?.includes(hackathonId))
    return res.status(403).json({ error: "Not assigned to this hackathon" });
  try {
    const { rows } = await q(
      `INSERT INTO feedbacks
         (id,hackathon_id,team_id,judge_id,scores,comments,overall,
          submission_number,demo_video_link,github_repo,live_project_link,ppts_photos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (hackathon_id,team_id,judge_id)
       DO UPDATE SET scores=$5,comments=$6,overall=$7,
          submission_number=$8,demo_video_link=$9,github_repo=$10,
          live_project_link=$11,ppts_photos=$12,submitted_at=NOW()
       RETURNING *`,
      [uid(), hackathonId, teamId, judgeId,
       JSON.stringify(scores || {}), JSON.stringify(comments || {}), overall,
       submissionNumber || null, demoVideoLink || null, githubRepo || null,
       liveProjectLink || null, pptsPhotos || null]
    );
    res.status(201).json(camel(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/feedbacks/:id", admin, async (req, res) => {
  try { await q("DELETE FROM feedbacks WHERE id=$1", [req.params.id]); res.json({ deleted: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PUBLIC ENDPOINTS ─────────────────────────────────────────────────────────
app.get("/api/public/hackathons", async (_req, res) => {
  try { const { rows } = await q("SELECT * FROM hackathons WHERE published=true ORDER BY start_date DESC"); res.json(rows.map(camel)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get("/api/public/hackathons/:id", async (req, res) => {
  try { const { rows } = await q("SELECT * FROM hackathons WHERE id=$1 AND published=true", [req.params.id]); if (!rows.length) return res.status(404).json({ error: "Not found" }); res.json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/public/register", async (req, res) => {
  const { hackathonId, name, email, org, type, teamName, teamSize, message } = req.body;
  if (!hackathonId || !name?.trim() || !email?.trim()) return res.status(400).json({ error: "hackathonId, name, email required" });
  try {
    const { rows: hack } = await q("SELECT id FROM hackathons WHERE id=$1 AND published=true", [hackathonId]);
    if (!hack.length) return res.status(404).json({ error: "Hackathon not found or not open" });
    const { rows } = await q(
      `INSERT INTO registrations (id,hackathon_id,name,email,org,type,team_name,team_size,message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (hackathon_id,email) DO UPDATE SET name=$3,org=$4,type=$6,team_name=$7,team_size=$8,message=$9
       RETURNING *`,
      [uid(), hackathonId, name, email.toLowerCase(), org, type || "team", teamName, teamSize || null, message]
    );
    res.status(201).json(camel(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── REGISTRATIONS ────────────────────────────────────────────────────────────
app.get("/api/registrations", admin, async (req, res) => {
  try { const { hackathonId } = req.query; const { rows } = hackathonId ? await q("SELECT * FROM registrations WHERE hackathon_id=$1 ORDER BY created_at DESC", [hackathonId]) : await q("SELECT * FROM registrations ORDER BY created_at DESC"); res.json(rows.map(camel)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/registrations/:id", admin, async (req, res) => {
  try { const { rows } = await q("UPDATE registrations SET status=$1 WHERE id=$2 RETURNING *", [req.body.status, req.params.id]); if (!rows.length) return res.status(404).json({ error: "Not found" }); res.json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/registrations/:id", admin, async (req, res) => {
  try { await q("DELETE FROM registrations WHERE id=$1", [req.params.id]); res.json({ deleted: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: "Internal server error" }); });

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`\n  HackFest API → http://localhost:${PORT}\n`));
}
module.exports = app;
