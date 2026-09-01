import { useState, useEffect } from "react";

const BASE = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL || "";

const C = {
  ink:"#0E1116", inkSoft:"#1B212B", paper:"#F5F6F3", card:"#FFFFFF",
  cobalt:"#2F6BFF", cobaltDark:"#1E4FD6", coral:"#FF6A45",
  line:"#E4E6E0", lineSoft:"#EEF0EC", muted:"#5C6470", faint:"#8A929E",
};
const DISPLAY = { fontFamily:"'Bricolage Grotesque','Inter',system-ui,sans-serif" };
const FF = { fontFamily:"'Inter',system-ui,sans-serif" };
const MM = { fontFamily:"'JetBrains Mono',ui-monospace,monospace" };

const TYPES = {
  blog:     { label:"Blog",           tint:"#2F6BFF" },
  journal:  { label:"Journal",        tint:"#8B5CF6" },
  document: { label:"Document",       tint:"#0EA5A0" },
  tutorial: { label:"Technical write-up", tint:"#FF6A45" },
};

const fonts = `@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');`;

function fmtDate(d) {
  if (!d) return "";
  const m = typeof d === "string" && d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dt = m ? new Date(+m[1], +m[2]-1, +m[3]) : new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}

// ── Minimal, safe Markdown → HTML (escapes first, then a limited tag set) ──────
function escapeHtml(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function renderMarkdown(md){
  if (!md) return "";
  let s = escapeHtml(md);
  s = s.replace(/```([\s\S]*?)```/g, (m,code)=>`<pre><code>${code.replace(/^\n/,"")}</code></pre>`);
  s = s.replace(/^###### (.*)$/gm,"<h6>$1</h6>").replace(/^##### (.*)$/gm,"<h5>$1</h5>")
       .replace(/^#### (.*)$/gm,"<h4>$1</h4>").replace(/^### (.*)$/gm,"<h3>$1</h3>")
       .replace(/^## (.*)$/gm,"<h2>$1</h2>").replace(/^# (.*)$/gm,"<h1>$1</h1>");
  s = s.replace(/^&gt; (.*)$/gm,"<blockquote>$1</blockquote>");
  s = s.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")
       .replace(/(^|[^*])\*([^*]+)\*/g,"$1<em>$2</em>")
       .replace(/`([^`]+)`/g,"<code>$1</code>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
  s = s.replace(/(?:^|\n)((?:- .*(?:\n|$))+)/g, (m,block)=>{
    const items = block.trim().split(/\n/).map(l=>`<li>${l.replace(/^- /,"")}</li>`).join("");
    return `\n<ul>${items}</ul>`;
  });
  return s.split(/\n{2,}/).map(b=>{
    const t=b.trim(); if(!t) return "";
    if(/^<(h\d|ul|pre|blockquote)/.test(t)) return t;
    return `<p>${t.replace(/\n/g,"<br/>")}</p>`;
  }).join("\n");
}

function Shell({ children }) {
  return (
    <div style={{ ...FF, background:C.paper, color:C.ink, minHeight:"100vh" }}>
      <style>{`${fonts}
        *{box-sizing:border-box;margin:0;padding:0;}
        a{color:inherit;}
        ::selection{background:${C.cobalt};color:#fff;}
        a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid ${C.cobalt};outline-offset:2px;border-radius:4px;}
        .cm-card:hover{transform:translateY(-3px);box-shadow:0 16px 34px -20px rgba(14,17,22,.35);border-color:${C.cobalt};}
        .cm-article h1,.cm-article h2,.cm-article h3{font-family:'Bricolage Grotesque','Inter',sans-serif;color:${C.ink};letter-spacing:-0.01em;line-height:1.25;margin:1.4em 0 .5em;}
        .cm-article h1{font-size:26px;} .cm-article h2{font-size:22px;} .cm-article h3{font-size:18px;}
        .cm-article p{margin:0 0 1.05em;line-height:1.75;color:${C.inkSoft};font-size:16px;}
        .cm-article ul{margin:0 0 1.05em 1.2em;line-height:1.75;color:${C.inkSoft};}
        .cm-article li{margin:.25em 0;}
        .cm-article a{color:${C.cobalt};text-decoration:underline;text-underline-offset:2px;}
        .cm-article code{font-family:'JetBrains Mono',monospace;font-size:13.5px;background:${C.lineSoft};padding:2px 6px;border-radius:5px;}
        .cm-article pre{background:${C.ink};color:#E6EAF2;padding:16px 18px;border-radius:12px;overflow-x:auto;margin:0 0 1.2em;}
        .cm-article pre code{background:none;padding:0;color:inherit;font-size:13px;line-height:1.6;}
        .cm-article blockquote{border-left:3px solid ${C.cobalt};padding:2px 0 2px 16px;margin:0 0 1.1em;color:${C.muted};font-style:italic;}
        @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}
      `}</style>
      <nav style={{ position:"sticky", top:0, zIndex:50, background:"rgba(245,246,243,0.85)",
        backdropFilter:"blur(12px)", borderBottom:`1px solid ${C.line}` }}>
        <div style={{ maxWidth:1080, margin:"0 auto", padding:"0 24px", height:60,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <a href="/" style={{ ...DISPLAY, fontSize:17, fontWeight:700, color:C.ink, letterSpacing:"-0.02em", textDecoration:"none" }}>HackFest Hub</a>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <a href="/community" style={{ ...FF, fontSize:14, color:C.ink, fontWeight:600, padding:"8px 12px", textDecoration:"none" }}>Community</a>
            <a href="/#events" style={{ ...FF, fontSize:14, color:C.muted, padding:"8px 12px", textDecoration:"none" }}>Events</a>
            <a href="/write" style={{ ...FF, fontSize:14, fontWeight:600, color:"#fff", background:C.cobalt,
              padding:"9px 16px", borderRadius:9, textDecoration:"none" }}>Write a post</a>
          </div>
        </div>
      </nav>
      {children}
      <footer style={{ background:C.ink, padding:"40px 24px", marginTop:64 }}>
        <div style={{ maxWidth:1080, margin:"0 auto", display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
          <span style={{ ...DISPLAY, fontSize:15, fontWeight:700, color:"#fff" }}>HackFest Hub</span>
          <span style={{ ...FF, fontSize:12, color:"rgba(255,255,255,0.4)" }}>© {new Date().getFullYear()} HackFest Hub</span>
        </div>
      </footer>
    </div>
  );
}

// ── Community listing ─────────────────────────────────────────────────────────
export default function CommunityPage() {
  const [posts, setPosts] = useState([]);
  const [type, setType]   = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    document.title = "Community — HackFest Hub";
    return ()=>{ document.title = "HackFest Hub"; };
  }, []);

  const load = (t=type, s=search) => {
    setLoading(true);
    fetch(`${BASE}/api/public/posts?type=${t}&search=${encodeURIComponent(s)}&limit=48`)
      .then(r=>r.json()).then(d=>setPosts(d.posts||[])).catch(()=>{}).finally(()=>setLoading(false));
  };
  useEffect(()=>{ load(); }, []);

  const eyebrow = { ...MM, fontSize:12, fontWeight:600, color:C.cobalt, letterSpacing:"0.12em", textTransform:"uppercase" };

  return (
    <Shell>
      <section style={{ padding:"64px 24px 30px" }}>
        <div style={{ maxWidth:1080, margin:"0 auto" }}>
          <div style={{ ...eyebrow, marginBottom:14 }}>Community</div>
          <h1 style={{ ...DISPLAY, fontSize:"clamp(30px,4vw,46px)", fontWeight:700, color:C.ink, letterSpacing:"-0.03em", lineHeight:1.06, marginBottom:14 }}>
            Blogs, journals & technical write-ups
          </h1>
          <p style={{ ...FF, fontSize:17, color:C.muted, lineHeight:1.6, maxWidth:600 }}>
            What builders are learning, shipping, and documenting. Share your own — a build log, a tutorial, or notes from your last hackathon.
          </p>
        </div>
      </section>

      <section style={{ padding:"0 24px 64px" }}>
        <div style={{ maxWidth:1080, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:26, justifyContent:"space-between" }}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {[["","All"],["blog","Blogs"],["journal","Journals"],["document","Documents"],["tutorial","Write-ups"]].map(([v,l])=>(
                <button key={v} onClick={()=>{ setType(v); load(v,search); }}
                  style={{ ...FF, fontSize:13, fontWeight:500, padding:"9px 15px", borderRadius:9, cursor:"pointer",
                    border:`1px solid ${type===v?C.ink:C.line}`, background:type===v?C.ink:C.card,
                    color:type===v?"#fff":C.muted, transition:"all .15s" }}>{l}</button>
              ))}
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load(type,search)}
              placeholder="Search posts…"
              style={{ ...FF, minWidth:220, padding:"10px 14px", borderRadius:10, border:`1px solid ${C.line}`,
                fontSize:14, background:C.card, color:C.ink }} />
          </div>

          {loading && <div style={{ textAlign:"center", padding:60, ...MM, fontSize:14, color:C.faint }}>Loading…</div>}

          {!loading && posts.length===0 && (
            <div style={{ textAlign:"center", padding:"56px 24px", border:`1px dashed ${C.line}`, borderRadius:14, background:C.card }}>
              <div style={{ ...DISPLAY, fontSize:19, fontWeight:700, color:C.ink, marginBottom:8 }}>Nothing here yet</div>
              <div style={{ ...FF, fontSize:14, color:C.muted }}>Be the first to publish — <a href="/write" style={{ color:C.cobalt, fontWeight:600, textDecoration:"none" }}>write a post</a>.</div>
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
            {posts.map(p=>{
              const ty = TYPES[p.type] || TYPES.blog;
              const tags = (p.tags||"").split(",").map(t=>t.trim()).filter(Boolean).slice(0,3);
              return (
                <a key={p.id} href={`/read/${p.slug}`} className="cm-card"
                  style={{ textDecoration:"none", display:"flex", flexDirection:"column", background:C.card,
                    borderRadius:14, border:`1px solid ${C.line}`, overflow:"hidden",
                    transition:"transform .18s, box-shadow .18s, border-color .18s" }}>
                  <div style={{ height:6, background:p.coverColor || ty.tint }}/>
                  <div style={{ padding:"18px 20px 20px", display:"flex", flexDirection:"column", flex:1 }}>
                    <span style={{ ...MM, fontSize:10.5, fontWeight:600, color:ty.tint, textTransform:"uppercase",
                      letterSpacing:"0.06em", marginBottom:10 }}>{ty.label}</span>
                    <h3 style={{ ...DISPLAY, fontSize:18, fontWeight:700, color:C.ink, lineHeight:1.28, letterSpacing:"-0.01em", marginBottom:8 }}>{p.title}</h3>
                    {p.summary && <p style={{ ...FF, fontSize:13.5, color:C.muted, lineHeight:1.6, marginBottom:14, flex:1,
                      display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{p.summary}</p>}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10,
                      borderTop:`1px solid ${C.lineSoft}`, paddingTop:12, marginTop:"auto" }}>
                      <span style={{ ...FF, fontSize:12, color:C.faint }}>{p.authorName || "A builder"}</span>
                      <span style={{ ...MM, fontSize:11, color:C.faint }}>{fmtDate(p.publishedAt)}</span>
                    </div>
                    {tags.length>0 && (
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:12 }}>
                        {tags.map(t=><span key={t} style={{ ...FF, fontSize:10.5, color:C.muted, background:C.paper,
                          border:`1px solid ${C.line}`, padding:"3px 8px", borderRadius:6 }}>{t}</span>)}
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>
    </Shell>
  );
}

// ── Single post reader ────────────────────────────────────────────────────────
export function PostReaderPage() {
  const slug = window.location.pathname.split("/read/")[1]?.split(/[?#]/)[0] || "";
  const [post, setPost] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(()=>{
    if (!slug) { setState("missing"); return; }
    fetch(`${BASE}/api/public/posts/${encodeURIComponent(slug)}`)
      .then(r=> r.ok ? r.json() : Promise.reject())
      .then(p=>{
        setPost(p); setState("ok");
        document.title = `${p.title} — HackFest Hub`;
        const setMeta = (n,c,prop)=>{ const sel=prop?`meta[property="${n}"]`:`meta[name="${n}"]`; let el=document.querySelector(sel);
          if(!el){el=document.createElement("meta");el.setAttribute(prop?"property":"name",n);document.head.appendChild(el);} el.setAttribute("content",c); };
        if (p.summary) setMeta("description", p.summary);
        setMeta("og:title", p.title, true);
        if (p.summary) setMeta("og:description", p.summary, true);
      })
      .catch(()=>setState("missing"));
    return ()=>{ document.title = "HackFest Hub"; };
  }, [slug]);

  const ty = post ? (TYPES[post.type] || TYPES.blog) : TYPES.blog;
  const tags = post ? (post.tags||"").split(",").map(t=>t.trim()).filter(Boolean) : [];

  return (
    <Shell>
      <article style={{ maxWidth:720, margin:"0 auto", padding:"56px 24px 20px" }}>
        <a href="/community" style={{ ...FF, fontSize:13, color:C.muted, textDecoration:"none", display:"inline-flex", gap:6, marginBottom:26 }}>← All posts</a>

        {state==="loading" && <div style={{ ...MM, fontSize:14, color:C.faint, padding:"40px 0" }}>Loading…</div>}

        {state==="missing" && (
          <div style={{ textAlign:"center", padding:"56px 24px", border:`1px dashed ${C.line}`, borderRadius:14, background:C.card }}>
            <div style={{ ...DISPLAY, fontSize:20, fontWeight:700, color:C.ink, marginBottom:8 }}>Post not found</div>
            <div style={{ ...FF, fontSize:14, color:C.muted }}>It may have been unpublished. <a href="/community" style={{ color:C.cobalt, fontWeight:600, textDecoration:"none" }}>Browse the community</a>.</div>
          </div>
        )}

        {state==="ok" && post && (
          <>
            <span style={{ ...MM, fontSize:11, fontWeight:600, color:ty.tint, textTransform:"uppercase", letterSpacing:"0.07em" }}>{ty.label}</span>
            <h1 style={{ ...DISPLAY, fontSize:"clamp(28px,4vw,42px)", fontWeight:700, color:C.ink, letterSpacing:"-0.03em", lineHeight:1.1, margin:"12px 0 16px" }}>{post.title}</h1>
            <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:8 }}>
              <span style={{ ...FF, fontSize:14, color:C.inkSoft, fontWeight:600 }}>{post.authorName || "A builder"}</span>
              <span style={{ ...MM, fontSize:12, color:C.faint }}>{fmtDate(post.publishedAt)}</span>
            </div>
            {post.summary && <p style={{ ...FF, fontSize:18, color:C.muted, lineHeight:1.55, margin:"14px 0 26px" }}>{post.summary}</p>}
            <div style={{ height:1, background:C.line, marginBottom:28 }}/>
            <div className="cm-article" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }} />
            {tags.length>0 && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:32, paddingTop:24, borderTop:`1px solid ${C.line}` }}>
                {tags.map(t=><span key={t} style={{ ...FF, fontSize:12, color:C.muted, background:C.card,
                  border:`1px solid ${C.line}`, padding:"5px 11px", borderRadius:8 }}>#{t}</span>)}
              </div>
            )}
            <div style={{ marginTop:40, padding:"24px", background:C.card, border:`1px solid ${C.line}`, borderRadius:14, textAlign:"center" }}>
              <div style={{ ...DISPLAY, fontSize:18, fontWeight:700, color:C.ink, marginBottom:6 }}>Got something to share?</div>
              <div style={{ ...FF, fontSize:14, color:C.muted, marginBottom:16 }}>Publish your own write-up on HackFest Hub.</div>
              <a href="/write" style={{ ...FF, display:"inline-block", background:C.cobalt, color:"#fff", fontWeight:600,
                fontSize:14, padding:"11px 22px", borderRadius:10, textDecoration:"none" }}>Write a post</a>
            </div>
          </>
        )}
      </article>
    </Shell>
  );
}
