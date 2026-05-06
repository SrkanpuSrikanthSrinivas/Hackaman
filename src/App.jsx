import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   API CLIENT
   Set your API URL here. When running locally: http://localhost:3001
   When deployed: https://your-api.railway.app (or wherever you host it)
═══════════════════════════════════════════════════════════════ */

// On Vercel the API is same-origin — baseUrl is ""
// In local dev the API runs on port 3001
const IS_LOCAL = typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const DEFAULT_API_URL = IS_LOCAL ? "http://localhost:3001" : "";

function getToken() {
  try { return localStorage.getItem("hf_token") || ""; } catch { return ""; }
}

async function apiFetch(baseUrl, path, options = {}) {
  const token = getToken();
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

function makeApi(baseUrl) {
  const get  = (path)        => apiFetch(baseUrl, path);
  const post = (path, body)  => apiFetch(baseUrl, path, { method: "POST",   body: JSON.stringify(body) });
  const put  = (path, body)  => apiFetch(baseUrl, path, { method: "PUT",    body: JSON.stringify(body) });
  const del  = (path)        => apiFetch(baseUrl, path, { method: "DELETE" });

  return {
    health: ()              => get("/api/health"),
    // Hackathons
    getHackathons:  ()      => get("/api/hackathons"),
    createHackathon: (d)    => post("/api/hackathons", d),
    updateHackathon: (id,d) => put(`/api/hackathons/${id}`, d),
    deleteHackathon: (id)   => del(`/api/hackathons/${id}`),
    // Judges
    getJudges:  ()          => get("/api/judges"),
    createJudge: (d)        => post("/api/judges", d),
    updateJudge: (id,d)     => put(`/api/judges/${id}`, d),
    deleteJudge: (id)       => del(`/api/judges/${id}`),
    // Teams
    getTeams:  (hid)        => get(`/api/teams${hid ? `?hackathonId=${hid}` : ""}`),
    createTeam: (d)         => post("/api/teams", d),
    updateTeam: (id,d)      => put(`/api/teams/${id}`, d),
    deleteTeam: (id)        => del(`/api/teams/${id}`),
    // Criteria
    getCriteria: (hid)      => get(`/api/criteria${hid ? `?hackathonId=${hid}` : ""}`),
    createCriterion: (d)    => post("/api/criteria", d),
    updateCriterion: (id,d) => put(`/api/criteria/${id}`, d),
    deleteCriterion: (id)   => del(`/api/criteria/${id}`),
    // Feedbacks
    getFeedbacks: (hid)     => get(`/api/feedbacks${hid ? `?hackathonId=${hid}` : ""}`),
    createFeedback: (d)     => post("/api/feedbacks", d),
    updateFeedback: (id,d)  => put(`/api/feedbacks/${id}`, d),
    deleteFeedback: (id)    => del(`/api/feedbacks/${id}`),
    // Users
    getUsers:    ()         => get("/api/users"),
    createUser:  (d)        => post("/api/users", d),
    updateUser:  (id,d)     => put(`/api/users/${id}`, d),
    deleteUser:  (id)       => del(`/api/users/${id}`),
    // Assignments
    addAssignment:    (d)          => post("/api/assignments", d),
    removeAssignment: (hid,uid)    => del(`/api/assignments/${hid}/${uid}`),
    // Permissions
    addPermission:    (d)          => post("/api/permissions", d),
    removePermission: (id)         => del(`/api/permissions/${id}`),
  };
}

/* ═══════════════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════════════ */
const fmtDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "—";
const fmtDt   = d => d ? new Date(d).toLocaleString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";

function calcScore(scores, criteria) {
  let num = 0, den = 0;
  criteria.forEach(c => { if (scores?.[c.id] != null) { num += (scores[c.id] / c.maxScore) * c.weight; den += c.weight; } });
  return den > 0 ? +(num / den * 10).toFixed(1) : null;
}
function avgScores(feedbacks, criteria) {
  if (!feedbacks?.length) return null;
  const vals = feedbacks.map(f => calcScore(f.scores, criteria)).filter(s => s != null);
  return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
}

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════ */
const I  = { background:"#fff", border:"1px solid #d4d4d8", borderRadius:5, padding:"7px 10px", fontSize:13, color:"#18181b", width:"100%", outline:"none", fontFamily:"'IBM Plex Sans',sans-serif" };
const TA = { ...I, resize:"vertical", minHeight:76 };
const CAT_COLOR    = { "AI/ML":"blue", "Sustainability":"green", "Security":"amber", "Social Impact":"purple", "EdTech":"teal", "FinTech":"blue", "Health":"green", "Other":"zinc" };
const STATUS_COLOR = { active:"green", upcoming:"amber", completed:"zinc" };

/* ═══════════════════════════════════════════════════════════════
   UI PRIMITIVES
═══════════════════════════════════════════════════════════════ */
function Badge({ label, color = "zinc" }) {
  const map = { green:{bg:"#f0fdf4",tx:"#16a34a",bd:"#bbf7d0"}, amber:{bg:"#fffbeb",tx:"#d97706",bd:"#fde68a"}, blue:{bg:"#eff6ff",tx:"#2563eb",bd:"#bfdbfe"}, red:{bg:"#fef2f2",tx:"#dc2626",bd:"#fecaca"}, purple:{bg:"#faf5ff",tx:"#7c3aed",bd:"#ddd6fe"}, teal:{bg:"#f0fdfa",tx:"#0d9488",bd:"#99f6e4"}, zinc:{bg:"#f4f4f5",tx:"#71717a",bd:"#d4d4d8"} };
  const c = map[color] || map.zinc;
  return <span style={{ display:"inline-block", fontSize:11, fontWeight:500, padding:"2px 8px", borderRadius:9999, background:c.bg, color:c.tx, border:`1px solid ${c.bd}` }}>{label}</span>;
}

function Btn({ children, variant="primary", size="md", onClick, type="button", disabled }) {
  const base = { fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:500, borderRadius:5, cursor:disabled?"not-allowed":"pointer", display:"inline-flex", alignItems:"center", gap:5, transition:"opacity 0.1s", opacity:disabled?0.5:1, fontSize:size==="sm"?12:13, padding:size==="sm"?"5px 10px":"7px 14px" };
  const v = { primary:{background:"#18181b",color:"#fff",border:"none"}, secondary:{background:"#fff",color:"#3f3f46",border:"1px solid #d4d4d8"}, ghost:{background:"transparent",color:"#71717a",border:"none"}, danger:{background:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca"}, blue:{background:"#2563eb",color:"#fff",border:"none"} };
  return <button type={type} style={{ ...base, ...v[variant] }} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:500, color:"#3f3f46", marginBottom:5 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize:11, color:"#71717a", marginTop:3 }}>{hint}</p>}
    </div>
  );
}

function Modal({ title, onClose, children, width=520 }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:10, width:"100%", maxWidth:width, maxHeight:"90vh", overflow:"auto", boxShadow:"0 24px 64px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 22px", borderBottom:"1px solid #e4e4e7" }}>
          <span style={{ fontSize:14, fontWeight:600, color:"#18181b" }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#71717a" }}>×</button>
        </div>
        <div style={{ padding:"20px 22px" }}>{children}</div>
      </div>
    </div>
  );
}

function Table({ cols, rows, empty = "No records found." }) {
  return (
    <div style={{ border:"1px solid #e4e4e7", borderRadius:8, overflow:"hidden", background:"#fff" }}>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr style={{ background:"#fafafa", borderBottom:"1px solid #e4e4e7" }}>
            {cols.map(c => <th key={c.key} style={{ textAlign:"left", padding:"9px 14px", fontSize:11, fontWeight:600, color:"#71717a", letterSpacing:"0.06em" }}>{c.label.toUpperCase()}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={cols.length} style={{ textAlign:"center", padding:"44px 14px", fontSize:13, color:"#a1a1aa", fontStyle:"italic" }}>{empty}</td></tr>
            : rows.map((row, i) => (
              <tr key={row.id || i} style={{ borderBottom: i < rows.length - 1 ? "1px solid #f4f4f5" : "none", transition:"background 0.1s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                {cols.map(c => <td key={c.key} style={{ padding:"11px 14px", fontSize:13, color:"#18181b", verticalAlign:"middle" }}>{c.render ? c.render(row[c.key], row) : (row[c.key] ?? "—")}</td>)}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
      <div>
        <h1 style={{ fontSize:19, fontWeight:600, color:"#18181b", letterSpacing:"-0.01em", marginBottom:2 }}>{title}</h1>
        {subtitle && <p style={{ fontSize:13, color:"#71717a" }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, sub, color="#18181b" }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #e4e4e7", borderRadius:8, padding:"16px 18px" }}>
      <div style={{ fontSize:11, fontWeight:500, color:"#a1a1aa", letterSpacing:"0.06em", marginBottom:8 }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:30, fontWeight:500, color, lineHeight:1, marginBottom:4 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"#71717a" }}>{sub}</div>}
    </div>
  );
}

function ScoreBar({ score, max=10, color }) {
  const pct = Math.min(100, (score / max) * 100);
  const c = color || (score>=8?"#16a34a":score>=6?"#2563eb":score>=4?"#d97706":"#dc2626");
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, background:"#f0f0f0", borderRadius:3, height:5, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:c, borderRadius:3, transition:"width 0.4s" }} />
      </div>
      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#3f3f46", minWidth:32 }}>{score}/{max}</span>
    </div>
  );
}

function Placeholder({ msg }) {
  return <div style={{ background:"#fff", border:"1px solid #e4e4e7", borderRadius:8, padding:"48px 24px", textAlign:"center", color:"#a1a1aa", fontSize:13, fontStyle:"italic" }}>{msg}</div>;
}

function Spinner() {
  return <div style={{ display:"inline-block", width:14, height:14, border:"2px solid #e4e4e7", borderTopColor:"#2563eb", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />;
}

/* ═══════════════════════════════════════════════════════════════
   SETUP SCREEN (when API URL not configured)
═══════════════════════════════════════════════════════════════ */
function SetupScreen({ onConnect }) {
  const [url, setUrl] = useState(DEFAULT_API_URL);
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState("");

  const test = async () => {
    setTesting(true); setErr("");
    try {
      const clean = url.replace(/\/$/, "");
      const res = await fetch(`${clean}/api/health`);
      const data = await res.json();
      if (data.status === "ok") onConnect(clean);
      else setErr("API responded but health check failed.");
    } catch (e) {
      setErr(`Cannot reach API: ${e.message}. Is your server running?`);
    }
    setTesting(false);
  };

  return (
    <div style={{ fontFamily:"'IBM Plex Sans',sans-serif", minHeight:"100vh", background:"#f4f4f5", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ background:"#fff", border:"1px solid #e4e4e7", borderRadius:12, padding:36, width:"100%", maxWidth:460, boxShadow:"0 4px 24px rgba(0,0,0,0.07)" }}>
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:20, fontWeight:600, color:"#18181b", marginBottom:6 }}>Connect to your API</div>
          <p style={{ fontSize:13, color:"#71717a", lineHeight:1.6 }}>
            Enter the URL where your <code style={{ fontFamily:"'IBM Plex Mono',monospace", background:"#f4f4f5", padding:"1px 5px", borderRadius:3 }}>server.js</code> is running. Start it with <code style={{ fontFamily:"'IBM Plex Mono',monospace", background:"#f4f4f5", padding:"1px 5px", borderRadius:3 }}>npm run dev</code>.
          </p>
        </div>

        <div style={{ background:"#18181b", borderRadius:8, padding:16, marginBottom:20, fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#a1a1aa", lineHeight:1.8 }}>
          <span style={{ color:"#52525b" }}># 1. Clone and install</span><br/>
          cd hackfest-api<br/>
          npm install<br/><br/>
          <span style={{ color:"#52525b" }}># 2. Set your Neon connection string</span><br/>
          cp .env.example .env<br/>
          <span style={{ color:"#52525b" }}># edit DATABASE_URL in .env</span><br/><br/>
          <span style={{ color:"#52525b" }}># 3. Run schema in Neon SQL Editor</span><br/>
          <span style={{ color:"#52525b" }}># then start the server</span><br/>
          npm run dev
        </div>

        <Field label="API Base URL">
          <input style={I} value={url} onChange={e => setUrl(e.target.value)}
            placeholder="http://localhost:3001" onKeyDown={e => e.key === "Enter" && test()} />
        </Field>

        {err && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:6, padding:"9px 12px", fontSize:12, color:"#dc2626", marginBottom:14 }}>⚠ {err}</div>}

        <button style={{ width:"100%", background:"#18181b", color:"#fff", border:"none", borderRadius:6, padding:11, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'IBM Plex Sans',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
          onClick={test} disabled={testing}>
          {testing && <Spinner />}
          {testing ? "Testing connection..." : "Connect →"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DATA HOOK
═══════════════════════════════════════════════════════════════ */
function useData(api) {
  const [db, setDb]       = useState({ hackathons:[], teams:[], judges:[], criteria:[], feedbacks:[] });
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [hackathons, teams, judges, criteria, feedbacks] = await Promise.all([
        api.getHackathons(),
        api.getTeams(),
        api.getJudges(),
        api.getCriteria(),
        api.getFeedbacks(),
      ]);
      setDb({ hackathons, teams, judges, criteria, feedbacks });
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { db, loading, error, reload: load };
}

/* ═══════════════════════════════════════════════════════════════
   PAGES
═══════════════════════════════════════════════════════════════ */

// ── DASHBOARD ─────────────────────────────────────────────────
function DashboardPage({ db, activeHackathon }) {
  const hack     = db.hackathons.find(h => h.id === activeHackathon);
  const teams    = db.teams.filter(t => t.hackathonId === activeHackathon);
  const criteria = db.criteria.filter(c => c.hackathonId === activeHackathon);
  const fbs      = db.feedbacks.filter(f => f.hackathonId === activeHackathon);

  if (!hack) return <Placeholder msg="Select a hackathon from the sidebar." />;

  const total    = teams.length * db.judges.length;
  const coverage = total > 0 ? Math.round(fbs.length / total * 100) : 0;

  const ranked = [...teams].map(t => {
    const tf = fbs.filter(f => f.teamId === t.id);
    return { ...t, avg: avgScores(tf, criteria), count: tf.length };
  }).sort((a, b) => (b.avg || 0) - (a.avg || 0));

  const recentFbs = [...fbs].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 5);

  return (
    <div>
      <PageHeader title={hack.name} subtitle={`${fmtDate(hack.startDate)} – ${fmtDate(hack.endDate)}  ·  ${hack.location}`}
        action={<Badge label={hack.status} color={STATUS_COLOR[hack.status] || "zinc"} />} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:22 }}>
        <StatCard label="Teams" value={teams.length} />
        <StatCard label="Judges" value={db.judges.length} />
        <StatCard label="Feedbacks" value={fbs.length} sub={`of ${total} possible`} color="#2563eb" />
        <StatCard label="Coverage" value={`${coverage}%`} color={coverage >= 75 ? "#16a34a" : "#d97706"} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:16 }}>
        <div style={{ background:"#fff", border:"1px solid #e4e4e7", borderRadius:8 }}>
          <div style={{ padding:"13px 16px", borderBottom:"1px solid #f4f4f5", display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:13, fontWeight:600, color:"#18181b" }}>Leaderboard</span>
            <span style={{ fontSize:11, color:"#a1a1aa" }}>{criteria.length} criteria · weighted</span>
          </div>
          {ranked.length === 0
            ? <div style={{ padding:"36px", textAlign:"center", color:"#a1a1aa", fontSize:13 }}>No teams registered yet.</div>
            : ranked.map((t, i) => (
              <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderBottom: i < ranked.length - 1 ? "1px solid #f4f4f5" : "none" }}>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, color:"#d4d4d8", minWidth:18 }}>{i + 1}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                    <span style={{ fontSize:13, fontWeight:500, color:"#18181b" }}>{t.name}</span>
                    <Badge label={t.category} color={CAT_COLOR[t.category] || "zinc"} />
                  </div>
                  <div style={{ fontSize:12, color:"#71717a", marginBottom:5 }}>{t.project}  ·  {t.count} review{t.count !== 1 ? "s" : ""}</div>
                  <ScoreBar score={t.avg || 0} />
                </div>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:20, fontWeight:600, color:t.avg==null?"#d4d4d8":t.avg>=8?"#16a34a":t.avg>=6?"#2563eb":"#d97706", minWidth:42, textAlign:"right" }}>{t.avg ?? "—"}</span>
              </div>
            ))
          }
        </div>
        <div>
          <div style={{ background:"#fff", border:"1px solid #e4e4e7", borderRadius:8, marginBottom:12 }}>
            <div style={{ padding:"13px 16px", borderBottom:"1px solid #f4f4f5" }}>
              <span style={{ fontSize:13, fontWeight:600, color:"#18181b" }}>Recent Activity</span>
            </div>
            {recentFbs.length === 0
              ? <div style={{ padding:"28px", textAlign:"center", color:"#a1a1aa", fontSize:13 }}>No feedback yet.</div>
              : recentFbs.map((fb, i) => {
                const team  = db.teams.find(t => t.id === fb.teamId);
                const judge = db.judges.find(j => j.id === fb.judgeId);
                const s     = calcScore(fb.scores, criteria);
                return (
                  <div key={fb.id} style={{ padding:"10px 16px", borderBottom: i < recentFbs.length - 1 ? "1px solid #f9f9f9" : "none" }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <div>
                        <span style={{ fontSize:12, fontWeight:500, color:"#18181b" }}>{team?.name}</span>
                        <span style={{ fontSize:11, color:"#a1a1aa", marginLeft:6 }}>by {judge?.name?.split(" ").slice(-1)[0]}</span>
                      </div>
                      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, fontWeight:500, color:s==null?"#d4d4d8":s>=8?"#16a34a":"#2563eb" }}>{s ?? "—"}</span>
                    </div>
                    <div style={{ fontSize:11, color:"#a1a1aa", marginTop:1 }}>{fmtDt(fb.submittedAt)}</div>
                  </div>
                );
              })
            }
          </div>
          <div style={{ background:"#18181b", border:"1px solid #27272a", borderRadius:8, padding:16 }}>
            <div style={{ fontSize:11, fontWeight:500, color:"#71717a", letterSpacing:"0.06em", marginBottom:10 }}>CRITERIA WEIGHTS</div>
            {criteria.length === 0 ? <div style={{ fontSize:12, color:"#52525b", textAlign:"center", padding:"8px 0" }}>None defined.</div>
              : criteria.map(c => (
                <div key={c.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
                  <span style={{ fontSize:12, color:"#a1a1aa", minWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
                  <div style={{ flex:1, background:"#27272a", borderRadius:2, height:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${c.weight}%`, background:"#3b82f6", borderRadius:2 }} />
                  </div>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#3b82f6", minWidth:28, textAlign:"right" }}>{c.weight}%</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── HACKATHONS ────────────────────────────────────────────────
function HackathonsPage({ db, api, reload, toast, activeHackathon, setActive, setPage }) {
  const [modal, setModal]   = useState(null);
  const [form,  setForm]    = useState({});
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const open  = (h, e) => { e?.stopPropagation(); setForm(h ? { ...h } : { status:"upcoming" }); setModal(h || "new"); };
  const close = () => setModal(null);

  const save = async () => {
    if (!form.name?.trim()) return toast("Name is required", "error");
    setSaving(true);
    try {
      if (modal === "new") await api.createHackathon(form);
      else await api.updateHackathon(modal.id, form);
      await reload();
      toast(modal === "new" ? "Hackathon created" : "Hackathon updated");
      close();
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  const del = async (id, e) => {
    e?.stopPropagation();
    if (!confirm("Delete this hackathon and all its related data?")) return;
    try { await api.deleteHackathon(id); await reload(); toast("Hackathon deleted"); }
    catch (e) { toast(e.message, "error"); }
  };

  // compute per-hackathon stats
  const hackStats = db.hackathons.map(h => {
    const teams    = db.teams.filter(t => t.hackathonId === h.id);
    const criteria = db.criteria.filter(c => c.hackathonId === h.id);
    const fbs      = db.feedbacks.filter(f => f.hackathonId === h.id);
    const possible = teams.length * db.judges.length;
    const coverage = possible > 0 ? Math.round(fbs.length / possible * 100) : 0;
    const ranked   = [...teams].map(t => {
      const tf = fbs.filter(f => f.teamId === t.id);
      return { ...t, avg: avgScores(tf, criteria) };
    }).sort((a, b) => (b.avg || 0) - (a.avg || 0));
    const leader   = ranked[0] || null;
    const allScores = ranked.map(t => t.avg).filter(s => s != null);
    const eventAvg  = allScores.length ? +(allScores.reduce((a,b)=>a+b,0)/allScores.length).toFixed(1) : null;
    return { ...h, teams, criteria, fbs, possible, coverage, ranked, leader, eventAvg };
  });

  // cross-event summary
  const totalTeams = db.teams.length;
  const totalFbs   = db.feedbacks.length;
  const active     = db.hackathons.filter(h => h.status === "active").length;
  const upcoming   = db.hackathons.filter(h => h.status === "upcoming").length;

  const statusIcon = { active:"●", upcoming:"○", completed:"✓" };

  return (
    <div>
      <PageHeader
        title="All Hackathons"
        subtitle={`${db.hackathons.length} events tracked`}
        action={<Btn onClick={e => open(null, e)}>+ New Hackathon</Btn>}
      />

      {/* Cross-event summary strip */}
      {db.hackathons.length > 1 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:22 }}>
          <StatCard label="Total Events"   value={db.hackathons.length} />
          <StatCard label="Active Now"     value={active}   color={active   > 0 ? "#16a34a" : "#18181b"} />
          <StatCard label="Upcoming"       value={upcoming} color={upcoming > 0 ? "#d97706" : "#18181b"} />
          <StatCard label="Total Feedback" value={totalFbs} sub={`across ${totalTeams} teams`} color="#2563eb" />
        </div>
      )}

      {db.hackathons.length === 0 ? (
        <Placeholder msg="No hackathons yet. Create one to get started." />
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {hackStats.map(h => {
            const isActive  = activeHackathon === h.id;
            const isExpanded = expanded === h.id;
            const sc = STATUS_COLOR[h.status] || "zinc";

            return (
              <div key={h.id} style={{ background:"#fff", border:`1px solid ${isActive ? "#bfdbfe" : "#e4e4e7"}`, borderRadius:8, overflow:"hidden", transition:"border-color 0.15s" }}>

                {/* ── Main row ── */}
                <div
                  style={{ display:"grid", gridTemplateColumns:"2fr 100px 140px 100px 110px 110px 130px auto", alignItems:"center", gap:0, cursor:"pointer", padding:"0 6px" }}
                  onClick={() => setExpanded(isExpanded ? null : h.id)}
                >
                  {/* Name + meta */}
                  <div style={{ padding:"14px 12px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                      <span style={{ fontSize:14, fontWeight:600, color:"#18181b" }}>{h.name}</span>
                      <Badge label={h.status} color={sc} />
                      {isActive && <Badge label="active view" color="blue" />}
                    </div>
                    <div style={{ fontSize:12, color:"#71717a" }}>
                      {h.location}  ·  {fmtDate(h.startDate)} – {fmtDate(h.endDate)}
                    </div>
                    {h.description && <div style={{ fontSize:11, color:"#a1a1aa", marginTop:2 }}>{h.description}</div>}
                  </div>

                  {/* Teams */}
                  <div style={{ padding:"14px 10px", borderLeft:"1px solid #f4f4f5" }}>
                    <div style={{ fontSize:10, color:"#a1a1aa", letterSpacing:"0.06em", marginBottom:4 }}>TEAMS</div>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:20, fontWeight:500, color:"#18181b" }}>{h.teams.length}</div>
                  </div>

                  {/* Coverage */}
                  <div style={{ padding:"14px 10px", borderLeft:"1px solid #f4f4f5" }}>
                    <div style={{ fontSize:10, color:"#a1a1aa", letterSpacing:"0.06em", marginBottom:6 }}>FEEDBACK COVERAGE</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ flex:1, background:"#f0f0f0", borderRadius:3, height:5, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${h.coverage}%`, background: h.coverage>=75?"#16a34a":h.coverage>=40?"#2563eb":"#d97706", borderRadius:3, transition:"width 0.4s" }} />
                      </div>
                      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#3f3f46", minWidth:30 }}>{h.coverage}%</span>
                    </div>
                    <div style={{ fontSize:10, color:"#a1a1aa", marginTop:3 }}>{h.fbs.length}/{h.possible} submitted</div>
                  </div>

                  {/* Criteria */}
                  <div style={{ padding:"14px 10px", borderLeft:"1px solid #f4f4f5" }}>
                    <div style={{ fontSize:10, color:"#a1a1aa", letterSpacing:"0.06em", marginBottom:4 }}>CRITERIA</div>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:20, fontWeight:500, color:"#18181b" }}>{h.criteria.length}</div>
                  </div>

                  {/* Event avg */}
                  <div style={{ padding:"14px 10px", borderLeft:"1px solid #f4f4f5" }}>
                    <div style={{ fontSize:10, color:"#a1a1aa", letterSpacing:"0.06em", marginBottom:4 }}>AVG SCORE</div>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:20, fontWeight:500,
                      color: h.eventAvg==null?"#d4d4d8":h.eventAvg>=8?"#16a34a":h.eventAvg>=6?"#2563eb":"#d97706" }}>
                      {h.eventAvg ?? "—"}
                    </div>
                  </div>

                  {/* Leader */}
                  <div style={{ padding:"14px 10px", borderLeft:"1px solid #f4f4f5" }}>
                    <div style={{ fontSize:10, color:"#a1a1aa", letterSpacing:"0.06em", marginBottom:4 }}>LEADER</div>
                    {h.leader
                      ? <div>
                          <div style={{ fontSize:12, fontWeight:500, color:"#18181b", lineHeight:1.3 }}>{h.leader.name}</div>
                          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#16a34a" }}>{h.leader.avg}</div>
                        </div>
                      : <div style={{ fontSize:12, color:"#a1a1aa" }}>—</div>
                    }
                  </div>

                  {/* Actions */}
                  <div style={{ padding:"14px 10px", borderLeft:"1px solid #f4f4f5", display:"flex", flexDirection:"column", gap:5, alignItems:"flex-start" }}>
                    <Btn size="sm" variant="blue" onClick={e => { e.stopPropagation(); setActive(h.id); setPage("dashboard"); }}>
                      Open →
                    </Btn>
                    <div style={{ display:"flex", gap:4 }}>
                      <Btn size="sm" variant="secondary" onClick={e => open(h, e)}>Edit</Btn>
                      <Btn size="sm" variant="danger"    onClick={e => del(h.id, e)}>Del</Btn>
                    </div>
                  </div>

                  {/* Expand chevron */}
                  <div style={{ padding:"14px 10px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontSize:11, color:"#a1a1aa", transition:"transform 0.2s", display:"inline-block", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                  </div>
                </div>

                {/* ── Expanded detail panel ── */}
                {isExpanded && (
                  <div style={{ borderTop:"1px solid #f4f4f5", background:"#fafafa", padding:"16px 20px" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>

                      {/* Mini leaderboard */}
                      <div>
                        <div style={{ fontSize:11, fontWeight:600, color:"#71717a", letterSpacing:"0.06em", marginBottom:10 }}>TEAM RANKINGS</div>
                        {h.ranked.length === 0
                          ? <div style={{ fontSize:12, color:"#a1a1aa", fontStyle:"italic" }}>No teams registered.</div>
                          : h.ranked.map((t, i) => (
                            <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#d4d4d8", minWidth:16 }}>{i+1}</span>
                              <div style={{ flex:1 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                                  <span style={{ fontSize:12, fontWeight:500, color:"#18181b" }}>{t.name}</span>
                                  <Badge label={t.category} color={CAT_COLOR[t.category]||"zinc"} />
                                </div>
                                <div style={{ background:"#e4e4e7", borderRadius:2, height:4, overflow:"hidden" }}>
                                  <div style={{ height:"100%", width:`${(t.avg||0)*10}%`, background: t.avg>=8?"#16a34a":t.avg>=6?"#2563eb":"#d97706", borderRadius:2 }} />
                                </div>
                              </div>
                              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, fontWeight:500, minWidth:32, textAlign:"right",
                                color: t.avg==null?"#d4d4d8":t.avg>=8?"#16a34a":t.avg>=6?"#2563eb":"#d97706" }}>
                                {t.avg ?? "—"}
                              </span>
                            </div>
                          ))
                        }
                      </div>

                      {/* Criteria weights + judge coverage */}
                      <div>
                        <div style={{ fontSize:11, fontWeight:600, color:"#71717a", letterSpacing:"0.06em", marginBottom:10 }}>CRITERIA WEIGHTS</div>
                        {h.criteria.length === 0
                          ? <div style={{ fontSize:12, color:"#a1a1aa", fontStyle:"italic", marginBottom:16 }}>No criteria defined.</div>
                          : h.criteria.map(c => (
                            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                              <span style={{ fontSize:12, color:"#71717a", minWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
                              <div style={{ flex:1, background:"#e4e4e7", borderRadius:2, height:4, overflow:"hidden" }}>
                                <div style={{ height:"100%", width:`${c.weight}%`, background:"#2563eb", borderRadius:2 }} />
                              </div>
                              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#2563eb", minWidth:28, textAlign:"right" }}>{c.weight}%</span>
                            </div>
                          ))
                        }
                        <div style={{ marginTop:14 }}>
                          <div style={{ fontSize:11, fontWeight:600, color:"#71717a", letterSpacing:"0.06em", marginBottom:8 }}>JUDGE SUBMISSIONS</div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                            {db.judges.map(j => {
                              const count = h.fbs.filter(f => f.judgeId === j.id).length;
                              const done  = count === h.teams.length && h.teams.length > 0;
                              return (
                                <div key={j.id} style={{ fontSize:11, background: done?"#f0fdf4":"#f4f4f5", border:`1px solid ${done?"#bbf7d0":"#e4e4e7"}`, borderRadius:5, padding:"4px 10px", color: done?"#16a34a":"#71717a" }}>
                                  {j.name.split(" ").slice(-1)[0]}
                                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", marginLeft:4 }}>{count}/{h.teams.length}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={modal==="new"?"New Hackathon":"Edit Hackathon"} onClose={close}>
          <Field label="Event Name"><input style={I} value={form.name||""} onChange={f("name")} placeholder="HackFest 2025" /></Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Start Date"><input type="date" style={I} value={form.startDate?.slice(0,10)||""} onChange={f("startDate")} /></Field>
            <Field label="End Date"><input type="date" style={I} value={form.endDate?.slice(0,10)||""} onChange={f("endDate")} /></Field>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Location"><input style={I} value={form.location||""} onChange={f("location")} placeholder="City, State" /></Field>
            <Field label="Status">
              <select style={I} value={form.status||"upcoming"} onChange={f("status")}>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
          </div>
          <Field label="Description"><textarea style={TA} value={form.description||""} onChange={f("description")} /></Field>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:4 }}>
            <Btn variant="secondary" onClick={close}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving?<Spinner/>:null} Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── JUDGES ────────────────────────────────────────────────────
function JudgesPage({ db, api, reload, toast }) {
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const open  = j => { setForm(j?{...j}:{}); setModal(j||"new"); };
  const close = () => setModal(null);
  const save  = async () => {
    if (!form.name?.trim()) return toast("Name is required","error");
    setSaving(true);
    try {
      if (modal==="new") await api.createJudge(form);
      else await api.updateJudge(modal.id, form);
      await reload(); toast(modal==="new"?"Judge added":"Judge updated"); close();
    } catch(e) { toast(e.message,"error"); }
    setSaving(false);
  };
  const del = async id => {
    try { await api.deleteJudge(id); await reload(); toast("Judge removed"); }
    catch(e) { toast(e.message,"error"); }
  };
  return (
    <div>
      <PageHeader title="Judges" subtitle={`${db.judges.length} registered`} action={<Btn onClick={()=>open(null)}>+ Add Judge</Btn>} />
      <Table
        cols={[
          {key:"name",label:"Name",render:v=><span style={{fontWeight:500}}>{v}</span>},
          {key:"org",label:"Organization"},
          {key:"role",label:"Role / Title"},
          {key:"id",label:"",render:(_,r)=>(
            <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
              <Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();open(r);}}>Edit</Btn>
              <Btn size="sm" variant="danger"    onClick={e=>{e.stopPropagation();del(r.id);}}>Remove</Btn>
            </div>
          )},
        ]}
        rows={db.judges} empty="No judges registered."
      />
      {modal && (
        <Modal title={modal==="new"?"Add Judge":"Edit Judge"} onClose={close}>
          <Field label="Full Name"><input style={I} value={form.name||""} onChange={f("name")} /></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Organization"><input style={I} value={form.org||""} onChange={f("org")} /></Field>
            <Field label="Role / Title"><input style={I} value={form.role||""} onChange={f("role")} /></Field>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
            <Btn variant="secondary" onClick={close}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving?<Spinner/>:null} Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── TEAMS ─────────────────────────────────────────────────────
function TeamsPage({ db, api, reload, toast, activeHackathon }) {
  const [modal,setModal]    = useState(null);
  const [form,setForm]      = useState({});
  const [saving,setSaving]  = useState(false);
  const f = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const hack  = db.hackathons.find(h=>h.id===activeHackathon);
  const teams = db.teams.filter(t=>t.hackathonId===activeHackathon);
  const open  = t => { setForm(t?{...t}:{hackathonId:activeHackathon}); setModal(t||"new"); };
  const close = () => setModal(null);
  const save  = async () => {
    if (!form.name?.trim()) return toast("Name is required","error");
    setSaving(true);
    try {
      if (modal==="new") await api.createTeam(form);
      else await api.updateTeam(modal.id, form);
      await reload(); toast(modal==="new"?"Team added":"Team updated"); close();
    } catch(e) { toast(e.message,"error"); }
    setSaving(false);
  };
  const del = async id => {
    try { await api.deleteTeam(id); await reload(); toast("Team removed"); }
    catch(e) { toast(e.message,"error"); }
  };
  if (!activeHackathon) return <Placeholder msg="Select a hackathon from the sidebar." />;
  return (
    <div>
      <PageHeader title="Teams" subtitle={hack?`${teams.length} teams in ${hack.name}`:""} action={<Btn onClick={()=>open(null)}>+ Add Team</Btn>} />
      <Table
        cols={[
          {key:"name",label:"Team / Project",render:(v,r)=><div><div style={{fontWeight:500}}>{v}</div><div style={{fontSize:12,color:"#71717a"}}>{r.project}</div></div>},
          {key:"category",label:"Category",render:v=><Badge label={v} color={CAT_COLOR[v]||"zinc"} />},
          {key:"members",label:"Members",render:v=><span style={{fontSize:12,color:"#71717a"}}>{v}</span>},
          {key:"id",label:"",render:(_,r)=>(
            <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
              <Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();open(r);}}>Edit</Btn>
              <Btn size="sm" variant="danger"    onClick={e=>{e.stopPropagation();del(r.id);}}>Remove</Btn>
            </div>
          )},
        ]}
        rows={teams} empty="No teams yet."
      />
      {modal && (
        <Modal title={modal==="new"?"Add Team":"Edit Team"} onClose={close}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Team Name"><input style={I} value={form.name||""} onChange={f("name")} /></Field>
            <Field label="Project Name"><input style={I} value={form.project||""} onChange={f("project")} /></Field>
          </div>
          <Field label="Category">
            <select style={I} value={form.category||""} onChange={f("category")}>
              <option value="">Select...</option>
              {["AI/ML","Sustainability","Security","Social Impact","EdTech","FinTech","Health","Other"].map(c=><option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Members" hint="Comma-separated names">
            <input style={I} value={form.members||""} onChange={f("members")} placeholder="Alice, Bob, Carol" />
          </Field>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
            <Btn variant="secondary" onClick={close}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving?<Spinner/>:null} Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── CRITERIA ──────────────────────────────────────────────────
function CriteriaPage({ db, api, reload, toast, activeHackathon }) {
  const [modal,setModal]   = useState(null);
  const [form,setForm]     = useState({});
  const [saving,setSaving] = useState(false);
  const f = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const hack     = db.hackathons.find(h=>h.id===activeHackathon);
  const criteria = db.criteria.filter(c=>c.hackathonId===activeHackathon);
  const totalW   = criteria.reduce((a,c)=>a+c.weight,0);
  const open  = c => { setForm(c?{...c}:{hackathonId:activeHackathon,maxScore:10,weight:20}); setModal(c||"new"); };
  const close = () => setModal(null);
  const save  = async () => {
    if (!form.name?.trim()) return toast("Name is required","error");
    setSaving(true);
    try {
      if (modal==="new") await api.createCriterion(form);
      else await api.updateCriterion(modal.id, form);
      await reload(); toast(modal==="new"?"Criterion added":"Criterion updated"); close();
    } catch(e) { toast(e.message,"error"); }
    setSaving(false);
  };
  const del = async id => {
    try { await api.deleteCriterion(id); await reload(); toast("Criterion removed"); }
    catch(e) { toast(e.message,"error"); }
  };
  if (!activeHackathon) return <Placeholder msg="Select a hackathon." />;
  return (
    <div>
      <PageHeader title="Evaluation Criteria" subtitle={hack?.name} action={<Btn onClick={()=>open(null)}>+ Add Criterion</Btn>} />
      {criteria.length>0&&totalW!==100&&(
        <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,padding:"9px 14px",marginBottom:14,fontSize:12,color:"#d97706"}}>
          ⚠  Weights sum to {totalW}% — should total 100% for accurate scoring.
        </div>
      )}
      <Table
        cols={[
          {key:"name",label:"Criterion",render:(v,r)=><div><div style={{fontWeight:500}}>{v}</div><div style={{fontSize:12,color:"#71717a"}}>{r.description}</div></div>},
          {key:"maxScore",label:"Max Score",render:v=><span style={{fontFamily:"'IBM Plex Mono',monospace"}}>{v}</span>},
          {key:"weight",label:"Weight",render:v=>(
            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:130}}>
              <div style={{flex:1,background:"#f0f0f0",borderRadius:2,height:5,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${v}%`,background:"#2563eb",borderRadius:2}} />
              </div>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#3f3f46",minWidth:32}}>{v}%</span>
            </div>
          )},
          {key:"id",label:"",render:(_,r)=>(
            <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
              <Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();open(r);}}>Edit</Btn>
              <Btn size="sm" variant="danger"    onClick={e=>{e.stopPropagation();del(r.id);}}>Remove</Btn>
            </div>
          )},
        ]}
        rows={criteria} empty="No criteria defined."
      />
      {modal && (
        <Modal title={modal==="new"?"Add Criterion":"Edit Criterion"} onClose={close}>
          <Field label="Name"><input style={I} value={form.name||""} onChange={f("name")} placeholder="e.g. Innovation" /></Field>
          <Field label="Description"><textarea style={TA} value={form.description||""} onChange={f("description")} /></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Max Score"><input type="number" style={I} value={form.maxScore||10} onChange={f("maxScore")} /></Field>
            <Field label="Weight %" hint={`Total currently: ${totalW}%`}><input type="number" style={I} value={form.weight||20} onChange={f("weight")} /></Field>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
            <Btn variant="secondary" onClick={close}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving?<Spinner/>:null} Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── SUBMIT FEEDBACK ───────────────────────────────────────────
function FeedbackPage({ db, api, reload, toast, activeHackathon }) {
  const hack     = db.hackathons.find(h=>h.id===activeHackathon);
  const teams    = db.teams.filter(t=>t.hackathonId===activeHackathon);
  const criteria = db.criteria.filter(c=>c.hackathonId===activeHackathon);
  const [teamId,setTeamId]   = useState(teams[0]?.id||"");
  const [judgeId,setJudgeId] = useState(db.judges[0]?.id||"");
  const [scores,setScores]   = useState({});
  const [comments,setComments] = useState({});
  const [overall,setOverall]   = useState("");
  const [saving,setSaving]     = useState(false);
  const [savedOk,setSavedOk]   = useState(false);

  const existing = db.feedbacks.find(f=>f.teamId===teamId&&f.judgeId===judgeId&&f.hackathonId===activeHackathon);
  useEffect(()=>{
    if(existing){setScores(existing.scores||{});setComments(existing.comments||{});setOverall(existing.overall||"");}
    else{setScores({});setComments({});setOverall("");}
    setSavedOk(false);
  },[teamId,judgeId]);

  const submit = async () => {
    if (!criteria.every(c=>scores[c.id]!=null)) return toast("Score all criteria first","error");
    setSaving(true);
    try {
      await api.createFeedback({ hackathonId:activeHackathon, teamId, judgeId, scores, comments, overall });
      await reload(); toast("Feedback saved"); setSavedOk(true);
    } catch(e){ toast(e.message,"error"); }
    setSaving(false);
  };

  const score = calcScore(scores,criteria);
  if(!activeHackathon) return <Placeholder msg="Select a hackathon." />;
  if(!criteria.length) return <Placeholder msg="No criteria defined. Add criteria first." />;
  if(!teams.length)    return <Placeholder msg="No teams registered yet." />;

  return (
    <div>
      <PageHeader title="Submit Feedback" subtitle={hack?.name} />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        <Field label="Team"><select style={I} value={teamId} onChange={e=>setTeamId(e.target.value)}>{teams.map(t=><option key={t.id} value={t.id}>{t.name} — {t.project}</option>)}</select></Field>
        <Field label="Judge"><select style={I} value={judgeId} onChange={e=>setJudgeId(e.target.value)}>{db.judges.map(j=><option key={j.id} value={j.id}>{j.name} ({j.org})</option>)}</select></Field>
      </div>
      {existing&&<div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"9px 14px",marginBottom:14,fontSize:12,color:"#2563eb"}}>Editing existing submission from {fmtDt(existing.submittedAt)}.</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:18}}>
        <div>
          {criteria.map(c=>{
            const s=scores[c.id]??0; const has=scores[c.id]!=null;
            const sc=has?(s>=8?"#16a34a":s>=6?"#2563eb":s>=4?"#d97706":"#dc2626"):"#d4d4d8";
            return(
              <div key={c.id} style={{background:"#fff",border:"1px solid #e4e4e7",borderRadius:8,padding:16,marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div><span style={{fontSize:14,fontWeight:600}}>{c.name}</span><span style={{fontSize:12,color:"#a1a1aa",marginLeft:8}}>weight: {c.weight}%</span></div>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:20,fontWeight:500,color:sc}}>{has?s:"—"}<span style={{fontSize:12,color:"#d4d4d8"}}>/{c.maxScore}</span></span>
                </div>
                <p style={{fontSize:12,color:"#71717a",marginBottom:10}}>{c.description}</p>
                <input type="range" min={0} max={c.maxScore} value={s} style={{width:"100%",accentColor:"#2563eb",cursor:"pointer",marginBottom:4}} onChange={e=>setScores(p=>({...p,[c.id]:+e.target.value}))} />
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#d4d4d8",marginBottom:8}}>
                  {[...Array(c.maxScore+1)].map((_,i)=>i%2===0?<span key={i}>{i}</span>:null)}
                </div>
                <textarea style={{...TA,minHeight:56}} placeholder={`Comment on ${c.name}...`} value={comments[c.id]||""} onChange={e=>setComments(p=>({...p,[c.id]:e.target.value}))} />
              </div>
            );
          })}
        </div>
        <div style={{position:"sticky",top:20,alignSelf:"start"}}>
          <div style={{background:"#fff",border:"1px solid #e4e4e7",borderRadius:8,padding:18}}>
            <div style={{fontSize:11,fontWeight:500,color:"#a1a1aa",letterSpacing:"0.06em",marginBottom:14}}>SCORE PREVIEW</div>
            <div style={{textAlign:"center",paddingBottom:16,borderBottom:"1px solid #f4f4f5",marginBottom:14}}>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:60,fontWeight:500,lineHeight:1,color:score==null?"#e4e4e7":score>=8?"#16a34a":score>=6?"#2563eb":"#d97706"}}>{score??"—"}</div>
              <div style={{fontSize:11,color:"#a1a1aa",marginTop:4}}>weighted / 10</div>
            </div>
            {criteria.map(c=>(
              <div key={c.id} style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                <span style={{fontSize:12,color:"#71717a"}}>{c.name}</span>
                <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:scores[c.id]!=null?"#18181b":"#d4d4d8"}}>{scores[c.id]!=null?`${scores[c.id]}/${c.maxScore}`:"—"}</span>
              </div>
            ))}
            <div style={{borderTop:"1px solid #f4f4f5",marginTop:12,paddingTop:12}}>
              <Field label="Overall Remarks"><textarea style={{...TA,minHeight:68}} value={overall} onChange={e=>setOverall(e.target.value)} placeholder="Summary for this team..." /></Field>
              <button style={{width:"100%",background:"#18181b",color:"#fff",border:"none",borderRadius:6,padding:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'IBM Plex Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={submit} disabled={saving}>
                {saving&&<Spinner/>} {existing?"Update Feedback":"Submit Feedback"}
              </button>
              {savedOk&&<div style={{textAlign:"center",fontSize:12,color:"#16a34a",marginTop:7}}>✓ Saved to Neon DB</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ALL FEEDBACK ──────────────────────────────────────────────
function AllFeedbackPage({ db, api, reload, toast, activeHackathon }) {
  const [filterTeam,setFilterTeam]   = useState("all");
  const [filterJudge,setFilterJudge] = useState("all");
  const hack     = db.hackathons.find(h=>h.id===activeHackathon);
  const criteria = db.criteria.filter(c=>c.hackathonId===activeHackathon);
  const teams    = db.teams.filter(t=>t.hackathonId===activeHackathon);
  const fbs      = db.feedbacks.filter(f=>f.hackathonId===activeHackathon&&(filterTeam==="all"||f.teamId===filterTeam)&&(filterJudge==="all"||f.judgeId===filterJudge));
  const del = async id => {
    try { await api.deleteFeedback(id); await reload(); toast("Feedback deleted"); }
    catch(e){ toast(e.message,"error"); }
  };
  if (!activeHackathon) return <Placeholder msg="Select a hackathon." />;
  return (
    <div>
      <PageHeader title="All Feedback" subtitle={`${fbs.length} submission${fbs.length!==1?"s":""}  ·  ${hack?.name}`} />
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <select style={{...I,width:"auto"}} value={filterTeam} onChange={e=>setFilterTeam(e.target.value)}>
          <option value="all">All Teams</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select style={{...I,width:"auto"}} value={filterJudge} onChange={e=>setFilterJudge(e.target.value)}>
          <option value="all">All Judges</option>{db.judges.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}
        </select>
      </div>
      {fbs.length===0?<Placeholder msg="No feedback for this selection." />:fbs.map((fb,i)=>{
        const team=db.teams.find(t=>t.id===fb.teamId); const judge=db.judges.find(j=>j.id===fb.judgeId);
        const s=calcScore(fb.scores,criteria);
        return(
          <div key={fb.id} style={{background:"#fff",border:"1px solid #e4e4e7",borderRadius:8,padding:18,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  <span style={{fontSize:14,fontWeight:600}}>{team?.name}</span>
                  <span style={{fontSize:13,color:"#a1a1aa"}}>—</span>
                  <span style={{fontSize:13,color:"#71717a"}}>{team?.project}</span>
                  <Badge label={team?.category||""} color={CAT_COLOR[team?.category]||"zinc"} />
                </div>
                <div style={{fontSize:12,color:"#71717a"}}>By <strong style={{color:"#3f3f46"}}>{judge?.name}</strong> · {judge?.org} · {fmtDt(fb.submittedAt)}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:24,fontWeight:600,color:s==null?"#d4d4d8":s>=8?"#16a34a":s>=6?"#2563eb":"#d97706"}}>{s??"—"}</div>
                  <div style={{fontSize:10,color:"#a1a1aa"}}>/10</div>
                </div>
                <Btn size="sm" variant="danger" onClick={()=>del(fb.id)}>Delete</Btn>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:8,marginBottom:fb.overall?10:0}}>
              {criteria.map(c=>(
                <div key={c.id} style={{background:"#f9fafb",borderRadius:6,padding:"10px 11px"}}>
                  <div style={{fontSize:11,color:"#71717a",marginBottom:6}}>{c.name}</div>
                  <ScoreBar score={fb.scores?.[c.id]||0} max={c.maxScore} />
                  {fb.comments?.[c.id]&&<p style={{fontSize:11,color:"#71717a",marginTop:6,lineHeight:1.5}}>{fb.comments[c.id]}</p>}
                </div>
              ))}
            </div>
            {fb.overall&&<div style={{background:"#f9fafb",borderRadius:6,padding:"10px 12px",fontSize:12,color:"#3f3f46",fontStyle:"italic",borderLeft:"3px solid #d4d4d8"}}>"{fb.overall}"</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── REPORTS ───────────────────────────────────────────────────
function ReportPage({ db, activeHackathon }) {
  const hack     = db.hackathons.find(h=>h.id===activeHackathon);
  const teams    = db.teams.filter(t=>t.hackathonId===activeHackathon);
  const criteria = db.criteria.filter(c=>c.hackathonId===activeHackathon);
  const allFbs   = db.feedbacks.filter(f=>f.hackathonId===activeHackathon);
  const ranked   = [...teams].map(t=>({...t,avg:avgScores(allFbs.filter(f=>f.teamId===t.id),criteria)??0,count:allFbs.filter(f=>f.teamId===t.id).length})).sort((a,b)=>b.avg-a.avg);
  const [selTeam,setSelTeam] = useState(ranked[0]?.id||"");
  const team    = db.teams.find(t=>t.id===selTeam);
  const teamFbs = allFbs.filter(f=>f.teamId===selTeam);
  const avg     = avgScores(teamFbs,criteria);
  const critBreakdown = criteria.map(c=>{
    const vals=teamFbs.map(f=>f.scores?.[c.id]).filter(v=>v!=null);
    return{...c,avg:vals.length?+(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):null};
  });
  if (!activeHackathon) return <Placeholder msg="Select a hackathon." />;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div><h1 style={{fontSize:19,fontWeight:600,color:"#18181b",marginBottom:2}}>Reports</h1><p style={{fontSize:13,color:"#71717a"}}>{hack?.name}</p></div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <select style={{...I,width:"auto"}} value={selTeam} onChange={e=>setSelTeam(e.target.value)}>
            {ranked.map((t,i)=><option key={t.id} value={t.id}>{i+1}. {t.name}</option>)}
          </select>
          <Btn variant="secondary" onClick={()=>window.print()}>Print / PDF</Btn>
        </div>
      </div>
      {team&&(
        <div>
          <div style={{background:"#fff",border:"1px solid #e4e4e7",borderRadius:8,padding:24,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{marginBottom:8}}><Badge label={team.category} color={CAT_COLOR[team.category]||"zinc"} /></div>
                <h2 style={{fontSize:22,fontWeight:600,color:"#18181b",marginBottom:4}}>{team.name}</h2>
                <p style={{fontSize:15,color:"#2563eb",fontWeight:500,marginBottom:6}}>{team.project}</p>
                <p style={{fontSize:12,color:"#71717a"}}>Members: {team.members}</p>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:64,fontWeight:500,lineHeight:1,color:avg==null?"#e4e4e7":avg>=8?"#16a34a":avg>=6?"#2563eb":"#d97706"}}>{avg??"—"}</div>
                <div style={{fontSize:12,color:"#71717a"}}>avg score / 10</div>
                <div style={{fontSize:11,color:"#a1a1aa",marginTop:3}}>{teamFbs.length} of {db.judges.length} judges reviewed</div>
              </div>
            </div>
          </div>
          <div style={{background:"#fff",border:"1px solid #e4e4e7",borderRadius:8,padding:20,marginBottom:14}}>
            <h3 style={{fontSize:13,fontWeight:600,color:"#18181b",marginBottom:14}}>Criteria Breakdown</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:10}}>
              {critBreakdown.map(c=>{
                const color=c.avg==null?"#d4d4d8":c.avg>=8?"#16a34a":c.avg>=6?"#2563eb":c.avg>=4?"#d97706":"#dc2626";
                return(
                  <div key={c.id} style={{background:"#f9fafb",borderRadius:8,padding:14}}>
                    <div style={{fontSize:11,color:"#71717a",marginBottom:8}}>{c.name.toUpperCase()}  ·  {c.weight}%</div>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:28,fontWeight:500,color,marginBottom:8}}>{c.avg??"—"}<span style={{fontSize:12,color:"#d4d4d8"}}>/{c.maxScore}</span></div>
                    <div style={{background:"#e4e4e7",borderRadius:3,height:5,overflow:"hidden"}}><div style={{height:"100%",width:`${c.avg?c.avg/c.maxScore*100:0}%`,background:color,borderRadius:3}} /></div>
                  </div>
                );
              })}
            </div>
          </div>
          {teamFbs.length>0&&(
            <div style={{background:"#fff",border:"1px solid #e4e4e7",borderRadius:8,padding:20,marginBottom:14}}>
              <h3 style={{fontSize:13,fontWeight:600,color:"#18181b",marginBottom:14}}>Judge Reviews</h3>
              {teamFbs.map((fb,i)=>{
                const judge=db.judges.find(j=>j.id===fb.judgeId); const s=calcScore(fb.scores,criteria);
                return(
                  <div key={fb.id} style={{paddingBottom:i<teamFbs.length-1?14:0,marginBottom:i<teamFbs.length-1?14:0,borderBottom:i<teamFbs.length-1?"1px solid #f4f4f5":"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <div><span style={{fontSize:13,fontWeight:500}}>{judge?.name}</span><span style={{fontSize:12,color:"#71717a",marginLeft:8}}>{judge?.org} · {judge?.role}</span></div>
                      <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:18,fontWeight:600,color:s>=8?"#16a34a":s>=6?"#2563eb":"#d97706"}}>{s}</span>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                      {criteria.map(c=><span key={c.id} style={{fontSize:11,background:"#f4f4f5",border:"1px solid #e4e4e7",borderRadius:4,padding:"3px 8px",color:"#71717a"}}>{c.name}: <span style={{fontFamily:"'IBM Plex Mono',monospace",color:"#18181b"}}>{fb.scores?.[c.id]??"—"}</span></span>)}
                    </div>
                    {fb.overall&&<p style={{fontSize:12,color:"#71717a",fontStyle:"italic",borderLeft:"2px solid #e4e4e7",paddingLeft:10}}>"{fb.overall}"</p>}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{background:"#fff",border:"1px solid #e4e4e7",borderRadius:8,padding:20}}>
            <h3 style={{fontSize:13,fontWeight:600,color:"#18181b",marginBottom:14}}>Full Rankings</h3>
            {ranked.map((t,i)=>{
              const isThis=t.id===selTeam;
              return(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 10px",borderRadius:6,background:isThis?"#eff6ff":"transparent",borderBottom:i<ranked.length-1?"1px solid #f4f4f5":"none"}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:"#d4d4d8",minWidth:20}}>{i+1}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:1}}>
                      <span style={{fontSize:13,fontWeight:isThis?600:400}}>{t.name}</span>
                      {isThis&&<Badge label="current" color="blue" />}
                    </div>
                    <span style={{fontSize:11,color:"#71717a"}}>{t.project}</span>
                  </div>
                  <div style={{width:100,background:"#f0f0f0",borderRadius:3,height:5,overflow:"hidden"}}><div style={{height:"100%",width:`${t.avg*10}%`,background:t.avg>=8?"#16a34a":t.avg>=6?"#2563eb":"#d97706",borderRadius:3}} /></div>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:15,fontWeight:500,minWidth:36,textAlign:"right",color:t.avg>=8?"#16a34a":t.avg>=6?"#2563eb":t.avg>0?"#d97706":"#d4d4d8"}}>{t.avg||"—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════ */
const PAGES = [
  {id:"dashboard",label:"Dashboard"},
  {id:"hackathons",label:"Hackathons"},
  {id:"teams",label:"Teams"},
  {id:"judges",label:"Judges"},
  {id:"criteria",label:"Criteria"},
  {id:"---"},
  {id:"feedback",label:"Submit Feedback"},
  {id:"all-feedback",label:"All Feedback"},
  {id:"reports",label:"Reports"},
];


/* ═══════════════════════════════════════════════════════════════
   LOGIN PAGE
═══════════════════════════════════════════════════════════════ */
function LoginPage({ apiUrl, onLogin, toast }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");

  const submit = async e => {
    e.preventDefault();
    setLoading(true); setErr("");
    try {
      const res  = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Login failed"); setLoading(false); return; }
      localStorage.setItem("hf_token", data.token);
      onLogin(data.user);
    } catch (e) { setErr("Cannot reach API. Is the server running?"); }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily:"'IBM Plex Sans',sans-serif", minHeight:"100vh", background:"#f4f4f5",
      display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap'); *{box-sizing:border-box;margin:0;padding:0;}`}</style>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:28, fontWeight:600,
            color:"#18181b", letterSpacing:"-0.02em", marginBottom:4 }}>HackFest Hub</div>
          <div style={{ fontSize:13, color:"#71717a" }}>Sign in to your account</div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #e4e4e7", borderRadius:10,
          padding:"28px 28px 24px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)" }}>
          {err && (
            <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:6,
              padding:"9px 12px", fontSize:12, color:"#dc2626", marginBottom:16 }}>⚠ {err}</div>
          )}
          <form onSubmit={submit}>
            <Field label="Email">
              <input style={I} type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="you@hackfest.com" autoFocus required />
            </Field>
            <Field label="Password">
              <input style={I} type="password" value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••" required />
            </Field>
            <button type="submit" disabled={loading}
              style={{ width:"100%", background:"#18181b", color:"#fff", border:"none",
                borderRadius:6, padding:"10px", fontSize:13, fontWeight:600, cursor:"pointer",
                fontFamily:"'IBM Plex Sans',sans-serif", marginTop:4,
                display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              {loading && <Spinner />}
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <div style={{ marginTop:18, padding:"12px 0 0", borderTop:"1px solid #f4f4f5",
            fontSize:11, color:"#a1a1aa", lineHeight:2 }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11 }}>
              <span style={{ color:"#3f3f46" }}>Admin</span>&nbsp; admin@hackfest.com / admin123<br/>
              <span style={{ color:"#3f3f46" }}>Judge</span>&nbsp; srikanth@hackfest.com / judge123
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   USER MANAGEMENT PAGE (admin only)
═══════════════════════════════════════════════════════════════ */
const PAGES_LIST = [
  { id:"dashboard",    label:"Dashboard" },
  { id:"reports",      label:"Reports" },
  { id:"all-feedback", label:"All Feedback" },
  { id:"criteria",     label:"Criteria" },
];

function UserManagementPage({ db, api, reload, toast }) {
  const [users, setUsers]           = useState([]);
  const [selectedUser, setSelected] = useState(null);
  const [modal, setModal]           = useState(null);
  const [form, setForm]             = useState({});
  const [saving, setSaving]         = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const loadUsers = async () => {
    try { const u = await api.getUsers(); setUsers(u); } catch {}
  };
  useEffect(() => { loadUsers(); }, []);

  const sel = users.find(u => u.id === selectedUser) || null;

  const openModal = u => { setForm(u ? { ...u, password:"" } : { role:"judge" }); setModal(u||"new"); };
  const closeModal = () => setModal(null);

  const saveUser = async () => {
    if (!form.name?.trim()||!form.email?.trim()) return toast("Name and email required","error");
    if (modal==="new" && !form.password?.trim()) return toast("Password required for new users","error");
    setSaving(true);
    try {
      if (modal==="new") await api.createUser(form);
      else await api.updateUser(modal.id, form);
      await loadUsers(); toast(modal==="new"?"User created":"User updated"); closeModal();
    } catch(e) { toast(e.message,"error"); }
    setSaving(false);
  };

  const deleteUser = async id => {
    if (!confirm("Delete this user?")) return;
    try { await api.deleteUser(id); await loadUsers(); setSelected(null); toast("User deleted"); }
    catch(e) { toast(e.message,"error"); }
  };

  const toggleAssignment = async (hackathonId, assigned) => {
    try {
      if (assigned) await api.removeAssignment(hackathonId, sel.id);
      else          await api.addAssignment(hackathonId, sel.id);
      await loadUsers();
      setSelected(sel.id);
    } catch(e) { toast(e.message,"error"); }
  };

  const togglePermission = async (hackathonId, page, existing) => {
    try {
      if (existing) await api.removePermission(existing.id);
      else          await api.addPermission({ userId: sel.id, hackathonId, page });
      await loadUsers();
    } catch(e) { toast(e.message,"error"); }
  };

  return (
    <div>
      <PageHeader title="User Management" subtitle={`${users.length} users`}
        action={<Btn onClick={() => openModal(null)}>+ Add User</Btn>} />
      <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:16, alignItems:"start" }}>

        {/* User list */}
        <div style={{ background:"#fff", border:"1px solid #e4e4e7", borderRadius:8, overflow:"hidden" }}>
          <div style={{ padding:"10px 14px", borderBottom:"1px solid #f4f4f5", fontSize:11,
            fontWeight:600, color:"#71717a", letterSpacing:"0.06em" }}>ALL USERS</div>
          {users.length === 0
            ? <div style={{ padding:24, textAlign:"center", color:"#a1a1aa", fontSize:13 }}>No users yet.</div>
            : users.map(u => (
              <div key={u.id} onClick={() => setSelected(u.id)}
                style={{ padding:"11px 14px", cursor:"pointer", borderBottom:"1px solid #f4f4f5",
                  background: selectedUser===u.id ? "#eff6ff" : "transparent",
                  transition:"background 0.1s" }}
                onMouseEnter={e => { if(selectedUser!==u.id) e.currentTarget.style.background="#fafafa"; }}
                onMouseLeave={e => { if(selectedUser!==u.id) e.currentTarget.style.background="transparent"; }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500, color:"#18181b" }}>{u.name}</div>
                    <div style={{ fontSize:11, color:"#71717a", marginTop:1 }}>{u.email}</div>
                  </div>
                  <Badge label={u.role} color={u.role==="admin"?"blue":"zinc"} />
                </div>
                {u.role==="judge" && (
                  <div style={{ marginTop:5, display:"flex", gap:4, flexWrap:"wrap" }}>
                    {(u.assignedHackathons||[]).map(hid => {
                      const h = db.hackathons.find(h=>h.id===hid);
                      return h ? <span key={hid} style={{ fontSize:10, background:"#f0fdf4",
                        border:"1px solid #bbf7d0", color:"#16a34a", padding:"1px 6px", borderRadius:4 }}>{h.name}</span> : null;
                    })}
                  </div>
                )}
              </div>
            ))
          }
        </div>

        {/* Detail panel */}
        {sel ? (
          <div>
            {/* Header */}
            <div style={{ background:"#fff", border:"1px solid #e4e4e7", borderRadius:8, padding:18, marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:16, fontWeight:600, color:"#18181b" }}>{sel.name}</span>
                    <Badge label={sel.role} color={sel.role==="admin"?"blue":"zinc"} />
                  </div>
                  <div style={{ fontSize:13, color:"#71717a" }}>{sel.email}</div>
                  {sel.judgeId && <div style={{ fontSize:12, color:"#a1a1aa", marginTop:2 }}>Linked judge: {db.judges?.find(j=>j.id===sel.judgeId)?.name||sel.judgeId}</div>}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <Btn size="sm" variant="secondary" onClick={() => openModal(sel)}>Edit</Btn>
                  <Btn size="sm" variant="danger"    onClick={() => deleteUser(sel.id)}>Delete</Btn>
                </div>
              </div>
            </div>

            {/* Hackathon assignments (judges only) */}
            {sel.role === "judge" && (
              <div style={{ background:"#fff", border:"1px solid #e4e4e7", borderRadius:8, padding:18, marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#18181b", marginBottom:14 }}>Hackathon Assignments</div>
                <p style={{ fontSize:12, color:"#71717a", marginBottom:12 }}>
                  Judges can only see and score teams in assigned hackathons.
                </p>
                {db.hackathons.length === 0
                  ? <div style={{ fontSize:12, color:"#a1a1aa", fontStyle:"italic" }}>No hackathons exist yet.</div>
                  : db.hackathons.map(h => {
                    const assigned = (sel.assignedHackathons||[]).includes(h.id);
                    return (
                      <div key={h.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                        padding:"10px 12px", borderRadius:7, marginBottom:6,
                        background: assigned ? "#f0fdf4" : "#fafafa",
                        border: `1px solid ${assigned ? "#bbf7d0" : "#e4e4e7"}` }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:500, color:"#18181b" }}>{h.name}</div>
                          <div style={{ display:"flex", gap:6, marginTop:3 }}>
                            <Badge label={h.status} color={STATUS_COLOR[h.status]||"zinc"} />
                            <span style={{ fontSize:11, color:"#71717a" }}>{h.location}</span>
                          </div>
                        </div>
                        <button onClick={() => toggleAssignment(h.id, assigned)}
                          style={{ fontSize:12, fontWeight:500, padding:"5px 12px", borderRadius:6, cursor:"pointer",
                            fontFamily:"'IBM Plex Sans',sans-serif", transition:"all 0.1s",
                            background: assigned ? "#fff" : "#18181b",
                            color:      assigned ? "#dc2626" : "#fff",
                            border:     assigned ? "1px solid #fecaca" : "none" }}>
                          {assigned ? "Remove" : "Assign"}
                        </button>
                      </div>
                    );
                  })
                }
              </div>
            )}

            {/* Extra page permissions (judges only) */}
            {sel.role === "judge" && (
              <div style={{ background:"#fff", border:"1px solid #e4e4e7", borderRadius:8, padding:18 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#18181b", marginBottom:4 }}>Additional Page Access</div>
                <p style={{ fontSize:12, color:"#71717a", marginBottom:14 }}>
                  By default judges only see <strong>Submit Feedback</strong>. Grant access to additional pages per hackathon or globally.
                </p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {db.hackathons.filter(h => (sel.assignedHackathons||[]).includes(h.id)).map(h => (
                    <div key={h.id} style={{ border:"1px solid #e4e4e7", borderRadius:8, overflow:"hidden" }}>
                      <div style={{ background:"#fafafa", borderBottom:"1px solid #f4f4f5",
                        padding:"8px 12px", fontSize:11, fontWeight:600, color:"#71717a", letterSpacing:"0.06em" }}>
                        {h.name.toUpperCase()}
                      </div>
                      {PAGES_LIST.map(p => {
                        const existing = (sel.permissions||[]).find(x => x.hackathonId===h.id && x.page===p.id);
                        return (
                          <div key={p.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                            padding:"8px 12px", borderBottom:"1px solid #f9f9f9" }}>
                            <span style={{ fontSize:12, color:"#18181b" }}>{p.label}</span>
                            <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
                              <input type="checkbox" checked={!!existing}
                                onChange={() => togglePermission(h.id, p.id, existing)}
                                style={{ accentColor:"#2563eb", cursor:"pointer" }} />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {(sel.assignedHackathons||[]).length === 0 && (
                  <div style={{ fontSize:12, color:"#a1a1aa", fontStyle:"italic" }}>Assign this judge to a hackathon first.</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background:"#fff", border:"1px solid #e4e4e7", borderRadius:8,
            padding:"44px 24px", textAlign:"center", color:"#a1a1aa", fontSize:13, fontStyle:"italic" }}>
            Select a user on the left to manage their access.
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <Modal title={modal==="new"?"Add User":"Edit User"} onClose={closeModal}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Full Name"><input style={I} value={form.name||""} onChange={f("name")} /></Field>
            <Field label="Role">
              <select style={I} value={form.role||"judge"} onChange={f("role")}>
                <option value="judge">Judge</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
          </div>
          <Field label="Email"><input style={I} type="email" value={form.email||""} onChange={f("email")} /></Field>
          <Field label={modal==="new"?"Password":"New Password (leave blank to keep current)"}>
            <input style={I} type="password" value={form.password||""} onChange={f("password")}
              placeholder={modal==="new"?"required":"leave blank to keep current"} />
          </Field>
          {form.role === "judge" && (
            <Field label="Link to Judge Record" hint="Optional — connects this login to a judge profile for feedback attribution">
              <select style={I} value={form.judgeId||""} onChange={f("judgeId")}>
                <option value="">None</option>
                {(db.judges||[]).map(j => <option key={j.id} value={j.id}>{j.name} — {j.org}</option>)}
              </select>
            </Field>
          )}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:4 }}>
            <Btn variant="secondary" onClick={closeModal}>Cancel</Btn>
            <Btn onClick={saveUser} disabled={saving}>{saving?<Spinner/>:null} Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Pages visible to each role
const ADMIN_PAGES = [
  {id:"dashboard",    label:"Dashboard"},
  {id:"hackathons",   label:"Hackathons"},
  {id:"teams",        label:"Teams"},
  {id:"judges",       label:"Judges"},
  {id:"criteria",     label:"Criteria"},
  {id:"---"},
  {id:"feedback",     label:"Submit Feedback"},
  {id:"all-feedback", label:"All Feedback"},
  {id:"reports",      label:"Reports"},
  {id:"---2"},
  {id:"users",        label:"User Management"},
];

function getJudgePages(user) {
  const base = [{id:"feedback", label:"Submit Feedback"}];
  const extra = user.permissions || [];
  const extraPages = PAGES_LIST.filter(p => extra.some(e => e.page === p.id));
  if (extraPages.length) base.push({id:"---"}, ...extraPages.map(p => ({id:p.id, label:p.label})));
  return base;
}

export default function App() {
  const [apiUrl, setApiUrl]          = useState(IS_LOCAL ? null : DEFAULT_API_URL);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const token = localStorage.getItem("hf_token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) { localStorage.removeItem("hf_token"); return null; }
      return payload;
    } catch { return null; }
  });
  const [page, setPage]              = useState("feedback");
  const [activeHackathon, setActive] = useState("");
  const [toasts, setToasts]          = useState([]);

  const toast = useCallback((msg, type="success") => {
    const id = Date.now().toString(36);
    setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3500);
  }, []);

  const handleLogin = user => {
    setCurrentUser(user);
    setPage(user.role === "admin" ? "dashboard" : "feedback");
  };

  const logout = () => {
    localStorage.removeItem("hf_token");
    setCurrentUser(null);
    setPage("feedback");
  };

  const api = makeApi(apiUrl ?? "");
  const { db, loading, error, reload } = useData(api);

  useEffect(() => {
    if (!activeHackathon && db.hackathons.length) {
      // Judge sees only their assigned hackathons
      if (currentUser?.role === "judge") {
        const first = db.hackathons.find(h => (currentUser.assignedHackathons||[]).includes(h.id));
        if (first) setActive(first.id);
      } else {
        setActive(db.hackathons[0].id);
      }
    }
  }, [db.hackathons]);

  if (apiUrl === null) return <SetupScreen onConnect={url => { setApiUrl(url); }} />;
  if (!currentUser)    return <LoginPage apiUrl={apiUrl??""} onLogin={handleLogin} toast={toast} />;

  const isAdmin   = currentUser.role === "admin";
  const navPages  = isAdmin ? ADMIN_PAGES : getJudgePages(currentUser);

  const hack  = db.hackathons.find(h => h.id === activeHackathon);
  const props = { db, api, reload, toast, activeHackathon };
  // Judges only see their assigned hackathons in the dropdown
  const visibleHackathons = isAdmin
    ? db.hackathons
    : db.hackathons.filter(h => (currentUser.assignedHackathons||[]).includes(h.id));

  return (
    <div style={{ fontFamily:"'IBM Plex Sans',-apple-system,sans-serif", display:"flex", height:"100vh", background:"#f4f4f5", color:"#18181b" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        input, textarea, select, button { font-family: 'IBM Plex Sans', sans-serif !important; }
        input:focus, textarea:focus, select:focus { border-color: #3b82f6 !important; outline: none; box-shadow: 0 0 0 2px #bfdbfe; }
        input[type=range] { accent-color: #2563eb; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { transform:translateY(6px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        @media print { aside { display: none !important; } }
      `}</style>

      {/* Sidebar */}
      <aside style={{ width:215, background:"#18181b", display:"flex", flexDirection:"column", flexShrink:0, borderRight:"1px solid #27272a" }}>
        <div style={{ padding:"15px 18px 14px", borderBottom:"1px solid #27272a" }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#fafafa", letterSpacing:"-0.01em" }}>HackFest Hub</div>
          <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:"#16a34a", flexShrink:0 }} />
            <span style={{ fontSize:11, color:"#52525b" }}>{apiUrl ? apiUrl.replace(/https?:\/\//, "") : window.location.host}</span>
          </div>
        </div>
        <div style={{ padding:"10px 12px 11px", borderBottom:"1px solid #27272a" }}>
          <div style={{ fontSize:10, fontWeight:500, color:"#52525b", letterSpacing:"0.08em", marginBottom:6, paddingLeft:4 }}>ACTIVE EVENT</div>
          <select style={{ width:"100%", background:"#27272a", border:"1px solid #3f3f46", borderRadius:5, padding:"6px 9px", fontSize:12, color:"#e4e4e7", cursor:"pointer", outline:"none" }}
            value={activeHackathon} onChange={e => setActive(e.target.value)}>
            {visibleHackathons.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          {hack && (
            <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:5, paddingLeft:2 }}>
              <div style={{ width:5, height:5, borderRadius:"50%", flexShrink:0, background:hack.status==="active"?"#16a34a":hack.status==="upcoming"?"#d97706":"#52525b" }} />
              <span style={{ fontSize:11, color:"#52525b", textTransform:"capitalize" }}>{hack.status}</span>
            </div>
          )}
        </div>
        <nav style={{ flex:1, overflowY:"auto", padding:"6px 9px" }}>
          {navPages.map((item, i) => {
            if (item.id.startsWith("---")) return <div key={i} style={{ height:1, background:"#27272a", margin:"5px 0" }} />;
            const active = page===item.id;
            return (
              <button key={item.id} onClick={()=>setPage(item.id)}
                style={{ width:"100%", textAlign:"left", background:active?"#27272a":"transparent", border:"none", borderRadius:5, padding:"7px 10px", fontSize:13, color:active?"#fafafa":"#71717a", cursor:"pointer", display:"block", marginBottom:1, fontFamily:"'IBM Plex Sans',sans-serif" }}>
                {item.label}
              </button>
            );
          })}
        </nav>
        <div style={{ padding:"10px 14px", borderTop:"1px solid #27272a" }}>
          <div style={{ fontSize:12, fontWeight:500, color:"#a1a1aa", marginBottom:2 }}>{currentUser.name}</div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <Badge label={currentUser.role} color={currentUser.role==="admin"?"blue":"zinc"} />
            <button onClick={logout} style={{ fontSize:11, color:"#52525b", background:"none", border:"none", cursor:"pointer", fontFamily:"'IBM Plex Sans',sans-serif" }}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, overflowY:"auto", padding:"26px 30px", position:"relative" }}>
        {loading && (
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"#e4e4e7", overflow:"hidden" }}>
            <div style={{ height:"100%", width:"40%", background:"#2563eb", animation:"slide 1s ease infinite", borderRadius:2 }} />
            <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}`}</style>
          </div>
        )}
        {error && (
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:6, padding:"10px 14px", marginBottom:16, fontSize:12, color:"#dc2626", display:"flex", justifyContent:"space-between" }}>
            <span>⚠ API error: {error}</span>
            <button onClick={reload} style={{ background:"none", border:"none", color:"#dc2626", cursor:"pointer", fontSize:12, fontFamily:"'IBM Plex Sans',sans-serif" }}>Retry</button>
          </div>
        )}
        {page==="dashboard"    && <DashboardPage    {...props} />}
        {page==="hackathons"   && <HackathonsPage   {...props} setActive={setActive} setPage={setPage} />}
        {page==="judges"       && <JudgesPage       {...props} />}
        {page==="teams"        && <TeamsPage        {...props} />}
        {page==="criteria"     && <CriteriaPage     {...props} />}
        {page==="feedback"     && <FeedbackPage     {...props} />}
        {page==="all-feedback" && <AllFeedbackPage  {...props} />}
        {page==="reports"      && <ReportPage       {...props} />}
        {page==="users"        && isAdmin && <UserManagementPage {...props} />}
      </main>

      {/* Toasts */}
      <div style={{ position:"fixed", bottom:20, right:20, display:"flex", flexDirection:"column", gap:6, zIndex:9999 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background:t.type==="error"?"#fef2f2":"#f0fdf4", border:`1px solid ${t.type==="error"?"#fecaca":"#bbf7d0"}`, color:t.type==="error"?"#dc2626":"#16a34a", padding:"10px 16px", borderRadius:7, fontSize:13, boxShadow:"0 4px 16px rgba(0,0,0,0.12)", animation:"fadeUp 0.2s ease" }}>
            {t.type==="error"?"⚠ ":"✓ "}{t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
