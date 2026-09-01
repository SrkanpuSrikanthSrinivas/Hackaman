import { useState, useEffect } from "react";

const BASE = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL || "";
const TOKEN = () => (typeof localStorage !== "undefined" ? localStorage.getItem("hf_token") : null);

const C = {
  ink:"#0E1116", inkSoft:"#1B212B", paper:"#F5F6F3", card:"#FFFFFF",
  cobalt:"#2F6BFF", cobaltDark:"#1E4FD6", coral:"#FF6A45",
  line:"#E4E6E0", lineSoft:"#EEF0EC", muted:"#5C6470", faint:"#8A929E", green:"#0EA5A0",
};
const DISPLAY = { fontFamily:"'Bricolage Grotesque','Inter',system-ui,sans-serif" };
const FF = { fontFamily:"'Inter',system-ui,sans-serif" };
const MM = { fontFamily:"'JetBrains Mono',ui-monospace,monospace" };
const TYPES = [["blog","Blog"],["journal","Journal"],["document","Document"],["tutorial","Technical write-up"]];
const COLORS = ["#2F6BFF","#8B5CF6","#0EA5A0","#FF6A45","#E11D48","#F59E0B","#0E1116"];

async function api(path, method="GET", body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type":"application/json", "Authorization":`Bearer ${TOKEN()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(d.error || "Something went wrong");
  return d;
}
function escapeHtml(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function renderMarkdown(md){
  if(!md) return "<p style='color:#8A929E'>Nothing yet — start writing on the left.</p>";
  let s = escapeHtml(md);
  s = s.replace(/```([\s\S]*?)```/g,(m,c)=>`<pre><code>${c.replace(/^\n/,"")}</code></pre>`);
  s = s.replace(/^###### (.*)$/gm,"<h6>$1</h6>").replace(/^##### (.*)$/gm,"<h5>$1</h5>")
       .replace(/^#### (.*)$/gm,"<h4>$1</h4>").replace(/^### (.*)$/gm,"<h3>$1</h3>")
       .replace(/^## (.*)$/gm,"<h2>$1</h2>").replace(/^# (.*)$/gm,"<h1>$1</h1>");
  s = s.replace(/^&gt; (.*)$/gm,"<blockquote>$1</blockquote>");
  s = s.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/(^|[^*])\*([^*]+)\*/g,"$1<em>$2</em>").replace(/`([^`]+)`/g,"<code>$1</code>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
  s = s.replace(/(?:^|\n)((?:- .*(?:\n|$))+)/g,(m,b)=>`\n<ul>${b.trim().split(/\n/).map(l=>`<li>${l.replace(/^- /,"")}</li>`).join("")}</ul>`);
  return s.split(/\n{2,}/).map(b=>{const t=b.trim();if(!t)return"";if(/^<(h\d|ul|pre|blockquote)/.test(t))return t;return `<p>${t.replace(/\n/g,"<br/>")}</p>`;}).join("\n");
}

const BLANK = { title:"", type:"blog", summary:"", content:"", tags:"", coverColor:"#2F6BFF", status:"draft" };

export default function WritePage() {
  const [authed]   = useState(!!TOKEN());
  const [mine, setMine] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState("");
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(()=>{ document.title = "Write — HackFest Hub"; return ()=>{ document.title="HackFest Hub"; }; }, []);
  const loadMine = () => { if(!authed) return; api("/api/posts/mine").then(setMine).catch(()=>{}); };
  useEffect(()=>{ loadMine(); }, []);

  const startNew = () => { setForm(BLANK); setEditingId(null); setPreview(false); setMsg(""); };
  const edit = (p) => {
    setForm({ title:p.title||"", type:p.type||"blog", summary:p.summary||"", content:p.content||"",
      tags:p.tags||"", coverColor:p.coverColor||"#2F6BFF", status:p.status||"draft" });
    setEditingId(p.id); setPreview(false); setMsg("");
    window.scrollTo({ top:0, behavior:"smooth" });
  };
  const save = async (status) => {
    if (!form.title.trim()) { setMsg("Add a title first."); return; }
    setBusy(true); setMsg("");
    try {
      const payload = { ...form, status };
      if (editingId) { const p = await api(`/api/posts/${editingId}`,"PUT",payload); setEditingId(p.id); }
      else { const p = await api("/api/posts","POST",payload); setEditingId(p.id); }
      setForm(f=>({ ...f, status }));
      setMsg(status==="published" ? "Published — it's live in the community." : "Draft saved.");
      loadMine();
    } catch(e){ setMsg(e.message); } finally { setBusy(false); }
  };
  const del = async (id) => {
    if (!confirm("Delete this post? This can't be undone.")) return;
    try { await api(`/api/posts/${id}`,"DELETE"); if (editingId===id) startNew(); loadMine(); }
    catch(e){ setMsg(e.message); }
  };

  const IN = { ...FF, width:"100%", padding:"11px 13px", borderRadius:10, border:`1px solid ${C.line}`,
    fontSize:14, background:C.card, color:C.ink, outline:"none" };
  const fonts = `@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');`;

  const Frame = ({ children }) => (
    <div style={{ ...FF, background:C.paper, color:C.ink, minHeight:"100vh" }}>
      <style>{`${fonts}
        *{box-sizing:border-box;margin:0;padding:0;}
        a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid ${C.cobalt};outline-offset:2px;border-radius:4px;}
        .wp-prev h1,.wp-prev h2,.wp-prev h3{font-family:'Bricolage Grotesque',sans-serif;letter-spacing:-0.01em;margin:1.2em 0 .4em;line-height:1.25;}
        .wp-prev h1{font-size:24px;}.wp-prev h2{font-size:20px;}.wp-prev h3{font-size:17px;}
        .wp-prev p{margin:0 0 1em;line-height:1.7;color:${C.inkSoft};}
        .wp-prev ul{margin:0 0 1em 1.2em;line-height:1.7;color:${C.inkSoft};}
        .wp-prev a{color:${C.cobalt};}
        .wp-prev code{font-family:'JetBrains Mono',monospace;font-size:13px;background:${C.lineSoft};padding:2px 6px;border-radius:5px;}
        .wp-prev pre{background:${C.ink};color:#E6EAF2;padding:14px 16px;border-radius:10px;overflow-x:auto;margin:0 0 1em;}
        .wp-prev pre code{background:none;padding:0;color:inherit;}
        .wp-prev blockquote{border-left:3px solid ${C.cobalt};padding-left:14px;margin:0 0 1em;color:${C.muted};font-style:italic;}
        @media (max-width:860px){ .wp-grid{grid-template-columns:1fr!important;} }
      `}</style>
      <nav style={{ position:"sticky", top:0, zIndex:50, background:"rgba(245,246,243,0.85)", backdropFilter:"blur(12px)", borderBottom:`1px solid ${C.line}` }}>
        <div style={{ maxWidth:1160, margin:"0 auto", padding:"0 24px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <a href="/" style={{ ...DISPLAY, fontSize:17, fontWeight:700, color:C.ink, letterSpacing:"-0.02em", textDecoration:"none" }}>HackFest Hub</a>
          <a href="/community" style={{ ...FF, fontSize:14, color:C.muted, textDecoration:"none" }}>← Back to community</a>
        </div>
      </nav>
      {children}
    </div>
  );

  if (!authed) {
    return (
      <Frame>
        <div style={{ maxWidth:440, margin:"80px auto", padding:"40px 32px", background:C.card, border:`1px solid ${C.line}`, borderRadius:16, textAlign:"center" }}>
          <div style={{ ...DISPLAY, fontSize:22, fontWeight:700, color:C.ink, marginBottom:10 }}>Sign in to write</div>
          <p style={{ ...FF, fontSize:14.5, color:C.muted, lineHeight:1.6, marginBottom:22 }}>
            Publishing is open to anyone with a HackFest Hub account — participants, organizers, and judges.
          </p>
          <a href="/admin" style={{ ...FF, display:"inline-block", background:C.cobalt, color:"#fff", fontWeight:600, fontSize:15, padding:"12px 26px", borderRadius:11, textDecoration:"none" }}>Sign in</a>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="wp-grid" style={{ maxWidth:1160, margin:"0 auto", padding:"32px 24px 80px",
        display:"grid", gridTemplateColumns:"1fr 300px", gap:28, alignItems:"start" }}>

        {/* Editor */}
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, gap:12, flexWrap:"wrap" }}>
            <h1 style={{ ...DISPLAY, fontSize:26, fontWeight:700, color:C.ink, letterSpacing:"-0.02em" }}>
              {editingId ? "Edit post" : "New post"}
            </h1>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setPreview(p=>!p)} style={{ ...FF, fontSize:13, fontWeight:500, padding:"9px 14px",
                borderRadius:9, cursor:"pointer", border:`1px solid ${C.line}`, background:preview?C.ink:C.card, color:preview?"#fff":C.muted }}>
                {preview ? "Edit" : "Preview"}
              </button>
            </div>
          </div>

          {msg && <div style={{ ...FF, fontSize:13, padding:"10px 14px", borderRadius:9, marginBottom:16,
            background: msg.includes("live")||msg.includes("saved") ? "rgba(14,165,160,0.1)" : "rgba(225,29,72,0.08)",
            color: msg.includes("live")||msg.includes("saved") ? C.green : "#b4232f",
            border:`1px solid ${msg.includes("live")||msg.includes("saved") ? "rgba(14,165,160,0.25)" : "rgba(225,29,72,0.2)"}` }}>{msg}</div>}

          {!preview ? (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <input value={form.title} onChange={sf("title")} placeholder="Post title" style={{ ...IN, ...DISPLAY, fontSize:20, fontWeight:700 }} />
              <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                <select value={form.type} onChange={sf("type")} style={{ ...IN, width:"auto", flex:"1 1 180px" }}>
                  {TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
                <input value={form.tags} onChange={sf("tags")} placeholder="tags, comma, separated" style={{ ...IN, flex:"2 1 220px" }} />
              </div>
              <input value={form.summary} onChange={sf("summary")} placeholder="One-line summary (shown in the feed)" style={IN} />
              <textarea value={form.content} onChange={sf("content")} rows={18}
                placeholder={"Write in Markdown…\n\n# Heading\n**bold**, *italic*, `code`\n\n- list item\n\n```\ncode block\n```\n\n[link](https://…)"}
                style={{ ...IN, ...MM, fontSize:13.5, lineHeight:1.7, resize:"vertical", minHeight:320 }} />
            </div>
          ) : (
            <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:14, padding:"28px 30px" }}>
              <h1 style={{ ...DISPLAY, fontSize:28, fontWeight:700, color:C.ink, letterSpacing:"-0.02em", marginBottom:6 }}>{form.title || "Untitled"}</h1>
              {form.summary && <p style={{ ...FF, fontSize:16, color:C.muted, lineHeight:1.55, margin:"8px 0 20px" }}>{form.summary}</p>}
              <div className="wp-prev" dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) }} />
            </div>
          )}

          <div style={{ display:"flex", gap:10, marginTop:20, flexWrap:"wrap" }}>
            <button onClick={()=>save("published")} disabled={busy}
              style={{ ...FF, fontSize:14, fontWeight:600, padding:"12px 22px", borderRadius:11, cursor:busy?"wait":"pointer",
                background:C.cobalt, color:"#fff", border:"none" }}>
              {busy ? "Saving…" : form.status==="published" ? "Update & keep live" : "Publish"}
            </button>
            <button onClick={()=>save("draft")} disabled={busy}
              style={{ ...FF, fontSize:14, fontWeight:600, padding:"12px 22px", borderRadius:11, cursor:busy?"wait":"pointer",
                background:C.card, color:C.ink, border:`1px solid ${C.line}` }}>
              Save draft
            </button>
            {editingId && <a href={`/read/${mine.find(p=>p.id===editingId)?.slug||""}`} target="_blank" rel="noreferrer"
              style={{ ...FF, fontSize:14, fontWeight:500, padding:"12px 18px", color:C.muted, textDecoration:"none", alignSelf:"center" }}>
              View live →
            </a>}
          </div>

          <div style={{ marginTop:22 }}>
            <div style={{ ...FF, fontSize:12, fontWeight:600, color:C.muted, marginBottom:8 }}>Accent color</div>
            <div style={{ display:"flex", gap:8 }}>
              {COLORS.map(c=>(
                <button key={c} onClick={()=>setForm(f=>({...f,coverColor:c}))} aria-label={`Accent ${c}`}
                  style={{ width:26, height:26, borderRadius:7, background:c, cursor:"pointer",
                    border: form.coverColor===c ? `2px solid ${C.ink}` : `2px solid transparent`, outline:`1px solid ${C.line}` }}/>
              ))}
            </div>
          </div>
        </div>

        {/* My posts */}
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <span style={{ ...FF, fontSize:13, fontWeight:700, color:C.ink, textTransform:"uppercase", letterSpacing:"0.05em" }}>Your posts</span>
            <button onClick={startNew} style={{ ...FF, fontSize:12.5, fontWeight:600, color:C.cobalt, background:"none", border:"none", cursor:"pointer" }}>+ New</button>
          </div>
          {mine.length===0 && <div style={{ ...FF, fontSize:13, color:C.faint, padding:"16px 0" }}>No posts yet. Your drafts and published pieces show up here.</div>}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {mine.map(p=>(
              <div key={p.id} style={{ background:C.card, border:`1px solid ${editingId===p.id?C.cobalt:C.line}`, borderRadius:11, padding:"12px 13px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:p.coverColor||C.cobalt, flexShrink:0 }}/>
                  <span style={{ ...FF, fontSize:13.5, fontWeight:600, color:C.ink, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ ...MM, fontSize:10.5, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em",
                    color: p.status==="published" ? C.green : C.faint }}>{p.status}</span>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={()=>edit(p)} style={{ ...FF, fontSize:12, color:C.cobalt, background:"none", border:"none", cursor:"pointer" }}>Edit</button>
                    <button onClick={()=>del(p.id)} style={{ ...FF, fontSize:12, color:C.muted, background:"none", border:"none", cursor:"pointer" }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}
