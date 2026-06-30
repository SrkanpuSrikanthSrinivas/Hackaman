import { useState, useEffect } from "react";

const BASE = ["localhost","127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:3001" : "";

const FF = {fontFamily:"'Inter',sans-serif"};
const MM = {fontFamily:"'Space Mono',monospace"};

function fmt(d){ if(!d)return""; const s=d.length<=10?d+"T12:00:00":d; const dt=new Date(s); return isNaN(dt)?"":dt.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}); }
function fmtS(d){ if(!d)return""; const s=d.length<=10?d+"T12:00:00":d; const dt=new Date(s); return isNaN(dt)?"":dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
function ytId(url){ const m=url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/); return m?m[1]:null; }
function vimId(url){ const m=url?.match(/vimeo\.com\/(?:video\/)?(\d+)/); return m?m[1]:null; }
function initials(name){ return (name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }

const COLORS=["#6366f1","#8b5cf6","#ec4899","#06b6d4","#10b981","#f59e0b","#ef4444","#f97316"];
function avatarColor(name){ return COLORS[(name||"").charCodeAt(0)%COLORS.length]; }

// ── Countdown ────────────────────────────────────────────────────────────────
function Countdown({target}){
  const[t,setT]=useState({d:0,h:0,m:0,s:0});
  useEffect(()=>{
    function tick(){const diff=new Date(target)-Date.now();if(diff<=0){setT({d:0,h:0,m:0,s:0});return;}setT({d:Math.floor(diff/864e5),h:Math.floor(diff%864e5/36e5),m:Math.floor(diff%36e5/6e4),s:Math.floor(diff%6e4/1e3)});}
    tick(); const id=setInterval(tick,1000); return()=>clearInterval(id);
  },[target]);
  function Box({v,l}){return(
    <div style={{textAlign:"center"}}>
      <div style={{...MM,fontSize:"clamp(24px,4vw,48px)",fontWeight:700,color:"#fff",
        background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",
        borderRadius:10,padding:"10px 16px",minWidth:64,lineHeight:1}}>
        {String(v).padStart(2,"0")}
      </div>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:6,
        letterSpacing:"0.12em",textTransform:"uppercase"}}>{l}</div>
    </div>
  );}
  function Sep(){return <div style={{...MM,fontSize:28,color:"rgba(255,255,255,0.2)",paddingTop:8}}>:</div>;}
  return(
    <div style={{display:"flex",gap:8,alignItems:"flex-start",justifyContent:"center"}}>
      <Box v={t.d} l="Days"/><Sep/><Box v={t.h} l="Hours"/><Sep/>
      <Box v={t.m} l="Mins"/><Sep/><Box v={t.s} l="Secs"/>
    </div>
  );
}

// ── PersonCard ───────────────────────────────────────────────────────────────
function PersonCard({person,size}){
  const sz=size==="lg"?96:72;
  return(
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:14,padding:size==="lg"?24:18,textAlign:"center",transition:"transform 0.2s"}}
      onMouseEnter={e=>e.currentTarget.style.transform="translateY(-3px)"}
      onMouseLeave={e=>e.currentTarget.style.transform="none"}>
      <div style={{width:sz,height:sz,borderRadius:"50%",margin:"0 auto 12px",overflow:"hidden",
        border:"3px solid rgba(255,255,255,0.1)",
        background:person.avatarUrl?"transparent":avatarColor(person.name),
        display:"flex",alignItems:"center",justifyContent:"center"}}>
        {person.avatarUrl
          ?<img src={person.avatarUrl} alt={person.name} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"} />
          :<span style={{...MM,fontSize:sz*0.3,fontWeight:700,color:"#fff"}}>{initials(person.name)}</span>}
      </div>
      <div style={{...FF,fontSize:size==="lg"?15:13,fontWeight:600,color:"#fff",marginBottom:4}}>{person.name}</div>
      {person.title&&<div style={{...FF,fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:2}}>{person.title}</div>}
      {person.org&&<div style={{...FF,fontSize:12,color:"#818cf8",fontWeight:500,marginBottom:4}}>{person.org}</div>}
      {person.sessionTopic&&<div style={{...FF,fontSize:11,color:"rgba(255,255,255,0.35)",fontStyle:"italic",marginBottom:6}}>"{person.sessionTopic}"</div>}
      {person.bio&&<p style={{...FF,fontSize:11,color:"rgba(255,255,255,0.35)",lineHeight:1.6,marginBottom:6,textAlign:"left"}}>{person.bio.slice(0,120)}{person.bio.length>120?"…":""}</p>}
      {(person.linkedinUrl||person.twitterUrl)&&(
        <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:4}}>
          {person.linkedinUrl&&<a href={person.linkedinUrl} target="_blank" rel="noopener" style={{...FF,fontSize:11,color:"#818cf8",textDecoration:"none",padding:"2px 8px",border:"1px solid #818cf844",borderRadius:4}}>in</a>}
          {person.twitterUrl&&<a href={person.twitterUrl} target="_blank" rel="noopener" style={{...FF,fontSize:11,color:"#38bdf8",textDecoration:"none",padding:"2px 8px",border:"1px solid #38bdf844",borderRadius:4}}>𝕏</a>}
        </div>
      )}
    </div>
  );
}

// ── FAQItem ──────────────────────────────────────────────────────────────────
function FAQItem({q,a,accent}){
  const[open,setOpen]=useState(false);
  return(
    <div style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",textAlign:"left",background:"none",
        border:"none",cursor:"pointer",padding:"16px 0",display:"flex",
        justifyContent:"space-between",alignItems:"center",gap:16,...FF}}>
        <span style={{fontSize:15,fontWeight:600,color:"#fff"}}>{q}</span>
        <span style={{fontSize:22,color:accent,transition:"transform 0.2s",flexShrink:0,
          transform:open?"rotate(45deg)":"none"}}>+</span>
      </button>
      {open&&<div style={{...FF,fontSize:14,color:"rgba(255,255,255,0.5)",paddingBottom:16,lineHeight:1.75}}>{a}</div>}
    </div>
  );
}

// ── RegistrationForm ─────────────────────────────────────────────────────────
function RegForm({hackathonId,accent,deadline}){
  const[type,setType]=useState("team");
  const[form,setForm]=useState({});
  const[busy,setBusy]=useState(false);
  const[done,setDone]=useState(false);
  const[err,setErr]=useState("");
  function sf(k){return e=>setForm(p=>({...p,[k]:e.target.value}));}
  const IS={...FF,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
    borderRadius:8,padding:"10px 14px",fontSize:14,color:"#fff",width:"100%",outline:"none"};
  async function submit(e){
    e.preventDefault(); if(!form.name?.trim()||!form.email?.trim())return;
    setBusy(true); setErr("");
    try{
      const r=await fetch(`${BASE}/api/public/register`,{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...form,hackathonId,type})}).then(r=>r.json());
      if(r.error)setErr(r.error); else setDone(true);
    }catch(e){setErr(e.message);}
    setBusy(false);
  }
  // Check if deadline has passed
  const deadlinePassed = deadline && (() => {
    const d = new Date(deadline);
    return !isNaN(d) && d < new Date();
  })();

  if(done)return(
    <div style={{textAlign:"center",padding:"48px 0"}}>
      <div style={{fontSize:52,marginBottom:12}}>🎉</div>
      <div style={{...FF,fontSize:20,fontWeight:700,color:"#fff",marginBottom:8}}>Application Received!</div>
      <div style={{...FF,fontSize:14,color:"rgba(255,255,255,0.5)"}}>We'll be in touch at <strong style={{color:"#fff"}}>{form.email}</strong> soon.</div>
    </div>
  );

  if(deadlinePassed)return(
    <div style={{textAlign:"center",padding:"40px 0"}}>
      <div style={{fontSize:44,marginBottom:12}}>🔒</div>
      <div style={{...FF,fontSize:18,fontWeight:700,color:"#fff",marginBottom:8}}>Registration Closed</div>
      <div style={{...FF,fontSize:14,color:"rgba(255,255,255,0.4)",lineHeight:1.6}}>
        The registration deadline has passed.<br/>
        Contact us at {hackathonId} for late applications.
      </div>
    </div>
  );

  return(
    <>
      {deadline&&(
        <div style={{...FF,textAlign:"center",fontSize:13,marginBottom:16,
          padding:"10px 16px",borderRadius:8,
          background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.25)"}}>
          ⏳ Registration closes: <strong style={{color:accent}}>{deadline}</strong>
        </div>
      )}
      <div style={{display:"flex",gap:2,marginBottom:20,background:"rgba(255,255,255,0.05)",
        borderRadius:10,padding:3,border:"1px solid rgba(255,255,255,0.08)"}}>
        {["team","judge"].map(t=>(
          <button key={t} onClick={()=>setType(t)} style={{flex:1,padding:"8px",fontSize:13,
            fontWeight:600,borderRadius:7,border:"none",cursor:"pointer",...FF,
            background:type===t?accent:"transparent",
            color:type===t?"#fff":"rgba(255,255,255,0.4)"}}>
            {t==="team"?"🚀 Register as Team":"⭐ Apply as Judge"}
          </button>
        ))}
      </div>
      {err&&<div style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",
        borderRadius:8,padding:"10px 14px",fontSize:13,color:"#f87171",marginBottom:12}}>⚠ {err}</div>}
      <form onSubmit={submit}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <div style={{...FF,fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Full Name *</div>
            <input style={IS} value={form.name||""} onChange={sf("name")} required
              onFocus={e=>e.target.style.borderColor=accent}
              onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"} />
          </div>
          <div>
            <div style={{...FF,fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Email *</div>
            <input type="email" style={IS} value={form.email||""} onChange={sf("email")} required
              onFocus={e=>e.target.style.borderColor=accent}
              onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"} />
          </div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{...FF,fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Organization</div>
          <input style={IS} value={form.org||""} onChange={sf("org")} placeholder="Optional"
            onFocus={e=>e.target.style.borderColor=accent}
            onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"} />
        </div>
        {type==="team"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <div style={{...FF,fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Team Name</div>
              <input style={IS} value={form.teamName||""} onChange={sf("teamName")}
                onFocus={e=>e.target.style.borderColor=accent}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"} />
            </div>
            <div>
              <div style={{...FF,fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Team Size</div>
              <input type="number" min={1} max={10} style={IS} value={form.teamSize||""}
                onChange={sf("teamSize")}
                onFocus={e=>e.target.style.borderColor=accent}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"} />
            </div>
          </div>
        )}
        <div style={{marginBottom:16}}>
          <div style={{...FF,fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>
            {type==="team"?"Project Idea":"Expertise & Experience"}
          </div>
          <textarea style={{...IS,resize:"vertical",minHeight:72}} value={form.message||""}
            onChange={sf("message")}
            onFocus={e=>e.target.style.borderColor=accent}
            onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"} />
        </div>
        <button type="submit" disabled={busy} style={{...FF,width:"100%",background:accent,
          color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:15,
          fontWeight:700,cursor:"pointer",opacity:busy?0.7:1}}>
          {busy?"Submitting…":type==="team"?"Submit Team Application →":"Submit Judge Application →"}
        </button>
      </form>
    </>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
// ── SEO utility (not a hook — called inside data-fetch effect) ──────────────
function injectSEO(data, hackathonId) {
  if(!data || typeof document==="undefined") return;
  const SITE = window.location.origin;
  const url  = `${SITE}/register/${hackathonId}`;
  const desc = data.tagline || data.description || `Join ${data.name} — an exciting hackathon`;
  const img  = data.eventLogoUrl || `${SITE}/og-default.png`;
  document.title = `${data.name} | HackFest Hub`;
  const sm = (name, val, prop) => {
    const attr = prop ? "property" : "name";
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if(!el){ el=document.createElement("meta"); el.setAttribute(attr,name); document.head.appendChild(el); }
    el.setAttribute("content", val);
  };
  sm("description", desc);
  sm("og:title", data.name, true);
  sm("og:description", desc, true);
  sm("og:image", img, true);
  sm("og:url", url, true);
  sm("og:type", "event", true);
  sm("twitter:card", "summary_large_image");
  sm("twitter:title", data.name);
  sm("twitter:description", desc);
  sm("twitter:image", img);
  // JSON-LD schema
  const old = document.getElementById("event-schema");
  if(old) old.remove();
  const loc = data.location
    ? { "@type":"Place","name":data.location,"address":{"@type":"PostalAddress","addressLocality":data.location}}
    : { "@type":"VirtualLocation","url":url };
  const schema = {
    "@context":"https://schema.org","@type":"Event",
    "name":data.name,"description":desc,"url":url,
    "startDate":data.startDate||new Date().toISOString(),
    "endDate":data.endDate||data.startDate||new Date().toISOString(),
    "eventStatus":"https://schema.org/EventScheduled",
    "eventAttendanceMode":data.location?"https://schema.org/OfflineEventAttendanceMode":"https://schema.org/OnlineEventAttendanceMode",
    "location":loc,"image":[img],
    "organizer":{"@type":"Organization","name":"HackFest Hub","url":SITE},
    "offers":{"@type":"Offer","url":url,"price":"0","priceCurrency":"USD",
      "availability":data.status==="active"?"https://schema.org/InStock":"https://schema.org/PreOrder"},
  };
  if(data.prizePool) schema["award"]=data.prizePool;
  if(data.maxParticipants) schema["maximumAttendeeCapacity"]=data.maxParticipants;
  const el=document.createElement("script");
  el.id="event-schema"; el.type="application/ld+json";
  el.text=JSON.stringify(schema); document.head.appendChild(el);
}

export default function PublicPage({hackathonId}){
  const[data,setData]=useState(null);
  const[loading,setLoading]=useState(true);
  const[err,setErr]=useState("");
  const[spotsTaken,setSpotsTaken]=useState(0);

  useEffect(()=>{
    fetch(`${BASE}/api/public/hackathons/${hackathonId}/registrations-count`)
      .then(r=>r.json()).then(d=>setSpotsTaken(d.count||0)).catch(()=>{});
  },[hackathonId]);


  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const isPreview=params.get("preview")==="1";
    const token=params.get("token");
    const url=isPreview
      ?`${BASE}/api/pubpage/preview/${hackathonId}`
      :`${BASE}/api/pubpage/${hackathonId}`;
    const opts=isPreview&&token?{headers:{Authorization:`Bearer ${token}`}}:{};
    fetch(url,opts)
      .then(async r=>{
        const d=await r.json();
        if(!r.ok||d.error){setErr(d.error||`Server error ${r.status}`);}
        else{setData(d);}
        if(isPreview)window.history.replaceState({},"",window.location.pathname);
        setLoading(false);
      })
      .catch(e=>{setErr(e.message);setLoading(false);});
  },[hackathonId]);

  if(loading)return(
    <div style={{minHeight:"100vh",background:"#070b14",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:40,height:40,border:"3px solid rgba(255,255,255,0.1)",
        borderTopColor:"#6366f1",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );

  if(err)return(
    <div style={{minHeight:"100vh",background:"#070b14",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",color:"#fff",...FF,padding:24,textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:16}}>🔒</div>
      <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>Page Not Available</div>
      <div style={{fontSize:14,color:"rgba(255,255,255,0.5)",maxWidth:400,lineHeight:1.6,marginBottom:16}}>{err}</div>
      <div style={{fontSize:12,color:"rgba(255,255,255,0.25)"}}>ID: {hackathonId} · <a href="/" style={{color:"rgba(255,255,255,0.4)"}}>Admin</a></div>
    </div>
  );

  // Derive event status from data + dates
  const now = new Date();
  const startDate = data.startDate ? new Date(data.startDate) : null;
  const endDate   = data.endDate   ? new Date(data.endDate)   : null;
  const regDeadline = data.registrationDeadline ? new Date(data.registrationDeadline) : null;

  const isCompleted = data.status === "completed" || (endDate && endDate < now);
  const isUpcoming  = data.status === "upcoming"  || (startDate && startDate > now);
  const regClosed   = regDeadline ? regDeadline < now : isCompleted;

  const accent=data.bannerColor||"#6366f1";
  const tracks=(data.tracks||"").split(",").map(t=>t.trim()).filter(Boolean);
  const faqRaw=(data.faq||"").split("\n\n").filter(Boolean);
  const faqs=faqRaw.map(b=>{const[q,...rest]=b.split("\n");return{q:(q||"").replace(/^Q:\s*/i,""),a:rest.join("\n").replace(/^A:\s*/i,"")};}).filter(f=>f.q);
  const byTier={}; (data.partners||[]).forEach(p=>(byTier[p.tier]||(byTier[p.tier]=[])).push(p));
  const TIER_ORDER=["platinum","gold","silver","bronze","media","general"];
  const TIER_LABEL={platinum:"Platinum",gold:"Gold",silver:"Silver",bronze:"Bronze",media:"Media Partner",general:"Community Partner"};
  const spotsTotal = data.maxParticipants || 0;

  const statsItems=(data.websiteStats||"").split("\n").filter(Boolean).map(l=>{const[icon,value,...rest]=l.split("|");return{icon:(icon||"").trim(),value:(value||"").trim(),label:rest.join("|").trim()};}).filter(s=>s.value);
  const galleryImages=(data.galleryImages||"").split("\n").map(s=>s.trim()).filter(Boolean);
  const NLNL="\n\n"; const testimonials=(data.websiteTestimonials||"").split(NLNL).filter(Boolean).map(b=>{const lines=b.split("\n");return{quote:lines[0]||"",author:lines[1]||"",role:lines[2]||""};}).filter(t=>t.quote);
  const isPreviewMode=new URLSearchParams(window.location.search).get("preview")==="1";

  function scrollTo(id){document.getElementById(id)?.scrollIntoView({behavior:"smooth"});}

  const TRACK_ICONS=["🤖","🌱","🔐","🌍","📚","💳","❤️","🛠️","🔓","⚡","🚀","🎨"];
  const TRACK_COLORS=["#6366f1","#10b981","#f59e0b","#ec4899","#06b6d4","#8b5cf6","#ef4444","#f97316","#84cc16","#eab308","#3b82f6","#e11d48"];

  return(
    <div style={{...FF,background:"#070b14",color:"#fff",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;scroll-padding-top:68px;}
        ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:#070b14;} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
        input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.2);}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>

      {/* Preview banner */}
      {isPreviewMode&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:999,
          background:"#d97706",color:"#fff",textAlign:"center",
          padding:"10px 16px",...FF,fontSize:13,fontWeight:600}}>
          👁 Preview Mode — not yet published publicly
        </div>
      )}

      {/* ── NAV ── */}
      <Nav accent={accent} data={data} scrollTo={scrollTo}
        tracks={tracks} galleryImages={galleryImages}
        onRegister={()=>scrollTo("register")} />

      {/* ── HERO ── */}
      <section style={{minHeight:"100vh",display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",textAlign:"center",
        padding:"100px 24px 60px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,#070b14 0%,${accent}22 50%,#070b14 100%)`}}/>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 50% at 50% -5%,rgba(99,102,241,0.15) 0%,transparent 70%)"}}/>
        <div style={{position:"absolute",inset:0,opacity:0.025,backgroundImage:"linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)",backgroundSize:"60px 60px"}}/>
        <div style={{position:"relative",zIndex:1,maxWidth:860,animation:"fadeUp 0.8s ease both"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.07)",
            border:"1px solid rgba(255,255,255,0.12)",borderRadius:9999,
            padding:"5px 16px",fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.7)",
            letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:24}}>
            <span style={{width:6,height:6,borderRadius:"50%",
              background: isCompleted?"#10b981": regClosed?"#f59e0b": accent,
              animation:"pulse 2s infinite",display:"inline-block"}}/>
            {isCompleted?"Event Concluded Successfully ✓": regClosed?"Registration Closed": isUpcoming?"Coming Soon":"Registration Open"}
          </div>
          {data.eventLogoUrl&&<div style={{marginBottom:16}}><img src={data.eventLogoUrl} alt={data.name} style={{maxHeight:72,maxWidth:280,objectFit:"contain"}} /></div>}
          <h1 style={{fontSize:"clamp(32px,6.5vw,76px)",fontWeight:800,lineHeight:1.05,
            letterSpacing:"-0.03em",marginBottom:16,
            background:"linear-gradient(135deg,#fff 0%,rgba(255,255,255,0.6) 100%)",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            {data.name}
          </h1>
          {data.tagline&&<p style={{fontSize:"clamp(14px,2vw,20px)",color:"rgba(255,255,255,0.5)",
            marginBottom:32,lineHeight:1.7,maxWidth:560,margin:"0 auto 32px"}}>{data.tagline}</p>}
          <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",marginBottom:40}}>
            {data.startDate&&<span style={{display:"inline-flex",alignItems:"center",padding:"7px 16px",fontSize:13,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:9999,color:"rgba(255,255,255,0.75)"}}>📅 {fmtS(data.startDate)}{data.endDate?` – ${fmtS(data.endDate)}`:""}</span>}
            {data.location&&<span style={{display:"inline-flex",alignItems:"center",padding:"7px 16px",fontSize:13,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:9999,color:"rgba(255,255,255,0.75)"}}>📍 {data.location}</span>}
            {data.prizePool&&<span style={{display:"inline-flex",alignItems:"center",padding:"7px 16px",fontSize:13,background:`${accent}22`,border:`1px solid ${accent}55`,borderRadius:9999,color:accent}}>🏆 {data.prizePool}</span>}
            {data.registrationDeadline&&!regClosed&&!isCompleted&&<span style={{display:"inline-flex",alignItems:"center",padding:"7px 16px",fontSize:13,background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.35)",borderRadius:9999,color:"#fbbf24"}}>⏳ Deadline: {data.registrationDeadline}</span>}
            {regClosed&&!isCompleted&&<span style={{display:"inline-flex",alignItems:"center",padding:"7px 16px",fontSize:13,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:9999,color:"#f87171"}}>🔒 Registration Closed</span>}
          </div>
          {/* Countdown — adapts to event state */}
          {isCompleted ? (
            <div style={{marginBottom:36,padding:"20px 32px",
              background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",
              borderRadius:16,display:"inline-block"}}>
              <div style={{fontSize:32,marginBottom:8}}>🎊</div>
              <div style={{...FF,fontSize:16,fontWeight:700,color:"#10b981",marginBottom:4}}>Event Completed Successfully!</div>
              <div style={{...FF,fontSize:13,color:"rgba(255,255,255,0.45)"}}>
                {startDate&&endDate?`${fmtS(startDate)} – ${fmtS(endDate)}`:startDate?`Held on ${fmt(startDate)}`:""}
              </div>
            </div>
          ) : isUpcoming && startDate ? (
            <div style={{marginBottom:40}}>
              <div style={{...MM,fontSize:10,color:"rgba(255,255,255,0.25)",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:16}}>Event starts in</div>
              <Countdown target={data.startDate}/>
            </div>
          ) : regDeadline && !regClosed ? (
            <div style={{marginBottom:40}}>
              <div style={{...MM,fontSize:10,color:"rgba(255,255,255,0.25)",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:16}}>Registration closes in</div>
              <Countdown target={data.registrationDeadline}/>
            </div>
          ) : startDate && startDate > now ? (
            <div style={{marginBottom:40}}>
              <div style={{...MM,fontSize:10,color:"rgba(255,255,255,0.25)",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:16}}>Event starts in</div>
              <Countdown target={data.startDate}/>
            </div>
          ) : null}
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>scrollTo("register")} style={{...FF,background:accent,color:"#fff",
              border:"none",borderRadius:10,padding:"13px 32px",fontSize:15,fontWeight:700,
              cursor:"pointer",boxShadow:`0 8px 28px ${accent}55`}}>
              Register Now →
            </button>
            <button onClick={()=>scrollTo("about")} style={{...FF,background:"rgba(255,255,255,0.07)",
              color:"rgba(255,255,255,0.8)",border:"1px solid rgba(255,255,255,0.12)",
              borderRadius:10,padding:"13px 24px",fontSize:15,fontWeight:600,cursor:"pointer"}}>
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      {statsItems.length>0&&(
        <div style={{background:`${accent}0d`,borderTop:`1px solid ${accent}22`,borderBottom:`1px solid ${accent}22`,padding:"24px"}}>
          <div style={{maxWidth:1100,margin:"0 auto",display:"grid",
            gridTemplateColumns:`repeat(${Math.min(statsItems.length,5)},1fr)`,gap:8}}>
            {statsItems.map((s,i)=>(
              <div key={i} style={{textAlign:"center",padding:"16px 8px"}}>
                <div style={{fontSize:24,marginBottom:6}}>{s.icon}</div>
                <div style={{...MM,fontSize:"clamp(22px,3vw,36px)",fontWeight:700,color:"#fff",lineHeight:1,marginBottom:4}}>{s.value}</div>
                <div style={{...FF,fontSize:12,color:"rgba(255,255,255,0.4)"}}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ABOUT ── */}
      <section id="about" style={{padding:"80px 24px",background:"#06091a"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <SecHead eyebrow="About the Event" title={data.name} accent={accent}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:56,alignItems:"start"}}>
            <div>
              <p style={{...FF,fontSize:15,color:"rgba(255,255,255,0.55)",lineHeight:1.85,marginBottom:24}}>{data.websiteAbout||data.description||"Details coming soon."}</p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[["📅","Date",data.startDate?`${fmt(data.startDate)}${data.endDate?" – "+fmt(data.endDate):""}`:null],
                  ["📍","Location",data.location],["🏆","Prize Pool",data.prizePool],
                  ["📩","Contact",data.contactEmail]].filter(([,,v])=>v).map(([ic,lb,vl])=>(
                  <div key={lb} style={{display:"flex",gap:12,alignItems:"center"}}>
                    <span style={{fontSize:15}}>{ic}</span>
                    <span style={{...FF,fontSize:12,color:"rgba(255,255,255,0.3)",minWidth:64}}>{lb}</span>
                    <span style={{...FF,fontSize:14,color:"rgba(255,255,255,0.8)",fontWeight:500}}>{vl}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["🚀","Innovation","Push beyond the obvious and think differently"],
                ["🤝","Community","Collaborate with brilliant minds worldwide"],
                ["🎓","Mentorship","Learn from industry experts in real time"],
                ["🌍","Impact","Build solutions that matter to real people"]].map(([ic,t,d])=>(
                <div key={t} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:18}}>
                  <div style={{fontSize:24,marginBottom:8}}>{ic}</div>
                  <div style={{...FF,fontSize:13,fontWeight:600,color:"#fff",marginBottom:5}}>{t}</div>
                  <div style={{...FF,fontSize:11,color:"rgba(255,255,255,0.4)",lineHeight:1.6}}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── VIDEO ── */}
      {data.promoVideoUrl&&(()=>{
        const yt=ytId(data.promoVideoUrl); const vi=vimId(data.promoVideoUrl);
        const src=yt?`https://www.youtube.com/embed/${yt}?rel=0`:vi?`https://player.vimeo.com/video/${vi}`:null;
        return src?(
          <section style={{padding:"80px 24px",background:"#0a0d1a"}}>
            <div style={{maxWidth:1100,margin:"0 auto"}}>
              <SecHead eyebrow="Watch" title="Event Highlights" accent={accent}/>
              <div style={{maxWidth:800,margin:"0 auto",position:"relative",paddingTop:"56.25%",
                borderRadius:14,overflow:"hidden",border:"1px solid rgba(255,255,255,0.08)"}}>
                <iframe src={src} style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}}
                  allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"
                  allowFullScreen title="Event Video"/>
              </div>
            </div>
          </section>
        ):null;
      })()}

      {/* ── TRACKS ── */}
      {tracks.length>0&&(
        <section id="tracks" style={{padding:"80px 24px",background:"#06091a"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <SecHead eyebrow="Challenge Areas" title="Hackathon Tracks" accent={accent} sub="Choose your domain and build something the world needs."/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
              {tracks.map((t,i)=>(
                <div key={t} style={{background:`${TRACK_COLORS[i%TRACK_COLORS.length]}14`,
                  border:`1px solid ${TRACK_COLORS[i%TRACK_COLORS.length]}33`,
                  borderRadius:12,padding:"20px 16px",textAlign:"center",transition:"transform 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="none"}>
                  <div style={{fontSize:32,marginBottom:10}}>{TRACK_ICONS[i%TRACK_ICONS.length]}</div>
                  <div style={{...FF,fontSize:13,fontWeight:600,color:TRACK_COLORS[i%TRACK_COLORS.length]}}>{t}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── SCHEDULE ── */}
      {data.schedule&&(
        <section id="schedule" style={{padding:"80px 24px",background:"#0a0d1a"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <SecHead eyebrow="Agenda" title="Event Schedule" accent={accent}/>
            <div style={{maxWidth:680,margin:"0 auto"}}>
              {(data.schedule||"").split("\n").filter(Boolean).map((line,i)=>{
                if(!line.includes("|"))return(
                  <div key={i} style={{...MM,fontSize:11,color:accent,letterSpacing:"0.15em",
                    textTransform:"uppercase",marginTop:i>0?28:0,marginBottom:12,
                    paddingBottom:8,borderBottom:`1px solid ${accent}33`}}>{line}</div>
                );
                const[time,...rest]=line.split("|");
                return(
                  <div key={i} style={{display:"flex",gap:18,marginBottom:14,alignItems:"flex-start"}}>
                    <div style={{...MM,fontSize:11,color:"rgba(255,255,255,0.3)",minWidth:76,flexShrink:0,paddingTop:2}}>{time.trim()}</div>
                    <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:accent,flexShrink:0,marginTop:4}}/>
                      <div style={{...FF,fontSize:14,color:"rgba(255,255,255,0.8)",lineHeight:1.5}}>{rest.join("|").trim()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── KEYNOTES ── */}
      {(data.keynotes||[]).length>0&&(
        <section id="keynotes" style={{padding:"80px 24px",background:"#06091a"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <SecHead eyebrow="Keynote Speakers" title="Visionaries Taking the Stage" accent={accent}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:14}}>
              {data.keynotes.map(k=><PersonCard key={k.id} person={k} size="lg"/>)}
            </div>
          </div>
        </section>
      )}

      {/* ── SESSION CHAIRS ── */}
      {(data.sessionChairs||[]).length>0&&(
        <section id="chairs" style={{padding:"80px 24px",background:"#0a0d1a"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <SecHead eyebrow="Session Chairs" title="Guiding the Conversation" accent={accent}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:12}}>
              {data.sessionChairs.map(s=><PersonCard key={s.id} person={s}/>)}
            </div>
          </div>
        </section>
      )}

      {/* ── JUDGES ── */}
      {(data.judges||[]).length>0&&(
        <section id="judges" style={{padding:"80px 24px",background:"#06091a"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <SecHead eyebrow="Evaluation Panel" title="Meet the Judges" accent={accent}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:12}}>
              {data.judges.map(j=><PersonCard key={j.id} person={j}/>)}
            </div>
          </div>
        </section>
      )}

      {/* ── BEST JUDGE ── */}
      {data.bestJudge&&(
        <section id="best-judge" style={{padding:"60px 24px",background:`${accent}0a`,
          borderTop:`1px solid ${accent}22`,borderBottom:`1px solid ${accent}22`}}>
          <div style={{maxWidth:640,margin:"0 auto",textAlign:"center"}}>
            <div style={{...MM,fontSize:10,color:"#f59e0b",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:16}}>🏆 Best Judge Award</div>
            <div style={{background:"rgba(245,158,11,0.1)",border:"2px solid rgba(245,158,11,0.3)",borderRadius:18,padding:"32px 28px"}}>
              <div style={{width:100,height:100,borderRadius:"50%",margin:"0 auto 16px",overflow:"hidden",
                border:"4px solid rgba(245,158,11,0.4)",
                background:data.bestJudge.avatarUrl?"transparent":avatarColor(data.bestJudge.name),
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:"0 0 32px rgba(245,158,11,0.3)"}}>
                {data.bestJudge.avatarUrl
                  ?<img src={data.bestJudge.avatarUrl} alt={data.bestJudge.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  :<span style={{...MM,fontSize:30,fontWeight:700,color:"#fff"}}>{initials(data.bestJudge.name)}</span>}
              </div>
              <div style={{...FF,fontSize:22,fontWeight:800,color:"#fff",marginBottom:4}}>{data.bestJudge.name}</div>
              <div style={{...FF,fontSize:14,color:"#fbbf24",marginBottom:2}}>{data.bestJudge.title}</div>
              <div style={{...FF,fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:16}}>{data.bestJudge.org}</div>
              {data.bestJudgeNote&&<div style={{...FF,fontSize:14,color:"rgba(255,255,255,0.65)",fontStyle:"italic",lineHeight:1.7}}>"{data.bestJudgeNote}"</div>}
            </div>
          </div>
        </section>
      )}

      {/* ── TEAM ── */}
      {(data.team||[]).length>0&&(
        <section id="team" style={{padding:"80px 24px",background:"#0a0d1a"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <SecHead eyebrow="Organizing Committee" title="Meet the Team" accent={accent}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:12}}>
              {data.team.map(m=><PersonCard key={m.id} person={m}/>)}
            </div>
          </div>
        </section>
      )}

      {/* ── PARTNERS ── */}
      {TIER_ORDER.filter(t=>byTier[t]).length>0&&(
        <section id="partners" style={{padding:"80px 24px",background:"#06091a"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <SecHead eyebrow="Sponsors & Partners" title="Who Makes This Possible" accent={accent}/>
            {TIER_ORDER.filter(t=>byTier[t]).map(tier=>(
              <div key={tier} style={{marginBottom:36}}>
                <div style={{...MM,fontSize:9,color:accent,letterSpacing:"0.2em",textTransform:"uppercase",textAlign:"center",marginBottom:16}}>{TIER_LABEL[tier]}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:12,justifyContent:"center",alignItems:"center"}}>
                  {byTier[tier].map(p=>(
                    <a key={p.id} href={p.websiteUrl||"#"} target="_blank" rel="noopener"
                      style={{display:"flex",alignItems:"center",justifyContent:"center",
                        background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",
                        borderRadius:10,padding:"14px 20px",textDecoration:"none",minWidth:100,minHeight:60,transition:"all 0.2s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.09)"}
                      onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}>
                      {p.logoUrl
                        ?<img src={p.logoUrl} alt={p.name} style={{maxHeight:36,maxWidth:120,objectFit:"contain",filter:"brightness(0) invert(1)",opacity:0.75}}/>
                        :<span style={{...FF,fontSize:14,fontWeight:600,color:"rgba(255,255,255,0.6)"}}>{p.name}</span>}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── COMMUNITY HUB ── */}
      {(data.discordUrl||data.whatsappGroupUrl||data.slackUrl)&&(
        <section style={{padding:"48px 24px",background:`${accent}08`,borderTop:`1px solid ${accent}20`}}>
          <div style={{maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
            <div style={{...MM,fontSize:10,color:accent,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:14}}>Community</div>
            <h2 style={{...FF,fontSize:24,fontWeight:700,color:"#fff",marginBottom:8}}>Join the Conversation</h2>
            <p style={{...FF,fontSize:14,color:"rgba(255,255,255,0.45)",marginBottom:24}}>Connect with other participants before, during, and after the event</p>
            <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
              {data.discordUrl&&<a href={data.discordUrl} target="_blank" rel="noopener"
                style={{...FF,display:"inline-flex",alignItems:"center",gap:8,padding:"12px 24px",
                  borderRadius:12,background:"rgba(88,101,242,0.2)",border:"1px solid rgba(88,101,242,0.4)",
                  color:"#7289da",fontWeight:700,fontSize:14,textDecoration:"none"}}>
                🎮 Join Discord
              </a>}
              {data.whatsappGroupUrl&&<a href={data.whatsappGroupUrl} target="_blank" rel="noopener"
                style={{...FF,display:"inline-flex",alignItems:"center",gap:8,padding:"12px 24px",
                  borderRadius:12,background:"rgba(37,211,102,0.2)",border:"1px solid rgba(37,211,102,0.4)",
                  color:"#25d366",fontWeight:700,fontSize:14,textDecoration:"none"}}>
                💬 WhatsApp Group
              </a>}
              {data.slackUrl&&<a href={data.slackUrl} target="_blank" rel="noopener"
                style={{...FF,display:"inline-flex",alignItems:"center",gap:8,padding:"12px 24px",
                  borderRadius:12,background:"rgba(74,21,75,0.2)",border:"1px solid rgba(74,21,75,0.4)",
                  color:"#e01e5a",fontWeight:700,fontSize:14,textDecoration:"none"}}>
                💼 Slack Channel
              </a>}
            </div>
          </div>
        </section>
      )}

      {/* ── PROBLEM STATEMENTS ── */}
      {data.problemStatements&&(()=>{
        const NL="\n";
        let problems=[];
        try{problems=JSON.parse(data.problemStatements);}catch(_){
          problems=(data.problemStatements||"").split(NL).filter(Boolean).map((b,i)=>{
            const parts=b.split(NL);
            const title=parts[0]||"";
            const description=parts.slice(1).join(NL);
            return{id:i,title,description};
          });
        }
        if(!problems.length)return null;
        return(
          <section id="problems" style={{padding:"80px 24px",background:"#06091a"}}>
            <div style={{maxWidth:1100,margin:"0 auto"}}>
              <SecHead eyebrow="Challenge Briefs" title="Problem Statements" accent={accent}
                sub="Pick one of these real-world challenges to solve during the hackathon." />
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
                {problems.map((p,i)=>(
                  <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",
                    borderRadius:14,padding:24,transition:"border 0.2s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=`${accent}44`}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"}>
                    <div style={{...MM,fontSize:11,color:accent,marginBottom:10,letterSpacing:"0.1em"}}>#{String(i+1).padStart(2,"0")}</div>
                    <div style={{...FF,fontSize:16,fontWeight:700,color:"#fff",marginBottom:8}}>{p.title}</div>
                    <div style={{...FF,fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.7}}>{p.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ── RESOURCES ── */}
      {data.resources&&(()=>{
        let res=[];
        try{res=JSON.parse(data.resources);}catch{
          const NL2="\n"; res=(data.resources||"").split(NL2).filter(Boolean).map(l=>{
            const[name,...rest]=l.split("|"); return{name:name.trim(),url:rest[0]?.trim(),desc:rest[1]?.trim()};
          });
        }
        if(!res.length)return null;
        return(
          <section style={{padding:"60px 24px",background:"#0a0d1a"}}>
            <div style={{maxWidth:1100,margin:"0 auto"}}>
              <SecHead eyebrow="Starter Kit" title="Resources & Tools" accent={accent}
                sub="Useful tools, APIs, and datasets to get you started." />
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
                {res.map((r,i)=>(
                  <a key={i} href={r.url||"#"} target="_blank" rel="noopener"
                    style={{...FF,display:"block",padding:"16px 18px",background:"rgba(255,255,255,0.03)",
                      border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,textDecoration:"none",
                      transition:"all 0.2s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.07)";e.currentTarget.style.borderColor=`${accent}44`;}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";}}>
                    <div style={{fontSize:20,marginBottom:6}}>🔗</div>
                    <div style={{fontSize:13,fontWeight:600,color:"#fff",marginBottom:3}}>{r.name}</div>
                    {r.desc&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)",lineHeight:1.5}}>{r.desc}</div>}
                  </a>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ── PRIZES ── */}}
      {data.websitePrizes&&(
        <section id="prizes" style={{padding:"80px 24px",background:"#0a0d1a"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <SecHead eyebrow="Awards" title="Prizes & Recognition" accent={accent}/>
            {(()=>{
              const PICONS=["🥇","🥈","🥉","🏅","⭐","🎖️"];
              const PCOLORS=[["#fef3c7","rgba(251,191,36,0.15)"],["#f1f5f9","rgba(200,200,200,0.1)"],
                ["#fef3e2","rgba(180,100,30,0.15)"],["#f0fdf4","rgba(16,185,129,0.12)"],
                ["#eff6ff","rgba(59,130,246,0.12)"],["#fdf4ff","rgba(139,92,246,0.12)"]];
              const prizes=(data.websitePrizes||"").split("\n").filter(Boolean).map((l,i)=>{
                const[title,...rest]=l.split("|");
                return{icon:PICONS[i]||"🏅",title:title.trim(),desc:rest.join("|").trim(),col:PCOLORS[i]||PCOLORS[0]};
              });
              return(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
                  {prizes.map((pz,i)=>(
                    <div key={i} style={{background:pz.col[1],border:`1px solid ${pz.col[0]}33`,borderRadius:12,padding:"24px 20px",textAlign:"center"}}>
                      <div style={{fontSize:36,marginBottom:10}}>{pz.icon}</div>
                      <div style={{...FF,fontSize:16,fontWeight:700,color:"#fff",marginBottom:6}}>{pz.title}</div>
                      {pz.desc&&<div style={{...FF,fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>{pz.desc}</div>}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* ── TESTIMONIALS ── */}
      {testimonials.length>0&&(
        <section id="testimonials" style={{padding:"80px 24px",background:"#06091a"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <SecHead eyebrow="What People Say" title="Past Participant Voices" accent={accent}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
              {testimonials.map((t,i)=>(
                <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:22}}>
                  <div style={{fontSize:36,color:accent,lineHeight:1,marginBottom:10,opacity:0.4}}>"</div>
                  <p style={{...FF,fontSize:14,color:"rgba(255,255,255,0.65)",lineHeight:1.7,marginBottom:14,fontStyle:"italic"}}>{t.quote}</p>
                  <div style={{...FF,fontSize:13,fontWeight:600,color:"#fff"}}>{t.author}</div>
                  {t.role&&<div style={{...FF,fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>{t.role}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── GALLERY ── */}
      {galleryImages.length>0&&<Gallery images={galleryImages} accent={accent}/>}

      {/* ── VENUE ── */}
      {(data.venueName||data.venueAddress)&&(
        <section id="venue" style={{padding:"80px 24px",background:"#0a0d1a"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <SecHead eyebrow="Location" title="Venue" accent={accent}/>
            <div style={{maxWidth:640,margin:"0 auto"}}>
              {data.venueName&&<h3 style={{...FF,fontSize:22,fontWeight:700,color:"#fff",marginBottom:10}}>{data.venueName}</h3>}
              {data.venueAddress&&<p style={{...FF,fontSize:14,color:"rgba(255,255,255,0.5)",lineHeight:1.7,marginBottom:16,whiteSpace:"pre-line"}}>{data.venueAddress}</p>}
              {data.venueMapsUrl&&<a href={data.venueMapsUrl} target="_blank" rel="noopener" style={{...FF,display:"inline-flex",alignItems:"center",gap:6,padding:"10px 18px",background:accent,color:"#fff",borderRadius:8,fontSize:13,fontWeight:600,textDecoration:"none"}}>📍 Get Directions</a>}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
      {faqs.length>0&&(
        <section id="faq" style={{padding:"80px 24px",background:"#06091a"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <SecHead eyebrow="Questions?" title="Frequently Asked" accent={accent}/>
            <div style={{maxWidth:700,margin:"0 auto"}}>
              {faqs.map((item,i)=><FAQItem key={i} q={item.q} a={item.a} accent={accent}/>)}
            </div>
          </div>
        </section>
      )}

      {/* ── Q&A ── */}
      <QASection hackathonId={hackathonId} accent={accent}/>

      {/* ── PEOPLE'S CHOICE VOTING ── */}
      {data.peoplesChoiceOpen&&<VotingSection hackathonId={hackathonId} teams={data.teams||[]} accent={accent}/>}

      {/* ── CODE OF CONDUCT ── */}
      {data.codeOfConduct&&(
        <section style={{padding:"48px 24px",background:"#0a0d1a"}}>
          <div style={{maxWidth:720,margin:"0 auto"}}>
            <SecHead eyebrow="Community Standards" title="Code of Conduct" accent={accent}/>
            <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:28}}>
              <div style={{...FF,fontSize:14,color:"rgba(255,255,255,0.6)",lineHeight:1.85,whiteSpace:"pre-wrap"}}>{data.codeOfConduct}</div>
            </div>
          </div>
        </section>
      )}

      {/* ── JUDGE & TEAM LOGIN ── */}
      {!isCompleted&&(
        <section id="login" style={{padding:"72px 24px",background:"#09101f",
          borderTop:`1px solid rgba(255,255,255,0.06)`}}>
          <div style={{maxWidth:480,margin:"0 auto"}}>
            <SecHead eyebrow="Participants" title="Sign in to your account" accent={accent}
              sub="Teams and judges: sign in here to access your dashboard for this event." />
            <ParticipantLogin hackathonId={hackathonId} accent={accent}/>
          </div>
        </section>
      )}

      {/* ── REGISTER / COMPLETED ── */}
      <section id="register" style={{padding:"80px 24px",background:`${accent}0a`,borderTop:`1px solid ${accent}20`}}>
        <div style={{maxWidth:560,margin:"0 auto"}}>
          {isCompleted ? (
            /* Completed state */
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:64,marginBottom:20}}>🏆</div>
              <div style={{...MM,fontSize:10,color:"#10b981",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:14}}>Event Concluded</div>
              <h2 style={{...FF,fontSize:"clamp(24px,4vw,40px)",fontWeight:800,color:"#fff",marginBottom:12,letterSpacing:"-0.02em"}}>
                Thank You to Everyone Who Participated!
              </h2>
              <p style={{...FF,fontSize:15,color:"rgba(255,255,255,0.45)",lineHeight:1.8,marginBottom:28}}>
                {data.name} has wrapped up successfully. We're grateful to all the teams, judges, mentors, and partners who made this event possible.
              </p>
              <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
                {data.contactEmail&&(
                  <a href={`mailto:${data.contactEmail}`}
                    style={{...FF,display:"inline-flex",alignItems:"center",gap:6,padding:"11px 22px",
                      background:accent,color:"#fff",borderRadius:10,fontSize:14,fontWeight:600,
                      textDecoration:"none"}}>
                    📩 Contact Organizers
                  </a>
                )}
                {data.socialLinkedin&&(
                  <a href={data.socialLinkedin} target="_blank" rel="noopener"
                    style={{...FF,display:"inline-flex",alignItems:"center",gap:6,padding:"11px 22px",
                      background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",
                      color:"rgba(255,255,255,0.8)",borderRadius:10,fontSize:14,fontWeight:600,
                      textDecoration:"none"}}>
                    Follow for Updates
                  </a>
                )}
              </div>
            </div>
          ) : (
            /* Registration open */
            <>
              <div style={{textAlign:"center",marginBottom:36}}>
                <div style={{...MM,fontSize:10,color:accent,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:12}}>
                  {regClosed?"Applications Closed":"Applications Open"}
                </div>
                <h2 style={{...FF,fontSize:"clamp(26px,4vw,44px)",fontWeight:800,color:"#fff",letterSpacing:"-0.03em",marginBottom:10}}>
                  {regClosed?"Registration Has Closed":"Ready to Build?"}
                </h2>
                <p style={{...FF,fontSize:15,color:"rgba(255,255,255,0.45)",lineHeight:1.7}}>
                  {regClosed
                    ?"The registration window has passed. Check back for future events or contact us."
                    :"Applications are reviewed on a rolling basis. Spots are limited."}
                </p>
              </div>
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:18,padding:28}}>
                <RegForm hackathonId={hackathonId} accent={accent} deadline={data.registrationDeadline}/>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{background:"#04060f",borderTop:"1px solid rgba(255,255,255,0.05)",padding:"32px 24px"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",justifyContent:"space-between",
          alignItems:"center",flexWrap:"wrap",gap:16}}>
          <div>
            {data.eventLogoUrl&&<img src={data.eventLogoUrl} style={{height:28,objectFit:"contain",marginBottom:6,display:"block"}} />}
            <div style={{...MM,fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.5)"}}>{data.name}</div>
            {data.tagline&&<div style={{...FF,fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:2}}>{data.tagline}</div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:5,textAlign:"right"}}>
            {data.location&&<div style={{...FF,fontSize:12,color:"rgba(255,255,255,0.3)"}}>📍 {data.location}</div>}
            {data.contactEmail&&<a href={`mailto:${data.contactEmail}`} style={{...FF,fontSize:12,color:"rgba(255,255,255,0.3)",textDecoration:"none"}}>📩 {data.contactEmail}</a>}
          </div>
        </div>
        {(data.socialTwitter||data.socialLinkedin||data.socialInstagram||data.socialFacebook)&&(
          <div style={{maxWidth:1100,margin:"20px auto 0",paddingTop:16,
            borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",gap:8,justifyContent:"center"}}>
            {[["𝕏 Twitter",data.socialTwitter],["in LinkedIn",data.socialLinkedin],
              ["📸 Instagram",data.socialInstagram],["f Facebook",data.socialFacebook]
            ].filter(([,url])=>url).map(([label,url])=>(
              <a key={label} href={url} target="_blank" rel="noopener"
                style={{...FF,fontSize:12,fontWeight:500,padding:"7px 14px",
                  border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,
                  color:"rgba(255,255,255,0.5)",textDecoration:"none"}}
                onMouseEnter={e=>{e.target.style.color="#fff";e.target.style.borderColor="rgba(255,255,255,0.3)";}}
                onMouseLeave={e=>{e.target.style.color="rgba(255,255,255,0.5)";e.target.style.borderColor="rgba(255,255,255,0.1)";}}>
                {label}
              </a>
            ))}
          </div>
        )}
        <div style={{...FF,fontSize:11,color:"rgba(255,255,255,0.15)",textAlign:"center",marginTop:20}}>
          © {new Date().getFullYear()} {data.name} · Powered by HackFest Hub
        </div>
      </footer>
    </div>
  );
}

// ── Sticky Nav ────────────────────────────────────────────────────────────────
function Nav({accent,data,scrollTo,tracks,galleryImages,onRegister}){
  const[sc,setSc]=useState(false);
  useEffect(()=>{const fn=()=>setSc(window.scrollY>50);window.addEventListener("scroll",fn);return()=>window.removeEventListener("scroll",fn);},[]);
  const tabs=[
    {id:"about",   label:"About",    show:true},
    {id:"tracks",  label:"Tracks",   show:tracks.length>0},
    {id:"schedule",label:"Schedule", show:!!(data.schedule)},
    {id:"keynotes",label:"Keynotes", show:(data.keynotes||[]).length>0},
    {id:"chairs",  label:"Chairs",   show:(data.sessionChairs||[]).length>0},
    {id:"judges",  label:"Judges",   show:(data.judges||[]).length>0},
    {id:"team",    label:"Team",     show:(data.team||[]).length>0},
    {id:"partners",label:"Partners", show:(data.partners||[]).length>0},
    {id:"prizes",  label:"Prizes",   show:!!(data.websitePrizes)},
    {id:"gallery", label:"Gallery",  show:galleryImages.length>0},
    {id:"login",   label:"Sign In",  show:!isCompleted},
    {id:"register",label:"Register", show:true},
  ].filter(t=>t.show);
  return(
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:200,
      background:sc?"rgba(7,11,20,0.95)":"transparent",
      backdropFilter:sc?"blur(16px)":"none",
      borderBottom:sc?"1px solid rgba(255,255,255,0.06)":"none",transition:"all 0.3s"}}>
      <div style={{maxWidth:1200,margin:"0 auto",padding:"0 16px",display:"flex",
        alignItems:"center",justifyContent:"space-between",height:60}}>
        <div style={{...MM,fontSize:13,fontWeight:700,color:"#fff",flexShrink:0}}>
          {data.eventLogoUrl&&<img src={data.eventLogoUrl} style={{height:28,objectFit:"contain",marginRight:8,verticalAlign:"middle"}} />}
          {data.name}
        </div>
        <div style={{display:"flex",gap:0,overflowX:"auto",flex:1,justifyContent:"center"}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>scrollTo(t.id)}
              style={{...FF,background:"none",border:"none",color:"rgba(255,255,255,0.5)",
                fontSize:12,fontWeight:500,cursor:"pointer",padding:"6px 10px",
                whiteSpace:"nowrap",transition:"color 0.15s"}}
              onMouseEnter={e=>e.target.style.color="#fff"}
              onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.5)"}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={onRegister} style={{...FF,background:accent,color:"#fff",
          border:"none",borderRadius:7,padding:"7px 18px",fontSize:13,fontWeight:700,
          cursor:"pointer",flexShrink:0}}>Register</button>
      </div>
    </nav>
  );
}

// ── Gallery with lightbox ─────────────────────────────────────────────────────
function Gallery({images,accent}){
  const[sel,setSel]=useState(null);
  return(
    <section id="gallery" style={{padding:"80px 24px",background:"#06091a"}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <SecHead eyebrow="Memories" title="Event Gallery" accent={accent}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
          {images.map((src,i)=>(
            <div key={i} onClick={()=>setSel(src)}
              style={{aspectRatio:"4/3",borderRadius:10,overflow:"hidden",cursor:"pointer",
                border:"1px solid rgba(255,255,255,0.07)",transition:"transform 0.2s"}}
              onMouseEnter={e=>e.currentTarget.style.transform="scale(1.02)"}
              onMouseLeave={e=>e.currentTarget.style.transform="none"}>
              <img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            </div>
          ))}
        </div>
      </div>
      {sel&&(
        <div onClick={()=>setSel(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",
          zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <img src={sel} style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:10,objectFit:"contain"}}/>
          <button onClick={()=>setSel(null)} style={{position:"fixed",top:20,right:24,
            background:"none",border:"none",color:"#fff",fontSize:36,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
      )}
    </section>
  );
}



// ── Q&A Section ──────────────────────────────────────────────────────────────
function QASection({hackathonId, accent}) {
  const [questions, setQuestions] = useState([]);
  const [form, setForm]  = useState({name:"",email:"",question:""});
  const [sent, setSent]  = useState(false);
  const [busy, setBusy]  = useState(false);
  const sf = k => e => setForm(p=>({...p,[k]:e.target.value}));

  useEffect(()=>{
    fetch(`${BASE}/api/public/questions/${hackathonId}`)
      .then(r=>r.json()).then(d=>setQuestions(Array.isArray(d)?d:[])).catch(()=>{});
  },[hackathonId]);

  const submit = async e => {
    e.preventDefault(); setBusy(true);
    try{
      const r = await fetch(`${BASE}/api/public/questions`,{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({hackathonId,...form})}).then(r=>r.json());
      if(!r.error){ setSent(true); setForm({name:"",email:"",question:""}); }
    }catch(_){}
    setBusy(false);
  };

  const upvote = async id => {
    await fetch(`${BASE}/api/questions/${id}/upvote`,{method:"POST"});
    setQuestions(qs => qs.map(q=>q.id===id?{...q,upvotes:(q.upvotes||0)+1}:q));
  };

  const IS = {...FF,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",
    borderRadius:8,padding:"10px 14px",fontSize:14,color:"#fff",width:"100%",outline:"none"};

  return (
    <section id="qa" style={{padding:"80px 24px",background:"#08091a",borderTop:`1px solid rgba(255,255,255,0.06)`}}>
      <div style={{maxWidth:860,margin:"0 auto"}}>
        <SecHead eyebrow="Community" title="Questions & Answers" accent={accent}
          sub="Ask the organizers anything. Answered questions are shared publicly." />

        {/* Existing Q&A */}
        {questions.filter(q=>q.answer).length>0&&(
          <div style={{marginBottom:36}}>
            {questions.filter(q=>q.answer).map((qa,i)=>(
              <div key={i} style={{marginBottom:16,background:"rgba(255,255,255,0.03)",
                border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,overflow:"hidden"}}>
                {qa.pinned&&<div style={{background:accent,height:3}}/>}
                <div style={{padding:"18px 22px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div style={{...FF,fontSize:14,fontWeight:600,color:"#fff"}}>{qa.question}</div>
                    <button onClick={()=>upvote(qa.id)}
                      style={{...FF,background:"rgba(255,255,255,0.08)",border:"none",borderRadius:8,
                        padding:"4px 10px",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:12,flexShrink:0,marginLeft:12}}>
                      ▲ {qa.upvotes||0}
                    </button>
                  </div>
                  <div style={{borderLeft:`3px solid ${accent}`,paddingLeft:14,marginTop:10}}>
                    <div style={{...FF,fontSize:11,color:accent,fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Organizer Answer</div>
                    <div style={{...FF,fontSize:14,color:"rgba(255,255,255,0.7)",lineHeight:1.7}}>{qa.answer}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ask a question form */}
        <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:28}}>
          <div style={{...FF,fontSize:15,fontWeight:700,color:"#fff",marginBottom:16}}>
            {sent?"✅ Question submitted!":"Ask a question"}
          </div>
          {sent?(
            <div style={{...FF,fontSize:13,color:"rgba(255,255,255,0.5)"}}>
              Thank you! The organizers will answer your question shortly.
            </div>
          ):(
            <form onSubmit={submit}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <div>
                  <label style={{...FF,display:"block",fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Your Name *</label>
                  <input style={IS} value={form.name} onChange={sf("name")} required/>
                </div>
                <div>
                  <label style={{...FF,display:"block",fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Email</label>
                  <input type="email" style={IS} value={form.email} onChange={sf("email")}/>
                </div>
              </div>
              <div style={{marginBottom:16}}>
                <label style={{...FF,display:"block",fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Your Question *</label>
                <textarea style={{...IS,minHeight:80,resize:"vertical"}} value={form.question} onChange={sf("question")} required/>
              </div>
              <button type="submit" disabled={busy}
                style={{...FF,padding:"11px 24px",borderRadius:10,background:accent,
                  color:"#fff",border:"none",cursor:"pointer",fontSize:14,fontWeight:700}}>
                {busy?"Submitting…":"Submit Question →"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ── People's Choice Voting ────────────────────────────────────────────────────
function VotingSection({hackathonId, teams, accent}) {
  const [votes,   setVotes]   = useState([]);
  const [status,  setStatus]  = useState(null);
  const [form,    setForm]    = useState({name:"",email:"",teamId:""});
  const [done,    setDone]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  useEffect(()=>{
    fetch(`${BASE}/api/public/votes/${hackathonId}`).then(r=>r.json())
      .then(d=>{setStatus(d);setVotes(d.results||[]);}).catch(()=>{});
  },[hackathonId]);

  const sf=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const maxVotes=Math.max(...votes.map(v=>v.votes),1);

  const submit=async e=>{
    e.preventDefault();if(!form.teamId)return setErr("Select a team");
    setLoading(true);setErr("");
    try{
      const r=await fetch(`${BASE}/api/vote`,{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...form,hackathonId})}).then(r=>r.json());
      if(r.error)setErr(r.error);
      else{setDone(true);fetch(`${BASE}/api/public/votes/${hackathonId}`).then(r=>r.json()).then(d=>{setVotes(d.results||[]);});}
    }catch(e){setErr(e.message);}
    setLoading(false);
  };

  if(!status?.open)return null;
  const IS={...FF,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",
    borderRadius:8,padding:"10px 14px",fontSize:14,color:"#fff",width:"100%",outline:"none"};

  return(
    <section id="vote" style={{padding:"80px 24px",background:"#06091a",borderTop:`1px solid ${accent}22`}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <SecHead eyebrow="People's Choice" title="Vote for Your Favorite Team" accent={accent}
          sub="Cast your vote — one per person. Results shown live." />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:40,alignItems:"start"}}>
          {/* Vote form */}
          <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:28}}>
            {done?(
              <div style={{textAlign:"center",padding:"20px 0"}}>
                <div style={{fontSize:48,marginBottom:12}}>🗳️</div>
                <div style={{...FF,fontSize:18,fontWeight:700,color:"#fff",marginBottom:8}}>Vote Submitted!</div>
                <div style={{...FF,fontSize:13,color:"rgba(255,255,255,0.5)"}}>Thank you for participating in the People's Choice vote.</div>
              </div>
            ):(
              <form onSubmit={submit}>
                <div style={{...FF,fontSize:14,fontWeight:600,color:"#fff",marginBottom:16}}>Cast Your Vote</div>
                {err&&<div style={{...FF,fontSize:12,color:"#f87171",marginBottom:12,padding:"8px 12px",background:"rgba(239,68,68,0.1)",borderRadius:6}}>⚠ {err}</div>}
                <div style={{marginBottom:12}}>
                  <label style={{...FF,display:"block",fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Your Name *</label>
                  <input style={IS} value={form.name} onChange={sf("name")} required
                    onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.15)"} />
                </div>
                <div style={{marginBottom:12}}>
                  <label style={{...FF,display:"block",fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Email *</label>
                  <input type="email" style={IS} value={form.email} onChange={sf("email")} required
                    onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.15)"} />
                </div>
                <div style={{marginBottom:20}}>
                  <label style={{...FF,display:"block",fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>Vote for Team *</label>
                  <select style={IS} value={form.teamId} onChange={sf("teamId")} required>
                    <option value="">Select a team…</option>
                    {teams.map(t=><option key={t.id} value={t.id}>{t.name} — {t.project||t.category}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={loading} style={{...FF,width:"100%",padding:"12px",borderRadius:10,
                  background:accent,color:"#fff",border:"none",cursor:"pointer",fontSize:15,fontWeight:700,
                  opacity:loading?0.7:1}}>
                  {loading?"Submitting…":"🗳️ Submit My Vote"}
                </button>
              </form>
            )}
          </div>
          {/* Live results */}
          <div>
            <div style={{...FF,fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.6)",marginBottom:16}}>
              Live Results {status.ends&&`· Closes ${new Date(status.ends).toLocaleDateString()}`}
            </div>
            {votes.slice(0,8).map((team,i)=>(
              <div key={team.id} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{...FF,fontSize:13,color:"#fff",fontWeight:i===0?700:400}}>
                    {i===0?"👑 ":""}{team.name}
                  </span>
                  <span style={{...MM,fontSize:12,color:"rgba(255,255,255,0.5)"}}>{team.votes} vote{team.votes!==1?"s":""}</span>
                </div>
                <div style={{background:"rgba(255,255,255,0.1)",borderRadius:4,height:8,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:4,transition:"width 0.6s ease",
                    width:`${(team.votes/maxVotes)*100}%`,
                    background:i===0?accent:"rgba(255,255,255,0.3)"}}/>
                </div>
              </div>
            ))}
            {votes.length===0&&<div style={{...FF,fontSize:13,color:"rgba(255,255,255,0.35)",fontStyle:"italic"}}>No votes yet. Be the first!</div>}
          </div>
        </div>
      </div>
    </section>
  );
}


// ── Judge & Team Login (on hackathon public page) ─────────────────────────
function ParticipantLogin({ hackathonId, accent }) {
  const [tab,  setTab]  = useState("team");   // team | judge
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [show,  setShow]  = useState(false);
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState("");
  const [done,  setDone]  = useState(false);

  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      }).then(r => r.json());

      if (res.error) { setErr(res.error); setBusy(false); return; }

      // Validate role matches the tab
      const payload = JSON.parse(atob(res.token.split(".")[1]));
      if (tab === "judge" && payload.role !== "judge" && payload.role !== "admin") {
        setErr("This account is not set up as a judge. Contact your organizer."); setBusy(false); return;
      }
      if (tab === "team" && payload.role !== "team") {
        setErr("This account is not a team account. Contact your organizer."); setBusy(false); return;
      }

      localStorage.setItem("hf_token", res.token);
      setDone(true);
      // Small delay then redirect to portal
      setTimeout(() => { window.location.href = "/admin"; }, 800);
    } catch(e) { setErr(e.message); setBusy(false); }
  };

  const IS = {
    ...FF, width:"100%", padding:"10px 14px", borderRadius:10, fontSize:14, color:"#fff",
    background:"rgba(255,255,255,0.07)", border:"1.5px solid rgba(255,255,255,0.15)",
    outline:"none", transition:"border 0.15s",
  };

  if (done) return (
    <div style={{textAlign:"center", padding:"20px 0"}}>
      <div style={{fontSize:40, marginBottom:10}}>✅</div>
      <div style={{...FF, fontSize:16, fontWeight:700, color:"#fff", marginBottom:6}}>Signed in!</div>
      <div style={{...FF, fontSize:13, color:"rgba(255,255,255,0.5)"}}>Redirecting to your dashboard…</div>
    </div>
  );

  return (
    <div style={{background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:16, padding:28}}>

      {/* Tabs */}
      <div style={{display:"flex", background:"rgba(0,0,0,0.25)", borderRadius:10, padding:3, marginBottom:20}}>
        {[["team","🚀 Team Login"],["judge","⭐ Judge Login"]].map(([v,l])=>(
          <button key={v} onClick={()=>{setTab(v);setErr("");}}
            style={{...FF, flex:1, padding:"9px", borderRadius:8, border:"none", cursor:"pointer",
              background:tab===v?accent:"transparent",
              color:tab===v?"#fff":"rgba(255,255,255,0.45)",
              fontSize:13, fontWeight:600, transition:"all 0.15s"}}>
            {l}
          </button>
        ))}
      </div>

      {tab==="team" && (
        <div style={{...FF, fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:14, lineHeight:1.6}}>
          Use the email and password sent to you when your team login was created.
        </div>
      )}
      {tab==="judge" && (
        <div style={{...FF, fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:14, lineHeight:1.6}}>
          Use your judge credentials provided by the organizer.
        </div>
      )}

      {err && (
        <div style={{background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)",
          borderRadius:8, padding:"9px 14px", fontSize:13, color:"#f87171", marginBottom:14}}>
          {err}
        </div>
      )}

      <form onSubmit={submit}>
        <div style={{marginBottom:12}}>
          <label style={{...FF, display:"block", fontSize:11, fontWeight:600,
            color:"rgba(255,255,255,0.45)", textTransform:"uppercase",
            letterSpacing:"0.07em", marginBottom:5}}>Email</label>
          <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="your@email.com" style={IS}
            onFocus={e=>e.target.style.borderColor=`${accent}99`}
            onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.15)"}/>
        </div>
        <div style={{marginBottom:18}}>
          <label style={{...FF, display:"block", fontSize:11, fontWeight:600,
            color:"rgba(255,255,255,0.45)", textTransform:"uppercase",
            letterSpacing:"0.07em", marginBottom:5}}>Password</label>
          <div style={{position:"relative"}}>
            <input type={show?"text":"password"} required value={pass} onChange={e=>setPass(e.target.value)}
              placeholder="••••••••" style={{...IS, paddingRight:40}}
              onFocus={e=>e.target.style.borderColor=`${accent}99`}
              onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.15)"}/>
            <button type="button" onClick={()=>setShow(!show)}
              style={{position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                background:"none", border:"none", cursor:"pointer",
                color:"rgba(255,255,255,0.35)", fontSize:16}}>
              {show?"🙈":"👁"}
            </button>
          </div>
        </div>
        <button type="submit" disabled={busy}
          style={{...FF, width:"100%", padding:"12px", borderRadius:10,
            background:busy?"rgba(255,255,255,0.1)":accent,
            color:"#fff", border:"none", cursor:busy?"not-allowed":"pointer",
            fontSize:15, fontWeight:700, transition:"all 0.15s",
            boxShadow:busy?"none":`0 4px 14px ${accent}55`}}>
          {busy ? "Signing in…" : `Sign in →`}
        </button>
      </form>
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────
function SecHead({eyebrow,title,sub,accent}){
  return(
    <div style={{textAlign:"center",marginBottom:48}}>
      {eyebrow&&<div style={{...MM,fontSize:9,letterSpacing:"0.25em",color:accent||"#6366f1",
        textTransform:"uppercase",marginBottom:12}}>{eyebrow}</div>}
      <h2 style={{...FF,fontSize:"clamp(24px,3.5vw,40px)",fontWeight:700,color:"#fff",
        letterSpacing:"-0.02em",marginBottom:10,lineHeight:1.15}}>{title}</h2>
      {sub&&<p style={{...FF,fontSize:15,color:"rgba(255,255,255,0.45)",maxWidth:500,margin:"0 auto",lineHeight:1.7}}>{sub}</p>}
    </div>
  );
}
