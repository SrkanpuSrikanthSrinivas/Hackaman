import { useState, useEffect } from "react";

const BASE = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL || "";
const FF = { fontFamily:"'Inter',system-ui,sans-serif" };

export default function ResetPasswordPage() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get("token") || "";

  const [mode, setMode] = useState(token ? "reset" : "request"); // request | reset | done
  const [email, setEmail] = useState("");
  const [pw,   setPw]   = useState("");
  const [conf, setConf] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");
  const [msg,  setMsg]  = useState("");

  useEffect(() => {
    document.title = "Reset Password | HackFest Hub";
    return () => { document.title = "HackFest Hub"; };
  }, []);

  const requestReset = async e => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${BASE}/api/auth/forgot-password`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ email }),
      }).then(r => r.json());
      if (r.error) { setErr(r.error); setBusy(false); return; }
      setMsg(r.message || "If that email exists, a reset link has been sent.");
      setMode("sent");
    } catch(e) { setErr(e.message); }
    setBusy(false);
  };

  const doReset = async e => {
    e.preventDefault();
    if (pw !== conf)   { setErr("Passwords don't match"); return; }
    if (pw.length < 8) { setErr("Password must be at least 8 characters"); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${BASE}/api/auth/reset-password`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ token, newPassword: pw }),
      }).then(r => r.json());
      if (r.error) { setErr(r.error); setBusy(false); return; }
      setMode("done");
    } catch(e) { setErr(e.message); }
    setBusy(false);
  };

  const IS = {
    ...FF, width:"100%", padding:"11px 14px", borderRadius:10, fontSize:14,
    color:"#fff", background:"rgba(255,255,255,0.07)",
    border:"1.5px solid rgba(255,255,255,0.15)", outline:"none",
    transition:"border 0.15s", boxSizing:"border-box",
  };
  const focus = e => e.target.style.borderColor = "rgba(99,102,241,0.7)";
  const blur  = e => e.target.style.borderColor = "rgba(255,255,255,0.15)";

  const Label = ({ children }) => (
    <label style={{ display:"block", ...FF, fontSize:11, fontWeight:600,
      color:"rgba(255,255,255,0.45)", textTransform:"uppercase",
      letterSpacing:"0.07em", marginBottom:6 }}>{children}</label>
  );

  return (
    <div style={{ minHeight:"100vh",
      background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:24, ...FF }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={{ textAlign:"center", marginBottom:30 }}>
          <div style={{ fontSize:42, marginBottom:12 }}>
            {mode === "done" ? "✅" : mode === "sent" ? "📬" : "🔑"}
          </div>
          <h1 style={{ fontSize:24, fontWeight:800, color:"#fff",
            letterSpacing:"-0.03em", marginBottom:8 }}>
            {mode === "done"  ? "Password updated"
             : mode === "sent" ? "Check your email"
             : mode === "reset" ? "Choose a new password"
             : "Reset your password"}
          </h1>
          <p style={{ fontSize:14, color:"rgba(255,255,255,0.45)", lineHeight:1.65 }}>
            {mode === "done"  ? "You can now sign in with your new password."
             : mode === "sent" ? msg
             : mode === "reset" ? "Pick something secure you'll remember."
             : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {(mode === "request" || mode === "reset") && (
          <div style={{ background:"rgba(255,255,255,0.05)",
            border:"1px solid rgba(255,255,255,0.1)", borderRadius:18, padding:28 }}>

            {err && (
              <div style={{ background:"rgba(239,68,68,0.15)",
                border:"1px solid rgba(239,68,68,0.3)", borderRadius:8,
                padding:"10px 14px", fontSize:13, color:"#f87171",
                marginBottom:16, lineHeight:1.5 }}>{err}</div>
            )}

            {mode === "request" ? (
              <form onSubmit={requestReset}>
                <div style={{ marginBottom:20 }}>
                  <Label>Email address</Label>
                  <input type="email" required autoFocus value={email}
                    onChange={e=>setEmail(e.target.value)}
                    placeholder="you@example.com" style={IS}
                    onFocus={focus} onBlur={blur} />
                </div>
                <button type="submit" disabled={busy}
                  style={{ ...FF, width:"100%", padding:"12px", borderRadius:10,
                    fontSize:15, fontWeight:700, background:busy?"rgba(99,102,241,0.5)":"#4f46e5",
                    color:"#fff", border:"none", cursor:busy?"not-allowed":"pointer",
                    boxShadow:"0 4px 18px rgba(79,70,229,0.4)" }}>
                  {busy ? "Sending…" : "Send reset link →"}
                </button>
              </form>
            ) : (
              <form onSubmit={doReset}>
                <div style={{ marginBottom:14 }}>
                  <Label>New password</Label>
                  <input type={show?"text":"password"} required autoFocus value={pw}
                    onChange={e=>setPw(e.target.value)}
                    placeholder="At least 8 characters" style={IS}
                    onFocus={focus} onBlur={blur} />
                </div>
                <div style={{ marginBottom:14 }}>
                  <Label>Confirm password</Label>
                  <input type={show?"text":"password"} required value={conf}
                    onChange={e=>setConf(e.target.value)}
                    placeholder="Type it again"
                    style={{ ...IS, borderColor: conf && pw!==conf ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.15)" }}
                    onFocus={focus} onBlur={blur} />
                </div>
                <label style={{ display:"flex", alignItems:"center", gap:8,
                  cursor:"pointer", marginBottom:20 }}>
                  <input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)} />
                  <span style={{ ...FF, fontSize:12, color:"rgba(255,255,255,0.45)" }}>Show passwords</span>
                </label>
                <button type="submit" disabled={busy}
                  style={{ ...FF, width:"100%", padding:"12px", borderRadius:10,
                    fontSize:15, fontWeight:700, background:busy?"rgba(99,102,241,0.5)":"#4f46e5",
                    color:"#fff", border:"none", cursor:busy?"not-allowed":"pointer",
                    boxShadow:"0 4px 18px rgba(79,70,229,0.4)" }}>
                  {busy ? "Updating…" : "Set new password →"}
                </button>
              </form>
            )}
          </div>
        )}

        {(mode === "sent" || mode === "done") && (
          <div style={{ textAlign:"center" }}>
            <a href="/" style={{ ...FF, display:"inline-block", padding:"12px 28px",
              borderRadius:10, background:"#4f46e5", color:"#fff", fontSize:15,
              fontWeight:700, textDecoration:"none",
              boxShadow:"0 4px 18px rgba(79,70,229,0.4)" }}>
              {mode === "done" ? "Sign in now →" : "Back to home"}
            </a>
          </div>
        )}

        <p style={{ textAlign:"center", marginTop:22, ...FF, fontSize:12,
          color:"rgba(255,255,255,0.22)", lineHeight:1.6 }}>
          Need help? <a href="mailto:contact@hackfesthub.com"
            style={{ color:"rgba(255,255,255,0.4)" }}>contact@hackfesthub.com</a>
        </p>
      </div>
    </div>
  );
}
