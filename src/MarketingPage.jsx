import { useState, useEffect } from "react";

const BASE = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL || "";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  ink:"#0E1116", inkSoft:"#1B212B", paper:"#F5F6F3", card:"#FFFFFF",
  cobalt:"#2F6BFF", cobaltDark:"#1E4FD6", coral:"#FF6A45",
  line:"#E4E6E0", lineSoft:"#EEF0EC", muted:"#5C6470", faint:"#8A929E",
};
const DISPLAY = { fontFamily:"'Bricolage Grotesque','Inter',system-ui,sans-serif" };
const FF = { fontFamily:"'Inter',system-ui,sans-serif" };
const MM = { fontFamily:"'JetBrains Mono',ui-monospace,monospace" };

// ── Line icons (consistent stroke — replaces emoji for a professional feel) ────
function Icon({ name, size=22, color=C.cobalt, w=1.6 }) {
  const p = { fill:"none", stroke:color, strokeWidth:w, strokeLinecap:"round", strokeLinejoin:"round" };
  const shapes = {
    launch:  <path d="M13 2 L4 14 h6 l-1 8 l9-12 h-6 z" {...p}/>,
    judge:   <g {...p}><path d="M12 3v18M6 21h12M5 8h14"/><path d="M5 8l-2.5 6a3 3 0 0 0 5 0L5 8zM19 8l-2.5 6a3 3 0 0 0 5 0L19 8z"/></g>,
    ai:      <g {...p}><path d="M12 3l1.8 4.7L18 9l-4.2 1.3L12 15l-1.8-4.7L6 9l4.2-1.3z"/><path d="M18.5 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></g>,
    award:   <g {...p}><circle cx="12" cy="9" r="5"/><path d="M9 13.5 7.5 21 12 18.2 16.5 21 15 13.5"/></g>,
    live:    <path d="M3 12h4l3 8 4-16 3 8h4" {...p}/>,
    people:  <g {...p}><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5.5M21 20a6 6 0 0 0-4-5.7"/></g>,
    arrow:   <path d="M5 12h14M13 6l6 6-6 6" {...p}/>,
    check:   <path d="M4 12l5 5L20 6" {...p}/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{shapes[name]}</svg>;
}

// ── Hackathon card (no member/participant counts) ─────────────────────────────
function HackCard({ hack }) {
  const STATUS = {
    active:   { label:"Open now",   dot:C.coral,  fg:C.coral },
    upcoming: { label:"Upcoming",   dot:"#C79A2E", fg:"#9A7716" },
    completed:{ label:"Completed",  dot:C.faint,  fg:C.muted },
  };
  const st = STATUS[hack.liveStatus || hack.status] || STATUS.upcoming;
  const fmt = d => {
    if (!d) return null;
    const m = typeof d === "string" && d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const dt = m ? new Date(+m[1], +m[2]-1, +m[3]) : new Date(d);
    return isNaN(dt.getTime()) ? null : dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  };
  const tracks = (hack.tracks||"").split(",").map(t=>t.trim()).filter(Boolean).slice(0,2);
  return (
    <a href={`/register/${hack.id}`} className="hf-hackcard"
      style={{ textDecoration:"none", display:"flex", flexDirection:"column",
        background:C.card, borderRadius:14, border:`1px solid ${C.line}`,
        padding:"20px 20px 18px", transition:"transform .18s ease, box-shadow .18s ease, border-color .18s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ ...MM, fontSize:11, fontWeight:600, color:st.fg, display:"inline-flex", alignItems:"center", gap:6,
          textTransform:"uppercase", letterSpacing:"0.06em" }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:st.dot, display:"inline-block" }}/>{st.label}
        </span>
        {hack.prizePool && <span style={{ ...MM, fontSize:11, color:C.muted }}>{hack.prizePool}</span>}
      </div>
      <h3 style={{ ...DISPLAY, fontSize:18, fontWeight:700, color:C.ink, marginBottom:7, lineHeight:1.25, letterSpacing:"-0.01em" }}>{hack.name}</h3>
      <p style={{ ...FF, fontSize:13, color:C.muted, lineHeight:1.6, marginBottom:16, flex:1,
        display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
        {hack.tagline || hack.description || "An event running on HackFest Hub."}
      </p>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10,
        borderTop:`1px solid ${C.lineSoft}`, paddingTop:14 }}>
        <div style={{ ...FF, fontSize:12, color:C.faint, display:"flex", gap:14, flexWrap:"wrap" }}>
          {fmt(hack.startDate) && <span>{fmt(hack.startDate)}</span>}
          {hack.location && <span>{hack.location}</span>}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {tracks.map(t => (
            <span key={t} style={{ ...FF, fontSize:10.5, fontWeight:500, padding:"3px 8px", borderRadius:6,
              background:C.paper, color:C.muted, border:`1px solid ${C.line}` }}>{t}</span>
          ))}
        </div>
      </div>
    </a>
  );
}

// ── Signature: a live event, rendered as a clean product frame ────────────────
function ProductFrame() {
  const bars = [
    { label:"Track A · Web",     pct:82 },
    { label:"Track B · AI/ML",   pct:64 },
    { label:"Track C · Hardware",pct:45 },
  ];
  const board = [
    { rank:1, team:"Team Nova",   score:94 },
    { rank:2, team:"Bit by Bit",  score:91 },
    { rank:3, team:"Quantum Leap",score:88 },
  ];
  return (
    <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.line}`,
      boxShadow:"0 24px 60px -28px rgba(14,17,22,0.35), 0 8px 24px -16px rgba(14,17,22,0.2)",
      overflow:"hidden" }}>
      {/* window bar */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 16px", borderBottom:`1px solid ${C.lineSoft}` }}>
        <span style={{ display:"flex", gap:6 }}>
          {["#FF6A5F","#FDBC40","#34C749"].map(c=><span key={c} style={{ width:10, height:10, borderRadius:"50%", background:c }}/>)}
        </span>
        <span style={{ ...MM, fontSize:11, color:C.faint, marginLeft:6 }}>hackfesthub.com/innovate-2026</span>
      </div>
      <div style={{ padding:"20px 20px 22px" }}>
        {/* event header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
          <div>
            <div style={{ ...DISPLAY, fontSize:17, fontWeight:700, color:C.ink, letterSpacing:"-0.01em" }}>Innovate 2026</div>
            <div style={{ ...MM, fontSize:11, color:C.faint, marginTop:2 }}>48-hour build · Judging in progress</div>
          </div>
          <span style={{ ...MM, fontSize:11, fontWeight:600, color:C.coral, display:"inline-flex", alignItems:"center", gap:6,
            background:"rgba(255,106,69,0.1)", border:"1px solid rgba(255,106,69,0.25)", padding:"5px 10px", borderRadius:20 }}>
            <span className="hf-pulse" style={{ width:6, height:6, borderRadius:"50%", background:C.coral, display:"inline-block" }}/>Live
          </span>
        </div>
        {/* judging progress */}
        <div style={{ ...MM, fontSize:10.5, color:C.faint, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Judging progress</div>
        <div style={{ display:"flex", flexDirection:"column", gap:11, marginBottom:20 }}>
          {bars.map(b=>(
            <div key={b.label}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ ...FF, fontSize:12, color:C.inkSoft }}>{b.label}</span>
                <span style={{ ...MM, fontSize:11, color:C.muted }}>{b.pct}%</span>
              </div>
              <div style={{ height:6, borderRadius:4, background:C.lineSoft, overflow:"hidden" }}>
                <div className="hf-bar" style={{ height:"100%", width:`${b.pct}%`, borderRadius:4,
                  background:`linear-gradient(90deg,${C.cobalt},${C.cobaltDark})` }}/>
              </div>
            </div>
          ))}
        </div>
        {/* leaderboard */}
        <div style={{ ...MM, fontSize:10.5, color:C.faint, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Leaderboard</div>
        <div style={{ display:"flex", flexDirection:"column", gap:2, marginBottom:18 }}>
          {board.map(r=>(
            <div key={r.rank} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 10px", borderRadius:9,
              background: r.rank===1 ? "rgba(47,107,255,0.06)" : "transparent" }}>
              <span style={{ ...MM, fontSize:11, fontWeight:700, width:20, height:20, borderRadius:"50%",
                display:"inline-flex", alignItems:"center", justifyContent:"center",
                background: r.rank===1?C.cobalt:C.paper, color:r.rank===1?"#fff":C.muted,
                border:`1px solid ${r.rank===1?C.cobalt:C.line}` }}>{r.rank}</span>
              <span style={{ ...FF, fontSize:13, fontWeight:600, color:C.ink, flex:1 }}>{r.team}</span>
              <span style={{ ...MM, fontSize:12, fontWeight:600, color:C.inkSoft }}>{r.score}</span>
            </div>
          ))}
        </div>
        {/* closeout chips */}
        <div style={{ display:"flex", gap:8, borderTop:`1px solid ${C.lineSoft}`, paddingTop:16 }}>
          {["Certificates ready","Winners drafted"].map(t=>(
            <span key={t} style={{ ...FF, fontSize:11.5, fontWeight:500, color:C.inkSoft, display:"inline-flex", alignItems:"center", gap:6,
              background:C.paper, border:`1px solid ${C.line}`, padding:"6px 11px", borderRadius:8 }}>
              <Icon name="check" size={13} color={C.cobalt} w={2}/>{t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MarketingPage() {
  const [hackathons, setHackathons] = useState([]);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("");
  const [category,setCategory]= useState("");
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    document.title = "HackFest Hub — Run hackathons without the chaos";
    let canon = document.querySelector('link[rel="canonical"]');
    if (!canon) { canon = document.createElement("link"); canon.rel = "canonical"; document.head.appendChild(canon); }
    canon.href = window.location.origin + "/";
    const setMeta = (name, content, prop=false) => {
      const sel = prop ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let el = document.querySelector(sel);
      if(!el){ el=document.createElement("meta"); el.setAttribute(prop?"property":"name",name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    const desc = "The all-in-one platform for college and company hackathons — registration, judging, AI insights, and certificates in one place. Free for student communities.";
    setMeta("description", desc);
    setMeta("og:title","HackFest Hub — Run your college or company hackathon", true);
    setMeta("og:description", desc, true);
    return () => { document.title = "HackFest Hub"; };
  }, []);

  const load = (s=search, f=filter, c=category) => {
    setLoading(true);
    fetch(`${BASE}/api/public/hackathons?search=${encodeURIComponent(s)}&status=${f}&category=${encodeURIComponent(c)}&limit=12`)
      .then(r=>r.json())
      .then(d=>setHackathons(d.hackathons||[]))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  };
  useEffect(()=>{ load(); }, []);

  const FEATURES = [
    { phase:"Set up",       icon:"launch", title:"Launch in minutes", desc:"A branded event page, registration form, and tracks — built from one dashboard, no code." },
    { phase:"Registration", icon:"people", title:"Registration & teams", desc:"Sign-ups, team formation, Q&A, and Discord/Slack/WhatsApp links, all handled on your event page." },
    { phase:"Live day",     icon:"live",   title:"Run the live day", desc:"Real-time leaderboard, check-in, judge progress, and announcements — everything on one screen." },
    { phase:"Judging",      icon:"judge",  title:"Judging that holds up", desc:"Weighted criteria, judge assignments, and conflict handling keep scoring consistent and defensible." },
    { phase:"Insights",     icon:"ai",     title:"AI does the busywork", desc:"Score calibration, team summaries, and a full event report — drafted for you, reviewed by you." },
    { phase:"Wrap-up",      icon:"award",  title:"Close out in one click", desc:"Verified certificates, winner announcements, and a full data export the moment judging ends." },
  ];
  const STEPS = [
    { n:"01", title:"Create the event", desc:"Dates, prizes, tracks, judges, and a public registration page — set up in one sitting." },
    { n:"02", title:"Open registration", desc:"Share one link. Sign-ups, team formation, and Q&A run themselves from your event page." },
    { n:"03", title:"Judge and score", desc:"Judges score from any device on weighted criteria. AI calibration keeps the panel aligned." },
    { n:"04", title:"Celebrate and close", desc:"Publish the leaderboard, email winners, issue certificates, and export everything." },
  ];
  const USE_CASES = ["University chapters","IEEE branches","Company hackathons","Online events","Student clubs","Developer communities"];
  const CATEGORIES = ["AI & ML","Web & Mobile","Social Good","Fintech","Health","Hardware & IoT","Student","Open Innovation"];

  const btnPrimary = { ...FF, display:"inline-flex", alignItems:"center", gap:8, padding:"14px 24px",
    borderRadius:11, background:C.ink, color:"#fff", fontSize:15, fontWeight:600, textDecoration:"none",
    border:`1px solid ${C.ink}` };
  const btnGhost = { ...FF, display:"inline-flex", alignItems:"center", gap:8, padding:"14px 24px",
    borderRadius:11, background:"transparent", color:C.ink, fontSize:15, fontWeight:600, textDecoration:"none",
    border:`1px solid ${C.line}` };
  const eyebrow = { ...MM, fontSize:12, fontWeight:600, color:C.cobalt, letterSpacing:"0.12em", textTransform:"uppercase" };

  return (
    <div style={{ ...FF, background:C.paper, color:C.ink, minHeight:"100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        a { color:inherit; }
        ::selection { background:${C.cobalt}; color:#fff; }
        a:focus-visible, button:focus-visible, input:focus-visible { outline:2px solid ${C.cobalt}; outline-offset:2px; border-radius:4px; }
        @keyframes hf-rise { from{opacity:0; transform:translateY(16px)} to{opacity:1; transform:none} }
        @keyframes hf-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes hf-grow { from{transform:scaleX(0); transform-origin:left} to{transform:scaleX(1); transform-origin:left} }
        .hf-rise { animation:hf-rise .6s cubic-bezier(.2,.7,.2,1) both; }
        .hf-pulse { animation:hf-pulse 1.8s ease-in-out infinite; }
        .hf-bar { animation:hf-grow 1s cubic-bezier(.2,.7,.2,1) both; }
        .hf-hackcard:hover { transform:translateY(-3px); box-shadow:0 16px 34px -20px rgba(14,17,22,.35); border-color:${C.cobalt}; }
        .hf-feat:hover { border-color:${C.cobalt}; box-shadow:0 12px 30px -22px rgba(47,107,255,.5); }
        .hf-cta { transition:background .15s, transform .15s; }
        .hf-cta:hover { background:#242C38; transform:translateY(-1px); }
        .hf-cta-coral { transition:background .15s, transform .15s; }
        .hf-cta-coral:hover { background:#E9512E; transform:translateY(-1px); }
        .hf-nav-cta:hover { background:#242C38; }
        .hf-link:hover { color:${C.ink}; }
        .hf-hero { display:grid; grid-template-columns:1.05fr .95fr; gap:56px; align-items:center; }
        .hf-nav-links { display:flex; align-items:center; gap:4px; }
        @media (max-width:900px){ .hf-hero { grid-template-columns:1fr; gap:40px; } .hf-hero-frame { order:-1; } }
        @media (max-width:680px){ .hf-nav-links a.hf-link { display:none; } }
        @media (prefers-reduced-motion: reduce){ *{ animation:none !important; transition:none !important; } }
      `}</style>

      {/* NAV */}
      <nav style={{ position:"sticky", top:0, zIndex:100, background:"rgba(245,246,243,0.85)",
        backdropFilter:"blur(12px)", borderBottom:`1px solid ${C.line}` }}>
        <div style={{ maxWidth:1160, margin:"0 auto", padding:"0 24px", height:62,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <a href="/" style={{ display:"flex", alignItems:"center", gap:9, textDecoration:"none" }}>
            <span style={{ width:26, height:26, borderRadius:7, background:C.ink, display:"inline-flex",
              alignItems:"center", justifyContent:"center" }}><Icon name="launch" size={15} color={C.coral} w={2}/></span>
            <span style={{ ...DISPLAY, fontSize:17, fontWeight:700, color:C.ink, letterSpacing:"-0.02em" }}>HackFest Hub</span>
          </a>
          <div className="hf-nav-links">
            <a className="hf-link" href="#features"   style={{ ...FF, fontSize:14, color:C.muted, padding:"8px 12px", textDecoration:"none" }}>Features</a>
            <a className="hf-link" href="#how"        style={{ ...FF, fontSize:14, color:C.muted, padding:"8px 12px", textDecoration:"none" }}>How it works</a>
            <a className="hf-link" href="#events"     style={{ ...FF, fontSize:14, color:C.muted, padding:"8px 12px", textDecoration:"none" }}>Events</a>
            <a className="hf-link" href="/community"   style={{ ...FF, fontSize:14, color:C.muted, padding:"8px 12px", textDecoration:"none" }}>Community</a>
            <a className="hf-link" href="#pricing"    style={{ ...FF, fontSize:14, color:C.muted, padding:"8px 12px", textDecoration:"none" }}>Pricing</a>
            <a href="/admin" style={{ ...FF, fontSize:14, fontWeight:500, color:C.ink, padding:"8px 14px", textDecoration:"none" }}>Sign in</a>
            <a className="hf-nav-cta" href="/signup" style={{ ...FF, fontSize:14, fontWeight:600, color:"#fff", background:C.ink,
              padding:"9px 16px", borderRadius:9, textDecoration:"none", transition:"background .15s" }}>Start free</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding:"96px 24px 104px" }}>
        <div className="hf-hero" style={{ maxWidth:1160, margin:"0 auto" }}>
          <div className="hf-rise">
            <div style={{ ...eyebrow, marginBottom:20 }}>For college &amp; company hackathons</div>
            <h1 style={{ ...DISPLAY, fontSize:"clamp(38px,5.4vw,62px)", fontWeight:700, color:C.ink,
              letterSpacing:"-0.035em", lineHeight:1.04, marginBottom:20 }}>
              Run your hackathon<br/>without the chaos.
            </h1>
            <p style={{ ...FF, fontSize:"clamp(16px,1.6vw,19px)", color:C.muted, lineHeight:1.65, maxWidth:500, marginBottom:32 }}>
              The all-in-one platform for university chapters, student clubs, and company teams —
              registration, judging, and certificates in one place.
            </p>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
              <a href="/signup" className="hf-cta" style={btnPrimary}>Start free <Icon name="arrow" size={17} color="#fff"/></a>
              <a href="/admin?demo=1" style={btnGhost}>Explore a live demo</a>
            </div>
            <div style={{ ...FF, fontSize:13, color:C.faint, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <Icon name="check" size={15} color={C.coral} w={2}/>
              Free for colleges &amp; student communities · No credit card
            </div>
          </div>
          <div className="hf-hero-frame hf-rise" style={{ animationDelay:".08s" }}>
            <ProductFrame/>
          </div>
        </div>
      </section>

      {/* MADE FOR ORGANIZERS — audience callout */}
      <section style={{ padding:"64px 24px", borderTop:`1px solid ${C.line}`, borderBottom:`1px solid ${C.line}`, background:C.card }}>
        <div style={{ maxWidth:1160, margin:"0 auto", textAlign:"center" }}>
          <div style={{ ...eyebrow, marginBottom:16 }}>Made for the people who run events</div>
          <h2 style={{ ...DISPLAY, fontSize:"clamp(26px,3.2vw,38px)", fontWeight:700, color:C.ink,
            letterSpacing:"-0.03em", lineHeight:1.12, marginBottom:16, maxWidth:720, marginLeft:"auto", marginRight:"auto" }}>
            You shouldn't need a dev team to run a great hackathon.
          </h2>
          <p style={{ ...FF, fontSize:17, color:C.muted, lineHeight:1.6, maxWidth:600, margin:"0 auto 28px" }}>
            HackFest Hub is built for the club lead, the faculty advisor, and the engineering manager
            running it on the side — not for a full-time events team.
          </p>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
            {USE_CASES.map(u=>(
              <span key={u} style={{ ...FF, fontSize:13.5, fontWeight:500, color:C.inkSoft,
                padding:"9px 16px", borderRadius:9, background:C.paper, border:`1px solid ${C.line}` }}>{u}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding:"120px 24px" }}>
        <div style={{ maxWidth:1160, margin:"0 auto" }}>
          <div style={{ maxWidth:560, marginBottom:52 }}>
            <div style={{ ...eyebrow, marginBottom:14 }}>One dashboard, start to finish</div>
            <h2 style={{ ...DISPLAY, fontSize:"clamp(28px,3.4vw,40px)", fontWeight:700, color:C.ink, letterSpacing:"-0.03em", lineHeight:1.1, marginBottom:14 }}>
              The whole event, one dashboard
            </h2>
            <p style={{ ...FF, fontSize:16, color:C.muted, lineHeight:1.65 }}>
              Every stage below is a part of the same dashboard — set up, registration, the live day,
              judging, and wrap-up. No stitching together forms, spreadsheets, and email threads.
            </p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:16 }}>
            {FEATURES.map((f,i)=>(
              <div key={i} className="hf-feat" style={{ background:C.card, borderRadius:14, border:`1px solid ${C.line}`,
                padding:"26px 24px", transition:"border-color .18s ease, box-shadow .18s ease" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
                  <div style={{ width:44, height:44, borderRadius:11, background:C.paper, border:`1px solid ${C.line}`,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Icon name={f.icon} size={22} color={C.cobalt}/>
                  </div>
                  <span style={{ ...MM, fontSize:10.5, fontWeight:600, color:C.cobalt, textTransform:"uppercase",
                    letterSpacing:"0.07em", background:"rgba(47,107,255,0.07)", padding:"4px 9px", borderRadius:20 }}>{f.phase}</span>
                </div>
                <h3 style={{ ...DISPLAY, fontSize:17, fontWeight:700, color:C.ink, marginBottom:8, letterSpacing:"-0.01em" }}>{f.title}</h3>
                <p style={{ ...FF, fontSize:13.5, color:C.muted, lineHeight:1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding:"120px 24px", background:C.card, borderTop:`1px solid ${C.line}`, borderBottom:`1px solid ${C.line}` }}>
        <div style={{ maxWidth:1160, margin:"0 auto" }}>
          <div style={{ maxWidth:560, marginBottom:52 }}>
            <div style={{ ...eyebrow, marginBottom:14 }}>Four steps</div>
            <h2 style={{ ...DISPLAY, fontSize:"clamp(28px,3.4vw,40px)", fontWeight:700, color:C.ink, letterSpacing:"-0.03em", lineHeight:1.1 }}>
              From idea to awards
            </h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:18 }}>
            {STEPS.map((s,i)=>(
              <div key={i} style={{ position:"relative", paddingTop:22 }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:C.lineSoft }}>
                  <div style={{ position:"absolute", left:0, top:0, height:2, width:36, background:C.cobalt }}/>
                </div>
                <div style={{ ...MM, fontSize:12, fontWeight:600, color:C.cobalt, marginBottom:12, letterSpacing:"0.04em" }}>{s.n}</div>
                <h3 style={{ ...DISPLAY, fontSize:17, fontWeight:700, color:C.ink, marginBottom:8, letterSpacing:"-0.01em" }}>{s.title}</h3>
                <p style={{ ...FF, fontSize:13.5, color:C.muted, lineHeight:1.65 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EVENTS DIRECTORY (no counts) */}
      <section id="events" style={{ padding:"120px 24px" }}>
        <div style={{ maxWidth:1160, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:20, flexWrap:"wrap", marginBottom:32 }}>
            <div style={{ maxWidth:560 }}>
              <div style={{ ...eyebrow, marginBottom:14 }}>Live events</div>
              <h2 style={{ ...DISPLAY, fontSize:"clamp(28px,3.4vw,40px)", fontWeight:700, color:C.ink, letterSpacing:"-0.03em", lineHeight:1.1 }}>
                Browse hackathons
              </h2>
            </div>
            <div style={{ position:"relative", minWidth:260, flex:"0 1 320px" }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load(search,filter,category)}
                placeholder="Search events…"
                style={{ ...FF, width:"100%", padding:"11px 14px", borderRadius:10, border:`1px solid ${C.line}`,
                  fontSize:14, background:C.card, color:C.ink }} />
            </div>
          </div>

          <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
            {[{v:"",l:"All"},{v:"active",l:"Open now"},{v:"upcoming",l:"Upcoming"},{v:"completed",l:"Completed"}].map(({v,l})=>(
              <button key={v} onClick={()=>{ setFilter(v); load(search,v,category); }}
                style={{ ...FF, fontSize:13, fontWeight:500, padding:"9px 15px", borderRadius:9, cursor:"pointer",
                  border:`1px solid ${filter===v?C.ink:C.line}`, background:filter===v?C.ink:C.card,
                  color:filter===v?"#fff":C.muted, transition:"all .15s" }}>{l}</button>
            ))}
          </div>

          <div style={{ display:"flex", gap:7, marginBottom:26, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ ...MM, fontSize:11, color:C.faint, textTransform:"uppercase", letterSpacing:"0.08em", marginRight:4 }}>By use case</span>
            <button onClick={()=>{ setCategory(""); load(search,filter,""); }}
              style={{ ...FF, fontSize:12.5, fontWeight:500, padding:"6px 12px", borderRadius:20, cursor:"pointer",
                border:`1px solid ${category===""?C.cobalt:C.line}`, background:category===""?C.cobalt:"transparent",
                color:category===""?"#fff":C.muted }}>All</button>
            {CATEGORIES.map(cat=>(
              <button key={cat} onClick={()=>{ setCategory(cat); load(search,filter,cat); }}
                style={{ ...FF, fontSize:12.5, fontWeight:500, padding:"6px 12px", borderRadius:20, cursor:"pointer",
                  border:`1px solid ${category===cat?C.cobalt:C.line}`, background:category===cat?C.cobalt:"transparent",
                  color:category===cat?"#fff":C.muted, transition:"all .15s" }}>{cat}</button>
            ))}
          </div>

          {loading && <div style={{ textAlign:"center", padding:60 }}><span className="hf-pulse" style={{ ...MM, fontSize:14, color:C.faint }}>Loading events…</span></div>}
          {!loading && hackathons.length===0 && (
            <div style={{ textAlign:"center", padding:"56px 24px", border:`1px dashed ${C.line}`, borderRadius:14, background:C.card }}>
              <div style={{ ...DISPLAY, fontSize:19, fontWeight:700, color:C.ink, marginBottom:8 }}>No events match that yet</div>
              <div style={{ ...FF, fontSize:14, color:C.muted }}>Try another search, or <a href="/signup" style={{ color:C.cobalt, fontWeight:600, textDecoration:"none" }}>start your own</a>.</div>
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
            {hackathons.map(h=><HackCard key={h.id} hack={h}/>)}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding:"120px 24px", background:C.card, borderTop:`1px solid ${C.line}`, borderBottom:`1px solid ${C.line}` }}>
        <div style={{ maxWidth:640, margin:"0 auto", textAlign:"center" }}>
          <div style={{ ...eyebrow, marginBottom:14 }}>Pricing</div>
          <h2 style={{ ...DISPLAY, fontSize:"clamp(28px,3.4vw,40px)", fontWeight:700, color:C.ink, letterSpacing:"-0.03em", lineHeight:1.1, marginBottom:16 }}>
            Free to run your first event
          </h2>
          <p style={{ ...FF, fontSize:16, color:C.muted, lineHeight:1.65, marginBottom:28 }}>
            Start free — no credit card. Running something bigger, or several events across a department?
            We'll set your limits to fit. Colleges hosting community events run free.
          </p>
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
            <a href="/signup" className="hf-cta" style={btnPrimary}>Start free <Icon name="arrow" size={17} color="#fff"/></a>
            <a href="/demo" style={btnGhost}>Talk to us about a larger event</a>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding:"128px 24px", background:C.ink }}>
        <div style={{ maxWidth:760, margin:"0 auto", textAlign:"center" }}>
          <h2 style={{ ...DISPLAY, fontSize:"clamp(34px,4.6vw,54px)", fontWeight:700, color:"#fff", letterSpacing:"-0.035em", lineHeight:1.05, marginBottom:18 }}>
            Your next hackathon, handled.
          </h2>
          <p style={{ ...FF, fontSize:18, color:"rgba(255,255,255,0.6)", lineHeight:1.6, marginBottom:38, maxWidth:520, margin:"0 auto 38px" }}>
            Set up your event page today and see how much of the work runs itself.
          </p>
          <a href="/signup" className="hf-cta-coral" style={{ ...FF, display:"inline-flex", alignItems:"center", gap:10,
            padding:"20px 44px", borderRadius:14, background:C.coral, color:"#fff", fontSize:19, fontWeight:700,
            textDecoration:"none", boxShadow:"0 18px 40px -16px rgba(255,106,69,0.6)" }}>
            Start free <Icon name="arrow" size={20} color="#fff" w={2}/>
          </a>
          <div style={{ ...FF, fontSize:13.5, color:"rgba(255,255,255,0.4)", marginTop:20 }}>
            Free for colleges &amp; student communities · No credit card
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:C.ink, padding:"8px 24px 40px", borderTop:"1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth:1160, margin:"0 auto", paddingTop:36, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <span style={{ width:24, height:24, borderRadius:6, background:"rgba(255,255,255,0.1)", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name="launch" size={14} color={C.coral} w={2}/>
            </span>
            <span style={{ ...DISPLAY, fontSize:15, fontWeight:700, color:"#fff" }}>HackFest Hub</span>
          </div>
          <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
            {[["Events","#events"],["Community","/community"],["Features","#features"],["Pricing","#pricing"],["Hall of Fame","/winners"],["Sign in","/admin"],["Contact","mailto:contact@hackfesthub.com"]].map(([l,h])=>(
              <a key={l} href={h} className="hf-link" style={{ ...FF, fontSize:13, color:"rgba(255,255,255,0.5)", textDecoration:"none" }}>{l}</a>
            ))}
          </div>
        </div>
        <div style={{ maxWidth:1160, margin:"24px auto 0", paddingTop:18, borderTop:"1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ ...FF, fontSize:12, color:"rgba(255,255,255,0.3)" }}>© {new Date().getFullYear()} HackFest Hub</span>
        </div>
      </footer>
    </div>
  );
}