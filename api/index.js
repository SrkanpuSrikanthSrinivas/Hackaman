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

// ── Audit log helper ─────────────────────────────────────────────────────────
async function logEvent(action, user, req, method = "email") {
    try {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const ip = ((req.headers["x-forwarded-for"] || "").split(",")[0] || req.socket?.remoteAddress || "").trim().slice(0, 60);
        const ua = (req.headers["user-agent"] || "").slice(0, 300);
        await q(
            "INSERT INTO login_logs(id,user_id,name,email,role,action,method,ip,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            [id, user?.id || null, user?.name || null, user?.email || null, user?.role || null, action, method, ip, ua]
        );
    } catch (_) { /* never break auth over a logging failure */ }
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

// ── LOGOUT ────────────────────────────────────────────────────────────────────
app.post(["/api/auth/logout", "/auth/logout"], auth, async (req, res) => {
    await logEvent("logout", req.user, req, req.user?.oauthProvider || "email");
    res.json({ ok: true });
});

// ── LOGIN AUDIT LOG (admin only) ─────────────────────────────────────────────
app.get(["/api/login-logs", "/login-logs"], admin, async (req, res) => {
    try {
        const limit  = Math.min(parseInt(req.query.limit)||100, 500);
        const offset = parseInt(req.query.offset)||0;
        const filter = req.query.filter;
        const search = req.query.search||"";
        const params = [];
        let where = "WHERE 1=1";
        if (filter) { params.push(filter); where += ` AND action=$${params.length}`; }
        if (search) { params.push(`%${search}%`); where += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`; }
        const { rows } = await q(`SELECT * FROM login_logs ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, params).catch(()=>({rows:[]}));
        const { rows: ct } = await q(`SELECT COUNT(*) FROM login_logs ${where}`, params).catch(()=>({rows:[{count:0}]}));
        res.json({ logs: rows.map(camel), total: parseInt(ct[0].count) });
    } catch(e) { res.status(500).json({ error: e.message }); }
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
        if (!ok) {
            await logEvent("failed", user, req, "email");
            return res.status(401).json({ error: "Invalid email or password" });
        }
        await logEvent("login", user, req, "email");
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
        await logEvent("login", user, req, "github");
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
        await logEvent("login", user, req, "google");
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
        await logEvent("login", user, req, "gitlab");
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
        name, startDate, endDate, location, status,
        discordUrl, whatsappGroupUrl, slackUrl, codeOfConduct,
        problemStatements, resources, customRegQuestions, judgingRounds, description, tagline,
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
    try {
        const { rows } = await q("UPDATE registrations SET status=$1 WHERE id=$2 RETURNING *", [req.body.status, req.params.id]);
        if (!rows.length) return res.status(404).json({ error: "Not found" });
        const reg = camel(rows[0]);
        // Auto-send approval email
        if (req.body.status === "approved" && reg.email) {
            const { rows: [h] } = await q("SELECT * FROM hackathons WHERE id=$1", [reg.hackathonId]);
            sendEmail(reg.email, `You're in! Application approved — ${reg.name}`, emailRegApproved(reg, h || {})).catch(()=>{});
        }
        res.json(reg);
    } catch (e) { res.status(500).json({ error: e.message }); }
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


// ═══════════════════════════════════════════════════════════════════════════
// ENTERPRISE FEATURES
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. PROJECT SUBMISSIONS ────────────────────────────────────────────────────
app.get(["/api/submissions","/submissions"], auth, async (req,res)=>{
    const {hackathonId,teamId,status}=req.query;
    let sql="SELECT s.*,t.name as team_name,t.category FROM submissions s JOIN teams t ON t.id=s.team_id WHERE s.hackathon_id=$1";
    const p=[hackathonId];
    if(teamId){p.push(teamId);sql+=` AND s.team_id=$${p.length}`;}
    if(status){p.push(status);sql+=` AND s.status=$${p.length}`;}
    sql+=" ORDER BY s.submitted_at DESC NULLS LAST";
    try{const{rows}=await q(sql,p);res.json(rows.map(camel));}catch(e){res.status(500).json({error:e.message});}
});

app.post(["/api/submissions","/submissions"], auth, async (req,res)=>{
    const{hackathonId,teamId,title,tagline,description,problemStatement,solution,techStack,
        githubUrl,demoUrl,videoUrl,deckUrl,logoUrl,screenshots,track,teamMembers}=req.body;
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    try{
        const{rows}=await q(`INSERT INTO submissions(id,hackathon_id,team_id,title,tagline,description,problem_statement,
      solution,tech_stack,github_url,demo_url,video_url,deck_url,logo_url,screenshots,track,team_members,status,submitted_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'submitted',NOW())
      ON CONFLICT(hackathon_id,team_id) DO UPDATE SET title=$4,tagline=$5,description=$6,problem_statement=$7,
      solution=$8,tech_stack=$9,github_url=$10,demo_url=$11,video_url=$12,deck_url=$13,logo_url=$14,
      screenshots=$15,track=$16,team_members=$17,status='submitted',submitted_at=NOW(),updated_at=NOW() RETURNING *`,
            [id,hackathonId,teamId,title,tagline,description,problemStatement,solution,techStack,
                githubUrl,demoUrl,videoUrl,deckUrl,logoUrl,screenshots,track,teamMembers]);
        res.status(201).json(camel(rows[0]));
    }catch(e){res.status(500).json({error:e.message});}
});

app.put(["/api/submissions/:id","/submissions/:id"], admin, async (req,res)=>{
    const{status,track}=req.body;
    try{const{rows}=await q("UPDATE submissions SET status=$1,track=$2,updated_at=NOW() WHERE id=$3 RETURNING *",[status,track,req.params.id]);
        res.json(camel(rows[0]));}catch(e){res.status(500).json({error:e.message});}
});

app.delete(["/api/submissions/:id","/submissions/:id"], admin, async (req,res)=>{
    try{await q("DELETE FROM submissions WHERE id=$1",[req.params.id]);res.json({deleted:true});}
    catch(e){res.status(500).json({error:e.message});}
});

// ── 2. JUDGE PROGRESS ─────────────────────────────────────────────────────────
app.get(["/api/judge-progress/:hackathonId","/judge-progress/:hackathonId"], auth, async (req,res)=>{
    try{
        const{hackathonId}=req.params;
        const{rows:teams}   =await q("SELECT id,name,project,category FROM teams WHERE hackathon_id=$1",[hackathonId]);
        const{rows:judges}  =await q(`SELECT DISTINCT j.*,u.id as user_id FROM judges j JOIN users u ON u.judge_id=j.id JOIN hackathon_judges hj ON hj.user_id=u.id WHERE hj.hackathon_id=$1`,[hackathonId]);
        const{rows:feedbacks}=await q("SELECT judge_id,team_id FROM feedbacks WHERE hackathon_id=$1",[hackathonId]);
        const{rows:conflicts}=await q("SELECT user_id,team_id FROM judge_conflicts WHERE hackathon_id=$1",[hackathonId]).catch(()=>({rows:[]}));
        const{rows:jta}      =await q("SELECT user_id,team_id FROM judge_team_assignments WHERE hackathon_id=$1",[hackathonId]).catch(()=>({rows:[]}));

        const progress=judges.map(j=>{
            const assignedTeams=jta.filter(a=>a.user_id===j.user_id).map(a=>a.team_id);
            const scopedTeams=assignedTeams.length>0?teams.filter(t=>assignedTeams.includes(t.id)):teams;
            const conflictTeams=conflicts.filter(c=>c.user_id===j.user_id).map(c=>c.team_id);
            const eligibleTeams=scopedTeams.filter(t=>!conflictTeams.includes(t.id));
            const scored=feedbacks.filter(f=>f.judge_id===j.id).map(f=>f.team_id);
            const pending=eligibleTeams.filter(t=>!scored.includes(t.id));
            return{
                judgeId:j.id, userId:j.user_id, name:j.name, org:j.org, avatarUrl:j.avatar_url,
                total:eligibleTeams.length, scored:scored.length,
                pending:pending.length, conflicts:conflictTeams.length,
                pct:eligibleTeams.length?Math.round(scored.length/eligibleTeams.length*100):0,
                pendingTeams:pending.map(t=>({id:t.id,name:t.name,category:t.category})),
            };
        });
        const overall={total:teams.length,judgesComplete:progress.filter(p=>p.pct===100).length,judgesTotal:judges.length};
        res.json({progress,overall,teams:teams.map(camel)});
    }catch(e){res.status(500).json({error:e.message});}
});

// ── 3. ANNOUNCEMENTS ──────────────────────────────────────────────────────────
app.get(["/api/announcements","/announcements"], auth, async (req,res)=>{
    const{hackathonId}=req.query;
    try{const{rows}=await q("SELECT * FROM announcements WHERE hackathon_id=$1 ORDER BY pinned DESC,created_at DESC",[hackathonId]);
        res.json(rows.map(camel));}catch(e){res.status(500).json({error:e.message});}
});

app.get(["/api/public/announcements","/public/announcements"], async (req,res)=>{
    const{hackathonId}=req.query;
    try{const{rows}=await q("SELECT id,title,body,priority,pinned,created_at FROM announcements WHERE hackathon_id=$1 AND (audience='all' OR audience='public') ORDER BY pinned DESC,created_at DESC",[hackathonId]);
        res.json(rows.map(camel));}catch(e){res.status(500).json({error:e.message});}
});

app.post(["/api/announcements","/announcements"], admin, async (req,res)=>{
    const{hackathonId,title,body,priority="normal",audience="all",pinned=false}=req.body;
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    try{const{rows}=await q("INSERT INTO announcements(id,hackathon_id,title,body,priority,audience,pinned,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [id,hackathonId,title,body,priority,audience,pinned,req.user.id]);
        res.status(201).json(camel(rows[0]));}catch(e){res.status(500).json({error:e.message});}
});

app.put(["/api/announcements/:id","/announcements/:id"], admin, async (req,res)=>{
    const{title,body,priority,audience,pinned}=req.body;
    try{const{rows}=await q("UPDATE announcements SET title=$1,body=$2,priority=$3,audience=$4,pinned=$5 WHERE id=$6 RETURNING *",
        [title,body,priority,audience,pinned,req.params.id]);res.json(camel(rows[0]));}catch(e){res.status(500).json({error:e.message});}
});

app.delete(["/api/announcements/:id","/announcements/:id"], admin, async (req,res)=>{
    try{await q("DELETE FROM announcements WHERE id=$1",[req.params.id]);res.json({deleted:true});}
    catch(e){res.status(500).json({error:e.message});}
});

// ── 4. MENTORS ────────────────────────────────────────────────────────────────
app.get(["/api/mentors","/mentors"], auth, async (req,res)=>{
    const{hackathonId}=req.query;
    try{const{rows}=await q("SELECT m.*,COALESCE(json_agg(json_build_object('teamId',ma.team_id,'teamName',t.name)) FILTER(WHERE ma.team_id IS NOT NULL),'[]') as assignments FROM mentors m LEFT JOIN mentor_assignments ma ON ma.mentor_id=m.id LEFT JOIN teams t ON t.id=ma.team_id WHERE m.hackathon_id=$1 GROUP BY m.id ORDER BY m.name",[hackathonId]);
        res.json(rows.map(camel));}catch(e){res.status(500).json({error:e.message});}
});

app.post(["/api/mentors","/mentors"], admin, async (req,res)=>{
    const{hackathonId,name,title,org,expertise,bio,avatarUrl,linkedinUrl,email,availability}=req.body;
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    try{const{rows}=await q("INSERT INTO mentors(id,hackathon_id,name,title,org,expertise,bio,avatar_url,linkedin_url,email,availability) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
        [id,hackathonId,name,title,org,expertise,bio,avatarUrl,linkedinUrl,email,availability]);
        res.status(201).json(camel(rows[0]));}catch(e){res.status(500).json({error:e.message});}
});

app.put(["/api/mentors/:id","/mentors/:id"], admin, async (req,res)=>{
    const{name,title,org,expertise,bio,avatarUrl,linkedinUrl,email,availability}=req.body;
    try{const{rows}=await q("UPDATE mentors SET name=$1,title=$2,org=$3,expertise=$4,bio=$5,avatar_url=$6,linkedin_url=$7,email=$8,availability=$9 WHERE id=$10 RETURNING *",
        [name,title,org,expertise,bio,avatarUrl,linkedinUrl,email,availability,req.params.id]);res.json(camel(rows[0]));}catch(e){res.status(500).json({error:e.message});}
});

app.delete(["/api/mentors/:id","/mentors/:id"], admin, async (req,res)=>{
    try{await q("DELETE FROM mentors WHERE id=$1",[req.params.id]);res.json({deleted:true});}
    catch(e){res.status(500).json({error:e.message});}
});

app.post(["/api/mentor-assignments","/mentor-assignments"], admin, async (req,res)=>{
    const{mentorId,teamId,hackathonId,notes}=req.body;
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    try{await q("INSERT INTO mentor_assignments(id,mentor_id,team_id,hackathon_id,notes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(mentor_id,team_id) DO NOTHING",[id,mentorId,teamId,hackathonId,notes]);
        res.status(201).json({assigned:true});}catch(e){res.status(500).json({error:e.message});}
});

app.delete(["/api/mentor-assignments/:mentorId/:teamId","/mentor-assignments/:mentorId/:teamId"], admin, async (req,res)=>{
    try{await q("DELETE FROM mentor_assignments WHERE mentor_id=$1 AND team_id=$2",[req.params.mentorId,req.params.teamId]);res.json({deleted:true});}
    catch(e){res.status(500).json({error:e.message});}
});

// ── 5. CONFLICT OF INTEREST ───────────────────────────────────────────────────
app.get(["/api/conflicts","/conflicts"], auth, async (req,res)=>{
    const{hackathonId,userId}=req.query;
    try{const{rows}=await q("SELECT jc.*,t.name as team_name FROM judge_conflicts jc JOIN teams t ON t.id=jc.team_id WHERE jc.hackathon_id=$1" + (userId?" AND jc.user_id=$2":""), userId?[hackathonId,userId]:[hackathonId]);
        res.json(rows.map(camel));}catch(e){res.status(500).json({error:e.message});}
});

app.post(["/api/conflicts","/conflicts"], auth, async (req,res)=>{
    const{teamId,hackathonId,reason}=req.body;
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    const userId=req.user.id;
    try{await q("INSERT INTO judge_conflicts(id,user_id,team_id,hackathon_id,reason) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,team_id) DO NOTHING",[id,userId,teamId,hackathonId,reason]);
        res.status(201).json({declared:true});}catch(e){res.status(500).json({error:e.message});}
});

app.delete(["/api/conflicts/:userId/:teamId","/conflicts/:userId/:teamId"], auth, async (req,res)=>{
    try{await q("DELETE FROM judge_conflicts WHERE user_id=$1 AND team_id=$2",[req.params.userId,req.params.teamId]);res.json({deleted:true});}
    catch(e){res.status(500).json({error:e.message});}
});

// ── 6. CHECK-IN / ATTENDANCE ──────────────────────────────────────────────────
app.get(["/api/checkins","/checkins"], auth, async (req,res)=>{
    const{hackathonId}=req.query;
    try{const{rows}=await q("SELECT c.*,t.name as team_name FROM checkins c LEFT JOIN teams t ON t.id=c.team_id WHERE c.hackathon_id=$1 ORDER BY c.checked_in_at DESC",[hackathonId]);
        res.json(rows.map(camel));}catch(e){res.status(500).json({error:e.message});}
});

app.post(["/api/checkins","/checkins"], auth, async (req,res)=>{
    const{hackathonId,name,email,type="participant",teamId,notes}=req.body;
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    try{const{rows}=await q("INSERT INTO checkins(id,hackathon_id,name,email,type,team_id,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [id,hackathonId,name,email,type,teamId||null,notes]);res.status(201).json(camel(rows[0]));}
    catch(e){res.status(500).json({error:e.message});}
});

app.delete(["/api/checkins/:id","/checkins/:id"], admin, async (req,res)=>{
    try{await q("DELETE FROM checkins WHERE id=$1",[req.params.id]);res.json({deleted:true});}
    catch(e){res.status(500).json({error:e.message});}
});

app.get(["/api/checkins/stats/:hackathonId","/checkins/stats/:hackathonId"], auth, async (req,res)=>{
    try{
        const{rows}=await q("SELECT type,COUNT(*) as count FROM checkins WHERE hackathon_id=$1 GROUP BY type",[req.params.hackathonId]);
        const{rows:total}=await q("SELECT COUNT(*) as total FROM checkins WHERE hackathon_id=$1",[req.params.hackathonId]);
        res.json({byType:Object.fromEntries(rows.map(r=>[r.type,parseInt(r.count)])),total:parseInt(total[0].total)});
    }catch(e){res.status(500).json({error:e.message});}
});

// ── 7. CERTIFICATES ───────────────────────────────────────────────────────────
app.get(["/api/certificates","/certificates"], auth, async (req,res)=>{
    const{hackathonId}=req.query;
    try{const{rows}=await q("SELECT * FROM certificates WHERE hackathon_id=$1 ORDER BY type,recipient",[hackathonId]);
        res.json(rows.map(camel));}catch(e){res.status(500).json({error:e.message});}
});

app.post(["/api/certificates/bulk","/certificates/bulk"], admin, async (req,res)=>{
    const{hackathonId,certs}=req.body; // [{recipient,email,type,teamName,position}]
    const crypto=require("crypto");
    try{
        const inserted=[];
        for(const c of certs){
            const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
            const token=crypto.randomBytes(32).toString("hex");
            const{rows}=await q("INSERT INTO certificates(id,hackathon_id,recipient,email,type,team_name,position,token) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING *",
                [id,hackathonId,c.recipient,c.email,c.type,c.teamName,c.position,token]);
            if(rows[0])inserted.push(camel(rows[0]));
        }
        res.json({issued:inserted.length,certificates:inserted});
    }catch(e){res.status(500).json({error:e.message});}
});

app.delete(["/api/certificates/:id","/certificates/:id"], admin, async (req,res)=>{
    try{await q("DELETE FROM certificates WHERE id=$1",[req.params.id]);res.json({deleted:true});}
    catch(e){res.status(500).json({error:e.message});}
});

// Certificate verification (public)
app.get(["/api/verify-cert/:token","/verify-cert/:token"], async (req,res)=>{
    try{
        const{rows}=await q("SELECT c.*,h.name as hackathon_name,h.start_date,h.end_date FROM certificates c JOIN hackathons h ON h.id=c.hackathon_id WHERE c.token=$1",[req.params.token]);
        if(!rows.length)return res.status(404).json({error:"Certificate not found"});
        res.json(camel(rows[0]));
    }catch(e){res.status(500).json({error:e.message});}
});

// ── 8. DATA EXPORT ────────────────────────────────────────────────────────────
app.get(["/api/export/:hackathonId","/export/:hackathonId"], admin, async (req,res)=>{
    const{type="all"}=req.query;
    try{
        const{rows:[hack]}=await q("SELECT * FROM hackathons WHERE id=$1",[req.params.hackathonId]);
        const{rows:teams}   =await q("SELECT * FROM teams    WHERE hackathon_id=$1 ORDER BY name",[req.params.hackathonId]);
        const{rows:judges}  =await q("SELECT j.* FROM judges j JOIN feedbacks f ON f.judge_id=j.id WHERE f.hackathon_id=$1 GROUP BY j.id ORDER BY j.name",[req.params.hackathonId]);
        const{rows:criteria}=await q("SELECT * FROM criteria WHERE hackathon_id=$1 ORDER BY weight DESC",[req.params.hackathonId]);
        const{rows:feedbacks}=await q("SELECT f.*,j.name as judge_name,t.name as team_name,t.category FROM feedbacks f JOIN judges j ON j.id=f.judge_id JOIN teams t ON t.id=f.team_id WHERE f.hackathon_id=$1",[req.params.hackathonId]);
        const{rows:regs}    =await q("SELECT * FROM registrations WHERE hackathon_id=$1 ORDER BY created_at DESC",[req.params.hackathonId]).catch(()=>({rows:[]}));
        const{rows:subs}    =await q("SELECT s.*,t.name as team_name FROM submissions s JOIN teams t ON t.id=s.team_id WHERE s.hackathon_id=$1",[req.params.hackathonId]).catch(()=>({rows:[]}));
        const{rows:checkins}=await q("SELECT * FROM checkins WHERE hackathon_id=$1 ORDER BY checked_in_at",[req.params.hackathonId]).catch(()=>({rows:[]}));

        const totalWeight=criteria.reduce((s,c)=>s+c.weight,0)||1;
        const teamScores=teams.map(t=>{
            const tFbs=feedbacks.filter(f=>f.team_id===t.id);
            const avg=tFbs.length?tFbs.reduce((sum,fb)=>{
                return sum+(criteria.reduce((s,c)=>s+((fb.scores[c.id]||0)/c.max_score)*c.weight,0)/totalWeight)*10;
            },0)/tFbs.length:0;
            const perJudge=Object.fromEntries(judges.map(j=>{
                const jFb=tFbs.find(f=>f.judge_id===j.id);
                if(!jFb)return[j.name,""];
                const ws=(criteria.reduce((s,c)=>s+((jFb.scores[c.id]||0)/c.max_score)*c.weight,0)/totalWeight)*10;
                return[j.name,ws.toFixed(1)];
            }));
            return{rank:0,team:t.name,project:t.project||"",category:t.category||"",
                avgScore:avg.toFixed(2),reviews:tFbs.length,...perJudge};
        }).sort((a,b)=>b.avgScore-a.avgScore).map((t,i)=>({...t,rank:i+1}));

        res.json({
            hackathon:{name:hack.name,location:hack.location,startDate:hack.start_date,endDate:hack.end_date,prizePool:hack.prize_pool},
            exportedAt:new Date().toISOString(),
            teams:teamScores,
            registrations:regs.map(camel),
            submissions:subs.map(camel),
            checkins:checkins.map(camel),
            rawFeedbacks:feedbacks.map(camel),
        });
    }catch(e){res.status(500).json({error:e.message});}
});

// ── 9. LEADERBOARD (public when scoring_released=true) ───────────────────────
app.get(["/api/leaderboard/:hackathonId","/leaderboard/:hackathonId"], async (req,res)=>{
    try{
        const{rows:[hack]}=await q("SELECT id,name,leaderboard_public,scoring_released,banner_color FROM hackathons WHERE id=$1 AND published=true",[req.params.hackathonId]);
        if(!hack)return res.status(404).json({error:"Not found"});
        const isAdmin=req.headers.authorization&&(()=>{try{const p=require("jsonwebtoken").verify(req.headers.authorization.replace("Bearer ",""),process.env.JWT_SECRET||JWT_SECRET);return p.role==="admin";}catch{return false;}})();
        if(!hack.scoring_released&&!isAdmin)return res.json({released:false,message:"Results not yet released"});

        const{rows:criteria}=await q("SELECT * FROM criteria WHERE hackathon_id=$1",[req.params.hackathonId]);
        const{rows:teams}   =await q("SELECT * FROM teams WHERE hackathon_id=$1",[req.params.hackathonId]);
        const{rows:fbs}     =await q("SELECT * FROM feedbacks WHERE hackathon_id=$1",[req.params.hackathonId]);
        const totalWeight=criteria.reduce((s,c)=>s+c.weight,0)||1;
        const ranked=teams.map(t=>{
            const tFbs=fbs.filter(f=>f.team_id===t.id);
            const avg=tFbs.length?tFbs.reduce((sum,fb)=>sum+(criteria.reduce((s,c)=>s+((fb.scores[c.id]||0)/c.max_score)*c.weight,0)/totalWeight)*10,0)/tFbs.length:0;
            return{id:t.id,name:t.name,project:t.project,category:t.category,avgScore:+avg.toFixed(1),reviews:tFbs.length};
        }).filter(t=>t.reviews>0).sort((a,b)=>b.avgScore-a.avgScore).map((t,i)=>({...t,rank:i+1}));
        res.json({released:true,hackathon:{name:hack.name,accentColor:hack.banner_color},leaderboard:ranked});
    }catch(e){res.status(500).json({error:e.message});}
});


// ═══════════════════════════════════════════════════════════════════════════
// EMAIL NOTIFICATIONS — Powered by Resend (free: 3,000 emails/month)
// Get a free API key at: resend.com
// Add to Vercel: RESEND_API_KEY
// ═══════════════════════════════════════════════════════════════════════════

const FROM_EMAIL = process.env.EMAIL_FROM || "HackFest Hub <noreply@hackfesthub.com>";
const SITE_URL   = process.env.FRONTEND_URL || "https://hackaman.vercel.app";

async function sendEmail(to, subject, html) {
    if (!process.env.RESEND_API_KEY) {
        console.log(`[Email skipped — no RESEND_API_KEY] To: ${to} | Subject: ${subject}`);
        return { skipped: true };
    }
    try {
        const res = await new Promise((resolve, reject) => {
            const body = JSON.stringify({ from: FROM_EMAIL, to: Array.isArray(to)?to:[to], subject, html });
            const req = https.request({
                hostname:"api.resend.com", path:"/emails", method:"POST",
                headers:{ "Authorization":`Bearer ${process.env.RESEND_API_KEY}`,
                    "Content-Type":"application/json", "Content-Length":Buffer.byteLength(body) }
            }, (r) => { let d=""; r.on("data",c=>d+=c); r.on("end",()=>{ try{resolve(JSON.parse(d));}catch(e){reject(e);} }); });
            req.on("error", reject); req.write(body); req.end();
        });
        if (res.error) console.error("[Email error]", res.error);
        return res;
    } catch(e) { console.error("[Email failed]", e.message); return { error: e.message }; }
}

// ── Email templates ─────────────────────────────────────────────────────────
function emailBase(content, hackName = "HackFest Hub") {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI',system-ui,sans-serif; background: #f4f6f8; color: #1a1a2e; }
    .wrap { max-width: 580px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg,#1e1b4b,#4c1d95); padding: 36px 40px; text-align: center; }
    .header h1 { color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 4px; }
    .header p  { color: rgba(255,255,255,0.6); font-size: 13px; }
    .body   { padding: 36px 40px; }
    .greeting { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 12px; }
    .text   { font-size: 14px; color: #4b5563; line-height: 1.75; margin-bottom: 16px; }
    .card   { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 20px 24px; margin: 20px 0; }
    .card-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
    .card-label { color: #6b7280; }
    .card-value { color: #111827; font-weight: 600; }
    .badge  { display: inline-block; background: #4f46e5; color: #fff; font-size: 12px; font-weight: 700;
      padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px; }
    .btn    { display: inline-block; background: #4f46e5; color: #fff !important; text-decoration: none;
      font-size: 15px; font-weight: 700; padding: 13px 28px; border-radius: 10px;
      margin: 20px 0; text-align: center; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .footer { padding: 24px 40px; background: #f8fafc; border-top: 1px solid #e5e7eb; text-align: center; }
    .footer p { font-size: 12px; color: #9ca3af; line-height: 1.7; }
    .winner { text-align: center; padding: 24px; }
    .medal  { font-size: 64px; display: block; margin-bottom: 12px; }
    .highlight { color: #4f46e5; font-weight: 700; }
  </style></head><body>
  <div class="wrap">
    <div class="header">
      <h1>⚡ HackFest Hub</h1>
      <p>${hackName}</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>You received this because you registered for <strong>${hackName}</strong>.<br>
      Questions? Reply to this email or visit <a href="${SITE_URL}" style="color:#4f46e5">${SITE_URL}</a></p>
    </div>
  </div></body></html>`;
}

// 1. Registration received
function emailRegReceived(reg, hack) {
    return emailBase(`
    <div class="badge">📋 Application Received</div>
    <div class="greeting">Hi ${reg.name}! 👋</div>
    <p class="text">Thank you for registering for <strong>${hack.name}</strong>. We've received your ${reg.type === "judge" ? "judge application" : "team registration"} and will review it shortly.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Event</span><span class="card-value">${hack.name}</span></div>
      <div class="card-row"><span class="card-label">Type</span><span class="card-value" style="text-transform:capitalize">${reg.type}</span></div>
      ${reg.teamName ? `<div class="card-row"><span class="card-label">Team</span><span class="card-value">${reg.teamName}</span></div>` : ""}
      ${hack.startDate ? `<div class="card-row"><span class="card-label">Date</span><span class="card-value">${new Date(hack.startDate).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</span></div>` : ""}
      ${hack.location ? `<div class="card-row"><span class="card-label">Location</span><span class="card-value">${hack.location}</span></div>` : ""}
    </div>
    <p class="text">We'll notify you once your application has been reviewed. Keep an eye on your inbox!</p>
    <a href="${SITE_URL}/register/${hack.id}" class="btn">View Event Page →</a>
  `, hack.name);
}

// 2. Registration approved
function emailRegApproved(reg, hack) {
    return emailBase(`
    <div class="badge" style="background:#10b981">✅ Approved!</div>
    <div class="greeting">Great news, ${reg.name}! 🎉</div>
    <p class="text">Your ${reg.type === "judge" ? "judge application" : "team registration"} for <strong>${hack.name}</strong> has been <strong>approved</strong>. We're thrilled to have you onboard!</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Event</span><span class="card-value">${hack.name}</span></div>
      ${hack.startDate ? `<div class="card-row"><span class="card-label">Date</span><span class="card-value">${new Date(hack.startDate).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</span></div>` : ""}
      ${hack.location ? `<div class="card-row"><span class="card-label">Location</span><span class="card-value">${hack.location}</span></div>` : ""}
      ${hack.prizePool ? `<div class="card-row"><span class="card-label">Prize Pool</span><span class="card-value">${hack.prizePool}</span></div>` : ""}
    </div>
    <p class="text">Save the date and get ready! We'll send you more details as the event approaches.</p>
    <a href="${SITE_URL}/register/${hack.id}" class="btn">View Event Details →</a>
  `, hack.name);
}

// 3. Judge credentials
function emailJudgeCredentials(judge, hack, email, password) {
    return emailBase(`
    <div class="badge" style="background:#7c3aed">⭐ Judge Invitation</div>
    <div class="greeting">Welcome aboard, ${judge.name}! 🌟</div>
    <p class="text">You've been selected as a judge for <strong>${hack.name}</strong>. We're honoured to have your expertise on our panel.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Event</span><span class="card-value">${hack.name}</span></div>
      ${hack.startDate ? `<div class="card-row"><span class="card-label">Date</span><span class="card-value">${new Date(hack.startDate).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</span></div>` : ""}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0">
      <div class="card-row"><span class="card-label">Login Email</span><span class="card-value">${email}</span></div>
      <div class="card-row"><span class="card-label">Password</span><span class="card-value" style="font-family:monospace;background:#f1f5f9;padding:2px 8px;border-radius:4px">${password}</span></div>
    </div>
    <p class="text" style="color:#dc2626">⚠ Please log in and change your password immediately.</p>
    <a href="${SITE_URL}" class="btn">Sign in to Judge Portal →</a>
  `, hack.name);
}

// 4. Event reminder
function emailReminder(name, hack) {
    const daysLeft = hack.startDate ? Math.ceil((new Date(hack.startDate)-Date.now())/864e5) : null;
    return emailBase(`
    <div class="badge" style="background:#f59e0b">⏰ Event Reminder</div>
    <div class="greeting">Hi ${name}! The event is almost here 🚀</div>
    <p class="text"><strong>${hack.name}</strong> starts ${daysLeft === 1 ? "<strong>tomorrow!</strong>" : daysLeft === 0 ? "<strong>today!</strong>" : `in <strong>${daysLeft} days</strong>!`} Make sure you're prepared.</p>
    <div class="card">
      ${hack.startDate ? `<div class="card-row"><span class="card-label">Starts</span><span class="card-value">${new Date(hack.startDate).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</span></div>` : ""}
      ${hack.location ? `<div class="card-row"><span class="card-label">Location</span><span class="card-value">${hack.location}</span></div>` : ""}
      ${hack.registrationDeadline ? `<div class="card-row"><span class="card-label">Reg. Deadline</span><span class="card-value">${hack.registrationDeadline}</span></div>` : ""}
    </div>
    <a href="${SITE_URL}/register/${hack.id}" class="btn">View Event Details →</a>
  `, hack.name);
}

// 5. Winner announcement
function emailWinner(name, teamName, position, hack, prizeInfo) {
    const medals = { "1st":"🥇","2nd":"🥈","3rd":"🥉" };
    const medal = medals[position] || "🏅";
    return emailBase(`
    <div class="winner">
      <span class="medal">${medal}</span>
      <div class="badge" style="background:#f59e0b;font-size:14px">${position} Place — ${hack.name}</div>
    </div>
    <div class="greeting" style="text-align:center">Congratulations, ${name}! 🎊</div>
    <p class="text" style="text-align:center">
      <strong>${teamName}</strong> has achieved <span class="highlight">${position} Place</span> at <strong>${hack.name}</strong>!
      This is a tremendous achievement and a testament to your team's innovation and hard work.
    </p>
    <div class="card" style="text-align:center">
      <div style="font-size:28px;font-weight:800;color:#4f46e5;margin-bottom:4px">${position} Place 🏆</div>
      ${prizeInfo ? `<div style="font-size:16px;color:#6b7280;margin-bottom:8px">${prizeInfo}</div>` : ""}
      <div style="font-size:13px;color:#9ca3af">${hack.name}</div>
    </div>
    <p class="text" style="text-align:center">Your certificate will be issued shortly. Keep building amazing things!</p>
    <a href="${SITE_URL}/register/${hack.id}" class="btn">View Results →</a>
  `, hack.name);
}

// 6. Best Judge award
function emailBestJudge(judge, hack, citation) {
    return emailBase(`
    <div class="winner">
      <span class="medal">🏆</span>
      <div class="badge" style="background:#f59e0b">Best Judge Award</div>
    </div>
    <div class="greeting" style="text-align:center">Congratulations, ${judge.name}! 🌟</div>
    <p class="text" style="text-align:center">
      You have been honoured with the <span class="highlight">Best Judge Award</span> at <strong>${hack.name}</strong>.
      Your dedication to thorough, fair, and insightful evaluation has made a real difference.
    </p>
    ${citation ? `<div class="card" style="text-align:center;font-style:italic;font-size:15px;color:#4b5563">"${citation}"</div>` : ""}
    <p class="text" style="text-align:center">Thank you for your outstanding contribution to this event.</p>
    <a href="${SITE_URL}/register/${hack.id}" class="btn">View Event →</a>
  `, hack.name);
}

// 7. Thank you email (post-event)
function emailThankYou(name, hack, type) {
    return emailBase(`
    <div class="badge" style="background:#10b981">🙏 Thank You!</div>
    <div class="greeting">Dear ${name},</div>
    <p class="text">
      <strong>${hack.name}</strong> has come to a close, and we couldn't have done it without ${
        type==="judge"?"your expert judgment and valuable time":
        type==="mentor"?"your mentorship and guidance":
        type==="sponsor"?"your generous support":
        "your participation and innovative spirit"
      }.
    </p>
    <p class="text">This event brought together brilliant minds to tackle real-world challenges, and your involvement made it truly special.</p>
    <div class="card">
      <p style="font-size:13px;color:#6b7280;line-height:1.7;margin:0">
        We hope to see you at our future events. Stay connected and keep building great things!
      </p>
    </div>
    <a href="${SITE_URL}" class="btn">Visit HackFest Hub →</a>
  `, hack.name);
}

// ── Email trigger routes ─────────────────────────────────────────────────────

// Send registration confirmation (triggered after /api/public/register)
app.post(["/api/email/reg-received","/email/reg-received"], async (req,res)=>{
    const{registrationId}=req.body;
    try{
        const{rows:[reg]}=await q("SELECT r.*,h.name,h.start_date,h.location,h.prize_pool,h.id as hack_id FROM registrations r JOIN hackathons h ON h.id=r.hackathon_id WHERE r.id=$1",[registrationId]);
        if(!reg||!reg.email)return res.json({skipped:"no email"});
        await sendEmail(reg.email,`Application received — ${reg.name}`,emailRegReceived(reg,{name:reg.name,startDate:reg.start_date,location:reg.location,prizePool:reg.prize_pool,id:reg.hack_id}));
        res.json({sent:true});
    }catch(e){res.status(500).json({error:e.message});}
});

// Send approval email
app.post(["/api/email/reg-approved","/email/reg-approved"], admin, async (req,res)=>{
    const{registrationId}=req.body;
    try{
        const{rows:[reg]}=await q("SELECT r.*,h.name,h.start_date,h.location,h.prize_pool,h.id as hack_id FROM registrations r JOIN hackathons h ON h.id=r.hackathon_id WHERE r.id=$1",[registrationId]);
        if(!reg||!reg.email)return res.json({skipped:"no email"});
        await sendEmail(reg.email,`You're in! Application approved — ${reg.name}`,emailRegApproved(reg,{name:reg.name,startDate:reg.start_date,location:reg.location,prizePool:reg.prize_pool,id:reg.hack_id}));
        res.json({sent:true});
    }catch(e){res.status(500).json({error:e.message});}
});

// Send judge credentials
app.post(["/api/email/judge-credentials","/email/judge-credentials"], admin, async (req,res)=>{
    const{userId,hackathonId,tempPassword}=req.body;
    try{
        const{rows:[u]}=await q("SELECT u.*,j.name as judge_name FROM users u LEFT JOIN judges j ON j.id=u.judge_id WHERE u.id=$1",[userId]);
        const{rows:[h]}=await q("SELECT * FROM hackathons WHERE id=$1",[hackathonId]);
        if(!u||!u.email)return res.json({skipped:"no email"});
        const name=u.judge_name||u.name;
        await sendEmail(u.email,`You're a judge at ${h.name} — login details inside`,emailJudgeCredentials({name},h,u.email,tempPassword||"[see your welcome message]"));
        res.json({sent:true});
    }catch(e){res.status(500).json({error:e.message});}
});

// Send event reminder to all approved registrations
app.post(["/api/email/reminder","/email/reminder"], admin, async (req,res)=>{
    const{hackathonId}=req.body;
    try{
        const{rows:regs}=await q("SELECT * FROM registrations WHERE hackathon_id=$1 AND status='approved' AND email IS NOT NULL AND email!=''", [hackathonId]);
        const{rows:[h]}=await q("SELECT * FROM hackathons WHERE id=$1",[hackathonId]);
        let sent=0;
        for(const r of regs){
            await sendEmail(r.email,`Reminder: ${h.name} is coming up!`,emailReminder(r.name,h));
            sent++;
        }
        res.json({sent,total:regs.length});
    }catch(e){res.status(500).json({error:e.message});}
});

// Send winner emails
app.post(["/api/email/winners","/email/winners"], admin, async (req,res)=>{
    const{hackathonId,winners}=req.body; // [{email,name,teamName,position,prizeInfo}]
    try{
        const{rows:[h]}=await q("SELECT * FROM hackathons WHERE id=$1",[hackathonId]);
        let sent=0;
        for(const w of winners){
            if(!w.email)continue;
            await sendEmail(w.email,`🏆 ${w.position} Place — ${h.name}`,emailWinner(w.name,w.teamName,w.position,h,w.prizeInfo));
            sent++;
        }
        res.json({sent});
    }catch(e){res.status(500).json({error:e.message});}
});

// Send best judge award email
app.post(["/api/email/best-judge","/email/best-judge"], admin, async (req,res)=>{
    const{hackathonId}=req.body;
    try{
        const{rows:[h]}=await q("SELECT h.*,j.name as judge_name FROM hackathons h LEFT JOIN judges j ON j.id=h.best_judge_id WHERE h.id=$1",[hackathonId]);
        if(!h?.bestJudgeId)return res.json({skipped:"no best judge set"});
        const{rows:[u]}=await q("SELECT email FROM users WHERE judge_id=$1",[h.best_judge_id||h.bestJudgeId]);
        if(!u?.email)return res.json({skipped:"no email found"});
        await sendEmail(u.email,`🏆 Best Judge Award — ${h.name}`,emailBestJudge({name:h.judge_name},h,h.best_judge_note||h.bestJudgeNote));
        res.json({sent:true,to:u.email});
    }catch(e){res.status(500).json({error:e.message});}
});

// Send thank you to all participants
app.post(["/api/email/thank-you","/email/thank-you"], admin, async (req,res)=>{
    const{hackathonId,audience="all"}=req.body;
    try{
        const{rows:[h]}=await q("SELECT * FROM hackathons WHERE id=$1",[hackathonId]);
        const{rows:regs}=await q("SELECT * FROM registrations WHERE hackathon_id=$1 AND status='approved' AND email!='' AND email IS NOT NULL", [hackathonId]);
        const filtered=audience==="all"?regs:regs.filter(r=>r.type===audience);
        let sent=0;
        for(const r of filtered){
            await sendEmail(r.email,`Thank you for being part of ${h.name}!`,emailThankYou(r.name,h,r.type));
            sent++;
        }
        res.json({sent,total:filtered.length});
    }catch(e){res.status(500).json({error:e.message});}
});

// Admin: test email
app.post(["/api/email/test","/email/test"], admin, async (req,res)=>{
    try{
        const r=await sendEmail(req.user.email,"Test email from HackFest Hub",emailBase(`
      <div class="greeting">Test email works! ✅</div>
      <p class="text">Your Resend API key is configured correctly. Email notifications are live.</p>
      <div class="card"><p style="font-size:13px;color:#6b7280;margin:0">Sent to: ${req.user.email}<br>Time: ${new Date().toISOString()}</p></div>
    `,"HackFest Hub"));
        res.json(r);
    }catch(e){res.status(500).json({error:e.message});}
});

// Check email status
app.get(["/api/email/status","/email/status"], admin, async (_req,res)=>{
    res.json({ configured: !!process.env.RESEND_API_KEY, from: FROM_EMAIL, provider:"Resend" });
});


// ═══════════════════════════════════════════════════════════════════════════
// NEW PLATFORM FEATURES
// ═══════════════════════════════════════════════════════════════════════════

// ── PEOPLE'S CHOICE VOTING ────────────────────────────────────────────────────
// Public vote — one per email address
app.post(["/api/vote","/vote"], async (req,res)=>{
    const{hackathonId,teamId,voterName,voterEmail}=req.body;
    if(!hackathonId||!teamId||!voterName?.trim()||!voterEmail?.trim())
    return res.status(400).json({error:"Name, email, team required"});
    try{
        const{rows:[hack]}=await q("SELECT peoples_choice_open,peoples_choice_end FROM hackathons WHERE id=$1 AND published=true",[hackathonId]);
        if(!hack?.peoples_choice_open)return res.status(403).json({error:"Voting is not open"});
        if(hack.peoples_choice_end&&new Date(hack.peoples_choice_end)<new Date())
        return res.status(403).json({error:"Voting has closed"});
        const ip=((req.headers["x-forwarded-for"]||"").split(",")[0]||"").trim().slice(0,60);
        const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
        await q("INSERT INTO votes(id,hackathon_id,team_id,voter_name,voter_email,ip) VALUES($1,$2,$3,$4,$5,$6)",
            [id,hackathonId,teamId,voterName,voterEmail,ip]);
        res.status(201).json({voted:true});
    }catch(e){
        if(e.constraint==="votes_hackathon_id_voter_email_key"||e.message?.includes("unique"))
        return res.status(409).json({error:"You have already voted in this hackathon"});
        res.status(500).json({error:e.message});
    }
});

app.get(["/api/votes/:hackathonId","/votes/:hackathonId"], async (req,res)=>{
    try{
        const{rows}=await q(
            "SELECT t.id,t.name,t.project,t.category,COUNT(v.id)::int as votes FROM teams t LEFT JOIN votes v ON v.team_id=t.id WHERE t.hackathon_id=$1 GROUP BY t.id ORDER BY votes DESC",
            [req.params.hackathonId]
        ).catch(()=>({rows:[]}));
        res.json(rows.map(camel));
    }catch(e){res.status(500).json({error:e.message});}
});

app.put(["/api/hackathons/:id/voting","/hackathons/:id/voting"], admin, async (req,res)=>{
    const{open,endDate}=req.body;
    try{
        await q("UPDATE hackathons SET peoples_choice_open=$1,peoples_choice_end=$2 WHERE id=$3",
            [Boolean(open),endDate||null,req.params.id]);
        res.json({ok:true});
    }catch(e){res.status(500).json({error:e.message});}
});

// ── TWO-ROUND JUDGING ─────────────────────────────────────────────────────────
// Advance/demote teams between rounds + set current round
app.put(["/api/hackathons/:id/round","/hackathons/:id/round"], admin, async (req,res)=>{
    const{currentRound}=req.body;
    try{
        await q("UPDATE hackathons SET current_round=$1 WHERE id=$2",[currentRound,req.params.id]);
        res.json({ok:true,currentRound});
    }catch(e){res.status(500).json({error:e.message});}
});

// Shortlist a team for finals (reuses submissions.status=shortlisted)
// Already handled by PUT /api/submissions/:id status=shortlisted

// ── PUBLIC PAGE EXTENDED DATA ─────────────────────────────────────────────────
// Update pubpage to include votes + problem statements + community links
// (handled by extending the PUT hackathons route — fields already in migration_v11)

// Vote count for public leaderboard
app.get(["/api/public/votes/:hackathonId","/public/votes/:hackathonId"], async (req,res)=>{
    try{
        const{rows:[h]}=await q("SELECT peoples_choice_open,peoples_choice_end FROM hackathons WHERE id=$1 AND published=true",[req.params.hackathonId]);
        if(!h)return res.status(404).json({error:"Not found"});
        const{rows}=await q(
            "SELECT t.id,t.name,COUNT(v.id)::int as votes FROM teams t LEFT JOIN votes v ON v.team_id=t.id WHERE t.hackathon_id=$1 GROUP BY t.id ORDER BY votes DESC",
            [req.params.hackathonId]
        ).catch(()=>({rows:[]}));
        res.json({open:h.peoples_choice_open,ends:h.peoples_choice_end,results:rows.map(camel)});
    }catch(e){res.status(500).json({error:e.message});}
});

// Registration count for seat counter
app.get(["/api/public/hackathons/:id/registrations-count","/public/hackathons/:id/registrations-count"], async (req,res)=>{
    try{
        const{rows}=await q("SELECT COUNT(*)::int as count FROM registrations WHERE hackathon_id=$1 AND status IN ('pending','approved')",[req.params.id]);
        res.json({count:rows[0]?.count||0});
    }catch(e){res.json({count:0});}
});


// ═══════════════════════════════════════════════════════════════════════════
// DEVPOST-BEATING FEATURES
// ═══════════════════════════════════════════════════════════════════════════

// ── PUBLIC HACKATHON DIRECTORY ────────────────────────────────────────────────
app.get(["/api/public/hackathons","/public/hackathons"], async (req,res)=>{
    try{
        const{search="",status="",limit=20,offset=0}=req.query;
        let sql=`SELECT h.*,
      (SELECT count(*)::int FROM registrations WHERE hackathon_id=h.id AND status='approved') as participants,
      (SELECT count(*)::int FROM submissions WHERE hackathon_id=h.id AND status='submitted') as projects
      FROM hackathons h WHERE h.published=true`;
        const p=[];
        if(status){p.push(status);sql+=` AND h.status=$${p.length}`;}
        if(search){p.push(`%${search}%`);sql+=` AND (h.name ILIKE $${p.length} OR h.tagline ILIKE $${p.length} OR h.tracks ILIKE $${p.length})`;}
        sql+=` ORDER BY CASE h.status WHEN 'active' THEN 1 WHEN 'upcoming' THEN 2 ELSE 3 END, h.start_date DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
        const{rows}=await q(sql,p);
        const{rows:[ct]}=await q(`SELECT count(*)::int as total FROM hackathons WHERE published=true${status?` AND status='${status}'`:""}${search?` AND (name ILIKE '%${search}%' OR tagline ILIKE '%${search}%')`:""}`);
        res.json({hackathons:rows.map(camel),total:ct.total});
    }catch(e){res.status(500).json({error:e.message});}
});

// ── PUBLIC PROJECT GALLERY ────────────────────────────────────────────────────
app.get(["/api/public/projects/:hackathonId","/public/projects/:hackathonId"], async (req,res)=>{
    try{
        const{rows:[h]}=await q("SELECT id,name,status,scoring_released,leaderboard_public FROM hackathons WHERE id=$1 AND published=true",[req.params.hackathonId]);
        if(!h)return res.status(404).json({error:"Not found"});
        const{rows}=await q(`SELECT s.*,t.name as team_name,t.category,t.members,
      (SELECT count(*)::int FROM project_likes WHERE submission_id=s.id) as likes
      FROM submissions s JOIN teams t ON t.id=s.team_id
      WHERE s.hackathon_id=$1 AND s.status IN ('submitted','shortlisted','winner')
      ORDER BY s.status DESC, likes DESC`,[req.params.hackathonId]);
        res.json({hackathon:camel(h),projects:rows.map(camel)});
    }catch(e){res.status(500).json({error:e.message});}
});

app.get(["/api/public/project/:id","/public/project/:id"], async (req,res)=>{
    try{
        const{rows:[sub]}=await q(`SELECT s.*,t.name as team_name,t.category,t.members,
      h.name as hackathon_name,h.start_date,h.banner_color,
      (SELECT count(*)::int FROM project_likes WHERE submission_id=s.id) as likes
      FROM submissions s JOIN teams t ON t.id=s.team_id JOIN hackathons h ON h.id=s.hackathon_id
      WHERE s.id=$1 AND h.published=true`,[req.params.id]);
        if(!sub)return res.status(404).json({error:"Not found"});
        res.json(camel(sub));
    }catch(e){res.status(500).json({error:e.message});}
});

// Like a project
app.post(["/api/projects/:id/like","/projects/:id/like"], async (req,res)=>{
    const{email,name}=req.body;
    if(!email)return res.status(400).json({error:"Email required"});
    try{
        const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
        await q("INSERT INTO project_likes(id,submission_id,liker_email) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[id,req.params.id,email]);
        const{rows:[{count}]}=await q("SELECT count(*)::int as count FROM project_likes WHERE submission_id=$1",[req.params.id]);
        res.json({likes:count});
    }catch(e){res.status(500).json({error:e.message});}
});

// ── PARTICIPANT AUTH ──────────────────────────────────────────────────────────
app.post(["/api/participant/register","/participant/register"], async (req,res)=>{
    const{name,email,password,skills,bio,githubUrl,linkedinUrl,location}=req.body;
    if(!name||!email||!password)return res.status(400).json({error:"Name, email, password required"});
    try{
        const{rows:existing}=await q("SELECT id FROM participants WHERE email=$1",[email]);
        if(existing.length)return res.status(409).json({error:"Email already registered"});
        const hash=await bcrypt.hash(password,10);
        const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
        const{rows:[p]}=await q("INSERT INTO participants(id,name,email,password_hash,bio,skills,github_url,linkedin_url,location) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
            [id,name,email,hash,bio||null,skills||null,githubUrl||null,linkedinUrl||null,location||null]);
        const token=jwt.sign({id:p.id,name:p.name,email:p.email,role:"participant"},process.env.JWT_SECRET||JWT_SECRET,{expiresIn:"30d"});
        res.status(201).json({token,participant:camel(p)});
    }catch(e){res.status(500).json({error:e.message});}
});

app.post(["/api/participant/login","/participant/login"], async (req,res)=>{
    const{email,password}=req.body;
    try{
        const{rows:[p]}=await q("SELECT * FROM participants WHERE email=$1",[email]);
        if(!p)return res.status(401).json({error:"Invalid email or password"});
        const ok=await bcrypt.compare(password,p.password_hash);
        if(!ok){await logEvent("failed",{email,name:p.name,role:"participant"},req,"email");return res.status(401).json({error:"Invalid email or password"});}
        await logEvent("login",{id:p.id,name:p.name,email:p.email,role:"participant"},req,"email");
        const token=jwt.sign({id:p.id,name:p.name,email:p.email,role:"participant"},process.env.JWT_SECRET||JWT_SECRET,{expiresIn:"30d"});
        res.json({token,participant:camel(p)});
    }catch(e){res.status(500).json({error:e.message});}
});

app.get(["/api/participant/me","/participant/me"], async (req,res)=>{
    const token=(req.headers.authorization||"").replace("Bearer ","");
    if(!token)return res.status(401).json({error:"Unauthorized"});
    try{
        const payload=jwt.verify(token,process.env.JWT_SECRET||JWT_SECRET);
        if(payload.role!=="participant")return res.status(403).json({error:"Participant token required"});
        const{rows:[p]}=await q("SELECT * FROM participants WHERE id=$1",[payload.id]);
        if(!p)return res.status(404).json({error:"Not found"});
        // Fetch their hackathon history
        const{rows:history}=await q(`SELECT h.id,h.name,h.status,h.start_date,h.banner_color,t.name as team_name,s.title as project_title,s.status as project_status
      FROM participant_hackathons ph JOIN hackathons h ON h.id=ph.hackathon_id
      LEFT JOIN teams t ON t.id=ph.team_id LEFT JOIN submissions s ON s.team_id=t.id
      WHERE ph.participant_id=$1 ORDER BY h.start_date DESC`,[payload.id]).catch(()=>({rows:[]}));
        res.json({participant:camel(p),history:history.map(camel)});
    }catch(e){res.status(401).json({error:"Invalid token"});}
});

app.put(["/api/participant/profile","/participant/profile"], async (req,res)=>{
    const token=(req.headers.authorization||"").replace("Bearer ","");
    try{
        const{id}=jwt.verify(token,process.env.JWT_SECRET||JWT_SECRET);
        const{name,bio,skills,githubUrl,linkedinUrl,twitterUrl,websiteUrl,avatarUrl,location,lookingForTeam}=req.body;
        const{rows:[p]}=await q("UPDATE participants SET name=$1,bio=$2,skills=$3,github_url=$4,linkedin_url=$5,twitter_url=$6,website_url=$7,avatar_url=$8,location=$9,looking_for_team=$10,updated_at=NOW() WHERE id=$11 RETURNING *",
            [name,bio,skills,githubUrl,linkedinUrl,twitterUrl,websiteUrl,avatarUrl,location,Boolean(lookingForTeam),id]);
        res.json(camel(p));
    }catch(e){res.status(500).json({error:e.message});}
});

// Public participant profile
app.get(["/api/public/participant/:id","/public/participant/:id"], async (req,res)=>{
    try{
        const{rows:[p]}=await q("SELECT id,name,bio,skills,github_url,linkedin_url,twitter_url,website_url,avatar_url,location,looking_for_team,created_at FROM participants WHERE id=$1",[req.params.id]);
        if(!p)return res.status(404).json({error:"Not found"});
        const{rows:history}=await q("SELECT h.id,h.name,h.status,t.name as team_name FROM participant_hackathons ph JOIN hackathons h ON h.id=ph.hackathon_id LEFT JOIN teams t ON t.id=ph.team_id WHERE ph.participant_id=$1",
            [req.params.id]).catch(()=>({rows:[]}));
        res.json({participant:camel(p),history:history.map(camel)});
    }catch(e){res.status(500).json({error:e.message});}
});

// ── TEAM FORMATION BOARD ──────────────────────────────────────────────────────
app.get(["/api/public/team-formation/:hackathonId","/public/team-formation/:hackathonId"], async (req,res)=>{
    try{
        const{rows}=await q(`SELECT tf.*,p.name as participant_name,p.skills as participant_skills,p.avatar_url
      FROM team_formation tf JOIN participants p ON p.id=tf.participant_id
      WHERE tf.hackathon_id=$1 ORDER BY tf.created_at DESC`,[req.params.hackathonId]).catch(()=>({rows:[]}));
        res.json(rows.map(camel));
    }catch(e){res.status(500).json({error:e.message});}
});

app.post(["/api/team-formation","/team-formation"], async (req,res)=>{
    const{hackathonId,participantId,type,skillsOffered,skillsNeeded,message}=req.body;
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    try{
        const{rows:[r]}=await q("INSERT INTO team_formation(id,hackathon_id,participant_id,type,skills_offered,skills_needed,message) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
            [id,hackathonId,participantId,type,skillsOffered,skillsNeeded,message]);
        res.status(201).json(camel(r));
    }catch(e){res.status(500).json({error:e.message});}
});

// ── Q&A / DISCUSSION ─────────────────────────────────────────────────────────
app.get(["/api/public/questions/:hackathonId","/public/questions/:hackathonId"], async (req,res)=>{
    try{
        const{rows}=await q("SELECT * FROM questions WHERE hackathon_id=$1 AND public=true ORDER BY pinned DESC,upvotes DESC,created_at DESC",
            [req.params.hackathonId]).catch(()=>({rows:[]}));
        res.json(rows.map(camel));
    }catch(e){res.status(500).json({error:e.message});}
});

app.post(["/api/public/questions","/public/questions"], async (req,res)=>{
    const{hackathonId,askerName,askerEmail,question}=req.body;
    if(!question?.trim()||!askerName?.trim())return res.status(400).json({error:"Name and question required"});
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    try{
        const{rows:[r]}=await q("INSERT INTO questions(id,hackathon_id,asker_name,asker_email,question) VALUES($1,$2,$3,$4,$5) RETURNING *",
            [id,hackathonId,askerName,askerEmail,question]);
        res.status(201).json(camel(r));
    }catch(e){res.status(500).json({error:e.message});}
});

app.put(["/api/questions/:id/answer","/questions/:id/answer"], admin, async (req,res)=>{
    const{answer,pinned}=req.body;
    try{
        const{rows:[r]}=await q("UPDATE questions SET answer=$1,answered_by=$2,answered_at=NOW(),pinned=COALESCE($3,pinned) WHERE id=$4 RETURNING *",
            [answer,req.user.id,pinned,req.params.id]);
        res.json(camel(r));
    }catch(e){res.status(500).json({error:e.message});}
});

app.post(["/api/questions/:id/upvote","/questions/:id/upvote"], async (req,res)=>{
    try{
        await q("UPDATE questions SET upvotes=upvotes+1 WHERE id=$1",[req.params.id]);
        res.json({ok:true});
    }catch(e){res.status(500).json({error:e.message});}
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
