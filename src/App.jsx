import { useState, useEffect, useCallback } from "react";
import {
  GET, POST, PGET, PPOST, fmtDate,
  C, FONT, MONO, R,
  Chip, Btn, INPUT_STYLE as IN, TA_STYLE as TA,
  Field, Avatar, Modal, Card, Spinner, Empty,
  useData, STATUS_CHIP,
} from "./shared.jsx";
import {
  DashboardPage, HackathonsPage, TeamsPage, JudgesPage, CriteriaPage,
  FeedbackPage, AllFeedbackPage, ReportPage,
  UserManagementPage, PublicPagesAdmin, PublicPageCMS,
} from "./pages.jsx";
import PublicPage from "./PublicPage.jsx";

/* ─── PUBLIC REGISTRATION PAGE ─────────────────────────────────────────── */
function PublicRegisterPage({ hackathonId }) {
  const [hack,setHack]=useState(null);const [loading,setLoading]=useState(true);
  const [err,setErr]=useState("");const [type,setType]=useState("team");
  const [form,setForm]=useState({});const [submitting,setSubmitting]=useState(false);const [done,setDone]=useState(false);
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  useEffect(()=>{ PGET(`/api/public/hackathons/${hackathonId}`).then(d=>{if(d.error)setErr(d.error);else setHack(d);setLoading(false);}).catch(()=>{setErr("Could not load hackathon.");setLoading(false);}); },[hackathonId]);
  const submit=async e=>{
    e.preventDefault();if(!form.name?.trim()||!form.email?.trim())return;setSubmitting(true);
    const res=await PPOST("/api/public/register",{...form,hackathonId,type});
    if(res.error)setErr(res.error);else setDone(true);setSubmitting(false);
  };
  if(loading)return <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh"}}><Spinner size={28}/></div>;
  if(err&&!hack)return <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",...FONT,color:C.red,fontSize:14}}>{err}</div>;
  const tracks=(hack?.tracks||"").split(",").map(t=>t.trim()).filter(Boolean);
  const TC=[["#dbeafe","#1e40af"],["#dcfce7","#15803d"],["#fef3c7","#92400e"],["#fae8ff","#6b21a8"],["#fce7f3","#9d174d"]];
  return(
    <div style={{minHeight:"100vh",background:"#f8fafc",...FONT}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0;}input:focus,textarea:focus{outline:none;box-shadow:0 0 0 2px #bfdbfe;border-color:#2563eb!important;}`}</style>
      {/* Hero */}
      <div style={{background:"linear-gradient(135deg,#0f172a 0%,#1e3a8a 60%,#0f172a 100%)",padding:"72px 24px 56px",textAlign:"center",color:"#fff",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 0%,rgba(59,130,246,0.15) 0%,transparent 70%)"}} />
        <div style={{position:"relative"}}>
          <div style={{display:"inline-block",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:9999,padding:"5px 16px",fontSize:12,fontWeight:500,letterSpacing:"0.1em",marginBottom:24,backdropFilter:"blur(4px)"}}>
            {hack?.status==="active"?"🟢 REGISTRATION OPEN":hack?.status==="upcoming"?"🔵 COMING SOON":"⚫ CLOSED"}
          </div>
          <h1 style={{fontSize:"clamp(28px,5vw,52px)",fontWeight:700,marginBottom:14,letterSpacing:"-0.02em",lineHeight:1.1}}>{hack?.name}</h1>
          {hack?.tagline&&<p style={{fontSize:"clamp(14px,2.5vw,20px)",opacity:0.65,maxWidth:560,margin:"0 auto 24px",lineHeight:1.6}}>{hack.tagline}</p>}
          <div style={{display:"flex",justifyContent:"center",gap:28,flexWrap:"wrap",fontSize:14,opacity:0.6,marginTop:8}}>
            {hack?.startDate&&<span>📅 {fmtDate(hack.startDate)} – {fmtDate(hack.endDate)}</span>}
            {hack?.location&&<span>📍 {hack.location}</span>}
            {hack?.prizePool&&<span>🏆 {hack.prizePool}</span>}
          </div>
        </div>
      </div>
      <div style={{maxWidth:920,margin:"0 auto",padding:"0 24px"}}>
        {tracks.length>0&&(
          <div style={{background:"#fff",borderRadius:R.lg,border:`1px solid ${C.border}`,padding:28,margin:"24px 0 0",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
            <h2 style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:14}}>Tracks</h2>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {tracks.map((t,i)=><span key={t} style={{padding:"6px 16px",borderRadius:9999,fontSize:13,fontWeight:500,background:TC[i%5][0],color:TC[i%5][1]}}>{t}</span>)}
            </div>
          </div>
        )}
        {hack?.description&&(
          <div style={{background:"#fff",borderRadius:R.lg,border:`1px solid ${C.border}`,padding:28,margin:"14px 0 0",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
            <h2 style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:10}}>About</h2>
            <p style={{fontSize:14,color:C.text2,lineHeight:1.75}}>{hack.description}</p>
          </div>
        )}
        <div style={{background:"#fff",borderRadius:R.lg,border:`1px solid ${C.border}`,padding:32,margin:"14px 0 56px",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
          {done?(
            <div style={{textAlign:"center",padding:"36px 0"}}>
              <div style={{fontSize:52,marginBottom:16}}>🎉</div>
              <h2 style={{fontSize:20,fontWeight:600,color:C.text,marginBottom:8}}>Registration Received!</h2>
              <p style={{fontSize:14,color:C.text3}}>We'll review your application and reach out at <strong style={{color:C.text}}>{form.email}</strong>.</p>
            </div>
          ):(
            <>
              <h2 style={{fontSize:16,fontWeight:600,color:C.text,marginBottom:4}}>Register to Participate</h2>
              <p style={{fontSize:13,color:C.text3,marginBottom:22}}>Submit your interest — we'll review and reach out with next steps.</p>
              <div style={{display:"flex",gap:2,marginBottom:22,background:C.bg2,borderRadius:R.sm,padding:3,border:`1px solid ${C.border}`}}>
                {["team","judge"].map(t=><button key={t} onClick={()=>setType(t)} style={{flex:1,padding:"7px 16px",fontSize:13,fontWeight:500,borderRadius:R.sm,border:"none",cursor:"pointer",background:type===t?"#fff":C.bg2,color:type===t?C.text:C.text3,transition:"all 0.1s",boxShadow:type===t?"0 1px 3px rgba(0,0,0,0.08)":"none",...FONT,textTransform:"capitalize"}}>Register as {t}</button>)}
              </div>
              {err&&<div style={{background:C.bgRed,border:`1px solid ${C.bdRed}`,borderRadius:R.sm,padding:"9px 12px",fontSize:12,color:C.red,marginBottom:14}}>⚠ {err}</div>}
              <form onSubmit={submit}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <Field label="Full Name" required><input style={IN} value={form.name||""} onChange={f("name")} placeholder="Your name" required /></Field>
                  <Field label="Email" required><input type="email" style={IN} value={form.email||""} onChange={f("email")} placeholder="you@example.com" required /></Field>
                </div>
                <Field label="Organization / University"><input style={IN} value={form.org||""} onChange={f("org")} placeholder="Optional" /></Field>
                {type==="team"&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <Field label="Team Name"><input style={IN} value={form.teamName||""} onChange={f("teamName")} placeholder="Team Awesome" /></Field>
                    <Field label="Team Size"><input type="number" min={1} max={10} style={IN} value={form.teamSize||""} onChange={f("teamSize")} placeholder="Number of members" /></Field>
                  </div>
                )}
                <Field label="Tell us about yourself / your project">
                  <textarea style={{...TA,minHeight:90}} value={form.message||""} onChange={f("message")} placeholder="Brief introduction — what are you building? What's your background?" />
                </Field>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:C.bg2,borderRadius:R.sm,border:`1px solid ${C.border}`,marginBottom:16}}>
                  <span style={{fontSize:12,color:C.text3}}>🔒 Your information is submitted securely and will only be used by the organizers.</span>
                </div>
                <button type="submit" disabled={submitting} style={{width:"100%",background:C.text,color:"#fff",border:"none",borderRadius:R.md,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",...FONT,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  {submitting&&<Spinner/>} Submit Registration
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── LOGIN ─────────────────────────────────────────────────────────────── */
const BASE = typeof window!=="undefined"&&["localhost","127.0.0.1"].includes(window.location.hostname) ? "http://localhost:3001" : "";

function OAuthBtn({ provider, icon, label }) {
  return (
    <a href={`${BASE}/api/auth/${provider}`} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"9px 0",borderRadius:R.sm,border:`1px solid ${C.border}`,background:C.bg,color:C.text,...FONT,fontSize:13,fontWeight:500,cursor:"pointer",textDecoration:"none",transition:"background 0.1s"}}
      onMouseEnter={e=>e.currentTarget.style.background=C.bg2}
      onMouseLeave={e=>e.currentTarget.style.background=C.bg}>
      <span style={{fontSize:16}}>{icon}</span>{label}
    </a>
  );
}

function LoginPage({ onLogin, oauthError }) {
  const [email,setEmail]=useState("");const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);const [err,setErr]=useState(oauthError||"");
  const submit=async e=>{
    e.preventDefault();setLoading(true);setErr("");
    try{const d=await POST("/api/auth/login",{email,password});localStorage.setItem("hf_token",d.token);onLogin(d.user);}
    catch(e){setErr(e.message);}setLoading(false);
  };
  return(
    <div style={{minHeight:"100vh",background:"#f9fafb",display:"flex",alignItems:"center",justifyContent:"center",padding:24,...FONT}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0;}input:focus{outline:none;box-shadow:0 0 0 2px #bfdbfe;border-color:#2563eb!important;}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{...MONO,fontSize:22,fontWeight:600,color:C.text,letterSpacing:"-0.02em",marginBottom:4}}>HackFest Hub</div>
          <div style={{fontSize:13,color:C.text3}}>Sign in to manage or judge</div>
        </div>
        <Card style={{boxShadow:"0 4px 24px rgba(0,0,0,0.07)"}}>
          {err&&<div style={{background:C.bgRed,border:`1px solid ${C.bdRed}`,borderRadius:R.sm,padding:"9px 12px",fontSize:12,color:C.red,marginBottom:16}}>⚠ {err}</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:18}}>
            <OAuthBtn provider="github" icon="🐙" label="GitHub" />
            <OAuthBtn provider="google" icon="G" label="Google" />
            <OAuthBtn provider="gitlab" icon="🦊" label="GitLab" />
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
            <div style={{flex:1,height:1,background:C.border}} />
            <span style={{fontSize:11,color:C.text3,whiteSpace:"nowrap"}}>or continue with email</span>
            <div style={{flex:1,height:1,background:C.border}} />
          </div>
          <form onSubmit={submit}>
            <Field label="Email"><input style={IN} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@hackfest.com" autoFocus /></Field>
            <Field label="Password"><input style={IN} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" /></Field>
            <Btn type="submit" full size="lg" disabled={loading}>{loading&&<Spinner/>} {loading?"Signing in...":"Sign in"}</Btn>
          </form>
          <div style={{marginTop:18,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
            <div style={{...FONT,fontSize:11,color:C.text3,marginBottom:4,fontWeight:500}}>Demo credentials</div>
            <div style={{...MONO,fontSize:11,color:C.text3,lineHeight:2}}>
              admin@hackfest.com / admin123<br/>
              srikanth@hackfest.com / judge123
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── ROOT APP ──────────────────────────────────────────────────────────── */
const ADMIN_NAV=[
  {id:"dashboard",  label:"Dashboard",      section:"overview"},
  {id:"hackathons", label:"Hackathons",      section:"overview"},
  {id:"teams",      label:"Teams",           section:"overview"},
  {id:"judges",     label:"Judges",          section:"overview"},
  {id:"criteria",   label:"Criteria",        section:"overview"},
  {id:"feedback",   label:"Submit Feedback", section:"judging"},
  {id:"all-feedback",label:"All Feedback",   section:"judging"},
  {id:"reports",    label:"Reports",         section:"judging"},
  {id:"users",      label:"User Management", section:"admin"},
  {id:"public-cms", label:"Page CMS",         section:"admin"},
  {id:"public",     label:"Registrations",   section:"admin"},
];
const JUDGE_EXTRA=[{id:"dashboard",label:"Dashboard"},{id:"reports",label:"Reports"},{id:"all-feedback",label:"All Feedback"},{id:"criteria",label:"Criteria"}];
function getJudgeNav(user){ const base=[{id:"feedback",label:"Submit Feedback",section:"judging"}]; const extras=(user.permissions||[]).map(p=>({id:p.page,label:JUDGE_EXTRA.find(x=>x.id===p.page)?.label||p.page,section:"judging"}));return[...base,...extras.filter(e=>!base.find(b=>b.id===e.id))]; }

// Wrapper that decides which top-level component to render
// Must be outside AppShell so hooks are never called conditionally
export default function App() {
  const regMatch = window.location.pathname.match(/^\/register\/([^/]+)/);
  if (regMatch) return <PublicPage hackathonId={regMatch[1]} />;
  return <AppShell />;
}

function AppShell() {
  // Handle OAuth token in URL — do this before reading localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get("token");
  const urlError = urlParams.get("error");
  if (urlToken || urlError) window.history.replaceState({}, "", "/");

  const [currentUser, setCurrentUser] = useState(() => {
    const t = urlToken || localStorage.getItem("hf_token");
    if (!t) return null;
    try {
      if (urlToken) localStorage.setItem("hf_token", urlToken);
      const p = JSON.parse(atob(t.split(".")[1]));
      return p.exp * 1000 > Date.now() ? p : (localStorage.removeItem("hf_token"), null);
    } catch { return null; }
  });
  const [page, setPage] = useState("dashboard");
  const [activeHackathon, setActive] = useState("");
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type="success") => {
    const id = Date.now().toString(36);
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const { db, busy, err, reload } = useData(!!currentUser);

  useEffect(() => {
    if (!activeHackathon && db.hackathons.length) {
      if (currentUser?.role === "judge") {
        const first = db.hackathons.find(h => (currentUser.assignedHackathons || []).includes(h.id));
        if (first) setActive(first.id);
      } else setActive(db.hackathons[0].id);
    }
  }, [db.hackathons]);

  const logout = () => { localStorage.removeItem("hf_token"); setCurrentUser(null); };

  // Reload data whenever user logs in
  useEffect(() => { if (currentUser) reload(); }, [currentUser]);

  if (!currentUser) return <LoginPage onLogin={u => { setCurrentUser(u); setPage(u.role==="admin"?"dashboard":"feedback"); }} oauthError={urlError?"OAuth sign-in failed. Please try again.":""} />;

  const isAdmin = currentUser.role === "admin";
  const navItems = isAdmin ? ADMIN_NAV : getJudgeNav(currentUser);
  const sections = [...new Set(navItems.map(n => n.section))];
  const sectionLabels = { overview:"Overview", judging:"Judging", admin:"Administration" };
  const visibleH = isAdmin ? db.hackathons : db.hackathons.filter(h => (currentUser.assignedHackathons || []).includes(h.id));
  const hack = db.hackathons.find(h => h.id === activeHackathon);
  const props = { db, reload, toast, activeHackathon };

  return (
    <div style={{ ...FONT, display:"flex", height:"100vh", background:C.bg2, color:C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        input,textarea,select,button{font-family:'Inter',-apple-system,sans-serif!important;}
        input:focus,textarea:focus,select:focus{border-color:#2563eb!important;outline:none;box-shadow:0 0 0 3px rgba(59,130,246,0.1);}
        input[type=range]{accent-color:#2563eb;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideBar{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
        @keyframes fadeUp{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}
        @media print{aside{display:none!important}}
      `}</style>

      {/* ── Sidebar ── */}
      <aside style={{ width:224, background:C.bg, display:"flex", flexDirection:"column", flexShrink:0, borderRight:`1px solid ${C.border}` }}>
        {/* Logo */}
        <div style={{ padding:"16px 16px 14px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ ...MONO, fontSize:14, fontWeight:600, color:C.text, letterSpacing:"-0.01em" }}>HackFest Hub</div>
          <div style={{ ...FONT, fontSize:11, color:C.text3, marginTop:2 }}>Feedback Management</div>
        </div>

        {/* Hackathon picker */}
        <div style={{ padding:"10px 10px 8px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ ...FONT, fontSize:10, fontWeight:500, color:C.text3, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5, paddingLeft:4 }}>Active Event</div>
          <select style={{ width:"100%", background:C.bg2, border:`1px solid ${C.border}`, borderRadius:R.sm, padding:"6px 8px", fontSize:12, color:C.text, cursor:"pointer", outline:"none" }}
            value={activeHackathon} onChange={e => setActive(e.target.value)}>
            {visibleH.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          {hack && (
            <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:5, paddingLeft:2 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background: hack.status==="active"?C.green:hack.status==="upcoming"?C.amber:C.text3 }} />
              <span style={{ ...FONT, fontSize:11, color:C.text3, textTransform:"capitalize" }}>{hack.status}</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:"auto", padding:"6px 8px" }}>
          {sections.map(sec => (
            <div key={sec}>
              {isAdmin && <div style={{ ...FONT, fontSize:10, fontWeight:500, color:C.text3, letterSpacing:"0.08em", textTransform:"uppercase", padding:"10px 8px 4px", marginTop:4 }}>{sectionLabels[sec]||sec}</div>}
              {navItems.filter(n => n.section === sec).map(item => {
                const active = page === item.id;
                return (
                  <button key={item.id} onClick={() => setPage(item.id)}
                    style={{ width:"100%", textAlign:"left", background:active?C.bg3:"transparent",
                      border:`1px solid ${active?C.border:"transparent"}`, borderRadius:R.sm,
                      padding:"6px 10px", fontSize:13, color:active?C.text:C.text3, cursor:"pointer",
                      display:"block", marginBottom:1, transition:"all 0.1s", ...FONT }}
                    onMouseEnter={e => { if (!active) e.target.style.background = C.bg2; }}
                    onMouseLeave={e => { if (!active) e.target.style.background = "transparent"; }}>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding:"10px 12px", borderTop:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:C.bgBlue, display:"flex", alignItems:"center", justifyContent:"center", ...MONO, fontSize:11, fontWeight:500, color:C.blue, flexShrink:0 }}>
              {(currentUser.name||"U").charAt(0).toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ ...FONT, fontSize:12, fontWeight:500, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{currentUser.name}</div>
              <div style={{ ...FONT, fontSize:10, color:C.text3, textTransform:"capitalize" }}>{currentUser.role}</div>
            </div>
            <button onClick={logout} title="Sign out"
              style={{ ...FONT, fontSize:12, color:C.text3, background:"none", border:"none", cursor:"pointer", padding:"2px 4px", borderRadius:4 }}>↩</button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex:1, overflowY:"auto", padding:"24px 28px", position:"relative" }}>
        {busy && <div style={{ position:"sticky", top:-24, left:0, right:0, height:2, background:C.border, overflow:"hidden", marginBottom:-2, zIndex:10 }}>
          <div style={{ height:"100%", width:"40%", background:C.blue, animation:"slideBar 1s ease infinite", borderRadius:2 }} />
        </div>}
        {err && <div style={{ ...FONT, background:C.bgRed, border:`1px solid ${C.bdRed}`, borderRadius:R.sm, padding:"9px 14px", fontSize:12, color:C.red, marginBottom:14, display:"flex", justifyContent:"space-between" }}>
          ⚠ API error: {err}
          <button onClick={reload} style={{ ...FONT, background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:12 }}>Retry</button>
        </div>}

        {page==="dashboard"    && <DashboardPage    {...props} />}
        {page==="hackathons"   && <HackathonsPage   {...props} setActive={setActive} setPage={setPage} />}
        {page==="teams"        && <TeamsPage        {...props} />}
        {page==="judges"       && <JudgesPage       {...props} />}
        {page==="criteria"     && <CriteriaPage     {...props} />}
        {page==="feedback"     && <FeedbackPage     {...props} currentUser={currentUser} />}
        {page==="all-feedback" && <AllFeedbackPage  {...props} currentUser={currentUser} />}
        {page==="reports"      && <ReportPage       {...props} />}
        {page==="users"        && isAdmin && <UserManagementPage {...props} />}
        {page==="public-cms"   && isAdmin && <PublicPageCMS    {...props} />}
        {page==="public"       && isAdmin && <PublicPagesAdmin  {...props} activeHackathon={activeHackathon} />}
      </main>

      {/* ── Toasts ── */}
      <div style={{ position:"fixed", bottom:20, right:20, display:"flex", flexDirection:"column", gap:6, zIndex:9999 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ ...FONT, background:t.type==="error"?C.bgRed:C.bgGreen, border:`1px solid ${t.type==="error"?C.bdRed:C.bdGreen}`, color:t.type==="error"?C.red:C.green, padding:"10px 16px", borderRadius:R.sm, fontSize:13, boxShadow:"0 4px 16px rgba(0,0,0,0.1)", animation:"fadeUp 0.2s ease", display:"flex", alignItems:"center", gap:6 }}>
            {t.type==="error"?"⚠":"✓"} {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
