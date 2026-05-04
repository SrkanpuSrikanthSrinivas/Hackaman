/**
 * HackFest Hub — REST API
 * Express + Neon PostgreSQL — Vercel Serverless
 *
 * Deploy steps:
 *   1. npm i -g vercel
 *   2. vercel env add DATABASE_URL   (paste your Neon connection string)
 *   3. vercel --prod
 */

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");

// ── DB ────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,                       // keep low for serverless cold starts
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});

async function query(sql, params = []) {
  const client = await pool.connect();
  try   { return await client.query(sql, params); }
  finally { client.release(); }
}

// ── Helpers ───────────────────────────────────────────────────
const toCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
function rowToCamel(row) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// ── App ───────────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "*" }));
app.use(express.json());

// ── Health ────────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  try {
    const { rows } = await query("SELECT NOW() AS time");
    res.json({ status: "ok", db: "connected", time: rows[0].time });
  } catch (err) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

// ── HACKATHONS ────────────────────────────────────────────────
app.get("/api/hackathons", async (_req, res) => {
  try {
    const { rows } = await query("SELECT * FROM hackathons ORDER BY start_date DESC");
    res.json(rows.map(rowToCamel));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/hackathons", async (req, res) => {
  const { name, startDate, endDate, location, status = "upcoming", description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  try {
    const { rows } = await query(
      `INSERT INTO hackathons (id, name, start_date, end_date, location, status, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [uid(), name, startDate || null, endDate || null, location, status, description]
    );
    res.status(201).json(rowToCamel(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/hackathons/:id", async (req, res) => {
  const { name, startDate, endDate, location, status, description } = req.body;
  try {
    const { rows } = await query(
      `UPDATE hackathons SET name=$1,start_date=$2,end_date=$3,location=$4,status=$5,description=$6
       WHERE id=$7 RETURNING *`,
      [name, startDate || null, endDate || null, location, status, description, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rowToCamel(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/hackathons/:id", async (req, res) => {
  try {
    await query("DELETE FROM hackathons WHERE id=$1", [req.params.id]);
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── JUDGES ────────────────────────────────────────────────────
app.get("/api/judges", async (_req, res) => {
  try {
    const { rows } = await query("SELECT * FROM judges ORDER BY name");
    res.json(rows.map(rowToCamel));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/judges", async (req, res) => {
  const { name, org, role } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  try {
    const { rows } = await query(
      "INSERT INTO judges (id,name,org,role) VALUES ($1,$2,$3,$4) RETURNING *",
      [uid(), name, org, role]
    );
    res.status(201).json(rowToCamel(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/judges/:id", async (req, res) => {
  const { name, org, role } = req.body;
  try {
    const { rows } = await query(
      "UPDATE judges SET name=$1,org=$2,role=$3 WHERE id=$4 RETURNING *",
      [name, org, role, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rowToCamel(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/judges/:id", async (req, res) => {
  try {
    await query("DELETE FROM judges WHERE id=$1", [req.params.id]);
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TEAMS ─────────────────────────────────────────────────────
app.get("/api/teams", async (req, res) => {
  try {
    const { hackathonId } = req.query;
    const { rows } = hackathonId
      ? await query("SELECT * FROM teams WHERE hackathon_id=$1 ORDER BY name", [hackathonId])
      : await query("SELECT * FROM teams ORDER BY name");
    res.json(rows.map(rowToCamel));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/teams", async (req, res) => {
  const { hackathonId, name, project, category, members } = req.body;
  if (!name?.trim())        return res.status(400).json({ error: "name is required" });
  if (!hackathonId?.trim()) return res.status(400).json({ error: "hackathonId is required" });
  try {
    const { rows } = await query(
      "INSERT INTO teams (id,hackathon_id,name,project,category,members) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [uid(), hackathonId, name, project, category, members]
    );
    res.status(201).json(rowToCamel(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/teams/:id", async (req, res) => {
  const { name, project, category, members } = req.body;
  try {
    const { rows } = await query(
      "UPDATE teams SET name=$1,project=$2,category=$3,members=$4 WHERE id=$5 RETURNING *",
      [name, project, category, members, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rowToCamel(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/teams/:id", async (req, res) => {
  try {
    await query("DELETE FROM teams WHERE id=$1", [req.params.id]);
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CRITERIA ──────────────────────────────────────────────────
app.get("/api/criteria", async (req, res) => {
  try {
    const { hackathonId } = req.query;
    const { rows } = hackathonId
      ? await query("SELECT * FROM criteria WHERE hackathon_id=$1 ORDER BY weight DESC", [hackathonId])
      : await query("SELECT * FROM criteria ORDER BY weight DESC");
    res.json(rows.map(rowToCamel));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/criteria", async (req, res) => {
  const { hackathonId, name, description, maxScore = 10, weight = 20 } = req.body;
  if (!name?.trim())        return res.status(400).json({ error: "name is required" });
  if (!hackathonId?.trim()) return res.status(400).json({ error: "hackathonId is required" });
  try {
    const { rows } = await query(
      "INSERT INTO criteria (id,hackathon_id,name,description,max_score,weight) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [uid(), hackathonId, name, description, Number(maxScore), Number(weight)]
    );
    res.status(201).json(rowToCamel(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/criteria/:id", async (req, res) => {
  const { name, description, maxScore, weight } = req.body;
  try {
    const { rows } = await query(
      "UPDATE criteria SET name=$1,description=$2,max_score=$3,weight=$4 WHERE id=$5 RETURNING *",
      [name, description, Number(maxScore), Number(weight), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rowToCamel(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/criteria/:id", async (req, res) => {
  try {
    await query("DELETE FROM criteria WHERE id=$1", [req.params.id]);
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── FEEDBACKS ─────────────────────────────────────────────────
app.get("/api/feedbacks", async (req, res) => {
  try {
    const { hackathonId } = req.query;
    const { rows } = hackathonId
      ? await query("SELECT * FROM feedbacks WHERE hackathon_id=$1 ORDER BY submitted_at DESC", [hackathonId])
      : await query("SELECT * FROM feedbacks ORDER BY submitted_at DESC");
    res.json(rows.map(rowToCamel));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/feedbacks", async (req, res) => {
  const { hackathonId, teamId, judgeId, scores, comments, overall } = req.body;
  if (!hackathonId || !teamId || !judgeId)
    return res.status(400).json({ error: "hackathonId, teamId and judgeId are required" });
  try {
    const { rows } = await query(
      `INSERT INTO feedbacks (id,hackathon_id,team_id,judge_id,scores,comments,overall)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (hackathon_id,team_id,judge_id)
       DO UPDATE SET scores=$5,comments=$6,overall=$7,submitted_at=NOW()
       RETURNING *`,
      [uid(), hackathonId, teamId, judgeId,
       JSON.stringify(scores || {}), JSON.stringify(comments || {}), overall]
    );
    res.status(201).json(rowToCamel(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/feedbacks/:id", async (req, res) => {
  const { scores, comments, overall } = req.body;
  try {
    const { rows } = await query(
      "UPDATE feedbacks SET scores=$1,comments=$2,overall=$3,submitted_at=NOW() WHERE id=$4 RETURNING *",
      [JSON.stringify(scores || {}), JSON.stringify(comments || {}), overall, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rowToCamel(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/feedbacks/:id", async (req, res) => {
  try {
    await query("DELETE FROM feedbacks WHERE id=$1", [req.params.id]);
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

// ── Error handler ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Local dev: listen normally ────────────────────────────────
// Vercel imports this file as a module — it must NOT call listen()
// So we only listen when running directly via `node api/index.js`
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
}

// ── Vercel serverless export ──────────────────────────────────
module.exports = app;
