import { useState, useEffect } from "react";

const BASE = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL || "";
const FF   = { fontFamily:"'Inter',system-ui,sans-serif" };
const MM   = { fontFamily:"'JetBrains Mono','Fira Code',monospace" };

const EVENT_TYPES = [
  { v:"corporate",  l:"Corporate hackathon",  icon:"🏢" },
  { v:"university", l:"University / student",  icon:"🎓" },
  { v:"community",  l:"Community / meetup",    icon:"🌍" },
  { v:"internal",   l:"Internal innovation",   icon:"💡" },
  { v:"other",      l:"Something else",        icon:"✨" },
];

const SIZES = ["Under 50", "50 – 150", "150 – 500", "500+", "Not sure yet"];

const TIMELINES = [
  "Within a month",
  "1 – 3 months",
  "3 – 6 months",
  "Just exploring",
];

export default function DemoRequestPage() {
  const [form, setForm] = useState({
    name:"", email:"", organization:"", role:"", phone:"",
    eventType:"", participants:"", timeline:"", message:"",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err,  setErr]  = useState("");

  const sf = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const pick = (k, v) => setForm(p => ({ ...p, [k]: p[k] === v ? "" : v }));

  useEffect(() => {
    document.title = "Request a Demo | HackFest Hub";
    let c = document.querySelector('link[rel="canonical"]');
    if (!c) { c = document.createElement("link"); c.rel = "canonical"; document.head.appendChild(c); }
    c.href = window.location.origin + "/demo";
    return () => { document.title = "HackFest Hub"; };
  }, []);

  const submit = async e => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { setErr("Name and email are required"); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${BASE}/api/demo-request`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(form),
      }).then(r => r.json());
      if (r.error) { setErr(r.error); setBusy(false); return; }
      setDone(true);
      window.scrollTo({ top:0, behavior:"smooth" });
    } catch(e) { setErr(e.message); }
    setBusy(false);
  };

  const IS = {
    ...FF, width:"100%", padding:"11px 14px", borderRadius:10,
    fontSize:14, color:"#111827", background:"#f9fafb",
    border:"1.5px solid #e5e7eb", outline:"none", transition:"all 0.15s",
  };

  const Label = ({ children, required }) => (
    <label style={{ display:"block", ...FF, fontSize:12, fontWeight:600,
      color:"#374151", marginBottom:6 }}>
      {children}{required && <span style={{ color:"#ef4444" }}> *</span>}
    </label>
  );

  const focus = e => { e.target.style.borderColor = "#4f46e5"; e.target.style.background = "#fff"; };
  const blur  = e => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; };

  /* ── Success state ── */
  if (done) return (
    <div style={{ minHeight:"100vh", background:"#f9fafb", ...FF,
      display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');"}</style>
      <div style={{ maxWidth:480, textAlign:"center" }}>
        <div style={{ fontSize:64, marginBottom:20 }}>🎉</div>
        <h1 style={{ fontSize:30, fontWeight:900, color:"#111827",
          letterSpacing:"-0.03em", marginBottom:12 }}>
          Request received!
        </h1>
        <p style={{ fontSize:16, color:"#6b7280", lineHeight:1.75, marginBottom:28 }}>
          Thanks, <strong style={{ color:"#374151" }}>{form.name.split(" ")[0]}</strong>.
          We'll reach out to <strong style={{ color:"#374151" }}>{form.email}</strong> within
          one business day to schedule your walkthrough.
        </p>
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:14,
          padding:"18px 22px", marginBottom:28, textAlign:"left" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#6b7280",
            textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>
            What happens next
          </div>
          {[
            "We review your request and event details",
            "We email you to find a time that works",
            "45-minute live walkthrough of the platform",
          ].map((s,i) => (
            <div key={i} style={{ display:"flex", gap:10, marginBottom:8, alignItems:"flex-start" }}>
              <span style={{ ...MM, fontSize:11, fontWeight:700, color:"#4f46e5",
                background:"#eef2ff", borderRadius:6, padding:"2px 7px", flexShrink:0 }}>
                {i+1}
              </span>
              <span style={{ fontSize:13, color:"#4b5563", lineHeight:1.6 }}>{s}</span>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
          <a href="/" style={{ ...FF, padding:"12px 24px", borderRadius:10,
            background:"#4f46e5", color:"#fff", fontSize:14, fontWeight:700,
            textDecoration:"none", boxShadow:"0 4px 14px rgba(79,70,229,0.3)" }}>
            ← Back to home
          </a>
          <a href="/#hackathons" style={{ ...FF, padding:"12px 24px", borderRadius:10,
            background:"#fff", color:"#4f46e5", fontSize:14, fontWeight:600,
            border:"1.5px solid #e5e7eb", textDecoration:"none" }}>
            Browse hackathons
          </a>
        </div>
      </div>
    </div>
  );

  /* ── Form ── */
  return (
    <div style={{ minHeight:"100vh", background:"#f9fafb", ...FF }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing:border-box; }
        ::selection { background:#4f46e5; color:#fff; }
      `}</style>

      {/* Nav */}
      <nav style={{ background:"#fff", borderBottom:"1px solid #e5e7eb",
        padding:"0 24px", height:60, display:"flex", alignItems:"center",
        justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <a href="/" style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none" }}>
          <span style={{ fontSize:20 }}>⚡</span>
          <span style={{ fontSize:15, fontWeight:800, color:"#111827",
            letterSpacing:"-0.02em" }}>HackFest Hub</span>
        </a>
        <a href="/" style={{ ...FF, fontSize:13, color:"#6b7280", textDecoration:"none" }}>
          ← Back to home
        </a>
      </nav>

      <div style={{ maxWidth:1000, margin:"0 auto", padding:"48px 24px 72px",
        display:"grid", gridTemplateColumns:"1fr 380px", gap:48, alignItems:"start" }}>

        {/* ── Left: info ── */}
        <div>
          <div style={{ ...FF, fontSize:11, fontWeight:700, color:"#4f46e5",
            letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:14 }}>
            Request a demo
          </div>
          <h1 style={{ fontSize:"clamp(30px,4vw,42px)", fontWeight:900, color:"#111827",
            letterSpacing:"-0.04em", lineHeight:1.15, marginBottom:16 }}>
            See HackFest Hub<br/>in action
          </h1>
          <p style={{ fontSize:16, color:"#6b7280", lineHeight:1.75, marginBottom:36, maxWidth:460 }}>
            Tell us a bit about your event and we'll walk you through exactly how
            HackFest Hub would work for you — no generic sales pitch.
          </p>

          <div style={{ marginBottom:36 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#374151",
              textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:16 }}>
              What we'll cover
            </div>
            {[
              { icon:"🏗️", t:"Event setup", d:"Building your public page, tracks, and registration flow" },
              { icon:"⚖️", t:"Judging system", d:"Weighted criteria, judge assignments, and conflict handling" },
              { icon:"🤖", t:"AI features", d:"Calibration, insights, screening, and the hackathon assistant" },
              { icon:"🎓", t:"Post-event", d:"Certificates, winner emails, data export, and reports" },
            ].map((f,i) => (
              <div key={i} style={{ display:"flex", gap:14, marginBottom:18, alignItems:"flex-start" }}>
                <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
                  background:"#eef2ff", display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:17 }}>
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#111827", marginBottom:2 }}>{f.t}</div>
                  <div style={{ fontSize:13, color:"#6b7280", lineHeight:1.6 }}>{f.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding:"16px 20px", background:"#fff",
            border:"1px solid #e5e7eb", borderRadius:12 }}>
            <div style={{ fontSize:12, color:"#6b7280", lineHeight:1.7 }}>
              Prefer email? Reach us directly at{" "}
              <a href="mailto:contact@hackfesthub.com"
                style={{ ...MM, color:"#4f46e5", fontWeight:600, textDecoration:"none" }}>
                contact@hackfesthub.com
              </a>
            </div>
          </div>
        </div>

        {/* ── Right: form ── */}
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:18,
          padding:28, boxShadow:"0 4px 24px rgba(0,0,0,0.05)", position:"sticky", top:84 }}>

          {err && (
            <div style={{ background:"#fef2f2", border:"1px solid #fecaca",
              borderRadius:10, padding:"11px 14px", marginBottom:18,
              fontSize:13, color:"#991b1b", ...FF }}>
              ⚠ {err}
            </div>
          )}

          <form onSubmit={submit}>
            <div style={{ marginBottom:16 }}>
              <Label required>Your name</Label>
              <input required value={form.name} onChange={sf("name")}
                placeholder="Jane Smith" style={IS} onFocus={focus} onBlur={blur} />
            </div>

            <div style={{ marginBottom:16 }}>
              <Label required>Work email</Label>
              <input required type="email" value={form.email} onChange={sf("email")}
                placeholder="jane@company.com" style={IS} onFocus={focus} onBlur={blur} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              <div>
                <Label>Organization</Label>
                <input value={form.organization} onChange={sf("organization")}
                  placeholder="Acme Inc" style={IS} onFocus={focus} onBlur={blur} />
              </div>
              <div>
                <Label>Your role</Label>
                <input value={form.role} onChange={sf("role")}
                  placeholder="Eng Manager" style={IS} onFocus={focus} onBlur={blur} />
              </div>
            </div>

            {/* Event type pills */}
            <div style={{ marginBottom:16 }}>
              <Label>Type of event</Label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {EVENT_TYPES.map(t => (
                  <button key={t.v} type="button" onClick={() => pick("eventType", t.v)}
                    style={{ ...FF, fontSize:12, fontWeight:500, padding:"7px 12px",
                      borderRadius:9999, cursor:"pointer", transition:"all 0.13s",
                      border:`1.5px solid ${form.eventType===t.v ? "#4f46e5" : "#e5e7eb"}`,
                      background:form.eventType===t.v ? "#eef2ff" : "#fff",
                      color:form.eventType===t.v ? "#4f46e5" : "#6b7280" }}>
                    {t.icon} {t.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Size pills */}
            <div style={{ marginBottom:16 }}>
              <Label>Expected participants</Label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {SIZES.map(s => (
                  <button key={s} type="button" onClick={() => pick("participants", s)}
                    style={{ ...FF, fontSize:12, fontWeight:500, padding:"7px 12px",
                      borderRadius:9999, cursor:"pointer", transition:"all 0.13s",
                      border:`1.5px solid ${form.participants===s ? "#4f46e5" : "#e5e7eb"}`,
                      background:form.participants===s ? "#eef2ff" : "#fff",
                      color:form.participants===s ? "#4f46e5" : "#6b7280" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline pills */}
            <div style={{ marginBottom:16 }}>
              <Label>When?</Label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {TIMELINES.map(t => (
                  <button key={t} type="button" onClick={() => pick("timeline", t)}
                    style={{ ...FF, fontSize:12, fontWeight:500, padding:"7px 12px",
                      borderRadius:9999, cursor:"pointer", transition:"all 0.13s",
                      border:`1.5px solid ${form.timeline===t ? "#4f46e5" : "#e5e7eb"}`,
                      background:form.timeline===t ? "#eef2ff" : "#fff",
                      color:form.timeline===t ? "#4f46e5" : "#6b7280" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:22 }}>
              <Label>Anything specific you want to see?</Label>
              <textarea value={form.message} onChange={sf("message")}
                placeholder="e.g. We run 3 hackathons a year and need better judge coordination…"
                style={{ ...IS, minHeight:80, resize:"vertical" }}
                onFocus={focus} onBlur={blur} />
            </div>

            <button type="submit" disabled={busy}
              style={{ ...FF, width:"100%", padding:"13px", borderRadius:10,
                fontSize:15, fontWeight:700,
                background:busy ? "#818cf8" : "#4f46e5", color:"#fff",
                border:"none", cursor:busy ? "not-allowed" : "pointer",
                boxShadow:"0 4px 14px rgba(79,70,229,0.3)", transition:"all 0.15s" }}>
              {busy ? "Sending…" : "Request demo →"}
            </button>

            <p style={{ ...FF, fontSize:11, color:"#9ca3af", textAlign:"center",
              marginTop:14, lineHeight:1.6 }}>
              We'll only use your details to schedule the demo. No spam.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
