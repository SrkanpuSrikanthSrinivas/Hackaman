import { useState, useEffect, useRef } from "react";

const BASE = ["localhost","127.0.0.1"].includes(window.location.hostname) ? "http://localhost:3001" : "";
const pget  = p => fetch(`${BASE}${p}`).then(r=>r.json());
const ppost = (p,b) => fetch(`${BASE}${p}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(r=>r.json());

/* ── utils ─────────────────────────────────────────────────────────────────── */
const fmt  = d => { if(!d)return""; const s=typeof d==="string"&&d.length<=10?d+"T12:00:00":d; const dt=new Date(s); return isNaN(dt)?"":dt.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}); };
const fmtS = d => { if(!d)return""; const s=typeof d==="string"&&d.length<=10?d+"T12:00:00":d; const dt=new Date(s); return isNaN(dt)?"":dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };
const ytId = url => { const m=url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/); return m?m[1]:null; };
const vimId= url => { const m=url?.match(/vimeo\.com\/(?:video\/)?(\d+)/); return m?m[1]:null; };

const F = {fontFamily:"'Inter',sans-serif"};
const M = {fontFamily:"'Space Mono',monospace"};

/* ── Countdown ──────────────────────────────────────────────────────────────── */
function Countdown({target}){
  const[t,setT]=useState({d:0,h:0,m:0,s:0});
  useEffect(()=>{
    const tick=()=>{const d=new Date(target)-Date.now();if(d<=0){setT({d:0,h:0,m:0,s:0});return;}setT({d:Math.floor(d/864e5),h:Math.floor(d%864e5/36e5),m:Math.floor(d%36e5/6e4),s:Math.floor(d%6e4/1e3)});};
    tick();const id=setInterval(tick,1000);return()=>clearInterval(id);
  },[target]);
  const B=({v,l})=>(
    <div style={{textAlign:"center"}}>
      <div style={{...M,fontSize:"clamp(28px,4vw,52px)",fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:12,padding:"12px 18px",minWidth:72,lineHeight:1}}>{String(v).padStart(2,"0")}</div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:7,letterSpacing:"0.12em",textTransform:"uppercase"}}>{l}</div>
    </div>
  );
  const Sep=()=><div style={{fontSize:32,color:"rgba(255,255,255,0.2)",paddingTop:10,...M}}>:</div>;
  return<div style={{display:"flex",gap:10,alignItems:"flex-start",justifyContent:"center"}}><B v={t.d} l="Days"/><Sep/><B v={t.h} l="Hours"/><Sep/><B v={t.m} l="Mins"/><Sep/><B v={t.s} l="Secs"/></div>;
}

/* ── AnimBg ─────────────────────────────────────────────────────────────────── */
function AnimBg({color="#6366f1"}){
  return(
    <div style={{position:"absolute",inset:0,overflow:"hidden",zIndex:0}}>
      <div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,#070b14 0%,${color}22 50%,#070b14 100%)`}}/>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 50% at 50% -5%,rgba(99,102,241,0.15) 0%,transparent 70%)"}}/>
      <div style={{position:"absolute",inset:0,opacity:0.025,backgroundImage:"linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)",backgroundSize:"60px 60px"}}/>
      <div style={{position:"absolute",top:"-20%",left:"50%",transform:"translateX(-50%)",width:800,height:800,borderRadius:"50%",background:`${color}15`,filter:"blur(120px)",pointerEvents:"none"}}/>
    </div>
  );
}

/* ── Nav ────────────────────────────────────────────────────────────────────── */
function Nav({name,logo,accent,tabs,onReg}){
  const[sc,setSc]=useState(false);
  const[mo,setMo]=useState(false);
  useEffect(()=>{const fn=()=>setSc(window.scrollY>50);window.addEventListener("scroll",fn);return()=>window.removeEventListener("scroll",fn);},[]);
  const go=id=>{document.getElementById(id)?.scrollIntoView({behavior:"smooth"});setMo(false);};
  return(
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:200,
      background:sc?"rgba(7,11,20,0.95)":"transparent",
      backdropFilter:sc?"blur(16px)":"none",
      borderBottom:sc?"1px solid rgba(255,255,255,0.06)":"none",
      transition:"all 0.3s"}}>
      <div style={{maxWidth:1200,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {logo&&<img src={logo} style={{height:36,objectFit:"contain"}} />}
          <span style={{...M,fontSize:15,fontWeight:700,color:"#fff"}}>{name}</span>
        </div>
        <div style={{display:"flex",gap:1,flexWrap:"nowrap",overflowX:"auto"}}>
          {tabs.filter(t=>t.show).map(t=>(
            <button key={t.id} onClick={()=>go(t.id)}
              style={{...F,background:"none",border:"none",color:"rgba(255,255,255,0.55)",
                borderBottom:"2px solid transparent",fontSize:12,fontWeight:500,cursor:"pointer",
                padding:"6px 10px",whiteSpace:"nowrap",transition:"color 0.2s"}}
              onMouseEnter={e=>e.target.style.color="#fff"}
              onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.55)"}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={onReg}
          style={{...F,background:accent,color:"#fff",border:"none",borderRadius:8,
            padding:"8px 20px",fontSize:13,fontWeight:700,cursor:"pointer",
            boxShadow:`0 0 20px ${accent}66`,whiteSpace:"nowrap"}}>
          Register
        </button>
      </div>
    </nav>
  );
}

/* ── Person Card ────────────────────────────────────────────────────────────── */
function PersonCard({p,accent="#6366f1",size="md"}){
  const sz=size==="lg"?100:76;
  const init=(p.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const colors=["#6366f1","#8b5cf6","#ec4899","#06b6d4","#10b981","#f59e0b"];
  const bg=colors[(p.name||"").charCodeAt(0)%colors.length];
  return(
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
      borderRadius:16,padding:size==="lg"?"28px 20px":"20px 16px",textAlign:"center",
      transition:"all 0.2s",cursor:"default"}}
      onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.07)";e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.borderColor="rgba(255,255,255,0.14)";}}
      onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.transform="none";e.currentTarget.style.borderColor="rgba(255,255,255,0.07)";}}>
      <div style={{width:sz,height:sz,borderRadius:"50%",margin:"0 auto",marginBottom:14,
        overflow:"hidden",border:"3px solid rgba(255,255,255,0.1)",
        background:p.avatarUrl?"transparent":bg,
        display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 20px ${bg}44`}}>
        {p.avatarUrl?<img src={p.avatarUrl} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"} />
          :<span style={{...M,fontSize:sz*0.3,fontWeight:700,color:"#fff"}}>{init}</span>}
      </div>
      <div style={{...F,fontSize:size==="lg"?16:14,fontWeight:600,color:"#fff",marginBottom:4}}>{p.name}</div>
      {p.title&&<div style={{...F,fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:3,lineHeight:1.4}}>{p.title}</div>}
      {p.org&&<div style={{...F,fontSize:12,color:accent,fontWeight:500,marginBottom:6}}>{p.org}</div>}
      {p.sessionTopic&&<div style={{...F,fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:6,fontStyle:"italic"}}>"{p.sessionTopic}"</div>}
      {p.bio&&<p style={{...F,fontSize:11,color:"rgba(255,255,255,0.35)",lineHeight:1.6,textAlign:"left",marginBottom:8}}>{p.bio.slice(0,120)}{p.bio.length>120?"…":""}</p>}
      {(p.linkedinUrl||p.twitterUrl)&&(
        <div style={{display:"flex",gap:8,justifyContent:"center"}}>
          {p.linkedinUrl&&<a href={p.linkedinUrl} target="_blank" rel="noopener" style={{...F,fontSize:12,color:accent,textDecoration:"none",padding:"3px 8px",border:`1px solid ${accent}44`,borderRadius:4}}>in</a>}
          {p.twitterUrl&&<a href={p.twitterUrl} target="_blank" rel="noopener" style={{...F,fontSize:12,color:"#1d9bf0",textDecoration:"none",padding:"3px 8px",border:"1px solid #1d9bf044",borderRadius:4}}>𝕏</a>}
        </div>
      )}
    </div>
  );
}

/* ── Section wrapper ────────────────────────────────────────────────────────── */
const S=({id,children,dark,style={}})=>(
  <section id={id} style={{padding:"80px 24px",background:dark?"#06091a":"#0a0d1a",...style}}>
    <div style={{maxWidth:1100,margin:"0 auto"}}>{children}</div>
  </section>
);
const SHead=({eyebrow,title,sub,accent="#6366f1"})=>(
  <div style={{textAlign:"center",marginBottom:52}}>
    {eyebrow&&<div style={{...M,fontSize:10,letterSpacing:"0.25em",color:accent,textTransform:"uppercase",marginBottom:14}}>{eyebrow}</div>}
    <h2 style={{...F,fontSize:"clamp(26px,3.5vw,42px)",fontWeight:700,color:"#fff",letterSpacing:"-0.02em",marginBottom:12,lineHeight:1.15}}>{title}</h2>
    {sub&&<p style={{...F,fontSize:16,color:"rgba(255,255,255,0.45)",maxWidth:540,margin:"0 auto",lineHeight:1.7}}>{sub}</p>}
  </div>
);

/* ── Track card ─────────────────────────────────────────────────────────────── */
const TC=[["#6366f1","🤖"],["#10b981","🌱"],["#f59e0b","🔐"],["#ec4899","🌍"],["#06b6d4","📚"],["#8b5cf6","💳"],["#ef4444","❤️"],["#f97316","🛠️"],["#84cc16","🔓"],["#eab308","⚡"]];
function TrackCard({name,i}){
  const[c,ic]=TC[i%TC.length];
  return(
    <div style={{background:`${c}14`,border:`1px solid ${c}33`,borderRadius:14,padding:"24px 20px",textAlign:"center",transition:"transform 0.2s"}}
      onMouseEnter={e=>e.currentTarget.style.transform="translateY(-3px)"}
      onMouseLeave={e=>e.currentTarget.style.transform="none"}>
      <div style={{fontSize:36,marginBottom:12}}>{ic}</div>
      <div style={{...F,fontSize:15,fontWeight:600,color:c}}>{name}</div>
    </div>
  );
}

/* ── Partner ────────────────────────────────────────────────────────────────── */
const TIERS=["platinum","gold","silver","bronze","media","general"];
const TLABEL={platinum:"Platinum",gold:"Gold",silver:"Silver",bronze:"Bronze",media:"Media Partner",general:"Community Partner"};
const TSIZE={platinum:180,gold:150,silver:120,bronze:96,media:90,general:80};
function PartnerRow({tier,list,accent}){
  const sz=TSIZE[tier]||90;
  return(
    <div style={{marginBottom:40}}>
      <div style={{...M,fontSize:10,color:accent,letterSpacing:"0.2em",textTransform:"uppercase",textAlign:"center",marginBottom:20}}>{TLABEL[tier]}</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:16,justifyContent:"center",alignItems:"center"}}>
        {list.map(p=>(
          <a key={p.id} href={p.websiteUrl||"#"} target="_blank" rel="noopener"
            style={{display:"flex",alignItems:"center",justifyContent:"center",
              background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:12,padding:"16px 24px",textDecoration:"none",transition:"all 0.2s",
              minWidth:sz,minHeight:64}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.1)";e.currentTarget.style.borderColor="rgba(255,255,255,0.2)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";}}>
            {p.logoUrl
              ?<img src={p.logoUrl} alt={p.name} style={{maxHeight:sz*0.38,maxWidth:sz*1.6,objectFit:"contain",filter:"brightness(0) invert(1)",opacity:0.8}} />
              :<span style={{...F,fontSize:15,fontWeight:600,color:"rgba(255,255,255,0.6)"}}>{p.name}</span>}
          </a>
        ))}
      </div>
    </div>
  );
}

/* ── FAQ ────────────────────────────────────────────────────────────────────── */
function FAQItem({q,a,accent}){
  const[open,setOpen]=useState(false);
  return(
    <div style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
      <button onClick={()=>setOpen(!open)}
        style={{width:"100%",textAlign:"left",background:"none",border:"none",cursor:"pointer",
          padding:"18px 0",display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,...F}}>
        <span style={{fontSize:15,fontWeight:600,color:"#fff"}}>{q}</span>
        <span style={{fontSize:22,color:accent,transition:"transform 0.25s",flexShrink:0,
          transform:open?"rotate(45deg)":"none"}}>+</span>
      </button>
      {open&&<div style={{...F,fontSize:14,color:"rgba(255,255,255,0.5)",paddingBottom:18,lineHeight:1.75}}>{a}</div>}
    </div>
  );
}

/* ── Stats Counter ──────────────────────────────────────────────────────────── */
function StatCounter({icon,value,label,accent}){
  return(
    <div style={{textAlign:"center",padding:"20px 16px"}}>
      <div style={{fontSize:28,marginBottom:8}}>{icon}</div>
      <div style={{...M,fontSize:"clamp(28px,4vw,44px)",fontWeight:700,color:"#fff",lineHeight:1,marginBottom:6}}>{value}</div>
      <div style={{...F,fontSize:13,color:"rgba(255,255,255,0.45)"}}>{label}</div>
    </div>
  );
}

/* ── Video Embed ────────────────────────────────────────────────────────────── */
function VideoEmbed({url}){
  const yt=ytId(url);const vi=vimId(url);
  if(!url)return null;
  let src=null;
  if(yt) src=`https://www.youtube.com/embed/${yt}?rel=0&modestbranding=1`;
  else if(vi) src=`https://player.vimeo.com/video/${vi}`;
  if(!src)return<a href={url} target="_blank" rel="noopener" style={{color:"#818cf8"}}>{url}</a>;
  return(
    <div style={{position:"relative",paddingTop:"56.25%",borderRadius:16,overflow:"hidden",
      border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
      <iframe src={src} style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}}
        allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"
        allowFullScreen title="Event Video" />
    </div>
  );
}

/* ── Gallery ────────────────────────────────────────────────────────────────── */
function Gallery({images}){
  const[sel,setSel]=useState(null);
  const list=(images||"").split("\n").map(s=>s.trim()).filter(Boolean);
  if(!list.length)return null;
  return(
    <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
        {list.map((src,i)=>(
          <div key={i} onClick={()=>setSel(src)}
            style={{aspectRatio:"4/3",borderRadius:12,overflow:"hidden",cursor:"pointer",
              border:"1px solid rgba(255,255,255,0.07)",transition:"transform 0.2s"}}
            onMouseEnter={e=>e.currentTarget.style.transform="scale(1.02)"}
            onMouseLeave={e=>e.currentTarget.style.transform="none"}>
            <img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
          </div>
        ))}
      </div>
      {sel&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:999,
          display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
          onClick={()=>setSel(null)}>
          <img src={sel} style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:12,objectFit:"contain"}} />
          <button onClick={()=>setSel(null)} style={{position:"fixed",top:20,right:20,background:"none",
            border:"none",color:"#fff",fontSize:32,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
      )}
    </>
  );
}

/* ── Testimonials ───────────────────────────────────────────────────────────── */
function Testimonials({text,accent}){
  const items=(text||"").split("\n\n").filter(Boolean).map(b=>{
    const lines=b.split("\n");
    return{quote:lines[0]?.replace(/^[""]/, "").replace(/[""]$/, ""),author:lines[1]||"",role:lines[2]||""};
  });
  if(!items.length)return null;
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
      {items.map((t,i)=>(
        <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:16,padding:24,position:"relative"}}>
          <div style={{fontSize:40,color:accent,lineHeight:1,marginBottom:12,opacity:0.5}}>"</div>
          <p style={{...F,fontSize:14,color:"rgba(255,255,255,0.7)",lineHeight:1.7,marginBottom:16,fontStyle:"italic"}}>{t.quote}</p>
          <div style={{...F,fontSize:13,fontWeight:600,color:"#fff"}}>{t.author}</div>
          {t.role&&<div style={{...F,fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:2}}>{t.role}</div>}
        </div>
      ))}
    </div>
  );
}

/* ── Schedule ───────────────────────────────────────────────────────────────── */
function Schedule({text,accent}){
  const lines=(text||"").split("\n").filter(Boolean);
  if(!lines.length)return null;
  // Detect day headers (lines that don't have "|")
  const items=lines.map(l=>{
    if(!l.includes("|"))return{type:"day",label:l};
    const[time,...rest]=l.split("|");
    return{type:"event",time:time.trim(),event:rest.join("|").trim()};
  });
  return(
    <div style={{maxWidth:700,margin:"0 auto"}}>
      {items.map((item,i)=>
        item.type==="day"?(
          <div key={i} style={{...M,fontSize:12,color:accent,letterSpacing:"0.15em",
            textTransform:"uppercase",marginTop:i>0?32:0,marginBottom:16,
            paddingBottom:10,borderBottom:`1px solid ${accent}33`}}>
            {item.label}
          </div>
        ):(
          <div key={i} style={{display:"flex",gap:20,marginBottom:18,alignItems:"flex-start"}}>
            <div style={{...M,fontSize:12,color:"rgba(255,255,255,0.35)",minWidth:80,flexShrink:0,paddingTop:2}}>{item.time}</div>
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:accent,flexShrink:0,marginTop:5}} />
              <div style={{...F,fontSize:14,color:"rgba(255,255,255,0.8)",lineHeight:1.5}}>{item.event}</div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* ── Registration Form ──────────────────────────────────────────────────────── */
function RegForm({hackathonId,accent,deadline}){
  const[type,setType]=useState("team");
  const[form,setForm]=useState({});
  const[busy,setBusy]=useState(false);
  const[done,setDone]=useState(false);
  const[err,setErr]=useState("");
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const IS={...F,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
    borderRadius:8,padding:"11px 14px",fontSize:14,color:"#fff",width:"100%",outline:"none"};
  const fo=e=>e.target.style.borderColor=accent;
  const bl=e=>e.target.style.borderColor="rgba(255,255,255,0.12)";
  const submit=async e=>{
    e.preventDefault();if(!form.name?.trim()||!form.email?.trim())return;
    setBusy(true);setErr("");
    const r=await ppost("/api/public/register",{...form,hackathonId,type});
    if(r.error)setErr(r.error);else setDone(true);setBusy(false);
  };
  if(done)return(
    <div style={{textAlign:"center",padding:"56px 24px"}}>
      <div style={{fontSize:56,marginBottom:16}}>🎉</div>
      <h3 style={{...F,fontSize:22,fontWeight:700,color:"#fff",marginBottom:10}}>Application Received!</h3>
      <p style={{...F,fontSize:14,color:"rgba(255,255,255,0.5)"}}>We'll be in touch at <strong style={{color:"#fff"}}>{form.email}</strong> soon.</p>
    </div>
  );
  return(
    <>
      {deadline&&<div style={{...F,textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:20}}>
        ⏳ Registration closes: <strong style={{color:accent}}>{deadline}</strong>
      </div>}
      <div style={{display:"flex",gap:2,marginBottom:24,background:"rgba(255,255,255,0.05)",
        borderRadius:10,padding:3,border:"1px solid rgba(255,255,255,0.08)"}}>
        {["team","judge"].map(t=>(
          <button key={t} onClick={()=>setType(t)} style={{flex:1,padding:"9px",fontSize:13,
            fontWeight:600,borderRadius:8,border:"none",cursor:"pointer",transition:"all 0.15s",
            ...F,textTransform:"capitalize",
            background:type===t?accent:"transparent",color:type===t?"#fff":"rgba(255,255,255,0.4)"}}>
            {t==="team"?"🚀 Register as Team":"⭐ Apply as Judge"}
          </button>
        ))}
      </div>
      {err&&<div style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",
        borderRadius:8,padding:"10px 14px",fontSize:13,color:"#f87171",marginBottom:14}}>⚠ {err}</div>}
      <form onSubmit={submit}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div><label style={{...F,display:"block",fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>Full Name *</label>
            <input style={IS} value={form.name||""} onChange={f("name")} onFocus={fo} onBlur={bl} required /></div>
          <div><label style={{...F,display:"block",fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>Email *</label>
            <input type="email" style={IS} value={form.email||""} onChange={f("email")} onFocus={fo} onBlur={bl} required /></div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{...F,display:"block",fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>Organization / University</label>
          <input style={IS} value={form.org||""} onChange={f("org")} onFocus={fo} onBlur={bl} placeholder="Optional" />
        </div>
        {type==="team"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><label style={{...F,display:"block",fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>Team Name</label>
              <input style={IS} value={form.teamName||""} onChange={f("teamName")} onFocus={fo} onBlur={bl} /></div>
            <div><label style={{...F,display:"block",fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>Team Size</label>
              <input type="number" min={1} max={10} style={IS} value={form.teamSize||""} onChange={f("teamSize")} onFocus={fo} onBlur={bl} /></div>
          </div>
        )}
        <div style={{marginBottom:20}}>
          <label style={{...F,display:"block",fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.4)",marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>
            {type==="team"?"Project Idea / Background":"Expertise & Experience"}
          </label>
          <textarea style={{...IS,resize:"vertical",minHeight:88}} value={form.message||""} onChange={f("message")} onFocus={fo} onBlur={bl} />
        </div>
        <button type="submit" disabled={busy} style={{width:"100%",background:accent,color:"#fff",border:"none",
          borderRadius:10,padding:"13px",fontSize:15,fontWeight:700,cursor:"pointer",...F,
          display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          boxShadow:`0 8px 28px ${accent}55`,transition:"opacity 0.2s",opacity:busy?0.7:1}}>
          {busy&&<div style={{width:15,height:15,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite"}} />}
          {busy?"Submitting…":type==="team"?"Submit Team Application →":"Submit Judge Application →"}
        </button>
      </form>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PUBLIC PAGE
══════════════════════════════════════════════════════════════════════════════ */
export default function PublicPage({hackathonId}){
  const[data,setData]=useState(null);
  const[loading,setLoading]=useState(true);
  const[err,setErr]=useState("");

  useEffect(()=>{
    // Admin preview: ?preview=1&token=... uses authenticated endpoint (works unpublished)
    const params  = new URLSearchParams(window.location.search);
    const isPreview = params.get("preview") === "1";
    const previewToken = params.get("token");
    const endpoint = isPreview ? `/api/pubpage/preview/${hackathonId}` : `/api/pubpage/${hackathonId}`;
    const headers  = isPreview && previewToken ? { Authorization: `Bearer ${previewToken}` } : {};

    fetch(`${BASE}${endpoint}`, { headers })
      .then(async r=>{const d=await r.json();if(!r.ok||d.error)setErr(d.error||`Error ${r.status}`);else{setData(d);if(isPreview)window.history.replaceState({},"",window.location.pathname);}setLoading(false);})
      .catch(e=>{setErr("Could not reach server: "+e.message);setLoading(false);});
  },[hackathonId]);

  if(loading)return(
    <div style={{minHeight:"100vh",background:"#070b14",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:44,height:44,border:"3px solid rgba(255,255,255,0.1)",borderTopColor:"#6366f1",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if(err)return(
    <div style={{minHeight:"100vh",background:"#070b14",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#fff",...F,padding:24,textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:16}}>🔒</div>
      <div style={{fontSize:18,fontWeight:600,marginBottom:8}}>Page Not Available</div>
      <div style={{fontSize:14,color:"rgba(255,255,255,0.45)",maxWidth:400,lineHeight:1.6}}>{err}</div>
    </div>
  );

  const accent=data.bannerColor||"#6366f1";
  const tracks=(data.tracks||"").split(",").map(t=>t.trim()).filter(Boolean);
  const faqItems=(data.faq||"").split("\n\n").filter(Boolean).map(b=>{const[q,...a]=b.split("\n");return{q:q?.replace(/^Q:\s*/i,""),a:a.join("\n").replace(/^A:\s*/i,"")};});
  const tGroups={};(data.partners||[]).forEach(p=>(tGroups[p.tier]||(tGroups[p.tier]=[])).push(p));
  const statsItems=(data.websiteStats||"").split("\n").filter(Boolean).map(l=>{const[icon,value,...rest]=l.split("|");return{icon:icon?.trim(),value:value?.trim(),label:rest.join("|").trim()};});
  const galleryImages=(data.galleryImages||"").split("\n").filter(Boolean);
  const hasSocials=data.socialTwitter||data.socialLinkedin||data.socialInstagram||data.socialFacebook;

  const navTabs=[
    {id:"about",      label:"About",          show:!!(data.websiteAbout||data.description)},
    {id:"tracks",     label:"Tracks",         show:tracks.length>0},
    {id:"schedule",   label:"Schedule",       show:!!(data.schedule)},
    {id:"keynotes",   label:"Keynotes",       show:data.keynotes?.length>0},
    {id:"chairs",     label:"Session Chairs", show:data.sessionChairs?.length>0},
    {id:"judges",     label:"Judges",         show:data.judges?.length>0},
    {id:"team",       label:"Team",           show:data.team?.length>0},
    {id:"partners",   label:"Partners",       show:data.partners?.length>0},
    {id:"prizes",     label:"Prizes",         show:!!(data.websitePrizes)},
    {id:"gallery",    label:"Gallery",        show:galleryImages.length>0},
    {id:"register",   label:"Register",       show:true},
  ];
  const scrollReg=()=>document.getElementById("register")?.scrollIntoView({behavior:"smooth"});

  // Show preview banner
  const params2 = new URLSearchParams(window.location.search);
  const showBanner = params2.get("preview") === "1" || data?._preview;

  return(
    <div style={{...F,background:"#070b14",color:"#fff",overflowX:"hidden"}}>
      {showBanner&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:999,background:"#d97706",color:"#fff",
          textAlign:"center",padding:"10px 16px",...F,fontSize:13,fontWeight:600}}>
          👁 Preview Mode — this page is not yet published publicly
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;scroll-padding-top:68px;}
        input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.2);}
        input:focus,textarea:focus{outline:none;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-track{background:#070b14;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>

      <Nav name={data.name} logo={data.eventLogoUrl} accent={accent} tabs={navTabs} onReg={scrollReg} />

      {/* ── HERO ── */}
      <section style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
        justifyContent:"center",textAlign:"center",padding:"100px 24px 60px",position:"relative",overflow:"hidden"}}>
        <AnimBg color={accent} />
        <div style={{position:"relative",zIndex:1,maxWidth:900,animation:"fadeUp 0.8s ease both"}}>
          {/* Status badge */}
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.07)",
            border:"1px solid rgba(255,255,255,0.12)",borderRadius:9999,padding:"5px 16px",
            fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.75)",letterSpacing:"0.08em",
            textTransform:"uppercase",marginBottom:28}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:accent,animation:"pulse 2s infinite",display:"inline-block"}} />
            {data.status==="active"?"Registration Open":data.status==="upcoming"?"Coming Soon":"Event Concluded"}
          </div>

          {/* Logo */}
          {data.eventLogoUrl&&<div style={{marginBottom:20}}><img src={data.eventLogoUrl} alt={data.name} style={{maxHeight:80,maxWidth:320,objectFit:"contain"}} /></div>}

          <h1 style={{fontSize:"clamp(36px,7vw,80px)",fontWeight:800,lineHeight:1.04,
            letterSpacing:"-0.03em",marginBottom:18,
            background:"linear-gradient(135deg,#fff 0%,rgba(255,255,255,0.65) 100%)",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            {data.name}
          </h1>

          {data.tagline&&<p style={{fontSize:"clamp(15px,2.2vw,22px)",color:"rgba(255,255,255,0.55)",
            marginBottom:36,lineHeight:1.65,maxWidth:600,margin:"0 auto 36px"}}>{data.tagline}</p>}

          {/* Info pills */}
          <div style={{display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap",marginBottom:48}}>
            {data.startDate&&<Pill>📅 {fmtS(data.startDate)}{data.endDate?` – ${fmtS(data.endDate)}`:""}</Pill>}
            {data.location&&<Pill>📍 {data.location}</Pill>}
            {data.prizePool&&<Pill style={{borderColor:`${accent}55`,color:accent}}>🏆 {data.prizePool}</Pill>}
            {data.maxParticipants&&<Pill>👥 {data.maxParticipants}+ Participants</Pill>}
          </div>

          {/* Countdown */}
          {data.startDate&&new Date(data.startDate)>new Date()&&(
            <div style={{marginBottom:48}}>
              <div style={{...M,fontSize:10,color:"rgba(255,255,255,0.25)",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:20}}>Event starts in</div>
              <Countdown target={data.startDate} />
            </div>
          )}

          {/* CTAs */}
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:data.contactEmail?24:0}}>
            <button onClick={scrollReg} style={{...F,background:accent,color:"#fff",border:"none",
              borderRadius:12,padding:"14px 36px",fontSize:16,fontWeight:700,cursor:"pointer",
              boxShadow:`0 8px 32px ${accent}55`,transition:"all 0.2s"}}
              onMouseEnter={e=>{e.target.style.transform="translateY(-2px)";e.target.style.boxShadow=`0 14px 40px ${accent}66`;}}
              onMouseLeave={e=>{e.target.style.transform="none";e.target.style.boxShadow=`0 8px 32px ${accent}55`;}}>
              Register Now →
            </button>
            <button onClick={()=>document.getElementById("about")?.scrollIntoView({behavior:"smooth"})}
              style={{...F,background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.8)",
                border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,
                padding:"14px 28px",fontSize:16,fontWeight:600,cursor:"pointer",transition:"all 0.2s"}}
              onMouseEnter={e=>e.target.style.background="rgba(255,255,255,0.12)"}
              onMouseLeave={e=>e.target.style.background="rgba(255,255,255,0.07)"}>
              Learn More
            </button>
          </div>

          {/* Contact */}
          {data.contactEmail&&(
            <a href={`mailto:${data.contactEmail}`} style={{...F,fontSize:13,color:"rgba(255,255,255,0.3)",textDecoration:"none"}}>
              📩 {data.contactEmail}
            </a>
          )}
        </div>

        {/* Scroll indicator */}
        <div style={{position:"absolute",bottom:28,left:"50%",transform:"translateX(-50%)",
          display:"flex",flexDirection:"column",alignItems:"center",gap:6,opacity:0.3}}>
          <div style={{width:1,height:40,background:"linear-gradient(to bottom,rgba(255,255,255,0.4),transparent)"}} />
        </div>
      </section>

      {/* ── STATS ── */}
      {statsItems.length>0&&(
        <div style={{background:`${accent}0d`,borderTop:`1px solid ${accent}22`,borderBottom:`1px solid ${accent}22`,padding:"28px 24px"}}>
          <div style={{maxWidth:1100,margin:"0 auto",display:"grid",gridTemplateColumns:`repeat(${Math.min(statsItems.length,5)},1fr)`,gap:8}}>
            {statsItems.map((s,i)=><StatCounter key={i} icon={s.icon} value={s.value} label={s.label} accent={accent} />)}
          </div>
        </div>
      )}

      {/* ── ABOUT ── */}
      {(data.websiteAbout||data.description)&&(
        <S id="about" dark>
          <div style={{display:"grid",gridTemplateColumns:"1.1fr 1fr",gap:64,alignItems:"center"}}>
            <div>
              <div style={{...M,fontSize:10,color:accent,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:16}}>About the Event</div>
              <h2 style={{...F,fontSize:"clamp(24px,3.5vw,40px)",fontWeight:700,color:"#fff",letterSpacing:"-0.02em",marginBottom:20,lineHeight:1.2}}>{data.name}</h2>
              <p style={{...F,fontSize:15,color:"rgba(255,255,255,0.55)",lineHeight:1.85,marginBottom:28}}>{data.websiteAbout||data.description}</p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[["📅","Date",data.startDate?`${fmt(data.startDate)}${data.endDate?` – ${fmt(data.endDate)}`:""}`:""],
                  ["📍","Location",data.location],["🏆","Prize Pool",data.prizePool],
                  ["📩","Contact",data.contactEmail]].filter(([,,v])=>v).map(([ic,lb,vl])=>(
                  <div key={lb} style={{display:"flex",gap:12,alignItems:"center"}}>
                    <span style={{fontSize:16}}>{ic}</span>
                    <span style={{...F,fontSize:12,color:"rgba(255,255,255,0.3)",minWidth:70}}>{lb}</span>
                    <span style={{...F,fontSize:14,color:"rgba(255,255,255,0.8)",fontWeight:500}}>{vl}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[["🚀","Innovation","Push boundaries and think beyond the obvious"],
                ["🤝","Community","Collaborate with brilliant minds globally"],
                ["🎓","Mentorship","Learn from industry experts in real time"],
                ["🌍","Impact","Create solutions that matter to real people"]].map(([ic,t,d])=>(
                <div key={t} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:20}}>
                  <div style={{fontSize:26,marginBottom:10}}>{ic}</div>
                  <div style={{...F,fontSize:14,fontWeight:600,color:"#fff",marginBottom:6}}>{t}</div>
                  <div style={{...F,fontSize:12,color:"rgba(255,255,255,0.4)",lineHeight:1.6}}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </S>
      )}

      {/* ── VIDEO ── */}
      {data.promoVideoUrl&&(
        <S id="video">
          <SHead eyebrow="Watch" title="Event Highlights" accent={accent} />
          <div style={{maxWidth:800,margin:"0 auto"}}>
            <VideoEmbed url={data.promoVideoUrl} />
          </div>
        </S>
      )}

      {/* ── TRACKS ── */}
      {tracks.length>0&&(
        <S id="tracks" dark>
          <SHead eyebrow="Challenge Areas" title="Hackathon Tracks" accent={accent}
            sub="Choose your domain and build something the world needs." />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
            {tracks.map((t,i)=><TrackCard key={t} name={t} i={i} />)}
          </div>
        </S>
      )}

      {/* ── SCHEDULE ── */}
      {data.schedule&&(
        <S id="schedule">
          <SHead eyebrow="Agenda" title="Event Schedule" accent={accent} />
          <Schedule text={data.schedule} accent={accent} />
        </S>
      )}

      {/* ── KEYNOTES ── */}
      {data.keynotes?.length>0&&(
        <S id="keynotes" dark>
          <SHead eyebrow="Keynote Speakers" title="Visionaries Taking the Stage" accent={accent}
            sub="Industry leaders sharing insights that will inspire and challenge you." />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:16}}>
            {data.keynotes.map(k=><PersonCard key={k.id} person={k} accent={accent} size="lg" />)}
          </div>
        </S>
      )}

      {/* ── SESSION CHAIRS ── */}
      {data.sessionChairs?.length>0&&(
        <S id="chairs">
          <SHead eyebrow="Session Chairs" title="Guiding the Conversation" accent={accent}
            sub="Experienced moderators keeping sessions sharp and insightful." />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
            {data.sessionChairs.map(s=><PersonCard key={s.id} person={s} accent={accent} />)}
          </div>
        </S>
      )}

      {/* ── JUDGES ── */}
      {data.judges?.length>0&&(
        <S id="judges" dark>
          <SHead eyebrow="Evaluation Panel" title="Meet the Judges" accent={accent}
            sub="A distinguished panel of practitioners who will evaluate your submissions." />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
            {data.judges.map(j=><PersonCard key={j.id} person={j} accent={accent} />)}
          </div>
        </S>
      )}

      {/* ── TEAM ── */}
      {data.team?.length>0&&(
        <S id="team">
          <SHead eyebrow="Organizing Committee" title="Meet the Team" accent={accent}
            sub="The people working behind the scenes to make this event happen." />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
            {data.team.map(m=><PersonCard key={m.id} person={m} accent={accent} />)}
          </div>
        </S>
      )}

      {/* ── PARTNERS ── */}
      {TIERS.filter(t=>tGroups[t]).length>0&&(
        <S id="partners" dark>
          <SHead eyebrow="Sponsors & Partners" title="Who Makes This Possible" accent={accent} />
          {TIERS.filter(t=>tGroups[t]).map(tier=>(
            <PartnerRow key={tier} tier={tier} list={tGroups[tier]} accent={accent} />
          ))}
        </S>
      )}

      {/* ── PRIZES ── */}
      {data.websitePrizes&&(
        <S id="prizes">
          <SHead eyebrow="Awards" title="Prizes & Recognition" accent={accent}
            sub="Compete for meaningful rewards and industry recognition." />
          {(()=>{
            const ICONS=["🥇","🥈","🥉","🏅","⭐","🎖️"];
            const COLORS=[["#fef3c7","rgba(250,190,10,0.3)"],["#f1f5f9","rgba(200,200,200,0.2)"],["#fef3e2","rgba(180,100,30,0.2)"],["#f0fdf4","rgba(16,185,129,0.2)"],["#eff6ff","rgba(59,130,246,0.2)"],["#fdf4ff","rgba(139,92,246,0.2)"]];
            const prizes=data.websitePrizes.split("\n").filter(Boolean).map((l,i)=>{const[title,...rest]=l.split("|");return{icon:ICONS[i]||"🏅",title:title.trim(),desc:rest.join("|").trim(),colors:COLORS[i]||COLORS[0]};});
            return(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14}}>
                {prizes.map((p,i)=>(
                  <div key={i} style={{background:p.colors[1],border:`1px solid ${p.colors[0]}44`,borderRadius:14,padding:"28px 22px",textAlign:"center"}}>
                    <div style={{fontSize:40,marginBottom:12}}>{p.icon}</div>
                    <div style={{...F,fontSize:17,fontWeight:700,color:"#fff",marginBottom:8}}>{p.title}</div>
                    {p.desc&&<div style={{...F,fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>{p.desc}</div>}
                  </div>
                ))}
              </div>
            );
          })()}
        </S>
      )}

      {/* ── TESTIMONIALS ── */}
      {data.websiteTestimonials&&(
        <S id="testimonials" dark>
          <SHead eyebrow="What People Say" title="Past Participant Voices" accent={accent} />
          <Testimonials text={data.websiteTestimonials} accent={accent} />
        </S>
      )}

      {/* ── GALLERY ── */}
      {galleryImages.length>0&&(
        <S id="gallery">
          <SHead eyebrow="Memories" title="Event Gallery" accent={accent}
            sub="Highlights from our events." />
          <Gallery images={data.galleryImages} />
        </S>
      )}

      {/* ── VENUE ── */}
      {(data.venueName||data.venueAddress)&&(
        <S id="venue" dark>
          <SHead eyebrow="Location" title="Venue" accent={accent} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:40,alignItems:"center",maxWidth:800,margin:"0 auto"}}>
            <div>
              {data.venueName&&<h3 style={{...F,fontSize:22,fontWeight:700,color:"#fff",marginBottom:12}}>{data.venueName}</h3>}
              {data.venueAddress&&<p style={{...F,fontSize:14,color:"rgba(255,255,255,0.5)",lineHeight:1.7,marginBottom:20,whiteSpace:"pre-line"}}>{data.venueAddress}</p>}
              {data.venueMapsUrl&&(
                <a href={data.venueMapsUrl} target="_blank" rel="noopener"
                  style={{...F,display:"inline-flex",alignItems:"center",gap:6,padding:"10px 18px",
                    background:accent,color:"#fff",borderRadius:8,fontSize:13,fontWeight:600,
                    textDecoration:"none",transition:"opacity 0.2s"}}
                  onMouseEnter={e=>e.target.style.opacity="0.85"}
                  onMouseLeave={e=>e.target.style.opacity="1"}>
                  📍 Get Directions
                </a>
              )}
            </div>
            {data.venueMapsUrl&&data.venueMapsUrl.includes("maps.google")&&(
              <div style={{borderRadius:16,overflow:"hidden",height:250,border:"1px solid rgba(255,255,255,0.08)"}}>
                <iframe
                  src={data.venueMapsUrl.replace("/maps/","/maps/embed/")}
                  style={{width:"100%",height:"100%",border:"none"}} loading="lazy"
                  title="Venue map" />
              </div>
            )}
          </div>
        </S>
      )}

      {/* ── FAQ ── */}
      {faqItems.filter(f=>f.q).length>0&&(
        <S id="faq">
          <SHead eyebrow="Questions?" title="Frequently Asked" accent={accent} />
          <div style={{maxWidth:720,margin:"0 auto"}}>
            {faqItems.filter(f=>f.q).map((item,i)=><FAQItem key={i} q={item.q} a={item.a} accent={accent} />)}
          </div>
        </S>
      )}

      {/* ── REGISTER ── */}
      <S id="register" dark style={{background:`${accent}0a`,borderTop:`1px solid ${accent}20`}}>
        <div style={{maxWidth:580,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <div style={{...M,fontSize:10,color:accent,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:14}}>Applications Open</div>
            <h2 style={{...F,fontSize:"clamp(28px,4vw,48px)",fontWeight:800,color:"#fff",letterSpacing:"-0.03em",marginBottom:12}}>Ready to Build?</h2>
            <p style={{...F,fontSize:16,color:"rgba(255,255,255,0.45)",lineHeight:1.7}}>
              Applications are reviewed on a rolling basis. Spots are limited.
            </p>
          </div>
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:32,backdropFilter:"blur(12px)"}}>
            <RegForm hackathonId={hackathonId} accent={accent} deadline={data.registrationDeadline} />
          </div>
        </div>
      </S>

      {/* ── FOOTER ── */}
      <footer style={{background:"#04060f",borderTop:"1px solid rgba(255,255,255,0.05)",padding:"36px 24px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:20,marginBottom:hasSocials?24:0}}>
            <div>
              {data.eventLogoUrl&&<img src={data.eventLogoUrl} style={{height:32,objectFit:"contain",marginBottom:8,display:"block"}} />}
              <div style={{...M,fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.6)"}}>{data.name}</div>
              {data.tagline&&<div style={{...F,fontSize:12,color:"rgba(255,255,255,0.25)",marginTop:3}}>{data.tagline}</div>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,textAlign:"right"}}>
              {data.location&&<div style={{...F,fontSize:13,color:"rgba(255,255,255,0.3)"}}>📍 {data.location}</div>}
              {data.contactEmail&&<a href={`mailto:${data.contactEmail}`} style={{...F,fontSize:13,color:"rgba(255,255,255,0.3)",textDecoration:"none"}}>📩 {data.contactEmail}</a>}
            </div>
          </div>
          {hasSocials&&(
            <div style={{display:"flex",gap:10,justifyContent:"center",paddingTop:20,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
              {data.socialTwitter&&<SocBtn href={data.socialTwitter} label="𝕏 Twitter" />}
              {data.socialLinkedin&&<SocBtn href={data.socialLinkedin} label="in LinkedIn" />}
              {data.socialInstagram&&<SocBtn href={data.socialInstagram} label="📸 Instagram" />}
              {data.socialFacebook&&<SocBtn href={data.socialFacebook} label="f Facebook" />}
            </div>
          )}
          <div style={{...F,fontSize:12,color:"rgba(255,255,255,0.15)",textAlign:"center",marginTop:24}}>
            © {new Date().getFullYear()} {data.name} · Powered by HackFest Hub
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Mini helpers ─────────────────────────────────────────────────────────── */
const Pill=({children,style={}})=>(
  <div style={{display:"inline-flex",alignItems:"center",padding:"7px 16px",fontSize:13,
    background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",
    borderRadius:9999,color:"rgba(255,255,255,0.75)",...F,...style}}>
    {children}
  </div>
);
const SocBtn=({href,label})=>(
  <a href={href} target="_blank" rel="noopener" style={{...F,fontSize:12,fontWeight:500,
    padding:"7px 14px",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,
    color:"rgba(255,255,255,0.5)",textDecoration:"none",transition:"all 0.2s"}}
    onMouseEnter={e=>{e.target.style.color="#fff";e.target.style.borderColor="rgba(255,255,255,0.3)";}}
    onMouseLeave={e=>{e.target.style.color="rgba(255,255,255,0.5)";e.target.style.borderColor="rgba(255,255,255,0.1)";}}>
    {label}
  </a>
);
