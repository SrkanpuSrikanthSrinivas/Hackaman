import { useState, useEffect } from "react";

const BASE = typeof window !== "undefined" &&
  ["localhost","127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:3001" : "";

const pget = p => fetch(`${BASE}${p}`).then(r=>r.json());
const ppost= (p,b)=>fetch(`${BASE}${p}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(r=>r.json());

function fmtDate(d) {
  if (!d) return "";
  const s = typeof d==="string"&&d.length<=10 ? d+"T12:00:00" : d;
  const dt = new Date(s);
  return isNaN(dt) ? "" : dt.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
}

/* ── Countdown ────────────────────────────────────────────────────────────── */
function Countdown({ target }) {
  const [t,setT]=useState({d:0,h:0,m:0,s:0});
  useEffect(()=>{
    const tick=()=>{
      const diff=new Date(target)-Date.now();
      if(diff<=0){setT({d:0,h:0,m:0,s:0});return;}
      setT({d:Math.floor(diff/864e5),h:Math.floor(diff%864e5/36e5),m:Math.floor(diff%36e5/6e4),s:Math.floor(diff%6e4/1e3)});
    };
    tick(); const id=setInterval(tick,1000); return()=>clearInterval(id);
  },[target]);
  const Box=({v,l})=>(
    <div style={{textAlign:"center"}}>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:"clamp(28px,4vw,48px)",fontWeight:700,
        lineHeight:1,color:"#fff",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",
        borderRadius:10,padding:"12px 16px",minWidth:70}}>
        {String(v).padStart(2,"0")}
      </div>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:6,letterSpacing:"0.12em",textTransform:"uppercase"}}>
        {l}
      </div>
    </div>
  );
  return(
    <div style={{display:"flex",gap:10,alignItems:"flex-start",justifyContent:"center"}}>
      <Box v={t.d} l="Days"/><Sep/><Box v={t.h} l="Hours"/><Sep/><Box v={t.m} l="Mins"/><Sep/><Box v={t.s} l="Secs"/>
    </div>
  );
}
const Sep=()=><div style={{fontSize:32,color:"rgba(255,255,255,0.2)",paddingTop:8,fontFamily:"monospace"}}>:</div>;

/* ── Nav ──────────────────────────────────────────────────────────────────── */
function Nav({ name, accent, tabs, activeTab, setTab, onRegister }) {
  const [scrolled,setScrolled]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  useEffect(()=>{
    const fn=()=>setScrolled(window.scrollY>60);
    window.addEventListener("scroll",fn); return()=>window.removeEventListener("scroll",fn);
  },[]);
  return(
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:200,
      background:scrolled?"rgba(10,10,18,0.96)":"transparent",
      backdropFilter:scrolled?"blur(16px)":"none",
      borderBottom:scrolled?"1px solid rgba(255,255,255,0.06)":"none",
      transition:"all 0.3s"}}>
      <div style={{maxWidth:1200,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",
        justifyContent:"space-between",height:64}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:15,fontWeight:700,color:"#fff",letterSpacing:"-0.01em"}}>{name}</div>
        <div style={{display:"flex",gap:2}}>
          {tabs.map(tab=>(
            <button key={tab.id} onClick={()=>{setTab(tab.id);document.getElementById(tab.id)?.scrollIntoView({behavior:"smooth"});}}
              style={{fontFamily:"'Inter',sans-serif",background:"none",border:"none",
                color:activeTab===tab.id?"#fff":"rgba(255,255,255,0.5)",
                borderBottom:activeTab===tab.id?`2px solid ${accent}`:"2px solid transparent",
                fontSize:13,fontWeight:500,cursor:"pointer",padding:"6px 12px",
                transition:"color 0.2s",whiteSpace:"nowrap"}}>
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={onRegister}
          style={{fontFamily:"'Inter',sans-serif",background:accent,color:"#fff",border:"none",
            borderRadius:8,padding:"8px 20px",fontSize:13,fontWeight:600,cursor:"pointer",
            boxShadow:`0 0 20px ${accent}66`}}>
          Register
        </button>
      </div>
    </nav>
  );
}

/* ── Section wrapper ──────────────────────────────────────────────────────── */
const S=({id,children,dark,style={}})=>(
  <section id={id} style={{padding:"80px 24px",background:dark?"#06060f":"#0a0a18",...style}}>
    <div style={{maxWidth:1100,margin:"0 auto"}}>{children}</div>
  </section>
);
const SHead=({eyebrow,title,sub,accent="#6366f1"})=>(
  <div style={{textAlign:"center",marginBottom:52}}>
    {eyebrow&&<div style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.25em",
      color:accent,textTransform:"uppercase",marginBottom:14}}>{eyebrow}</div>}
    <h2 style={{fontFamily:"'Inter',sans-serif",fontSize:"clamp(26px,3.5vw,40px)",fontWeight:700,
      color:"#fff",letterSpacing:"-0.02em",marginBottom:12,lineHeight:1.2}}>{title}</h2>
    {sub&&<p style={{fontFamily:"'Inter',sans-serif",fontSize:16,color:"rgba(255,255,255,0.45)",maxWidth:520,margin:"0 auto",lineHeight:1.7}}>{sub}</p>}
  </div>
);

/* ── Person card (keynotes, chairs, judges) ───────────────────────────────── */
function PersonCard({ person, accent="#6366f1", size="md" }) {
  const sz=size==="lg"?96:72;
  const initials=(person.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const colors=["#6366f1","#8b5cf6","#ec4899","#06b6d4","#10b981","#f59e0b"];
  const bg=colors[(person.name||"").charCodeAt(0)%colors.length];
  return(
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
      borderRadius:16,padding:size==="lg"?"28px 20px":"22px 16px",textAlign:"center",
      transition:"all 0.2s",cursor:"default"}}
      onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.borderColor="rgba(255,255,255,0.14)";e.currentTarget.style.transform="translateY(-4px)";}}
      onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.borderColor="rgba(255,255,255,0.07)";e.currentTarget.style.transform="none";}}>
      {/* Avatar */}
      <div style={{width:sz,height:sz,borderRadius:"50%",overflow:"hidden",margin:"0 auto",
        marginBottom:14,border:`3px solid rgba(255,255,255,0.1)`,flexShrink:0,
        background:person.avatarUrl?"transparent":bg,
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:`0 4px 20px ${bg}44`}}>
        {person.avatarUrl
          ?<img src={person.avatarUrl} alt={person.name} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.style.display="none";}} />
          :<span style={{fontFamily:"'Space Mono',monospace",fontSize:sz*0.3,fontWeight:700,color:"#fff"}}>{initials}</span>
        }
      </div>
      <div style={{fontFamily:"'Inter',sans-serif",fontSize:size==="lg"?16:14,fontWeight:600,color:"#fff",marginBottom:4}}>{person.name}</div>
      {person.title&&<div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:4,lineHeight:1.4}}>{person.title}</div>}
      {person.org&&<div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:accent,fontWeight:500}}>{person.org}</div>}
      {person.bio&&<p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:8,lineHeight:1.6,textAlign:"left"}}>{person.bio.slice(0,120)}{person.bio.length>120?"…":""}</p>}
      {/* Social links */}
      {(person.linkedinUrl||person.twitterUrl)&&(
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:10}}>
          {person.linkedinUrl&&<a href={person.linkedinUrl} target="_blank" rel="noopener"
            style={{fontSize:14,color:"rgba(255,255,255,0.4)",textDecoration:"none",transition:"color 0.2s"}}
            onMouseEnter={e=>e.target.style.color="#0ea5e9"}
            onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.4)"}>in</a>}
          {person.twitterUrl&&<a href={person.twitterUrl} target="_blank" rel="noopener"
            style={{fontSize:14,color:"rgba(255,255,255,0.4)",textDecoration:"none",transition:"color 0.2s"}}
            onMouseEnter={e=>e.target.style.color="#1d9bf0"}
            onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.4)"}>𝕏</a>}
        </div>
      )}
    </div>
  );
}

/* ── Track card ───────────────────────────────────────────────────────────── */
const TRACK_META={
  "AI/ML":         {icon:"🤖",color:"#6366f1"},
  "Sustainability": {icon:"🌱",color:"#10b981"},
  "Security":       {icon:"🔐",color:"#f59e0b"},
  "Social Impact":  {icon:"🌍",color:"#ec4899"},
  "EdTech":         {icon:"📚",color:"#06b6d4"},
  "FinTech":        {icon:"💳",color:"#8b5cf6"},
  "Health":         {icon:"❤️", color:"#ef4444"},
  "DevTools":       {icon:"🛠️",color:"#f97316"},
  "Open Source":    {icon:"🔓",color:"#84cc16"},
  "APIs":           {icon:"⚡",color:"#eab308"},
};
function TrackCard({name,i}){
  const meta=TRACK_META[name]||{icon:"💡",color:["#6366f1","#8b5cf6","#06b6d4","#10b981","#f59e0b"][i%5]};
  return(
    <div style={{background:`${meta.color}14`,border:`1px solid ${meta.color}33`,borderRadius:14,
      padding:"26px 20px",textAlign:"center",transition:"transform 0.2s"}}
      onMouseEnter={e=>e.currentTarget.style.transform="translateY(-3px)"}
      onMouseLeave={e=>e.currentTarget.style.transform="none"}>
      <div style={{fontSize:36,marginBottom:12}}>{meta.icon}</div>
      <div style={{fontFamily:"'Inter',sans-serif",fontSize:15,fontWeight:600,color:meta.color}}>{name}</div>
    </div>
  );
}

/* ── Partner logo ─────────────────────────────────────────────────────────── */
const TIER_ORDER=["platinum","gold","silver","bronze","media","general"];
const TIER_LABELS={platinum:"Platinum Sponsor",gold:"Gold Sponsor",silver:"Silver Sponsor",bronze:"Bronze Sponsor",media:"Media Partner",general:"Partner"};
const TIER_SIZE={platinum:160,gold:130,silver:110,bronze:96,media:96,general:80};
function PartnerGroup({tier,partners,accent}){
  const sz=TIER_SIZE[tier]||90;
  return(
    <div style={{marginBottom:44}}>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.2em",color:accent,
        textTransform:"uppercase",textAlign:"center",marginBottom:22}}>{TIER_LABELS[tier]||tier}</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:20,justifyContent:"center",alignItems:"center"}}>
        {partners.map(p=>(
          <a key={p.id} href={p.websiteUrl||"#"} target="_blank" rel="noopener"
            style={{display:"flex",alignItems:"center",justifyContent:"center",
              background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:12,padding:"18px 28px",textDecoration:"none",transition:"all 0.2s",
              minWidth:sz,minHeight:70}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.1)";e.currentTarget.style.borderColor="rgba(255,255,255,0.2)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";}}>
            {p.logoUrl
              ?<img src={p.logoUrl} alt={p.name} style={{maxHeight:sz*0.4,maxWidth:sz*1.5,objectFit:"contain",filter:"brightness(0) invert(1)",opacity:0.8}} />
              :<span style={{fontFamily:"'Inter',sans-serif",fontSize:15,fontWeight:600,color:"rgba(255,255,255,0.6)"}}>{p.name}</span>
            }
          </a>
        ))}
      </div>
    </div>
  );
}

/* ── Prize card ───────────────────────────────────────────────────────────── */
const PRIZE_ICONS=["🥇","🥈","🥉","🏅","⭐"];
function PrizeSection({prizesText,accent}){
  const lines=(prizesText||"").split("\n").filter(Boolean);
  const parsed=lines.map((l,i)=>{
    const [title,...rest]=l.split("|");
    return{icon:PRIZE_ICONS[i]||"🏅",title:title.trim(),desc:rest.join("|").trim()};
  });
  if(!parsed.length) return null;
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14}}>
      {parsed.map((p,i)=>(
        <div key={i} style={{background:i===0?"rgba(250,190,10,0.08)":i===1?"rgba(192,192,192,0.08)":"rgba(205,127,50,0.08)",
          border:`1px solid ${i===0?"rgba(250,190,10,0.25)":i===1?"rgba(200,200,200,0.2)":"rgba(180,100,30,0.2)"}`,
          borderRadius:14,padding:"24px 20px",textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:10}}>{p.icon}</div>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:700,color:"#fff",marginBottom:6}}>{p.title}</div>
          {p.desc&&<div style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:"rgba(255,255,255,0.5)"}}>{p.desc}</div>}
        </div>
      ))}
    </div>
  );
}

/* ── Registration form ─────────────────────────────────────────────────────── */
function RegForm({hackathonId,accent}){
  const [type,setType]=useState("team");
  const [form,setForm]=useState({});
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [err,setErr]=useState("");
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const IS={fontFamily:"'Inter',sans-serif",background:"rgba(255,255,255,0.06)",
    border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"11px 14px",
    fontSize:14,color:"#fff",width:"100%",outline:"none",transition:"border-color 0.2s"};
  const focus=e=>{e.target.style.borderColor=accent;};
  const blur =e=>{e.target.style.borderColor="rgba(255,255,255,0.12)";};
  const submit=async e=>{
    e.preventDefault(); if(!form.name?.trim()||!form.email?.trim())return;
    setBusy(true);setErr("");
    const r=await ppost("/api/public/register",{...form,hackathonId,type});
    if(r.error)setErr(r.error); else setDone(true);
    setBusy(false);
  };
  if(done)return(
    <div style={{textAlign:"center",padding:"56px 24px"}}>
      <div style={{fontSize:56,marginBottom:16}}>🎉</div>
      <h3 style={{fontFamily:"'Inter',sans-serif",fontSize:22,fontWeight:700,color:"#fff",marginBottom:10}}>Application Received!</h3>
      <p style={{fontFamily:"'Inter',sans-serif",fontSize:14,color:"rgba(255,255,255,0.5)"}}>We'll be in touch at <strong style={{color:"#fff"}}>{form.email}</strong> soon.</p>
    </div>
  );
  return(
    <>
      <div style={{display:"flex",gap:2,marginBottom:24,background:"rgba(255,255,255,0.05)",borderRadius:10,padding:3,border:"1px solid rgba(255,255,255,0.08)"}}>
        {["team","judge"].map(t=>(
          <button key={t} onClick={()=>setType(t)} style={{flex:1,padding:"9px",fontSize:13,fontWeight:600,
            borderRadius:8,border:"none",cursor:"pointer",transition:"all 0.15s",
            fontFamily:"'Inter',sans-serif",textTransform:"capitalize",
            background:type===t?accent:"transparent",color:type===t?"#fff":"rgba(255,255,255,0.4)"}}>
            {t==="team"?"🚀 Register as Team":"⭐ Apply as Judge"}
          </button>
        ))}
      </div>
      {err&&<div style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",
        borderRadius:8,padding:"10px 14px",fontSize:13,color:"#f87171",marginBottom:14}}>⚠ {err}</div>}
      <form onSubmit={submit}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>Full Name *</div>
            <input style={IS} value={form.name||""} onChange={f("name")} onFocus={focus} onBlur={blur} required />
          </div>
          <div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>Email *</div>
            <input type="email" style={IS} value={form.email||""} onChange={f("email")} onFocus={focus} onBlur={blur} required />
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>Organization / University</div>
          <input style={IS} value={form.org||""} onChange={f("org")} onFocus={focus} onBlur={blur} placeholder="Optional" />
        </div>
        {type==="team"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <div style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>Team Name</div>
              <input style={IS} value={form.teamName||""} onChange={f("teamName")} onFocus={focus} onBlur={blur} />
            </div>
            <div>
              <div style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>Team Size</div>
              <input type="number" min={1} max={10} style={IS} value={form.teamSize||""} onChange={f("teamSize")} onFocus={focus} onBlur={blur} />
            </div>
          </div>
        )}
        <div style={{marginBottom:20}}>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>
            {type==="team"?"Project Idea / Background":"Your Expertise & Background"}
          </div>
          <textarea style={{...IS,resize:"vertical",minHeight:88}} value={form.message||""} onChange={f("message")} onFocus={focus} onBlur={blur} />
        </div>
        <button type="submit" disabled={busy} style={{width:"100%",background:accent,color:"#fff",
          border:"none",borderRadius:10,padding:"13px",fontSize:15,fontWeight:700,cursor:"pointer",
          fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          boxShadow:`0 8px 28px ${accent}55`,transition:"opacity 0.2s",opacity:busy?0.7:1}}>
          {busy&&<div style={{width:15,height:15,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite"}} />}
          {busy?"Submitting…":type==="team"?"Submit Team Application →":"Submit Judge Application →"}
        </button>
      </form>
    </>
  );
}

/* ── FAQ ───────────────────────────────────────────────────────────────────── */
function FAQ({items,accent}){
  const [open,setOpen]=useState(null);
  if(!items?.length)return null;
  return(
    <div style={{maxWidth:720,margin:"0 auto"}}>
      {items.map((it,i)=>(
        <div key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
          <button onClick={()=>setOpen(open===i?null:i)}
            style={{width:"100%",textAlign:"left",background:"none",border:"none",cursor:"pointer",
              display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"20px 0",fontFamily:"'Inter',sans-serif",gap:16}}>
            <span style={{fontSize:15,fontWeight:600,color:"#fff"}}>{it.q}</span>
            <span style={{fontSize:22,color:accent,transition:"transform 0.25s",flexShrink:0,
              transform:open===i?"rotate(45deg)":"none"}}>+</span>
          </button>
          {open===i&&<div style={{fontFamily:"'Inter',sans-serif",fontSize:14,color:"rgba(255,255,255,0.5)",paddingBottom:20,lineHeight:1.75}}>{it.a}</div>}
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PUBLIC PAGE
════════════════════════════════════════════════════════════════════════════ */
export default function PublicPage({ hackathonId }) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState("");
  const [activeTab,setActiveTab]=useState("about");

  useEffect(()=>{
    pget(`/api/public/page/${hackathonId}`)
      .then(d=>{ if(d.error){setErr(d.error);}else{setData(d);} setLoading(false); })
      .catch(()=>{ setErr("Could not load event."); setLoading(false); });
  },[hackathonId]);

  if(loading) return(
    <div style={{minHeight:"100vh",background:"#0a0a18",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:44,height:44,border:"3px solid rgba(255,255,255,0.1)",borderTopColor:"#6366f1",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if(err) return(
    <div style={{minHeight:"100vh",background:"#0a0a18",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"'Inter',sans-serif"}}>
      <div style={{fontSize:48,marginBottom:16}}>🔒</div>
      <div style={{fontSize:18,fontWeight:600,marginBottom:8}}>Page Not Available</div>
      <div style={{fontSize:14,color:"rgba(255,255,255,0.4)"}}>{err}</div>
    </div>
  );

  const accent = data.bannerColor || "#6366f1";
  const tracks = (data.tracks||"").split(",").map(t=>t.trim()).filter(Boolean);
  const faqItems= (data.faq||"").split("\n\n").filter(Boolean).map(b=>{
    const [q,...a]=b.split("\n"); return{q:q.replace(/^Q:\s*/i,""),a:a.join("\n").replace(/^A:\s*/i,"")};
  });

  // Build tier groups for partners
  const tierGroups={};
  (data.partners||[]).forEach(p=>{ (tierGroups[p.tier]||(tierGroups[p.tier]=[])).push(p); });
  const orderedTiers=TIER_ORDER.filter(t=>tierGroups[t]);

  // Build visible tabs
  const allTabs=[
    {id:"about",      label:"About",         show:true},
    {id:"tracks",     label:"Tracks",        show:tracks.length>0},
    {id:"keynotes",   label:"KeyNotes",      show:data.keynotes?.length>0},
    {id:"chairs",     label:"Session Chairs",show:data.sessionChairs?.length>0},
    {id:"judges",     label:"Judges",        show:data.judges?.length>0},
    {id:"team",       label:"Team",          show:data.team?.length>0},
    {id:"partners",   label:"Partners",      show:data.partners?.length>0},
    {id:"prizes",     label:"Prizes",        show:!!data.websitePrizes},
    {id:"register",   label:"Register",      show:true},
  ].filter(t=>t.show);

  const scrollTo=(id)=>{ document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"}); };

  return(
    <div style={{fontFamily:"'Inter',sans-serif",background:"#0a0a18",color:"#fff",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Space+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;scroll-padding-top:72px;}
        input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.2);}
        input:focus,textarea:focus{outline:none;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-track{background:#0a0a18;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>

      <Nav name={data.name} accent={accent} tabs={allTabs} activeTab={activeTab} setTab={setActiveTab} onRegister={()=>scrollTo("register")} />

      {/* ── HERO ── */}
      <section style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
        justifyContent:"center",textAlign:"center",padding:"100px 24px 60px",position:"relative",overflow:"hidden"}}>
        {/* Background layers */}
        <div style={{position:"absolute",inset:0,background:`linear-gradient(160deg,#08080f 0%,${accent}22 50%,#08080f 100%)`}} />
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 90% 60% at 50% 0%,rgba(99,102,241,0.12) 0%,transparent 70%)"}} />
        {/* Grid */}
        <div style={{position:"absolute",inset:0,opacity:0.03,backgroundImage:"linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",backgroundSize:"60px 60px"}} />
        {/* Glow orb */}
        <div style={{position:"absolute",top:"30%",left:"50%",transform:"translate(-50%,-50%)",width:600,height:600,borderRadius:"50%",background:`${accent}18`,filter:"blur(100px)",pointerEvents:"none"}} />

        <div style={{position:"relative",zIndex:1,maxWidth:860,animation:"fadeUp 0.7s ease both"}}>
          {/* Status pill */}
          <div style={{display:"inline-flex",alignItems:"center",gap:8,
            background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
            borderRadius:9999,padding:"5px 16px",fontSize:12,fontWeight:600,
            color:"rgba(255,255,255,0.7)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:28}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:accent,animation:"pulse 2s infinite",display:"inline-block"}} />
            {data.status==="active"?"Registration Open":data.status==="upcoming"?"Coming Soon":"Event Concluded"}
          </div>

          <h1 style={{fontFamily:"'Inter',sans-serif",fontSize:"clamp(40px,7vw,84px)",fontWeight:800,
            lineHeight:1.02,letterSpacing:"-0.035em",marginBottom:18,
            background:`linear-gradient(135deg,#fff 0%,rgba(255,255,255,0.65) 100%)`,
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            {data.name}
          </h1>

          {data.tagline&&<p style={{fontSize:"clamp(15px,2.2vw,20px)",color:"rgba(255,255,255,0.5)",
            marginBottom:36,lineHeight:1.65,maxWidth:580,margin:"0 auto 36px"}}>
            {data.tagline}
          </p>}

          {/* Info badges */}
          <div style={{display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap",marginBottom:48}}>
            {data.startDate&&<Pill>📅 {fmtDate(data.startDate)}{data.endDate?` – ${fmtDate(data.endDate)}`:""}</Pill>}
            {data.location&&<Pill>📍 {data.location}</Pill>}
            {data.prizePool&&<Pill style={{borderColor:`${accent}55`,color:accent}}>🏆 {data.prizePool}</Pill>}
          </div>

          {/* Countdown */}
          {data.startDate&&new Date(data.startDate)>new Date()&&(
            <div style={{marginBottom:48}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(255,255,255,0.25)",
                letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:20}}>Event starts in</div>
              <Countdown target={data.startDate} />
            </div>
          )}

          {/* CTA */}
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>scrollTo("register")} style={{fontFamily:"'Inter',sans-serif",
              background:accent,color:"#fff",border:"none",borderRadius:12,
              padding:"14px 36px",fontSize:16,fontWeight:700,cursor:"pointer",
              boxShadow:`0 8px 32px ${accent}55`,transition:"all 0.2s"}}
              onMouseEnter={e=>{e.target.style.transform="translateY(-2px)";e.target.style.boxShadow=`0 14px 40px ${accent}66`;}}
              onMouseLeave={e=>{e.target.style.transform="none";e.target.style.boxShadow=`0 8px 32px ${accent}55`;}}>
              Register Now →
            </button>
            <button onClick={()=>scrollTo("about")} style={{fontFamily:"'Inter',sans-serif",
              background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.8)",
              border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,
              padding:"14px 28px",fontSize:16,fontWeight:600,cursor:"pointer",transition:"all 0.2s"}}
              onMouseEnter={e=>e.target.style.background="rgba(255,255,255,0.12)"}
              onMouseLeave={e=>e.target.style.background="rgba(255,255,255,0.07)"}>
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      {(data.prizePool||tracks.length||data.judges?.length||data.keynotes?.length)&&(
        <div style={{background:`${accent}0d`,borderTop:`1px solid ${accent}22`,borderBottom:`1px solid ${accent}22`,padding:"22px 24px"}}>
          <div style={{maxWidth:1100,margin:"0 auto",display:"flex",justifyContent:"center",gap:14,flexWrap:"wrap"}}>
            {data.prizePool&&<StatBadge icon="🏆" val={data.prizePool} label="Prize Pool" />}
            {tracks.length>0&&<StatBadge icon="🎯" val={tracks.length} label="Tracks" />}
            {data.keynotes?.length>0&&<StatBadge icon="🎤" val={data.keynotes.length} label="Keynote Speakers" />}
            {data.judges?.length>0&&<StatBadge icon="⭐" val={data.judges.length} label="Judges" />}
            {data.team?.length>0&&<StatBadge icon="👥" val={data.team.length} label="Organizers" />}
          </div>
        </div>
      )}

      {/* ── ABOUT ── */}
      <S id="about">
        <div style={{display:"grid",gridTemplateColumns:"1.1fr 1fr",gap:64,alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:accent,
              letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:16}}>About the Event</div>
            <h2 style={{fontFamily:"'Inter',sans-serif",fontSize:"clamp(24px,3.5vw,40px)",fontWeight:700,
              color:"#fff",letterSpacing:"-0.02em",marginBottom:20,lineHeight:1.2}}>{data.name}</h2>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:16,color:"rgba(255,255,255,0.55)",lineHeight:1.85,marginBottom:28}}>
              {data.websiteAbout||data.description}
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[["📅","Date",data.startDate?`${fmtDate(data.startDate)}${data.endDate?` – ${fmtDate(data.endDate)}`:""}`:""],
                ["📍","Location",data.location],
                ["🏆","Prize Pool",data.prizePool]].filter(([,,v])=>v).map(([ic,lb,vl])=>(
                <div key={lb} style={{display:"flex",gap:12,alignItems:"center"}}>
                  <span style={{fontSize:16}}>{ic}</span>
                  <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:"rgba(255,255,255,0.3)",minWidth:70}}>{lb}</span>
                  <span style={{fontFamily:"'Inter',sans-serif",fontSize:14,color:"rgba(255,255,255,0.8)",fontWeight:500}}>{vl}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[["🚀","Innovation","Push boundaries and think beyond the obvious"],
              ["🤝","Community","Collaborate with brilliant minds globally"],
              ["🎓","Mentorship","Learn from industry experts in real time"],
              ["🌍","Impact","Create solutions that matter to real people"]].map(([ic,t,d])=>(
              <div key={t} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
                borderRadius:14,padding:20}}>
                <div style={{fontSize:26,marginBottom:10}}>{ic}</div>
                <div style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:600,color:"#fff",marginBottom:6}}>{t}</div>
                <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:"rgba(255,255,255,0.4)",lineHeight:1.6}}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </S>

      {/* ── TRACKS ── */}
      {tracks.length>0&&(
        <S id="tracks" dark>
          <SHead eyebrow="Challenge Areas" title="Hackathon Tracks" accent={accent}
            sub="Pick your domain and build something the world needs." />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
            {tracks.map((t,i)=><TrackCard key={t} name={t} i={i} />)}
          </div>
        </S>
      )}

      {/* ── KEYNOTES ── */}
      {data.keynotes?.length>0&&(
        <S id="keynotes">
          <SHead eyebrow="Keynote Speakers" title="Visionaries Taking the Stage" accent={accent}
            sub="Industry leaders sharing insights that will inspire and challenge you." />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:16}}>
            {data.keynotes.map(k=><PersonCard key={k.id} person={k} accent={accent} size="lg" />)}
          </div>
        </S>
      )}

      {/* ── SESSION CHAIRS ── */}
      {data.sessionChairs?.length>0&&(
        <S id="chairs" dark>
          <SHead eyebrow="Session Chairs" title="Guiding the Conversation" accent={accent}
            sub="Experienced moderators who will keep sessions sharp and insightful." />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
            {data.sessionChairs.map(s=><PersonCard key={s.id} person={s} accent={accent} />)}
          </div>
        </S>
      )}

      {/* ── JUDGES ── */}
      {data.judges?.length>0&&(
        <S id="judges">
          <SHead eyebrow="Evaluation Panel" title="Meet the Judges" accent={accent}
            sub="A distinguished panel of practitioners who will evaluate your submissions." />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
            {data.judges.map(j=><PersonCard key={j.id} person={j} accent={accent} />)}
          </div>
        </S>
      )}

      {/* ── TEAM ── */}
      {data.team?.length>0&&(
        <S id="team" dark>
          <SHead eyebrow="Organizing Committee" title="Meet the Team" accent={accent}
            sub="The people working behind the scenes to make this event happen." />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
            {data.team.map(m=><PersonCard key={m.id} person={m} accent={accent} />)}
          </div>
        </S>
      )}

      {/* ── PARTNERS ── */}
      {orderedTiers.length>0&&(
        <S id="partners">
          <SHead eyebrow="Sponsors & Partners" title="Who Makes This Possible" accent={accent} />
          {orderedTiers.map(tier=><PartnerGroup key={tier} tier={tier} partners={tierGroups[tier]} accent={accent} />)}
        </S>
      )}

      {/* ── PRIZES ── */}
      {data.websitePrizes&&(
        <S id="prizes" dark>
          <SHead eyebrow="Awards" title="Prizes & Recognition" accent={accent}
            sub="Compete for meaningful rewards and industry recognition." />
          <PrizeSection prizesText={data.websitePrizes} accent={accent} />
        </S>
      )}

      {/* ── FAQ ── */}
      {faqItems.length>0&&(
        <S id="faq">
          <SHead eyebrow="Questions?" title="Frequently Asked" accent={accent} />
          <FAQ items={faqItems} accent={accent} />
        </S>
      )}

      {/* ── REGISTER ── */}
      <S id="register" style={{background:`${accent}0a`,borderTop:`1px solid ${accent}20`}}>
        <div style={{maxWidth:600,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:accent,
              letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:14}}>Applications Open</div>
            <h2 style={{fontFamily:"'Inter',sans-serif",fontSize:"clamp(28px,4vw,46px)",fontWeight:800,
              color:"#fff",letterSpacing:"-0.03em",marginBottom:12}}>Ready to Build?</h2>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:16,color:"rgba(255,255,255,0.45)",lineHeight:1.7}}>
              Applications are reviewed on a rolling basis. Spots are limited.
            </p>
          </div>
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:20,padding:32,backdropFilter:"blur(12px)"}}>
            <RegForm hackathonId={hackathonId} accent={accent} />
          </div>
        </div>
      </S>

      {/* ── FOOTER ── */}
      <footer style={{background:"#06060f",borderTop:"1px solid rgba(255,255,255,0.05)",padding:"28px 24px",
        display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.5)"}}>{data.name}</div>
        {data.location&&<div style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:"rgba(255,255,255,0.25)"}}>{data.location}</div>}
        <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:"rgba(255,255,255,0.2)"}}>Powered by HackFest Hub</div>
      </footer>
    </div>
  );
}

/* ── Mini primitives ─────────────────────────────────────────────────────── */
const Pill=({children,style={}})=>(
  <div style={{display:"inline-flex",alignItems:"center",padding:"7px 16px",fontSize:13,
    background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",
    borderRadius:9999,color:"rgba(255,255,255,0.75)",fontFamily:"'Inter',sans-serif",...style}}>
    {children}
  </div>
);
const StatBadge=({icon,val,label})=>(
  <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 20px",
    background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12}}>
    <span style={{fontSize:20}}>{icon}</span>
    <div>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:18,fontWeight:700,color:"#fff",lineHeight:1}}>{val}</div>
      <div style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2}}>{label}</div>
    </div>
  </div>
);

// expose TIER_ORDER for partner section
const TIER_ORDER=["platinum","gold","silver","bronze","media","general"];
