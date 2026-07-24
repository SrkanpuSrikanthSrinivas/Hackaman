require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const fetch    = require("node-fetch");
const { Pool } = require("pg");

// ── Canonical public URL ──────────────────────────────────────────────────
// Prefers CANONICAL_URL, then FRONTEND_URL, but never a *.vercel.app preview
// domain — those change per deploy and shouldn't end up in emails or invites.
const CANONICAL_SITE = (() => {
    const fallback = "https://hackfesthub.com";
    const raw = (process.env.CANONICAL_URL || process.env.FRONTEND_URL || "").trim();
    if (!raw) return fallback;
    if (/vercel\.app$/i.test(raw.replace(/\/+$/, ""))) return fallback;
    return raw.replace(/\/+$/, "");
})();
function siteUrl() { return CANONICAL_SITE; }


const JWT_SECRET   = process.env.JWT_SECRET || "hackfest-dev-secret";
const FRONTEND_URL = siteUrl();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });
async function q(sql, p = []) {
    const client = await pool.connect();
    try { return await client.query(sql, p); } finally { client.release(); }
}

// ── Audit log helper ─────────────────────────────────────────────────────────
async function logEvent(action, user, req, method = "email") {
    try {
        // Auto-create table if migration_v9 hasn't been run
        await q(`CREATE TABLE IF NOT EXISTS login_logs (
      id VARCHAR(20) PRIMARY KEY, user_id VARCHAR(20), name VARCHAR(255),
      email VARCHAR(255), role VARCHAR(20), action VARCHAR(20) NOT NULL,
      method VARCHAR(30), ip VARCHAR(60), user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch(()=>{});

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

    // Team users: auto-resolve their hackathon from their linked team or registration
    let teamHackathonId = null, teamName = null;
    if (user.role === "team") {
        if (user.team_id) {
            const { rows: [t] } = await q("SELECT hackathon_id, name FROM teams WHERE id=$1", [user.team_id]).catch(()=>({rows:[]}));
            teamHackathonId = t?.hackathon_id || null;
            teamName = t?.name || null;
        }
        if (!teamHackathonId && user.email) {
            const { rows: [reg] } = await q(
                "SELECT r.hackathon_id, r.team_name FROM registrations r WHERE LOWER(r.email)=LOWER($1) ORDER BY r.created_at DESC LIMIT 1",
                [user.email]
            ).catch(()=>({rows:[]}));
            teamHackathonId = reg?.hackathon_id || null;
            teamName = teamName || reg?.team_name || null;
        }
    }

    return {
        id: user.id, name: user.name, email: user.email,
        role: user.role, judgeId: user.judge_id,
        teamId: user.team_id || null, teamName,
        avatarUrl: user.avatar_url,
        assignedHackathons: user.role === "team"
        ? (teamHackathonId ? [teamHackathonId] : [])
        : hj.map(r => r.hackathon_id),
        hackathonId: teamHackathonId,   // auto-select for team users
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
        const { rows: users } = await q("SELECT id,name,email,role,judge_id,team_id,avatar_url,oauth_provider,created_at FROM users ORDER BY role,name");
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
    const { name, email, password, role = "judge", judgeId, teamId } = req.body;
    if (!name?.trim() || !email?.trim() || !password?.trim()) return res.status(400).json({ error: "name, email, and password required" });
    try {
        const hash = await bcrypt.hash(password, 10);
        const { rows } = await q(
            "INSERT INTO users (id,name,email,password_hash,role,judge_id,team_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,email,role,judge_id,team_id",
            [uid(), name, email.toLowerCase(), hash, role, judgeId||null, teamId||null]
        );
        res.status(201).json({ ...camel(rows[0]), assignedHackathons: [], permissions: [] });
    } catch (e) {
        if (e.code === "23505") return res.status(409).json({ error: "Email already in use" });
        res.status(500).json({ error: e.message });
    }
});

app.put(["/api/users/:id", "/users/:id"], admin, async (req, res) => {
    const { name, email, password, role, judgeId, teamId } = req.body;
    try {
        const hash = password ? await bcrypt.hash(password, 10) : null;
        const params = hash
        ? [name, email.toLowerCase(), hash, role, judgeId||null, teamId||null, req.params.id]
        : [name, email.toLowerCase(), role, judgeId||null, teamId||null, req.params.id];
        const sql = hash
        ? "UPDATE users SET name=$1,email=$2,password_hash=$3,role=$4,judge_id=$5,team_id=$6 WHERE id=$7 RETURNING id,name,email,role,judge_id,team_id"
        : "UPDATE users SET name=$1,email=$2,role=$3,judge_id=$4,team_id=$5 WHERE id=$6 RETURNING id,name,email,role,judge_id,team_id";
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
    const hid = req.params.id;
    const purged = { teams:0, judges:0, teamLogins:0, judgeLogins:0, submissions:0, registrations:0 };
    try {
        // 1. Team IDs for this hackathon
        const { rows: teamRows } = await q("SELECT id FROM teams WHERE hackathon_id=$1", [hid]).catch(()=>({rows:[]}));
        const teamIds = teamRows.map(r=>r.id);

        // 2. Judge-user IDs assigned to this hackathon (judges are global; link via hackathon_judges)
        const { rows: judgeUserRows } = await q(
            "SELECT u.id AS user_id, u.judge_id FROM users u JOIN hackathon_judges hj ON hj.user_id=u.id WHERE hj.hackathon_id=$1 AND u.role='judge'",
            [hid]
        ).catch(()=>({rows:[]}));
        const judgeUserIds = judgeUserRows.map(r=>r.user_id);
        const judgeIds     = [...new Set(judgeUserRows.map(r=>r.judge_id).filter(Boolean))];

        // 3. Delete team logins linked to those teams
        if (teamIds.length) {
            const r = await q("DELETE FROM users WHERE role='team' AND team_id = ANY($1::varchar[])", [teamIds]).catch(()=>({rowCount:0}));
            purged.teamLogins = r.rowCount || 0;
        }

        // 4. Delete judge logins assigned to this hackathon
        if (judgeUserIds.length) {
            const r = await q("DELETE FROM users WHERE id = ANY($1::varchar[])", [judgeUserIds]).catch(()=>({rowCount:0}));
            purged.judgeLogins = r.rowCount || 0;
        }

        // 5. Remove hackathon_judges rows for this hackathon
        await q("DELETE FROM hackathon_judges WHERE hackathon_id=$1", [hid]).catch(()=>{});

        // 6. Delete judge records that are now orphaned (no remaining user links)
        let deletedJudges = 0;
        for (const jid of judgeIds) {
            const { rows: stillLinked } = await q("SELECT 1 FROM users WHERE judge_id=$1 LIMIT 1", [jid]).catch(()=>({rows:[]}));
            if (!stillLinked.length) {
                await q("DELETE FROM feedbacks WHERE judge_id=$1", [jid]).catch(()=>{});
                await q("DELETE FROM judges WHERE id=$1", [jid]).catch(()=>{});
                deletedJudges++;
            }
        }

        // 7. Count cascade-deleted items for the summary
        const { rows:[sc] } = await q("SELECT count(*)::int c FROM submissions WHERE hackathon_id=$1", [hid]).catch(()=>({rows:[{c:0}]}));
        const { rows:[rc] } = await q("SELECT count(*)::int c FROM registrations WHERE hackathon_id=$1", [hid]).catch(()=>({rows:[{c:0}]}));
        purged.submissions   = sc.c;
        purged.registrations = rc.c;
        purged.teams  = teamIds.length;
        purged.judges = deletedJudges;

        // 8. Delete teams for this hackathon
        await q("DELETE FROM teams WHERE hackathon_id=$1", [hid]).catch(()=>{});

        // 7. Finally delete the hackathon — cascades submissions, registrations, criteria,
        //    feedbacks, votes, announcements, mentors, checkins, etc. via ON DELETE CASCADE
        await q("DELETE FROM hackathons WHERE id=$1", [hid]);

        res.json({ deleted:true, purged });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── JUDGES / TEAMS / CRITERIA (standard CRUD) ───────────────────────────────
app.get(["/api/judges", "/judges"], auth, async (_req, res) => {
    try {
        const { rows } = await q("SELECT * FROM judges ORDER BY name");
        // Attach the list of hackathon IDs each judge is assigned to (via linked users)
        const { rows: links } = await q(`
      SELECT u.judge_id, hj.hackathon_id, u.email
      FROM users u JOIN hackathon_judges hj ON hj.user_id = u.id
      WHERE u.judge_id IS NOT NULL
    `).catch(()=>({rows:[]}));
        const byJudge = {};
        links.forEach(l => {
            if (!byJudge[l.judge_id]) byJudge[l.judge_id] = { hacks:new Set(), email:l.email };
            byJudge[l.judge_id].hacks.add(l.hackathon_id);
        });
        const enriched = rows.map(j => {
            const link = byJudge[j.id];
            return {
                ...camel(j),
                email: link?.email || null,
                hackathonIds: link ? [...link.hacks] : [],
            };
        });
        res.json(enriched);
    } catch (e) { res.status(500).json({ error: e.message }); }
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
        const reg = camel(rows[0]);

        // Send "we got your registration" email immediately
        try {
            const { rows: [h] } = await q("SELECT * FROM hackathons WHERE id=$1", [hackathonId]);
            sendEmail(reg.email,
                `Registration received — ${h?.name || "HackFest Hub"}`,
                emailRegReceived(reg, h || {})
            ).catch(()=>{});
        } catch(_) {}

        res.status(201).json(reg);
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

        // On approval: auto-create team/judge record + user login + send email
        let autoResult = { teamCreated:false, judgeCreated:false, loginCreated:false, tempPassword:null };

        if (req.body.status === "approved" && reg.email) {
            const { rows: [h] } = await q("SELECT * FROM hackathons WHERE id=$1", [reg.hackathonId]);
            const DEFAULT_PASSWORD = "hackfest123";  // default password, user changes later
            const isJudge = reg.type === "judge";

            try {
                if (isJudge) {
                    // ── Auto-create judge record (schema: id,name,org,role,avatar_url — NO hackathon_id) ──
                    // Judges are global; they link to a hackathon via users.judge_id + hackathon_judges.
                    // Find an existing judge by matching a linked user with this email.
                    let judgeId = null;
                    const { rows: linkedUser } = await q(
                        "SELECT judge_id FROM users WHERE LOWER(email)=LOWER($1) AND judge_id IS NOT NULL LIMIT 1",
                        [reg.email]
                    ).catch(()=>({rows:[]}));
                    if (linkedUser.length) judgeId = linkedUser[0].judge_id;

                    if (!judgeId) {
                        judgeId = "j" + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
                        await q(
                            "INSERT INTO judges(id,name,org,role) VALUES($1,$2,$3,$4)",
                            [judgeId, reg.name, reg.organization || reg.org || null, reg.title || reg.role || "Judge"]
                        );
                        autoResult.judgeCreated = true;
                    }

                    // ── Auto-create judge user login + assign to this hackathon ──
                    const { rows: existingUser } = await q("SELECT id FROM users WHERE LOWER(email)=LOWER($1)", [reg.email]);
                    let judgeUserId;
                    if (!existingUser.length) {
                        const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
                        judgeUserId = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
                        await q(
                            "INSERT INTO users(id,name,email,password_hash,role,judge_id) VALUES($1,$2,LOWER($3),$4,'judge',$5)",
                            [judgeUserId, reg.name, reg.email, hash, judgeId]
                        );
                        autoResult.loginCreated = true;
                        autoResult.tempPassword = DEFAULT_PASSWORD;
                    } else {
                        judgeUserId = existingUser[0].id;
                        // Ensure the existing user is linked to the judge record
                        await q("UPDATE users SET judge_id=$1 WHERE id=$2 AND judge_id IS NULL", [judgeId, judgeUserId]).catch(()=>{});
                    }

                    // Assign this judge-user to the hackathon (so they appear + can judge)
                    await q(
                        "INSERT INTO hackathon_judges(user_id,hackathon_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
                        [judgeUserId, reg.hackathonId]
                    ).catch(()=>{});
                } else {
                    // ── Auto-create team record ──
                    const teamName = reg.teamName || reg.name;
                    const { rows: existingTeam } = await q(
                        "SELECT id FROM teams WHERE hackathon_id=$1 AND LOWER(name)=LOWER($2)",
                        [reg.hackathonId, teamName]
                    );

                    let teamId;
                    if (existingTeam.length) {
                        teamId = existingTeam[0].id;
                    } else {
                        teamId = Date.now().toString(36) + Math.random().toString(36).slice(2,5);
                        await q(
                            "INSERT INTO teams(id,hackathon_id,name,project,category,members) VALUES($1,$2,$3,$4,$5,$6)",
                            [teamId, reg.hackathonId, teamName, reg.project||null, reg.category||reg.track||null, reg.members||reg.name||null]
                        );
                        autoResult.teamCreated = true;
                    }

                    // ── Auto-create team user login ──
                    const { rows: existingUser } = await q("SELECT id FROM users WHERE LOWER(email)=LOWER($1)", [reg.email]);
                    if (!existingUser.length) {
                        const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
                        const uid2 = Date.now().toString(36) + Math.random().toString(36).slice(2,5);
                        await q(
                            "INSERT INTO users(id,name,email,password_hash,role,team_id) VALUES($1,$2,LOWER($3),$4,'team',$5)",
                            [uid2, reg.name, reg.email, hash, teamId]
                        );
                        autoResult.loginCreated = true;
                        autoResult.tempPassword = DEFAULT_PASSWORD;
                    }
                }
            } catch(autoErr) {
                console.error("Auto-provision on approve:", autoErr.message);
            }

            // ── Send approval email with login credentials ──
            const creds = { email: reg.email, password: DEFAULT_PASSWORD };
            try {
                sendEmail(
                    reg.email,
                    `You're in! Sign in to ${h?.name || "the hackathon"}`,
                    emailRegApproved(reg, h || {}, creds)
                ).catch(()=>{});
            } catch(_) {
                sendEmail(reg.email, "Application approved", emailRegApproved(reg, h || {})).catch(()=>{});
            }
        }

        res.json({ ...reg, ...autoResult });
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
const SITE_URL   = siteUrl();


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

// 2. Registration approved (with login credentials)
function emailRegApproved(reg, hack, creds) {
    const isJudge = reg.type === "judge";
    const loginUrl = `${SITE_URL}/register/${hack.id}`;
    const credBlock = creds ? `
    <div style="background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:12px;padding:20px 24px;margin:22px 0;">
      <div style="font-size:12px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">
        🔑 Your login credentials
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6366f1;width:90px;">Sign in at</td>
          <td style="padding:6px 0;font-size:13px;color:#1e1b4b;font-weight:600;">
            <a href="${loginUrl}" style="color:#4f46e5;text-decoration:none;">${loginUrl}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6366f1;">Email</td>
          <td style="padding:6px 0;font-size:14px;color:#1e1b4b;font-weight:700;font-family:monospace;">${creds.email}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6366f1;">Password</td>
          <td style="padding:6px 0;">
            <code style="background:#fff;border:1px solid #c7d2fe;padding:4px 10px;border-radius:6px;font-size:14px;font-weight:700;color:#4338ca;letter-spacing:0.03em;">${creds.password}</code>
          </td>
        </tr>
      </table>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid #c7d2fe;font-size:12px;color:#4338ca;line-height:1.6;">
        ⚠ <strong>Change your password</strong> after your first sign-in — click your name in the top-right, then <strong>Change password</strong>.
      </div>
    </div>` : "";

    const nextSteps = isJudge ? `
    <div style="margin:20px 0;">
      <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:10px;">What you can do now</div>
      <div style="font-size:14px;color:#4b5563;line-height:1.9;">
        • Sign in and review the teams assigned to you<br>
        • View each team's project submission in detail<br>
        • Score teams against the judging criteria<br>
        • Leave written feedback for each team
      </div>
    </div>` : `
    <div style="margin:20px 0;">
      <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:10px;">What you can do now</div>
      <div style="font-size:14px;color:#4b5563;line-height:1.9;">
        • Sign in to see your team dashboard<br>
        • Submit your project — title, description, tech stack, and links<br>
        • Update your submission anytime before the deadline
      </div>
    </div>`;

    return emailBase(`
    <div class="badge" style="background:#10b981">✅ Approved!</div>
    <div class="greeting">Great news, ${reg.name}! 🎉</div>
    <p class="text">Your ${isJudge ? "judge application" : "team registration"} for <strong>${hack.name}</strong> has been <strong>approved</strong>. We're thrilled to have you onboard!</p>
    ${credBlock}
    <div class="card">
      <div class="card-row"><span class="card-label">Event</span><span class="card-value">${hack.name}</span></div>
      ${hack.startDate ? `<div class="card-row"><span class="card-label">Date</span><span class="card-value">${new Date(hack.startDate).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</span></div>` : ""}
      ${hack.location ? `<div class="card-row"><span class="card-label">Location</span><span class="card-value">${hack.location}</span></div>` : ""}
      ${hack.prizePool ? `<div class="card-row"><span class="card-label">Prize Pool</span><span class="card-value">${hack.prizePool}</span></div>` : ""}
    </div>
    ${nextSteps}
    <a href="${loginUrl}" class="btn">Sign in now →</a>
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
        await ensureFormationTable();
        const{rows}=await q(
            `SELECT id,hackathon_id,type,name,team_name,contact,skills_offered,skills_needed,message,status,created_at
             FROM team_formation
             WHERE hackathon_id=$1 AND COALESCE(status,'open')='open'
             ORDER BY created_at DESC LIMIT 100`,
            [req.params.hackathonId]
        ).catch(()=>({rows:[]}));
        // Email is intentionally omitted from the public payload
        res.json(rows.map(camel));
    }catch(e){res.json([]);}
});

// Express interest in a listing — relays a message by email, never exposes addresses
app.post(["/api/team-formation/:id/contact","/team-formation/:id/contact"], async (req,res)=>{
    const{fromName,fromEmail,message}=req.body;
    if(!fromName?.trim()||!fromEmail?.trim())
    return res.status(400).json({error:"Your name and email are required"});
    try{
        const{rows:[l]}=await q("SELECT * FROM team_formation WHERE id=$1",[req.params.id]);
        if(!l) return res.status(404).json({error:"Listing not found"});
        const{rows:[h]}=await q("SELECT name FROM hackathons WHERE id=$1",[l.hackathon_id]);

        const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
      <body style="font-family:'Segoe UI',sans-serif;background:#f4f6f8;padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#1e1b4b,#4c1d95);padding:30px 34px;">
          <h1 style="color:#fff;font-size:20px;margin:0 0 4px;">🤝 Someone wants to team up</h1>
          <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0;">${h?.name||"HackFest Hub"}</p>
        </div>
        <div style="padding:28px 34px;">
          <p style="font-size:15px;color:#334155;line-height:1.7;">Hi ${l.name},</p>
          <p style="font-size:14px;color:#4b5563;line-height:1.7;">
            <strong>${fromName}</strong> saw your post on the team formation board and wants to connect.
          </p>
          ${message?`<div style="background:#f8fafc;border-left:3px solid #4f46e5;padding:14px 16px;margin:16px 0;border-radius:0 8px 8px 0;font-size:14px;color:#334155;line-height:1.7;">${String(message).replace(/</g,"&lt;")}</div>`:""}
          <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:14px 18px;margin:18px 0;">
            <div style="font-size:12px;color:#4338ca;font-weight:600;margin-bottom:4px;">Reply to them at</div>
            <a href="mailto:${fromEmail}" style="font-size:15px;color:#4f46e5;font-weight:700;text-decoration:none;">${fromEmail}</a>
          </div>
        </div>
      </div></body></html>`;

        sendEmail(l.email, `${fromName} wants to team up — ${h?.name||"hackathon"}`, html).catch(()=>{});
        res.json({ok:true});
    }catch(e){res.status(500).json({error:e.message});}
});

async function ensureFormationTable() {
    await q(`CREATE TABLE IF NOT EXISTS team_formation (
    id VARCHAR(20) PRIMARY KEY, hackathon_id VARCHAR(20) NOT NULL,
    participant_id VARCHAR(20), type VARCHAR(20) NOT NULL,
    skills_offered TEXT, skills_needed TEXT, message TEXT,
    name VARCHAR(255), email VARCHAR(255), contact VARCHAR(500),
    team_name VARCHAR(255), status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`).catch(()=>{});
    for (const col of ["name VARCHAR(255)","email VARCHAR(255)","contact VARCHAR(500)","team_name VARCHAR(255)","status VARCHAR(20) DEFAULT 'open'"]) {
        await q(`ALTER TABLE team_formation ADD COLUMN IF NOT EXISTS ${col}`).catch(()=>{});
    }
    await q("ALTER TABLE team_formation ALTER COLUMN participant_id DROP NOT NULL").catch(()=>{});
}

// Post a "looking for team" / "looking for members" listing — no account needed
app.post(["/api/team-formation","/team-formation"], async (req,res)=>{
    const{hackathonId,type,name,email,contact,teamName,skillsOffered,skillsNeeded,message}=req.body;
    if(!hackathonId||!type)     return res.status(400).json({error:"hackathonId and type are required"});
    if(!name?.trim())           return res.status(400).json({error:"Your name is required"});
    if(!email?.trim())          return res.status(400).json({error:"Your email is required"});
    if(!["seeking_team","seeking_members"].includes(type))
    return res.status(400).json({error:"type must be seeking_team or seeking_members"});
    try{
        await ensureFormationTable();
        const id="tf"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
        const{rows:[r]}=await q(
            `INSERT INTO team_formation(id,hackathon_id,type,name,email,contact,team_name,skills_offered,skills_needed,message,status)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open') RETURNING *`,
            [id,hackathonId,type,name.trim(),email.trim().toLowerCase(),contact||null,
                teamName||null,skillsOffered||null,skillsNeeded||null,message||null]
        );
        res.status(201).json(camel(r));
    }catch(e){res.status(500).json({error:e.message});}
});

// Close / remove a listing (creator confirms via email)
app.post(["/api/team-formation/:id/close","/team-formation/:id/close"], async (req,res)=>{
    const{email}=req.body;
    try{
        const{rows:[r]}=await q("SELECT email FROM team_formation WHERE id=$1",[req.params.id]);
        if(!r) return res.status(404).json({error:"Listing not found"});
        if((r.email||"").toLowerCase()!==(email||"").toLowerCase())
        return res.status(403).json({error:"Enter the email you used when posting to close this listing"});
        await q("UPDATE team_formation SET status='closed' WHERE id=$1",[req.params.id]);
        res.json({ok:true});
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


// ═══════════════════════════════════════════════════════════════════════════
// SEO — Sitemap, robots.txt, Event Schema API
// ═══════════════════════════════════════════════════════════════════════════

// ── robots.txt ────────────────────────────────────────────────────────────────
app.get(["/robots.txt"], async (_req, res) => {
    const SITE = siteUrl();
    res.type("text/plain").send(
        `User-agent: *
        Allow: /
        Allow: /register/
        Allow: /hackathons
        Disallow: /admin
        Disallow: /api/

        Sitemap: ${SITE}/sitemap.xml`
    );
});

// ── XML Sitemap ───────────────────────────────────────────────────────────────
app.get(["/sitemap.xml"], async (_req, res) => {
    const SITE = siteUrl();
    try {
        const { rows: hacks } = await q(
            "SELECT id, name, updated_at FROM hackathons WHERE published=true ORDER BY updated_at DESC"
        );

        const urls = [
            // Static pages
            { loc: SITE, priority: "1.0", changefreq: "daily" },
            { loc: `${SITE}/hackathons`, priority: "0.9", changefreq: "daily" },
            { loc: `${SITE}/demo`, priority: "0.8", changefreq: "monthly" },
            { loc: `${SITE}/winners`, priority: "0.8", changefreq: "weekly" },
        ];

        // Dynamic hackathon pages
        hacks.forEach(h => {
            const lastmod = h.updated_at
            ? new Date(h.updated_at).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0];
            urls.push({
                loc: `${SITE}/projects/${h.id}`,
                lastmod,
                priority: "0.7",
                changefreq: "weekly",
            });
            urls.push({
                loc: `${SITE}/register/${h.id}`,
                lastmod,
                priority: "0.8",
                changefreq: "weekly",
            });
        });

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

        res.type("application/xml").send(xml);
    } catch(e) {
        res.status(500).send("<?xml version='1.0'?><urlset/>");
    }
});

// ── Event Schema JSON-LD (per hackathon) ──────────────────────────────────────
// Used by PublicPage to inject into <head> for Google rich results
app.get(["/api/public/schema/:hackathonId", "/public/schema/:hackathonId"], async (req, res) => {
    const SITE = siteUrl();
    try {
        const { rows: [h] } = await q(
            "SELECT * FROM hackathons WHERE id=$1 AND published=true",
            [req.params.hackathonId]
        );
        if (!h) return res.status(404).json({ error: "Not found" });

        const hack = camel(h);
        const eventUrl = `${SITE}/register/${hack.id}`;

        // Build location object
        const location = hack.location
        ? { "@type": "Place", "name": hack.location, "address": { "@type": "PostalAddress", "addressLocality": hack.location } }
        : { "@type": "VirtualLocation", "url": eventUrl };

        const schema = {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": hack.name,
            "description": hack.description || hack.tagline || `${hack.name} — an exciting hackathon event`,
            "url": eventUrl,
            "startDate": hack.startDate || new Date().toISOString(),
            "endDate": hack.endDate || hack.startDate || new Date().toISOString(),
            "eventStatus": hack.status === "completed"
            ? "https://schema.org/EventScheduled"
            : "https://schema.org/EventScheduled",
            "eventAttendanceMode": hack.location
            ? "https://schema.org/OfflineEventAttendanceMode"
            : "https://schema.org/OnlineEventAttendanceMode",
            "location": location,
            "image": hack.eventLogoUrl
            ? [hack.eventLogoUrl]
            : [`${SITE}/og-default.png`],
            "organizer": {
                "@type": "Organization",
                "name": "HackFest Hub",
                "url": SITE,
            },
            "offers": {
                "@type": "Offer",
                "url": eventUrl,
                "price": "0",
                "priceCurrency": "USD",
                "availability": hack.status === "active"
                ? "https://schema.org/InStock"
                : "https://schema.org/PreOrder",
                "validFrom": hack.startDate || new Date().toISOString(),
            },
        };

        if (hack.prizePool) {
            schema["award"] = hack.prizePool;
        }
        if (hack.maxParticipants) {
            schema["maximumAttendeeCapacity"] = hack.maxParticipants;
        }

        res.json(schema);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── OG Image meta (returns meta tags HTML snippet) ───────────────────────────
app.get(["/api/public/meta/:hackathonId", "/public/meta/:hackathonId"], async (req, res) => {
    const SITE = siteUrl();
    try {
        const { rows: [h] } = await q(
            "SELECT name, tagline, description, banner_color, event_logo_url, location, start_date, prize_pool FROM hackathons WHERE id=$1 AND published=true",
            [req.params.hackathonId]
        );
        if (!h) return res.status(404).json({ error: "Not found" });
        const hack = camel(h);
        const title = hack.name;
        const desc = hack.tagline || hack.description || `Join ${hack.name} — an exciting hackathon event on HackFest Hub`;
        const image = hack.eventLogoUrl || `${SITE}/og-default.png`;
        const url = `${SITE}/register/${req.params.hackathonId}`;
        res.json({ title, description: desc, image, url,
            keywords: `hackathon, ${hack.name}, ${hack.location||"online"}, coding competition, innovation` });
    } catch(e) { res.status(500).json({ error: e.message }); }
});


// ═══════════════════════════════════════════════════════════════════════════
// EXCEL BULK IMPORT — Teams + Members
// ═══════════════════════════════════════════════════════════════════════════

app.post(["/api/teams/bulk-import", "/teams/bulk-import"], admin, async (req, res) => {
    const { hackathonId, teams, mode = "skip" } = req.body;
    // mode: "skip" = skip existing team names | "overwrite" = update existing

    if (!hackathonId || !Array.isArray(teams) || !teams.length)
    return res.status(400).json({ error: "hackathonId and teams[] required" });

    const results = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (const team of teams) {
        if (!team.name?.trim()) { results.errors.push(`Row skipped: missing team name`); continue; }

        try {
            // Check if team already exists
            const { rows: existing } = await q(
                "SELECT id FROM teams WHERE hackathon_id=$1 AND LOWER(name)=LOWER($2)",
                [hackathonId, team.name.trim()]
            );

            let teamId;

            if (existing.length) {
                if (mode === "skip") {
                    results.skipped++;
                    continue;
                }
                // overwrite — update team
                teamId = existing[0].id;
                await q(
                    "UPDATE teams SET project=$1,category=$2,members=$3,updated_at=NOW() WHERE id=$4",
                    [team.project||null, team.category||null,
                        team.members?.map(m=>m.name).join(", ")||null, teamId]
                );
                results.updated++;
            } else {
                // Create new team
                teamId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                const memberNames = team.members?.map(m => m.name).filter(Boolean).join(", ") || null;
                await q(
                    "INSERT INTO teams(id,hackathon_id,name,project,category,members) VALUES($1,$2,$3,$4,$5,$6)",
                    [teamId, hackathonId, team.name.trim(),
                        team.project?.trim()||null, team.category?.trim()||null, memberNames]
                );
                results.created++;
            }

            // Insert participants + team_members if we have member emails
            if (team.members?.length) {
                for (const member of team.members) {
                    if (!member.name?.trim()) continue;
                    try {
                        // Try to link to participant account if email matches
                        if (member.email?.trim()) {
                            const { rows: [p] } = await q(
                                "SELECT id FROM participants WHERE email=LOWER($1)",
                                [member.email.trim()]
                            ).catch(() => ({ rows: [] }));

                            if (p) {
                                const mId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
                                await q(
                                    "INSERT INTO team_members(id,team_id,participant_id,role,status) VALUES($1,$2,$3,$4,'accepted') ON CONFLICT(team_id,participant_id) DO NOTHING",
                                    [mId, teamId, p.id, member.role?.trim()||"Member"]
                                ).catch(() => {});
                            }
                        }
                    } catch(_) { /* non-fatal */ }
                }
            }
        } catch(e) {
            results.errors.push(`Team "${team.name}": ${e.message}`);
        }
    }

    res.json({ ...results, total: teams.length });
});

// Template columns info (for frontend reference)
app.get(["/api/teams/import-template-info", "/teams/import-template-info"], auth, (_req, res) => {
    res.json({
        format: "normalized",
        description: "One row per team member. Teams are grouped by Team Name.",
        columns: [
            { key: "teamName",    label: "Team Name *",    required: true,  example: "Team Alpha"      },
            { key: "projectName", label: "Project Name",   required: false, example: "AI Health Scanner"},
            { key: "category",    label: "Track / Category",required:false,  example: "AI/ML"           },
            { key: "memberName",  label: "Member Name *",  required: true,  example: "John Smith"      },
            { key: "memberEmail", label: "Member Email",   required: false, example: "john@example.com"},
            { key: "memberRole",  label: "Member Role",    required: false, example: "Team Lead"       },
        ],
        notes: [
            "Repeat Team Name for each member of the same team",
            "First row for a team sets the Project Name and Track",
            "Maximum 5 members per team recommended",
            "Duplicate team names are skipped by default",
        ]
    });
});


// ═══════════════════════════════════════════════════════════════════════════
// TEAM PORTAL — Login, submission, dashboard
// ═══════════════════════════════════════════════════════════════════════════

// ── Team portal: register or login with registration email ─────────────────
app.post(["/api/portal/auth","/portal/auth"], async (req,res)=>{
    const{email,password,hackathonId,action="login"}=req.body;
    if(!email||!password) return res.status(400).json({error:"Email and password required"});
    try{
        if(action==="register"){
            // Check they have an approved registration for this hackathon
            const{rows:[reg]}=await q(
                "SELECT * FROM registrations WHERE LOWER(email)=LOWER($1) AND hackathon_id=$2",
                [email,hackathonId]
            );
            if(!reg) return res.status(404).json({error:"No registration found for this email. Please register for the hackathon first."});

            // Check if participant account already exists
            const{rows:[existing]}=await q("SELECT id FROM participants WHERE LOWER(email)=LOWER($1)",[email]);
            if(existing) return res.status(409).json({error:"Account already exists. Please sign in instead."});

            // Create participant account
            const hash=await bcrypt.hash(password,10);
            const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
            const{rows:[p]}=await q(
                "INSERT INTO participants(id,name,email,password_hash) VALUES($1,$2,LOWER($3),$4) RETURNING *",
                [id,reg.name,email,hash]
            );

            // Link participant to their team if team exists
            if(reg.team_name){
                const{rows:[team]}=await q(
                    "SELECT id FROM teams WHERE hackathon_id=$1 AND LOWER(name)=LOWER($2)",
                    [hackathonId,reg.team_name]
                );
                if(team){
                    const mid=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
                    await q(
                        "INSERT INTO participant_hackathons(participant_id,hackathon_id,team_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
                        [p.id,hackathonId,team.id]
                    ).catch(()=>{});
                }
            }
            await logEvent("login",{id:p.id,name:p.name,email:p.email,role:"team"},req,"portal");
            const token=jwt.sign({id:p.id,name:p.name,email:p.email,role:"team"},process.env.JWT_SECRET||JWT_SECRET,{expiresIn:"7d"});
            return res.status(201).json({token,participant:camel(p),registration:camel(reg)});
        }

        // Login
        const{rows:[p]}=await q("SELECT * FROM participants WHERE LOWER(email)=LOWER($1)",[email]);
        if(!p) return res.status(401).json({error:"No account found. Please create an account first."});
        const ok=await bcrypt.compare(password,p.password_hash);
        if(!ok){await logEvent("failed",{email,role:"team"},req,"portal"); return res.status(401).json({error:"Incorrect password"});}
        await logEvent("login",{id:p.id,name:p.name,email:p.email,role:"team"},req,"portal");
        const token=jwt.sign({id:p.id,name:p.name,email:p.email,role:"team"},process.env.JWT_SECRET||JWT_SECRET,{expiresIn:"7d"});
        res.json({token,participant:camel(p)});
    }catch(e){res.status(500).json({error:e.message});}
});

// ── Team portal dashboard ─────────────────────────────────────────────────
app.get(["/api/portal/dashboard","/portal/dashboard"], async (req,res)=>{
    const token=(req.headers.authorization||"").replace("Bearer ","");
    if(!token) return res.status(401).json({error:"Unauthorized"});
    try{
        const payload=jwt.verify(token,process.env.JWT_SECRET||JWT_SECRET);
        const{hackathonId}=req.query;
        const{rows:[p]}=await q("SELECT id,name,email,bio,skills,github_url,linkedin_url FROM participants WHERE id=$1",[payload.id]);
        if(!p) return res.status(404).json({error:"Not found"});

        // Find their registration for this hackathon
        const{rows:[reg]}=await q(
            "SELECT * FROM registrations WHERE LOWER(email)=LOWER($1) AND hackathon_id=$2",
            [p.email,hackathonId]
        );

        // Find their team
        let team=null,submission=null;
        if(reg?.team_name){
            const{rows:[t]}=await q(
                "SELECT * FROM teams WHERE hackathon_id=$1 AND LOWER(name)=LOWER($2)",
                [hackathonId,reg.team_name]
            );
            if(t){
                team=camel(t);
                const{rows:[s]}=await q("SELECT * FROM submissions WHERE team_id=$1 AND hackathon_id=$2",[t.id,hackathonId]);
                if(s) submission=camel(s);
            }
        }

        // Hackathon info
        const{rows:[hack]}=await q("SELECT id,name,status,start_date,end_date,tracks,submissions_open,submission_deadline,prize_pool,banner_color FROM hackathons WHERE id=$1",[hackathonId]);

        res.json({participant:camel(p),registration:reg?camel(reg):null,team,submission,hackathon:hack?camel(hack):null});
    }catch(e){res.status(401).json({error:"Invalid session"});}
});

// ── Submit/update project ─────────────────────────────────────────────────
app.post(["/api/portal/submit","/portal/submit"], async (req,res)=>{
    const token=(req.headers.authorization||"").replace("Bearer ","");
    if(!token) return res.status(401).json({error:"Unauthorized"});
    try{
        const payload=jwt.verify(token,process.env.JWT_SECRET||JWT_SECRET);
        const{hackathonId,title,tagline,description,problemStatement,solution,techStack,githubUrl,demoUrl,videoUrl,deckUrl,screenshots,track}=req.body;
        if(!hackathonId||!title?.trim()) return res.status(400).json({error:"Hackathon and project title required"});

        // Check hackathon dates + submission window
        const{rows:[hack]}=await q("SELECT submissions_open,submission_deadline,start_date,end_date,name,status FROM hackathons WHERE id=$1",[hackathonId]);
        if(!hack) return res.status(404).json({error:"Hackathon not found"});

        const now = new Date();
        const startDate = hack.start_date ? new Date(hack.start_date) : null;
        const endDate   = hack.end_date   ? new Date(hack.end_date)   : null;

        // Before hackathon starts
        if(startDate && now < startDate){
            const diff = Math.ceil((startDate-now)/864e5);
            return res.status(403).json({
            error:`Submissions open when the hackathon starts on ${startDate.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}. ${diff} day${diff!==1?"s":""} to go!`,
            code:"NOT_STARTED"
        });
}

// After hackathon ends
if(endDate && now > endDate){
    return res.status(403).json({
    error:`The submission window has closed. ${hack.name} ended on ${endDate.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}.`,
    code:"ENDED"
});
}

// Admin-controlled override
if(hack.submissions_open===false)
return res.status(403).json({error:"Submissions are currently closed by the organizer.",code:"CLOSED"});

// Custom deadline
if(hack.submission_deadline && new Date(hack.submission_deadline)<now)
return res.status(403).json({error:"The submission deadline has passed.",code:"DEADLINE"});

// Find their team — users table (team role) not participants
const{rows:[u]}=await q("SELECT email,team_id FROM users WHERE id=$1",[payload.id]);
if(!u) return res.status(404).json({error:"User not found"});

// Try direct team_id link first, then fallback to registration lookup
let team=null;
if(u.team_id){
const{rows:[t]}=await q("SELECT id FROM teams WHERE id=$1 AND hackathon_id=$2",[u.team_id,hackathonId]);
team=t||null;
}
if(!team){
const{rows:[reg]}=await q("SELECT team_name FROM registrations WHERE LOWER(email)=LOWER($1) AND hackathon_id=$2",[u.email,hackathonId]);
if(!reg?.team_name) return res.status(403).json({error:"No team found for your account in this hackathon. Contact your organizer."});
const{rows:[t]}=await q("SELECT id FROM teams WHERE hackathon_id=$1 AND LOWER(name)=LOWER($2)",[hackathonId,reg.team_name]);
team=t||null;
}
if(!team) return res.status(404).json({error:"Team not found. Ask your organizer to add your team first."});

// Upsert submission
const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const{rows:[sub]}=await q(`
      INSERT INTO submissions(id,hackathon_id,team_id,title,tagline,description,problem_statement,solution,
        tech_stack,github_url,demo_url,video_url,deck_url,screenshots,track,status,submitted_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'submitted',NOW())
      ON CONFLICT(hackathon_id,team_id) DO UPDATE SET
        title=$4,tagline=$5,description=$6,problem_statement=$7,solution=$8,
        tech_stack=$9,github_url=$10,demo_url=$11,video_url=$12,deck_url=$13,
        screenshots=$14,track=$15,status='submitted',submitted_at=NOW(),updated_at=NOW()
      RETURNING *`,
[id,hackathonId,team.id,title,tagline,description,problemStatement,solution,
techStack,githubUrl,demoUrl,videoUrl,deckUrl,screenshots,track]
);
res.json(camel(sub));
}catch(e){res.status(500).json({error:e.message});}
});

// ── Judge: get assigned teams with submissions ─────────────────────────────
app.get(["/api/judge/assigned-teams","/judge/assigned-teams"], auth, async (req,res)=>{
const{hackathonId}=req.query;
if(!hackathonId) return res.status(400).json({error:"hackathonId required"});
try{
// 1. Get this user's judge_id
const{rows:[u]}=await q("SELECT judge_id FROM users WHERE id=$1",[req.user.id]);
const judgeId=u?.judge_id||null;

// 2. Check for specific team assignments
const{rows:assignments}=await q(
"SELECT team_id FROM judge_team_assignments WHERE user_id=$1 AND hackathon_id=$2",
[req.user.id,hackathonId]
).catch(()=>({rows:[]}));
const assignedIds=assignments.map(a=>a.team_id);
const isFiltered=assignedIds.length>0;

// 3. Get teams (assigned only OR all)
let teams;
if(isFiltered){
const{rows}=await q(
`SELECT * FROM teams WHERE hackathon_id=$1 AND id=ANY($2::varchar[]) ORDER BY name`,
[hackathonId,assignedIds]
);
teams=rows;
}else{
const{rows}=await q("SELECT * FROM teams WHERE hackathon_id=$1 ORDER BY name",[hackathonId]);
teams=rows;
}

// 4. Get all submissions for this hackathon
const{rows:subs}=await q(
"SELECT * FROM submissions WHERE hackathon_id=$1",[hackathonId]
).catch(()=>({rows:[]}));

// 5. Get this judge's feedback for this hackathon
const{rows:feedbacks}=judgeId
? await q("SELECT * FROM feedbacks WHERE hackathon_id=$1 AND judge_id=$2",[hackathonId,judgeId]).catch(()=>({rows:[]}))
: {rows:[]};

// 6. Get criteria
const{rows:criteria}=await q(
"SELECT * FROM criteria WHERE hackathon_id=$1 ORDER BY weight DESC",[hackathonId]
);

// 7. Get conflicts
const{rows:conflicts}=await q(
"SELECT team_id FROM judge_conflicts WHERE user_id=$1 AND hackathon_id=$2",
[req.user.id,hackathonId]
).catch(()=>({rows:[]}));
const conflictSet=new Set(conflicts.map(c=>c.team_id));

// 8. Merge team + submission + feedback
const merged=teams.map(t=>{
const sub=subs.find(s=>s.team_id===t.id)||null;
const fb =feedbacks.find(f=>f.team_id===t.id)||null;
return{
...camel(t),
subId:        sub?.id||null,
subTitle:     sub?.title||null,
tagline:      sub?.tagline||null,
description:  sub?.description||null,
problemStatement: sub?.problem_statement||null,
solution:     sub?.solution||null,
techStack:    sub?.tech_stack||null,
githubUrl:    sub?.github_url||null,
demoUrl:      sub?.demo_url||null,
videoUrl:     sub?.video_url||null,
deckUrl:      sub?.deck_url||null,
track:        sub?.track||null,
subStatus:    sub?.status||null,
submittedAt:  sub?.submitted_at||null,
feedbackId:   fb?.id||null,
scores:       fb?.scores||{},
comments:     fb?.comments||{},
overall:      fb?.overall||"",
privateNotes: fb?.private_notes||"",
scoredAt:     fb?.submitted_at||null,
hasConflict:  conflictSet.has(t.id),
};
});

res.json({
teams:merged,
criteria:criteria.map(camel),
isFiltered,
assignedCount:assignedIds.length,
judgeId,
});
}catch(e){
console.error("judge/assigned-teams error:",e.message);
res.status(500).json({error:e.message});
}
});

// ── Save judge feedback (enhanced)// ── Save judge feedback (enhanced) ────────────────────────────────────────
app.post(["/api/judge/feedback","/judge/feedback"], auth, async (req,res)=>{
const{hackathonId,teamId,scores,comments,overall,privateNotes}=req.body;
if(!hackathonId||!teamId) return res.status(400).json({error:"hackathonId and teamId required"});
try{
// Get judge_id
const{rows:[u]}=await q("SELECT judge_id FROM users WHERE id=$1",[req.user.id]);
const judgeId=u?.judge_id;
if(!judgeId) return res.status(403).json({error:"No judge profile linked to your account. Ask admin to link your user to a judge profile."});

// If this judge has assignments, verify team is assigned to them
const{rows:assignments}=await q(
"SELECT team_id FROM judge_team_assignments WHERE user_id=$1 AND hackathon_id=$2",
[req.user.id,hackathonId]
).catch(()=>({rows:[]}));
if(assignments.length){
const isAssigned=assignments.some(a=>a.team_id===teamId);
if(!isAssigned) return res.status(403).json({error:"You are not assigned to evaluate this team"});
}

// Upsert feedback
const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const{rows:[fb]}=await q(`
      INSERT INTO feedbacks(id,hackathon_id,team_id,judge_id,scores,comments,overall,private_notes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(hackathon_id,team_id,judge_id) DO UPDATE SET
        scores=$5,comments=$6,overall=$7,private_notes=$8,updated_at=NOW()
      RETURNING *`,
[id,hackathonId,teamId,judgeId,
JSON.stringify(scores||{}),JSON.stringify(comments||{}),
overall||null,privateNotes||null]
);
res.json(camel(fb));
}catch(e){res.status(500).json({error:e.message});}
});


// ═══════════════════════════════════════════════════════════════════════════
// TEAM USER MANAGEMENT (admin creates logins from registrations)
// ═══════════════════════════════════════════════════════════════════════════

// Create a team login from a registration
app.post(["/api/registrations/:id/create-login","/registrations/:id/create-login"], admin, async (req,res)=>{
const{sendEmail:doEmail=true}=req.body;
try{
const{rows:[reg]}=await q(
"SELECT r.*,h.name as hack_name FROM registrations r JOIN hackathons h ON h.id=r.hackathon_id WHERE r.id=$1",
[req.params.id]
);
if(!reg) return res.status(404).json({error:"Registration not found"});
if(!reg.email) return res.status(400).json({error:"Registration has no email"});

// Check if user already exists for this email
const{rows:[existing]}=await q("SELECT id,role FROM users WHERE email=LOWER($1)",[reg.email]);
if(existing) return res.json({exists:true,message:`Login already exists for ${reg.email} (role: ${existing.role})`});

// Find their team
const{rows:[team]}=await q(
"SELECT id FROM teams WHERE hackathon_id=$1 AND LOWER(name)=LOWER($2)",
[reg.hackathon_id,reg.team_name||""]
).catch(()=>({rows:[]}));

// Generate temp password
const crypto=require("crypto");
const tempPass=crypto.randomBytes(5).toString("hex"); // 10 char hex
const hash=await bcrypt.hash(tempPass,10);
const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);

await q(
"INSERT INTO users(id,name,email,password_hash,role,team_id) VALUES($1,$2,LOWER($3),$4,'team',$5)",
[id,reg.name,reg.email,hash,team?.id||null]
);

await logEvent("login",{id,name:reg.name,email:reg.email,role:"team"},req,"admin-created");

// Send credentials email
if(doEmail&&process.env.RESEND_API_KEY&&reg.email){
const SITE=siteUrl();
const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>body{font-family:'Segoe UI',sans-serif;background:#f4f6f8;margin:0;padding:0;}
        .wrap{max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);}
        .hdr{background:linear-gradient(135deg,#1e1b4b,#4c1d95);padding:32px 36px;text-align:center;}
        .hdr h1{color:#fff;font-size:20px;font-weight:800;margin:0 0 4px;}
        .hdr p{color:rgba(255,255,255,0.6);font-size:13px;margin:0;}
        .body{padding:32px 36px;}
        .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px 22px;margin:16px 0;}
        .label{font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;}
        .value{font-size:15px;color:#111827;font-weight:700;font-family:monospace;}
        .btn{display:block;background:#4f46e5;color:#fff;text-decoration:none;text-align:center;
          padding:13px 28px;border-radius:10px;font-size:15px;font-weight:700;margin:20px 0;}
        .footer{padding:20px 36px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;}
        </style></head><body>
        <div class="wrap">
          <div class="hdr"><h1>⚡ HackFest Hub</h1><p>${reg.hack_name}</p></div>
          <div class="body">
            <p style="font-size:16px;font-weight:700;color:#111827;">Hi ${reg.name}! 👋</p>
            <p style="font-size:14px;color:#4b5563;line-height:1.7;">Your team login has been created. Sign in to submit your project and track your hackathon status.</p>
            <div class="card">
              <div class="label">Login URL</div>
              <div class="value" style="font-size:13px">${SITE}</div>
            </div>
            <div class="card">
              <div class="label">Email</div>
              <div class="value">${reg.email}</div>
            </div>
            <div class="card">
              <div class="label">Temporary Password</div>
              <div class="value">${tempPass}</div>
            </div>
            <p style="font-size:12px;color:#ef4444;font-weight:600;">⚠ Please sign in and change your password.</p>
            <a href="${SITE}" class="btn">Sign in to HackFest Hub →</a>
          </div>
          <div class="footer">You're registered for ${reg.hack_name}. Questions? Reply to this email.</div>
        </div></body></html>`;
await sendEmail(reg.email,`Your login for ${reg.hack_name} — sign in to submit your project`,html);
}

res.json({created:true,email:reg.email,tempPassword:tempPass,loginUrl:siteUrl()});
}catch(e){res.status(500).json({error:e.message});}
});

// Team dashboard data (for team role users)
app.get(["/api/team/dashboard","/team/dashboard"], auth, async (req,res)=>{
if(req.user.role!=="team"&&req.user.role!=="admin")
return res.status(403).json({error:"Team access only"});
const{hackathonId}=req.query;
try{
// Get the team linked to this user
const{rows:[u]}=await q("SELECT u.*,t.name as team_name,t.id as team_id_direct FROM users u LEFT JOIN teams t ON t.id=u.team_id WHERE u.id=$1",[req.user.id]);

let team=null,submission=null;
const tid=u?.team_id||u?.team_id_direct;

if(tid){
const{rows:[t]}=await q("SELECT * FROM teams WHERE id=$1",[tid]);
team=t?camel(t):null;
if(team){
const{rows:[s]}=await q("SELECT * FROM submissions WHERE team_id=$1 AND hackathon_id=$2",[tid,hackathonId]);
submission=s?camel(s):null;
}
}else if(u?.email){
// Fallback: find team by email in registrations
const{rows:[reg]}=await q(
"SELECT r.team_name FROM registrations r WHERE LOWER(r.email)=LOWER($1) AND r.hackathon_id=$2",
[u.email,hackathonId]
);
if(reg?.team_name){
const{rows:[t]}=await q("SELECT * FROM teams WHERE hackathon_id=$1 AND LOWER(name)=LOWER($2)",[hackathonId,reg.team_name]);
team=t?camel(t):null;
if(team){
const{rows:[s]}=await q("SELECT * FROM submissions WHERE team_id=$1 AND hackathon_id=$2",[t.id,hackathonId]);
submission=s?camel(s):null;
}
}
}

const{rows:[reg]}=await q(
"SELECT * FROM registrations WHERE LOWER(email)=LOWER($1) AND hackathon_id=$2",
[u?.email,hackathonId]
).catch(()=>({rows:[]}));

const{rows:[hack]}=await q(
"SELECT id,name,status,start_date,end_date,banner_color,submissions_open,submission_deadline,tracks,prize_pool FROM hackathons WHERE id=$1 AND published=true",
[hackathonId]
);

const{rows:anns}=await q(
"SELECT id,title,body,priority,pinned,created_at FROM announcements WHERE hackathon_id=$1 AND (audience='all' OR audience='teams') ORDER BY pinned DESC,created_at DESC LIMIT 10",
[hackathonId]
).catch(()=>({rows:[]}));

res.json({
user:{name:u?.name,email:u?.email,role:u?.role},
team,submission,
registration:reg?camel(reg):null,
hackathon:hack?camel(hack):null,
announcements:anns.map(camel),
});
}catch(e){res.status(500).json({error:e.message});}
});


// ═══════════════════════════════════════════════════════════════════════════
// DEMO REQUESTS
// ═══════════════════════════════════════════════════════════════════════════

// Public: submit a demo request
app.post(["/api/demo-request", "/demo-request"], async (req, res) => {
const { name, email, organization, role, phone, eventType, participants, timeline, message } = req.body;
if (!name?.trim() || !email?.trim())
return res.status(400).json({ error: "Name and email are required" });

try {
// Self-heal: create table if migration hasn't been run
await q(`CREATE TABLE IF NOT EXISTS demo_requests (
      id VARCHAR(20) PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL,
      organization VARCHAR(255), role VARCHAR(255), phone VARCHAR(50),
      event_type VARCHAR(100), participants VARCHAR(50), timeline VARCHAR(100),
      message TEXT, status VARCHAR(20) DEFAULT 'new', notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch(()=>{});

const id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const { rows: [d] } = await q(
`INSERT INTO demo_requests(id,name,email,organization,role,phone,event_type,participants,timeline,message)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
[id, name.trim(), email.trim().toLowerCase(), organization||null, role||null, phone||null,
eventType||null, participants||null, timeline||null, message||null]
);

const SITE = siteUrl();
const NOTIFY = process.env.DEMO_NOTIFY_EMAIL || "contact@hackfesthub.com";

// 1. Notify the team
const teamHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      body{font-family:'Segoe UI',sans-serif;background:#f4f6f8;margin:0;padding:24px;}
      .wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.07);}
      .hdr{background:linear-gradient(135deg,#1e1b4b,#4c1d95);padding:24px 30px;}
      .hdr h1{color:#fff;font-size:18px;margin:0;font-weight:700;}
      .body{padding:26px 30px;}
      .row{display:flex;padding:9px 0;border-bottom:1px solid #f1f5f9;}
      .k{width:130px;font-size:12px;color:#64748b;font-weight:600;flex-shrink:0;}
      .v{font-size:14px;color:#0f172a;}
      .msg{background:#f8fafc;border-left:3px solid #4f46e5;padding:14px 16px;margin-top:16px;border-radius:0 8px 8px 0;font-size:14px;color:#334155;line-height:1.7;}
      </style></head><body><div class="wrap">
      <div class="hdr"><h1>🎯 New Demo Request</h1></div>
      <div class="body">
        <div class="row"><div class="k">Name</div><div class="v"><strong>${name}</strong></div></div>
        <div class="row"><div class="k">Email</div><div class="v"><a href="mailto:${email}">${email}</a></div></div>
        ${organization ? `<div class="row"><div class="k">Organization</div><div class="v">${organization}</div></div>` : ""}
        ${role         ? `<div class="row"><div class="k">Role</div><div class="v">${role}</div></div>` : ""}
        ${phone        ? `<div class="row"><div class="k">Phone</div><div class="v">${phone}</div></div>` : ""}
        ${eventType    ? `<div class="row"><div class="k">Event type</div><div class="v">${eventType}</div></div>` : ""}
        ${participants ? `<div class="row"><div class="k">Participants</div><div class="v">${participants}</div></div>` : ""}
        ${timeline     ? `<div class="row"><div class="k">Timeline</div><div class="v">${timeline}</div></div>` : ""}
        ${message ? `<div class="msg">${String(message).replace(/</g,"&lt;")}</div>` : ""}
        <p style="margin-top:22px;font-size:12px;color:#94a3b8;">Reply directly to this email to reach ${name}.</p>
      </div></div></body></html>`;

sendEmail(NOTIFY, `🎯 Demo request — ${name}${organization ? ` (${organization})` : ""}`, teamHtml).catch(()=>{});

// 2. Confirmation to the requester
const userHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      body{font-family:'Segoe UI',sans-serif;background:#f4f6f8;margin:0;padding:24px;}
      .wrap{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);}
      .hdr{background:linear-gradient(135deg,#1e1b4b,#4c1d95);padding:34px 36px;text-align:center;}
      .hdr h1{color:#fff;font-size:22px;margin:0 0 6px;font-weight:800;}
      .hdr p{color:rgba(255,255,255,0.6);font-size:14px;margin:0;}
      .body{padding:32px 36px;}
      .btn{display:block;background:#4f46e5;color:#fff;text-decoration:none;text-align:center;
        padding:13px 28px;border-radius:10px;font-size:15px;font-weight:700;margin:22px 0;}
      .footer{padding:20px 36px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#94a3b8;}
      </style></head><body><div class="wrap">
      <div class="hdr"><h1>⚡ Thanks, ${name.split(" ")[0]}!</h1><p>Your demo request is in</p></div>
      <div class="body">
        <p style="font-size:15px;color:#334155;line-height:1.75;">
          We received your request for a HackFest Hub demo. Someone from our team will
          reach out within <strong>1 business day</strong> to schedule a walkthrough.
        </p>
        <p style="font-size:14px;color:#64748b;line-height:1.75;">
          In the meantime, feel free to browse live hackathons on the platform.
        </p>
        <a href="${SITE}" class="btn">Explore HackFest Hub →</a>
      </div>
      <div class="footer">Questions? Just reply to this email.</div>
      </div></body></html>`;

sendEmail(email, "We got your demo request — HackFest Hub", userHtml).catch(()=>{});

res.status(201).json({ ok: true, id: d.id });
} catch (e) {
res.status(500).json({ error: e.message });
}
});

// Admin: list demo requests
app.get(["/api/demo-requests", "/demo-requests"], admin, async (_req, res) => {
try {
const { rows } = await q("SELECT * FROM demo_requests ORDER BY created_at DESC").catch(()=>({rows:[]}));
res.json(rows.map(camel));
} catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin: update a demo request (status / notes)
app.put(["/api/demo-requests/:id", "/demo-requests/:id"], admin, async (req, res) => {
const { status, notes } = req.body;
try {
const { rows: [d] } = await q(
"UPDATE demo_requests SET status=COALESCE($1,status), notes=COALESCE($2,notes), updated_at=NOW() WHERE id=$3 RETURNING *",
[status||null, notes||null, req.params.id]
);
if (!d) return res.status(404).json({ error: "Not found" });
res.json(camel(d));
} catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin: delete a demo request
app.delete(["/api/demo-requests/:id", "/demo-requests/:id"], admin, async (req, res) => {
try {
await q("DELETE FROM demo_requests WHERE id=$1", [req.params.id]);
res.json({ deleted: true });
} catch (e) { res.status(500).json({ error: e.message }); }
});


// ═══════════════════════════════════════════════════════════════════════════
// PASSWORD MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// Change own password (any logged-in user)
app.post(["/api/auth/change-password", "/auth/change-password"], auth, async (req, res) => {
const { currentPassword, newPassword } = req.body;
if (!newPassword || newPassword.length < 8)
return res.status(400).json({ error: "New password must be at least 8 characters" });

try {
const { rows: [u] } = await q("SELECT id,password_hash FROM users WHERE id=$1", [req.user.id]);
if (!u) return res.status(404).json({ error: "User not found" });

const ok = await bcrypt.compare(currentPassword || "", u.password_hash || "");
if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

const hash = await bcrypt.hash(newPassword, 10);
await q("UPDATE users SET password_hash=$1 WHERE id=$2", [hash, req.user.id]);
res.json({ ok: true, message: "Password changed successfully" });
} catch (e) { res.status(500).json({ error: e.message }); }
});

// Request a password reset link (public)
app.post(["/api/auth/forgot-password", "/auth/forgot-password"], async (req, res) => {
const { email, hackathonId } = req.body;
if (!email?.trim()) return res.status(400).json({ error: "Email required" });

try {
await q(`CREATE TABLE IF NOT EXISTS password_resets (
      token VARCHAR(64) PRIMARY KEY, user_id VARCHAR(20) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL, used BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch(()=>{});

const { rows: [u] } = await q("SELECT id,name,email FROM users WHERE LOWER(email)=LOWER($1)", [email.trim()]);
// Always return success so we don't leak which emails exist
if (!u) return res.json({ ok: true, message: "If that email exists, a reset link has been sent." });

const crypto = require("crypto");
const token = crypto.randomBytes(32).toString("hex");
const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

await q("INSERT INTO password_resets(token,user_id,expires_at) VALUES($1,$2,$3)", [token, u.id, expires]);

const SITE = siteUrl();
const resetUrl = `${SITE}/reset-password?token=${token}`;

const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      body{font-family:'Segoe UI',sans-serif;background:#f4f6f8;margin:0;padding:24px;}
      .wrap{max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);}
      .hdr{background:linear-gradient(135deg,#1e1b4b,#4c1d95);padding:30px 34px;text-align:center;}
      .hdr h1{color:#fff;font-size:20px;margin:0;font-weight:800;}
      .body{padding:30px 34px;}
      .btn{display:block;background:#4f46e5;color:#fff;text-decoration:none;text-align:center;
        padding:13px 28px;border-radius:10px;font-size:15px;font-weight:700;margin:22px 0;}
      .footer{padding:18px 34px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#94a3b8;}
      </style></head><body><div class="wrap">
      <div class="hdr"><h1>🔑 Reset your password</h1></div>
      <div class="body">
        <p style="font-size:15px;color:#334155;line-height:1.75;">Hi ${u.name},</p>
        <p style="font-size:14px;color:#4b5563;line-height:1.75;">
          We received a request to reset your HackFest Hub password.
          Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${resetUrl}" class="btn">Reset my password →</a>
        <p style="font-size:12px;color:#94a3b8;line-height:1.7;">
          If you didn't request this, you can safely ignore this email — your password won't change.
        </p>
      </div>
      <div class="footer">HackFest Hub · Password reset</div>
      </div></body></html>`;

sendEmail(u.email, "Reset your HackFest Hub password", html).catch(()=>{});
res.json({ ok: true, message: "If that email exists, a reset link has been sent." });
} catch (e) { res.status(500).json({ error: e.message }); }
});

// Complete a password reset with a token (public)
app.post(["/api/auth/reset-password", "/auth/reset-password"], async (req, res) => {
const { token, newPassword } = req.body;
if (!token || !newPassword) return res.status(400).json({ error: "Token and new password required" });
if (newPassword.length < 8)  return res.status(400).json({ error: "Password must be at least 8 characters" });

try {
const { rows: [r] } = await q(
"SELECT * FROM password_resets WHERE token=$1 AND used=false AND expires_at > NOW()",
[token]
).catch(()=>({rows:[]}));
if (!r) return res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });

const hash = await bcrypt.hash(newPassword, 10);
await q("UPDATE users SET password_hash=$1 WHERE id=$2", [hash, r.user_id]);
await q("UPDATE password_resets SET used=true WHERE token=$1", [token]);

res.json({ ok: true, message: "Password reset successfully. You can now sign in." });
} catch (e) { res.status(500).json({ error: e.message }); }
});


// Judge/admin: full submissions for a hackathon (no published requirement)
app.get(["/api/judge/submissions", "/judge/submissions"], auth, async (req, res) => {
const { hackathonId } = req.query;
if (!hackathonId) return res.status(400).json({ error: "hackathonId required" });
try {
const { rows } = await q(
`SELECT s.*, t.name AS team_name, t.category AS team_category, t.members AS team_members
       FROM submissions s JOIN teams t ON t.id = s.team_id
       WHERE s.hackathon_id = $1`,
[hackathonId]
).catch(() => ({ rows: [] }));
res.json(rows.map(camel));
} catch (e) { res.status(500).json({ error: e.message }); }
});


// ═══════════════════════════════════════════════════════════════════════════
// TEAM INVITES
// ═══════════════════════════════════════════════════════════════════════════

async function ensureInviteTable() {
await q(`CREATE TABLE IF NOT EXISTS team_invites (
    id VARCHAR(20) PRIMARY KEY, code VARCHAR(12) NOT NULL UNIQUE,
    team_id VARCHAR(20) NOT NULL, hackathon_id VARCHAR(20) NOT NULL,
    invited_by VARCHAR(255), email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', accepted_by VARCHAR(255),
    accepted_name VARCHAR(255), expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), accepted_at TIMESTAMPTZ
  )`).catch(()=>{});
}

// Team member creates / fetches their invite link
app.get(["/api/team/invite-link", "/team/invite-link"], auth, async (req, res) => {
if (req.user.role !== "team" && req.user.role !== "admin")
return res.status(403).json({ error: "Team access only" });
const { hackathonId } = req.query;
try {
await ensureInviteTable();
const { rows: [u] } = await q("SELECT email, team_id FROM users WHERE id=$1", [req.user.id]);

// Resolve the team
let teamId = u?.team_id;
if (!teamId && u?.email) {
const { rows: [reg] } = await q(
"SELECT team_name FROM registrations WHERE LOWER(email)=LOWER($1) AND hackathon_id=$2",
[u.email, hackathonId]
).catch(()=>({rows:[]}));
if (reg?.team_name) {
const { rows: [t] } = await q(
"SELECT id FROM teams WHERE hackathon_id=$1 AND LOWER(name)=LOWER($2)",
[hackathonId, reg.team_name]
);
teamId = t?.id;
}
}
if (!teamId) return res.status(404).json({ error: "No team linked to your account" });

// Reuse an existing open invite if present
const { rows: existing } = await q(
"SELECT * FROM team_invites WHERE team_id=$1 AND status='pending' AND email IS NULL ORDER BY created_at DESC LIMIT 1",
[teamId]
);

let invite = existing[0];
if (!invite) {
const crypto = require("crypto");
const code = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 chars
const id   = "i" + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
const { rows: [ni] } = await q(
`INSERT INTO team_invites(id,code,team_id,hackathon_id,invited_by,expires_at)
         VALUES($1,$2,$3,$4,$5,NOW() + INTERVAL '30 days') RETURNING *`,
[id, code, teamId, hackathonId, u?.email || null]
);
invite = ni;
}

const { rows: [team] } = await q("SELECT name, members FROM teams WHERE id=$1", [teamId]);
const { rows: [hack] } = await q("SELECT name, max_team_size FROM hackathons WHERE id=$1", [hackathonId]);
const SITE = siteUrl();

const memberCount = team?.members ? team.members.split(",").filter(m=>m.trim()).length : 0;

res.json({
code: invite.code,
url: `${SITE}/join/${invite.code}`,
teamName: team?.name,
hackathonName: hack?.name,
memberCount,
maxTeamSize: hack?.max_team_size || null,
expiresAt: invite.expires_at,
});
} catch (e) { res.status(500).json({ error: e.message }); }
});

// Send an invite by email
app.post(["/api/team/invite-email", "/team/invite-email"], auth, async (req, res) => {
const { hackathonId, email: inviteeEmail, message } = req.body;
if (!inviteeEmail?.trim()) return res.status(400).json({ error: "Email required" });
try {
await ensureInviteTable();
const { rows: [u] } = await q("SELECT name, email, team_id FROM users WHERE id=$1", [req.user.id]);
let teamId = u?.team_id;
if (!teamId) {
const { rows: [reg] } = await q(
"SELECT team_name FROM registrations WHERE LOWER(email)=LOWER($1) AND hackathon_id=$2",
[u?.email, hackathonId]
).catch(()=>({rows:[]}));
if (reg?.team_name) {
const { rows: [t] } = await q("SELECT id FROM teams WHERE hackathon_id=$1 AND LOWER(name)=LOWER($2)",[hackathonId, reg.team_name]);
teamId = t?.id;
}
}
if (!teamId) return res.status(404).json({ error: "No team linked to your account" });

const crypto = require("crypto");
const code = crypto.randomBytes(4).toString("hex").toUpperCase();
const id   = "i" + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
await q(
`INSERT INTO team_invites(id,code,team_id,hackathon_id,invited_by,email,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,NOW() + INTERVAL '30 days')`,
[id, code, teamId, hackathonId, u?.email || null, inviteeEmail.trim().toLowerCase()]
);

const { rows: [team] } = await q("SELECT name FROM teams WHERE id=$1", [teamId]);
const { rows: [hack] } = await q("SELECT name, start_date, location, prize_pool FROM hackathons WHERE id=$1", [hackathonId]);
const SITE = siteUrl();
const joinUrl = `${SITE}/join/${code}`;

const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      body{font-family:'Segoe UI',sans-serif;background:#f4f6f8;margin:0;padding:24px;}
      .wrap{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);}
      .hdr{background:linear-gradient(135deg,#1e1b4b,#4c1d95);padding:34px 36px;text-align:center;}
      .hdr h1{color:#fff;font-size:22px;margin:0 0 6px;font-weight:800;}
      .hdr p{color:rgba(255,255,255,0.6);font-size:14px;margin:0;}
      .body{padding:32px 36px;}
      .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin:18px 0;}
      .row{display:flex;padding:6px 0;}
      .k{width:100px;font-size:12px;color:#64748b;font-weight:600;}
      .v{font-size:14px;color:#0f172a;font-weight:600;}
      .btn{display:block;background:#4f46e5;color:#fff;text-decoration:none;text-align:center;
        padding:14px 28px;border-radius:10px;font-size:16px;font-weight:700;margin:22px 0;}
      .code{text-align:center;font-family:monospace;font-size:22px;font-weight:800;color:#4338ca;
        letter-spacing:0.12em;background:#eef2ff;border:1.5px dashed #c7d2fe;border-radius:10px;padding:14px;margin:16px 0;}
      .footer{padding:20px 36px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#94a3b8;}
      </style></head><body><div class="wrap">
      <div class="hdr"><h1>🚀 You're invited!</h1><p>Join ${team?.name} at ${hack?.name}</p></div>
      <div class="body">
        <p style="font-size:15px;color:#334155;line-height:1.75;">
          <strong>${u?.name || "A teammate"}</strong> invited you to join
          <strong>${team?.name}</strong> for <strong>${hack?.name}</strong>.
        </p>
        ${message ? `<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;font-size:14px;color:#78350f;line-height:1.7;font-style:italic;">"${String(message).replace(/</g,"&lt;")}"</div>` : ""}
        <div class="card">
          <div class="row"><div class="k">Team</div><div class="v">${team?.name}</div></div>
          <div class="row"><div class="k">Event</div><div class="v">${hack?.name}</div></div>
          ${hack?.start_date ? `<div class="row"><div class="k">Starts</div><div class="v">${new Date(hack.start_date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div></div>` : ""}
          ${hack?.location ? `<div class="row"><div class="k">Location</div><div class="v">${hack.location}</div></div>` : ""}
          ${hack?.prize_pool ? `<div class="row"><div class="k">Prizes</div><div class="v">${hack.prize_pool}</div></div>` : ""}
        </div>
        <a href="${joinUrl}" class="btn">Accept invitation →</a>
        <p style="font-size:12px;color:#94a3b8;text-align:center;">Or enter this code when joining:</p>
        <div class="code">${code}</div>
      </div>
      <div class="footer">This invitation expires in 30 days.</div>
      </div></body></html>`;

sendEmail(inviteeEmail, `${u?.name || "A teammate"} invited you to join ${team?.name}`, html).catch(()=>{});
res.status(201).json({ ok: true, code, url: joinUrl });
} catch (e) { res.status(500).json({ error: e.message }); }
});

// Public: look up an invite by code
app.get(["/api/invite/:code", "/invite/:code"], async (req, res) => {
try {
await ensureInviteTable();
const { rows: [inv] } = await q(
"SELECT * FROM team_invites WHERE UPPER(code)=UPPER($1)", [req.params.code]
);
if (!inv) return res.status(404).json({ error: "This invitation code is not valid." });
if (inv.status === "accepted") return res.status(410).json({ error: "This invitation has already been used." });
if (inv.expires_at && new Date(inv.expires_at) < new Date())
return res.status(410).json({ error: "This invitation has expired." });

const { rows: [team] } = await q("SELECT name, category, members FROM teams WHERE id=$1", [inv.team_id]);
const { rows: [hack] } = await q(
"SELECT id,name,tagline,start_date,end_date,location,prize_pool,banner_color,max_team_size FROM hackathons WHERE id=$1",
[inv.hackathon_id]
);
const memberCount = team?.members ? team.members.split(",").filter(m=>m.trim()).length : 0;
const isFull = hack?.max_team_size && memberCount >= hack.max_team_size;

res.json({
code: inv.code, invitedBy: inv.invited_by,
team: { name: team?.name, category: team?.category, memberCount, members: team?.members },
hackathon: camel(hack || {}),
isFull,
});
} catch (e) { res.status(500).json({ error: e.message }); }
});

// Public: accept an invite
app.post(["/api/invite/:code/accept", "/invite/:code/accept"], async (req, res) => {
const { name, email } = req.body;
if (!name?.trim() || !email?.trim()) return res.status(400).json({ error: "Name and email are required" });
try {
await ensureInviteTable();
const { rows: [inv] } = await q("SELECT * FROM team_invites WHERE UPPER(code)=UPPER($1)", [req.params.code]);
if (!inv) return res.status(404).json({ error: "Invalid invitation code." });
if (inv.status === "accepted") return res.status(410).json({ error: "This invitation has already been used." });
if (inv.expires_at && new Date(inv.expires_at) < new Date())
return res.status(410).json({ error: "This invitation has expired." });

const { rows: [team] } = await q("SELECT * FROM teams WHERE id=$1", [inv.team_id]);
if (!team) return res.status(404).json({ error: "Team no longer exists." });

const { rows: [hack] } = await q("SELECT name, max_team_size FROM hackathons WHERE id=$1", [inv.hackathon_id]);
const current = team.members ? team.members.split(",").map(m=>m.trim()).filter(Boolean) : [];

if (hack?.max_team_size && current.length >= hack.max_team_size)
return res.status(403).json({ error: `This team is full (max ${hack.max_team_size} members).` });

// Add to team members
if (!current.some(m => m.toLowerCase() === name.trim().toLowerCase())) {
current.push(name.trim());
await q("UPDATE teams SET members=$1, updated_at=NOW() WHERE id=$2", [current.join(", "), team.id]);
}

// Create a registration record so they show in the admin list
await q(
`INSERT INTO registrations (id,hackathon_id,name,email,type,team_name,status)
       VALUES ($1,$2,$3,$4,'team',$5,'approved')
       ON CONFLICT (hackathon_id,email) DO UPDATE SET team_name=$5, status='approved'`,
[uid(), inv.hackathon_id, name.trim(), email.trim().toLowerCase(), team.name]
).catch(()=>{});

// Create their login with the default password
const { rows: existingUser } = await q("SELECT id FROM users WHERE LOWER(email)=LOWER($1)", [email.trim()]);
let created = false;
if (!existingUser.length) {
const hash = await bcrypt.hash("hackfest123", 10);
await q(
"INSERT INTO users(id,name,email,password_hash,role,team_id) VALUES($1,$2,LOWER($3),$4,'team',$5)",
["u" + Date.now().toString(36) + Math.random().toString(36).slice(2,5), name.trim(), email.trim(), hash, team.id]
);
created = true;
}

// Mark invite used only if it was a personal (email) invite; keep open links reusable
if (inv.email) {
await q("UPDATE team_invites SET status='accepted', accepted_by=$1, accepted_name=$2, accepted_at=NOW() WHERE id=$3",
[email.trim().toLowerCase(), name.trim(), inv.id]).catch(()=>{});
}

// Welcome email
const SITE = siteUrl();
if (created) {
const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
        <body style="font-family:'Segoe UI',sans-serif;background:#f4f6f8;padding:24px;">
        <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#1e1b4b,#4c1d95);padding:32px;text-align:center;">
            <h1 style="color:#fff;font-size:21px;margin:0 0 5px;">🎉 Welcome to ${team.name}!</h1>
            <p style="color:rgba(255,255,255,0.6);font-size:14px;margin:0;">${hack?.name || ""}</p>
          </div>
          <div style="padding:30px 34px;">
            <p style="font-size:15px;color:#334155;line-height:1.75;">Hi ${name}, you've joined <strong>${team.name}</strong>.</p>
            <div style="background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:12px;padding:18px 22px;margin:20px 0;">
              <div style="font-size:12px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">🔑 Your login</div>
              <div style="font-size:13px;color:#1e1b4b;margin-bottom:5px;"><strong>Sign in:</strong> <a href="${SITE}/register/${inv.hackathon_id}" style="color:#4f46e5;">${SITE}/register/${inv.hackathon_id}</a></div>
              <div style="font-size:13px;color:#1e1b4b;margin-bottom:5px;"><strong>Email:</strong> ${email}</div>
              <div style="font-size:13px;color:#1e1b4b;"><strong>Password:</strong> <code style="background:#fff;border:1px solid #c7d2fe;padding:3px 9px;border-radius:5px;font-weight:700;">hackfest123</code></div>
              <div style="margin-top:12px;padding-top:10px;border-top:1px solid #c7d2fe;font-size:12px;color:#4338ca;">⚠ Change your password after signing in.</div>
            </div>
            <a href="${SITE}/register/${inv.hackathon_id}" style="display:block;background:#4f46e5;color:#fff;text-decoration:none;text-align:center;padding:13px;border-radius:10px;font-size:15px;font-weight:700;">Sign in now →</a>
          </div>
        </div></body></html>`;
sendEmail(email, `Welcome to ${team.name} — ${hack?.name || "HackFest Hub"}`, html).catch(()=>{});
}

res.json({
ok: true, created,
teamName: team.name,
hackathonId: inv.hackathon_id,
loginUrl: `${SITE}/register/${inv.hackathon_id}`,
defaultPassword: created ? "hackfest123" : null,
});
} catch (e) { res.status(500).json({ error: e.message }); }
});

// Team: list sent invites
app.get(["/api/team/invites", "/team/invites"], auth, async (req, res) => {
const { hackathonId } = req.query;
try {
await ensureInviteTable();
const { rows: [u] } = await q("SELECT team_id FROM users WHERE id=$1", [req.user.id]);
if (!u?.team_id) return res.json([]);
const { rows } = await q(
"SELECT * FROM team_invites WHERE team_id=$1 AND email IS NOT NULL ORDER BY created_at DESC",
[u.team_id]
);
res.json(rows.map(camel));
} catch (e) { res.json([]); }
});


// ═══════════════════════════════════════════════════════════════════════════
// WINNERS / HALL OF FAME
// ═══════════════════════════════════════════════════════════════════════════

async function ensureAwardCols() {
await q("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS award_title VARCHAR(255)").catch(()=>{});
await q("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS placement INTEGER").catch(()=>{});
}

// Public: winners across every published hackathon (hall of fame)
app.get(["/api/public/winners", "/public/winners"], async (req, res) => {
const { hackathonId, limit = 60 } = req.query;
try {
await ensureAwardCols();
const params = [];
let where = "h.published = true AND (s.placement IS NOT NULL OR s.status = 'winner')";
if (hackathonId) { params.push(hackathonId); where += ` AND h.id = $${params.length}`; }

const { rows } = await q(
`SELECT s.id, s.title, s.tagline, s.description, s.tech_stack, s.track,
              s.github_url, s.demo_url, s.video_url, s.award_title, s.placement,
              t.name AS team_name, t.members,
              h.id AS hackathon_id, h.name AS hackathon_name,
              h.start_date, h.banner_color, h.prize_pool,
              (SELECT count(*)::int FROM project_likes WHERE submission_id = s.id) AS likes
       FROM submissions s
       JOIN teams t      ON t.id = s.team_id
       JOIN hackathons h ON h.id = s.hackathon_id
       WHERE ${where}
       ORDER BY h.start_date DESC, COALESCE(s.placement, 99) ASC
       LIMIT ${parseInt(limit) || 60}`,
params
).catch(() => ({ rows: [] }));

// Group by hackathon so the UI can render one section per event
const byEvent = {};
rows.forEach(r => {
const row = camel(r);
if (!byEvent[row.hackathonId]) {
byEvent[row.hackathonId] = {
hackathonId:   row.hackathonId,
hackathonName: row.hackathonName,
startDate:     row.startDate,
bannerColor:   row.bannerColor,
prizePool:     row.prizePool,
winners: [],
};
}
byEvent[row.hackathonId].winners.push(row);
});

res.json({ events: Object.values(byEvent), total: rows.length });
} catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin: mark or clear a winner
app.put(["/api/submissions/:id/award", "/submissions/:id/award"], admin, async (req, res) => {
const { placement, awardTitle } = req.body;
try {
await ensureAwardCols();
const clearing = placement === null || placement === "" || placement === undefined;
const { rows: [s] } = await q(
`UPDATE submissions
       SET placement = $1, award_title = $2, status = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
[clearing ? null : parseInt(placement),
clearing ? null : (awardTitle || null),
clearing ? "submitted" : "winner",
req.params.id]
);
if (!s) return res.status(404).json({ error: "Submission not found" });
res.json(camel(s));
} catch (e) { res.status(500).json({ error: e.message }); }
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