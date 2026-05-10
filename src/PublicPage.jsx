import { useState, useEffect, useRef } from "react";

const BASE = typeof window !== "undefined" &&
  ["localhost","127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:3001" : "";

const PGET  = p => fetch(`${BASE}${p}`).then(r => r.json());
const PPOST = (p,b) => fetch(`${BASE}${p}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(r=>r.json());

function fmtDate(d) {
  if (!d) return "";
  const s = (typeof d === "string" && d.length <= 10) ? d + "T12:00:00" : d;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
}

/* ─── COUNTDOWN TIMER ───────────────────────────────────────────────────── */
function Countdown({ targetDate }) {
  const [time, setTime] = useState({ d:0, h:0, m:0, s:0 });
  useEffect(() => {
    const tick = () => {
      const diff = new Date(targetDate) - new Date();
      if (diff <= 0) { setTime({ d:0,h:0,m:0,s:0 }); return; }
      setTime({
        d: Math.floor(diff/864e5),
        h: Math.floor((diff%864e5)/36e5),
        m: Math.floor((diff%36e5)/6e4),
        s: Math.floor((diff%6e4)/1e3),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const Unit = ({ v, label }) => (
    <div style={{ textAlign:"center", minWidth:70 }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"clamp(32px,5vw,52px)", fontWeight:600,
        color:"#fff", lineHeight:1, letterSpacing:"-0.02em",
        background:"rgba(255,255,255,0.08)", borderRadius:12, padding:"14px 18px", border:"1px solid rgba(255,255,255,0.12)" }}>
        {String(v).padStart(2,"0")}
      </div>
      <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginTop:8, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:500 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ display:"flex", gap:12, alignItems:"flex-start", justifyContent:"center", flexWrap:"wrap" }}>
      <Unit v={time.d} label="Days" />
      <div style={{ fontSize:36, color:"rgba(255,255,255,0.3)", paddingTop:14, fontFamily:"monospace" }}>:</div>
      <Unit v={time.h} label="Hours" />
      <div style={{ fontSize:36, color:"rgba(255,255,255,0.3)", paddingTop:14, fontFamily:"monospace" }}>:</div>
      <Unit v={time.m} label="Minutes" />
      <div style={{ fontSize:36, color:"rgba(255,255,255,0.3)", paddingTop:14, fontFamily:"monospace" }}>:</div>
      <Unit v={time.s} label="Seconds" />
    </div>
  );
}

/* ─── ANIMATED BG ───────────────────────────────────────────────────────── */
function AnimatedBg({ color = "#1e3a8a" }) {
  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden", zIndex:0 }}>
      <div style={{ position:"absolute", inset:0, background:`linear-gradient(135deg, #0a0f1e 0%, ${color}cc 50%, #0a0f1e 100%)` }} />
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 70%)" }} />
      <div style={{ position:"absolute", inset:0, opacity:0.04,
        backgroundImage:`url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
      {/* Glow orbs */}
      {[
        { top:"-20%", left:"10%", w:600, h:600, c:"rgba(99,102,241,0.12)" },
        { top:"60%",  right:"-10%",w:500, h:500, c:"rgba(139,92,246,0.1)" },
        { top:"30%",  left:"50%",  w:400, h:400, c:"rgba(59,130,246,0.08)" },
      ].map((o,i) => (
        <div key={i} style={{ position:"absolute", top:o.top, left:o.left, right:o.right,
          width:o.w, height:o.h, borderRadius:"50%", background:o.c, filter:"blur(80px)", pointerEvents:"none" }} />
      ))}
    </div>
  );
}

/* ─── NAV ───────────────────────────────────────────────────────────────── */
function Nav({ name }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);
  const scroll = id => { document.getElementById(id)?.scrollIntoView({ behavior:"smooth" }); setMenuOpen(false); };
  return (
    <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100,
      background: scrolled ? "rgba(10,15,30,0.92)" : "transparent",
      backdropFilter: scrolled ? "blur(12px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
      transition:"all 0.3s", padding:"0 5%" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:68, maxWidth:1200, margin:"0 auto" }}>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:16, fontWeight:600, color:"#fff", letterSpacing:"-0.01em" }}>{name}</div>
        <div style={{ display:"flex", gap:4, alignItems:"center" }} className="nav-links">
          {[["About","about"],["Tracks","tracks"],["Judges","judges"],["Schedule","schedule"],["FAQ","faq"]].map(([l,id]) => (
            <button key={id} onClick={() => scroll(id)}
              style={{ fontFamily:"'Inter',sans-serif", background:"none", border:"none", color:"rgba(255,255,255,0.65)",
                fontSize:13, fontWeight:500, cursor:"pointer", padding:"6px 12px", borderRadius:6,
                transition:"color 0.2s" }}
              onMouseEnter={e=>e.target.style.color="#fff"}
              onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.65)"}>
              {l}
            </button>
          ))}
          <button onClick={() => scroll("register")}
            style={{ fontFamily:"'Inter',sans-serif", marginLeft:8, background:"rgba(255,255,255,0.9)",
              color:"#0a0f1e", border:"none", borderRadius:8, padding:"8px 18px", fontSize:13,
              fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}
            onMouseEnter={e=>e.target.style.background="#fff"}
            onMouseLeave={e=>e.target.style.background="rgba(255,255,255,0.9)"}>
            Register Now
          </button>
        </div>
      </div>
    </nav>
  );
}

/* ─── SECTION WRAPPER ───────────────────────────────────────────────────── */
function Section({ id, children, dark, style={} }) {
  return (
    <section id={id} style={{ padding:"80px 5%", background: dark ? "#06091a" : "#0d1224", ...style }}>
      <div style={{ maxWidth:1200, margin:"0 auto" }}>{children}</div>
    </section>
  );
}
function SectionTitle({ eyebrow, title, sub }) {
  return (
    <div style={{ textAlign:"center", marginBottom:56 }}>
      {eyebrow && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:500, color:"#818cf8",
        letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:12 }}>{eyebrow}</div>}
      <h2 style={{ fontFamily:"'Inter',sans-serif", fontSize:"clamp(28px,4vw,42px)", fontWeight:700,
        color:"#fff", letterSpacing:"-0.02em", marginBottom:14, lineHeight:1.15 }}>{title}</h2>
      {sub && <p style={{ fontFamily:"'Inter',sans-serif", fontSize:16, color:"rgba(255,255,255,0.5)", maxWidth:560, margin:"0 auto", lineHeight:1.7 }}>{sub}</p>}
    </div>
  );
}

/* ─── JUDGE CARD ────────────────────────────────────────────────────────── */
function JudgeCard({ judge }) {
  const initials = (judge.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const colors = ["#6366f1","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444"];
  const bg = colors[(judge.name||"").charCodeAt(0) % colors.length];
  return (
    <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:16, padding:"28px 20px", textAlign:"center", transition:"all 0.25s",
      backdropFilter:"blur(8px)" }}
      onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.07)"; e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.14)"; }}
      onMouseLeave={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.transform="none"; e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"; }}>
      {judge.avatarUrl
        ? <img src={judge.avatarUrl} alt={judge.name}
            style={{ width:96, height:96, borderRadius:"50%", objectFit:"cover", marginBottom:16,
              border:"3px solid rgba(255,255,255,0.12)", boxShadow:"0 8px 24px rgba(0,0,0,0.4)" }} />
        : <div style={{ width:96, height:96, borderRadius:"50%", background:bg, margin:"0 auto 16px",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"'IBM Plex Mono',monospace", fontSize:28, fontWeight:600, color:"#fff",
            boxShadow:`0 8px 24px ${bg}55`, border:"3px solid rgba(255,255,255,0.12)" }}>
            {initials}
          </div>
      }
      <div style={{ fontFamily:"'Inter',sans-serif", fontSize:16, fontWeight:600, color:"#fff", marginBottom:4 }}>{judge.name}</div>
      <div style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:"rgba(255,255,255,0.55)", marginBottom:6 }}>{judge.org}</div>
      {judge.role && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#818cf8",
        background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.2)",
        borderRadius:9999, padding:"3px 10px", display:"inline-block" }}>{judge.role}</div>}
    </div>
  );
}

/* ─── TRACK CARD ─────────────────────────────────────────────────────────── */
const TRACK_ICONS = { "AI/ML":"🤖","Sustainability":"🌱","Security":"🔐","Social Impact":"🌍","EdTech":"📚","FinTech":"💳","Health":"❤️","Open Source":"🔓","DevTools":"🛠️","APIs":"⚡","Other":"💡" };
const TRACK_COLORS = [
  ["rgba(99,102,241,0.15)","rgba(99,102,241,0.3)","#818cf8"],
  ["rgba(16,185,129,0.15)","rgba(16,185,129,0.3)","#34d399"],
  ["rgba(245,158,11,0.15)","rgba(245,158,11,0.3)","#fbbf24"],
  ["rgba(239,68,68,0.15)","rgba(239,68,68,0.3)","#f87171"],
  ["rgba(6,182,212,0.15)","rgba(6,182,212,0.3)","#22d3ee"],
  ["rgba(139,92,246,0.15)","rgba(139,92,246,0.3)","#a78bfa"],
];
function TrackCard({ name, i }) {
  const [bg, bd, tx] = TRACK_COLORS[i % TRACK_COLORS.length];
  const icon = TRACK_ICONS[name] || "💡";
  return (
    <div style={{ background:bg, border:`1px solid ${bd}`, borderRadius:14, padding:"24px 20px", textAlign:"center", transition:"transform 0.2s" }}
      onMouseEnter={e=>e.currentTarget.style.transform="translateY(-3px)"}
      onMouseLeave={e=>e.currentTarget.style.transform="none"}>
      <div style={{ fontSize:36, marginBottom:12 }}>{icon}</div>
      <div style={{ fontFamily:"'Inter',sans-serif", fontSize:15, fontWeight:600, color:tx }}>{name}</div>
    </div>
  );
}

/* ─── STAT PILL ─────────────────────────────────────────────────────────── */
function StatPill({ icon, value, label }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 24px",
      background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
      borderRadius:12, backdropFilter:"blur(8px)" }}>
      <span style={{ fontSize:24 }}>{icon}</span>
      <div>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:20, fontWeight:600, color:"#fff", lineHeight:1 }}>{value}</div>
        <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:"rgba(255,255,255,0.5)", marginTop:2 }}>{label}</div>
      </div>
    </div>
  );
}

/* ─── REGISTRATION FORM ─────────────────────────────────────────────────── */
function RegisterForm({ hackathonId }) {
  const [type, setType] = useState("team");
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const f = k => e => setForm(p => ({ ...p, [k]:e.target.value }));

  const IS = { fontFamily:"'Inter',sans-serif", background:"rgba(255,255,255,0.06)",
    border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"11px 14px",
    fontSize:14, color:"#fff", width:"100%", outline:"none",
    transition:"border-color 0.2s" };

  const submit = async e => {
    e.preventDefault();
    if (!form.name?.trim() || !form.email?.trim()) return;
    setSubmitting(true); setErr("");
    const res = await PPOST("/api/public/register", { ...form, hackathonId, type });
    if (res.error) setErr(res.error);
    else setDone(true);
    setSubmitting(false);
  };

  if (done) return (
    <div style={{ textAlign:"center", padding:"48px 0" }}>
      <div style={{ fontSize:56, marginBottom:16 }}>🎉</div>
      <h3 style={{ fontFamily:"'Inter',sans-serif", fontSize:22, fontWeight:700, color:"#fff", marginBottom:10 }}>You're Registered!</h3>
      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:15, color:"rgba(255,255,255,0.55)", lineHeight:1.7 }}>
        We've received your application. Check <strong style={{ color:"#fff" }}>{form.email}</strong> for a confirmation and next steps.
      </p>
    </div>
  );

  return (
    <>
      <div style={{ display:"flex", gap:2, marginBottom:24, background:"rgba(255,255,255,0.05)",
        borderRadius:10, padding:3, border:"1px solid rgba(255,255,255,0.08)" }}>
        {["team","judge"].map(t => (
          <button key={t} onClick={() => setType(t)}
            style={{ flex:1, padding:"9px", fontSize:13, fontWeight:600, borderRadius:8, border:"none",
              cursor:"pointer", transition:"all 0.15s", fontFamily:"'Inter',sans-serif",
              background: type===t ? "rgba(99,102,241,0.8)" : "transparent",
              color: type===t ? "#fff" : "rgba(255,255,255,0.45)",
              textTransform:"capitalize" }}>
            {type===t ? "✓ " : ""}Register as {t}
          </button>
        ))}
      </div>
      {err && <div style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)",
        borderRadius:8, padding:"10px 14px", fontSize:13, color:"#f87171", marginBottom:16 }}>⚠ {err}</div>}
      <form onSubmit={submit}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          <div>
            <label style={{ display:"block", fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.55)", marginBottom:6, letterSpacing:"0.02em" }}>Full Name *</label>
            <input style={IS} value={form.name||""} onChange={f("name")} placeholder="Your full name" required
              onFocus={e=>e.target.style.borderColor="rgba(99,102,241,0.6)"}
              onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"} />
          </div>
          <div>
            <label style={{ display:"block", fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.55)", marginBottom:6 }}>Email Address *</label>
            <input type="email" style={IS} value={form.email||""} onChange={f("email")} placeholder="you@example.com" required
              onFocus={e=>e.target.style.borderColor="rgba(99,102,241,0.6)"}
              onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"} />
          </div>
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.55)", marginBottom:6 }}>Organization / University</label>
          <input style={IS} value={form.org||""} onChange={f("org")} placeholder="Optional"
            onFocus={e=>e.target.style.borderColor="rgba(99,102,241,0.6)"}
            onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"} />
        </div>
        {type === "team" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={{ display:"block", fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.55)", marginBottom:6 }}>Team Name</label>
              <input style={IS} value={form.teamName||""} onChange={f("teamName")} placeholder="Team Awesome"
                onFocus={e=>e.target.style.borderColor="rgba(99,102,241,0.6)"}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"} />
            </div>
            <div>
              <label style={{ display:"block", fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.55)", marginBottom:6 }}>Team Size</label>
              <input type="number" min={1} max={10} style={IS} value={form.teamSize||""} onChange={f("teamSize")} placeholder="Members"
                onFocus={e=>e.target.style.borderColor="rgba(99,102,241,0.6)"}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"} />
            </div>
          </div>
        )}
        <div style={{ marginBottom:18 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.55)", marginBottom:6 }}>
            Tell us about yourself {type==="team" ? "/ your project idea" : "/ your expertise"}
          </label>
          <textarea style={{ ...IS, resize:"vertical", minHeight:90 }} value={form.message||""} onChange={f("message")}
            placeholder={type==="team" ? "What are you building? What's your background?" : "Your expertise, years of experience, areas of interest..."}
            onFocus={e=>e.target.style.borderColor="rgba(99,102,241,0.6)"}
            onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"} />
        </div>
        <button type="submit" disabled={submitting}
          style={{ width:"100%", background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            color:"#fff", border:"none", borderRadius:10, padding:"13px",
            fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"'Inter',sans-serif",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            boxShadow:"0 8px 24px rgba(99,102,241,0.4)", transition:"all 0.2s",
            opacity:submitting?0.7:1 }}>
          {submitting
            ? <><div style={{ width:16, height:16, border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} /> Submitting...</>
            : `Submit ${type==="team"?"Team":"Judge"} Application →`}
        </button>
      </form>
    </>
  );
}

/* ─── MAIN PUBLIC PAGE ──────────────────────────────────────────────────── */
export default function PublicPage({ hackathonId }) {
  const [hack,  setHack]   = useState(null);
  const [judges,setJudges] = useState([]);
  const [loading,setLoading] = useState(true);
  const [err, setErr]       = useState("");

  useEffect(() => {
    Promise.all([
      PGET(`/api/public/hackathons/${hackathonId}`),
      PGET(`/api/public/hackathons/${hackathonId}/judges`),
    ]).then(([h, j]) => {
      if (h.error) { setErr(h.error); }
      else { setHack(h); setJudges(Array.isArray(j) ? j : []); }
      setLoading(false);
    }).catch(() => { setErr("Failed to load event details."); setLoading(false); });
  }, [hackathonId]);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0a0f1e", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:40, height:40, border:"3px solid rgba(255,255,255,0.1)", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
    </div>
  );

  if (err) return (
    <div style={{ minHeight:"100vh", background:"#0a0f1e", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#fff", fontFamily:"'Inter',sans-serif" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
      <div style={{ fontSize:18, fontWeight:600, marginBottom:8 }}>Page Not Available</div>
      <div style={{ fontSize:14, color:"rgba(255,255,255,0.45)" }}>{err}</div>
    </div>
  );

  const bannerColor = hack.bannerColor || "#1e3a8a";
  const tracks = (hack.tracks || "").split(",").map(t => t.trim()).filter(Boolean);

  // Parse schedule & FAQ from stored text
  const scheduleItems = (hack.schedule || "").split("\n").filter(Boolean).map(l => {
    const [time, ...rest] = l.split("|");
    return { time: time?.trim(), event: rest.join("|").trim() };
  });
  const faqItems = (hack.faq || "").split("\n\n").filter(Boolean).map(block => {
    const [q, ...a] = block.split("\n");
    return { q: q?.replace(/^Q:\s*/i,""), a: a.join("\n").replace(/^A:\s*/i,"") };
  });

  return (
    <div style={{ fontFamily:"'Inter',sans-serif", background:"#0a0f1e", color:"#fff", overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-track{background:#0a0f1e;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
        input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.25);}
        input:focus,textarea:focus{outline:none;}
      `}</style>

      <Nav name={hack.name} />

      {/* ── HERO ── */}
      <section style={{ position:"relative", minHeight:"100vh", display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", textAlign:"center", padding:"100px 5% 60px",
        overflow:"hidden" }}>
        <AnimatedBg color={bannerColor} />
        <div style={{ position:"relative", zIndex:1, maxWidth:900, animation:"fadeUp 0.8s ease both" }}>
          {/* Status badge */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(99,102,241,0.15)",
            border:"1px solid rgba(99,102,241,0.3)", borderRadius:9999, padding:"6px 16px",
            fontSize:12, fontWeight:600, color:"#a5b4fc", letterSpacing:"0.08em",
            textTransform:"uppercase", marginBottom:28 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#6366f1", animation:"pulse 2s infinite", display:"inline-block" }} />
            {hack.status === "active" ? "Registration Open" : hack.status === "upcoming" ? "Coming Soon" : "Event Concluded"}
          </div>

          <h1 style={{ fontSize:"clamp(38px,7vw,80px)", fontWeight:800, lineHeight:1.05,
            letterSpacing:"-0.03em", marginBottom:20,
            background:"linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.75) 100%)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            {hack.name}
          </h1>

          {hack.tagline && <p style={{ fontSize:"clamp(16px,2.5vw,22px)", color:"rgba(255,255,255,0.6)",
            marginBottom:36, lineHeight:1.6, maxWidth:640, margin:"0 auto 36px" }}>
            {hack.tagline}
          </p>}

          {/* Date + Location badges */}
          <div style={{ display:"flex", justifyContent:"center", gap:12, flexWrap:"wrap", marginBottom:48 }}>
            {hack.startDate && <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"8px 18px",
              background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)",
              borderRadius:9999, fontSize:14, color:"rgba(255,255,255,0.8)" }}>
              📅 {fmtDate(hack.startDate)}{hack.endDate ? ` – ${fmtDate(hack.endDate)}` : ""}
            </div>}
            {hack.location && <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"8px 18px",
              background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)",
              borderRadius:9999, fontSize:14, color:"rgba(255,255,255,0.8)" }}>
              📍 {hack.location}
            </div>}
            {hack.prizePool && <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"8px 18px",
              background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)",
              borderRadius:9999, fontSize:14, color:"#a5b4fc", fontWeight:600 }}>
              🏆 {hack.prizePool}
            </div>}
          </div>

          {/* Countdown */}
          {hack.startDate && new Date(hack.startDate) > new Date() && (
            <div style={{ marginBottom:48 }}>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", letterSpacing:"0.15em",
                textTransform:"uppercase", marginBottom:20, fontFamily:"'IBM Plex Mono',monospace" }}>
                Event starts in
              </div>
              <Countdown targetDate={hack.startDate} />
            </div>
          )}

          {/* CTA buttons */}
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
            <button onClick={() => document.getElementById("register")?.scrollIntoView({ behavior:"smooth" })}
              style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", border:"none",
                borderRadius:12, padding:"14px 32px", fontSize:15, fontWeight:700, cursor:"pointer",
                boxShadow:"0 8px 32px rgba(99,102,241,0.4)", transition:"all 0.2s", fontFamily:"'Inter',sans-serif" }}
              onMouseEnter={e=>{ e.target.style.transform="translateY(-2px)"; e.target.style.boxShadow="0 12px 40px rgba(99,102,241,0.5)"; }}
              onMouseLeave={e=>{ e.target.style.transform="none"; e.target.style.boxShadow="0 8px 32px rgba(99,102,241,0.4)"; }}>
              Register Now →
            </button>
            <button onClick={() => document.getElementById("about")?.scrollIntoView({ behavior:"smooth" })}
              style={{ background:"rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.8)", border:"1px solid rgba(255,255,255,0.15)",
                borderRadius:12, padding:"14px 28px", fontSize:15, fontWeight:600, cursor:"pointer",
                transition:"all 0.2s", fontFamily:"'Inter',sans-serif" }}
              onMouseEnter={e=>{ e.target.style.background="rgba(255,255,255,0.12)"; }}
              onMouseLeave={e=>{ e.target.style.background="rgba(255,255,255,0.08)"; }}>
              Learn More
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position:"absolute", bottom:32, left:"50%", transform:"translateX(-50%)",
          display:"flex", flexDirection:"column", alignItems:"center", gap:6, animation:"fadeUp 1.2s ease both" }}>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Scroll</div>
          <div style={{ width:1, height:40, background:"linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)" }} />
        </div>
      </section>

      {/* ── STATS BAR ── */}
      {(hack.prizePool || tracks.length || hack.maxTeams) && (
        <div style={{ background:"rgba(99,102,241,0.08)", borderTop:"1px solid rgba(99,102,241,0.15)", borderBottom:"1px solid rgba(99,102,241,0.15)", padding:"20px 5%" }}>
          <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", justifyContent:"center", gap:16, flexWrap:"wrap" }}>
            {hack.prizePool && <StatPill icon="🏆" value={hack.prizePool} label="Total Prize Pool" />}
            {tracks.length > 0 && <StatPill icon="🎯" value={tracks.length} label={`Track${tracks.length!==1?"s":""}`} />}
            {hack.maxTeams && <StatPill icon="👥" value={hack.maxTeams} label="Max Teams" />}
            {judges.length > 0 && <StatPill icon="⭐" value={judges.length} label={`Expert Judge${judges.length!==1?"s":""}`} />}
          </div>
        </div>
      )}

      {/* ── ABOUT ── */}
      {hack.description && (
        <Section id="about" dark>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:60, alignItems:"center" }}>
            <div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:500, color:"#818cf8",
                letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:16 }}>About the Event</div>
              <h2 style={{ fontSize:"clamp(26px,3.5vw,40px)", fontWeight:700, color:"#fff",
                letterSpacing:"-0.02em", marginBottom:20, lineHeight:1.2 }}>
                {hack.name}
              </h2>
              <p style={{ fontSize:16, color:"rgba(255,255,255,0.6)", lineHeight:1.8, marginBottom:24 }}>{hack.description}</p>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {[["📅","Date", `${fmtDate(hack.startDate)}${hack.endDate?` – ${fmtDate(hack.endDate)}`:""}`],
                  ["📍","Location", hack.location],
                  ["🏆","Prize Pool", hack.prizePool]].filter(([,,v])=>v).map(([icon,label,value])=>(
                  <div key={label} style={{ display:"flex", gap:12, alignItems:"center" }}>
                    <span style={{ fontSize:18 }}>{icon}</span>
                    <span style={{ fontSize:13, color:"rgba(255,255,255,0.4)", minWidth:70 }}>{label}</span>
                    <span style={{ fontSize:14, color:"rgba(255,255,255,0.8)", fontWeight:500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {[["🚀","Innovation","Push the boundaries of what's possible"],
                ["🤝","Collaboration","Work with brilliant minds from around the world"],
                ["🎓","Learning","Gain skills and mentorship from industry experts"],
                ["🌍","Impact","Build solutions that matter to real people"]].map(([icon,t,d])=>(
                <div key={t} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)",
                  borderRadius:14, padding:20 }}>
                  <div style={{ fontSize:28, marginBottom:10 }}>{icon}</div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#fff", marginBottom:6 }}>{t}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", lineHeight:1.6 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ── TRACKS ── */}
      {tracks.length > 0 && (
        <Section id="tracks">
          <SectionTitle eyebrow="Challenge Areas" title="Hackathon Tracks"
            sub="Choose your domain and build something extraordinary." />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:14 }}>
            {tracks.map((t,i) => <TrackCard key={t} name={t} i={i} />)}
          </div>
        </Section>
      )}

      {/* ── JUDGES ── */}
      {judges.length > 0 && (
        <Section id="judges" dark>
          <SectionTitle eyebrow="Meet the Panel" title="Our Expert Judges"
            sub="Industry leaders who will evaluate your projects and provide mentorship." />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:16 }}>
            {judges.map(j => <JudgeCard key={j.id} judge={j} />)}
          </div>
        </Section>
      )}

      {/* ── SCHEDULE ── */}
      {scheduleItems.length > 0 && (
        <Section id="schedule">
          <SectionTitle eyebrow="Timeline" title="Event Schedule" />
          <div style={{ maxWidth:640, margin:"0 auto" }}>
            {scheduleItems.map((item, i) => (
              <div key={i} style={{ display:"flex", gap:20, marginBottom:24 }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(99,102,241,0.2)",
                    border:"2px solid rgba(99,102,241,0.4)", display:"flex", alignItems:"center", justifyContent:"center",
                    fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#818cf8", flexShrink:0 }}>
                    {i+1}
                  </div>
                  {i < scheduleItems.length - 1 && <div style={{ width:1, flex:1, minHeight:24, background:"rgba(99,102,241,0.2)", margin:"4px 0" }} />}
                </div>
                <div style={{ paddingTop:6, paddingBottom:24 }}>
                  {item.time && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#818cf8", marginBottom:4 }}>{item.time}</div>}
                  <div style={{ fontSize:15, fontWeight:600, color:"#fff" }}>{item.event}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── FAQ ── */}
      {faqItems.length > 0 && (
        <Section id="faq" dark>
          <SectionTitle eyebrow="Questions?" title="Frequently Asked Questions" />
          <div style={{ maxWidth:760, margin:"0 auto", display:"flex", flexDirection:"column", gap:8 }}>
            {faqItems.map((item, i) => <FaqItem key={i} q={item.q} a={item.a} />)}
          </div>
        </Section>
      )}

      {/* ── REGISTER ── */}
      <section id="register" style={{ padding:"80px 5%", background:"rgba(99,102,241,0.06)",
        borderTop:"1px solid rgba(99,102,241,0.15)" }}>
        <div style={{ maxWidth:640, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:40 }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:500, color:"#818cf8",
              letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:12 }}>Join Us</div>
            <h2 style={{ fontSize:"clamp(28px,4vw,44px)", fontWeight:700, color:"#fff", letterSpacing:"-0.02em", marginBottom:14 }}>
              Ready to Build?
            </h2>
            <p style={{ fontSize:16, color:"rgba(255,255,255,0.5)", lineHeight:1.7 }}>
              Secure your spot. Applications are reviewed on a rolling basis.
            </p>
          </div>
          <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:20, padding:32, backdropFilter:"blur(12px)" }}>
            <RegisterForm hackathonId={hackathonId} />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background:"#06091a", borderTop:"1px solid rgba(255,255,255,0.06)", padding:"32px 5%",
        display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, fontWeight:600, color:"rgba(255,255,255,0.6)" }}>{hack.name}</div>
        <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:"rgba(255,255,255,0.25)" }}>
          Powered by HackFest Hub
        </div>
      </footer>
    </div>
  );
}

/* ─── FAQ ACCORDION ─────────────────────────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:12, overflow:"hidden", transition:"border-color 0.2s",
      borderColor: open ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.08)" }}>
      <button onClick={() => setOpen(!open)}
        style={{ width:"100%", textAlign:"left", background:"none", border:"none", cursor:"pointer",
          padding:"18px 20px", display:"flex", justifyContent:"space-between", alignItems:"center",
          fontFamily:"'Inter',sans-serif" }}>
        <span style={{ fontSize:15, fontWeight:600, color:"#fff" }}>{q}</span>
        <span style={{ fontSize:20, color:"rgba(255,255,255,0.4)", transition:"transform 0.2s",
          transform: open ? "rotate(45deg)" : "none", flexShrink:0, marginLeft:12 }}>+</span>
      </button>
      {open && <div style={{ padding:"0 20px 18px", fontSize:14, color:"rgba(255,255,255,0.55)", lineHeight:1.7 }}>{a}</div>}
    </div>
  );
}
