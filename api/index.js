require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const { Pool }  = require("pg");

const JWT_SECRET = process.env.JWT_SECRET || "hackfest-dev-secret-change-in-prod";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000,
});
async function query(sql, params = []) {
  const client = await pool.connect();
  try   { return await client.query(sql, params); }
  finally { client.release(); }
}

const toCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
function rowToCamel(row) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "*", credentials: true }));
app.use(express.json());

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid or expired token" }); }
}
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
    next();
  });
}

app.get("/api/health", async (_req, res) => {
  try { const { rows } = await query("SELECT NOW() AS time"); res.json({ status: "ok", db: "connected", time: rows[0].time }); }
  catch (err) { res.status(503).json({ status: "error", message: err.message }); }
});

/* AUTH */
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  try {
    const { rows } = await query("SELECT * FROM users WHERE email=$1", [email.toLowerCase()]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });
    const { rows: hj }    = await query("SELECT hackathon_id FROM hackathon_judges WHERE user_id=$1", [user.id]);
    const { rows: perms } = await query("SELECT hackathon_id, page FROM user_permissions WHERE user_id=$1", [user.id]);
    const payload = {
      id: user.id, name: user.name, email: user.email, role: user.role, judgeId: user.judge_id,
      assignedHackathons: hj.map(r => r.hackathon_id),
      permissions: perms.map(r => ({ hackathonId: r.hackathon_id, page: r.page })),
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
    res.json({ token, user: payload });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await query("SELECT id,name,email,role,judge_id FROM users WHERE id=$1", [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    const u = rows[0];
    const { rows: hj }    = await query("SELECT hackathon_id FROM hackathon_judges WHERE user_id=$1", [u.id]);
    const { rows: perms } = await query("SELECT hackathon_id,page FROM user_permissions WHERE user_id=$1", [u.id]);
    res.json({ ...rowToCamel(u), assignedHackathons: hj.map(r => r.hackathon_id), permissions: perms.map(r => ({ hackathonId: r.hackathon_id, page: r.page })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* USERS */
app.get("/api/users", requireAdmin, async (_req, res) => {
  try {
    const { rows: users } = await query("SELECT id,name,email,role,judge_id,created_at FROM users ORDER BY name");
    const { rows: hj }    = await query("SELECT user_id,hackathon_id FROM hackathon_judges");
    const { rows: perms } = await query("SELECT id,user_id,hackathon_id,page FROM user_permissions");
    res.json(users.map(u => ({
      ...rowToCamel(u),
      assignedHackathons: hj.filter(r => r.user_id === u.id).map(r => r.hackathon_id),
      permissions: perms.filter(r => r.user_id === u.id).map(r => ({ id:r.id, hackathonId:r.hackathon_id, page:r.page })),
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/users", requireAdmin, async (req, res) => {
  const { name, email, password, role = "judge", judgeId } = req.body;
  if (!name?.trim() || !email?.trim() || !password?.trim()) return res.status(400).json({ error: "name, email, password required" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query("INSERT INTO users (id,name,email,password_hash,role,judge_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,email,role,judge_id",
      [uid(), name, email.toLowerCase(), hash, role, judgeId || null]);
    res.status(201).json({ ...rowToCamel(rows[0]), assignedHackathons: [], permissions: [] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already in use" });
    res.status(500).json({ error: err.message });
  }
});
app.put("/api/users/:id", requireAdmin, async (req, res) => {
  const { name, email, password, role, judgeId } = req.body;
  try {
    let sql, params;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      sql = "UPDATE users SET name=$1,email=$2,password_hash=$3,role=$4,judge_id=$5 WHERE id=$6 RETURNING id,name,email,role,judge_id";
      params = [name, email.toLowerCase(), hash, role, judgeId||null, req.params.id];
    } else {
      sql = "UPDATE users SET name=$1,email=$2,role=$3,judge_id=$4 WHERE id=$5 RETURNING id,name,email,role,judge_id";
      params = [name, email.toLowerCase(), role, judgeId||null, req.params.id];
    }
    const { rows } = await query(sql, params);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rowToCamel(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/users/:id", requireAdmin, async (req, res) => {
  try { await query("DELETE FROM users WHERE id=$1", [req.params.id]); res.json({ deleted: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

/* ASSIGNMENTS */
app.get("/api/assignments/:hackathonId", requireAdmin, async (req, res) => {
  try { const { rows } = await query("SELECT user_id FROM hackathon_judges WHERE hackathon_id=$1", [req.params.hackathonId]); res.json(rows.map(r => r.user_id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/assignments", requireAdmin, async (req, res) => {
  const { hackathonId, userId } = req.body;
  try { await query("INSERT INTO hackathon_judges (hackathon_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [hackathonId, userId]); res.status(201).json({ assigned: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/assignments/:hackathonId/:userId", requireAdmin, async (req, res) => {
  try { await query("DELETE FROM hackathon_judges WHERE hackathon_id=$1 AND user_id=$2", [req.params.hackathonId, req.params.userId]); res.json({ deleted: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

/* PERMISSIONS */
app.get("/api/permissions/:userId", requireAdmin, async (req, res) => {
  try { const { rows } = await query("SELECT id,hackathon_id,page FROM user_permissions WHERE user_id=$1", [req.params.userId]); res.json(rows.map(rowToCamel)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/permissions", requireAdmin, async (req, res) => {
  const { userId, hackathonId, page } = req.body;
  try {
    const { rows } = await query("INSERT INTO user_permissions (id,user_id,hackathon_id,page) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *",
      [uid(), userId, hackathonId||null, page]);
    res.status(201).json(rows[0] ? rowToCamel(rows[0]) : { skipped: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/permissions/:id", requireAdmin, async (req, res) => {
  try { await query("DELETE FROM user_permissions WHERE id=$1", [req.params.id]); res.json({ deleted: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

/* HACKATHONS */
app.get("/api/hackathons", requireAuth, async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM hackathons ORDER BY start_date DESC");
    const all = rows.map(rowToCamel);
    if (req.user.role === "judge") { const allowed = new Set(req.user.assignedHackathons||[]); return res.json(all.filter(h => allowed.has(h.id))); }
    res.json(all);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/hackathons", requireAdmin, async (req, res) => {
  const { name, startDate, endDate, location, status="upcoming", description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  try { const { rows } = await query("INSERT INTO hackathons (id,name,start_date,end_date,location,status,description) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *", [uid(),name,startDate||null,endDate||null,location,status,description]); res.status(201).json(rowToCamel(rows[0])); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/hackathons/:id", requireAdmin, async (req, res) => {
  const { name, startDate, endDate, location, status, description } = req.body;
  try { const { rows } = await query("UPDATE hackathons SET name=$1,start_date=$2,end_date=$3,location=$4,status=$5,description=$6 WHERE id=$7 RETURNING *", [name,startDate||null,endDate||null,location,status,description,req.params.id]); if (!rows.length) return res.status(404).json({ error:"Not found" }); res.json(rowToCamel(rows[0])); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/hackathons/:id", requireAdmin, async (req, res) => {
  try { await query("DELETE FROM hackathons WHERE id=$1", [req.params.id]); res.json({ deleted:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

/* JUDGES */
app.get("/api/judges", requireAuth, async (_req, res) => {
  try { const { rows } = await query("SELECT * FROM judges ORDER BY name"); res.json(rows.map(rowToCamel)); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/judges", requireAdmin, async (req, res) => {
  const { name, org, role } = req.body;
  if (!name?.trim()) return res.status(400).json({ error:"name required" });
  try { const { rows } = await query("INSERT INTO judges (id,name,org,role) VALUES ($1,$2,$3,$4) RETURNING *",[uid(),name,org,role]); res.status(201).json(rowToCamel(rows[0])); } catch (err) { res.status(500).json({ error:err.message }); }
});
app.put("/api/judges/:id", requireAdmin, async (req, res) => {
  const { name, org, role } = req.body;
  try { const { rows } = await query("UPDATE judges SET name=$1,org=$2,role=$3 WHERE id=$4 RETURNING *",[name,org,role,req.params.id]); if (!rows.length) return res.status(404).json({error:"Not found"}); res.json(rowToCamel(rows[0])); } catch (err) { res.status(500).json({error:err.message}); }
});
app.delete("/api/judges/:id", requireAdmin, async (req, res) => {
  try { await query("DELETE FROM judges WHERE id=$1",[req.params.id]); res.json({deleted:true}); } catch (err) { res.status(500).json({error:err.message}); }
});

/* TEAMS */
app.get("/api/teams", requireAuth, async (req, res) => {
  try { const { hackathonId } = req.query; const { rows } = hackathonId ? await query("SELECT * FROM teams WHERE hackathon_id=$1 ORDER BY name",[hackathonId]) : await query("SELECT * FROM teams ORDER BY name"); res.json(rows.map(rowToCamel)); } catch (err) { res.status(500).json({error:err.message}); }
});
app.post("/api/teams", requireAdmin, async (req, res) => {
  const { hackathonId, name, project, category, members } = req.body;
  if (!name?.trim()||!hackathonId?.trim()) return res.status(400).json({error:"name and hackathonId required"});
  try { const { rows } = await query("INSERT INTO teams (id,hackathon_id,name,project,category,members) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",[uid(),hackathonId,name,project,category,members]); res.status(201).json(rowToCamel(rows[0])); } catch (err) { res.status(500).json({error:err.message}); }
});
app.put("/api/teams/:id", requireAdmin, async (req, res) => {
  const { name, project, category, members } = req.body;
  try { const { rows } = await query("UPDATE teams SET name=$1,project=$2,category=$3,members=$4 WHERE id=$5 RETURNING *",[name,project,category,members,req.params.id]); if (!rows.length) return res.status(404).json({error:"Not found"}); res.json(rowToCamel(rows[0])); } catch (err) { res.status(500).json({error:err.message}); }
});
app.delete("/api/teams/:id", requireAdmin, async (req, res) => {
  try { await query("DELETE FROM teams WHERE id=$1",[req.params.id]); res.json({deleted:true}); } catch (err) { res.status(500).json({error:err.message}); }
});

/* CRITERIA */
app.get("/api/criteria", requireAuth, async (req, res) => {
  try { const { hackathonId } = req.query; const { rows } = hackathonId ? await query("SELECT * FROM criteria WHERE hackathon_id=$1 ORDER BY weight DESC",[hackathonId]) : await query("SELECT * FROM criteria ORDER BY weight DESC"); res.json(rows.map(rowToCamel)); } catch (err) { res.status(500).json({error:err.message}); }
});
app.post("/api/criteria", requireAdmin, async (req, res) => {
  const { hackathonId, name, description, maxScore=10, weight=20 } = req.body;
  if (!name?.trim()||!hackathonId?.trim()) return res.status(400).json({error:"name and hackathonId required"});
  try { const { rows } = await query("INSERT INTO criteria (id,hackathon_id,name,description,max_score,weight) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",[uid(),hackathonId,name,description,Number(maxScore),Number(weight)]); res.status(201).json(rowToCamel(rows[0])); } catch (err) { res.status(500).json({error:err.message}); }
});
app.put("/api/criteria/:id", requireAdmin, async (req, res) => {
  const { name, description, maxScore, weight } = req.body;
  try { const { rows } = await query("UPDATE criteria SET name=$1,description=$2,max_score=$3,weight=$4 WHERE id=$5 RETURNING *",[name,description,Number(maxScore),Number(weight),req.params.id]); if (!rows.length) return res.status(404).json({error:"Not found"}); res.json(rowToCamel(rows[0])); } catch (err) { res.status(500).json({error:err.message}); }
});
app.delete("/api/criteria/:id", requireAdmin, async (req, res) => {
  try { await query("DELETE FROM criteria WHERE id=$1",[req.params.id]); res.json({deleted:true}); } catch (err) { res.status(500).json({error:err.message}); }
});

/* FEEDBACKS */
app.get("/api/feedbacks", requireAuth, async (req, res) => {
  try { const { hackathonId } = req.query; const { rows } = hackathonId ? await query("SELECT * FROM feedbacks WHERE hackathon_id=$1 ORDER BY submitted_at DESC",[hackathonId]) : await query("SELECT * FROM feedbacks ORDER BY submitted_at DESC"); res.json(rows.map(rowToCamel)); } catch (err) { res.status(500).json({error:err.message}); }
});
app.post("/api/feedbacks", requireAuth, async (req, res) => {
  const { hackathonId, teamId, judgeId, scores, comments, overall } = req.body;
  if (!hackathonId||!teamId||!judgeId) return res.status(400).json({error:"hackathonId, teamId, judgeId required"});
  if (req.user.role==="judge"&&!req.user.assignedHackathons?.includes(hackathonId)) return res.status(403).json({error:"Not assigned to this hackathon"});
  try { const { rows } = await query("INSERT INTO feedbacks (id,hackathon_id,team_id,judge_id,scores,comments,overall) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (hackathon_id,team_id,judge_id) DO UPDATE SET scores=$5,comments=$6,overall=$7,submitted_at=NOW() RETURNING *",[uid(),hackathonId,teamId,judgeId,JSON.stringify(scores||{}),JSON.stringify(comments||{}),overall]); res.status(201).json(rowToCamel(rows[0])); } catch (err) { res.status(500).json({error:err.message}); }
});
app.put("/api/feedbacks/:id", requireAuth, async (req, res) => {
  const { scores, comments, overall } = req.body;
  try { const { rows } = await query("UPDATE feedbacks SET scores=$1,comments=$2,overall=$3,submitted_at=NOW() WHERE id=$4 RETURNING *",[JSON.stringify(scores||{}),JSON.stringify(comments||{}),overall,req.params.id]); if (!rows.length) return res.status(404).json({error:"Not found"}); res.json(rowToCamel(rows[0])); } catch (err) { res.status(500).json({error:err.message}); }
});
app.delete("/api/feedbacks/:id", requireAdmin, async (req, res) => {
  try { await query("DELETE FROM feedbacks WHERE id=$1",[req.params.id]); res.json({deleted:true}); } catch (err) { res.status(500).json({error:err.message}); }
});

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: "Internal server error" }); });

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
}
module.exports = app;
