import { useState, useEffect } from "react";

const BASE = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL || "";
const FF = { fontFamily:"'Inter',system-ui,sans-serif" };
const MM = { fontFamily:"'JetBrains Mono','Fira Code',monospace" };

/* ══════════════════════════════════════════════════════════════════════════
   Shared building blocks — ALL at module scope so React keeps their identity
   between renders (defining these inside a component steals input focus).
══════════════════════════════════════════════════════════════════════════ */

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing:border-box; }
  ::selection { background:#4f46e5; color:#fff; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
`;

function Shell({ children, maxWidth = 1100 }) {
  return (
    <div style={{ minHeight:"100vh", background:"#070b18", color:"#fff", ...FF }}>
      <style>{GLOBAL_CSS}</style>
      <TopNav />
      <div style={{ maxWidth, margin:"0 auto", padding:"40px 24px 72px" }}>{children}</div>
      <PublicFooter />
    </div>
  );
}

function TopNav() {
  return (
    <nav style={{ position:"sticky", top:0, zIndex:20,
      background:"rgba(7,11,24,0.88)", backdropFilter:"blur(12px)",
      borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 24px", height:58,
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <a href="/" style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none" }}>
          <span style={{ fontSize:19 }}>⚡</span>
          <span style={{ ...FF, fontSize:15, fontWeight:800, color:"#fff", letterSpacing:"-0.02em" }}>
            HackFest Hub
          </span>
        </a>
        <div style={{ display:"flex", gap:4 }}>
          {[["Events","/"],["Winners","/winners"]].map(([l,h]) => (
            <a key={l} href={h} style={{ ...FF, fontSize:13, color:"rgba(255,255,255,0.5)",
              padding:"6px 12px", textDecoration:"none" }}>{l}</a>
          ))}
        </div>
      </div>
    </nav>
  );
}

function PublicFooter() {
  return (
    <footer style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"28px 24px",
      textAlign:"center", ...FF, fontSize:12, color:"rgba(255,255,255,0.25)" }}>
      © {new Date().getFullYear()} HackFest Hub · <a href="/"
        style={{ color:"rgba(255,255,255,0.4)" }}>Browse hackathons</a>
    </footer>
  );
}

function Loading() {
  return (
    <div style={{ textAlign:"center", padding:"90px 0", fontSize:40,
      animation:"pulse 1.4s infinite" }}>⚡</div>
  );
}

function ErrorState({ icon = "🔍", title, sub }) {
  return (
    <div style={{ textAlign:"center", padding:"80px 20px" }}>
      <div style={{ fontSize:54, marginBottom:16 }}>{icon}</div>
      <div style={{ ...FF, fontSize:19, fontWeight:700, color:"#fff", marginBottom:8 }}>{title}</div>
      {sub && <div style={{ ...FF, fontSize:14, color:"rgba(255,255,255,0.4)", lineHeight:1.7 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ eyebrow, title, sub, accent = "#6366f1" }) {
  return (
    <div style={{ marginBottom:28 }}>
      {eyebrow && <div style={{ ...MM, fontSize:10, color:accent, letterSpacing:"0.2em",
        textTransform:"uppercase", marginBottom:12 }}>{eyebrow}</div>}
      <h1 style={{ ...FF, fontSize:"clamp(26px,4vw,36px)", fontWeight:900, color:"#fff",
        letterSpacing:"-0.035em", lineHeight:1.15, marginBottom:sub?10:0 }}>{title}</h1>
      {sub && <p style={{ ...FF, fontSize:15, color:"rgba(255,255,255,0.45)",
        lineHeight:1.7, maxWidth:620 }}>{sub}</p>}
    </div>
  );
}

function Pill({ children, color = "rgba(255,255,255,0.5)", bg = "rgba(255,255,255,0.07)" }) {
  return (
    <span style={{ ...FF, fontSize:11, fontWeight:600, padding:"3px 10px",
      borderRadius:9999, background:bg, color, whiteSpace:"nowrap" }}>{children}</span>
  );
}

function LinkBtn({ href, bg, children }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener"
      style={{ ...FF, fontSize:13, fontWeight:600, padding:"8px 15px", borderRadius:9,
        background:bg, color:"#fff", textDecoration:"none", display:"inline-block" }}>
      {children}
    </a>
  );
}

const MEDAL = { 1:"🥇", 2:"🥈", 3:"🥉" };

/* ══════════════════════════════════════════════════════════════════════════
   1. PROJECT GALLERY  —  /projects/:hackathonId
══════════════════════════════════════════════════════════════════════════ */

function ProjectCard({ p, accent }) {
  const [likes, setLikes] = useState(p.likes || 0);
  const [liked, setLiked] = useState(false);

  const like = async e => {
    e.preventDefault(); e.stopPropagation();
    if (liked) return;
    const email = localStorage.getItem("hf_liker_email")
      || prompt("Your email (so each person votes once):");
    if (!email) return;
    localStorage.setItem("hf_liker_email", email);
    try {
      const r = await fetch(`${BASE}/api/projects/${p.id}/like`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ email }),
      }).then(r => r.json());
      if (typeof r.likes === "number") { setLikes(r.likes); setLiked(true); }
    } catch(_) {}
  };

  return (
    <a href={`/project/${p.id}`}
      style={{ display:"block", textDecoration:"none",
        background:"rgba(255,255,255,0.035)", border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:16, overflow:"hidden", transition:"all 0.2s", animation:"fadeUp 0.4s ease both" }}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)";
        e.currentTarget.style.borderColor=`${accent}55`; }}
      onMouseLeave={e => { e.currentTarget.style.transform="none";
        e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"; }}>
      <div style={{ height:4, background:p.placement
        ? "linear-gradient(90deg,#fbbf24,#f59e0b)"
        : `linear-gradient(90deg,${accent},${accent}55)` }}/>
      <div style={{ padding:"20px 22px 18px" }}>
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"flex-start", gap:10, marginBottom:8 }}>
          <h3 style={{ ...FF, fontSize:16, fontWeight:700, color:"#fff", lineHeight:1.3 }}>
            {p.placement ? `${MEDAL[p.placement]||"🏆"} ` : ""}{p.title || "Untitled project"}
          </h3>
          <button onClick={like} title="Like this project"
            style={{ ...FF, flexShrink:0, display:"flex", alignItems:"center", gap:4,
              background: liked ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.06)",
              border:"none", borderRadius:8, padding:"4px 9px",
              cursor: liked ? "default" : "pointer",
              color: liked ? "#f87171" : "rgba(255,255,255,0.5)", fontSize:12 }}>
            {liked ? "♥" : "♡"} {likes}
          </button>
        </div>

        {p.tagline && <p style={{ ...FF, fontSize:13, color:"rgba(255,255,255,0.45)",
          lineHeight:1.6, marginBottom:12, display:"-webkit-box", WebkitLineClamp:2,
          WebkitBoxOrient:"vertical", overflow:"hidden" }}>{p.tagline}</p>}

        <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:12 }}>
          {p.track && <Pill color={accent} bg={`${accent}22`}>{p.track}</Pill>}
          {(p.techStack||"").split(",").map(t=>t.trim()).filter(Boolean).slice(0,3)
            .map(t => <Pill key={t}>{t}</Pill>)}
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          paddingTop:12, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ ...FF, fontSize:12, color:"rgba(255,255,255,0.4)" }}>
            🚀 {p.teamName}
          </span>
          <span style={{ ...FF, fontSize:12, color:accent, fontWeight:600 }}>View →</span>
        </div>
      </div>
    </a>
  );
}

export function ProjectGalleryPage() {
  const hackathonId = window.location.pathname.split("/projects/")[1]?.split("?")[0] || "";
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");
  const [search,  setSearch]  = useState("");
  const [track,   setTrack]   = useState("");

  useEffect(() => {
    if (!hackathonId) { setErr("No hackathon specified"); setLoading(false); return; }
    fetch(`${BASE}/api/public/projects/${hackathonId}`)
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setData(d); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [hackathonId]);

  useEffect(() => {
    if (data?.hackathon?.name) document.title = `Projects — ${data.hackathon.name}`;
    return () => { document.title = "HackFest Hub"; };
  }, [data]);

  if (loading) return <Shell><Loading/></Shell>;
  if (err)     return <Shell><ErrorState title="Gallery unavailable" sub={err}/></Shell>;

  const accent   = "#6366f1";
  const projects = data?.projects || [];
  const tracks   = [...new Set(projects.map(p => p.track).filter(Boolean))];

  const shown = projects.filter(p => {
    if (track && p.track !== track) return false;
    if (!search) return true;
    const hay = `${p.title} ${p.tagline} ${p.teamName} ${p.techStack}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <Shell>
      <SectionTitle eyebrow={data?.hackathon?.name} accent={accent}
        title="Project Gallery"
        sub={`${projects.length} project${projects.length===1?"":"s"} submitted. Browse what everyone built.`} />

      {projects.length > 0 && (
        <div style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search projects, teams, or tech…"
            style={{ ...FF, flex:1, minWidth:220, padding:"10px 14px", borderRadius:10,
              background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(255,255,255,0.12)",
              color:"#fff", fontSize:14, outline:"none" }}
            onFocus={e => e.target.style.borderColor = `${accent}99`}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"} />
          {tracks.length > 0 && (
            <select value={track} onChange={e => setTrack(e.target.value)}
              style={{ ...FF, padding:"10px 14px", borderRadius:10,
                background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(255,255,255,0.12)",
                color:"#fff", fontSize:14, outline:"none", cursor:"pointer" }}>
              <option value="">All tracks</option>
              {tracks.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <ErrorState icon="📦" title={projects.length ? "No matches" : "No projects yet"}
          sub={projects.length
            ? "Try a different search or track."
            : "Projects appear here once teams submit them."} />
      ) : (
        <div style={{ display:"grid",
          gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
          {shown.map(p => <ProjectCard key={p.id} p={p} accent={accent} />)}
        </div>
      )}
    </Shell>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   2. PROJECT DETAIL  —  /project/:id
══════════════════════════════════════════════════════════════════════════ */

export function ProjectDetailPage() {
  const id = window.location.pathname.split("/project/")[1]?.split("?")[0] || "";
  const [p,       setP]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");
  const [likes,   setLikes]   = useState(0);
  const [liked,   setLiked]   = useState(false);

  useEffect(() => {
    if (!id) { setErr("No project specified"); setLoading(false); return; }
    fetch(`${BASE}/api/public/project/${id}`)
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else { setP(d); setLikes(d.likes||0); } })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!p) return;
    document.title = `${p.title} | HackFest Hub`;
    const setMeta = (n, c, prop) => {
      const attr = prop ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${n}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, n); document.head.appendChild(el); }
      el.setAttribute("content", c);
    };
    const desc = p.tagline || p.description || `${p.title} — built at ${p.hackathonName}`;
    setMeta("description", desc);
    setMeta("og:title", p.title, true);
    setMeta("og:description", desc, true);
    setMeta("og:type", "article", true);
    let c = document.querySelector('link[rel="canonical"]');
    if (!c) { c = document.createElement("link"); c.rel = "canonical"; document.head.appendChild(c); }
    c.href = `${window.location.origin}/project/${id}`;
    return () => { document.title = "HackFest Hub"; };
  }, [p, id]);

  const like = async () => {
    if (liked) return;
    const email = localStorage.getItem("hf_liker_email") || prompt("Your email (one vote per person):");
    if (!email) return;
    localStorage.setItem("hf_liker_email", email);
    try {
      const r = await fetch(`${BASE}/api/projects/${id}/like`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ email }),
      }).then(r => r.json());
      if (typeof r.likes === "number") { setLikes(r.likes); setLiked(true); }
    } catch(_) {}
  };

  if (loading) return <Shell><Loading/></Shell>;
  if (err || !p) return (
    <Shell><ErrorState icon="📦" title="Project not found"
      sub={err || "This project may have been removed, or the event isn't public yet."} /></Shell>
  );

  const accent = p.bannerColor || "#6366f1";
  const url = typeof window !== "undefined" ? window.location.href : "";

  return (
    <Shell maxWidth={840}>
      <a href={`/projects/${p.hackathonId}`}
        style={{ ...FF, fontSize:13, color:"rgba(255,255,255,0.4)",
          textDecoration:"none", display:"inline-block", marginBottom:20 }}>
        ← All projects
      </a>

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
          {p.placement && <Pill color="#fbbf24" bg="rgba(251,191,36,0.15)">
            {MEDAL[p.placement]||"🏆"} {p.awardTitle || `Place #${p.placement}`}
          </Pill>}
          {p.track && <Pill color={accent} bg={`${accent}22`}>{p.track}</Pill>}
          {p.hackathonName && <Pill>{p.hackathonName}</Pill>}
        </div>
        <h1 style={{ ...FF, fontSize:"clamp(28px,5vw,42px)", fontWeight:900, color:"#fff",
          letterSpacing:"-0.04em", lineHeight:1.12, marginBottom:10 }}>{p.title}</h1>
        {p.tagline && <p style={{ ...FF, fontSize:17, color:"rgba(255,255,255,0.5)",
          lineHeight:1.6, fontStyle:"italic" }}>{p.tagline}</p>}
      </div>

      {/* Actions */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:28,
        paddingBottom:24, borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
        <LinkBtn href={p.githubUrl} bg="#24292e">⌨ Code</LinkBtn>
        <LinkBtn href={p.demoUrl}   bg="#10b981">🌐 Live Demo</LinkBtn>
        <LinkBtn href={p.videoUrl}  bg="#4f46e5">▶ Video</LinkBtn>
        <LinkBtn href={p.deckUrl}   bg="#f59e0b">📊 Deck</LinkBtn>
        <button onClick={like}
          style={{ ...FF, display:"inline-flex", alignItems:"center", gap:6,
            fontSize:13, fontWeight:600, padding:"8px 15px", borderRadius:9,
            background: liked ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.07)",
            border:"none", cursor: liked ? "default" : "pointer",
            color: liked ? "#f87171" : "rgba(255,255,255,0.65)" }}>
          {liked ? "♥" : "♡"} {likes}
        </button>
        <button onClick={() => { navigator.clipboard?.writeText(url); }}
          style={{ ...FF, fontSize:13, fontWeight:600, padding:"8px 15px", borderRadius:9,
            background:"rgba(255,255,255,0.07)", border:"none", cursor:"pointer",
            color:"rgba(255,255,255,0.65)" }}>🔗 Share</button>
      </div>

      {/* Body */}
      {[
        ["The Problem", p.problemStatement],
        ["The Solution", p.solution],
        ["About the Project", p.description],
      ].filter(([,v]) => v).map(([label, val]) => (
        <div key={label} style={{ marginBottom:26 }}>
          <h2 style={{ ...FF, fontSize:12, fontWeight:700, color:accent,
            textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>{label}</h2>
          <p style={{ ...FF, fontSize:15, color:"rgba(255,255,255,0.7)",
            lineHeight:1.85, whiteSpace:"pre-wrap" }}>{val}</p>
        </div>
      ))}

      {p.techStack && (
        <div style={{ marginBottom:26 }}>
          <h2 style={{ ...FF, fontSize:12, fontWeight:700, color:accent,
            textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>Built With</h2>
          <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
            {p.techStack.split(",").map(t=>t.trim()).filter(Boolean).map(t => (
              <span key={t} style={{ ...FF, fontSize:13, padding:"5px 13px", borderRadius:9999,
                background:`${accent}18`, color:accent, border:`1px solid ${accent}33` }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Team */}
      <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:14, padding:"20px 24px" }}>
        <div style={{ ...FF, fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.4)",
          textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Team</div>
        <div style={{ ...FF, fontSize:17, fontWeight:700, color:"#fff", marginBottom:10 }}>
          🚀 {p.teamName}
        </div>
        {p.members && (
          <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
            {p.members.split(",").map(m=>m.trim()).filter(Boolean).map(m => (
              <span key={m} style={{ ...FF, fontSize:13, padding:"5px 13px", borderRadius:9999,
                background:"rgba(255,255,255,0.07)", color:"rgba(255,255,255,0.75)" }}>👤 {m}</span>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   3. WINNERS / HALL OF FAME  —  /winners
══════════════════════════════════════════════════════════════════════════ */

export function WinnersPage() {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Hall of Fame | HackFest Hub";
    fetch(`${BASE}/api/public/winners`)
      .then(r => r.json())
      .then(d => setEvents(d.events || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => { document.title = "HackFest Hub"; };
  }, []);

  if (loading) return <Shell><Loading/></Shell>;

  const total = events.reduce((s,e) => s + e.winners.length, 0);

  return (
    <Shell>
      <SectionTitle eyebrow="Hall of Fame" accent="#fbbf24"
        title="Winning Projects"
        sub={total
          ? `${total} winning project${total===1?"":"s"} across ${events.length} event${events.length===1?"":"s"}.`
          : "Winning projects will be showcased here after events wrap up."} />

      {events.length === 0 ? (
        <ErrorState icon="🏆" title="No winners announced yet"
          sub="Once organizers publish results, winning projects appear here." />
      ) : events.map(ev => (
        <div key={ev.hackathonId} style={{ marginBottom:44 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12,
            marginBottom:16, flexWrap:"wrap" }}>
            <h2 style={{ ...FF, fontSize:19, fontWeight:800, color:"#fff",
              letterSpacing:"-0.02em" }}>{ev.hackathonName}</h2>
            {ev.startDate && <Pill>{new Date(ev.startDate).getFullYear()}</Pill>}
            {ev.prizePool && <Pill color="#fbbf24" bg="rgba(251,191,36,0.14)">🏆 {ev.prizePool}</Pill>}
            <a href={`/projects/${ev.hackathonId}`}
              style={{ ...FF, fontSize:12, color:"rgba(255,255,255,0.4)",
                textDecoration:"none", marginLeft:"auto" }}>All projects →</a>
          </div>

          <div style={{ display:"grid",
            gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))", gap:14 }}>
            {ev.winners.map(w => (
              <a key={w.id} href={`/project/${w.id}`}
                style={{ display:"block", textDecoration:"none",
                  background:"linear-gradient(160deg,rgba(251,191,36,0.09),rgba(255,255,255,0.03))",
                  border:"1px solid rgba(251,191,36,0.22)", borderRadius:15,
                  padding:"20px 22px", transition:"all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)";
                  e.currentTarget.style.borderColor="rgba(251,191,36,0.45)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform="none";
                  e.currentTarget.style.borderColor="rgba(251,191,36,0.22)"; }}>
                <div style={{ fontSize:26, marginBottom:8 }}>{MEDAL[w.placement] || "🏆"}</div>
                {w.awardTitle && (
                  <div style={{ ...MM, fontSize:10, color:"#fbbf24", letterSpacing:"0.12em",
                    textTransform:"uppercase", marginBottom:7 }}>{w.awardTitle}</div>
                )}
                <h3 style={{ ...FF, fontSize:16, fontWeight:700, color:"#fff",
                  marginBottom:5, lineHeight:1.3 }}>{w.title}</h3>
                {w.tagline && <p style={{ ...FF, fontSize:13, color:"rgba(255,255,255,0.45)",
                  lineHeight:1.6, marginBottom:12 }}>{w.tagline}</p>}
                <div style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", paddingTop:11,
                  borderTop:"1px solid rgba(255,255,255,0.07)" }}>
                  <span style={{ ...FF, fontSize:12, color:"rgba(255,255,255,0.4)" }}>
                    🚀 {w.teamName}
                  </span>
                  {w.likes > 0 && <span style={{ ...FF, fontSize:12,
                    color:"rgba(255,255,255,0.35)" }}>♥ {w.likes}</span>}
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </Shell>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   4. PARTICIPANT PROFILE  —  /u/:id
══════════════════════════════════════════════════════════════════════════ */

export function ProfilePage() {
  const id = window.location.pathname.split("/u/")[1]?.split("?")[0] || "";
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  useEffect(() => {
    if (!id) { setErr("No profile specified"); setLoading(false); return; }
    fetch(`${BASE}/api/public/participant/${id}`)
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setData(d); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (data?.participant?.name) document.title = `${data.participant.name} | HackFest Hub`;
    return () => { document.title = "HackFest Hub"; };
  }, [data]);

  if (loading)   return <Shell><Loading/></Shell>;
  if (err||!data) return <Shell><ErrorState icon="👤" title="Profile not found" sub={err}/></Shell>;

  const p = data.participant || {};
  const history = data.history || [];
  const accent = "#6366f1";
  const initials = (p.name||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();

  const links = [
    ["GitHub",   p.githubUrl,   "⌨"],
    ["LinkedIn", p.linkedinUrl, "in"],
    ["Twitter",  p.twitterUrl,  "𝕏"],
    ["Website",  p.websiteUrl,  "🌐"],
  ].filter(([,u]) => u);

  return (
    <Shell maxWidth={760}>
      {/* Header */}
      <div style={{ display:"flex", gap:20, alignItems:"flex-start",
        marginBottom:28, flexWrap:"wrap" }}>
        <div style={{ width:76, height:76, borderRadius:20, flexShrink:0,
          background:`linear-gradient(135deg,${accent},#8b5cf6)`,
          display:"flex", alignItems:"center", justifyContent:"center",
          ...FF, fontSize:26, fontWeight:800, color:"#fff" }}>
          {p.avatarUrl
            ? <img src={p.avatarUrl} alt={p.name}
                style={{ width:"100%", height:"100%", borderRadius:20, objectFit:"cover" }}/>
            : initials}
        </div>
        <div style={{ flex:1, minWidth:220 }}>
          <h1 style={{ ...FF, fontSize:28, fontWeight:900, color:"#fff",
            letterSpacing:"-0.03em", marginBottom:6 }}>{p.name}</h1>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
            {p.location && <Pill>📍 {p.location}</Pill>}
            {p.lookingForTeam && <Pill color="#10b981" bg="rgba(16,185,129,0.15)">
              🔎 Looking for a team
            </Pill>}
            {history.length > 0 && <Pill>{history.length} event{history.length===1?"":"s"}</Pill>}
          </div>
          {p.bio && <p style={{ ...FF, fontSize:14, color:"rgba(255,255,255,0.55)",
            lineHeight:1.75 }}>{p.bio}</p>}
        </div>
      </div>

      {links.length > 0 && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:28 }}>
          {links.map(([label, url, icon]) => (
            <a key={label} href={url} target="_blank" rel="noopener"
              style={{ ...FF, fontSize:13, fontWeight:600, padding:"8px 15px",
                borderRadius:9, background:"rgba(255,255,255,0.07)",
                border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.75)",
                textDecoration:"none" }}>
              {icon} {label}
            </a>
          ))}
        </div>
      )}

      {p.skills && (
        <div style={{ marginBottom:30 }}>
          <h2 style={{ ...FF, fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.4)",
            textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10 }}>Skills</h2>
          <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
            {p.skills.split(",").map(s=>s.trim()).filter(Boolean).map(s => (
              <span key={s} style={{ ...FF, fontSize:13, padding:"5px 13px", borderRadius:9999,
                background:`${accent}18`, color:accent, border:`1px solid ${accent}33` }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      <h2 style={{ ...FF, fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.4)",
        textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:12 }}>
        Hackathon History
      </h2>
      {history.length === 0 ? (
        <p style={{ ...FF, fontSize:14, color:"rgba(255,255,255,0.3)", fontStyle:"italic" }}>
          No events yet.
        </p>
      ) : history.map((h,i) => (
        <a key={i} href={`/register/${h.id}`}
          style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
            gap:12, padding:"14px 18px", marginBottom:8, borderRadius:12,
            background:"rgba(255,255,255,0.035)", border:"1px solid rgba(255,255,255,0.08)",
            textDecoration:"none", transition:"all 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.035)"}>
          <div style={{ minWidth:0 }}>
            <div style={{ ...FF, fontSize:14, fontWeight:600, color:"#fff", marginBottom:3 }}>
              {h.name}
            </div>
            {h.teamName && <div style={{ ...FF, fontSize:12,
              color:"rgba(255,255,255,0.4)" }}>🚀 {h.teamName}</div>}
          </div>
          {h.status && <Pill>{h.status}</Pill>}
        </a>
      ))}
    </Shell>
  );
}
