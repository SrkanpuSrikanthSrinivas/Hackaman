import { useState, useEffect } from "react";

const IS_LOCAL = typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const API_BASE = IS_LOCAL ? "http://localhost:3001" : "";

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function PublicPage() {
  const slug = window.location.pathname.replace(/^\/p\//, "").split("/")[0];
  const [hack, setHack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/hackathons/${slug}`)
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setHack(d); })
      .catch(() => setErr("Could not load hackathon."))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div style={{ fontFamily:"'Inter',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#f8fafc" }}>
      <div style={{ width:32, height:32, border:"3px solid #e2e8f0", borderTopColor:"#2563eb", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (err || !hack) return (
    <div style={{ fontFamily:"'Inter',sans-serif", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#f8fafc", gap:12 }}>
      <div style={{ fontSize:48 }}>🏁</div>
      <div style={{ fontSize:20, fontWeight:600, color:"#0f172a" }}>Hackathon not found</div>
      <div style={{ fontSize:14, color:"#64748b" }}>{err || "This page doesn't exist or hasn't been published yet."}</div>
    </div>
  );

  const color = hack.bannerColor || "#2563eb";
  const prizes = hack.prizes || [];
  const schedule = hack.schedule || [];
  const sponsors = hack.sponsors || [];

  const CAT_COLORS = { "AI/ML":"#2563eb","Sustainability":"#16a34a","Security":"#d97706","Social Impact":"#7c3aed","EdTech":"#0891b2","FinTech":"#2563eb","Health":"#16a34a","Other":"#64748b" };

  return (
    <div style={{ fontFamily:"'Inter',-apple-system,sans-serif", color:"#0f172a", lineHeight:1.6 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.6s ease forwards; }
        a { color: inherit; text-decoration: none; }
      `}</style>

      {/* Hero */}
      <div style={{ background:`linear-gradient(135deg, ${color}ee 0%, ${color}99 100%)`, padding:"80px 24px 64px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(circle at 20% 50%, rgba(255,255,255,0.08) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 50%)" }} />
        <div style={{ position:"relative", maxWidth:760, margin:"0 auto" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.15)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:9999, padding:"6px 16px", fontSize:13, color:"#fff", fontWeight:500, marginBottom:24 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:"#4ade80", animation:"spin 2s linear infinite" }} />
            {hack.status === "active" ? "Live now" : hack.status === "upcoming" ? "Coming soon" : "Completed"}
          </div>
          <h1 style={{ fontSize:"clamp(32px,6vw,60px)", fontWeight:800, color:"#fff", letterSpacing:"-0.03em", marginBottom:16, lineHeight:1.1 }} className="fade-up">
            {hack.name}
          </h1>
          {hack.tagline && (
            <p style={{ fontSize:"clamp(16px,2.5vw,22px)", color:"rgba(255,255,255,0.85)", marginBottom:32, fontWeight:400, maxWidth:580, margin:"0 auto 32px" }}>
              {hack.tagline}
            </p>
          )}
          <div style={{ display:"flex", justifyContent:"center", gap:24, flexWrap:"wrap", marginBottom:40 }}>
            {[
              { icon:"📅", label: `${fmtDate(hack.startDate)}${hack.endDate !== hack.startDate ? ` – ${fmtDate(hack.endDate)}` : ""}` },
              { icon:"📍", label: hack.location },
              hack.teamCount > 0 && { icon:"👥", label: `${hack.teamCount} team${hack.teamCount!==1?"s":""} registered` },
            ].filter(Boolean).map((item, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, color:"rgba(255,255,255,0.9)", fontSize:14, fontWeight:500 }}>
                <span>{item.icon}</span> {item.label}
              </div>
            ))}
          </div>
          {hack.registrationUrl ? (
            <a href={hack.registrationUrl} target="_blank" rel="noopener noreferrer"
              style={{ display:"inline-block", background:"#fff", color:color, fontWeight:700, fontSize:16, padding:"14px 36px", borderRadius:10, boxShadow:"0 4px 20px rgba(0,0,0,0.15)", transition:"transform 0.15s", cursor:"pointer" }}
              onMouseEnter={e => e.target.style.transform="scale(1.03)"}
              onMouseLeave={e => e.target.style.transform="scale(1)"}>
              Register Now →
            </a>
          ) : (
            <div style={{ display:"inline-block", background:"rgba(255,255,255,0.2)", color:"#fff", fontWeight:600, fontSize:15, padding:"12px 28px", borderRadius:10, border:"1px solid rgba(255,255,255,0.3)" }}>
              Registration opens soon
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth:900, margin:"0 auto", padding:"60px 24px" }}>

        {/* Prizes */}
        {prizes.length > 0 && (
          <section style={{ marginBottom:64 }}>
            <SectionHeader icon="🏆" title="Prizes" />
            <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(prizes.length, 3)}, 1fr)`, gap:16 }}>
              {prizes.map((p, i) => (
                <div key={i} style={{ background:"#fff", border:`2px solid ${i===0?"#fbbf24":i===1?"#94a3b8":i===2?"#b45309":"#e2e8f0"}`, borderRadius:12, padding:"24px 20px", textAlign:"center", boxShadow:"0 1px 8px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>{i===0?"🥇":i===1?"🥈":"🥉"}</div>
                  <div style={{ fontSize:28, fontWeight:800, color:color, marginBottom:4 }}>{p.amount}</div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#0f172a", marginBottom:2 }}>{p.place}</div>
                  <div style={{ fontSize:13, color:"#64748b" }}>{p.label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* About */}
        {hack.description && (
          <section style={{ marginBottom:64 }}>
            <SectionHeader icon="ℹ️" title="About this hackathon" />
            <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"24px 28px", fontSize:15, color:"#334155", lineHeight:1.8 }}>
              {hack.description}
            </div>
          </section>
        )}

        {/* Schedule */}
        {schedule.length > 0 && (
          <section style={{ marginBottom:64 }}>
            <SectionHeader icon="🗓️" title="Schedule" />
            <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden" }}>
              {schedule.map((s, i) => (
                <div key={i} style={{ display:"flex", gap:20, padding:"16px 24px", borderBottom: i < schedule.length-1 ? "1px solid #f1f5f9" : "none", alignItems:"center" }}>
                  <div style={{ minWidth:90, fontSize:13, fontWeight:600, color:color }}>{s.date}</div>
                  <div style={{ width:1, background:"#e2e8f0", alignSelf:"stretch" }} />
                  <div style={{ fontSize:14, color:"#334155", fontWeight:500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Rules */}
        {hack.rules && (
          <section style={{ marginBottom:64 }}>
            <SectionHeader icon="📋" title="Rules & Guidelines" />
            <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"24px 28px", fontSize:14, color:"#334155", lineHeight:1.8, whiteSpace:"pre-wrap" }}>
              {hack.rules}
            </div>
          </section>
        )}

        {/* Sponsors */}
        {sponsors.length > 0 && (
          <section style={{ marginBottom:64 }}>
            <SectionHeader icon="🤝" title="Sponsors" />
            <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
              {sponsors.map((s, i) => (
                <div key={i} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"16px 24px", fontSize:14, fontWeight:600, color:"#334155" }}>
                  {s.name}
                  {s.tier && <span style={{ fontSize:11, color:"#94a3b8", marginLeft:6 }}>{s.tier}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section style={{ background:`linear-gradient(135deg, ${color}15, ${color}08)`, border:`1px solid ${color}30`, borderRadius:16, padding:"40px 32px", textAlign:"center" }}>
          <h2 style={{ fontSize:26, fontWeight:700, color:"#0f172a", marginBottom:8 }}>Ready to build?</h2>
          <p style={{ fontSize:15, color:"#64748b", marginBottom:24 }}>Join teams from across the region competing for prizes and recognition.</p>
          {hack.registrationUrl ? (
            <a href={hack.registrationUrl} target="_blank" rel="noopener noreferrer"
              style={{ display:"inline-block", background:color, color:"#fff", fontWeight:700, fontSize:15, padding:"13px 32px", borderRadius:9, cursor:"pointer" }}>
              Register your team →
            </a>
          ) : (
            <div style={{ fontSize:13, color:"#94a3b8" }}>Registration link coming soon.</div>
          )}
        </section>
      </div>

      {/* Footer */}
      <div style={{ borderTop:"1px solid #e2e8f0", padding:"24px", textAlign:"center", fontSize:12, color:"#94a3b8" }}>
        Powered by <strong style={{ color:"#64748b" }}>HackFest Hub</strong>
        <span style={{ margin:"0 12px" }}>·</span>
        <a href="/" style={{ color:"#64748b" }}>Admin portal</a>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
      <span style={{ fontSize:20 }}>{icon}</span>
      <h2 style={{ fontSize:20, fontWeight:700, color:"#0f172a" }}>{title}</h2>
    </div>
  );
}
