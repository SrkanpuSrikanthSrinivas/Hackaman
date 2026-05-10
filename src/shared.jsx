import { useState, useEffect, useCallback } from "react";

/* ─── API ────────────────────────────────────────────────────────────────── */
const IS_LOCAL = typeof window !== "undefined" &&
  ["localhost","127.0.0.1"].includes(window.location.hostname);
const BASE = IS_LOCAL ? "http://localhost:3001" : "";

function tok() { try { return localStorage.getItem("hf_token")||""; } catch { return ""; } }
async function apiFetch(path, opts={}) {
  const t = tok();
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type":"application/json", ...(t ? {"Authorization":`Bearer ${t}`} : {}) },
    ...opts,
  });
  if (!res.ok) { const b = await res.json().catch(()=>({error:res.statusText})); throw new Error(b.error||res.statusText); }
  return res.json();
}
export const GET    = p     => apiFetch(p);
export const POST   = (p,b) => apiFetch(p,{method:"POST",  body:JSON.stringify(b)});
export const PUT    = (p,b) => apiFetch(p,{method:"PUT",   body:JSON.stringify(b)});
export const DEL    = p     => apiFetch(p,{method:"DELETE"});
export const PGET   = p     => fetch(`${BASE}${p}`).then(r=>r.json());
export const PPOST  = (p,b) => fetch(`${BASE}${p}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(r=>r.json());

/* ─── UTILS ─────────────────────────────────────────────────────────────── */
export const fmtDate = d => {
  if (!d) return "—";
  // Postgres returns full ISO timestamps; only append T12:00:00 for bare date strings
  const s = (typeof d === "string" && d.length <= 10) ? d + "T12:00:00" : d;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
};
export const fmtDt   = d => d ? new Date(d).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
export const initials= n => (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

export function calcScore(scores, criteria) {
  let num=0, den=0;
  criteria.forEach(c => { if (scores?.[c.id]!=null) { num+=(scores[c.id]/c.maxScore)*c.weight; den+=c.weight; } });
  return den>0 ? +(num/den*10).toFixed(1) : null;
}
export function avgOf(fbs, criteria) {
  if (!fbs?.length) return null;
  const vals = fbs.map(f=>calcScore(f.scores,criteria)).filter(s=>s!=null);
  return vals.length ? +(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : null;
}

export const STATUS_CHIP = { active:"green", upcoming:"amber", completed:"neutral" };
export const CAT_CHIP    = { "AI/ML":"blue","Sustainability":"green","Security":"amber","Social Impact":"purple","EdTech":"blue","FinTech":"green","Health":"green","Other":"neutral" };

/* ─── DESIGN TOKENS ─────────────────────────────────────────────────────── */
export const C = {
  bg:"#ffffff", bg2:"#f9fafb", bg3:"#f3f4f6",
  border:"#e5e7eb", border2:"#d1d5db",
  text:"#111827", text2:"#374151", text3:"#6b7280",
  blue:"#2563eb", green:"#16a34a", red:"#dc2626", amber:"#d97706", purple:"#7c3aed",
  bgBlue:"#eff6ff", bgGreen:"#f0fdf4", bgRed:"#fef2f2", bgAmber:"#fffbeb", bgPurple:"#f5f3ff",
  bdBlue:"#bfdbfe", bdGreen:"#bbf7d0", bdRed:"#fecaca", bdAmber:"#fde68a", bdPurple:"#ddd6fe",
};
export const FONT = { fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif" };
export const MONO = { fontFamily:"'IBM Plex Mono',monospace" };
export const R = { sm:"6px", md:"8px", lg:"12px" };

/* ─── PRIMITIVES ────────────────────────────────────────────────────────── */
export function Chip({ label, color="neutral" }) {
  const m = { blue:{bg:C.bgBlue,tx:C.blue,bd:C.bdBlue}, green:{bg:C.bgGreen,tx:C.green,bd:C.bdGreen},
    red:{bg:C.bgRed,tx:C.red,bd:C.bdRed}, amber:{bg:C.bgAmber,tx:C.amber,bd:C.bdAmber},
    purple:{bg:C.bgPurple,tx:C.purple,bd:C.bdPurple}, neutral:{bg:C.bg3,tx:C.text3,bd:C.border} };
  const s = m[color]||m.neutral;
  return <span style={{display:"inline-flex",alignItems:"center",fontSize:11,fontWeight:500,padding:"2px 8px",
    borderRadius:9999,background:s.bg,color:s.tx,border:`1px solid ${s.bd}`,...FONT}}>{label}</span>;
}

export function Btn({ children, variant="primary", size="md", onClick, type="button", disabled, full }) {
  const p = size==="sm"?"5px 11px":size==="lg"?"10px 22px":"7px 15px";
  const fs = size==="sm"?12:13;
  const base = {...FONT,fontWeight:500,borderRadius:R.sm,cursor:disabled?"not-allowed":"pointer",
    display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,opacity:disabled?0.5:1,
    transition:"all 0.12s",fontSize:fs,padding:p,width:full?"100%":undefined,userSelect:"none",border:"none"};
  const v = {
    primary:{background:C.text,color:"#fff"},
    secondary:{background:C.bg,color:C.text2,border:`1px solid ${C.border2}`},
    ghost:{background:"transparent",color:C.text3},
    danger:{background:C.bgRed,color:C.red,border:`1px solid ${C.bdRed}`},
    blue:{background:C.bgBlue,color:C.blue,border:`1px solid ${C.bdBlue}`},
    success:{background:C.bgGreen,color:C.green,border:`1px solid ${C.bdGreen}`},
  };
  return <button type={type} style={{...base,...(v[variant]||v.primary)}} onClick={onClick} disabled={disabled}>{children}</button>;
}

export const INPUT_STYLE = {...FONT,background:C.bg,border:`1px solid ${C.border2}`,borderRadius:R.sm,padding:"8px 11px",fontSize:13,color:C.text,width:"100%",outline:"none"};
export const TA_STYLE    = {...INPUT_STYLE,resize:"vertical",minHeight:80};

export function Field({ label, hint, required, children }) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{...FONT,display:"block",fontSize:12,fontWeight:500,color:C.text2,marginBottom:5}}>
        {label}{required&&<span style={{color:C.red,marginLeft:2}}>*</span>}
      </label>
      {children}
      {hint&&<p style={{...FONT,fontSize:11,color:C.text3,marginTop:3}}>{hint}</p>}
    </div>
  );
}

export function Avatar({ name, size=32, src }) {
  const bg=["#dbeafe","#dcfce7","#fef3c7","#fae8ff","#fce7f3","#e0f2fe"];
  const tx=["#1e40af","#15803d","#92400e","#6b21a8","#9d174d","#0369a1"];
  const i=(name||"").charCodeAt(0)%bg.length;
  if(src) return <img src={src} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0}} />;
  return <div style={{width:size,height:size,borderRadius:"50%",background:bg[i],color:tx[i],display:"flex",
    alignItems:"center",justifyContent:"center",...MONO,fontSize:size*0.34,fontWeight:500,flexShrink:0}}>{initials(name)}</div>;
}

export function Modal({ title, subtitle, onClose, children, width=520 }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(17,24,39,0.4)",zIndex:1000,display:"flex",
      alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(3px)"}} onClick={onClose}>
      <div style={{background:C.bg,borderRadius:R.lg,width:"100%",maxWidth:width,maxHeight:"92vh",overflow:"auto",
        boxShadow:"0 25px 60px rgba(0,0,0,0.2)",border:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 22px",
          borderBottom:`1px solid ${C.border}`}}>
          <div>
            <div style={{...FONT,fontSize:14,fontWeight:600,color:C.text}}>{title}</div>
            {subtitle&&<div style={{...FONT,fontSize:12,color:C.text3,marginTop:1}}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,
            color:C.text3,lineHeight:1,padding:"2px 6px",borderRadius:R.sm,...FONT}}>×</button>
        </div>
        <div style={{padding:"20px 22px"}}>{children}</div>
      </div>
    </div>
  );
}

export function Card({ children, pad=18, style={} }) {
  return <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:R.lg,padding:pad,...style}}>{children}</div>;
}

export function SectionHeader({ title, count, action }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div>
        <h1 style={{...FONT,fontSize:18,fontWeight:600,color:C.text,letterSpacing:"-0.01em",marginBottom:2}}>{title}</h1>
        {count!=null&&<p style={{...FONT,fontSize:12,color:C.text3}}>{count}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, sub, color }) {
  return (
    <Card>
      <div style={{...FONT,fontSize:11,fontWeight:500,color:C.text3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>{label}</div>
      <div style={{...MONO,fontSize:28,fontWeight:500,color:color||C.text,lineHeight:1,marginBottom:3}}>{value}</div>
      {sub&&<div style={{...FONT,fontSize:11,color:C.text3}}>{sub}</div>}
    </Card>
  );
}

export function ScoreBar({ value, max=10, color }) {
  const pct=Math.min(100,(value/max)*100);
  const c=color||(value>=8?C.green:value>=6?C.blue:value>=4?C.amber:C.red);
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{flex:1,background:C.bg3,borderRadius:3,height:5,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:c,borderRadius:3,transition:"width 0.4s"}} />
      </div>
      <span style={{...MONO,fontSize:12,color:C.text2,minWidth:34}}>{value}/{max}</span>
    </div>
  );
}

export function DataTable({ cols, rows, empty="No records found." }) {
  return (
    <div style={{border:`1px solid ${C.border}`,borderRadius:R.lg,overflow:"hidden",background:C.bg}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr style={{background:C.bg2,borderBottom:`1px solid ${C.border}`}}>
            {cols.map(c=><th key={c.key} style={{...FONT,textAlign:"left",padding:"9px 14px",fontSize:11,
              fontWeight:500,color:C.text3,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length===0
            ? <tr><td colSpan={cols.length} style={{...FONT,padding:"44px 14px",textAlign:"center",color:C.text3,fontSize:13}}>{empty}</td></tr>
            : rows.map((row,i)=>(
              <tr key={row.id||i} style={{borderBottom:i<rows.length-1?`1px solid ${C.border}`:"none",transition:"background 0.1s"}}
                onMouseEnter={e=>e.currentTarget.style.background=C.bg2}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                {cols.map(c=><td key={c.key} style={{...FONT,padding:"11px 14px",fontSize:13,color:C.text,verticalAlign:"middle"}}>
                  {c.render?c.render(row[c.key],row):(row[c.key]??"—")}</td>)}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}

export function Spinner({ size=14 }) {
  return <div style={{width:size,height:size,border:`2px solid ${C.border}`,borderTopColor:C.blue,
    borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}} />;
}

export function Empty({ icon="📂", title, sub, action }) {
  return (
    <Card style={{textAlign:"center",padding:"52px 24px"}}>
      <div style={{fontSize:36,marginBottom:14}}>{icon}</div>
      <div style={{...FONT,fontSize:14,fontWeight:600,color:C.text2,marginBottom:4}}>{title}</div>
      {sub&&<div style={{...FONT,fontSize:13,color:C.text3,marginBottom:action?18:0}}>{sub}</div>}
      {action}
    </Card>
  );
}

export function useData(enabled = true) {
  const [db,setDb]=useState({hackathons:[],teams:[],judges:[],criteria:[],feedbacks:[]});
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState(null);
  const load=useCallback(async()=>{
    setBusy(true);setErr(null);
    try {
      const [hackathons,teams,judges,criteria,feedbacks]=await Promise.all([
        GET("/api/hackathons"),GET("/api/teams"),GET("/api/judges"),GET("/api/criteria"),GET("/api/feedbacks"),
      ]);
      setDb({hackathons,teams,judges,criteria,feedbacks});
    } catch(e){setErr(e.message);}
    setBusy(false);
  },[]);
  useEffect(()=>{ if(enabled) load(); },[load,enabled]);
  return {db,busy,err,reload:load};
}
