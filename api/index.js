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
  const { rows: jta }   = await q("SELECT team_id, hackathon_id FROM judge_team_assignments WHERE user_id=$1", [user.id]).catch(()=>({rows:[]}));
  return {
    id: user.id, name: user.name, email: user.email,
    role: user.role, judgeId: user.judge_id, avatarUrl: user.avatar_url,
    assignedHackathons: hj.map(r => r.hackathon_id),
    permissions: perms.map(r => ({ hackathonId: r.hackathon_id, page: r.page })),
    assignedTeams: jta.map(r => r.team_id),
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
app.get(["/api/health", "/health"], async (_req, res) => {
  try { const { rows } = await q("SELECT NOW() AS t"); res.json({ status: "ok", db: "connected", time: rows[0].t }); }
  catch (e) { res.status(503).json({ status: "error", message: e.message }); }
});

// Diagnostic — call /api/debug/routes to see registered routes + what path Vercel sends
app.get(["/api/debug/routes", "/debug/routes"], (req, res) => {
  const routes = [];
  app._router.stack.forEach(r => {
    if (r.route) routes.push(`${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`);
  });
  res.json({ version: "v6", routeCount: routes.length,
    receivedUrl: req.url, receivedPath: req.path,
    receivedOriginalUrl: req.originalUrl, routes });
});

// ─── AUTH: EMAIL ─────────────────────────────────────────────────────────────
app.post(["/api/auth/login", "/auth/login"], async (req, res) => {
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

app.get(["/api/auth/me", "/auth/me"], auth, async (req, res) => {
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
app.get(["/api/auth/github", "/auth/github"], (req, res) => {
  if (!process.env.GITHUB_CLIENT_ID) return res.status(503).json({ error: "GitHub OAuth not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET env vars." });
  const state = jwt.sign({ n: uid() }, JWT_SECRET, { expiresIn: "10m" });
  const u = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user:email&state=${encodeURIComponent(state)}`;
  res.redirect(u);
});

app.get(["/api/auth/github/callback", "/auth/github/callback"], async (req, res) => {
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
app.get(["/api/auth/google", "/auth/google"], (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: "Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars." });
  const state = jwt.sign({ n: uid() }, JWT_SECRET, { expiresIn: "10m" });
  const cb = `${FRONTEND_URL}/api/auth/google/callback`;
  const p = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, response_type: "code", scope: "openid email profile", redirect_uri: cb, state });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
});

app.get(["/api/auth/google/callback", "/auth/google/callback"], async (req, res) => {
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
app.get(["/api/auth/gitlab", "/auth/gitlab"], (req, res) => {
  if (!process.env.GITLAB_CLIENT_ID) return res.status(503).json({ error: "GitLab OAuth not configured. Add GITLAB_CLIENT_ID and GITLAB_CLIENT_SECRET env vars." });
  const state = jwt.sign({ n: uid() }, JWT_SECRET, { expiresIn: "10m" });
  const cb = `${FRONTEND_URL}/api/auth/gitlab/callback`;
  const p = new URLSearchParams({ client_id: process.env.GITLAB_CLIENT_ID, response_type: "code", scope: "read_user email", redirect_uri: cb, state });
  res.redirect(`https://gitlab.com/oauth/authorize?${p}`);
});

app.get(["/api/auth/gitlab/callback", "/auth/gitlab/callback"], async (req, res) => {
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
app.get(["/api/users", "/users"], admin, async (_req, res) => {
  try {
    const { rows: users } = await q("SELECT id,name,email,role,judge_id,avatar_url,oauth_provider,created_at FROM users ORDER BY role,name");
    const { rows: hj }    = await q("SELECT user_id,hackathon_id FROM hackathon_judges");
    const { rows: perms } = await q("SELECT id,user_id,hackathon_id,page FROM user_permissions");
    // Include team assignments — graceful if migration_v6 hasn't been run yet
    let jta = [];
    try { const r = await q("SELECT user_id,team_id FROM judge_team_assignments"); jta = r.rows; } catch(_){}
    res.json(users.map(u => ({
      ...camel(u),
      assignedHackathons: hj.filter(r => r.user_id === u.id).map(r => r.hackathon_id),
      permissions:        perms.filter(r => r.user_id === u.id).map(r => ({ id: r.id, hackathonId: r.hackathon_id, page: r.page })),
      assignedTeams:      jta.filter(r => r.user_id === u.id).map(r => r.team_id),
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post(["/api/users", "/users"], admin, async (req, res) => {
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

app.put(["/api/users/:id", "/users/:id"], admin, async (req, res) => {
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

app.delete(["/api/users/:id", "/users/:id"], admin, async (req, res) => {
  try { await q("DELETE FROM users WHERE id=$1", [req.params.id]); res.json({ deleted: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────
// FIX: explicit validation + clear error messages so the root cause is visible
app.post(["/api/assignments", "/assignments"], admin, async (req, res) => {
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

app.delete(["/api/assignments/:hackathonId/:userId", "/assignments/:hackathonId/:userId"], admin, async (req, res) => {
  try {
    await q("DELETE FROM hackathon_judges WHERE hackathon_id=$1 AND user_id=$2", [req.params.hackathonId, req.params.userId]);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PERMISSIONS ──────────────────────────────────────────────────────────────
app.post(["/api/permissions", "/permissions"], admin, async (req, res) => {
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

app.delete(["/api/permissions/:id", "/permissions/:id"], admin, async (req, res) => {
  try { await q("DELETE FROM user_permissions WHERE id=$1", [req.params.id]); res.json({ deleted: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── HACKATHONS ───────────────────────────────────────────────────────────────
app.get(["/api/hackathons", "/hackathons"], auth, async (req, res) => {
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

app.post(["/api/hackathons", "/hackathons"], admin, async (req, res) => {
  const { name, startDate, endDate, location, status = "upcoming", description, tagline, prizePool, maxTeams, tracks, published = false, bannerColor, sponsors, schedule, faq } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  try {
    const { rows } = await q(
      "INSERT INTO hackathons (id,name,start_date,end_date,location,status,description,tagline,prize_pool,max_teams,tracks,published,banner_color,sponsors,schedule,faq) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *",
      [uid(), name, startDate || null, endDate || null, location, status, description, tagline, prizePool, maxTeams || null, tracks, Boolean(published), bannerColor||'#1e3a8a', sponsors||null, schedule||null, faq||null]
    );
    res.status(201).json(camel(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put(["/api/hackathons/:id", "/hackathons/:id"], admin, async (req, res) => {
  const {
    name, startDate, endDate, location, status, description, tagline,
    prizePool, maxTeams, tracks, published, bannerColor, schedule, faq,
    websiteAbout, websitePrizes,
    contactEmail, promoVideoUrl, eventLogoUrl,
    venueName, venueAddress, venueMapsUrl,
    socialTwitter, socialLinkedin, socialInstagram, socialFacebook,
    registrationDeadline, galleryImages, websiteTestimonials, websiteStats,
    maxParticipants, websiteTheme,
  } = req.body;
  try {
    const { rows } = await q(
      `UPDATE hackathons SET
        name=$1,start_date=$2,end_date=$3,location=$4,status=$5,
        description=$6,tagline=$7,prize_pool=$8,max_teams=$9,tracks=$10,
        published=$11,banner_color=$12,schedule=$13,faq=$14,
        website_about=$15,website_prizes=$16,
        contact_email=$17,promo_video_url=$18,event_logo_url=$19,
        venue_name=$20,venue_address=$21,venue_maps_url=$22,
        social_twitter=$23,social_linkedin=$24,social_instagram=$25,social_facebook=$26,
        registration_deadline=$27,gallery_images=$28,website_testimonials=$29,
        website_stats=$30,max_participants=$31,website_theme=$32
       WHERE id=$33 RETURNING *`,
      [name,startDate||null,endDate||null,location,status,
        description,tagline,prizePool,maxTeams||null,tracks,
        Boolean(published),bannerColor||'#6366f1',schedule||null,faq||null,
        websiteAbout||null,websitePrizes||null,
        contactEmail||null,promoVideoUrl||null,eventLogoUrl||null,
        venueName||null,venueAddress||null,venueMapsUrl||null,
        socialTwitter||null,socialLinkedin||null,socialInstagram||null,socialFacebook||null,
        registrationDeadline||null,galleryImages||null,websiteTestimonials||null,
        websiteStats||null,maxParticipants||null,websiteTheme||'dark',
        req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(camel(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete(["/api/hackathons/:id", "/hackathons/:id"], admin, async (req, res) => {
  try { await q("DELETE FROM hackathons WHERE id=$1", [req.params.id]); res.json({ deleted: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── JUDGES / TEAMS / CRITERIA (standard CRUD) ───────────────────────────────
app.get(["/api/judges", "/judges"], auth, async (_req, res) => {
  try { const { rows } = await q("SELECT * FROM judges ORDER BY name"); res.json(rows.map(camel)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post(["/api/judges", "/judges"], admin, async (req, res) => {
  const { name, org, role, avatarUrl } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  try { const { rows } = await q("INSERT INTO judges (id,name,org,role,avatar_url) VALUES ($1,$2,$3,$4,$5) RETURNING *", [uid(), name, org, role, avatarUrl||null]); res.status(201).json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put(["/api/judges/:id", "/judges/:id"], admin, async (req, res) => {
  const { name, org, role, avatarUrl } = req.body;
  try { const { rows } = await q("UPDATE judges SET name=$1,org=$2,role=$3,avatar_url=$4 WHERE id=$5 RETURNING *", [name, org, role, avatarUrl||null, req.params.id]); if (!rows.length) return res.status(404).json({ error: "Not found" }); res.json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete(["/api/judges/:id", "/judges/:id"], admin, async (req, res) => {
  try { await q("DELETE FROM judges WHERE id=$1", [req.params.id]); res.json({ deleted: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(["/api/teams", "/teams"], auth, async (req, res) => {
  try { const { hackathonId } = req.query; const { rows } = hackathonId ? await q("SELECT * FROM teams WHERE hackathon_id=$1 ORDER BY name", [hackathonId]) : await q("SELECT * FROM teams ORDER BY name"); res.json(rows.map(camel)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post(["/api/teams", "/teams"], admin, async (req, res) => {
  const { hackathonId, name, project, category, members } = req.body;
  if (!name?.trim() || !hackathonId?.trim()) return res.status(400).json({ error: "name and hackathonId required" });
  try { const { rows } = await q("INSERT INTO teams (id,hackathon_id,name,project,category,members) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [uid(), hackathonId, name, project, category, members]); res.status(201).json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put(["/api/teams/:id", "/teams/:id"], admin, async (req, res) => {
  const { name, project, category, members } = req.body;
  try { const { rows } = await q("UPDATE teams SET name=$1,project=$2,category=$3,members=$4 WHERE id=$5 RETURNING *", [name, project, category, members, req.params.id]); if (!rows.length) return res.status(404).json({ error: "Not found" }); res.json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete(["/api/teams/:id", "/teams/:id"], admin, async (req, res) => {
  try { await q("DELETE FROM teams WHERE id=$1", [req.params.id]); res.json({ deleted: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(["/api/criteria", "/criteria"], auth, async (req, res) => {
  try { const { hackathonId } = req.query; const { rows } = hackathonId ? await q("SELECT * FROM criteria WHERE hackathon_id=$1 ORDER BY weight DESC", [hackathonId]) : await q("SELECT * FROM criteria ORDER BY weight DESC"); res.json(rows.map(camel)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post(["/api/criteria", "/criteria"], admin, async (req, res) => {
  const { hackathonId, name, description, maxScore = 10, weight = 20 } = req.body;
  if (!name?.trim() || !hackathonId?.trim()) return res.status(400).json({ error: "name and hackathonId required" });
  try { const { rows } = await q("INSERT INTO criteria (id,hackathon_id,name,description,max_score,weight) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [uid(), hackathonId, name, description, Number(maxScore), Number(weight)]); res.status(201).json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put(["/api/criteria/:id", "/criteria/:id"], admin, async (req, res) => {
  const { name, description, maxScore, weight } = req.body;
  try { const { rows } = await q("UPDATE criteria SET name=$1,description=$2,max_score=$3,weight=$4 WHERE id=$5 RETURNING *", [name, description, Number(maxScore), Number(weight), req.params.id]); if (!rows.length) return res.status(404).json({ error: "Not found" }); res.json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete(["/api/criteria/:id", "/criteria/:id"], admin, async (req, res) => {
  try { await q("DELETE FROM criteria WHERE id=$1", [req.params.id]); res.json({ deleted: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FEEDBACKS (with extra metadata fields) ───────────────────────────────────
app.get(["/api/feedbacks", "/feedbacks"], auth, async (req, res) => {
  try { const { hackathonId } = req.query; const { rows } = hackathonId ? await q("SELECT * FROM feedbacks WHERE hackathon_id=$1 ORDER BY submitted_at DESC", [hackathonId]) : await q("SELECT * FROM feedbacks ORDER BY submitted_at DESC"); res.json(rows.map(camel)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post(["/api/feedbacks", "/feedbacks"], auth, async (req, res) => {
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
app.delete(["/api/feedbacks/:id", "/feedbacks/:id"], admin, async (req, res) => {
  try { await q("DELETE FROM feedbacks WHERE id=$1", [req.params.id]); res.json({ deleted: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PUBLIC ENDPOINTS ─────────────────────────────────────────────────────────
app.get(["/api/public/hackathons", "/public/hackathons"], async (_req, res) => {
  try { const { rows } = await q("SELECT * FROM hackathons WHERE published=true ORDER BY start_date DESC"); res.json(rows.map(camel)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get(["/api/public/hackathons/:id", "/public/hackathons/:id"], async (req, res) => {
  try { const { rows } = await q("SELECT * FROM hackathons WHERE id=$1 AND published=true", [req.params.id]); if (!rows.length) return res.status(404).json({ error: "Not found" }); res.json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get(["/api/public/hackathons/:id/judges", "/public/hackathons/:id/judges"], async (req, res) => {
  try {
    const { rows } = await q(
      "SELECT j.* FROM judges j JOIN hackathon_judges hj ON hj.user_id IN (SELECT id FROM users WHERE judge_id=j.id) WHERE hj.hackathon_id=$1 UNION SELECT j.* FROM judges j WHERE j.id IN (SELECT DISTINCT judge_id FROM feedbacks WHERE hackathon_id=$1) ORDER BY name",
      [req.params.id]
    );
    res.json(rows.map(camel));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post(["/api/public/register", "/public/register"], async (req, res) => {
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
app.get(["/api/registrations", "/registrations"], admin, async (req, res) => {
  try { const { hackathonId } = req.query; const { rows } = hackathonId ? await q("SELECT * FROM registrations WHERE hackathon_id=$1 ORDER BY created_at DESC", [hackathonId]) : await q("SELECT * FROM registrations ORDER BY created_at DESC"); res.json(rows.map(camel)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put(["/api/registrations/:id", "/registrations/:id"], admin, async (req, res) => {
  try { const { rows } = await q("UPDATE registrations SET status=$1 WHERE id=$2 RETURNING *", [req.body.status, req.params.id]); if (!rows.length) return res.status(404).json({ error: "Not found" }); res.json(camel(rows[0])); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete(["/api/registrations/:id", "/registrations/:id"], admin, async (req, res) => {
  try { await q("DELETE FROM registrations WHERE id=$1", [req.params.id]); res.json({ deleted: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});


// ─── SPEAKERS (keynotes + session chairs) ─────────────────────────────────────
app.get(["/api/speakers", "/speakers"], auth, async (req, res) => {
  try {
    const { hackathonId, type } = req.query;
    let sql = "SELECT * FROM page_speakers WHERE 1=1";
    const params = [];
    if (hackathonId) { params.push(hackathonId); sql += ` AND hackathon_id=$${params.length}`; }
    if (type)        { params.push(type);        sql += ` AND type=$${params.length}`; }
    sql += " ORDER BY sort_order, name";
    const { rows } = await q(sql, params);
    res.json(rows.map(camel));
  } catch (e) {
    if (e.message.includes("does not exist")) return res.status(503).json({ error: "Run migration_v5.sql in Neon first — table 'page_speakers' missing", migration: true });
    res.status(500).json({ error: e.message });
  }
});
app.post(["/api/speakers", "/speakers"], admin, async (req, res) => {
  const { hackathonId, type, name, title, org, bio, avatarUrl, linkedinUrl, twitterUrl, sortOrder } = req.body;
  if (!hackathonId || !name?.trim() || !type) return res.status(400).json({ error: "hackathonId, type, name required" });
  try {
    const { rows } = await q(
      "INSERT INTO page_speakers (id,hackathon_id,type,name,title,org,bio,avatar_url,linkedin_url,twitter_url,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
      [uid(),hackathonId,type,name,title,org,bio,avatarUrl||null,linkedinUrl||null,twitterUrl||null,sortOrder||0]
    );
    res.status(201).json(camel(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put(["/api/speakers/:id", "/speakers/:id"], admin, async (req, res) => {
  const { name, title, org, bio, avatarUrl, linkedinUrl, twitterUrl, sortOrder } = req.body;
  try {
    const { rows } = await q(
      "UPDATE page_speakers SET name=$1,title=$2,org=$3,bio=$4,avatar_url=$5,linkedin_url=$6,twitter_url=$7,sort_order=$8 WHERE id=$9 RETURNING *",
      [name,title,org,bio,avatarUrl||null,linkedinUrl||null,twitterUrl||null,sortOrder||0,req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(camel(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete(["/api/speakers/:id", "/speakers/:id"], admin, async (req, res) => {
  try { await q("DELETE FROM page_speakers WHERE id=$1",[req.params.id]); res.json({ deleted:true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PARTNERS ─────────────────────────────────────────────────────────────────
app.get(["/api/partners", "/partners"], auth, async (req, res) => {
  try {
    const { hackathonId } = req.query;
    const { rows } = hackathonId
    ? await q("SELECT * FROM page_partners WHERE hackathon_id=$1 ORDER BY sort_order,name",[hackathonId])
    : await q("SELECT * FROM page_partners ORDER BY sort_order,name");
    res.json(rows.map(camel));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post(["/api/partners", "/partners"], admin, async (req, res) => {
  const { hackathonId, name, tier, logoUrl, websiteUrl, sortOrder } = req.body;
  if (!hackathonId || !name?.trim()) return res.status(400).json({ error: "hackathonId and name required" });
  try {
    const { rows } = await q(
      "INSERT INTO page_partners (id,hackathon_id,name,tier,logo_url,website_url,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [uid(),hackathonId,name,tier||"general",logoUrl||null,websiteUrl||null,sortOrder||0]
    );
    res.status(201).json(camel(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put(["/api/partners/:id", "/partners/:id"], admin, async (req, res) => {
  const { name, tier, logoUrl, websiteUrl, sortOrder } = req.body;
  try {
    const { rows } = await q(
      "UPDATE page_partners SET name=$1,tier=$2,logo_url=$3,website_url=$4,sort_order=$5 WHERE id=$6 RETURNING *",
      [name,tier||"general",logoUrl||null,websiteUrl||null,sortOrder||0,req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(camel(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete(["/api/partners/:id", "/partners/:id"], admin, async (req, res) => {
  try { await q("DELETE FROM page_partners WHERE id=$1",[req.params.id]); res.json({ deleted:true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TEAM ─────────────────────────────────────────────────────────────────────
app.get(["/api/orgteam", "/orgteam"], auth, async (req, res) => {
  try {
    const { hackathonId } = req.query;
    const { rows } = hackathonId
    ? await q("SELECT * FROM page_team WHERE hackathon_id=$1 ORDER BY sort_order,name",[hackathonId])
    : await q("SELECT * FROM page_team ORDER BY sort_order,name");
    res.json(rows.map(camel));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post(["/api/orgteam", "/orgteam"], admin, async (req, res) => {
  const { hackathonId, name, role, org, avatarUrl, linkedinUrl, sortOrder } = req.body;
  if (!hackathonId || !name?.trim()) return res.status(400).json({ error: "hackathonId and name required" });
  try {
    const { rows } = await q(
      "INSERT INTO page_team (id,hackathon_id,name,role,org,avatar_url,linkedin_url,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [uid(),hackathonId,name,role,org,avatarUrl||null,linkedinUrl||null,sortOrder||0]
    );
    res.status(201).json(camel(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put(["/api/orgteam/:id", "/orgteam/:id"], admin, async (req, res) => {
  const { name, role, org, avatarUrl, linkedinUrl, sortOrder } = req.body;
  try {
    const { rows } = await q(
      "UPDATE page_team SET name=$1,role=$2,org=$3,avatar_url=$4,linkedin_url=$5,sort_order=$6 WHERE id=$7 RETURNING *",
      [name,role,org,avatarUrl||null,linkedinUrl||null,sortOrder||0,req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(camel(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete(["/api/orgteam/:id", "/orgteam/:id"], admin, async (req, res) => {
  try { await q("DELETE FROM page_team WHERE id=$1",[req.params.id]); res.json({ deleted:true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PUBLIC: full page data for a hackathon ────────────────────────────────────
// Admin preview — authenticated, works even if not published
app.get(["/api/pubpage/preview/:id", "/pubpage/preview/:id"], auth, async (req, res) => {
  try {
    const { rows: hRows } = await q("SELECT * FROM hackathons WHERE id=$1", [req.params.id]);
    if (!hRows.length) return res.status(404).json({ error: "Hackathon not found" });
    const hack = camel(hRows[0]);
    // Include best judge details
    if (hack.bestJudgeId) {
      try { const {rows:bj} = await q("SELECT * FROM judges WHERE id=$1",[hack.bestJudgeId]); if(bj[0]) hack.bestJudge = camel(bj[0]); } catch(_){}
    }
    const safeQ = async (sql, params) => { try { const r = await q(sql, params); return r.rows; } catch(_){ return []; }};
    const [speakers, partners, team, judges] = await Promise.all([
      safeQ("SELECT * FROM page_speakers WHERE hackathon_id=$1 ORDER BY sort_order,name",[hack.id]),
      safeQ("SELECT * FROM page_partners  WHERE hackathon_id=$1 ORDER BY sort_order,name",[hack.id]),
      safeQ("SELECT * FROM page_team      WHERE hackathon_id=$1 ORDER BY sort_order,name",[hack.id]),
      safeQ(`SELECT j.* FROM judges j WHERE j.id IN (SELECT DISTINCT f.judge_id FROM feedbacks f WHERE f.hackathon_id=$1 UNION SELECT u.judge_id FROM users u JOIN hackathon_judges hj ON hj.user_id=u.id WHERE hj.hackathon_id=$1 AND u.judge_id IS NOT NULL) ORDER BY j.name`,[hack.id]),
    ]);
    res.json({ ...hack, keynotes: speakers.filter(s=>s.type==="keynote").map(camel), sessionChairs: speakers.filter(s=>s.type==="session_chair").map(camel), partners: partners.map(camel), team: team.map(camel), judges: judges.map(camel) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(["/api/pubpage/:id", "/pubpage/:id"], async (req, res) => {
  try {
    const { rows: hRows } = await q("SELECT * FROM hackathons WHERE id=$1 AND published=true",[req.params.id]);
    if (!hRows.length) return res.status(404).json({ error: "Page not found or not published" });
    const hack = camel(hRows[0]);

    // Each CMS table query is wrapped individually — if migration hasn't been run
    // the table won't exist; return empty arrays rather than crashing the page
    const safeQuery = async (sql, params) => {
      try { const r = await q(sql, params); return r.rows; }
      catch (_) { return []; }
    };

    const [speakers, partners, team, judges] = await Promise.all([
      safeQuery("SELECT * FROM page_speakers WHERE hackathon_id=$1 ORDER BY sort_order,name",[hack.id]),
      safeQuery("SELECT * FROM page_partners  WHERE hackathon_id=$1 ORDER BY sort_order,name",[hack.id]),
      safeQuery("SELECT * FROM page_team      WHERE hackathon_id=$1 ORDER BY sort_order,name",[hack.id]),
      safeQuery(`SELECT j.* FROM judges j
         WHERE j.id IN (
           SELECT DISTINCT f.judge_id FROM feedbacks f WHERE f.hackathon_id=$1
           UNION
           SELECT u.judge_id FROM users u
           JOIN hackathon_judges hj ON hj.user_id=u.id
           WHERE hj.hackathon_id=$1 AND u.judge_id IS NOT NULL
         ) ORDER BY j.name`,[hack.id]),
    ]);

    res.json({
      ...hack,
      keynotes:      speakers.filter(s=>s.type==="keynote").map(camel),
      sessionChairs: speakers.filter(s=>s.type==="session_chair").map(camel),
      partners:      partners.map(camel),
      team:          team.map(camel),
      judges:        judges.map(camel),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── JUDGE-TEAM ASSIGNMENTS ──────────────────────────────────────────────────
app.get(["/api/judge-teams", "/judge-teams"], admin, async (req, res) => {
  try {
    const { userId } = req.query;
    const { rows } = userId
    ? await q("SELECT * FROM judge_team_assignments WHERE user_id=$1", [userId])
    : await q("SELECT * FROM judge_team_assignments");
    res.json(rows.map(camel));
  } catch (e) {
    if (e.message.includes("does not exist")) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

app.post(["/api/judge-teams", "/judge-teams"], admin, async (req, res) => {
  const { userId, teamId, hackathonId } = req.body;
  if (!userId || !teamId || !hackathonId) return res.status(400).json({ error: "userId, teamId, hackathonId required" });
  try {
    await q(
      "INSERT INTO judge_team_assignments (user_id,team_id,hackathon_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
      [userId, teamId, hackathonId]
    );
    res.status(201).json({ assigned: true });
  } catch (e) {
    if (e.message.includes("does not exist")) return res.status(503).json({ error: "Run migration_v6.sql first", migration: true });
    res.status(500).json({ error: e.message });
  }
});

app.delete(["/api/judge-teams/:userId/:teamId", "/judge-teams/:userId/:teamId"], admin, async (req, res) => {
  try {
    await q("DELETE FROM judge_team_assignments WHERE user_id=$1 AND team_id=$2", [req.params.userId, req.params.teamId]);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET users with team assignments included ─────────────────────────────────
// Patch the existing /api/users GET to also include assignedTeams
// (already included via buildUserPayload above)


// ─── BEST JUDGE ANALYTICS ─────────────────────────────────────────────────────
app.get(["/api/best-judge/:hackathonId", "/best-judge/:hackathonId"], auth, async (req, res) => {
  const { hackathonId } = req.params;
  try {
    // Get all judges assigned to this hackathon
    const { rows: assigned } = await q(`
      SELECT DISTINCT j.*, u.id as user_id
      FROM judges j
      LEFT JOIN users u ON u.judge_id = j.id
      LEFT JOIN hackathon_judges hj ON hj.user_id = u.id AND hj.hackathon_id = $1
      WHERE hj.hackathon_id = $1
        OR j.id IN (SELECT DISTINCT judge_id FROM feedbacks WHERE hackathon_id = $1)
    `, [hackathonId]);

    const { rows: teams }     = await q("SELECT id FROM teams WHERE hackathon_id=$1", [hackathonId]);
    const { rows: criteria }  = await q("SELECT id,max_score,weight FROM criteria WHERE hackathon_id=$1", [hackathonId]);
    const { rows: feedbacks } = await q("SELECT * FROM feedbacks WHERE hackathon_id=$1", [hackathonId]);
    const { rows: hack }      = await q("SELECT best_judge_id, best_judge_note FROM hackathons WHERE id=$1", [hackathonId]);

    const totalTeams    = teams.length;
    const totalWeight   = criteria.reduce((s,c) => s + c.weight, 0) || 1;

    const scored = assigned.map(judge => {
      const jFbs = feedbacks.filter(f => f.judge_id === judge.id);

      // ── Metric 1: Coverage (0-100) — % of teams reviewed
      const coverage = totalTeams > 0 ? (jFbs.length / totalTeams) * 100 : 0;

      // ── Metric 2: Thoroughness (0-100) — average comment word count
      const avgWords = jFbs.length === 0 ? 0 : jFbs.reduce((sum, fb) => {
        const comments = Object.values(fb.comments || {}).join(" ");
        const overall  = fb.overall || "";
        return sum + (comments + " " + overall).split(/\s+/).filter(Boolean).length;
      }, 0) / jFbs.length;
      const thoroughness = Math.min(100, (avgWords / 80) * 100); // 80 words = full score

      // ── Metric 3: Discrimination (0-100) — std dev of weighted scores (high = good)
      const weightedScores = jFbs.map(fb => {
        const scores = fb.scores || {};
        return criteria.reduce((s,c) => s + ((scores[c.id] || 0) / c.max_score) * c.weight, 0) / totalWeight;
      });
      const mean = weightedScores.length ? weightedScores.reduce((a,b) => a+b, 0) / weightedScores.length : 0;
      const variance = weightedScores.length < 2 ? 0 :
      weightedScores.reduce((s,v) => s + Math.pow(v - mean, 2), 0) / weightedScores.length;
      const stddev = Math.sqrt(variance);
      const discrimination = Math.min(100, stddev * 400); // 0.25 stddev = full score

      // ── Metric 4: Consistency (0-100) — criteria weights used consistently
      const criteriaCompleteness = jFbs.length === 0 ? 0 :
      jFbs.reduce((sum, fb) => {
        const scored = Object.keys(fb.scores || {}).length;
        return sum + (criteria.length > 0 ? scored / criteria.length : 0);
      }, 0) / jFbs.length * 100;

      // ── Metric 5: Engagement (0-100) — wrote overall summary
      const withOverall = jFbs.filter(f => (f.overall || "").trim().length > 20).length;
      const engagement  = jFbs.length > 0 ? (withOverall / jFbs.length) * 100 : 0;

      // ── Composite score (weighted)
      const composite = Math.round(
        coverage        * 0.30 +
        thoroughness    * 0.25 +
        discrimination  * 0.20 +
        criteriaCompleteness * 0.15 +
        engagement      * 0.10
      );

      return {
        ...camel(judge),
        feedbackCount:  jFbs.length,
        totalTeams,
        coverage:       Math.round(coverage),
        thoroughness:   Math.round(thoroughness),
        discrimination: Math.round(discrimination),
        criteriaCompleteness: Math.round(criteriaCompleteness),
        engagement:     Math.round(engagement),
        composite,
        avgScore:       weightedScores.length
        ? +(weightedScores.reduce((a,b) => a+b, 0) / weightedScores.length * 10).toFixed(1)
        : null,
      };
    });

    // Rank by composite descending
    scored.sort((a,b) => b.composite - a.composite);

    res.json({
      judges:       scored,
      bestJudgeId:  hack[0]?.best_judge_id  || null,
      bestJudgeNote:hack[0]?.best_judge_note || "",
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Set best judge
app.post(["/api/best-judge/:hackathonId", "/best-judge/:hackathonId"], admin, async (req, res) => {
  const { judgeId, note } = req.body;
  const { hackathonId }   = req.params;
  try {
    await q(
      "UPDATE hackathons SET best_judge_id=$1, best_judge_note=$2 WHERE id=$3",
      [judgeId || null, note || null, hackathonId]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});



// ═══════════════════════════════════════════════════════════════════════════
// AI FEATURES — Powered by Google Gemini (FREE tier)
// Get a free API key at: aistudio.google.com → Get API Key
// Add to Vercel: GEMINI_API_KEY
// Free tier: 1,500 requests/day, no credit card required
// ═══════════════════════════════════════════════════════════════════════════
const https = require("https");

async function callGemini(systemPrompt, userPrompt, maxTokens = 1024) {
  const apiKey = process.env.GEMINI_API_KEY;
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) return reject(new Error("Empty response from Gemini"));
          resolve(text);
        } catch(e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function requireAI(req, res, next) {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: "AI features need a free Gemini API key. Get one at aistudio.google.com → then add GEMINI_API_KEY to Vercel Settings → Environment Variables.",
      setupUrl: "https://aistudio.google.com/app/apikey"
    });
  }
  next();
}

function parseJSON(raw) {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
}

// ── 1. AI TEAM INSIGHTS ──────────────────────────────────────────────────────
app.post(["/api/ai/team-insights", "/ai/team-insights"], auth, requireAI, async (req, res) => {
  const { teamId, hackathonId } = req.body;
  try {
    const { rows: [team] }    = await q("SELECT * FROM teams WHERE id=$1", [teamId]);
    const { rows: criteria }  = await q("SELECT * FROM criteria WHERE hackathon_id=$1", [hackathonId]);
    const { rows: feedbacks } = await q(`
      SELECT f.*, j.name AS judge_name, j.org AS judge_org
      FROM feedbacks f JOIN judges j ON j.id=f.judge_id
      WHERE f.team_id=$1 AND f.hackathon_id=$2`, [teamId, hackathonId]);

    if (!feedbacks.length) return res.json({ insight: "No feedback submitted yet for this team." });

    const criteriaMap = Object.fromEntries(criteria.map(c => [c.id, c]));
    const feedbackText = feedbacks.map(fb => {
      const scores = Object.entries(fb.scores||{}).map(([cid,v]) => {
        const c = criteriaMap[cid]; return c ? `${c.name}: ${v}/${c.max_score}` : null;
      }).filter(Boolean).join(", ");
      const comments = Object.entries(fb.comments||{}).map(([cid,v]) => {
        const c = criteriaMap[cid]; return c&&v ? `${c.name}: "${v}"` : null;
      }).filter(Boolean).join(" | ");
      return `Judge: ${fb.judge_name} (${fb.judge_org}) | Scores: ${scores} | ${comments} | Overall: ${fb.overall||"None"}`;
    }).join("\n");

    const prompt = `Team: "${team.name}" | Project: "${team.project}" | Category: ${team.category}

Feedback from ${feedbacks.length} judge(s):
${feedbackText}

Return ONLY this JSON (no markdown):
{"headline":"one sentence summary","strengths":["s1","s2","s3"],"gaps":["g1","g2"],"recommendation":"1-2 sentence advice","prizeWorthy":true,"consensusScore":"High/Medium/Low","standoutCriterion":"criterion name"}`;

    const raw = await callGemini("You are a hackathon evaluation analyst. Return only valid JSON, no markdown fences.", prompt, 512);
    res.json({ insight: parseJSON(raw) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── 2. AI HACKATHON REPORT ───────────────────────────────────────────────────
app.post(["/api/ai/hackathon-report", "/ai/hackathon-report"], auth, requireAI, async (req, res) => {
  const { hackathonId } = req.body;
  try {
    const { rows: [hack] }   = await q("SELECT * FROM hackathons WHERE id=$1", [hackathonId]);
    const { rows: teams }    = await q("SELECT * FROM teams WHERE hackathon_id=$1 ORDER BY name", [hackathonId]);
    const { rows: criteria } = await q("SELECT * FROM criteria WHERE hackathon_id=$1", [hackathonId]);
    const { rows: judges }   = await q("SELECT DISTINCT j.* FROM judges j JOIN feedbacks f ON f.judge_id=j.id WHERE f.hackathon_id=$1", [hackathonId]);
    const { rows: feedbacks} = await q("SELECT f.*,j.name AS judge_name FROM feedbacks f JOIN judges j ON j.id=f.judge_id WHERE f.hackathon_id=$1", [hackathonId]);

    const totalWeight = criteria.reduce((s,c)=>s+c.weight,0)||1;
    const teamScores = teams.map(t => {
      const tFbs = feedbacks.filter(f=>f.team_id===t.id);
      const avg = tFbs.length ? tFbs.reduce((sum,fb) => {
        return sum + (criteria.reduce((s,c)=>s+((fb.scores[c.id]||0)/c.max_score)*c.weight,0)/totalWeight)*10;
      },0)/tFbs.length : 0;
      return { ...t, avgScore: avg.toFixed(1), reviews: tFbs.length };
    }).sort((a,b)=>b.avgScore-a.avgScore);

    const prompt = `Write a professional hackathon evaluation report for "${hack.name}".

Event: ${hack.location} | ${hack.start_date} to ${hack.end_date} | Prize: ${hack.prize_pool}
Judges: ${judges.map(j=>`${j.name} (${j.org})`).join(", ")}
Criteria: ${criteria.map(c=>`${c.name} ${c.weight}%`).join(", ")}
Rankings:
${teamScores.map((t,i)=>`${i+1}. ${t.name} — ${t.project} (${t.category}) — ${t.avgScore}/10 — ${t.reviews} reviews`).join("\n")}

Write 4 sections in markdown:
## Executive Summary
## Competition Highlights
## Panel Observations
## Recommendations for Future Events

Be specific. Reference real team names and scores.`;

    const report = await callGemini("You are a professional hackathon program manager. Write a formal event report.", prompt, 2048);
    res.json({ report });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── 3. AI JUDGE CALIBRATION ──────────────────────────────────────────────────
app.post(["/api/ai/calibration", "/ai/calibration"], auth, requireAI, async (req, res) => {
  const { hackathonId } = req.body;
  try {
    const { rows: criteria } = await q("SELECT * FROM criteria WHERE hackathon_id=$1", [hackathonId]);
    const { rows: feedbacks} = await q(`
      SELECT f.*,j.name AS judge_name,j.org AS judge_org,t.name AS team_name
      FROM feedbacks f JOIN judges j ON j.id=f.judge_id JOIN teams t ON t.id=f.team_id
      WHERE f.hackathon_id=$1`, [hackathonId]);

    if (feedbacks.length < 2) return res.json({ analysis: "Need at least 2 feedback entries for calibration." });

    const totalWeight = criteria.reduce((s,c)=>s+c.weight,0)||1;
    const byJudge = {};
    feedbacks.forEach(fb => {
      if (!byJudge[fb.judge_id]) byJudge[fb.judge_id] = { name:fb.judge_name, org:fb.judge_org, scores:[], wordCounts:[] };
      const ws = criteria.reduce((s,c)=>s+((fb.scores[c.id]||0)/c.max_score)*c.weight,0);
      byJudge[fb.judge_id].scores.push((ws/totalWeight)*10);
      const words = (Object.values(fb.comments||{}).join(" ")+" "+(fb.overall||"")).split(/\s+/).filter(Boolean).length;
      byJudge[fb.judge_id].wordCounts.push(words);
    });

    const judgeStats = Object.values(byJudge).map(d => {
      const avg = (d.scores.reduce((a,b)=>a+b,0)/d.scores.length).toFixed(1);
      const variance = d.scores.reduce((s,v)=>s+Math.pow(v-(avg),2),0)/d.scores.length;
      const avgWords = Math.round(d.wordCounts.reduce((a,b)=>a+b,0)/d.wordCounts.length);
      return `${d.name} (${d.org}): avg=${avg}/10, stddev=${Math.sqrt(variance).toFixed(2)}, reviews=${d.scores.length}, avg_comment_words=${avgWords}`;
    }).join("\n");

    const overallAvg = (feedbacks.reduce((s,f)=>{
      const ws=criteria.reduce((sum,c)=>sum+((f.scores[c.id]||0)/c.max_score)*c.weight,0);
      return s+(ws/totalWeight)*10;
    },0)/feedbacks.length).toFixed(1);

    const prompt = `Analyze judge calibration. Overall event average: ${overallAvg}/10

Judge Statistics:
${judgeStats}

Return ONLY this JSON:
{"summary":"2-3 sentence overview","judges":[{"name":"judge name","calibration":"Well-calibrated/Lenient/Strict/Inconsistent","insight":"specific observation","commentQuality":"Detailed/Adequate/Brief","flag":null}],"panelHealth":"Excellent/Good/Fair/Poor","recommendations":["rec1","rec2"]}`;

    const raw = await callGemini("You are an expert in psychometric calibration. Return only valid JSON.", prompt, 768);
    res.json({ analysis: parseJSON(raw) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── 4. AI REGISTRATION SCREENER ──────────────────────────────────────────────
app.post(["/api/ai/screen-registration", "/ai/screen-registration"], auth, requireAI, async (req, res) => {
  const { registrationId, hackathonId } = req.body;
  try {
    const { rows: [reg] }  = await q("SELECT * FROM registrations WHERE id=$1", [registrationId]);
    const { rows: [hack] } = await q("SELECT name,tracks FROM hackathons WHERE id=$1", [hackathonId]);
    if (!reg) return res.status(404).json({ error: "Registration not found" });

    const prompt = `Screen this ${reg.type==="judge"?"judge application":"team registration"} for "${hack.name}" (Tracks: ${hack.tracks}).

Applicant: ${reg.name} | Org: ${reg.org||"Not specified"} | Type: ${reg.type}
${reg.type==="team"?`Team: ${reg.team_name||"N/A"} | Size: ${reg.team_size||"N/A"}`:""}
Message: "${reg.message||"No message provided"}"

Return ONLY this JSON:
{"recommendation":"Approve/Reject/Review","confidence":"High/Medium/Low","reason":"2-3 sentences","strengths":["s1"],"concerns":[],"suggestedAction":"next step"}`;

    const raw = await callGemini("You are a hackathon program manager screening applications. Return only valid JSON.", prompt, 512);
    res.json({ screening: parseJSON(raw) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── 5. AI CHAT ASSISTANT ─────────────────────────────────────────────────────
app.post(["/api/ai/chat", "/ai/chat"], auth, requireAI, async (req, res) => {
  const { question, hackathonId, history = [] } = req.body;
  try {
    const { rows: [hack] }   = await q("SELECT * FROM hackathons WHERE id=$1", [hackathonId]);
    const { rows: teams }    = await q("SELECT * FROM teams WHERE hackathon_id=$1", [hackathonId]);
    const { rows: criteria } = await q("SELECT * FROM criteria WHERE hackathon_id=$1", [hackathonId]);
    const { rows: feedbacks }= await q(`SELECT f.*,j.name AS judge_name,t.name AS team_name FROM feedbacks f JOIN judges j ON j.id=f.judge_id JOIN teams t ON t.id=f.team_id WHERE f.hackathon_id=$1`, [hackathonId]);
    const { rows: judges }   = await q("SELECT DISTINCT j.* FROM judges j JOIN feedbacks f ON f.judge_id=j.id WHERE f.hackathon_id=$1", [hackathonId]);

    const totalWeight = criteria.reduce((s,c)=>s+c.weight,0)||1;
    const teamScores = teams.map(t => {
      const tFbs = feedbacks.filter(f=>f.team_id===t.id);
      const avg = tFbs.length ? (tFbs.reduce((sum,fb)=>sum+(criteria.reduce((s,c)=>s+((fb.scores[c.id]||0)/c.max_score)*c.weight,0)/totalWeight)*10,0)/tFbs.length).toFixed(1) : "N/A";
      return `${t.name}(${t.project},${t.category}):${avg}/10,${tFbs.length}reviews`;
    }).join(" | ");

    const chatHistory = history.slice(-6).map(m => `${m.role==="user"?"User":"HackBot"}: ${m.content}`).join("\n");

    const prompt = `${chatHistory ? "Previous conversation:\n"+chatHistory+"\n\n" : ""}User question: ${question}

HACKATHON DATA:
Event: ${hack.name} | ${hack.location} | Status: ${hack.status}
Teams: ${teamScores}
Judges: ${judges.map(j=>`${j.name}(${j.org})`).join(", ")}
Criteria: ${criteria.map(c=>`${c.name} ${c.weight}%`).join(", ")}
Total feedback entries: ${feedbacks.length}

Answer concisely and helpfully using the real data above.`;

    const answer = await callGemini(
      "You are HackBot, an AI assistant for a hackathon management platform. Answer questions about the hackathon data concisely and accurately.",
      prompt, 512
    );
    res.json({ answer });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── 6. AI FEEDBACK COACH ─────────────────────────────────────────────────────
app.post(["/api/ai/feedback-coach", "/ai/feedback-coach"], auth, requireAI, async (req, res) => {
  const { feedbackId } = req.body;
  try {
    const { rows: [fb] } = await q(`
      SELECT f.*,j.name AS judge_name,t.name AS team_name,t.project
      FROM feedbacks f JOIN judges j ON j.id=f.judge_id JOIN teams t ON t.id=f.team_id
      WHERE f.id=$1`, [feedbackId]);
    if (!fb) return res.status(404).json({ error: "Feedback not found" });

    const commentText = Object.values(fb.comments||{}).join(" ");
    const wordCount = (commentText+" "+(fb.overall||"")).split(/\s+/).filter(Boolean).length;

    const prompt = `Coach this judge on improving their hackathon feedback.

Judge: ${fb.judge_name} | Team reviewed: ${fb.team_name} (${fb.project})
Written comments: "${commentText}"
Overall summary: "${fb.overall||"None"}"
Word count: ${wordCount}

Return ONLY this JSON:
{"qualityScore":7,"qualityLabel":"Good/Excellent/Adequate/Needs Improvement/Poor","whatWorked":["w1"],"improvements":["i1"],"improvedOverall":"better version of their summary","tip":"one coaching tip"}`;

    const raw = await callGemini("You are an expert coaching evaluators on feedback quality. Return only valid JSON.", prompt, 640);
    res.json({ coaching: parseJSON(raw) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Debug catch-all — logs what path Express actually received
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    method: req.method,
    receivedPath: req.path,
    receivedUrl: req.url,
    originalUrl: req.originalUrl,
    allRoutes: app._router.stack
      .filter(r => r.route)
      .map(r => Object.keys(r.route.methods)[0].toUpperCase() + " " + r.route.path)
      .filter(r => r.includes("partner") || r.includes("orgteam") || r.includes("speaker"))
  });
});
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: "Internal server error" }); });

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`\n  HackFest API → http://localhost:${PORT}\n`));
}
module.exports = app;