import { useState, useEffect } from "react";

const BASE = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL || "";
const FF = { fontFamily:"'Inter',system-ui,sans-serif" };

function Label({ children }) {
  return (
    <label style={{ display:"block", ...FF, fontSize:11, fontWeight:600,
      color:"rgba(255,255,255,0.5)", textTransform:"uppercase",
      letterSpacing:"0.07em", marginBottom:6 }}>{children}</label>
  );
}

export default function SignupPage() {
  const [form, setForm] = useState({ orgName:"", name:"", email:"", password:"" });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");
  const [show, setShow] = useState(false);
  const sf = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    document.title = "Start free | HackFest Hub";
    return () => { document.title = "HackFest Hub"; };
  }, []);

  const submit = async e => {
    e.preventDefault();
    if (form.password.length < 8) { setErr("Password must be at least 8 characters"); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${BASE}/api/auth/signup`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(form),
      }).then(r => r.json());
      if (r.error) { setErr(r.error); setBusy(false); return; }
      // Store token and land in the (empty) dashboard
      localStorage.setItem("hf_token", r.token);
      window.location.href = "/admin";
    } catch(e) { setErr(e.message); setBusy(false); }
  };

  const IS = {
    ...FF, width:"100%", padding:"12px 14px", borderRadius:10, fontSize:14,
    color:"#fff", background:"rgba(255,255,255,0.07)",
    border:"1.5px solid rgba(255,255,255,0.15)", outline:"none", boxSizing:"border-box",
  };
  const focus = e => e.target.style.borderColor = "rgba(99,102,241,0.7)";
  const blur  = e => e.target.style.borderColor = "rgba(255,255,255,0.15)";

  return (
    <div style={{ minHeight:"100vh",
      background:"linear-gradient(135deg,#0a0e1f 0%,#1e1b4b 100%)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:24, ...FF }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing:border-box; }
      `}</style>

      <div style={{ width:"100%", maxWidth:420 }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <a href="/" style={{ textDecoration:"none" }}>
            <div style={{ fontSize:34, marginBottom:10 }}>⚡</div>
          </a>
          <h1 style={{ ...FF, fontSize:26, fontWeight:900, color:"#fff",
            letterSpacing:"-0.03em", marginBottom:8 }}>Create your workspace</h1>
          <p style={{ ...FF, fontSize:14, color:"rgba(255,255,255,0.45)", lineHeight:1.6 }}>
            Free forever for your first hackathon. No credit card.
          </p>
        </div>

        <div style={{ background:"rgba(255,255,255,0.05)",
          border:"1px solid rgba(255,255,255,0.1)", borderRadius:18, padding:28 }}>
          {err && (
            <div style={{ background:"rgba(239,68,68,0.15)",
              border:"1px solid rgba(239,68,68,0.3)", borderRadius:8,
              padding:"10px 14px", fontSize:13, color:"#f87171",
              marginBottom:16, lineHeight:1.5 }}>{err}</div>
          )}

          <form onSubmit={submit}>
            <div style={{ marginBottom:14 }}>
              <Label>Organization name</Label>
              <input required autoFocus value={form.orgName} onChange={sf("orgName")}
                placeholder="Acme University" style={IS} onFocus={focus} onBlur={blur} />
            </div>
            <div style={{ marginBottom:14 }}>
              <Label>Your name</Label>
              <input required value={form.name} onChange={sf("name")}
                placeholder="Jane Smith" style={IS} onFocus={focus} onBlur={blur} />
            </div>
            <div style={{ marginBottom:14 }}>
              <Label>Work email</Label>
              <input required type="email" value={form.email} onChange={sf("email")}
                placeholder="jane@acme.edu" style={IS} onFocus={focus} onBlur={blur} />
            </div>
            <div style={{ marginBottom:16 }}>
              <Label>Password</Label>
              <input required type={show?"text":"password"} value={form.password}
                onChange={sf("password")} placeholder="At least 8 characters"
                style={IS} onFocus={focus} onBlur={blur} />
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:8,
              cursor:"pointer", marginBottom:18 }}>
              <input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)} />
              <span style={{ ...FF, fontSize:12, color:"rgba(255,255,255,0.45)" }}>Show password</span>
            </label>

            <button type="submit" disabled={busy}
              style={{ ...FF, width:"100%", padding:"13px", borderRadius:11,
                fontSize:15, fontWeight:700, background:busy?"rgba(99,102,241,0.5)":"#4f46e5",
                color:"#fff", border:"none", cursor:busy?"not-allowed":"pointer",
                boxShadow:"0 4px 18px rgba(79,70,229,0.4)" }}>
              {busy ? "Creating your workspace…" : "Create workspace →"}
            </button>
          </form>
        </div>

        <p style={{ textAlign:"center", marginTop:20, ...FF, fontSize:13,
          color:"rgba(255,255,255,0.4)" }}>
          Already have an account?{" "}
          <a href="/" style={{ color:"#a5b4fc", fontWeight:600, textDecoration:"none" }}>Sign in</a>
        </p>

        <div style={{ marginTop:24, display:"flex", gap:20, justifyContent:"center",
          ...FF, fontSize:12, color:"rgba(255,255,255,0.3)" }}>
          <span>✓ 1 free hackathon</span>
          <span>✓ Up to 50 participants</span>
          <span>✓ No card needed</span>
        </div>
      </div>
    </div>
  );
}