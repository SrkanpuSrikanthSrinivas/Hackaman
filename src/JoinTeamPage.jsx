import { useState, useEffect } from "react";

const BASE = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL || "";
const FF = { fontFamily:"'Inter',system-ui,sans-serif" };
const MM = { fontFamily:"'JetBrains Mono','Fira Code',monospace" };

export default function JoinTeamPage() {
  const code = window.location.pathname.split("/join/")[1]?.split("?")[0]?.toUpperCase() || "";

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");
  const [form,    setForm]    = useState({ name:"", email:"" });
  const [busy,    setBusy]    = useState(false);
  const [done,    setDone]    = useState(null);

  useEffect(() => {
    document.title = "Join a team | HackFest Hub";
    if (!code) { setErr("No invitation code provided"); setLoading(false); return; }
    fetch(`${BASE}/api/invite/${code}`)
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setData(d); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
    return () => { document.title = "HackFest Hub"; };
  }, [code]);

  const accept = async e => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { setErr("Name and email are required"); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${BASE}/api/invite/${code}/accept`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(form),
      }).then(r => r.json());
      if (r.error) { setErr(r.error); setBusy(false); return; }
      setDone(r);
    } catch(e) { setErr(e.message); }
    setBusy(false);
  };

  const accent = data?.hackathon?.bannerColor || "#4f46e5";
  const IS = {
    ...FF, width:"100%", padding:"11px 14px", borderRadius:10, fontSize:14,
    color:"#fff", background:"rgba(255,255,255,0.07)",
    border:"1.5px solid rgba(255,255,255,0.15)", outline:"none", boxSizing:"border-box",
  };

  const Shell = ({ children }) => (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0a0e1f 0%,#1e1b4b 100%)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:24, ...FF }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing:border-box; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
      `}</style>
      <div style={{ width:"100%", maxWidth:440 }}>{children}</div>
    </div>
  );

  if (loading) return (
    <Shell><div style={{ textAlign:"center", fontSize:44, animation:"pulse 1.4s infinite" }}>⚡</div></Shell>
  );

  if (err && !data) return (
    <Shell>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:56, marginBottom:18 }}>🔗</div>
        <h1 style={{ fontSize:22, fontWeight:800, color:"#fff", marginBottom:10 }}>Invitation not valid</h1>
        <p style={{ fontSize:14, color:"rgba(255,255,255,0.5)", lineHeight:1.7, marginBottom:26 }}>{err}</p>
        <a href="/" style={{ ...FF, display:"inline-block", padding:"12px 26px", borderRadius:10,
          background:"#4f46e5", color:"#fff", fontSize:14, fontWeight:700, textDecoration:"none" }}>
          Go to HackFest Hub →
        </a>
      </div>
    </Shell>
  );

  if (done) return (
    <Shell>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:60, marginBottom:18 }}>🎉</div>
        <h1 style={{ fontSize:26, fontWeight:900, color:"#fff", letterSpacing:"-0.03em", marginBottom:10 }}>
          You're in!
        </h1>
        <p style={{ fontSize:15, color:"rgba(255,255,255,0.55)", lineHeight:1.7, marginBottom:24 }}>
          Welcome to <strong style={{ color:"#fff" }}>{done.teamName}</strong>
        </p>

        {done.defaultPassword && (
          <div style={{ background:"rgba(99,102,241,0.12)", border:"1.5px solid rgba(99,102,241,0.3)",
            borderRadius:14, padding:"20px 22px", marginBottom:24, textAlign:"left" }}>
            <div style={{ ...FF, fontSize:11, fontWeight:700, color:"#a5b4fc",
              textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>
              🔑 Your login
            </div>
            {[["Email", done.loginUrl ? form.email : ""], ["Password", done.defaultPassword]].map(([k,v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between",
                padding:"5px 0", gap:12 }}>
                <span style={{ ...FF, fontSize:12, color:"rgba(255,255,255,0.45)" }}>{k}</span>
                <span style={{ ...MM, fontSize:13, color:"#fff", fontWeight:700,
                  wordBreak:"break-all", textAlign:"right" }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid rgba(99,102,241,0.25)",
              ...FF, fontSize:11, color:"#a5b4fc", lineHeight:1.6 }}>
              ⚠ Change your password after signing in. We also emailed these details to you.
            </div>
          </div>
        )}

        <a href={done.loginUrl} style={{ ...FF, display:"inline-block", padding:"13px 30px",
          borderRadius:11, background:"#4f46e5", color:"#fff", fontSize:15, fontWeight:700,
          textDecoration:"none", boxShadow:"0 4px 18px rgba(79,70,229,0.4)" }}>
          Sign in to your team →
        </a>
      </div>
    </Shell>
  );

  const h = data.hackathon || {};
  return (
    <Shell>
      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:26 }}>
        <div style={{ fontSize:46, marginBottom:14 }}>🚀</div>
        <div style={{ ...FF, fontSize:11, fontWeight:700, color:accent,
          letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10 }}>
          You've been invited
        </div>
        <h1 style={{ fontSize:26, fontWeight:900, color:"#fff",
          letterSpacing:"-0.03em", lineHeight:1.2, marginBottom:8 }}>
          Join {data.team.name}
        </h1>
        <p style={{ fontSize:14, color:"rgba(255,255,255,0.45)", lineHeight:1.65 }}>
          {data.invitedBy ? `${data.invitedBy} invited you to ` : "Join this team for "}
          <strong style={{ color:"rgba(255,255,255,0.75)" }}>{h.name}</strong>
        </p>
      </div>

      {/* Event details */}
      <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
        borderRadius:14, padding:"16px 20px", marginBottom:18 }}>
        {[
          ["Team",    data.team.name],
          ["Members", `${data.team.memberCount}${data.hackathon?.maxTeamSize ? ` / ${data.hackathon.maxTeamSize}` : ""}`],
          ["Event",   h.name],
          ["Starts",  h.startDate ? new Date(h.startDate).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}) : null],
          ["Where",   h.location],
          ["Prizes",  h.prizePool],
        ].filter(([,v]) => v).map(([k,v]) => (
          <div key={k} style={{ display:"flex", justifyContent:"space-between",
            padding:"6px 0", gap:14 }}>
            <span style={{ ...FF, fontSize:12, color:"rgba(255,255,255,0.4)", flexShrink:0 }}>{k}</span>
            <span style={{ ...FF, fontSize:13, color:"#fff", fontWeight:500, textAlign:"right" }}>{v}</span>
          </div>
        ))}
      </div>

      {data.isFull ? (
        <div style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)",
          borderRadius:12, padding:"16px 20px", textAlign:"center" }}>
          <div style={{ ...FF, fontSize:14, fontWeight:700, color:"#f87171", marginBottom:5 }}>
            This team is full
          </div>
          <div style={{ ...FF, fontSize:13, color:"rgba(255,255,255,0.45)", lineHeight:1.6 }}>
            The team has reached its maximum of {h.maxTeamSize} members.
            Ask the organizer or join a different team.
          </div>
        </div>
      ) : (
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:16, padding:24 }}>
          {err && (
            <div style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)",
              borderRadius:8, padding:"10px 13px", fontSize:13, color:"#f87171", marginBottom:14 }}>
              {err}
            </div>
          )}
          <form onSubmit={accept}>
            <div style={{ marginBottom:13 }}>
              <label style={{ ...FF, display:"block", fontSize:11, fontWeight:600,
                color:"rgba(255,255,255,0.45)", textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:5 }}>Your name</label>
              <input required autoFocus value={form.name}
                onChange={e=>setForm(p=>({...p,name:e.target.value}))}
                placeholder="Jane Smith" style={IS}
                onFocus={e=>e.target.style.borderColor=`${accent}aa`}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.15)"} />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ ...FF, display:"block", fontSize:11, fontWeight:600,
                color:"rgba(255,255,255,0.45)", textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:5 }}>Your email</label>
              <input required type="email" value={form.email}
                onChange={e=>setForm(p=>({...p,email:e.target.value}))}
                placeholder="jane@example.com" style={IS}
                onFocus={e=>e.target.style.borderColor=`${accent}aa`}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.15)"} />
            </div>
            <button type="submit" disabled={busy}
              style={{ ...FF, width:"100%", padding:"13px", borderRadius:11,
                fontSize:15, fontWeight:700, background:busy?"rgba(99,102,241,0.5)":accent,
                color:"#fff", border:"none", cursor:busy?"not-allowed":"pointer",
                boxShadow:`0 4px 18px ${accent}55` }}>
              {busy ? "Joining…" : "🚀 Join the team"}
            </button>
          </form>
        </div>
      )}

      <p style={{ textAlign:"center", marginTop:20, ...FF, fontSize:11,
        color:"rgba(255,255,255,0.2)" }}>
        Invitation code: <span style={{ ...MM, letterSpacing:"0.1em" }}>{code}</span>
      </p>
    </Shell>
  );
}
