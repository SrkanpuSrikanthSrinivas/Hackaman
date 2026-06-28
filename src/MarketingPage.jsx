import { useState, useEffect } from "react";

const BASE = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL || "";
const FF = { fontFamily:"'Inter',system-ui,sans-serif" };
const MM = { fontFamily:"'JetBrains Mono','Fira Code',monospace" };

// ── Hackathon card ────────────────────────────────────────────────────────────
function HackCard({ hack }) {
  const STATUS = { active:{label:"Open Now",color:"#10b981",bg:"rgba(16,185,129,0.12)"},
    upcoming:{label:"Coming Soon",color:"#f59e0b",bg:"rgba(245,158,11,0.12)"},
    completed:{label:"Completed",color:"#6b7280",bg:"rgba(107,114,128,0.12)"} };
  const st = STATUS[hack.status] || STATUS.upcoming;
  const accent = hack.bannerColor || "#6366f1";
  const daysLeft = hack.startDate ? Math.max(0,Math.ceil((new Date(hack.startDate)-Date.now())/864e5)) : null;

  return (
    <a href={`/register/${hack.id}`}
      style={{ textDecoration:"none", display:"block",
        background:"#fff", borderRadius:16, overflow:"hidden",
        border:"1px solid #e5e7eb", transition:"all 0.2s",
        boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}
      onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow=`0 12px 32px rgba(0,0,0,0.12),0 0 0 1px ${accent}33`; }}
      onMouseLeave={e=>{ e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.06)"; }}>
      {/* Banner */}
      <div style={{ height:8, background:`linear-gradient(90deg,${accent},${accent}99)` }}/>
      <div style={{ padding:"20px 22px 22px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
          <span style={{ ...FF, fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:9999,
            background:st.bg, color:st.color }}>{st.label}</span>
          {hack.prizePool && <span style={{ ...FF, fontSize:11, color:"#6b7280" }}>🏆 {hack.prizePool}</span>}
        </div>
        <h3 style={{ ...FF, fontSize:16, fontWeight:700, color:"#111827", marginBottom:6, lineHeight:1.3 }}>{hack.name}</h3>
        <p style={{ ...FF, fontSize:12, color:"#6b7280", lineHeight:1.6, marginBottom:12,
          display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
          {hack.tagline || hack.description || "Join this exciting hackathon"}
        </p>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          {hack.location && <span style={{ ...FF, fontSize:11, color:"#9ca3af" }}>📍 {hack.location}</span>}
          {hack.startDate && <span style={{ ...FF, fontSize:11, color:"#9ca3af" }}>
            📅 {new Date(hack.startDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
          </span>}
          {hack.status==="active" && daysLeft !== null && <span style={{ ...FF, fontSize:11, color:"#10b981", fontWeight:600 }}>⚡ {daysLeft} days left</span>}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:14,
          paddingTop:12, borderTop:"1px solid #f3f4f6" }}>
          <div style={{ display:"flex", gap:14 }}>
            {hack.participants > 0 && <span style={{ ...FF, fontSize:11, color:"#6b7280" }}>👥 {hack.participants} registered</span>}
            {hack.projects > 0 && <span style={{ ...FF, fontSize:11, color:"#6b7280" }}>📦 {hack.projects} projects</span>}
          </div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {(hack.tracks||"").split(",").slice(0,2).map(t=>t.trim()).filter(Boolean).map(t=>(
              <span key={t} style={{ ...FF, fontSize:10, padding:"2px 7px", borderRadius:4,
                background:"#f3f4f6", color:"#6b7280" }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </a>
  );
}

// ── Stats counter ─────────────────────────────────────────────────────────────
function StatCounter({ value, label, icon }) {
  const [count, setCount] = useState(0);
  useEffect(()=>{
    const target = parseInt(value) || 0;
    const step = Math.ceil(target / 40);
    let cur = 0;
    const t = setInterval(()=>{ cur = Math.min(cur+step, target); setCount(cur); if(cur>=target) clearInterval(t); }, 30);
    return ()=>clearInterval(t);
  }, [value]);
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:32, marginBottom:6 }}>{icon}</div>
      <div style={{ ...MM, fontSize:32, fontWeight:800, color:"#111827", marginBottom:4 }}>
        {count.toLocaleString()}+
      </div>
      <div style={{ ...FF, fontSize:14, color:"#6b7280" }}>{label}</div>
    </div>
  );
}

// ── Main marketing page ───────────────────────────────────────────────────────
export default function MarketingPage() {
  const [hackathons, setHackathons] = useState([]);
  const [total,      setTotal]      = useState(0);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState("");
  const [loading,    setLoading]    = useState(true);
  const [stats, setStats] = useState({ hackathons:0, participants:0, projects:0 });
  const [email,      setEmail]      = useState("");
  const [subscribed, setSubscribed] = useState(false);

  // Set marketing page meta tags
  useEffect(()=>{
    document.title = "HackFest Hub — The Complete Hackathon Management Platform";
    const setMeta = (name, content, prop=false) => {
      const sel = prop ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let el = document.querySelector(sel);
      if(!el){ el=document.createElement("meta"); el.setAttribute(prop?"property":"name",name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("description","Run world-class hackathons with AI-powered judging, beautiful event pages, and automated certificates — free forever.");
    setMeta("og:title","HackFest Hub — The Complete Hackathon Management Platform",true);
    setMeta("og:description","Run world-class hackathons with AI-powered judging, beautiful event pages, and automated certificates — free forever.",true);
    return () => { document.title = "HackFest Hub"; };
  }, []);

  const load = (s=search, f=filter) => {
    setLoading(true);
    fetch(`${BASE}/api/public/hackathons?search=${encodeURIComponent(s)}&status=${f}&limit=12`)
      .then(r=>r.json())
      .then(d=>{ setHackathons(d.hackathons||[]); setTotal(d.total||0); })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  };

  useEffect(()=>{
    load();

  },[]);

  const FEATURES = [
    { icon:"🏗️", title:"Launch in minutes", desc:"Beautiful event pages, custom branding, registration forms — all configured from one dashboard without touching code." },
    { icon:"⚖️", title:"Fair judging system", desc:"Weighted criteria, judge assignments, conflict detection, and AI-powered calibration ensure every score is fair and consistent." },
    { icon:"🤖", title:"AI-powered insights", desc:"Get instant team performance analysis, judge bias detection, hackathon reports, and a chat assistant that answers questions about your event." },
    { icon:"🎓", title:"Post-event excellence", desc:"Auto-generate verified certificates, send winner announcements, export all data, and issue Best Judge Awards — all in one click." },
    { icon:"📊", title:"Real-time analytics", desc:"Live leaderboard, judge progress tracking, check-in dashboard, and announcement system keep you in control during the event." },
    { icon:"🌐", title:"Built for community", desc:"People's Choice voting, Discord/WhatsApp/Slack integrations, Q&A system, and team formation board create genuine community." },
  ];



  const HOW_IT_WORKS = [
    { step:"01", title:"Create your event", desc:"Set up your hackathon page in minutes — dates, prizes, tracks, judges, and a beautiful public registration page." },
    { step:"02", title:"Participants register", desc:"Shareable public page handles registrations, team formation, Q&A, and community links automatically." },
    { step:"03", title:"Judge & score", desc:"Judges score on their device with weighted criteria. AI calibration ensures consistency across your panel." },
    { step:"04", title:"Celebrate & close", desc:"Publish leaderboard, send winner emails, generate certificates, export all data, and issue awards — one click each." },
  ];

  return (
    <div style={{ ...FF, background:"#fff", color:"#111827", minHeight:"100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        a { color:inherit; }
        ::selection { background:#6366f1; color:#fff; }
        input:focus, textarea:focus { outline:none; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .hero-btn:hover { transform:translateY(-2px)!important; box-shadow:0 8px 24px rgba(79,70,229,0.4)!important; }
        .hero-btn { transition:all 0.2s!important; }
        .outline-btn:hover { background:#f3f4f6!important; }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position:"sticky", top:0, zIndex:100, background:"rgba(255,255,255,0.95)",
        backdropFilter:"blur(12px)", borderBottom:"1px solid #e5e7eb" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 24px",
          display:"flex", alignItems:"center", justifyContent:"space-between", height:60 }}>
          <a href="/" style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none" }}>
            <span style={{ fontSize:22 }}>⚡</span>
            <span style={{ ...FF, fontSize:16, fontWeight:800, color:"#111827", letterSpacing:"-0.03em" }}>HackFest Hub</span>
          </a>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <a href="#features" style={{ ...FF, fontSize:13, color:"#6b7280", padding:"6px 12px", textDecoration:"none" }}>Features</a>
            <a href="#how-it-works" style={{ ...FF, fontSize:13, color:"#6b7280", padding:"6px 12px", textDecoration:"none" }}>How it works</a>
            <a href="#free" style={{ ...FF, fontSize:13, color:"#6b7280", padding:"6px 12px", textDecoration:"none" }}>Pricing</a>
            <a href="/admin" style={{ ...FF, fontSize:13, color:"#6b7280", padding:"6px 12px", textDecoration:"none" }}>Sign in</a>
            <a href="mailto:srikanth@hackfesthub.com?subject=Host a Hackathon"
              style={{ ...FF, fontSize:13, fontWeight:600, padding:"8px 16px", borderRadius:8,
                background:"#4f46e5", color:"#fff", textDecoration:"none" }}>
              Host an event →
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)",
        padding:"100px 24px 80px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        {/* Decorative orbs */}
        {[{t:-100,l:-100,s:400,c:"#4f46e5"},{t:-50,r:-80,s:300,c:"#7c3aed"},{b:-80,l:"30%",s:250,c:"#2563eb"}].map((o,i)=>(
          <div key={i} style={{ position:"absolute", width:o.s, height:o.s, borderRadius:"50%",
            background:o.c, opacity:0.12, filter:"blur(60px)",
            top:o.t, left:o.l, right:o.r, bottom:o.b, pointerEvents:"none" }}/>
        ))}

        <div style={{ position:"relative", maxWidth:860, margin:"0 auto" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8,
            background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)",
            borderRadius:9999, padding:"6px 16px", marginBottom:28 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#10b981",
              animation:"pulse 2s infinite", display:"inline-block" }}/>
            <span style={{ ...FF, fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.7)" }}>
              The complete hackathon platform
            </span>
          </div>

          <h1 style={{ fontSize:"clamp(36px,6vw,72px)", fontWeight:900, color:"#fff",
            letterSpacing:"-0.04em", lineHeight:1.08, marginBottom:20 }}>
            The home for<br/>
            <span style={{ background:"linear-gradient(135deg,#818cf8,#c084fc)", WebkitBackgroundClip:"text",
              WebkitTextFillColor:"transparent" }}>brilliant hackathons</span>
          </h1>
          <p style={{ ...FF, fontSize:"clamp(16px,2vw,20px)", color:"rgba(255,255,255,0.55)",
            lineHeight:1.7, marginBottom:40, maxWidth:620, margin:"0 auto 40px" }}>
            Run world-class hackathons with AI-powered judging, beautiful event pages,
            automated certificates, and everything else you need — in one platform.
          </p>

          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap", marginBottom:60 }}>
            <a href="mailto:srikanth@hackfesthub.com?subject=Host a Hackathon"
              className="hero-btn"
              style={{ ...FF, display:"inline-flex", alignItems:"center", gap:8,
                padding:"14px 28px", borderRadius:12, background:"#4f46e5", color:"#fff",
                fontSize:16, fontWeight:700, textDecoration:"none",
                boxShadow:"0 4px 14px rgba(79,70,229,0.4)" }}>
              🚀 Host a hackathon
            </a>
            <a href="#hackathons" className="outline-btn"
              style={{ ...FF, display:"inline-flex", alignItems:"center", gap:8,
                padding:"14px 28px", borderRadius:12,
                background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)",
                color:"rgba(255,255,255,0.9)", fontSize:16, fontWeight:600, textDecoration:"none" }}>
              Browse events →
            </a>
          </div>

          {/* Stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:32,
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:16, padding:"28px 40px", maxWidth:600, margin:"0 auto" }}>
            <StatCounter value={total||0} label="Hackathons hosted" icon="🏆" />
            <StatCounter value={0} label="Participants" icon="👥" />
            <StatCounter value={0} label="Projects built" icon="📦" />
          </div>
        </div>
      </section>

      {/* ── HACKATHON DIRECTORY ── */}
      <section id="hackathons" style={{ padding:"80px 24px", background:"#f9fafb" }}>
        <div style={{ maxWidth:1200, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:40 }}>
            <div style={{ ...FF, fontSize:11, fontWeight:700, color:"#4f46e5", letterSpacing:"0.15em",
              textTransform:"uppercase", marginBottom:10 }}>Live events</div>
            <h2 style={{ ...FF, fontSize:36, fontWeight:800, color:"#111827",
              letterSpacing:"-0.03em", marginBottom:12 }}>Browse hackathons</h2>
            <p style={{ ...FF, fontSize:16, color:"#6b7280" }}>
              {total} hackathon{total!==1?"s":""} • Find your next challenge
            </p>
          </div>

          {/* Search + Filters */}
          <div style={{ display:"flex", gap:12, marginBottom:28, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:260, position:"relative" }}>
              <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)",
                color:"#9ca3af", fontSize:16 }}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&load(search,filter)}
                placeholder="Search hackathons by name, tag, or prize…"
                style={{ ...FF, width:"100%", padding:"11px 14px 11px 40px", borderRadius:10,
                  border:"1px solid #e5e7eb", fontSize:14, background:"#fff",
                  boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }} />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {[{v:"",l:"All"},  {v:"active",l:"🟢 Open"}, {v:"upcoming",l:"🟡 Upcoming"}, {v:"completed",l:"✓ Completed"}].map(({v,l})=>(
                <button key={v} onClick={()=>{ setFilter(v); load(search,v); }}
                  style={{ ...FF, fontSize:13, fontWeight:500, padding:"10px 16px", borderRadius:10,
                    border:`1px solid ${filter===v?"#4f46e5":"#e5e7eb"}`,
                    background:filter===v?"#4f46e5":"#fff", color:filter===v?"#fff":"#4b5563",
                    cursor:"pointer", transition:"all 0.15s" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div style={{ textAlign:"center", padding:60, color:"#9ca3af" }}>
              <div style={{ fontSize:32, marginBottom:12, animation:"pulse 1.5s infinite" }}>⚡</div>
              <div style={{ ...FF, fontSize:14 }}>Loading hackathons…</div>
            </div>
          )}

          {!loading && hackathons.length === 0 && (
            <div style={{ textAlign:"center", padding:60 }}>
              <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
              <div style={{ ...FF, fontSize:18, fontWeight:600, color:"#374151", marginBottom:8 }}>No hackathons found</div>
              <div style={{ ...FF, fontSize:14, color:"#9ca3af" }}>Try a different search or filter</div>
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:18 }}>
            {hackathons.map(h => <HackCard key={h.id} hack={h} />)}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding:"96px 24px", background:"#fff" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:56 }}>
            <div style={{ ...FF, fontSize:11, fontWeight:700, color:"#4f46e5", letterSpacing:"0.15em",
              textTransform:"uppercase", marginBottom:10 }}>Everything you need</div>
            <h2 style={{ ...FF, fontSize:36, fontWeight:800, color:"#111827",
              letterSpacing:"-0.03em", marginBottom:12 }}>Built to run brilliant events</h2>
            <p style={{ ...FF, fontSize:16, color:"#6b7280", maxWidth:520, margin:"0 auto" }}>
              Every feature you need, nothing you don't. From first registration to final certificate.
            </p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:20 }}>
            {FEATURES.map((f,i) => (
              <div key={i} style={{ padding:"28px 28px 24px", borderRadius:16,
                border:"1px solid #e5e7eb", transition:"all 0.2s" }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor="#6366f1"; e.currentTarget.style.boxShadow="0 4px 20px rgba(99,102,241,0.1)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.boxShadow="none"; }}>
                <div style={{ fontSize:32, marginBottom:14 }}>{f.icon}</div>
                <h3 style={{ ...FF, fontSize:16, fontWeight:700, color:"#111827", marginBottom:8 }}>{f.title}</h3>
                <p style={{ ...FF, fontSize:13, color:"#6b7280", lineHeight:1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ padding:"96px 24px", background:"#f9fafb" }}>
        <div style={{ maxWidth:1000, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:56 }}>
            <div style={{ ...FF, fontSize:11, fontWeight:700, color:"#4f46e5", letterSpacing:"0.15em",
              textTransform:"uppercase", marginBottom:10 }}>Simple process</div>
            <h2 style={{ ...FF, fontSize:36, fontWeight:800, color:"#111827", letterSpacing:"-0.03em" }}>
              From idea to event in 30 minutes
            </h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:24 }}>
            {HOW_IT_WORKS.map((step,i) => (
              <div key={i} style={{ position:"relative" }}>
                {i < HOW_IT_WORKS.length-1 && (
                  <div style={{ position:"absolute", top:20, left:"calc(100% - 12px)", width:"24px",
                    height:2, background:"#e5e7eb", zIndex:0,
                    display:window.innerWidth<700?"none":"block" }}/>
                )}
                <div style={{ background:"#fff", borderRadius:16, padding:24, border:"1px solid #e5e7eb",
                  position:"relative", zIndex:1 }}>
                  <div style={{ ...MM, fontSize:11, fontWeight:700, color:"#4f46e5",
                    marginBottom:14, letterSpacing:"0.1em" }}>STEP {step.step}</div>
                  <h3 style={{ ...FF, fontSize:15, fontWeight:700, color:"#111827", marginBottom:8 }}>{step.title}</h3>
                  <p style={{ ...FF, fontSize:12, color:"#6b7280", lineHeight:1.7 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>





      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding:"80px 24px", background:"#f9fafb" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:48 }}>
            <div style={{ ...FF, fontSize:11, fontWeight:700, color:"#4f46e5", letterSpacing:"0.15em",
              textTransform:"uppercase", marginBottom:10 }}>Simple pricing</div>
            <h2 style={{ ...FF, fontSize:32, fontWeight:800, color:"#111827", letterSpacing:"-0.03em", marginBottom:12 }}>
              Free to use
            </h2>
            <p style={{ ...FF, fontSize:15, color:"#6b7280" }}>Every feature, completely free. No credit card needed.</p>
          </div>

        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding:"80px 24px", background:"linear-gradient(135deg,#1e1b4b,#312e81)",
        textAlign:"center" }}>
        <div style={{ maxWidth:600, margin:"0 auto" }}>
          <h2 style={{ ...FF, fontSize:36, fontWeight:900, color:"#fff",
            letterSpacing:"-0.04em", marginBottom:14 }}>
            Ready to run your hackathon?
          </h2>
          <p style={{ ...FF, fontSize:16, color:"rgba(255,255,255,0.55)", marginBottom:32 }}>
            Join event organizers who run world-class hackathons on HackFest Hub.
          </p>
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
            <a href="mailto:srikanth@hackfesthub.com?subject=Host a Hackathon"
              style={{ ...FF, display:"inline-flex", alignItems:"center", gap:8,
                padding:"14px 28px", borderRadius:12, background:"#4f46e5", color:"#fff",
                fontSize:16, fontWeight:700, textDecoration:"none",
                boxShadow:"0 4px 14px rgba(79,70,229,0.4)" }}>
              🚀 Get started free
            </a>
            <a href="/admin"
              style={{ ...FF, display:"inline-flex", alignItems:"center", gap:8,
                padding:"14px 28px", borderRadius:12,
                background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)",
                color:"rgba(255,255,255,0.85)", fontSize:16, fontWeight:600, textDecoration:"none" }}>
              Admin login →
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background:"#0f172a", padding:"48px 24px 32px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:40, marginBottom:40 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <span style={{ fontSize:20 }}>⚡</span>
                <span style={{ ...FF, fontSize:15, fontWeight:800, color:"#fff" }}>HackFest Hub</span>
              </div>
              <p style={{ ...FF, fontSize:13, color:"rgba(255,255,255,0.35)", lineHeight:1.7, maxWidth:240 }}>
                The complete enterprise hackathon management platform. Better than HackFest Hub.
              </p>
            </div>
            {[
              { title:"Platform", links:[{l:"Browse events",h:"#hackathons"},{l:"Host a hackathon",h:"mailto:srikanth@hackfesthub.com"},{l:"Pricing",h:"#free"},{l:"Admin login",h:"/admin"}] },
              { title:"Use cases", links:[{l:"Corporate hackathons",h:"#"},{l:"University events",h:"#"},{l:"IEEE chapters",h:"#"},{l:"Online hackathons",h:"#"}] },
              { title:"Company", links:[{l:"About",h:"#"},{l:"Contact",h:"mailto:srikanth@hackfesthub.com"},{l:"LinkedIn",h:"https://linkedin.com"},{l:"Twitter",h:"#"}] },
            ].map((col,i) => (
              <div key={i}>
                <div style={{ ...FF, fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.5)",
                  textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:14 }}>{col.title}</div>
                {col.links.map((link,j) => (
                  <a key={j} href={link.h}
                    style={{ ...FF, display:"block", fontSize:13, color:"rgba(255,255,255,0.5)",
                      marginBottom:8, textDecoration:"none", transition:"color 0.15s" }}
                    onMouseEnter={e=>e.target.style.color="#fff"}
                    onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.5)"}>
                    {link.l}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:24,
            display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
            <span style={{ ...FF, fontSize:12, color:"rgba(255,255,255,0.25)" }}>
              © {new Date().getFullYear()} HackFest Hub. All rights reserved.
            </span>
            <div style={{ display:"flex", gap:16 }}>
              {["Privacy","Terms","Security"].map(l => (
                <a key={l} href="#" style={{ ...FF, fontSize:12, color:"rgba(255,255,255,0.25)", textDecoration:"none" }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
