import { useState, useEffect, useCallback, useRef } from "react";
import {
  GET, POST, PUT, DEL, PGET, PPOST,
  fmtDate, fmtDt, calcScore, avgOf,
  STATUS_CHIP, CAT_CHIP,
  C, FONT, MONO, R,
  Chip, Btn, INPUT_STYLE as IN, TA_STYLE as TA,
  Field, Avatar, Modal, Card, SectionHeader, Stat, ScoreBar, DataTable, Spinner, Empty,
} from "./shared.jsx";

/* ─── DASHBOARD ────────────────────────────────────────────────────────── */
export function DashboardPage({ db, activeHackathon }) {
  const hack=db.hackathons.find(h=>h.id===activeHackathon);
  if (!hack) return <Empty icon="🏆" title="Select a hackathon" sub="Choose an event from the sidebar." />;
  const teams=db.teams.filter(t=>t.hackathonId===hack.id);
  const criteria=db.criteria.filter(c=>c.hackathonId===hack.id);
  const fbs=db.feedbacks.filter(f=>f.hackathonId===hack.id);
  const possible=teams.length*db.judges.length;
  const coverage=possible>0?Math.round(fbs.length/possible*100):0;
  const ranked=[...teams].map(t=>{const tf=fbs.filter(f=>f.teamId===t.id);return{...t,avg:avgOf(tf,criteria),count:tf.length};}).sort((a,b)=>(b.avg||0)-(a.avg||0));
  const recent=[...fbs].sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt)).slice(0,6);
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
        <div><h1 style={{...FONT,fontSize:20,fontWeight:600,color:C.text,marginBottom:3}}>{hack.name}</h1>
          <div style={{...FONT,fontSize:13,color:C.text3}}>{hack.location} · {fmtDate(hack.startDate)} – {fmtDate(hack.endDate)}</div></div>
        <Chip label={hack.status} color={STATUS_CHIP[hack.status]||"neutral"} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:22}}>
        <Stat label="Teams" value={teams.length} />
        <Stat label="Judges" value={db.judges.length} />
        <Stat label="Feedbacks" value={fbs.length} sub={`of ${possible} possible`} color={C.blue} />
        <Stat label="Coverage" value={`${coverage}%`} color={coverage>=75?C.green:C.amber} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:14}}>
        <Card>
          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:16,display:"flex",justifyContent:"space-between"}}>
            <span>Leaderboard</span><span style={{fontSize:11,fontWeight:400,color:C.text3}}>{criteria.length} criteria · weighted</span>
          </div>
          {ranked.length===0?<div style={{...FONT,fontSize:13,color:C.text3,textAlign:"center",padding:"28px 0"}}>No teams yet.</div>
            :ranked.map((t,i)=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:i<ranked.length-1?`1px solid ${C.border}`:"none"}}>
                <span style={{...MONO,fontSize:11,color:C.text3,minWidth:18,textAlign:"right"}}>{i+1}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <span style={{...FONT,fontSize:13,fontWeight:500,color:C.text}}>{t.name}</span>
                    <Chip label={t.category} color={CAT_CHIP[t.category]||"neutral"} />
                  </div>
                  <div style={{...FONT,fontSize:11,color:C.text3,marginBottom:5}}>{t.project} · {t.count} review{t.count!==1?"s":""}</div>
                  <ScoreBar value={t.avg||0} />
                </div>
                <span style={{...MONO,fontSize:18,fontWeight:600,minWidth:40,textAlign:"right",
                  color:t.avg==null?C.text3:t.avg>=8?C.green:t.avg>=6?C.blue:C.amber}}>{t.avg??"—"}</span>
              </div>
            ))
          }
        </Card>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card>
            <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:12}}>Recent Activity</div>
            {recent.length===0?<div style={{...FONT,fontSize:12,color:C.text3,textAlign:"center",padding:"12px 0"}}>No feedback yet.</div>
              :recent.map((fb,i)=>{
                const team=db.teams.find(t=>t.id===fb.teamId);const judge=db.judges.find(j=>j.id===fb.judgeId);
                const s=calcScore(fb.scores,criteria);
                return <div key={fb.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:i<recent.length-1?`1px solid ${C.border}`:"none"}}>
                  <div><div style={{...FONT,fontSize:12,fontWeight:500,color:C.text}}>{team?.name}</div>
                    <div style={{...FONT,fontSize:11,color:C.text3}}>by {judge?.name?.split(" ").at(-1)} · {fmtDt(fb.submittedAt)}</div></div>
                  <span style={{...MONO,fontSize:13,fontWeight:500,color:s==null?C.text3:s>=8?C.green:C.blue}}>{s??"—"}</span>
                </div>;
              })
            }
          </Card>
          <Card style={{background:"#111827",border:"1px solid #1f2937"}}>
            <div style={{...FONT,fontSize:11,fontWeight:500,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Criteria Weights</div>
            {criteria.length===0?<div style={{...FONT,fontSize:12,color:"#4b5563",textAlign:"center",padding:"8px 0"}}>None defined.</div>
              :criteria.map(c=>(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                  <span style={{...FONT,fontSize:12,color:"#9ca3af",minWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                  <div style={{flex:1,background:"#1f2937",borderRadius:2,height:4,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${c.weight}%`,background:"#3b82f6",borderRadius:2}} />
                  </div>
                  <span style={{...MONO,fontSize:11,color:"#3b82f6",minWidth:30,textAlign:"right"}}>{c.weight}%</span>
                </div>
              ))
            }
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── HACKATHONS ───────────────────────────────────────────────────────── */
export function HackathonsPage({ db, reload, toast, setActive, setPage }) {
  const [modal,setModal]=useState(null);const [form,setForm]=useState({});const [saving,setSaving]=useState(false);const [expand,setExpand]=useState(null);
  const f=k=>e=>setForm(p=>({...p,[k]:typeof e==="object"&&e?.target?e.target.value:e}));
  const hackStats=db.hackathons.map(h=>{
    const teams=db.teams.filter(t=>t.hackathonId===h.id);
    const criteria=db.criteria.filter(c=>c.hackathonId===h.id);
    const fbs=db.feedbacks.filter(f=>f.hackathonId===h.id);
    const possible=teams.length*db.judges.length;
    const coverage=possible>0?Math.round(fbs.length/possible*100):0;
    const ranked=[...teams].map(t=>({...t,avg:avgOf(fbs.filter(f=>f.teamId===t.id),criteria)})).sort((a,b)=>(b.avg||0)-(a.avg||0));
    const vals=ranked.map(t=>t.avg).filter(Boolean);
    const eventAvg=vals.length?+(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):null;
    return{...h,teams,criteria,fbs,possible,coverage,ranked,leader:ranked[0]||null,eventAvg};
  });
  const open=(h,e)=>{e?.stopPropagation();setForm(h?{...h,published:!!h.published}:{status:"upcoming",published:false});setModal(h||"new");};
  const close=()=>setModal(null);
  const save=async()=>{
    if(!form.name?.trim())return toast("Name is required","error");setSaving(true);
    try{if(modal==="new")await POST("/api/hackathons",form);else await PUT(`/api/hackathons/${modal.id}`,form);await reload();toast(modal==="new"?"Hackathon created":"Updated");close();}
    catch(e){toast(e.message,"error");}setSaving(false);
  };
  const del=async(id,e)=>{e?.stopPropagation();if(!confirm("Delete this hackathon and all its data?"))return;
    try{await DEL(`/api/hackathons/${id}`);await reload();toast("Deleted");}catch(e){toast(e.message,"error");}};
  const togglePublish=async(h,e)=>{e?.stopPropagation();
    try{await PUT(`/api/hackathons/${h.id}`,{...h,published:!h.published});await reload();toast(h.published?"Unpublished":"Published — now live publicly");}
    catch(e){toast(e.message,"error");}};
  return (
    <div>
      <SectionHeader title="Hackathons" count={`${db.hackathons.length} events`} action={<Btn onClick={e=>open(null,e)}>+ New Hackathon</Btn>} />
      {db.hackathons.length>1&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
          <Stat label="Total Events" value={db.hackathons.length} />
          <Stat label="Active" value={db.hackathons.filter(h=>h.status==="active").length} color={C.green} />
          <Stat label="Published" value={db.hackathons.filter(h=>h.published).length} color={C.blue} />
          <Stat label="Total Feedback" value={db.feedbacks.length} />
        </div>
      )}
      {db.hackathons.length===0?<Empty icon="🏆" title="No hackathons" sub="Create your first event to get started." action={<Btn onClick={e=>open(null,e)}>Create Hackathon</Btn>} />
        :<div style={{display:"flex",flexDirection:"column",gap:8}}>
          {hackStats.map(h=>{
            const isExp=expand===h.id;
            return(
              <Card key={h.id} pad={0} style={{overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"2.2fr 80px 150px 90px 100px 110px 200px",alignItems:"center",padding:"14px 16px",cursor:"pointer",gap:0}} onClick={()=>setExpand(isExp?null:h.id)}>
                  <div style={{paddingRight:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <span style={{...FONT,fontSize:14,fontWeight:600,color:C.text}}>{h.name}</span>
                      <Chip label={h.status} color={STATUS_CHIP[h.status]||"neutral"} />
                      {h.published&&<Chip label="live" color="green" />}
                    </div>
                    <div style={{...FONT,fontSize:12,color:C.text3}}>{h.location} · {fmtDate(h.startDate)} – {fmtDate(h.endDate)}</div>
                  </div>
                  {[
                    {label:"TEAMS",v:<span style={{...MONO,fontSize:18,fontWeight:500,color:C.text}}>{h.teams.length}</span>},
                    {label:"COVERAGE",v:<div><div style={{display:"flex",alignItems:"center",gap:5}}><div style={{flex:1,background:C.bg3,borderRadius:3,height:4,overflow:"hidden"}}><div style={{height:"100%",width:`${h.coverage}%`,background:h.coverage>=75?C.green:h.coverage>=40?C.blue:C.amber,borderRadius:3}} /></div><span style={{...MONO,fontSize:11,color:C.text2}}>{h.coverage}%</span></div><div style={{...FONT,fontSize:10,color:C.text3,marginTop:2}}>{h.fbs.length}/{h.possible}</div></div>},
                    {label:"CRITERIA",v:<span style={{...MONO,fontSize:18,fontWeight:500,color:C.text}}>{h.criteria.length}</span>},
                    {label:"AVG SCORE",v:<span style={{...MONO,fontSize:18,fontWeight:500,color:h.eventAvg==null?C.text3:h.eventAvg>=8?C.green:h.eventAvg>=6?C.blue:C.amber}}>{h.eventAvg??"—"}</span>},
                    {label:"LEADER",v:h.leader?<div><div style={{...FONT,fontSize:12,fontWeight:500,color:C.text}}>{h.leader.name}</div><div style={{...MONO,fontSize:11,color:C.green}}>{h.leader.avg}</div></div>:<span style={{...FONT,fontSize:12,color:C.text3}}>—</span>},
                  ].map(({label,v})=>(
                    <div key={label} style={{borderLeft:`1px solid ${C.border}`,paddingLeft:12}}>
                      <div style={{...FONT,fontSize:10,color:C.text3,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div>
                      {v}
                    </div>
                  ))}
                  <div style={{borderLeft:`1px solid ${C.border}`,paddingLeft:12,display:"flex",flexDirection:"column",gap:6}}>
                    <Btn size="sm" variant="blue" onClick={e=>{e.stopPropagation();setActive(h.id);setPage("dashboard");}}>Open Dashboard</Btn>
                    <div style={{display:"flex",gap:5}}>
                      <Btn size="sm" variant="secondary" onClick={e=>open(h,e)}>Edit</Btn>
                      <Btn size="sm" variant={h.published?"secondary":"success"} onClick={e=>togglePublish(h,e)}>{h.published?"Unpublish":"Publish"}</Btn>
                      <Btn size="sm" variant="danger" onClick={e=>del(h.id,e)}>Del</Btn>
                    </div>
                  </div>
                </div>
                {isExp&&(
                  <div style={{borderTop:`1px solid ${C.border}`,background:C.bg2,padding:"14px 16px"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                      <div>
                        <div style={{...FONT,fontSize:11,fontWeight:500,color:C.text3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Team Rankings</div>
                        {h.ranked.length===0?<div style={{...FONT,fontSize:12,color:C.text3,fontStyle:"italic"}}>No teams.</div>
                          :h.ranked.map((t,i)=>(
                            <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                              <span style={{...MONO,fontSize:11,color:C.text3,minWidth:14}}>{i+1}</span>
                              <div style={{flex:1}}><div style={{...FONT,fontSize:12,fontWeight:500,color:C.text,marginBottom:2}}>{t.name}</div>
                                <div style={{background:C.border,borderRadius:2,height:4,overflow:"hidden"}}><div style={{height:"100%",width:`${(t.avg||0)*10}%`,background:t.avg>=8?C.green:t.avg>=6?C.blue:C.amber,borderRadius:2}} /></div></div>
                              <span style={{...MONO,fontSize:12,fontWeight:500,color:t.avg==null?C.text3:C.blue}}>{t.avg??"—"}</span>
                            </div>
                          ))
                        }
                      </div>
                      <div>
                        <div style={{...FONT,fontSize:11,fontWeight:500,color:C.text3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Judge Coverage</div>
                        {db.judges.map(j=>{const cnt=h.fbs.filter(f=>f.judgeId===j.id).length;const done=cnt===h.teams.length&&h.teams.length>0;return(
                          <div key={j.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                            <span style={{...FONT,fontSize:12,color:C.text2}}>{j.name}</span>
                            <div style={{display:"flex",alignItems:"center",gap:5}}>
                              <span style={{...MONO,fontSize:11,color:done?C.green:C.text3}}>{cnt}/{h.teams.length}</span>
                              {done&&<span style={{color:C.green,fontSize:12}}>✓</span>}
                            </div>
                          </div>
                        );})}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      }
      {modal&&(
        <Modal title={modal==="new"?"New Hackathon":"Edit Hackathon"} onClose={close} width={600}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Event Name" required><input style={IN} value={form.name||""} onChange={f("name")} placeholder="HackFest 2025" /></Field>
            <Field label="Tagline"><input style={IN} value={form.tagline||""} onChange={f("tagline")} placeholder="Build the future in 48 hrs" /></Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <Field label="Start Date"><input type="date" style={IN} value={form.startDate?.slice(0,10)||""} onChange={f("startDate")} /></Field>
            <Field label="End Date"><input type="date" style={IN} value={form.endDate?.slice(0,10)||""} onChange={f("endDate")} /></Field>
            <Field label="Status"><select style={IN} value={form.status||"upcoming"} onChange={f("status")}><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option></select></Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Location"><input style={IN} value={form.location||""} onChange={f("location")} placeholder="City, State" /></Field>
            <Field label="Prize Pool"><input style={IN} value={form.prizePool||""} onChange={f("prizePool")} placeholder="$25,000 in prizes" /></Field>
          </div>
          <Field label="Tracks" hint="Comma-separated"><input style={IN} value={form.tracks||""} onChange={f("tracks")} placeholder="AI/ML, Sustainability, Security" /></Field>
          <Field label="Description"><textarea style={TA} value={form.description||""} onChange={f("description")} /></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Banner Color" hint="Accent color for the public page hero">
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input type="color" value={form.bannerColor||"#1e3a8a"} onChange={f("bannerColor")} style={{width:40,height:34,borderRadius:R.sm,border:`1px solid ${C.border}`,cursor:"pointer",padding:2}} />
                <input style={{...IN,flex:1}} value={form.bannerColor||"#1e3a8a"} onChange={f("bannerColor")} placeholder="#1e3a8a" />
              </div>
            </Field>
            <div />
          </div>
                    <Field label="Schedule" hint="One item per line. Format: 9:00 AM | Opening Ceremony">
            <textarea style={{...TA,minHeight:80,fontSize:12}} value={form.schedule||""} onChange={f("schedule")} placeholder="9:00 AM | Registration & Check-in&#10;10:00 AM | Kickoff & Announcements&#10;11:00 AM | Hacking Begins" />
          </Field>
          <Field label="FAQ" hint="Separate Q&amp;A blocks with a blank line. Use Q: and A: prefixes">
            <textarea style={{...TA,minHeight:80,fontSize:12}} value={form.faq||""} onChange={f("faq")} placeholder="Q: Who can participate?&#10;A: Anyone 18+ with a laptop.&#10;&#10;Q: Is it free?&#10;A: Yes, completely free." />
          </Field>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,padding:"10px 12px",background:C.bg2,borderRadius:R.sm,border:`1px solid ${C.border}`}}>
            <input type="checkbox" id="pub" checked={!!form.published} onChange={e=>setForm(p=>({...p,published:e.target.checked}))} style={{accentColor:C.blue,cursor:"pointer",width:14,height:14}} />
            <label htmlFor="pub" style={{...FONT,fontSize:13,color:C.text,cursor:"pointer"}}>Publish — make visible publicly and accept registrations</label>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn variant="secondary" onClick={close}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving&&<Spinner/>} Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── TEAMS / JUDGES / CRITERIA — concise CRUD pages ─────────────────── */
function CrudPage({ title, icon, items, hackId, emptyMsg, renderRow, saveItem, delItem, modalBody, initForm }) {
  const [modal,setModal]=useState(null);const [form,setForm]=useState({});const [saving,setSaving]=useState(false);
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const open=item=>{setForm(item?{...item}:initForm||{});setModal(item||"new");};
  const close=()=>setModal(null);
  const save=async()=>{setSaving(true);try{await saveItem(modal==="new"?null:modal.id,form);close();}catch{}setSaving(false);};
  return (
    <div>
      <SectionHeader title={title} count={`${items.length} total`} action={<Btn onClick={()=>open(null)}>+ Add</Btn>} />
      {items.length===0?<Empty icon={icon} title={emptyMsg} action={<Btn onClick={()=>open(null)}>Add {title.slice(0,-1)}</Btn>} />
        :<DataTable cols={[...renderRow(null,open,delItem)]} rows={items} />
      }
      {modal&&<Modal title={modal==="new"?`Add ${title.slice(0,-1)}`:`Edit ${title.slice(0,-1)}`} onClose={close}>
        {modalBody(form,f)}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
          <Btn variant="secondary" onClick={close}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>{saving&&<Spinner/>} Save</Btn>
        </div>
      </Modal>}
    </div>
  );
}

export function TeamsPage({ db, reload, toast, activeHackathon }) {
  const hack=db.hackathons.find(h=>h.id===activeHackathon);
  const teams=db.teams.filter(t=>t.hackathonId===activeHackathon);
  if (!activeHackathon) return <Empty icon="👥" title="Select a hackathon" />;
  return <CrudPage title="Teams" icon="👥" items={teams} hackId={activeHackathon} emptyMsg="No teams yet"
    initForm={{hackathonId:activeHackathon}}
    saveItem={async(id,form)=>{try{id?await PUT(`/api/teams/${id}`,form):await POST("/api/teams",form);await reload();toast(id?"Updated":"Added");}catch(e){toast(e.message,"error");throw e;}}}
    delItem={async id=>{try{await DEL(`/api/teams/${id}`);await reload();toast("Removed");}catch(e){toast(e.message,"error");}}}
    renderRow={(_,open,del)=>[
      {key:"name",label:"Team / Project",render:(v,r)=><div><div style={{fontWeight:500}}>{v}</div><div style={{fontSize:12,color:C.text3}}>{r.project}</div></div>},
      {key:"category",label:"Category",render:v=><Chip label={v||"—"} color={CAT_CHIP[v]||"neutral"} />},
      {key:"members",label:"Members",render:v=><span style={{fontSize:12,color:C.text3}}>{v}</span>},
      {key:"id",label:"",render:(_,r)=><div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
        <Btn size="sm" variant="secondary" onClick={()=>open(r)}>Edit</Btn>
        <Btn size="sm" variant="danger" onClick={()=>del(r.id)}>Remove</Btn>
      </div>},
    ]}
    modalBody={(form,f)=><>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Team Name" required><input style={IN} value={form.name||""} onChange={f("name")} /></Field>
        <Field label="Project Name"><input style={IN} value={form.project||""} onChange={f("project")} /></Field>
      </div>
      <Field label="Category"><select style={IN} value={form.category||""} onChange={f("category")}><option value="">Select...</option>{["AI/ML","Sustainability","Security","Social Impact","EdTech","FinTech","Health","Other"].map(c=><option key={c}>{c}</option>)}</select></Field>
      <Field label="Members" hint="Comma-separated"><input style={IN} value={form.members||""} onChange={f("members")} placeholder="Alice, Bob, Carol" /></Field>
    </>}
  />;
}

export function JudgesPage({ db, reload, toast }) {
  const [modal,setModal]=useState(null);const [form,setForm]=useState({});const [saving,setSaving]=useState(false);const [uploading,setUploading]=useState(false);
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const fileRef=useRef(null);

  const open=j=>{setForm(j?{...j}:{});setModal(j||"new");};
  const close=()=>setModal(null);

  const handlePhotoUpload=async(e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    if(file.size>2*1024*1024){toast("Photo must be under 2MB. Try compressing it first.","error");return;}
    setUploading(true);
    const reader=new FileReader();
    reader.onload=ev=>{ setForm(p=>({...p,avatarUrl:ev.target.result})); setUploading(false); };
    reader.readAsDataURL(file);
  };

  const save=async()=>{
    if(!form.name?.trim())return toast("Name required","error");setSaving(true);
    try{
      if(modal==="new")await POST("/api/judges",form);
      else await PUT(`/api/judges/${modal.id}`,form);
      await reload();toast(modal==="new"?"Judge added":"Updated");close();
    }catch(e){toast(e.message,"error");}setSaving(false);
  };
  const del=async id=>{try{await DEL(`/api/judges/${id}`);await reload();toast("Removed");}catch(e){toast(e.message,"error");}};

  return (
    <div>
      <SectionHeader title="Judges" count={`${db.judges.length} registered`} action={<Btn onClick={()=>open(null)}>+ Add Judge</Btn>} />
      {db.judges.length===0?<Empty icon="👨‍⚖️" title="No judges registered" sub="Add judges who will evaluate teams." action={<Btn onClick={()=>open(null)}>Add Judge</Btn>} />
        :<DataTable cols={[
          {key:"name",label:"Name",render:(v,r)=>(
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {r.avatarUrl
                ?<img src={r.avatarUrl} style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",border:`1px solid ${C.border}`,flexShrink:0}} />
                :<Avatar name={v} size={36}/>
              }
              <div><div style={{fontWeight:500,color:C.text}}>{v}</div><div style={{fontSize:11,color:C.text3}}>{r.org}</div></div>
            </div>
          )},
          {key:"role",label:"Role"},
          {key:"avatarUrl",label:"Photo",render:v=><Chip label={v?"✓ Set":"No photo"} color={v?"green":"neutral"} />},
          {key:"id",label:"",render:(_,r)=><div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
            <Btn size="sm" variant="secondary" onClick={()=>open(r)}>Edit</Btn>
            <Btn size="sm" variant="danger" onClick={()=>del(r.id)}>Remove</Btn>
          </div>},
        ]} rows={db.judges} empty="No judges." />
      }
      {modal&&(
        <Modal title={modal==="new"?"Add Judge":"Edit Judge"} onClose={close} width={560}>
          {/* ── Photo Upload ── */}
          <div style={{marginBottom:20}}>
            <div style={{...FONT,fontSize:12,fontWeight:600,color:C.text,marginBottom:10}}>Judge Photo</div>
            <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
              {/* Preview */}
              <div style={{flexShrink:0,width:80,height:80,borderRadius:"50%",overflow:"hidden",
                border:`2px dashed ${form.avatarUrl?C.bdGreen:C.border2}`,
                background:form.avatarUrl?"transparent":C.bg3,
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                {form.avatarUrl
                  ?<img src={form.avatarUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.style.display="none";}} />
                  :<span style={{fontSize:28,opacity:0.35}}>👤</span>
                }
              </div>
              {/* Controls */}
              <div style={{flex:1}}>
                {/* Upload button */}
                <label style={{display:"inline-flex",alignItems:"center",gap:7,padding:"8px 14px",
                  borderRadius:R.sm,border:`1px solid ${C.border2}`,cursor:"pointer",
                  background:C.bg,color:C.text2,...FONT,fontSize:13,fontWeight:500,
                  marginBottom:10,userSelect:"none",
                  opacity:uploading?0.6:1}}>
                  {uploading
                    ? <><Spinner size={12}/> Uploading...</>
                    : <><span>📷</span> {form.avatarUrl ? "Change Photo" : "Upload Photo"}</>
                  }
                  <input type="file" ref={fileRef} accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePhotoUpload} style={{display:"none"}} disabled={uploading} />
                </label>
                {/* URL input */}
                <div style={{...FONT,fontSize:11,color:C.text3,marginBottom:5}}>Or paste a photo URL:</div>
                <input style={{...IN,fontSize:12}}
                  value={form.avatarUrl && !form.avatarUrl.startsWith("data:") ? form.avatarUrl : ""}
                  onChange={e=>setForm(p=>({...p,avatarUrl:e.target.value}))}
                  placeholder="https://linkedin.com/... or any image URL" />
                {form.avatarUrl && (
                  <button onClick={()=>setForm(p=>({...p,avatarUrl:""}))}
                    style={{...FONT,fontSize:11,color:C.red,background:"none",border:"none",cursor:"pointer",marginTop:5,padding:0}}>
                    ✕ Remove photo
                  </button>
                )}
                <div style={{...FONT,fontSize:11,color:C.text3,marginTop:6}}>Accepts JPG, PNG, WebP · Max 2MB · Shown on public event page</div>
              </div>
            </div>
          </div>
          <Field label="Full Name" required><input style={IN} value={form.name||""} onChange={f("name")} /></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Organization"><input style={IN} value={form.org||""} onChange={f("org")} /></Field>
            <Field label="Role / Title"><input style={IN} value={form.role||""} onChange={f("role")} /></Field>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn variant="secondary" onClick={close}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving&&<Spinner/>} Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function CriteriaPage({ db, reload, toast, activeHackathon }) {
  const hack=db.hackathons.find(h=>h.id===activeHackathon);
  const criteria=db.criteria.filter(c=>c.hackathonId===activeHackathon);
  const totalW=criteria.reduce((a,c)=>a+c.weight,0);
  if (!activeHackathon) return <Empty icon="📋" title="Select a hackathon" />;
  return <CrudPage title="Criteria" icon="📋" items={criteria} emptyMsg="No criteria defined"
    initForm={{hackathonId:activeHackathon,maxScore:10,weight:20}}
    saveItem={async(id,form)=>{try{id?await PUT(`/api/criteria/${id}`,form):await POST("/api/criteria",form);await reload();toast(id?"Updated":"Added");}catch(e){toast(e.message,"error");throw e;}}}
    delItem={async id=>{try{await DEL(`/api/criteria/${id}`);await reload();toast("Removed");}catch(e){toast(e.message,"error");}}}
    renderRow={(_,open,del)=>[
      {key:"name",label:"Criterion",render:(v,r)=><div><div style={{fontWeight:500}}>{v}</div><div style={{fontSize:12,color:C.text3}}>{r.description}</div></div>},
      {key:"maxScore",label:"Max",render:v=><span style={MONO}>{v}</span>},
      {key:"weight",label:"Weight",render:v=><div style={{display:"flex",alignItems:"center",gap:8,minWidth:120}}><div style={{flex:1,background:C.bg3,borderRadius:2,height:5,overflow:"hidden"}}><div style={{height:"100%",width:`${v}%`,background:C.blue,borderRadius:2}} /></div><span style={{...MONO,fontSize:12,color:C.blue,minWidth:32}}>{v}%</span></div>},
      {key:"id",label:"",render:(_,r)=><div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
        <Btn size="sm" variant="secondary" onClick={()=>open(r)}>Edit</Btn>
        <Btn size="sm" variant="danger" onClick={()=>del(r.id)}>Remove</Btn>
      </div>},
    ]}
    modalBody={(form,f)=><>
      {totalW!==100&&criteria.length>0&&<div style={{...FONT,background:C.bgAmber,border:`1px solid ${C.bdAmber}`,borderRadius:R.sm,padding:"9px 12px",fontSize:12,color:C.amber,marginBottom:12}}>⚠ Weights sum to {totalW}%</div>}
      <Field label="Name" required><input style={IN} value={form.name||""} onChange={f("name")} placeholder="e.g. Innovation & Creativity" /></Field>
      <Field label="Description"><textarea style={TA} value={form.description||""} onChange={f("description")} /></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Max Score"><input type="number" style={IN} value={form.maxScore||10} onChange={f("maxScore")} /></Field>
        <Field label="Weight %"><input type="number" style={IN} value={form.weight||20} onChange={f("weight")} /></Field>
      </div>
    </>}
  />;
}

/* ─── SUBMIT FEEDBACK (custom form with project metadata) ──────────────── */
export function FeedbackPage({ db, currentUser, toast, activeHackathon, isAdmin }) {
  const [selTeam,   setSelTeam]   = useState(null);
  const [scores,    setScores]    = useState({});
  const [comments,  setComments]  = useState({});
  const [overall,   setOverall]   = useState("");
  const [privNotes, setPrivNotes] = useState("");
  const [saving,    setSaving]    = useState(false);
  const [myFeedback,setMyFeedback]= useState([]);  // all feedback by this judge
  const [subs,      setSubs]      = useState([]);  // submissions for this hackathon
  const [subTab,    setSubTab]    = useState("submission");
  const [loading,   setLoading]   = useState(false);
  const [assignments, setAssignments] = useState(null); // null=not loaded, []=no assignments

  // Load data when hackathon changes
  useEffect(()=>{
    if(!activeHackathon){ setSelTeam(null); return; }
    setSelTeam(null); setLoading(true);

    // Parallel fetches
    Promise.all([
      // Judge's own feedback
      GET(`/api/feedbacks?hackathonId=${activeHackathon}`)
        .then(d=>setMyFeedback(Array.isArray(d)?d:[]))
        .catch(()=>setMyFeedback([])),
      // Submissions
      GET(`/api/public/projects/${activeHackathon}`)
        .then(d=>setSubs(d.projects||[]))
        .catch(()=>setSubs([])),
      // Judge team assignments
      GET(`/api/judge/assigned-teams?hackathonId=${activeHackathon}`)
        .then(d=>setAssignments(d.isFiltered ? d.teams.map(t=>t.id) : []))
        .catch(()=>setAssignments([])),
    ]).finally(()=>setLoading(false));
  },[activeHackathon]);

  // Filter teams based on assignments
  const allTeams = db.teams.filter(t=>t.hackathonId===activeHackathon);
  const teams = assignments?.length
    ? allTeams.filter(t=>assignments.includes(t.id))
    : allTeams;
  const criteria = db.criteria.filter(c=>c.hackathonId===activeHackathon);
  const totalWeight = criteria.reduce((s,c)=>s+c.weight,0)||1;

  const selectTeam = team => {
    const fb = myFeedback.find(f=>f.teamId===team.id);
    setSelTeam(team);
    setScores(fb?.scores||{});
    setComments(fb?.comments||{});
    setOverall(fb?.overall||"");
    setPrivNotes(fb?.privateNotes||"");
    const sub = subs.find(s=>s.teamId===team.id);
    setSubTab(sub?"submission":"scoring");
  };

  const saveFeedback = async()=>{
    if(!selTeam) return;
    setSaving(true);
    try{
      // Use the new judge/feedback route
      await POST("/api/judge/feedback",{
        hackathonId:activeHackathon, teamId:selTeam.id,
        scores, comments, overall, privateNotes:privNotes,
      });
      // Refresh feedback list
      const updated=await GET(`/api/feedbacks?hackathonId=${activeHackathon}`);
      setMyFeedback(Array.isArray(updated)?updated:[]);
      toast("✓ Feedback saved!");
    }catch(e){
      // Fallback: try old route
      try{
        const judgeId=currentUser?.judgeId;
        if(!judgeId) throw new Error("No judge profile linked. Ask admin to link your account to a judge profile in User Management.");
        await POST("/api/feedbacks",{
          hackathonId:activeHackathon, teamId:selTeam.id, judgeId,
          scores, comments, overall,
        });
        const updated=await GET(`/api/feedbacks?hackathonId=${activeHackathon}`);
        setMyFeedback(Array.isArray(updated)?updated:[]);
        toast("✓ Feedback saved!");
      }catch(e2){ toast(e2.message,"error"); }
    }
    setSaving(false);
  };

  const myScore = team=>{
    const fb=myFeedback.find(f=>f.teamId===team.id);
    if(!fb||!Object.keys(fb.scores||{}).length) return null;
    const ws=criteria.reduce((s,c)=>s+((fb.scores[c.id]||0)/c.maxScore)*c.weight,0);
    return ((ws/totalWeight)*10).toFixed(1);
  };

  const sub = selTeam ? subs.find(s=>s.teamId===selTeam.id)||null : null;
  const tabBtn=(id,label)=>(
    <button onClick={()=>setSubTab(id)} style={{...FONT,fontSize:13,fontWeight:600,
      padding:"7px 18px",borderRadius:8,border:"none",cursor:"pointer",
      background:subTab===id?C.blue:"transparent",
      color:subTab===id?"#fff":C.text3}}>
      {label}
    </button>
  );

  if(!activeHackathon) return <Empty icon="📋" title="Select a hackathon" sub="Choose a hackathon from the dropdown above." />;

  return(
    <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:0,
      height:"calc(100vh - 60px)",overflow:"hidden",
      marginTop:-24,marginLeft:-24,marginRight:-24}}>

      {/* ── LEFT: Team list ── */}
      <div style={{borderRight:`1px solid ${C.border}`,overflowY:"auto",background:C.bg2}}>
        <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{...FONT,fontSize:13,fontWeight:700,color:C.text,marginBottom:2}}>
            {assignments?.length ? `🎯 Your Teams (${teams.length})` : `All Teams (${teams.length})`}
          </div>
          {assignments?.length
            ? <div style={{...FONT,fontSize:11,color:C.blue}}>Filtered to your assignments</div>
            : <div style={{...FONT,fontSize:11,color:C.text3}}>Showing all teams</div>
          }
        </div>

        {loading && <div style={{...FONT,fontSize:13,color:C.text3,padding:20,textAlign:"center"}}><Spinner/> Loading…</div>}

        {!loading && teams.length===0 && (
          <div style={{padding:"16px 14px"}}>
            <div style={{...FONT,fontSize:13,color:C.text3,marginBottom:6}}>No teams found</div>
            <div style={{...FONT,fontSize:11,color:C.text3,lineHeight:1.6}}>
              {allTeams.length===0
                ? "No teams added to this hackathon yet."
                : "No teams assigned to you. Ask your admin."}
            </div>
          </div>
        )}

        {teams.map(team=>{
          const score  = myScore(team);
          const scored = !!myFeedback.find(f=>f.teamId===team.id);
          const hasSub = !!subs.find(s=>s.teamId===team.id);
          const isSel  = selTeam?.id===team.id;
          return(
            <div key={team.id} onClick={()=>selectTeam(team)}
              style={{padding:"11px 14px",cursor:"pointer",
                borderBottom:`1px solid ${C.border}`,
                borderLeft:`3px solid ${isSel?C.blue:scored?"#10b981":"transparent"}`,
                background:isSel?C.bgBlue:"transparent",transition:"all 0.12s"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
                <div style={{...FONT,fontSize:13,fontWeight:600,color:isSel?C.blue:C.text,flex:1}}>{team.name}</div>
                {score&&<span style={{...MONO,fontSize:13,fontWeight:700,color:C.green,flexShrink:0,marginLeft:8}}>{score}</span>}
              </div>
              <div style={{...FONT,fontSize:11,color:C.text3,marginBottom:4}}>{team.project||team.category||"—"}</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {hasSub&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:9999,background:"rgba(16,185,129,0.1)",color:C.green}}>📦 Submitted</span>}
                {scored &&<span style={{fontSize:10,padding:"1px 6px",borderRadius:9999,background:C.bgBlue,color:C.blue}}>✓ Scored</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── RIGHT: Submission + Scoring ── */}
      <div style={{overflowY:"auto",padding:"20px 24px"}}>
        {!selTeam?(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:"center",height:"100%",textAlign:"center"}}>
            <div style={{fontSize:52,marginBottom:12}}>👈</div>
            <div style={{...FONT,fontSize:16,fontWeight:600,color:C.text,marginBottom:6}}>Select a team to begin</div>
            <div style={{...FONT,fontSize:13,color:C.text3}}>
              Choose a team from the left to view their submission and score them.
            </div>
            {criteria.length===0&&activeHackathon&&(
              <div style={{marginTop:16,padding:"12px 16px",background:C.bgAmber,
                border:`1px solid ${C.bdAmber}`,borderRadius:R.md,fontSize:13,...FONT,color:C.amber}}>
                ⚠ No judging criteria set up. Ask admin to add criteria in the Criteria page.
              </div>
            )}
          </div>
        ):(
          <div>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div>
                <h2 style={{...FONT,fontSize:19,fontWeight:800,color:C.text,marginBottom:3}}>{selTeam.name}</h2>
                <div style={{...FONT,fontSize:13,color:C.text3}}>
                  {[selTeam.project,selTeam.category].filter(Boolean).join(" · ")||"—"}
                </div>
              </div>
              {myScore(selTeam)&&(
                <div style={{textAlign:"center",background:C.bgGreen,border:`1px solid ${C.bdGreen}`,
                  borderRadius:12,padding:"10px 16px"}}>
                  <div style={{...MONO,fontSize:22,fontWeight:800,color:C.green}}>{myScore(selTeam)}</div>
                  <div style={{...FONT,fontSize:11,color:C.green}}>Your score</div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div style={{display:"flex",gap:2,background:C.bg3,borderRadius:10,padding:3,
              marginBottom:18,width:"fit-content"}}>
              {tabBtn("submission","📦 Submission")}
              {tabBtn("scoring","⭐ Score & Feedback")}
            </div>

            {/* SUBMISSION TAB */}
            {subTab==="submission"&&(
              sub?(
                <div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
                    {sub.githubUrl&&<a href={sub.githubUrl} target="_blank" rel="noopener"
                      style={{...FONT,fontSize:13,fontWeight:600,padding:"8px 14px",borderRadius:8,
                        background:"#24292e",color:"#fff",textDecoration:"none"}}>GitHub →</a>}
                    {sub.demoUrl&&<a href={sub.demoUrl} target="_blank" rel="noopener"
                      style={{...FONT,fontSize:13,fontWeight:600,padding:"8px 14px",borderRadius:8,
                        background:C.green,color:"#fff",textDecoration:"none"}}>Live Demo →</a>}
                    {sub.videoUrl&&<a href={sub.videoUrl} target="_blank" rel="noopener"
                      style={{...FONT,fontSize:13,fontWeight:600,padding:"8px 14px",borderRadius:8,
                        background:C.blue,color:"#fff",textDecoration:"none"}}>Video →</a>}
                    {sub.deckUrl&&<a href={sub.deckUrl} target="_blank" rel="noopener"
                      style={{...FONT,fontSize:13,fontWeight:600,padding:"8px 14px",borderRadius:8,
                        background:C.amber,color:"#fff",textDecoration:"none"}}>Deck →</a>}
                  </div>

                  {[
                    {label:"Project",         val:sub.title},
                    {label:"Tagline",         val:sub.tagline},
                    {label:"Problem",         val:sub.problemStatement},
                    {label:"Solution",        val:sub.solution},
                    {label:"Description",     val:sub.description},
                  ].filter(r=>r.val).map(r=>(
                    <Card key={r.label} style={{marginBottom:10}}>
                      <div style={{...FONT,fontSize:11,fontWeight:600,color:C.text3,
                        textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{r.label}</div>
                      <div style={{...FONT,fontSize:14,color:C.text2,lineHeight:1.75}}>{r.val}</div>
                    </Card>
                  ))}

                  {sub.techStack&&(
                    <Card style={{marginBottom:10}}>
                      <div style={{...FONT,fontSize:11,fontWeight:600,color:C.text3,
                        textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Tech Stack</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {sub.techStack.split(",").map(t=>t.trim()).filter(Boolean).map(t=>(
                          <span key={t} style={{...FONT,fontSize:12,padding:"3px 10px",
                            borderRadius:9999,background:C.bgBlue,color:C.blue}}>{t}</span>
                        ))}
                      </div>
                    </Card>
                  )}

                  {selTeam.members&&(
                    <Card>
                      <div style={{...FONT,fontSize:11,fontWeight:600,color:C.text3,
                        textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Members</div>
                      <div style={{...FONT,fontSize:14,color:C.text2}}>{selTeam.members}</div>
                    </Card>
                  )}

                  <div style={{marginTop:14}}>
                    <Btn onClick={()=>setSubTab("scoring")}>⭐ Score this team →</Btn>
                  </div>
                </div>
              ):(
                <Card style={{textAlign:"center",padding:"40px 24px"}}>
                  <div style={{fontSize:40,marginBottom:10}}>📭</div>
                  <div style={{...FONT,fontSize:15,fontWeight:600,color:C.text,marginBottom:8}}>No project submitted yet</div>
                  <div style={{...FONT,fontSize:13,color:C.text3,marginBottom:16}}>
                    This team hasn't submitted their project. You can still score them.
                  </div>
                  <Btn onClick={()=>setSubTab("scoring")}>Score anyway →</Btn>
                </Card>
              )
            )}

            {/* SCORING TAB */}
            {subTab==="scoring"&&(
              criteria.length===0?(
                <Card style={{textAlign:"center",padding:32}}>
                  <div style={{fontSize:32,marginBottom:10}}>⚙</div>
                  <div style={{...FONT,fontSize:14,color:C.text3}}>
                    No judging criteria set up. Ask admin to add criteria in the <strong>Criteria</strong> page.
                  </div>
                </Card>
              ):(
                <>
                  {criteria.map(c=>(
                    <Card key={c.id} style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div style={{flex:1}}>
                          <div style={{...FONT,fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>{c.name}</div>
                          {c.description&&<div style={{...FONT,fontSize:12,color:C.text3}}>{c.description}</div>}
                          <div style={{...FONT,fontSize:11,color:C.text3,marginTop:2}}>Weight: {c.weight}%</div>
                        </div>
                        <div style={{textAlign:"center",minWidth:72}}>
                          <div style={{...MONO,fontSize:28,fontWeight:800,
                            color:(scores[c.id]||0)>0?C.blue:C.text3}}>
                            {scores[c.id]||0}
                          </div>
                          <div style={{...FONT,fontSize:11,color:C.text3}}>/ {c.maxScore}</div>
                        </div>
                      </div>

                      {/* Quick score buttons */}
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
                        {Array.from({length:c.maxScore+1},(_,i)=>i).map(v=>(
                          <button key={v} onClick={()=>setScores(s=>({...s,[c.id]:v}))}
                            style={{...FONT,fontSize:12,fontWeight:600,width:34,height:28,
                              borderRadius:6,border:"none",cursor:"pointer",transition:"all 0.1s",
                              background:(scores[c.id]||0)===v?C.blue:C.bg3,
                              color:(scores[c.id]||0)===v?"#fff":C.text3}}>{v}
                          </button>
                        ))}
                      </div>

                      <textarea value={comments[c.id]||""} onChange={e=>setComments(cs=>({...cs,[c.id]:e.target.value}))}
                        placeholder={`Comments on ${c.name}…`}
                        style={{...FONT,width:"100%",padding:"8px 12px",borderRadius:8,
                          border:`1px solid ${C.border2}`,background:C.bg,fontSize:13,
                          color:C.text,resize:"vertical",minHeight:56}}/>
                    </Card>
                  ))}

                  <Card style={{marginBottom:12}}>
                    <div style={{...FONT,fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>Overall Feedback</div>
                    <textarea value={overall} onChange={e=>setOverall(e.target.value)}
                      placeholder="Overall assessment of this team and their project…"
                      style={{...FONT,width:"100%",padding:"10px 14px",borderRadius:10,
                        border:`1px solid ${C.border2}`,background:C.bg,fontSize:14,
                        color:C.text,resize:"vertical",minHeight:90}}/>
                  </Card>

                  <Card style={{marginBottom:20,background:C.bg3,border:`1px dashed ${C.border2}`}}>
                    <div style={{...FONT,fontSize:11,fontWeight:600,color:C.text3,marginBottom:6,
                      textTransform:"uppercase",letterSpacing:"0.06em"}}>🔒 Private Notes (only you see this)</div>
                    <textarea value={privNotes} onChange={e=>setPrivNotes(e.target.value)}
                      placeholder="Your private thoughts or reminders…"
                      style={{...FONT,width:"100%",padding:"8px 12px",borderRadius:8,
                        border:`1px solid ${C.border}`,background:C.bg2,fontSize:13,
                        color:C.text,resize:"vertical",minHeight:52}}/>
                  </Card>

                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{...FONT,fontSize:13,color:C.text3}}>
                      Weighted score: <strong style={{color:C.text,fontSize:15}}>
                        {((criteria.reduce((s,c)=>s+((scores[c.id]||0)/c.maxScore)*c.weight,0)/totalWeight)*10).toFixed(1)}/10
                      </strong>
                    </div>
                    <Btn onClick={saveFeedback} disabled={saving}>
                      {saving?<><Spinner/> Saving…</>:"💾 Save Feedback"}
                    </Btn>
                  </div>
                </>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}


export function AllFeedbackPage({ db, reload, toast, activeHackathon, currentUser }) {
  const isJudge = currentUser?.role === "judge";
  const [ft,setFt]=useState("all");
  const [fj,setFj]=useState(isJudge ? (currentUser?.judgeId||"all") : "all");
  const hack=db.hackathons.find(h=>h.id===activeHackathon);
  const criteria=db.criteria.filter(c=>c.hackathonId===activeHackathon);
  const teams=db.teams.filter(t=>t.hackathonId===activeHackathon);
  const fbs=db.feedbacks.filter(f=>
    f.hackathonId===activeHackathon&&
    (ft==="all"||f.teamId===ft)&&
    (fj==="all"||f.judgeId===fj)
  );
  const del=async id=>{try{await DEL(`/api/feedbacks/${id}`);await reload();toast("Deleted");}catch(e){toast(e.message,"error");}};
  if(!activeHackathon) return <Empty icon="📊" title="Select a hackathon" />;
  return (
    <div>
      <SectionHeader title="All Feedback" count={`${fbs.length} submissions · ${hack?.name||""}`} />
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <select style={{...IN,width:"auto"}} value={ft} onChange={e=>setFt(e.target.value)}><option value="all">All Teams</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
        {!isJudge && <select style={{...IN,width:"auto"}} value={fj} onChange={e=>setFj(e.target.value)}><option value="all">All Judges</option>{db.judges.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select>}
      </div>
      {fbs.length===0?<Empty icon="📝" title="No feedback" sub="No submissions match the current filters." />
        :fbs.map((fb,i)=>{
          const team=db.teams.find(t=>t.id===fb.teamId);const judge=db.judges.find(j=>j.id===fb.judgeId);
          const s=calcScore(fb.scores,criteria);
          return(
            <Card key={fb.id} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{...FONT,fontSize:14,fontWeight:600,color:C.text}}>{team?.name}</span>
                    <span style={{...FONT,fontSize:13,color:C.text3}}>—</span>
                    <span style={{...FONT,fontSize:13,color:C.text2}}>{team?.project}</span>
                    <Chip label={team?.category||""} color={CAT_CHIP[team?.category]||"neutral"} />
                  </div>
                  <div style={{...FONT,fontSize:12,color:C.text3}}>
                    <strong style={{color:C.text2}}>{judge?.name}</strong> · {judge?.org} · {fmtDt(fb.submittedAt)}
                    {fb.submissionNumber&&<span style={{marginLeft:8}}> · Sub #{fb.submissionNumber}</span>}
                  </div>
                  <div style={{display:"flex",gap:10,marginTop:5,flexWrap:"wrap"}}>
                    {fb.demoVideoLink&&fb.demoVideoLink!=="NA"&&<a href={fb.demoVideoLink} target="_blank" style={{...FONT,fontSize:11,color:C.blue,textDecoration:"none"}}>▶ Demo</a>}
                    {fb.githubRepo&&<a href={fb.githubRepo} target="_blank" style={{...FONT,fontSize:11,color:C.text2,textDecoration:"none"}}>⑄ GitHub</a>}
                    {fb.liveProjectLink&&fb.liveProjectLink!=="NA"&&<a href={fb.liveProjectLink} target="_blank" style={{...FONT,fontSize:11,color:C.green,textDecoration:"none"}}>↗ Live</a>}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{textAlign:"right"}}>
                    <div style={{...MONO,fontSize:24,fontWeight:500,color:s==null?C.text3:s>=8?C.green:s>=6?C.blue:C.amber}}>{s??"—"}</div>
                    <div style={{...FONT,fontSize:10,color:C.text3}}>/10</div>
                  </div>
                  <Btn size="sm" variant="danger" onClick={()=>del(fb.id)}>Delete</Btn>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8,marginBottom:fb.overall?10:0}}>
                {criteria.map(c=>(
                  <div key={c.id} style={{background:C.bg2,borderRadius:R.sm,padding:"10px 11px"}}>
                    <div style={{...FONT,fontSize:11,color:C.text3,marginBottom:6}}>{c.name} <span style={{color:C.blue}}>({c.weight}%)</span></div>
                    <ScoreBar value={fb.scores?.[c.id]||0} max={c.maxScore} />
                    {fb.comments?.[c.id]&&<p style={{...FONT,fontSize:11,color:C.text3,marginTop:5,lineHeight:1.5}}>{fb.comments[c.id]}</p>}
                  </div>
                ))}
              </div>
              {fb.overall&&<div style={{background:C.bg2,borderRadius:R.sm,padding:"9px 12px",...FONT,fontSize:12,color:C.text2,fontStyle:"italic",borderLeft:`3px solid ${C.border2}`}}>"{fb.overall}"</div>}
            </Card>
          );
        })
      }
    </div>
  );
}

/* ─── REPORTS ──────────────────────────────────────────────────────────── */
export function ReportPage({ db, activeHackathon }) {
  const hack=db.hackathons.find(h=>h.id===activeHackathon);
  const teams=db.teams.filter(t=>t.hackathonId===activeHackathon);
  const criteria=db.criteria.filter(c=>c.hackathonId===activeHackathon);
  const allFbs=db.feedbacks.filter(f=>f.hackathonId===activeHackathon);
  const ranked=[...teams].map(t=>({...t,avg:avgOf(allFbs.filter(f=>f.teamId===t.id),criteria)??0,count:allFbs.filter(f=>f.teamId===t.id).length})).sort((a,b)=>b.avg-a.avg);
  const [sel,setSel]=useState(ranked[0]?.id||"");
  const team=db.teams.find(t=>t.id===sel);
  const teamFbs=allFbs.filter(f=>f.teamId===sel);
  const avg=avgOf(teamFbs,criteria);
  const critBreak=criteria.map(c=>{const v=teamFbs.map(f=>f.scores?.[c.id]).filter(x=>x!=null);return{...c,avg:v.length?+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):null};});
  if(!activeHackathon) return <Empty icon="📄" title="Select a hackathon" />;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div><h1 style={{...FONT,fontSize:18,fontWeight:600,color:C.text,marginBottom:2}}>Reports</h1><p style={{...FONT,fontSize:12,color:C.text3}}>{hack?.name}</p></div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <select style={{...IN,width:"auto"}} value={sel} onChange={e=>setSel(e.target.value)}>{ranked.map((t,i)=><option key={t.id} value={t.id}>{i+1}. {t.name}</option>)}</select>
          <Btn variant="secondary" onClick={()=>window.print()}>Print / PDF</Btn>
        </div>
      </div>
      {team&&(
        <div>
          <Card style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{marginBottom:8}}><Chip label={team.category} color={CAT_CHIP[team.category]||"neutral"} /></div>
                <h2 style={{...FONT,fontSize:20,fontWeight:600,color:C.text,marginBottom:4}}>{team.name}</h2>
                <p style={{...FONT,fontSize:14,color:C.blue,fontWeight:500,marginBottom:5}}>{team.project}</p>
                <p style={{...FONT,fontSize:12,color:C.text3}}>Members: {team.members}</p>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{...MONO,fontSize:56,fontWeight:500,lineHeight:1,color:avg==null?C.text3:avg>=8?C.green:avg>=6?C.blue:C.amber}}>{avg??"—"}</div>
                <div style={{...FONT,fontSize:12,color:C.text3}}>avg / 10 · {teamFbs.length} judges</div>
              </div>
            </div>
          </Card>
          <Card style={{marginBottom:14}}>
            <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:14}}>Criteria Breakdown</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:10}}>
              {critBreak.map(c=>{const color=c.avg==null?C.text3:c.avg>=8?C.green:c.avg>=6?C.blue:c.avg>=4?C.amber:C.red;return(
                <div key={c.id} style={{background:C.bg2,borderRadius:R.sm,padding:14}}>
                  <div style={{...FONT,fontSize:11,color:C.text3,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.04em"}}>{c.name} · {c.weight}%</div>
                  <div style={{...MONO,fontSize:26,fontWeight:500,color,marginBottom:8}}>{c.avg??"—"}<span style={{fontSize:12,color:C.text3}}>/{c.maxScore}</span></div>
                  <div style={{background:C.bg3,borderRadius:3,height:5,overflow:"hidden"}}><div style={{height:"100%",width:`${c.avg?c.avg/c.maxScore*100:0}%`,background:color,borderRadius:3}} /></div>
                </div>
              );})}
            </div>
          </Card>
          {teamFbs.length>0&&(
            <Card style={{marginBottom:14}}>
              <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:14}}>Judge Reviews</div>
              {teamFbs.map((fb,i)=>{const judge=db.judges.find(j=>j.id===fb.judgeId);const s=calcScore(fb.scores,criteria);return(
                <div key={fb.id} style={{paddingBottom:i<teamFbs.length-1?16:0,marginBottom:i<teamFbs.length-1?16:0,borderBottom:i<teamFbs.length-1?`1px solid ${C.border}`:"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <Avatar name={judge?.name} size={32}/>
                      <div><div style={{...FONT,fontSize:13,fontWeight:500,color:C.text}}>{judge?.name}</div><div style={{...FONT,fontSize:11,color:C.text3}}>{judge?.org} · {judge?.role}</div></div>
                    </div>
                    <span style={{...MONO,fontSize:18,fontWeight:600,color:s>=8?C.green:s>=6?C.blue:C.amber}}>{s}</span>
                  </div>
                  {(fb.githubRepo||fb.demoVideoLink||fb.liveProjectLink)&&(
                    <div style={{display:"flex",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                      {fb.submissionNumber&&<span style={{...FONT,fontSize:11,color:C.text3}}>Sub #{fb.submissionNumber}</span>}
                      {fb.demoVideoLink&&fb.demoVideoLink!=="NA"&&<a href={fb.demoVideoLink} target="_blank" style={{...FONT,fontSize:11,color:C.blue,textDecoration:"none"}}>▶ Demo</a>}
                      {fb.githubRepo&&<a href={fb.githubRepo} target="_blank" style={{...FONT,fontSize:11,color:C.text2,textDecoration:"none"}}>⑄ Repo</a>}
                      {fb.liveProjectLink&&fb.liveProjectLink!=="NA"&&<a href={fb.liveProjectLink} target="_blank" style={{...FONT,fontSize:11,color:C.green,textDecoration:"none"}}>↗ Live</a>}
                    </div>
                  )}
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                    {criteria.map(c=><span key={c.id} style={{...FONT,fontSize:11,background:C.bg2,border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 8px",color:C.text3}}>{c.name}: <span style={{...MONO,color:C.text}}>{fb.scores?.[c.id]??"—"}</span></span>)}
                  </div>
                  {fb.overall&&<p style={{...FONT,fontSize:12,color:C.text2,fontStyle:"italic",borderLeft:`2px solid ${C.border2}`,paddingLeft:10}}>"{fb.overall}"</p>}
                </div>
              );})}
            </Card>
          )}
          <Card>
            <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:14}}>Full Rankings</div>
            {ranked.map((t,i)=>{const isSel=t.id===sel;return(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 10px",borderRadius:R.sm,background:isSel?"#eff6ff":"transparent",borderBottom:i<ranked.length-1?`1px solid ${C.border}`:"none"}}>
                <span style={{...MONO,fontSize:12,color:C.text3,minWidth:18}}>{i+1}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:1}}>
                    <span style={{...FONT,fontSize:13,fontWeight:isSel?600:400,color:C.text}}>{t.name}</span>
                    {isSel&&<Chip label="selected" color="blue" />}
                  </div>
                  <span style={{...FONT,fontSize:11,color:C.text3}}>{t.project}</span>
                </div>
                <div style={{width:100,background:C.bg3,borderRadius:3,height:5,overflow:"hidden"}}><div style={{height:"100%",width:`${t.avg*10}%`,background:t.avg>=8?C.green:t.avg>=6?C.blue:C.amber,borderRadius:3}} /></div>
                <span style={{...MONO,fontSize:14,fontWeight:500,minWidth:36,textAlign:"right",color:t.avg>=8?C.green:t.avg>=6?C.blue:t.avg>0?C.amber:C.text3}}>{t.avg||"—"}</span>
              </div>
            );})}
          </Card>
        </div>
      )}
    </div>
  );
}

/* ─── USER MANAGEMENT ──────────────────────────────────────────────────── */
const EXTRA_PAGES=[{id:"dashboard",label:"Dashboard"},{id:"reports",label:"Reports"},{id:"all-feedback",label:"All Feedback"}];

export function UserManagementPage({ db, reload, toast }) {
  const [users,setUsers]=useState([]);const [sel,setSel]=useState(null);
  const [modal,setModal]=useState(null);const [form,setForm]=useState({});const [saving,setSaving]=useState(false);
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const loadUsers=useCallback(async()=>{try{setUsers(await GET("/api/users"));}catch(e){toast(e.message,"error");};},[]);
  useEffect(()=>{loadUsers();},[]);
  const selUser=users.find(u=>u.id===sel)||null;
  const open=u=>{setForm(u?{...u,password:""}:{role:"judge"});setModal(u||"new");};
  const close=()=>setModal(null);
  const save=async()=>{
    if(!form.name?.trim()||!form.email?.trim())return toast("Name and email required","error");
    if(modal==="new"&&!form.password?.trim())return toast("Password required for new users","error");
    setSaving(true);
    try{if(modal==="new")await POST("/api/users",form);else await PUT(`/api/users/${modal.id}`,form);await loadUsers();toast(modal==="new"?"User created":"Updated");close();}
    catch(e){toast(e.message,"error");}setSaving(false);
  };
  const del=async id=>{if(!confirm("Delete this user?"))return;try{await DEL(`/api/users/${id}`);await loadUsers();setSel(null);toast("Deleted");}catch(e){toast(e.message,"error");}};
  const toggleAssign=async(hackathonId,assigned)=>{
    try{
      if(assigned)await DEL(`/api/assignments/${hackathonId}/${selUser.id}`);
      else await POST("/api/assignments",{hackathonId,userId:selUser.id});
      await loadUsers();
    }catch(e){toast(e.message,"error");}
  };
  const togglePerm=async(hackathonId,page,existing)=>{
    try{if(existing)await DEL(`/api/permissions/${existing.id}`);else await POST("/api/permissions",{userId:selUser.id,hackathonId,page});await loadUsers();}
    catch(e){toast(e.message,"error");}
  };
  const admins=users.filter(u=>u.role==="admin"),judges=users.filter(u=>u.role==="judge"),teams=users.filter(u=>u.role==="team");
  return(
    <div>
      <SectionHeader title="User Management" count={`${users.length} users`} action={<Btn onClick={()=>open(null)}>+ Add User</Btn>} />
      <div style={{display:"grid",gridTemplateColumns:"270px 1fr",gap:14,alignItems:"start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[{label:"Admins",list:admins},{label:"Judges",list:judges},{label:"Teams",list:teams}].map(({label,list})=>(
            <Card key={label} pad={0} style={{overflow:"hidden"}}>
              <div style={{...FONT,fontSize:11,fontWeight:500,color:C.text3,letterSpacing:"0.05em",textTransform:"uppercase",padding:"8px 14px",background:C.bg2,borderBottom:`1px solid ${C.border}`}}>{label}</div>
              {list.length===0?<div style={{...FONT,fontSize:12,color:C.text3,padding:"10px 14px",fontStyle:"italic"}}>None yet.</div>
                :list.map(u=>(
                  <div key={u.id} onClick={()=>setSel(u.id)}
                    style={{padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${C.border}`,background:sel===u.id?"#eff6ff":"transparent",transition:"background 0.1s"}}
                    onMouseEnter={e=>{if(sel!==u.id)e.currentTarget.style.background=C.bg2;}}
                    onMouseLeave={e=>{if(sel!==u.id)e.currentTarget.style.background="transparent";}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <Avatar name={u.name} src={u.avatarUrl} size={28}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <div style={{...FONT,fontSize:13,fontWeight:500,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</div>
                          {u.oauthProvider&&<span style={{fontSize:10,color:C.purple}}>●</span>}
                        </div>
                        <div style={{...FONT,fontSize:11,color:C.text3}}>{u.email}</div>
                        {u.role==="team"&&<div style={{...FONT,fontSize:10,color:C.blue,fontWeight:500}}>🚀 {db.teams?.find(t=>t.id===u.teamId)?.name||"No team linked"}</div>}
                        {u.role==="judge"&&!(u.assignedHackathons||[]).length&&(
                          <div style={{...FONT,fontSize:10,color:C.amber,fontWeight:500}}>⚠ Not assigned</div>
                        )}
                        {u.role==="judge"&&!u.judgeId&&(u.assignedHackathons||[]).length>0&&(
                          <div style={{...FONT,fontSize:10,color:C.amber,fontWeight:500}}>⚠ No judge profile linked</div>
                        )}
                      </div>
                    </div>
                    {u.role==="judge"&&(u.assignedHackathons||[]).length>0&&(
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:5}}>
                        {(u.assignedHackathons||[]).map(hid=>{const h=db.hackathons.find(h=>h.id===hid);return h?<span key={hid} style={{...FONT,fontSize:10,background:"#f0fdf4",border:"1px solid #bbf7d0",color:C.green,padding:"1px 6px",borderRadius:4}}>{h.name}</span>:null;})}
                      </div>
                    )}
                  </div>
                ))
              }
            </Card>
          ))}
        </div>
        {selUser?(
          <div>
            <Card style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <Avatar name={selUser.name} src={selUser.avatarUrl} size={44}/>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <span style={{...FONT,fontSize:15,fontWeight:600,color:C.text}}>{selUser.name}</span>
                      <button title="Click to toggle role"
                        onClick={async()=>{
                          const roles=["admin","judge","team"]; const newRole=roles[(roles.indexOf(selUser.role)+1)%roles.length];
                          if(!confirm(`Change ${selUser.name} to ${newRole}?`))return;
                          try{await PUT(`/api/users/${selUser.id}`,{...selUser,role:newRole,judgeId:selUser.judgeId||undefined});await loadUsers();toast(`Role changed to ${newRole}`);}
                          catch(e){toast(e.message,"error");}
                        }}
                        style={{...FONT,display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:500,
                          padding:"2px 8px",borderRadius:9999,cursor:"pointer",transition:"opacity 0.15s",
                          background:selUser.role==="admin"?C.bgBlue:C.bg3,
                          color:selUser.role==="admin"?C.blue:C.text3,
                          border:`1px solid ${selUser.role==="admin"?C.bdBlue:C.border}`}}
                        onMouseEnter={e=>e.currentTarget.style.opacity="0.7"}
                        onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                        {selUser.role} ✎
                      </button>
                      {selUser.oauthProvider&&<Chip label={`via ${selUser.oauthProvider}`} color="purple" />}
                    </div>
                    <div style={{...FONT,fontSize:12,color:C.text3}}>{selUser.email}</div>
                    {selUser.judgeId&&<div style={{...FONT,fontSize:11,color:C.text3,marginTop:1}}>Judge profile: {db.judges?.find(j=>j.id===selUser.judgeId)?.name||selUser.judgeId}</div>}
                    {selUser.role==="team"&&selUser.teamId&&<div style={{...FONT,fontSize:11,color:C.text3,marginTop:1}}>🚀 Team: {db.teams?.find(t=>t.id===selUser.teamId)?.name||selUser.teamId}</div>}
                    {selUser.role==="team"&&!selUser.teamId&&<div style={{...FONT,fontSize:11,color:C.amber,marginTop:1}}>⚠ No team linked — check registration</div>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <Btn size="sm" variant="secondary" onClick={()=>open(selUser)}>Edit</Btn>
                  <Btn size="sm" variant="secondary" onClick={async()=>{
                    const np=prompt("Enter new password (min 8 chars):");
                    if(!np||np.length<8)return toast("Password must be at least 8 characters","error");
                    try{await PUT(`/api/users/${selUser.id}`,{...selUser,password:np});await loadUsers();toast("Password reset!");}
                    catch(e){toast(e.message,"error");}
                  }}>🔑 Reset Password</Btn>
                  <Btn size="sm" variant="danger" onClick={()=>del(selUser.id)}>Delete</Btn>
                </div>
              </div>
            </Card>
            {selUser.role==="judge"&&(
              <>
                <Card style={{marginBottom:12}}>
                  <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>Hackathon Assignments</div>
                  <p style={{...FONT,fontSize:12,color:C.text3,marginBottom:14}}>This judge can only view and score teams in assigned hackathons.</p>
                  {db.hackathons.length===0?<div style={{...FONT,fontSize:12,color:C.text3,fontStyle:"italic"}}>No hackathons exist yet.</div>
                    :db.hackathons.map(h=>{const assigned=(selUser.assignedHackathons||[]).includes(h.id);return(
                      <div key={h.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",borderRadius:R.sm,marginBottom:6,background:assigned?"#f0fdf4":C.bg2,border:`1px solid ${assigned?"#bbf7d0":C.border}`}}>
                        <div><div style={{...FONT,fontSize:13,fontWeight:500,color:C.text}}>{h.name}</div>
                          <div style={{display:"flex",gap:6,marginTop:3}}><Chip label={h.status} color={STATUS_CHIP[h.status]||"neutral"} /><span style={{...FONT,fontSize:11,color:C.text3}}>{h.location}</span></div></div>
                        <Btn size="sm" variant={assigned?"danger":"primary"} onClick={()=>toggleAssign(h.id,assigned)}>{assigned?"Remove":"Assign"}</Btn>
                      </div>
                    );})}
                </Card>
                <Card>
                  <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>Additional Page Access</div>
                  <p style={{...FONT,fontSize:12,color:C.text3,marginBottom:14}}>By default judges only see Submit Feedback. Grant access to extra pages per hackathon.</p>
                  {(selUser.assignedHackathons||[]).length===0?<div style={{...FONT,fontSize:12,color:C.text3,fontStyle:"italic"}}>Assign a hackathon first.</div>
                    :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
                      {db.hackathons.filter(h=>(selUser.assignedHackathons||[]).includes(h.id)).map(h=>(
                        <div key={h.id} style={{border:`1px solid ${C.border}`,borderRadius:R.sm,overflow:"hidden"}}>
                          <div style={{...FONT,background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"7px 12px",fontSize:11,fontWeight:500,color:C.text3,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h.name}</div>
                          {EXTRA_PAGES.map(p=>{const ex=(selUser.permissions||[]).find(x=>x.hackathonId===h.id&&x.page===p.id);return(
                            <label key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
                              <span style={{...FONT,fontSize:12,color:C.text}}>{p.label}</span>
                              <input type="checkbox" checked={!!ex} onChange={()=>togglePerm(h.id,p.id,ex)} style={{accentColor:"#2563eb",cursor:"pointer"}} />
                            </label>
                          );})}
                        </div>
                      ))}
                    </div>
                  }
                </Card>

                {/* ── Team Assignments ── */}
                <Card>
                  <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>Team Assignments</div>
                  <p style={{...FONT,fontSize:12,color:C.text3,marginBottom:14}}>
                    By default a judge sees <strong>all teams</strong> in assigned hackathons.
                    Assign specific teams to limit what they can review.
                  </p>
                  {(selUser.assignedHackathons||[]).length===0
                    ? <div style={{...FONT,fontSize:12,color:C.text3,fontStyle:"italic"}}>Assign a hackathon first.</div>
                    : db.hackathons.filter(h=>(selUser.assignedHackathons||[]).includes(h.id)).map(h=>{
                        const hackTeams = db.teams.filter(t=>t.hackathonId===h.id);
                        const assignedTeamIds = selUser.assignedTeams||[];
                        const hasSpecific = hackTeams.some(t=>assignedTeamIds.includes(t.id));
                        return(
                          <div key={h.id} style={{marginBottom:16}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                              padding:"8px 12px",background:C.bg2,borderRadius:R.sm,
                              border:`1px solid ${C.border}`,marginBottom:8}}>
                              <div style={{...FONT,fontSize:12,fontWeight:600,color:C.text}}>{h.name}</div>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                {hasSpecific
                                  ? <Chip label={`${hackTeams.filter(t=>assignedTeamIds.includes(t.id)).length} of ${hackTeams.length} teams`} color="blue" />
                                  : <Chip label="All teams visible" color="green" />
                                }
                                {hasSpecific&&(
                                  <Btn size="sm" variant="secondary" onClick={async()=>{
                                    for(const t of hackTeams.filter(t=>assignedTeamIds.includes(t.id))){
                                      await DEL(`/api/judge-teams/${selUser.id}/${t.id}`).catch(()=>{});
                                    }
                                    await loadUsers();toast("Team restrictions cleared — judge sees all teams");
                                  }}>Clear All</Btn>
                                )}
                              </div>
                            </div>
                            {hackTeams.length===0
                              ? <div style={{...FONT,fontSize:12,color:C.text3,fontStyle:"italic",paddingLeft:4}}>No teams in this hackathon yet.</div>
                              : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:6}}>
                                  {hackTeams.map(t=>{
                                    const isAssigned=assignedTeamIds.includes(t.id);
                                    const toggleTeam=async()=>{
                                      try{
                                        if(isAssigned) await DEL(`/api/judge-teams/${selUser.id}/${t.id}`);
                                        else await POST("/api/judge-teams",{userId:selUser.id,teamId:t.id,hackathonId:h.id});
                                        await loadUsers();
                                      }catch(e){toast(e.message,"error");}
                                    };
                                    return(
                                      <label key={t.id} onClick={toggleTeam}
                                        style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                                          borderRadius:R.sm,cursor:"pointer",userSelect:"none",
                                          border:`1px solid ${isAssigned?C.bdBlue:C.border}`,
                                          background:isAssigned?C.bgBlue:C.bg,transition:"all 0.15s"}}>
                                        <div style={{width:16,height:16,borderRadius:4,flexShrink:0,
                                          background:isAssigned?C.blue:C.bg3,
                                          border:`2px solid ${isAssigned?C.blue:C.border2}`,
                                          display:"flex",alignItems:"center",justifyContent:"center"}}>
                                          {isAssigned&&<span style={{color:"#fff",fontSize:10,fontWeight:700,lineHeight:1}}>✓</span>}
                                        </div>
                                        <div style={{minWidth:0}}>
                                          <div style={{...FONT,fontSize:12,fontWeight:500,color:C.text,
                                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</div>
                                          {t.project&&<div style={{...FONT,fontSize:11,color:C.text3,
                                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.project}</div>}
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                            }
                            {hackTeams.length>0&&!hasSpecific&&(
                              <div style={{...FONT,fontSize:11,color:C.text3,marginTop:6,paddingLeft:2}}>
                                💡 Check specific teams to restrict this judge. Unchecked = all teams visible.
                              </div>
                            )}
                          </div>
                        );
                      })
                  }
                </Card>
              </>
            )}
          </div>
        ):<Empty icon="👆" title="Select a user" sub="Click a user on the left to manage their access and hackathon assignments." />}
      </div>
      {modal&&(
        <Modal title={modal==="new"?"Add User":"Edit User"} onClose={close}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Full Name" required><input style={IN} value={form.name||""} onChange={f("name")} /></Field>
            <Field label="Role"><select style={IN} value={form.role||"judge"} onChange={f("role")}><option value="judge">Judge</option><option value="admin">Admin</option><option value="team">Team</option></select></Field>
          </div>
          <Field label="Email" required><input type="email" style={IN} value={form.email||""} onChange={f("email")} /></Field>
          <Field label={modal==="new"?"Password":"New Password"} hint={modal!=="new"?"Leave blank to keep current password":undefined}>
            <input type="password" style={IN} value={form.password||""} onChange={f("password")} placeholder={modal==="new"?"Required":"Leave blank to keep current"} />
          </Field>
          {form.role==="judge"&&(
            <Field label="Link to Judge Record" hint="Connects this login to a judge profile for feedback attribution">
              <select style={IN} value={form.judgeId||""} onChange={f("judgeId")}><option value="">None</option>{(db.judges||[]).map(j=><option key={j.id} value={j.id}>{j.name} — {j.org}</option>)}</select>
            </Field>
          )}
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn variant="secondary" onClick={close}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving&&<Spinner/>} Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}



/* ═══════════════════════════════════════════════════════════════════════════
   ENTERPRISE PAGES
══════════════════════════════════════════════════════════════════════════ */

// ── Submissions Page ─────────────────────────────────────────────────────────
export function SubmissionsPage({ db, toast, activeHackathon, isAdmin }) {
  const [subs,    setSubs]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState({});
  const [filter,  setFilter]  = useState("all");
  const sf = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const teams = db.teams.filter(t => t.hackathonId === activeHackathon);

  const load = () => {
    if (!activeHackathon) return;
    setLoading(true);
    GET(`/api/submissions?hackathonId=${activeHackathon}`)
      .then(d => setSubs(Array.isArray(d) ? d : []))
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [activeHackathon]);

  const STATUS_COLOR = { draft:"neutral", submitted:"blue", shortlisted:"purple", winner:"green" };

  const save = async () => {
    if (!form.teamId || !form.title?.trim()) { toast("Team and title required", "error"); return; }
    try {
      await POST("/api/submissions", { ...form, hackathonId: activeHackathon });
      load(); toast("Submission saved"); setModal(null);
    } catch(e) { toast(e.message, "error"); }
  };

  const updateStatus = async (id, status) => {
    try { await PUT(`/api/submissions/${id}`, { status }); load(); toast(`Marked as ${status}`); }
    catch(e) { toast(e.message, "error"); }
  };

  const filtered = filter === "all" ? subs : subs.filter(s => s.status === filter);

  return (
    <div>
      <SectionHeader title="Project Submissions"
        count={`${subs.filter(s=>s.status==="submitted").length} submitted`}
        action={isAdmin && <Btn onClick={() => { setForm({ hackathonId: activeHackathon }); setModal("new"); }}>+ Add Submission</Btn>}
      />
      {/* Filters */}
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {["all","draft","submitted","shortlisted","winner"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ ...FONT, fontSize:12, padding:"5px 12px", borderRadius:R.sm, cursor:"pointer",
              border:`1px solid ${filter===f?C.blue:C.border}`,
              background:filter===f?C.bgBlue:C.bg, color:filter===f?C.blue:C.text3,
              textTransform:"capitalize" }}>
            {f} ({f==="all"?subs.length:subs.filter(s=>s.status===f).length})
          </button>
        ))}
      </div>
      {loading && <div style={{ ...FONT, fontSize:13, color:C.text3, padding:24, textAlign:"center" }}>Loading…</div>}
      {!loading && filtered.length === 0 && <Empty icon="📦" title="No submissions yet" sub="Teams haven't submitted their projects yet." />}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:12 }}>
        {filtered.map(s => (
          <Card key={s.id}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div>
                <div style={{ ...FONT, fontSize:14, fontWeight:700, color:C.text, marginBottom:3 }}>{s.title}</div>
                <div style={{ ...FONT, fontSize:12, color:C.text3 }}>{s.teamName} · {s.track||"No track"}</div>
              </div>
              <Chip label={s.status} color={STATUS_COLOR[s.status]||"neutral"} />
            </div>
            {s.tagline && <div style={{ ...FONT, fontSize:12, color:C.text2, fontStyle:"italic", marginBottom:8 }}>"{s.tagline}"</div>}
            {s.description && <div style={{ ...FONT, fontSize:12, color:C.text3, lineHeight:1.6, marginBottom:10 }}>{s.description?.slice(0,120)}…</div>}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
              {s.githubUrl && <a href={s.githubUrl} target="_blank" rel="noopener" style={{ ...FONT, fontSize:11, color:C.blue }}>GitHub →</a>}
              {s.demoUrl   && <a href={s.demoUrl}   target="_blank" rel="noopener" style={{ ...FONT, fontSize:11, color:C.green }}>Demo →</a>}
              {s.videoUrl  && <a href={s.videoUrl}  target="_blank" rel="noopener" style={{ ...FONT, fontSize:11, color:C.purple }}>Video →</a>}
            </div>
            {s.techStack && <div style={{ ...FONT, fontSize:11, color:C.text3, marginBottom:8 }}>
              {s.techStack.split(",").map(t => <span key={t} style={{ display:"inline-block", padding:"2px 7px", borderRadius:9999, background:C.bg3, marginRight:4, marginBottom:3 }}>{t.trim()}</span>)}
            </div>}
            {isAdmin && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {["shortlisted","winner"].map(st => (
                  <Btn key={st} size="sm" variant={s.status===st?"primary":"secondary"} onClick={() => updateStatus(s.id, st)}>
                    {st==="winner"?"🏆 Winner":"⭐ Shortlist"}
                  </Btn>
                ))}
                {s.status!=="submitted"&&<Btn size="sm" variant="secondary" onClick={()=>updateStatus(s.id,"submitted")}>Reset</Btn>}
              </div>
            )}
          </Card>
        ))}
      </div>
      {modal && (
        <Modal title="Add Submission" onClose={() => setModal(null)} width={580}>
          <Field label="Team" required>
            <select style={IN} value={form.teamId||""} onChange={sf("teamId")}>
              <option value="">Select team…</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Project Title" required><input style={IN} value={form.title||""} onChange={sf("title")} /></Field>
            <Field label="Tagline"><input style={IN} value={form.tagline||""} onChange={sf("tagline")} /></Field>
          </div>
          <Field label="Description"><textarea style={{...TA,minHeight:72}} value={form.description||""} onChange={sf("description")} /></Field>
          <Field label="Problem Statement"><textarea style={{...TA,minHeight:60}} value={form.problemStatement||""} onChange={sf("problemStatement")} /></Field>
          <Field label="Solution"><textarea style={{...TA,minHeight:60}} value={form.solution||""} onChange={sf("solution")} /></Field>
          <Field label="Tech Stack" hint="Comma-separated"><input style={IN} value={form.techStack||""} onChange={sf("techStack")} placeholder="React, Node.js, PostgreSQL" /></Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="GitHub URL"><input style={IN} value={form.githubUrl||""} onChange={sf("githubUrl")} /></Field>
            <Field label="Demo URL"><input style={IN} value={form.demoUrl||""} onChange={sf("demoUrl")} /></Field>
            <Field label="Video URL"><input style={IN} value={form.videoUrl||""} onChange={sf("videoUrl")} /></Field>
            <Field label="Deck URL"><input style={IN} value={form.deckUrl||""} onChange={sf("deckUrl")} /></Field>
          </div>
          <Field label="Track">
            <select style={IN} value={form.track||""} onChange={sf("track")}>
              <option value="">Select track…</option>
              {(db.hackathons.find(h=>h.id===activeHackathon)?.tracks||"").split(",").map(t=>t.trim()).filter(Boolean).map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:8 }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>Save Submission</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Judge Progress Tracker ────────────────────────────────────────────────────
export function JudgeProgressPage({ db, toast, activeHackathon }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = () => {
    if (!activeHackathon) return;
    setLoading(true);
    GET(`/api/judge-progress/${activeHackathon}`)
      .then(d => setData(d))
      .catch(e => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [activeHackathon]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, activeHackathon]);

  if (!activeHackathon) return <Empty icon="📊" title="Select a hackathon" />;

  const overall = data?.overall || {};
  const progress = data?.progress || [];

  return (
    <div>
      <SectionHeader title="Judge Progress Tracker"
        action={
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <label style={{ ...FONT, fontSize:12, color:C.text3, display:"flex", alignItems:"center", gap:6 }}>
              <input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)} />
              Auto-refresh (30s)
            </label>
            <Btn variant="secondary" onClick={load} disabled={loading}>{loading?<Spinner/>:"↻"} Refresh</Btn>
          </div>
        }
      />
      {/* Overall stats */}
      {data && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
          <Stat label="Total Teams"     value={overall.total||0}         />
          <Stat label="Judges Complete" value={`${overall.judgesComplete||0}/${overall.judgesTotal||0}`} color={C.green} />
          <Stat label="Total Reviews"   value={data.progress.reduce((s,p)=>s+p.scored,0)} color={C.blue} />
          <Stat label="Coverage"        value={`${overall.total&&overall.judgesTotal?Math.round(data.progress.reduce((s,p)=>s+p.scored,0)/(overall.total*overall.judgesTotal)*100):0}%`} color={C.purple} />
        </div>
      )}
      {loading && !data && <div style={{ ...FONT, fontSize:13, color:C.text3, padding:24, textAlign:"center" }}>Loading…</div>}
      {progress.map(judge => (
        <Card key={judge.judgeId} style={{ marginBottom:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:16, alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <Avatar name={judge.name} src={judge.avatarUrl} size={44} />
              <div>
                <div style={{ ...FONT, fontSize:14, fontWeight:600, color:C.text }}>{judge.name}</div>
                <div style={{ ...FONT, fontSize:12, color:C.text3 }}>{judge.org}</div>
                <div style={{ ...FONT, fontSize:11, color:C.text3, marginTop:2 }}>
                  {judge.scored}/{judge.total} teams scored
                  {judge.conflicts > 0 && ` · ${judge.conflicts} conflict(s)`}
                </div>
              </div>
            </div>
            <div style={{ textAlign:"center", minWidth:80 }}>
              <div style={{ ...MONO, fontSize:22, fontWeight:700,
                color:judge.pct===100?C.green:judge.pct>=50?C.blue:C.amber }}>{judge.pct}%</div>
              <Chip label={judge.pct===100?"Complete":judge.pending===0?"No Teams":"In Progress"}
                color={judge.pct===100?"green":judge.pct>=50?"blue":"amber"} />
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ margin:"10px 0 0", background:C.bg3, borderRadius:4, height:6, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${judge.pct}%`, borderRadius:4, transition:"width 0.4s",
              background:judge.pct===100?C.green:C.blue }} />
          </div>
          {/* Pending teams */}
          {judge.pendingTeams?.length > 0 && (
            <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
              <span style={{ ...FONT, fontSize:11, color:C.text3 }}>Pending:</span>
              {judge.pendingTeams.slice(0,8).map(t => (
                <span key={t.id} style={{ ...FONT, fontSize:11, padding:"2px 8px", borderRadius:9999,
                  background:C.bgAmber, color:C.amber, border:`1px solid ${C.bdAmber}` }}>{t.name}</span>
              ))}
              {judge.pendingTeams.length > 8 && <span style={{ ...FONT, fontSize:11, color:C.text3 }}>+{judge.pendingTeams.length-8} more</span>}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Announcements Page ────────────────────────────────────────────────────────
export function AnnouncementsPage({ db, toast, activeHackathon }) {
  const [anns,   setAnns]  = useState([]);
  const [modal,  setModal] = useState(null);
  const [form,   setForm]  = useState({});
  const [saving, setSaving]= useState(false);
  const sf = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const load = () => {
    if (!activeHackathon) return;
    GET(`/api/announcements?hackathonId=${activeHackathon}`)
      .then(d => setAnns(Array.isArray(d) ? d : [])).catch(() => {});
  };
  useEffect(() => { load(); }, [activeHackathon]);

  const save = async () => {
    if (!form.title?.trim() || !form.body?.trim()) { toast("Title and message required", "error"); return; }
    setSaving(true);
    try {
      if (modal === "new") await POST("/api/announcements", { ...form, hackathonId: activeHackathon });
      else await PUT(`/api/announcements/${modal.id}`, form);
      load(); toast(modal==="new"?"Announcement posted":"Updated"); setModal(null);
    } catch(e) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const del = async id => {
    if (!confirm("Delete this announcement?")) return;
    try { await DEL(`/api/announcements/${id}`); load(); toast("Deleted"); } catch(e) { toast(e.message,"error"); }
  };

  const PRIORITY_COLOR = { low:"neutral", normal:"blue", high:"amber", urgent:"red" };
  const AUDIENCE_ICON  = { all:"🌐", judges:"⭐", teams:"🚀", public:"📢" };

  return (
    <div>
      <SectionHeader title="Announcements"
        action={<Btn onClick={() => { setForm({ priority:"normal", audience:"all", pinned:false }); setModal("new"); }}>+ New Announcement</Btn>}
      />
      {!activeHackathon && <Empty icon="📢" title="Select a hackathon" />}
      {anns.length === 0 && activeHackathon && <Empty icon="📢" title="No announcements yet" sub="Post an update to participants, judges, or teams." />}
      {anns.map(ann => (
        <Card key={ann.id} style={{ marginBottom:10, border:`1px solid ${ann.pinned?C.bdBlue:C.border}`,
          background:ann.pinned?C.bgBlue:C.bg }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              {ann.pinned && <span style={{ fontSize:14 }}>📌</span>}
              <span style={{ ...FONT, fontSize:15, fontWeight:600, color:C.text }}>{ann.title}</span>
              <Chip label={ann.priority} color={PRIORITY_COLOR[ann.priority]} />
              <Chip label={`${AUDIENCE_ICON[ann.audience]} ${ann.audience}`} color="neutral" />
            </div>
            <div style={{ display:"flex", gap:6, flexShrink:0 }}>
              <Btn size="sm" variant="secondary" onClick={() => { setForm({...ann}); setModal(ann); }}>Edit</Btn>
              <Btn size="sm" variant="danger"    onClick={() => del(ann.id)}>Delete</Btn>
            </div>
          </div>
          <div style={{ ...FONT, fontSize:13, color:C.text2, lineHeight:1.7, marginBottom:6 }}>{ann.body}</div>
          <div style={{ ...FONT, fontSize:11, color:C.text3 }}>
            {new Date(ann.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"})}
          </div>
        </Card>
      ))}
      {modal && (
        <Modal title={modal==="new"?"New Announcement":"Edit Announcement"} onClose={() => setModal(null)} width={540}>
          <Field label="Title" required><input style={IN} value={form.title||""} onChange={sf("title")} /></Field>
          <Field label="Message" required><textarea style={{...TA,minHeight:100}} value={form.body||""} onChange={sf("body")} /></Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Priority">
              <select style={IN} value={form.priority||"normal"} onChange={sf("priority")}>
                {["low","normal","high","urgent"].map(p=><option key={p} value={p} style={{textTransform:"capitalize"}}>{p}</option>)}
              </select>
            </Field>
            <Field label="Audience">
              <select style={IN} value={form.audience||"all"} onChange={sf("audience")}>
                {["all","judges","teams","public"].map(a=><option key={a} value={a} style={{textTransform:"capitalize"}}>{AUDIENCE_ICON[a]} {a}</option>)}
              </select>
            </Field>
          </div>
          <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, cursor:"pointer" }}>
            <input type="checkbox" checked={!!form.pinned} onChange={e=>setForm(p=>({...p,pinned:e.target.checked}))} />
            <span style={{ ...FONT, fontSize:13, color:C.text }}>📌 Pin to top</span>
          </label>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving&&<Spinner/>} {modal==="new"?"Post":"Update"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Mentors Page ──────────────────────────────────────────────────────────────
export function MentorsPage({ db, toast, activeHackathon }) {
  const [mentors, setMentors] = useState([]);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState({});
  const [saving,  setSaving]  = useState(false);
  const sf = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const teams = db.teams.filter(t => t.hackathonId === activeHackathon);

  const load = () => {
    if (!activeHackathon) return;
    GET(`/api/mentors?hackathonId=${activeHackathon}`)
      .then(d => setMentors(Array.isArray(d) ? d : [])).catch(() => {});
  };
  useEffect(() => { load(); }, [activeHackathon]);

  const save = async () => {
    if (!form.name?.trim()) { toast("Name required","error"); return; }
    setSaving(true);
    try {
      if (modal==="new") await POST("/api/mentors",{...form,hackathonId:activeHackathon});
      else await PUT(`/api/mentors/${modal.id}`,form);
      load(); toast(modal==="new"?"Mentor added":"Updated"); setModal(null);
    } catch(e){toast(e.message,"error");} finally{setSaving(false);}
  };

  const assignTeam = async (mentorId, teamId) => {
    try { await POST("/api/mentor-assignments",{mentorId,teamId,hackathonId:activeHackathon}); load(); toast("Team assigned"); }
    catch(e){toast(e.message,"error");}
  };

  const unassign = async (mentorId, teamId) => {
    try { await DEL(`/api/mentor-assignments/${mentorId}/${teamId}`); load(); toast("Unassigned"); }
    catch(e){toast(e.message,"error");}
  };

  return (
    <div>
      <SectionHeader title="Mentor Management" count={`${mentors.length} mentors`}
        action={<Btn onClick={() => { setForm({}); setModal("new"); }}>+ Add Mentor</Btn>}
      />
      {!activeHackathon && <Empty icon="🎓" title="Select a hackathon" />}
      {mentors.length===0 && activeHackathon && <Empty icon="🎓" title="No mentors yet" sub="Add mentors to support participating teams." />}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:12 }}>
        {mentors.map(m => (
          <Card key={m.id}>
            <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:10 }}>
              <Avatar name={m.name} src={m.avatarUrl} size={44} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ ...FONT, fontSize:14, fontWeight:600, color:C.text }}>{m.name}</div>
                <div style={{ ...FONT, fontSize:12, color:C.text3 }}>{m.title} · {m.org}</div>
                {m.availability && <div style={{ ...FONT, fontSize:11, color:C.blue, marginTop:2 }}>🕐 {m.availability}</div>}
              </div>
              <div style={{ display:"flex", gap:4 }}>
                <Btn size="sm" variant="secondary" onClick={() => { setForm({...m}); setModal(m); }}>Edit</Btn>
                <Btn size="sm" variant="danger" onClick={async()=>{if(!confirm("Delete?"))return;try{await DEL(`/api/mentors/${m.id}`);load();toast("Deleted");}catch(e){toast(e.message,"error");}}}>✕</Btn>
              </div>
            </div>
            {m.expertise && <div style={{ ...FONT, fontSize:11, color:C.text3, marginBottom:8 }}>
              {m.expertise.split(",").map(e=><span key={e} style={{display:"inline-block",padding:"2px 7px",borderRadius:9999,background:C.bgBlue,color:C.blue,marginRight:3,marginBottom:3,fontSize:10}}>{e.trim()}</span>)}
            </div>}
            {/* Team assignments */}
            <div style={{ ...FONT, fontSize:11, color:C.text3, fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>Assigned Teams</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
              {(m.assignments||[]).filter(a=>a.teamId).map(a=>(
                <span key={a.teamId} style={{ ...FONT, fontSize:11, padding:"3px 9px", borderRadius:9999,
                  background:C.bg3, color:C.text2, display:"flex", alignItems:"center", gap:5 }}>
                  {a.teamName}
                  <button onClick={() => unassign(m.id, a.teamId)} style={{ background:"none", border:"none",
                    cursor:"pointer", color:C.text3, fontSize:13, lineHeight:1, padding:0 }}>×</button>
                </span>
              ))}
              {(m.assignments||[]).filter(a=>a.teamId).length === 0 && <span style={{ ...FONT, fontSize:11, color:C.text3, fontStyle:"italic" }}>None assigned</span>}
            </div>
            <select style={{ ...IN, fontSize:12 }} value="" onChange={e => { if(e.target.value) assignTeam(m.id, e.target.value); }}>
              <option value="">+ Assign team…</option>
              {teams.filter(t => !(m.assignments||[]).find(a=>a.teamId===t.id)).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Card>
        ))}
      </div>
      {modal && (
        <Modal title={modal==="new"?"Add Mentor":"Edit Mentor"} onClose={()=>setModal(null)} width={520}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Full Name" required><input style={IN} value={form.name||""} onChange={sf("name")} /></Field>
            <Field label="Email"><input type="email" style={IN} value={form.email||""} onChange={sf("email")} /></Field>
            <Field label="Title / Position"><input style={IN} value={form.title||""} onChange={sf("title")} /></Field>
            <Field label="Organization"><input style={IN} value={form.org||""} onChange={sf("org")} /></Field>
          </div>
          <Field label="Expertise" hint="Comma-separated skills">
            <input style={IN} value={form.expertise||""} onChange={sf("expertise")} placeholder="AI/ML, Product, Design" />
          </Field>
          <Field label="Availability"><input style={IN} value={form.availability||""} onChange={sf("availability")} placeholder="Sat 10am-4pm, Sun 11am-2pm" /></Field>
          <Field label="Bio"><textarea style={{...TA,minHeight:64}} value={form.bio||""} onChange={sf("bio")} /></Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="LinkedIn URL"><input style={IN} value={form.linkedinUrl||""} onChange={sf("linkedinUrl")} /></Field>
            <Field label="Photo URL"><input style={IN} value={form.avatarUrl||""} onChange={sf("avatarUrl")} /></Field>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:8 }}>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving&&<Spinner/>} Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Check-in Page ─────────────────────────────────────────────────────────────
export function CheckinPage({ db, toast, activeHackathon }) {
  const [checkins, setCheckins] = useState([]);
  const [stats,    setStats]    = useState({});
  const [form,     setForm]     = useState({ type:"participant" });
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState("");
  const sf = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const teams = db.teams.filter(t => t.hackathonId === activeHackathon);

  const load = () => {
    if (!activeHackathon) return;
    GET(`/api/checkins?hackathonId=${activeHackathon}`).then(d => setCheckins(Array.isArray(d)?d:[])).catch(()=>{});
    GET(`/api/checkins/stats/${activeHackathon}`).then(d => setStats(d||{})).catch(()=>{});
  };
  useEffect(() => { load(); }, [activeHackathon]);

  const checkin = async e => {
    e.preventDefault();
    if (!form.name?.trim()) { toast("Name required","error"); return; }
    setSaving(true);
    try {
      await POST("/api/checkins",{ ...form, hackathonId:activeHackathon });
      setForm({ type:"participant" }); load(); toast(`✓ ${form.name} checked in!`);
    } catch(err){toast(err.message,"error");} finally{setSaving(false);}
  };

  const filtered = checkins.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const TYPE_ICON = { participant:"👤", judge:"⭐", mentor:"🎓", organizer:"🔧", volunteer:"🙋", sponsor:"💎" };
  const TYPE_COLOR= { participant:"neutral",judge:"blue",mentor:"purple",organizer:"green",volunteer:"amber",sponsor:"red" };

  return (
    <div>
      <SectionHeader title="Check-in / Attendance" count={`${stats.total||0} checked in`}
        action={<Btn variant="secondary" onClick={load}>↻ Refresh</Btn>}
      />
      {/* Stats */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
        {Object.entries(stats.byType||{}).map(([type,count])=>(
          <div key={type} style={{ padding:"10px 16px", background:C.bg2, border:`1px solid ${C.border}`,
            borderRadius:R.md, textAlign:"center", minWidth:90 }}>
            <div style={{ fontSize:20, marginBottom:3 }}>{TYPE_ICON[type]||"👤"}</div>
            <div style={{ ...MONO, fontSize:20, fontWeight:700, color:C.text }}>{count}</div>
            <div style={{ ...FONT, fontSize:11, color:C.text3, textTransform:"capitalize" }}>{type}s</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:20, alignItems:"start" }}>
        {/* Check-in form */}
        <Card>
          <div style={{ ...FONT, fontSize:13, fontWeight:600, color:C.text, marginBottom:14 }}>Check In</div>
          <form onSubmit={checkin}>
            <Field label="Full Name" required><input style={IN} value={form.name||""} onChange={sf("name")} autoFocus /></Field>
            <Field label="Email"><input type="email" style={IN} value={form.email||""} onChange={sf("email")} /></Field>
            <Field label="Type">
              <select style={IN} value={form.type||"participant"} onChange={sf("type")}>
                {["participant","judge","mentor","organizer","volunteer","sponsor"].map(t=>(
                  <option key={t} value={t}>{TYPE_ICON[t]} {t}</option>
                ))}
              </select>
            </Field>
            {form.type==="participant"&&<Field label="Team (optional)">
              <select style={IN} value={form.teamId||""} onChange={sf("teamId")}>
                <option value="">No team / walk-in</option>
                {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>}
            <Btn type="submit" disabled={saving} style={{ width:"100%", marginTop:4 }}>
              {saving?<Spinner/>:"✓ Check In"}
            </Btn>
          </form>
        </Card>
        {/* Attendance list */}
        <div>
          <input style={{ ...IN, marginBottom:10, width:"100%" }} value={search}
            onChange={e=>setSearch(e.target.value)} placeholder="Search by name or email…" />
          <Card style={{ padding:0, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:C.bg2, borderBottom:`1px solid ${C.border}` }}>
                  {["Name","Email","Type","Team","Time"].map(h=>(
                    <th key={h} style={{ ...FONT, fontSize:11, color:C.text3, padding:"9px 12px",
                      textAlign:"left", textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0,50).map((c,i)=>(
                  <tr key={c.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2?C.bg2:C.bg }}>
                    <td style={{ ...FONT, fontSize:13, fontWeight:500, color:C.text, padding:"8px 12px" }}>{c.name}</td>
                    <td style={{ ...FONT, fontSize:12, color:C.text3, padding:"8px 12px" }}>{c.email||"—"}</td>
                    <td style={{ padding:"8px 12px" }}><Chip label={`${TYPE_ICON[c.type]||""} ${c.type}`} color={TYPE_COLOR[c.type]||"neutral"} /></td>
                    <td style={{ ...FONT, fontSize:12, color:C.text3, padding:"8px 12px" }}>{c.teamName||"—"}</td>
                    <td style={{ ...MONO, fontSize:11, color:C.text3, padding:"8px 12px" }}>
                      {new Date(c.checkedInAt).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}
                    </td>
                  </tr>
                ))}
                {filtered.length===0&&<tr><td colSpan={5} style={{ ...FONT, fontSize:13, color:C.text3, textAlign:"center", padding:20 }}>No check-ins yet</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Certificates Page ─────────────────────────────────────────────────────────
export function CertificatesPage({ db, toast, activeHackathon }) {
  const [certs,   setCerts]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const teams = db.teams.filter(t => t.hackathonId === activeHackathon);
  const hack  = db.hackathons.find(h => h.id === activeHackathon);

  const load = () => {
    if (!activeHackathon) return;
    setLoading(true);
    GET(`/api/certificates?hackathonId=${activeHackathon}`)
      .then(d => setCerts(Array.isArray(d)?d:[])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [activeHackathon]);

  const issueForAll = async type => {
    if (!confirm(`Issue "${type}" certificates for all ${type==="participant"?`teams (${teams.length})`:"relevant people"}?`)) return;
    setIssuing(true);
    const certList = type==="participant"
      ? teams.map(t => ({ recipient:t.name, email:"", type, teamName:t.name }))
      : [];
    try {
      const r = await POST("/api/certificates/bulk",{ hackathonId:activeHackathon, certs:certList });
      load(); toast(`${r.issued} certificates issued`);
    } catch(e){toast(e.message,"error");} finally{setIssuing(false);}
  };

  const printCert = cert => {
    const w = window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>Certificate</title>
    <style>
      body{margin:0;padding:0;font-family:'Georgia',serif;background:#fff;}
      .cert{width:800px;height:560px;margin:20px auto;border:12px double #b8860b;padding:40px;
        text-align:center;background:linear-gradient(135deg,#fffef0 0%,#fff9e6 100%);
        position:relative;box-sizing:border-box;}
      .cert::before{content:"";position:absolute;inset:18px;border:2px solid #d4a017;pointer-events:none;}
      .eyebrow{font-size:13px;color:#8b6914;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:12px;}
      .title{font-size:42px;color:#b8860b;margin:0 0 8px;font-weight:bold;}
      .sub{font-size:16px;color:#555;margin-bottom:20px;}
      .name{font-size:32px;color:#1a1a1a;border-bottom:2px solid #b8860b;display:inline-block;padding-bottom:6px;margin-bottom:16px;}
      .for{font-size:15px;color:#666;margin-bottom:6px;}
      .event{font-size:20px;color:#333;font-weight:bold;margin-bottom:20px;}
      .footer{font-size:11px;color:#999;margin-top:20px;}
      .seal{font-size:48px;margin:10px 0;}
      @media print{body{margin:0;}button{display:none!important;}}
    </style></head><body>
    <div class="cert">
      <div class="eyebrow">Certificate of ${cert.type.replace("_"," ")}</div>
      <div class="title">🏆</div>
      <div class="sub">This certifies that</div>
      <div class="name">${cert.recipient}</div>
      ${cert.teamName?`<div class="for">representing team <strong>${cert.teamName}</strong></div>`:""}
      ${cert.position?`<div class="for">achieved <strong>${cert.position} Place</strong></div>`:""}
      <div class="for">has participated in</div>
      <div class="event">${hack?.name||"HackFest"}</div>
      <div class="footer">
        ${hack?.startDate?`Held on ${hack.startDate}`:""}${hack?.location?` · ${hack.location}`:""}<br/>
        Issued ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}<br/>
        Verification: ${window.location.origin}/verify/${cert.token}
      </div>
    </div>
    <div style="text-align:center;margin-top:10px;">
      <button onclick="window.print()" style="padding:10px 24px;background:#b8860b;color:#fff;border:none;borderRadius:6px;cursor:pointer;font-size:14px;">
        🖨 Print / Save as PDF
      </button>
    </div>
    </body></html>`);
    w.document.close();
  };

  const TYPE_COLOR = { winner:"green", runner_up:"blue", participant:"neutral", judge:"purple",
    mentor:"amber", best_innovation:"green", best_design:"blue" };

  return (
    <div>
      <SectionHeader title="Certificates" count={`${certs.length} issued`}
        action={
          <div style={{ display:"flex", gap:8 }}>
            <Btn size="sm" variant="secondary" onClick={() => issueForAll("participant")} disabled={issuing}>
              {issuing?<Spinner/>:"🎓"} Issue Participant Certs
            </Btn>
            <Btn onClick={load} variant="secondary" size="sm">↻</Btn>
          </div>
        }
      />
      {!activeHackathon && <Empty icon="🎓" title="Select a hackathon" />}
      {certs.length===0 && activeHackathon && (
        <Empty icon="🎓" title="No certificates issued"
          sub="Issue certificates for winners, participants, judges and mentors." />
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:10 }}>
        {certs.map(c => (
          <Card key={c.id} style={{ borderLeft:`4px solid ${C[TYPE_COLOR[c.type]?.replace("neutral","border")]||C.border}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <Chip label={c.type.replace("_"," ")} color={TYPE_COLOR[c.type]||"neutral"} />
              {c.position && <span style={{ ...MONO, fontSize:13, fontWeight:700, color:C.text }}>{c.position}</span>}
            </div>
            <div style={{ ...FONT, fontSize:15, fontWeight:600, color:C.text, marginBottom:3 }}>{c.recipient}</div>
            {c.teamName && <div style={{ ...FONT, fontSize:12, color:C.text3, marginBottom:6 }}>{c.teamName}</div>}
            <div style={{ ...FONT, fontSize:11, color:C.text3, marginBottom:10 }}>
              Issued {new Date(c.issuedAt).toLocaleDateString()}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <Btn size="sm" variant="secondary" onClick={() => printCert(c)}>🖨 Print</Btn>
              <Btn size="sm" variant="danger" onClick={async()=>{if(!confirm("Delete?"))return;try{await DEL(`/api/certificates/${c.id}`);load();toast("Deleted");}catch(e){toast(e.message,"error");}}}>✕</Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Data Export Page ──────────────────────────────────────────────────────────
export function ExportPage({ db, toast, activeHackathon }) {
  const [exporting, setExporting] = useState(false);
  const hack = db.hackathons.find(h => h.id === activeHackathon);

  const exportData = async format => {
    if (!activeHackathon) { toast("Select a hackathon first","error"); return; }
    setExporting(true);
    try {
      const data = await GET(`/api/export/${activeHackathon}`);
      if (data.error) { toast(data.error,"error"); return; }

      if (format === "json") {
        const blob = new Blob([JSON.stringify(data, null, 2)],{type:"application/json"});
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = `${hack?.name||"hackfest"}-export.json`; a.click();
        toast("JSON exported");
        return;
      }

      // CSV exports
      const toCSV = (rows, cols) => {
        if (!rows?.length) return "";
        const headers = cols || Object.keys(rows[0]);
        const lines = [headers.join(","), ...rows.map(r => headers.map(h => {
          const v = r[h]; return `"${String(v||"").replace(/"/g,'""')}"`;
        }).join(","))];
        return lines.join("\n");
      };

      const sheets = {
        "Rankings":      toCSV(data.teams),
        "Registrations": toCSV(data.registrations),
        "Submissions":   toCSV(data.submissions, ["teamName","title","track","status","githubUrl","demoUrl"]),
        "Check-ins":     toCSV(data.checkins, ["name","email","type","teamName","checkedInAt"]),
        "Raw Feedback":  toCSV(data.rawFeedbacks, ["teamName","judgeName","overall","submittedAt"]),
      };

      // Zip all CSVs into a single download (one big text file as fallback)
      const combined = Object.entries(sheets).map(([name, csv]) =>
        `\n### ${name}\n${csv}`
      ).join("\n\n");
      const blob = new Blob([`HackFest Hub Export — ${hack?.name}\nGenerated: ${new Date().toISOString()}\n`+combined],{type:"text/csv"});
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `${hack?.name||"hackfest"}-${format}-export.csv`; a.click();
      toast("CSV exported");
    } catch(e){toast(e.message,"error");} finally{setExporting(false);}
  };

  const EXPORTS = [
    { id:"json",   icon:"📄", label:"Full JSON Export",        desc:"Complete data dump — all tables, all fields. Use for backup or API integration." },
    { id:"scores", icon:"🏆", label:"Rankings CSV",            desc:"Team rankings with weighted scores per judge. Ready for sharing with stakeholders." },
    { id:"regs",   icon:"📋", label:"Registrations CSV",       desc:"All registration applications with status, contact info, and team details." },
    { id:"full",   icon:"📊", label:"Complete CSV Package",    desc:"All sheets combined: rankings, registrations, submissions, check-ins, feedback." },
  ];

  return (
    <div>
      <SectionHeader title="Data Export Center" />
      {!activeHackathon && <Empty icon="📤" title="Select a hackathon" />}
      {activeHackathon && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
          {EXPORTS.map(exp => (
            <Card key={exp.id} style={{ cursor:"pointer", transition:"border 0.15s" }}
              onClick={() => !exporting && exportData(exp.id)}>
              <div style={{ fontSize:36, marginBottom:12 }}>{exp.icon}</div>
              <div style={{ ...FONT, fontSize:15, fontWeight:700, color:C.text, marginBottom:6 }}>{exp.label}</div>
              <div style={{ ...FONT, fontSize:12, color:C.text3, lineHeight:1.65, marginBottom:14 }}>{exp.desc}</div>
              <Btn disabled={exporting} style={{ width:"100%" }}>
                {exporting?<><Spinner/> Exporting…</>:"⬇ Download"}
              </Btn>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


/* ─── PEOPLE EDITOR ──────────────────────────────────────────────────────── */
function PeopleEditor({ title, type, hackathonId, toast }) {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [modal,    setModal]    = useState(null);
  const [form,     setForm]     = useState({});
  const [saving,   setSaving]   = useState(false);
  const [uploading,setUploading]= useState(false);

  const loadItems = () => {
    if (!hackathonId) return;
    setLoading(true);
    GET(`/api/speakers?hackathonId=${hackathonId}&type=${type}`)
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadItems(); }, [hackathonId, type]);

  const sf = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const openNew  = () => { setForm({ hackathonId, type, sortOrder: items.length }); setModal("new"); };
  const openEdit = item => { setForm({ ...item }); setModal(item); };
  const closeModal = () => { setModal(null); setForm({}); };

  const handlePhoto = e => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 2*1024*1024) { toast("Photo must be under 2MB","error"); return; }
    setUploading(true);
    const r = new FileReader();
    r.onload = ev => { setForm(p => ({ ...p, avatarUrl: ev.target.result })); setUploading(false); };
    r.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.name?.trim()) { toast("Name is required","error"); return; }
    setSaving(true);
    try {
      if (modal === "new") await POST("/api/speakers", form);
      else await PUT(`/api/speakers/${modal.id}`, form);
      loadItems();
      toast(modal === "new" ? "Added successfully" : "Updated successfully");
      closeModal();
    } catch(e) {
      toast(e.message || "Save failed","error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async id => {
    if (!confirm("Remove this person?")) return;
    try { await DEL(`/api/speakers/${id}`); setItems(prev => prev.filter(x => x.id !== id)); toast("Removed"); }
    catch(e) { toast(e.message || "Delete failed","error"); }
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text}}>
          {title} <span style={{...FONT,fontSize:12,fontWeight:400,color:C.text3}}>({items.length})</span>
        </div>
        <Btn size="sm" onClick={openNew}>+ Add</Btn>
      </div>
      {loading && <div style={{...FONT,fontSize:13,color:C.text3,padding:"10px 0"}}>Loading…</div>}
      {!loading && items.length === 0 && (
        <div style={{...FONT,fontSize:12,color:C.text3,fontStyle:"italic",padding:"8px 0"}}>
          No {title.toLowerCase()} yet. Click + Add to begin.
        </div>
      )}
      {!loading && items.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
          {items.map(item => (
            <div key={item.id} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:R.md,padding:14}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                {item.avatarUrl
                  ? <img src={item.avatarUrl} style={{width:40,height:40,borderRadius:"50%",objectFit:"cover",flexShrink:0}} onError={e=>e.target.style.display="none"} />
                  : <Avatar name={item.name} size={40} />}
                <div style={{minWidth:0}}>
                  <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                  <div style={{...FONT,fontSize:11,color:C.text3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.org||item.title||"—"}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <Btn size="sm" variant="secondary" onClick={()=>openEdit(item)}>Edit</Btn>
                <Btn size="sm" variant="danger"    onClick={()=>remove(item.id)}>Remove</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && (
        <Modal title={modal==="new" ? `Add to ${title}` : `Edit`} onClose={closeModal} width={540}>
          <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:16,padding:14,background:C.bg2,borderRadius:R.sm,border:`1px solid ${C.border}`}}>
            <div style={{width:64,height:64,borderRadius:"50%",overflow:"hidden",flexShrink:0,
              background:form.avatarUrl?"transparent":C.bg3,border:`2px dashed ${form.avatarUrl?C.bdGreen:C.border2}`,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              {form.avatarUrl
                ? <img src={form.avatarUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} />
                : <span style={{fontSize:22,opacity:0.3}}>👤</span>}
            </div>
            <div style={{flex:1}}>
              <label style={{...FONT,display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:500,
                padding:"6px 12px",borderRadius:R.sm,border:`1px solid ${C.border2}`,cursor:"pointer",
                background:C.bg,color:C.text2,marginBottom:6,opacity:uploading?0.6:1,userSelect:"none"}}>
                {uploading ? <><Spinner size={10}/> Uploading…</> : <>📷 {form.avatarUrl?"Change":"Upload"} Photo</>}
                <input type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}} disabled={uploading} />
              </label>
              <input style={{...IN,fontSize:12,display:"block"}}
                value={form.avatarUrl&&!form.avatarUrl.startsWith("data:")?form.avatarUrl:""}
                onChange={e=>setForm(p=>({...p,avatarUrl:e.target.value}))}
                placeholder="Or paste image URL…" />
            </div>
          </div>
          <Field label="Full Name" required><input style={IN} value={form.name||""} onChange={sf("name")} placeholder="Dr. Jane Smith" /></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Title / Position"><input style={IN} value={form.title||""} onChange={sf("title")} placeholder="CEO, Professor…" /></Field>
            <Field label="Organization"><input style={IN} value={form.org||""} onChange={sf("org")} placeholder="Company / University" /></Field>
          </div>
          <Field label="Session Topic" hint="Optional — shown as subtitle on public page">
            <input style={IN} value={form.sessionTopic||""} onChange={sf("sessionTopic")} placeholder="Talk title or topic" />
          </Field>
          <Field label="Bio" hint="1-2 sentences"><textarea style={{...TA,minHeight:64}} value={form.bio||""} onChange={sf("bio")} /></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="LinkedIn URL"><input style={IN} value={form.linkedinUrl||""} onChange={sf("linkedinUrl")} placeholder="https://linkedin.com/in/…" /></Field>
            <Field label="Twitter / X"><input style={IN} value={form.twitterUrl||""} onChange={sf("twitterUrl")} placeholder="https://twitter.com/…" /></Field>
          </div>
          <Field label="Sort Order" hint="Lower number = appears first">
            <input type="number" style={IN} value={form.sortOrder||0} onChange={sf("sortOrder")} />
          </Field>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <Btn variant="secondary" onClick={closeModal}>Cancel</Btn>
            <Btn onClick={save} disabled={saving||uploading}>{(saving||uploading)&&<Spinner/>} Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}





/* ─── LOGIN LOGS PAGE ─────────────────────────────────────────────────────── */
export function LoginLogsPage({ toast }) {
  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState("");   // login|logout|failed|""
  const [search,  setSearch]  = useState("");
  const [page,    setPage]    = useState(0);
  const PAGE = 50;

  const load = async (pg=0, f=filter, s=search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit:PAGE, offset:pg*PAGE });
      if (f) params.set("filter", f);
      if (s) params.set("search", s);
      const d = await GET(`/api/login-logs?${params}`);
      if (d.error) toast(d.error,"error");
      else { setLogs(d.logs); setTotal(d.total); setPage(pg); }
    } catch(e) { toast(e.message,"error"); }
    setLoading(false);
  };

  useEffect(()=>{ load(); },[]);

  const ACTION_COLOR = { login:"green", logout:"blue", failed:"red" };
  const ACTION_ICON  = { login:"→", logout:"←", failed:"✗" };
  const METHOD_ICON  = { email:"✉", google:"G", github:"", gitlab:"" };

  const fmtTime = ts => {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}) + " " +
           d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
  };

  // Stats
  const loginCount  = logs.filter(l=>l.action==="login").length;
  const logoutCount = logs.filter(l=>l.action==="logout").length;
  const failedCount = logs.filter(l=>l.action==="failed").length;

  return (
    <div>
      <SectionHeader title="Login Activity Log" count={`${total} total events`}
        action={<Btn variant="secondary" onClick={()=>load(0)} disabled={loading}>{loading?<Spinner/>:"↻"} Refresh</Btn>}
      />

      {/* Stats strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {[["Logins",  loginCount,  C.green],
          ["Logouts", logoutCount, C.blue],
          ["Failed",  failedCount, C.red]
        ].map(([label,val,color])=>(
          <div key={label} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"14px 16px",textAlign:"center"}}>
            <div style={{...FONT,fontSize:22,fontWeight:700,color,marginBottom:2}}>{val}</div>
            <div style={{...FONT,fontSize:12,color:C.text3}}>{label} (shown)</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card style={{marginBottom:14,padding:"12px 16px"}}>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <input style={{...FONT,flex:1,minWidth:160,padding:"7px 11px",borderRadius:R.sm,
            border:`1px solid ${C.border2}`,background:C.bg,fontSize:13,color:C.text}}
            placeholder="Search name or email…"
            value={search} onChange={e=>setSearch(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&load(0,filter,search)} />
          <div style={{display:"flex",gap:6}}>
            {["","login","logout","failed"].map(f=>(
              <button key={f} onClick={()=>{setFilter(f);load(0,f,search);}}
                style={{...FONT,fontSize:12,padding:"6px 12px",borderRadius:R.sm,cursor:"pointer",
                  border:`1px solid ${filter===f?C.blue:C.border}`,
                  background:filter===f?C.bgBlue:C.bg,
                  color:filter===f?C.blue:C.text3,fontWeight:filter===f?600:400}}>
                {f||"All"}{f&&` ${ACTION_ICON[f]}`}
              </button>
            ))}
          </div>
          <Btn size="sm" onClick={()=>load(0,filter,search)}>Search</Btn>
        </div>
      </Card>

      {/* Table */}
      <Card style={{padding:0,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:C.bg2,borderBottom:`1px solid ${C.border}`}}>
              {["Time","User","Email","Role","Action","Method","IP"].map(h=>(
                <th key={h} style={{...FONT,fontSize:11,fontWeight:600,color:C.text3,
                  padding:"10px 12px",textAlign:"left",textTransform:"uppercase",letterSpacing:"0.05em"}}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{...FONT,fontSize:13,color:C.text3,textAlign:"center",padding:24}}>
                <Spinner/> Loading…
              </td></tr>
            )}
            {!loading && logs.length===0 && (
              <tr><td colSpan={7} style={{...FONT,fontSize:13,color:C.text3,textAlign:"center",padding:24}}>
                No log entries found.
              </td></tr>
            )}
            {!loading && logs.map((log,i)=>(
              <tr key={log.id} style={{borderBottom:`1px solid ${C.border}`,
                background:i%2===0?C.bg:C.bg2,
                ...(log.action==="failed"?{background:"rgba(239,68,68,0.04)"}:{})}}>
                <td style={{...MONO,fontSize:11,color:C.text3,padding:"9px 12px",whiteSpace:"nowrap"}}>{fmtTime(log.createdAt)}</td>
                <td style={{...FONT,fontSize:13,color:C.text,padding:"9px 12px",fontWeight:500}}>{log.name||"—"}</td>
                <td style={{...FONT,fontSize:12,color:C.text3,padding:"9px 12px"}}>{log.email||"—"}</td>
                <td style={{padding:"9px 12px"}}>
                  {log.role&&<Chip label={log.role} color={log.role==="admin"?"blue":"neutral"} />}
                </td>
                <td style={{padding:"9px 12px"}}>
                  <span style={{...FONT,fontSize:12,fontWeight:600,
                    color:log.action==="login"?C.green:log.action==="logout"?C.blue:C.red}}>
                    {ACTION_ICON[log.action]} {log.action}
                  </span>
                </td>
                <td style={{padding:"9px 12px"}}>
                  <Chip label={`${METHOD_ICON[log.method]||""} ${log.method||"?"}`} color="neutral" />
                </td>
                <td style={{...MONO,fontSize:11,color:C.text3,padding:"9px 12px"}}>{log.ip||"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Pagination */}
      {total > PAGE && (
        <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:12}}>
          <Btn size="sm" variant="secondary" disabled={page===0} onClick={()=>load(page-1)}>← Prev</Btn>
          <span style={{...FONT,fontSize:13,color:C.text3,padding:"6px 10px"}}>
            Page {page+1} of {Math.ceil(total/PAGE)}
          </span>
          <Btn size="sm" variant="secondary" disabled={(page+1)*PAGE>=total} onClick={()=>load(page+1)}>Next →</Btn>
        </div>
      )}
    </div>
  );
}



/* ─── EMAIL CENTER PAGE ──────────────────────────────────────────────────── */
export function EmailCenterPage({ db, toast, activeHackathon, currentUser }) {
  const [status,   setStatus]   = useState(null);
  const [sending,  setSending]  = useState("");
  const [winners,  setWinners]  = useState([{name:"",email:"",teamName:"",position:"1st",prizeInfo:""}]);
  const [audience, setAudience] = useState("all");
  const hack = db.hackathons.find(h => h.id === activeHackathon);

  useEffect(() => {
    GET("/api/email/status")
      .then(d => setStatus(d))
      .catch(() => setStatus({ configured: false }));
  }, []);

  const send = async (action, body = {}) => {
    setSending(action);
    try {
      const r = await POST(`/api/email/${action}`, { hackathonId: activeHackathon, ...body });
      if (r.error) toast(r.error, "error");
      else if (r.skipped) toast(`Skipped: ${r.skipped}`, "error");
      else toast(`✓ Email sent${r.sent > 1 ? ` to ${r.sent} recipients` : ""}!`);
    } catch(e) { toast(e.message, "error"); }
    setSending("");
  };

  const ActionCard = ({ icon, title, desc, action, body, disabled, extra }) => (
    <Card style={{ marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <span style={{ fontSize:22 }}>{icon}</span>
            <span style={{ ...FONT, fontSize:14, fontWeight:700, color:C.text }}>{title}</span>
          </div>
          <p style={{ ...FONT, fontSize:12, color:C.text3, lineHeight:1.65 }}>{desc}</p>
          {extra}
        </div>
        <Btn disabled={sending===action || disabled} onClick={() => send(action, body)}
          style={{ flexShrink:0, whiteSpace:"nowrap" }}>
          {sending===action ? <><Spinner/> Sending…</> : "Send ✉"}
        </Btn>
      </div>
    </Card>
  );

  return (
    <div>
      <SectionHeader title="Email Center" count={hack?.name} />

      {/* Status banner */}
      <Card style={{ marginBottom:20, background: status?.configured ? C.bgGreen : C.bgAmber,
        border:`1px solid ${status?.configured ? C.bdGreen : C.bdAmber}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:20 }}>{status?.configured ? "✅" : "⚠️"}</span>
            <div>
              <div style={{ ...FONT, fontSize:13, fontWeight:600, color:status?.configured?C.green:C.amber }}>
                {status?.configured ? "Resend API connected — emails are live" : "Resend API not configured"}
              </div>
              <div style={{ ...FONT, fontSize:12, color:C.text3 }}>
                {status?.configured
                  ? `Sending from: ${status.from}`
                  : "Add RESEND_API_KEY to Vercel → Settings → Environment Variables"}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {!status?.configured && (
              <a href="https://resend.com" target="_blank" rel="noopener"
                style={{ ...FONT, fontSize:12, padding:"7px 14px", borderRadius:R.sm,
                  background:C.amber, color:"#fff", textDecoration:"none", fontWeight:600 }}>
                Get Free API Key →
              </a>
            )}
            <Btn size="sm" variant="secondary" disabled={sending==="test"} onClick={() => send("test")}>
              {sending==="test" ? <><Spinner/> Sending…</> : "Send Test Email"}
            </Btn>
          </div>
        </div>
      </Card>

      {!activeHackathon && <Empty icon="✉" title="Select a hackathon" />}

      {activeHackathon && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, alignItems:"start" }}>
          {/* Left: Automated (auto-send) */}
          <div>
            <div style={{ ...FONT, fontSize:11, fontWeight:600, color:C.text3, textTransform:"uppercase",
              letterSpacing:"0.08em", marginBottom:12 }}>Auto-Sent (no action needed)</div>
            <Card style={{ background:C.bg2, marginBottom:12, border:`1px dashed ${C.border2}` }}>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <span style={{ fontSize:20 }}>🤖</span>
                <div>
                  <div style={{ ...FONT, fontSize:13, fontWeight:600, color:C.text, marginBottom:4 }}>Registration Confirmation</div>
                  <p style={{ ...FONT, fontSize:12, color:C.text3, lineHeight:1.6 }}>Sent automatically when someone submits registration form on the public page.</p>
                </div>
              </div>
            </Card>
            <Card style={{ background:C.bg2, marginBottom:20, border:`1px dashed ${C.border2}` }}>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <span style={{ fontSize:20 }}>✅</span>
                <div>
                  <div style={{ ...FONT, fontSize:13, fontWeight:600, color:C.text, marginBottom:4 }}>Approval Confirmation</div>
                  <p style={{ ...FONT, fontSize:12, color:C.text3, lineHeight:1.6 }}>Sent automatically when you approve a registration in Pages & Registrations.</p>
                </div>
              </div>
            </Card>

            <div style={{ ...FONT, fontSize:11, fontWeight:600, color:C.text3, textTransform:"uppercase",
              letterSpacing:"0.08em", marginBottom:12 }}>Manual Sends</div>

            <ActionCard icon="⏰" action="reminder"
              title="Event Reminder"
              desc="Send a reminder to all approved registrants. Best sent 1-3 days before the event."
            />
            <ActionCard icon="🙏" action="thank-you"
              title="Post-Event Thank You"
              desc="Send thank you emails to participants after the event concludes."
              body={{ audience }}
              extra={
                <div style={{ marginTop:8 }}>
                  <select style={{ ...IN, fontSize:12, padding:"5px 10px" }}
                    value={audience} onChange={e=>setAudience(e.target.value)}>
                    <option value="all">All (teams + judges)</option>
                    <option value="team">Teams only</option>
                    <option value="judge">Judges only</option>
                  </select>
                </div>
              }
            />
          </div>

          {/* Right: Post-event emails */}
          <div>
            <div style={{ ...FONT, fontSize:11, fontWeight:600, color:C.text3, textTransform:"uppercase",
              letterSpacing:"0.08em", marginBottom:12 }}>Award Emails</div>

            <ActionCard icon="🏆" action="best-judge"
              title="Best Judge Award"
              desc={hack?.bestJudgeId ? `Send award notification to the nominated Best Judge.` : `No Best Judge nominated yet. Go to Best Judge Award page to nominate one.`}
              disabled={!hack?.bestJudgeId}
            />

            {/* Winner emails */}
            <Card style={{ marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                <span style={{ fontSize:22 }}>🥇</span>
                <span style={{ ...FONT, fontSize:14, fontWeight:700, color:C.text }}>Winner Announcements</span>
              </div>
              <p style={{ ...FONT, fontSize:12, color:C.text3, marginBottom:14, lineHeight:1.65 }}>
                Send personalized winner emails to each placement. Fill in the details below.
              </p>
              {winners.map((w, i) => (
                <div key={i} style={{ background:C.bg2, borderRadius:R.sm, padding:12,
                  border:`1px solid ${C.border}`, marginBottom:8 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                    <div>
                      <div style={{ ...FONT, fontSize:11, color:C.text3, marginBottom:4 }}>Name</div>
                      <input style={{ ...IN, fontSize:12 }} value={w.name}
                        onChange={e=>setWinners(ws=>ws.map((x,j)=>j===i?{...x,name:e.target.value}:x))} />
                    </div>
                    <div>
                      <div style={{ ...FONT, fontSize:11, color:C.text3, marginBottom:4 }}>Email</div>
                      <input type="email" style={{ ...IN, fontSize:12 }} value={w.email}
                        onChange={e=>setWinners(ws=>ws.map((x,j)=>j===i?{...x,email:e.target.value}:x))} />
                    </div>
                    <div>
                      <div style={{ ...FONT, fontSize:11, color:C.text3, marginBottom:4 }}>Team Name</div>
                      <input style={{ ...IN, fontSize:12 }} value={w.teamName}
                        onChange={e=>setWinners(ws=>ws.map((x,j)=>j===i?{...x,teamName:e.target.value}:x))} />
                    </div>
                    <div>
                      <div style={{ ...FONT, fontSize:11, color:C.text3, marginBottom:4 }}>Position</div>
                      <select style={{ ...IN, fontSize:12 }} value={w.position}
                        onChange={e=>setWinners(ws=>ws.map((x,j)=>j===i?{...x,position:e.target.value}:x))}>
                        {["1st","2nd","3rd","Runner-up","Special Award"].map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <div style={{ ...FONT, fontSize:11, color:C.text3, marginBottom:4 }}>Prize Details</div>
                    <input style={{ ...IN, fontSize:12 }} value={w.prizeInfo} placeholder="e.g. $10,000 + AWS Credits"
                      onChange={e=>setWinners(ws=>ws.map((x,j)=>j===i?{...x,prizeInfo:e.target.value}:x))} />
                  </div>
                </div>
              ))}
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <Btn size="sm" variant="secondary"
                  onClick={()=>setWinners(ws=>[...ws,{name:"",email:"",teamName:"",position:"Runner-up",prizeInfo:""}])}>
                  + Add Winner
                </Btn>
                <Btn size="sm" disabled={sending==="winners" || winners.every(w=>!w.email)}
                  onClick={() => send("winners", { winners })}>
                  {sending==="winners"?<><Spinner/> Sending…</>:"Send Winner Emails ✉"}
                </Btn>
              </div>
            </Card>

            {/* Judge credentials card */}
            <Card>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <span style={{ fontSize:20 }}>⭐</span>
                <div>
                  <div style={{ ...FONT, fontSize:13, fontWeight:600, color:C.text, marginBottom:4 }}>Judge Credentials</div>
                  <p style={{ ...FONT, fontSize:12, color:C.text3, lineHeight:1.6 }}>
                    Judge login emails are sent automatically when you click <strong>+ Add to Judges</strong> in the Registrations page and their account is created.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}



/* ─── Q&A ADMIN PAGE ─────────────────────────────────────────────────────── */
export function QAAdminPage({ db, toast, activeHackathon }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [answering, setAnswering] = useState(null);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!activeHackathon) return;
    setLoading(true);
    GET(`/api/public/questions/${activeHackathon}`)
      .then(d => setQuestions(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [activeHackathon]);

  const saveAnswer = async q => {
    setSaving(true);
    try {
      await PUT(`/api/questions/${q.id}/answer`, { answer, pinned: q.pinned });
      setAnswering(null); setAnswer(""); load(); toast("Answer posted!");
    } catch(e) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const unanswered = questions.filter(q => !q.answer);
  const answered   = questions.filter(q =>  q.answer);

  return (
    <div>
      <SectionHeader title="Q&A Management"
        count={`${unanswered.length} unanswered · ${answered.length} answered`}
        action={<Btn variant="secondary" onClick={load}>{loading?<Spinner/>:"↻"} Refresh</Btn>}
      />
      {!activeHackathon && <Empty icon="❓" title="Select a hackathon" />}

      {unanswered.length > 0 && (
        <>
          <div style={{ ...FONT, fontSize:11, fontWeight:700, color:C.amber, textTransform:"uppercase",
            letterSpacing:"0.08em", marginBottom:10 }}>⏳ Awaiting answers ({unanswered.length})</div>
          {unanswered.map(q => (
            <Card key={q.id} style={{ marginBottom:10, border:`1px solid ${C.bdAmber}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div>
                  <div style={{ ...FONT, fontSize:14, fontWeight:600, color:C.text, marginBottom:4 }}>{q.question}</div>
                  <div style={{ ...FONT, fontSize:12, color:C.text3 }}>
                    Asked by {q.askerName} · {new Date(q.createdAt).toLocaleDateString()} · ▲ {q.upvotes||0} upvotes
                  </div>
                </div>
                <Btn size="sm" onClick={() => { setAnswering(q); setAnswer(""); }}>Answer</Btn>
              </div>
              {answering?.id === q.id && (
                <div style={{ marginTop:12 }}>
                  <textarea value={answer} onChange={e=>setAnswer(e.target.value)}
                    style={{ ...TA, minHeight:80, marginBottom:8 }}
                    placeholder="Write your answer…" autoFocus />
                  <div style={{ display:"flex", gap:8 }}>
                    <Btn onClick={() => saveAnswer(q)} disabled={saving||!answer.trim()}>
                      {saving?<Spinner/>:"Post Answer"}
                    </Btn>
                    <Btn variant="secondary" onClick={() => setAnswering(null)}>Cancel</Btn>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </>
      )}

      {answered.length > 0 && (
        <>
          <div style={{ ...FONT, fontSize:11, fontWeight:700, color:C.green, textTransform:"uppercase",
            letterSpacing:"0.08em", margin:"20px 0 10px" }}>✓ Answered ({answered.length})</div>
          {answered.map(q => (
            <Card key={q.id} style={{ marginBottom:8, opacity:0.8 }}>
              <div style={{ ...FONT, fontSize:13, fontWeight:600, color:C.text, marginBottom:6 }}>{q.question}</div>
              <div style={{ borderLeft:`3px solid ${C.green}`, paddingLeft:12 }}>
                <div style={{ ...FONT, fontSize:12, color:C.text3, marginBottom:3 }}>Your answer:</div>
                <div style={{ ...FONT, fontSize:13, color:C.text2, lineHeight:1.6 }}>{q.answer}</div>
              </div>
            </Card>
          ))}
        </>
      )}
      {questions.length === 0 && !loading && activeHackathon && (
        <Empty icon="❓" title="No questions yet" sub="Questions submitted on the public page will appear here." />
      )}
    </div>
  );
}



/* ═══════════════════════════════════════════════════════════════════════════
   TEAM EXCEL IMPORT PAGE
   Uses SheetJS (xlsx) — already in the React bundle
══════════════════════════════════════════════════════════════════════════ */
export function TeamImportPage({ db, toast, activeHackathon }) {
  const [step,       setStep]      = useState(1);   // 1=upload 2=preview 3=done
  const [fileName,   setFileName]  = useState("");
  const [rawRows,    setRawRows]   = useState([]);
  const [teams,      setTeams]     = useState([]);
  const [importing,  setImporting] = useState(false);
  const [result,     setResult]    = useState(null);
  const [mode,       setMode]      = useState("skip");
  const [dragOver,   setDragOver]  = useState(false);
  const fileRef  = useRef(null);
  const hack     = db.hackathons.find(h => h.id === activeHackathon);

  // ── Download template ─────────────────────────────────────────────────────
  const downloadTemplate = () => {
    // Use SheetJS if available, otherwise CSV fallback
    const rows = [
      ["Team Name *", "Project Name", "Track / Category", "Member Name *", "Member Email", "Member Role"],
      ["Team Alpha",  "AI Health Scanner", "AI/ML",       "Alice Johnson",  "alice@example.com", "Team Lead"],
      ["Team Alpha",  "",                  "",             "Bob Chen",       "bob@example.com",   "Backend Dev"],
      ["Team Alpha",  "",                  "",             "Carol Smith",    "carol@example.com", "UI Designer"],
      ["Team Beta",   "GreenGrid",         "Sustainability","Dave Kumar",    "dave@example.com",  "Full Stack"],
      ["Team Beta",   "",                  "",             "Eve Martinez",   "eve@example.com",   "Data Scientist"],
      ["Team Gamma",  "SecureVault",       "Security",     "Frank Lee",      "frank@example.com", "Security Engineer"],
    ];

    if (window.XLSX) {
      const ws = window.XLSX.utils.aoa_to_sheet(rows);
      // Style header row
      ws["!cols"] = [20,22,18,20,26,18].map(w=>({wch:w}));
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Teams & Members");
      // Instructions sheet
      const inst = window.XLSX.utils.aoa_to_sheet([
        ["HackFest Hub — Team Import Template"],
        [""],
        ["INSTRUCTIONS:"],
        ["1. Fill one row per team member"],
        ["2. Repeat the Team Name for each member of the same team"],
        ["3. Only enter Project Name and Track in the FIRST row of each team"],
        ["4. Team Name and Member Name are required (marked with *)"],
        ["5. Delete these example rows before uploading"],
        ["6. Save as .xlsx or .csv"],
        [""],
        ["COLUMNS:"],
        ["Team Name *",   "Required. All rows for the same team must have identical team names"],
        ["Project Name",  "Optional. Enter only on the first row of each team"],
        ["Track / Category", "Optional. e.g. AI/ML, Sustainability, Security"],
        ["Member Name *", "Required. Full name of the team member"],
        ["Member Email",  "Optional but recommended. Used to link participant accounts"],
        ["Member Role",   "Optional. e.g. Team Lead, Backend Dev, UI Designer"],
      ]);
      inst["!cols"] = [{wch:24},{wch:60}];
      window.XLSX.utils.book_append_sheet(wb, inst, "Instructions");
      window.XLSX.writeFile(wb, "hackfesthub-team-template.xlsx");
    } else {
      // CSV fallback
      const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type:"text/csv" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "hackfesthub-team-template.csv"; a.click();
    }
    toast("Template downloaded!");
  };

  // ── Parse uploaded file ───────────────────────────────────────────────────
  const parseFile = file => {
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = e => {
      try {
        let rows = [];

        if (file.name.endsWith(".csv")) {
          // Parse CSV
          const text = e.target.result;
          rows = text.split("\n").map(line =>
            line.split(",").map(c => c.replace(/^"|"$/g,"").trim())
          ).filter(r => r.some(c => c));
        } else if (window.XLSX) {
          // Parse XLSX using SheetJS
          const data = new Uint8Array(e.target.result);
          const wb   = window.XLSX.read(data, { type:"array" });
          const ws   = wb.Sheets[wb.SheetNames[0]];
          rows       = window.XLSX.utils.sheet_to_json(ws, { header:1, defval:"" });
        } else {
          toast("SheetJS not loaded. Please use a CSV file.", "error");
          return;
        }

        // Find header row (look for "Team Name" in first 3 rows)
        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const r = rows[i].map(c => String(c).toLowerCase());
          if (r.some(c => c.includes("team"))) { headerIdx = i; break; }
        }
        if (headerIdx < 0) { toast("Could not find header row. Make sure first column is 'Team Name'.", "error"); return; }

        const headers = rows[headerIdx].map(c => String(c).toLowerCase().trim());
        const dataRows = rows.slice(headerIdx + 1).filter(r => r.some(c => String(c).trim()));

        // Map columns flexibly
        const col = name => {
          const idx = headers.findIndex(h =>
            h.includes(name) || (name==="team" && h.includes("team name")) ||
            (name==="project" && (h.includes("project") || h.includes("submission"))) ||
            (name==="category" && (h.includes("track") || h.includes("category") || h.includes("theme"))) ||
            (name==="mname" && (h.includes("member name") || (h.includes("member") && h.includes("name")))) ||
            (name==="memail" && (h.includes("member email") || (h.includes("member") && h.includes("email")))) ||
            (name==="mrole" && (h.includes("role") || h.includes("position")))
          );
          return idx;
        };

        const colTeam  = col("team");
        const colProj  = col("project");
        const colCat   = col("category");
        const colMName = col("mname");
        const colMEmail= col("memail");
        const colMRole = col("mrole");

        if (colTeam < 0) { toast("Could not find 'Team Name' column.", "error"); return; }
        if (colMName < 0) { toast("Could not find 'Member Name' column.", "error"); return; }

        // Group rows by team name
        const teamMap = new Map();
        let   rowErrors = [];

        dataRows.forEach((row, i) => {
          const teamName = String(row[colTeam]||"").trim();
          if (!teamName) return; // skip blank team rows

          if (!teamMap.has(teamName)) {
            teamMap.set(teamName, {
              name: teamName,
              project:  colProj  >= 0 ? String(row[colProj]||"").trim()  : "",
              category: colCat   >= 0 ? String(row[colCat]||"").trim()   : "",
              members:  [],
              rowStart: headerIdx + i + 2,
            });
          } else if (colProj >= 0 && !teamMap.get(teamName).project) {
            // Pick up project name from any row that has it
            const proj = String(row[colProj]||"").trim();
            if (proj) teamMap.get(teamName).project = proj;
          }

          const memberName = String(row[colMName]||"").trim();
          if (!memberName) { rowErrors.push(`Row ${headerIdx+i+2}: missing member name (team: ${teamName})`); return; }

          teamMap.get(teamName).members.push({
            name:  memberName,
            email: colMEmail >= 0 ? String(row[colMEmail]||"").trim() : "",
            role:  colMRole  >= 0 ? String(row[colMRole]||"").trim()  : "",
          });
        });

        const parsed = Array.from(teamMap.values());
        setRawRows(dataRows);
        setTeams(parsed);
        setStep(2);
        if (rowErrors.length) toast(`Parsed with ${rowErrors.length} warning(s)`, "error");
        else toast(`✓ Found ${parsed.length} team${parsed.length!==1?"s":""} with ${dataRows.length} member rows`);

      } catch(err) {
        toast(`Parse error: ${err.message}`, "error");
      }
    };

    if (file.name.endsWith(".csv")) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  };

  const handleFile = e => parseFile(e.target.files[0]);
  const handleDrop = e => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  // ── Import teams ──────────────────────────────────────────────────────────
  const runImport = async () => {
    if (!activeHackathon) { toast("Select a hackathon first", "error"); return; }
    setImporting(true);
    try {
      const r = await POST("/api/teams/bulk-import", { hackathonId: activeHackathon, teams, mode });
      setResult(r);
      setStep(3);
      if (r.created || r.updated) toast(`✓ Import complete — ${r.created} created, ${r.updated} updated`);
      else toast("Import complete — no new teams added", "error");
    } catch(e) { toast(e.message, "error"); } finally { setImporting(false); }
  };

  const reset = () => { setStep(1); setTeams([]); setRawRows([]); setFileName(""); setResult(null); if(fileRef.current) fileRef.current.value=""; };

  // ── Total members across all teams
  const totalMembers = teams.reduce((s,t)=>s+t.members.length, 0);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div>
      <SectionHeader title="Import Teams from Excel"
        action={<Btn variant="secondary" onClick={downloadTemplate}>⬇ Download Template</Btn>}
      />

      {/* Hackathon selector warning */}
      {!activeHackathon && (
        <div style={{...FONT,padding:"12px 16px",background:C.bgAmber,border:`1px solid ${C.bdAmber}`,
          borderRadius:R.md,fontSize:13,color:C.amber,marginBottom:16}}>
          ⚠ Select a hackathon from the top dropdown before importing.
        </div>
      )}

      {/* ── Step indicator ── */}
      <div style={{display:"flex",gap:0,marginBottom:24}}>
        {[{n:1,l:"Upload File"},{n:2,l:"Preview & Validate"},{n:3,l:"Done"}].map((s,i)=>(
          <div key={s.n} style={{display:"flex",alignItems:"center",flex:1}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1}}>
              <div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:14,fontWeight:700,
                background:step>=s.n?C.blue:C.bg3,
                color:step>=s.n?"#fff":C.text3,
                border:`2px solid ${step>=s.n?C.blue:C.border}`,
                transition:"all 0.2s"}}>
                {step>s.n?"✓":s.n}
              </div>
              <div style={{...FONT,fontSize:11,color:step>=s.n?C.blue:C.text3,marginTop:5,fontWeight:step===s.n?600:400}}>
                {s.l}
              </div>
            </div>
            {i<2&&<div style={{flex:1,height:2,background:step>s.n?C.blue:C.border,marginBottom:18,transition:"background 0.3s"}}/>}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Upload ── */}
      {step===1&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>
          {/* Drop zone */}
          <Card style={{padding:0}}>
            <div
              onDragOver={e=>{e.preventDefault();setDragOver(true);}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={handleDrop}
              onClick={()=>fileRef.current?.click()}
              style={{padding:"48px 32px",textAlign:"center",cursor:"pointer",borderRadius:R.md,
                border:`2px dashed ${dragOver?C.blue:C.border2}`,
                background:dragOver?C.bgBlue:"transparent",
                transition:"all 0.2s"}}>
              <div style={{fontSize:48,marginBottom:12}}>📊</div>
              <div style={{...FONT,fontSize:15,fontWeight:600,color:C.text,marginBottom:6}}>
                {dragOver?"Drop it!":"Drop your Excel or CSV file here"}
              </div>
              <div style={{...FONT,fontSize:13,color:C.text3,marginBottom:16}}>or click to browse</div>
              <Chip label=".xlsx supported" color="blue" />
              <span style={{margin:"0 6px"}}/>
              <Chip label=".csv supported" color="neutral" />
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile}
                style={{display:"none"}} />
            </div>
          </Card>

          {/* Instructions */}
          <div>
            <Card style={{marginBottom:12}}>
              <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:12}}>
                📋 Expected format
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr style={{background:C.bg3}}>
                      {["Team Name *","Project Name","Track","Member Name *","Email","Role"].map(h=>(
                        <th key={h} style={{...FONT,padding:"6px 8px",textAlign:"left",
                          color:C.text3,fontWeight:600,whiteSpace:"nowrap",
                          border:`1px solid ${C.border}`}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Team Alpha","AI Scanner","AI/ML","Alice J.","alice@…","Lead"],
                      ["Team Alpha","","","Bob C.","bob@…","Dev"],
                      ["Team Beta","GreenGrid","Sustainability","Dave K.","dave@…","Full Stack"],
                    ].map((row,i)=>(
                      <tr key={i} style={{background:i%2?C.bg2:C.bg}}>
                        {row.map((cell,j)=>(
                          <td key={j} style={{...FONT,padding:"5px 8px",color:cell?"#10b981":C.text3,
                            border:`1px solid ${C.border}`,fontSize:11}}>
                            {cell||<span style={{color:C.text3,fontStyle:"italic"}}>same team</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>💡 Tips</div>
              {[
                "One row per team member — repeat Team Name for each member",
                "Only fill Project Name & Track on the first row of each team",
                "Team Name and Member Name are the only required fields",
                "Email helps link members to participant accounts",
                "Download the template for a ready-to-fill example",
              ].map((tip,i)=>(
                <div key={i} style={{...FONT,fontSize:12,color:C.text3,marginBottom:6,
                  display:"flex",gap:8,alignItems:"flex-start",lineHeight:1.5}}>
                  <span style={{color:C.green,flexShrink:0}}>✓</span> {tip}
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {/* ── STEP 2: Preview & Validate ── */}
      {step===2&&(
        <div>
          {/* Summary bar */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
            <Stat label="File"        value={fileName} />
            <Stat label="Teams found" value={teams.length}        color={C.green} />
            <Stat label="Total members" value={totalMembers}       color={C.blue}  />
            <Stat label="Raw rows"    value={rawRows.length}       color={C.text3} />
          </div>

          {/* Import mode */}
          <Card style={{marginBottom:14,padding:"14px 16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
              <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text}}>If team name already exists:</div>
              {[{v:"skip",l:"Skip (keep existing)"},{v:"overwrite",l:"Overwrite (update project & members)"}].map(opt=>(
                <label key={opt.v} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                  <input type="radio" value={opt.v} checked={mode===opt.v} onChange={e=>setMode(e.target.value)} />
                  <span style={{...FONT,fontSize:13,color:C.text}}>{opt.l}</span>
                </label>
              ))}
            </div>
          </Card>

          {/* Teams preview */}
          {teams.map((team,i)=>(
            <Card key={i} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div>
                  <div style={{...FONT,fontSize:14,fontWeight:700,color:C.text}}>{team.name}</div>
                  <div style={{...FONT,fontSize:12,color:C.text3,marginTop:2}}>
                    {[team.project,team.category].filter(Boolean).join(" · ")||"No project details"}
                  </div>
                </div>
                <Chip label={`${team.members.length} member${team.members.length!==1?"s":""}`} color="blue" />
              </div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:C.bg3}}>
                    {["Name","Email","Role"].map(h=>(
                      <th key={h} style={{...FONT,fontSize:11,color:C.text3,padding:"5px 10px",
                        textAlign:"left",border:`1px solid ${C.border}`,fontWeight:600}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {team.members.map((m,j)=>(
                    <tr key={j} style={{background:j%2?C.bg2:C.bg}}>
                      <td style={{...FONT,fontSize:13,color:C.text,padding:"6px 10px",
                        border:`1px solid ${C.border}`,fontWeight:500}}>{m.name}</td>
                      <td style={{...FONT,fontSize:12,color:m.email?C.text3:"rgba(107,114,128,0.4)",
                        padding:"6px 10px",border:`1px solid ${C.border}`,fontStyle:m.email?"normal":"italic"}}>
                        {m.email||"—"}
                      </td>
                      <td style={{...FONT,fontSize:12,color:C.text3,padding:"6px 10px",border:`1px solid ${C.border}`}}>
                        {m.role||"—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}

          {/* Actions */}
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <Btn onClick={runImport} disabled={importing||!activeHackathon||!teams.length}>
              {importing?<><Spinner/> Importing…</>:`✓ Import ${teams.length} team${teams.length!==1?"s":""} →`}
            </Btn>
            <Btn variant="secondary" onClick={reset}>← Start Over</Btn>
          </div>
        </div>
      )}

      {/* ── STEP 3: Results ── */}
      {step===3&&result&&(
        <div>
          <Card style={{textAlign:"center",padding:"40px 32px",marginBottom:16}}>
            <div style={{fontSize:56,marginBottom:16}}>
              {result.errors?.length?"⚠️":"🎉"}
            </div>
            <div style={{...FONT,fontSize:20,fontWeight:700,color:C.text,marginBottom:8}}>
              Import {result.errors?.length?"Completed with Warnings":"Successful!"}
            </div>
            <div style={{display:"flex",gap:24,justifyContent:"center",marginTop:16,flexWrap:"wrap"}}>
              {result.created>0&&<div style={{textAlign:"center"}}>
                <div style={{...MONO,fontSize:32,fontWeight:800,color:C.green}}>{result.created}</div>
                <div style={{...FONT,fontSize:12,color:C.text3}}>Teams created</div>
              </div>}
              {result.updated>0&&<div style={{textAlign:"center"}}>
                <div style={{...MONO,fontSize:32,fontWeight:800,color:C.blue}}>{result.updated}</div>
                <div style={{...FONT,fontSize:12,color:C.text3}}>Teams updated</div>
              </div>}
              {result.skipped>0&&<div style={{textAlign:"center"}}>
                <div style={{...MONO,fontSize:32,fontWeight:800,color:C.text3}}>{result.skipped}</div>
                <div style={{...FONT,fontSize:12,color:C.text3}}>Skipped (existing)</div>
              </div>}
              {result.errors?.length>0&&<div style={{textAlign:"center"}}>
                <div style={{...MONO,fontSize:32,fontWeight:800,color:C.amber}}>{result.errors.length}</div>
                <div style={{...FONT,fontSize:12,color:C.text3}}>Warnings</div>
              </div>}
            </div>
          </Card>

          {result.errors?.length>0&&(
            <Card style={{marginBottom:16,border:`1px solid ${C.bdAmber}`}}>
              <div style={{...FONT,fontSize:13,fontWeight:600,color:C.amber,marginBottom:8}}>⚠ Import warnings</div>
              {result.errors.map((e,i)=>(
                <div key={i} style={{...FONT,fontSize:12,color:C.text3,marginBottom:4}}>• {e}</div>
              ))}
            </Card>
          )}

          <div style={{display:"flex",gap:10}}>
            <Btn onClick={reset}>⬆ Import Another File</Btn>
            <Btn variant="secondary" onClick={()=>toast("Go to Teams page to view imported teams")}>
              View Teams →
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}



/* ── Create Login Button ─────────────────────────────────────────────────── */
function CreateLoginBtn({ regId, email, onCreated }) {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [creds,   setCreds]   = useState(null);

  const create = async () => {
    if (!confirm(`Create a team login for ${email}?\nThey'll receive an email with login credentials.`)) return;
    setLoading(true);
    try {
      const d = await POST(`/api/registrations/${regId}/create-login`, { sendEmail: true });
      if (d.exists) { alert(d.message); setDone(true); return; }
      setCreds(d); setDone(true); onCreated?.();
    } catch(e) { alert(e.message); } finally { setLoading(false); }
  };

  if (done && creds) return (
    <div style={{marginTop:8,padding:"8px 12px",background:C.bgGreen,border:`1px solid ${C.bdGreen}`,borderRadius:R.sm}}>
      <div style={{...FONT,fontSize:12,color:C.green,fontWeight:600,marginBottom:3}}>✓ Login created & emailed</div>
      <div style={{...FONT,fontSize:11,color:C.text3}}>Temp password: <code style={{background:C.bg3,padding:"1px 5px",borderRadius:3}}>{creds.tempPassword}</code></div>
    </div>
  );
  if (done) return <div style={{...FONT,fontSize:12,color:C.green,marginTop:6}}>✓ Login already exists</div>;

  return (
    <Btn size="sm" variant="secondary" onClick={create} disabled={loading}
      style={{marginTop:6,background:C.bgBlue,color:C.blue,border:`1px solid ${C.bdBlue}`}}>
      {loading?<Spinner/>:"🔑"} {loading?"Creating…":"Create Team Login"}
    </Btn>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   TEAM DASHBOARD — shown when currentUser.role === "team"
   Lives inside the same AppShell as admin/judge
══════════════════════════════════════════════════════════════════════════ */
export function TeamDashboardPage({ activeHackathon, currentUser, toast }) {
  const [data,   setData]   = useState(null);
  const [loading,setLoading]= useState(false);
  const [editing,setEditing]= useState(false);
  const [form,   setForm]   = useState({});
  const [saving, setSaving] = useState(false);
  const sf = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const load = () => {
    if (!activeHackathon) return;
    setLoading(true);
    GET(`/api/team/dashboard?hackathonId=${activeHackathon}`)
      .then(d => {
        setData(d);
        if (d.submission) setForm({
          title:            d.submission.title            || "",
          tagline:          d.submission.tagline          || "",
          description:      d.submission.description      || "",
          problemStatement: d.submission.problemStatement || "",
          solution:         d.submission.solution         || "",
          techStack:        d.submission.techStack        || "",
          githubUrl:        d.submission.githubUrl        || "",
          demoUrl:          d.submission.demoUrl          || "",
          videoUrl:         d.submission.videoUrl         || "",
          deckUrl:          d.submission.deckUrl          || "",
          track:            d.submission.track            || "",
        });
      })
      .catch(e => toast(e.message,"error"))
      .finally(()=>setLoading(false));
  };

  useEffect(()=>{ load(); },[activeHackathon]);

  const save = async () => {
    if (!form.title?.trim()) { toast("Project title is required","error"); return; }
    setSaving(true);
    try {
      await POST("/api/portal/submit",{ hackathonId:activeHackathon,...form });
      toast("✓ Project saved!"); load(); setEditing(false);
    } catch(e){ toast(e.message,"error"); } finally{ setSaving(false); }
  };

  const hack = data?.hackathon;
  const team = data?.team;
  const sub  = data?.submission;
  const submissionsOpen = hack?.submissionsOpen !== false;

  if (loading && !data) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:80}}>
      <Spinner/><span style={{...FONT,marginLeft:10,color:C.text3}}>Loading…</span>
    </div>
  );

  const IN2 = {...IN, background:C.bg, fontSize:13};
  const TA2 = {...TA, background:C.bg, fontSize:13};

  return (
    <div style={{maxWidth:700}}>
      {/* Team card */}
      <Card style={{marginBottom:16}}>
        <div style={{...FONT,fontSize:11,fontWeight:700,color:C.text3,textTransform:"uppercase",
          letterSpacing:"0.08em",marginBottom:10}}>Your Team</div>
        <div style={{...FONT,fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>
          {team?.name || "—"}
        </div>
        {team?.category && <Chip label={team.category} color="blue" />}
        {team?.members && (
          <div style={{marginTop:12}}>
            <div style={{...FONT,fontSize:11,fontWeight:600,color:C.text3,textTransform:"uppercase",
              letterSpacing:"0.07em",marginBottom:6}}>Members</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {team.members.split(",").map(m=>m.trim()).filter(Boolean).map(m=>(
                <span key={m} style={{...FONT,fontSize:13,padding:"4px 12px",borderRadius:9999,
                  background:C.bg3,color:C.text,border:`1px solid ${C.border}`}}>
                  👤 {m}
                </span>
              ))}
            </div>
          </div>
        )}
        {!team && (
          <div style={{...FONT,fontSize:13,color:C.amber,marginTop:8}}>
            ⚠ Your team hasn't been set up yet. Contact your organizer.
          </div>
        )}
      </Card>

      {/* Submission */}
      {!editing ? (
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{...FONT,fontSize:11,fontWeight:700,color:C.text3,textTransform:"uppercase",
              letterSpacing:"0.08em"}}>Project Submission</div>
            {submissionsOpen && (
              <Btn size="sm" onClick={()=>setEditing(true)}>
                {sub ? "✏ Edit Submission" : "📤 Submit Project"}
              </Btn>
            )}
          </div>

          {sub ? (
            <div>
              <div style={{...FONT,fontSize:18,fontWeight:700,color:C.text,marginBottom:4}}>{sub.title}</div>
              {sub.tagline && <div style={{...FONT,fontSize:14,color:C.text3,fontStyle:"italic",marginBottom:12}}>{sub.tagline}</div>}

              {sub.description && (
                <div style={{...FONT,fontSize:14,color:C.text2,lineHeight:1.75,marginBottom:14}}>{sub.description}</div>
              )}

              {sub.techStack && (
                <div style={{marginBottom:14}}>
                  <div style={{...FONT,fontSize:11,fontWeight:600,color:C.text3,textTransform:"uppercase",
                    letterSpacing:"0.07em",marginBottom:6}}>Tech Stack</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {sub.techStack.split(",").map(t=>t.trim()).filter(Boolean).map(t=>(
                      <span key={t} style={{...FONT,fontSize:12,padding:"3px 10px",
                        borderRadius:9999,background:C.bgBlue,color:C.blue}}>{t}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {sub.githubUrl&&<a href={sub.githubUrl} target="_blank" rel="noopener"
                  style={{...FONT,fontSize:13,fontWeight:600,padding:"7px 14px",borderRadius:8,
                    background:"#24292e",color:"#fff",textDecoration:"none"}}>GitHub →</a>}
                {sub.demoUrl&&<a href={sub.demoUrl} target="_blank" rel="noopener"
                  style={{...FONT,fontSize:13,fontWeight:600,padding:"7px 14px",borderRadius:8,
                    background:C.green,color:"#fff",textDecoration:"none"}}>Live Demo →</a>}
                {sub.videoUrl&&<a href={sub.videoUrl} target="_blank" rel="noopener"
                  style={{...FONT,fontSize:13,fontWeight:600,padding:"7px 14px",borderRadius:8,
                    background:C.blue,color:"#fff",textDecoration:"none"}}>Video →</a>}
                {sub.deckUrl&&<a href={sub.deckUrl} target="_blank" rel="noopener"
                  style={{...FONT,fontSize:13,fontWeight:600,padding:"7px 14px",borderRadius:8,
                    background:C.amber,color:"#fff",textDecoration:"none"}}>Deck →</a>}
              </div>

              <div style={{...FONT,fontSize:11,color:C.text3,marginTop:12,paddingTop:12,
                borderTop:`1px solid ${C.border}`}}>
                Last updated {new Date(sub.submittedAt).toLocaleString()}
              </div>
            </div>
          ) : (
            <div style={{textAlign:"center",padding:"32px 0"}}>
              <div style={{fontSize:44,marginBottom:12}}>📦</div>
              <div style={{...FONT,fontSize:15,fontWeight:600,color:C.text,marginBottom:6}}>
                No submission yet
              </div>
              <div style={{...FONT,fontSize:13,color:C.text3}}>
                {submissionsOpen
                  ? "Click \"Submit Project\" to add your project details."
                  : "Submissions are currently closed."}
              </div>
            </div>
          )}
        </Card>
      ) : (
        /* Edit form */
        <Card>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div style={{...FONT,fontSize:14,fontWeight:700,color:C.text}}>
              {sub ? "Edit Submission" : "Submit Project"}
            </div>
            <Btn size="sm" variant="secondary" onClick={()=>setEditing(false)}>Cancel</Btn>
          </div>

          <Field label="Project Title" required>
            <input style={IN2} value={form.title||""} onChange={sf("title")}
              placeholder="Give your project a clear, catchy name" />
          </Field>
          <Field label="Tagline">
            <input style={IN2} value={form.tagline||""} onChange={sf("tagline")}
              placeholder="One sentence — what does it do?" />
          </Field>
          <Field label="Problem Statement">
            <textarea style={{...TA2,minHeight:72}} value={form.problemStatement||""} onChange={sf("problemStatement")}
              placeholder="What problem are you solving and who faces it?" />
          </Field>
          <Field label="Your Solution">
            <textarea style={{...TA2,minHeight:72}} value={form.solution||""} onChange={sf("solution")}
              placeholder="How does your project solve this? What makes it unique?" />
          </Field>
          <Field label="Description">
            <textarea style={{...TA2,minHeight:90}} value={form.description||""} onChange={sf("description")}
              placeholder="Full description — what it does, how it works, and the impact." />
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Tech Stack">
              <input style={IN2} value={form.techStack||""} onChange={sf("techStack")}
                placeholder="React, Node.js, PostgreSQL…" />
            </Field>
            <Field label="Track">
              <input style={IN2} value={form.track||""} onChange={sf("track")}
                placeholder="AI/ML, Sustainability…" />
            </Field>
            <Field label="GitHub URL">
              <input type="url" style={IN2} value={form.githubUrl||""} onChange={sf("githubUrl")}
                placeholder="https://github.com/…" />
            </Field>
            <Field label="Live Demo URL">
              <input type="url" style={IN2} value={form.demoUrl||""} onChange={sf("demoUrl")}
                placeholder="https://…" />
            </Field>
            <Field label="Video URL">
              <input type="url" style={IN2} value={form.videoUrl||""} onChange={sf("videoUrl")}
                placeholder="YouTube, Loom…" />
            </Field>
            <Field label="Pitch Deck URL">
              <input type="url" style={IN2} value={form.deckUrl||""} onChange={sf("deckUrl")}
                placeholder="Google Slides, Canva…" />
            </Field>
          </div>

          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <Btn variant="secondary" onClick={()=>setEditing(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>
              {saving ? <><Spinner/> Saving…</> : sub ? "✓ Save Changes" : "📤 Submit Project"}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}


export function AITeamInsights({ teamId, hackathonId, toast }) {
  const [running,  setRunning]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState("");

  const run = async () => {
    setRunning(true); setError(""); setResult(null);
    try {
      const d = await POST("/api/ai/team-insights", { teamId, hackathonId });
      if (d.error) setError(d.error); else setResult(d.insight);
    } catch(e) { setError(e.message); }
    setRunning(false);
  };

  return (
    <AIPanel title="AI Insights" icon="✨" onRun={run} running={running} result={result} error={error}>
      {result && typeof result === "object" && (
        <div>
          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>{result.headline}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <div style={{...FONT,fontSize:11,color:C.green,fontWeight:600,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>✓ Strengths</div>
              {(result.strengths||[]).map((s,i)=><div key={i} style={{...FONT,fontSize:12,color:C.text2,marginBottom:3}}>• {s}</div>)}
            </div>
            <div>
              <div style={{...FONT,fontSize:11,color:C.amber,fontWeight:600,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>△ Gaps</div>
              {(result.gaps||[]).map((g,i)=><div key={i} style={{...FONT,fontSize:12,color:C.text2,marginBottom:3}}>• {g}</div>)}
            </div>
          </div>
          <div style={{...FONT,fontSize:12,color:C.text3,background:C.bg3,borderRadius:R.sm,padding:"8px 12px",marginBottom:8}}>
            💡 {result.recommendation}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Chip label={result.prizeWorthy?"🏆 Prize Worthy":"Not Prize Worthy"} color={result.prizeWorthy?"green":"neutral"} />
            <Chip label={`Consensus: ${result.consensusScore}`} color="blue" />
            {result.standoutCriterion&&<Chip label={`Best: ${result.standoutCriterion}`} color="purple" />}
          </div>
        </div>
      )}
      {result && typeof result === "string" && <div style={{...FONT,fontSize:13,color:C.text3}}>{result}</div>}
    </AIPanel>
  );
}

// ── AI Calibration Panel ─────────────────────────────────────────────────────
export function AICalibration({ hackathonId, toast }) {
  const [running, setRunning] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState("");

  const run = async () => {
    setRunning(true); setError(""); setResult(null);
    try {
      const d = await POST("/api/ai/calibration", { hackathonId });
      if (d.error) setError(d.error);
      else setResult(d);
    } catch(e) { setError(e.message); }
    setRunning(false);
  };

  const flagColor = { "Well-calibrated":"green","Lenient":"amber","Strict":"amber","Inconsistent":"red" };

  return (
    <AIPanel title="AI Calibration Check" icon="🎯" onRun={run} running={running} result={result} error={error}>
      {result?.analysis && (
        <div>
          <div style={{...FONT,fontSize:13,color:C.text2,marginBottom:12,lineHeight:1.6}}>{result.analysis.summary}</div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <Chip label={`Panel Health: ${result.analysis.panelHealth}`}
              color={result.analysis.panelHealth==="Excellent"?"green":result.analysis.panelHealth==="Good"?"blue":"amber"} />
          </div>
          {(result.analysis.judges||[]).map((j,i)=>(
            <div key={i} style={{padding:"10px 12px",background:C.bg3,borderRadius:R.sm,
              border:`1px solid ${j.flag?C.bdAmber:C.border}`,marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <span style={{...FONT,fontSize:13,fontWeight:600,color:C.text}}>{j.name}</span>
                <div style={{display:"flex",gap:6}}>
                  <Chip label={j.calibration} color={flagColor[j.calibration]||"neutral"} />
                  <Chip label={`Comments: ${j.commentQuality}`} color="neutral" />
                  {j.flag&&<Chip label={`⚠ ${j.flag}`} color="amber" />}
                </div>
              </div>
              <div style={{...FONT,fontSize:12,color:C.text3}}>{j.insight}</div>
            </div>
          ))}
          {(result.analysis.recommendations||[]).length>0&&(
            <div style={{marginTop:10}}>
              <div style={{...FONT,fontSize:11,fontWeight:600,color:C.text,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Recommendations</div>
              {result.analysis.recommendations.map((r,i)=>(
                <div key={i} style={{...FONT,fontSize:12,color:C.text3,marginBottom:4}}>• {r}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </AIPanel>
  );
}

// ── AI Registration Screen ────────────────────────────────────────────────────
export function AIScreenReg({ registrationId, hackathonId, onApply }) {
  const [running, setRunning] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState("");

  const run = async () => {
    setRunning(true); setError(""); setResult(null);
    try {
      const d = await POST("/api/ai/screen-registration", { registrationId, hackathonId });
      if (d.error) setError(d.error); else setResult(d.screening);
    } catch(e) { setError(e.message); }
    setRunning(false);
  };

  const recColor = { Approve:"green", Reject:"red", Review:"amber" };

  return (
    <AIPanel title="AI Screen" icon="🤖" onRun={run} running={running} result={result} error={error}>
      {result && (
        <div>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
            <Chip label={`${result.recommendation}`} color={recColor[result.recommendation]||"neutral"} />
            <Chip label={`${result.confidence} Confidence`} color="neutral" />
          </div>
          <div style={{...FONT,fontSize:13,color:C.text2,marginBottom:10,lineHeight:1.6}}>{result.reason}</div>
          {(result.strengths||[]).length>0&&(
            <div style={{marginBottom:8}}>
              <div style={{...FONT,fontSize:11,color:C.green,fontWeight:600,marginBottom:4}}>✓ Strengths</div>
              {result.strengths.map((s,i)=><div key={i} style={{...FONT,fontSize:12,color:C.text3}}>• {s}</div>)}
            </div>
          )}
          {(result.concerns||[]).length>0&&(
            <div style={{marginBottom:8}}>
              <div style={{...FONT,fontSize:11,color:C.amber,fontWeight:600,marginBottom:4}}>△ Concerns</div>
              {result.concerns.map((c,i)=><div key={i} style={{...FONT,fontSize:12,color:C.text3}}>• {c}</div>)}
            </div>
          )}
          <div style={{...FONT,fontSize:12,color:C.text3,fontStyle:"italic"}}>💡 {result.suggestedAction}</div>
          {onApply&&result.recommendation==="Approve"&&(
            <div style={{marginTop:10}}>
              <Btn size="sm" onClick={()=>onApply("approved")} style={{background:C.green}}>✓ Apply Recommendation: Approve</Btn>
            </div>
          )}
        </div>
      )}
    </AIPanel>
  );
}

// ── AI Feedback Coach ─────────────────────────────────────────────────────────
export function AIFeedbackCoach({ feedbackId }) {
  const [running, setRunning] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState("");

  const run = async () => {
    setRunning(true); setError(""); setResult(null);
    try {
      const d = await POST("/api/ai/feedback-coach", { feedbackId });
      if (d.error) setError(d.error); else setResult(d.coaching);
    } catch(e) { setError(e.message); }
    setRunning(false);
  };

  const qColor = { Excellent:"green",Good:"green",Adequate:"blue","Needs Improvement":"amber",Poor:"red" };

  return (
    <AIPanel title="AI Coach" icon="🎓" onRun={run} running={running} result={result} error={error}>
      {result && (
        <div>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
            <Chip label={`Quality: ${result.qualityLabel}`} color={qColor[result.qualityLabel]||"neutral"} />
            <Chip label={`Score: ${result.qualityScore}/10`} color="neutral" />
          </div>
          {(result.whatWorked||[]).length>0&&(
            <div style={{marginBottom:8}}>
              <div style={{...FONT,fontSize:11,color:C.green,fontWeight:600,marginBottom:4}}>✓ What Worked</div>
              {result.whatWorked.map((w,i)=><div key={i} style={{...FONT,fontSize:12,color:C.text3,marginBottom:2}}>• {w}</div>)}
            </div>
          )}
          {(result.improvements||[]).length>0&&(
            <div style={{marginBottom:8}}>
              <div style={{...FONT,fontSize:11,color:C.amber,fontWeight:600,marginBottom:4}}>△ Improvements</div>
              {result.improvements.map((im,i)=><div key={i} style={{...FONT,fontSize:12,color:C.text3,marginBottom:2}}>• {im}</div>)}
            </div>
          )}
          {result.improvedOverall&&(
            <div style={{padding:"10px 12px",background:C.bgBlue,border:`1px solid ${C.bdBlue}`,borderRadius:R.sm,marginBottom:8}}>
              <div style={{...FONT,fontSize:11,color:C.blue,fontWeight:600,marginBottom:4}}>✨ Suggested Revision</div>
              <div style={{...FONT,fontSize:13,color:C.text2,fontStyle:"italic",lineHeight:1.6}}>"{result.improvedOverall}"</div>
            </div>
          )}
          <div style={{...FONT,fontSize:12,color:C.text3}}>💡 {result.tip}</div>
        </div>
      )}
    </AIPanel>
  );
}

// ── AI Hackathon Report Generator ─────────────────────────────────────────────
export function AIReportGenerator({ hackathonId, hackName }) {
  const [running, setRunning] = useState(false);
  const [report,  setReport]  = useState("");
  const [error,   setError]   = useState("");
  const [open,    setOpen]    = useState(false);

  const run = async () => {
    setRunning(true); setError(""); setReport(""); setOpen(true);
    try {
      const d = await POST("/api/ai/hackathon-report", { hackathonId });
      if (d.error) setError(d.error); else setReport(d.report);
    } catch(e) { setError(e.message); }
    setRunning(false);
  };

  const copy = () => { navigator.clipboard?.writeText(report); };
  const download = () => {
    const blob = new Blob([report], { type:"text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${hackName || "hackathon"}-ai-report.md`; a.click();
  };

  return (
    <div>
      <Btn onClick={run} disabled={running}
        style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",
          display:"inline-flex",alignItems:"center",gap:6}}>
        {running?<><Spinner size={12}/> Generating Report…</>:"📄 Generate AI Report"}
      </Btn>
      {open&&(
        <div style={{marginTop:14,padding:20,background:C.bg2,borderRadius:R.md,border:`1px solid ${error?C.bdRed:C.border}`}}>
          {error&&<div style={{...FONT,fontSize:13,color:C.red}}>⚠ {error}</div>}
          {report&&(
            <>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginBottom:12}}>
                <Btn size="sm" variant="secondary" onClick={copy}>📋 Copy</Btn>
                <Btn size="sm" variant="secondary" onClick={download}>⬇ Download .md</Btn>
              </div>
              <div style={{...FONT,fontSize:13,color:C.text2,lineHeight:1.8,whiteSpace:"pre-wrap",
                maxHeight:400,overflowY:"auto",padding:"0 4px"}}>
                {report}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}


/* ─── BEST JUDGE PAGE ────────────────────────────────────────────────────── */
export function BestJudgePage({ db, toast, activeHackathon }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [note,    setNote]    = useState("");
  const [selId,   setSelId]   = useState(null); // judgeId being nominated

  const hack = db.hackathons.find(h => h.id === activeHackathon);

  const load = () => {
    if (!activeHackathon) return;
    setLoading(true);
    GET(`/api/best-judge/${activeHackathon}`)
      .then(d => {
        setData(d);
        setSelId(d.bestJudgeId || null);
        setNote(d.bestJudgeNote || "");
      })
      .catch(e => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [activeHackathon]);

  const nominate = async (judgeId) => {
    setSaving(true);
    try {
      await POST(`/api/best-judge/${activeHackathon}`, { judgeId, note });
      setSelId(judgeId);
      toast("🏆 Best Judge nominated and saved!");
      load();
    } catch(e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (!confirm("Remove the Best Judge nomination?")) return;
    setSaving(true);
    try {
      await POST(`/api/best-judge/${activeHackathon}`, { judgeId: null, note: "" });
      setSelId(null); setNote("");
      toast("Nomination cleared");
      load();
    } catch(e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!activeHackathon) return <Empty icon="⭐" title="Select a hackathon" />;

  const MetricBar = ({ label, value, color }) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ ...FONT, fontSize: 11, color: C.text3 }}>{label}</span>
        <span style={{ ...MONO, fontSize: 11, color: C.text2 }}>{value}%</span>
      </div>
      <div style={{ background: C.bg3, borderRadius: 3, height: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, borderRadius: 3,
          background: color || (value >= 75 ? C.green : value >= 50 ? C.blue : C.amber),
          transition: "width 0.6s ease" }} />
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeader
        title="Best Judge Award"
        count={hack?.name}
        action={<Btn variant="secondary" onClick={load} disabled={loading}>{loading ? <Spinner /> : "↻"} Refresh</Btn>}
      />

      {/* Current nominee banner */}
      {selId && data && (
        <Card style={{ marginBottom: 20, background: "linear-gradient(135deg,#fef3c7,#fffbeb)", border: "1px solid #fde68a" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 36 }}>🏆</div>
              <div>
                <div style={{ ...FONT, fontSize: 12, fontWeight: 500, color: C.amber, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Current Best Judge Nominee</div>
                <div style={{ ...FONT, fontSize: 18, fontWeight: 700, color: "#92400e" }}>
                  {data.judges?.find(j => j.id === selId)?.name || selId}
                </div>
                {data.bestJudgeNote && (
                  <div style={{ ...FONT, fontSize: 13, color: "#a16207", marginTop: 4, fontStyle: "italic" }}>"{data.bestJudgeNote}"</div>
                )}
              </div>
            </div>
            <Btn variant="danger" size="sm" onClick={clear} disabled={saving}>Remove Nomination</Btn>
          </div>
        </Card>
      )}

      {/* Note for nomination */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ ...FONT, fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>Award Citation</div>
        <p style={{ ...FONT, fontSize: 12, color: C.text3, marginBottom: 10 }}>
          Write a short note that will appear on the public page alongside the winner's profile.
        </p>
        <textarea
          style={{ ...MONO, background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: R.sm,
            padding: "10px 12px", fontSize: 13, color: C.text, width: "100%", minHeight: 72, resize: "vertical" }}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder='e.g. "For exceptional attention to detail, thorough written feedback, and consistent evaluation across all teams."'
        />
        {selId && (
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <Btn size="sm" onClick={() => nominate(selId)} disabled={saving}>
              {saving && <Spinner />} Update Citation
            </Btn>
          </div>
        )}
      </Card>

      {/* Analytics leaderboard */}
      {loading && <div style={{ ...FONT, fontSize: 14, color: C.text3, textAlign: "center", padding: "32px 0" }}>Calculating judge analytics…</div>}

      {!loading && data?.judges?.length === 0 && (
        <Empty icon="📊" title="No feedback submitted yet" sub="Judges need to submit feedback before analytics can be calculated." />
      )}

      {!loading && data?.judges?.map((judge, i) => {
        const isNominated = judge.id === selId;
        const rank = i + 1;
        const rankColor = rank === 1 ? "#f59e0b" : rank === 2 ? "#94a3b8" : rank === 3 ? "#b45309" : C.text3;
        const rankIcon  = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

        return (
          <Card key={judge.id} style={{
            marginBottom: 12,
            border: `2px solid ${isNominated ? "#fde68a" : C.border}`,
            background: isNominated ? "#fffbeb" : C.bg,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "48px 1fr auto", gap: 16, alignItems: "start" }}>
              {/* Rank */}
              <div style={{ textAlign: "center", paddingTop: 4 }}>
                <div style={{ fontSize: rank <= 3 ? 28 : 18, fontWeight: 700, color: rankColor, lineHeight: 1 }}>
                  {rank <= 3 ? rankIcon : `#${rank}`}
                </div>
              </div>

              {/* Judge info + metrics */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  {judge.avatarUrl
                    ? <img src={judge.avatarUrl} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                    : <Avatar name={judge.name} size={44} />
                  }
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ ...FONT, fontSize: 15, fontWeight: 700, color: C.text }}>{judge.name}</span>
                      {isNominated && <Chip label="🏆 Nominated" color="amber" />}
                    </div>
                    <div style={{ ...FONT, fontSize: 12, color: C.text3 }}>
                      {judge.org} · {judge.feedbackCount} of {judge.totalTeams} teams reviewed
                      {judge.avgScore != null && ` · avg score given: ${judge.avgScore}`}
                    </div>
                  </div>
                </div>

                {/* Metric bars */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px" }}>
                  <MetricBar label="Coverage (teams reviewed)"     value={judge.coverage}             color={judge.coverage >= 100 ? C.green : C.blue} />
                  <MetricBar label="Thoroughness (comment depth)"  value={judge.thoroughness}          />
                  <MetricBar label="Discrimination (score spread)" value={judge.discrimination}        />
                  <MetricBar label="Criteria completeness"         value={judge.criteriaCompleteness} color={C.purple} />
                  <MetricBar label="Engagement (overall summaries)" value={judge.engagement}          color={C.green} />
                </div>
              </div>

              {/* Score + nominate button */}
              <div style={{ textAlign: "center", minWidth: 110 }}>
                {/* Composite score ring */}
                <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 12px" }}>
                  <svg width="80" height="80" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="40" cy="40" r="32" fill="none" stroke={C.bg3} strokeWidth="8" />
                    <circle cx="40" cy="40" r="32" fill="none"
                      stroke={judge.composite >= 80 ? C.green : judge.composite >= 60 ? C.blue : C.amber}
                      strokeWidth="8"
                      strokeDasharray={`${(judge.composite / 100) * 201} 201`}
                      strokeLinecap="round" />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center" }}>
                    <span style={{ ...MONO, fontSize: 20, fontWeight: 700,
                      color: judge.composite >= 80 ? C.green : judge.composite >= 60 ? C.blue : C.amber,
                      lineHeight: 1 }}>{judge.composite}</span>
                    <span style={{ ...FONT, fontSize: 9, color: C.text3, marginTop: 1 }}>/ 100</span>
                  </div>
                </div>

                {isNominated
                  ? <Chip label="✓ Nominated" color="amber" />
                  : <Btn size="sm" variant="primary" onClick={() => nominate(judge.id)} disabled={saving}>
                      {saving ? <Spinner /> : "Nominate 🏆"}
                    </Btn>
                }
              </div>
            </div>
          </Card>
        );
      })}

      {/* Scoring explainer */}
      <Card style={{ marginTop: 16, background: C.bg2 }}>
        <div style={{ ...FONT, fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 10 }}>How the Score is Calculated</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 8 }}>
          {[
            ["Coverage 30%",     "% of teams the judge reviewed"],
            ["Thoroughness 25%", "Average word count in comments"],
            ["Discrimination 20%","Spread of scores — avoids giving everyone the same"],
            ["Completeness 15%", "% of criteria scored per submission"],
            ["Engagement 10%",   "% of submissions with a written summary"],
          ].map(([title,desc]) => (
            <div key={title} style={{ padding: "10px 12px", background: C.bg, borderRadius: R.sm, border: `1px solid ${C.border}` }}>
              <div style={{ ...MONO, fontSize: 11, color: C.blue, marginBottom: 4 }}>{title}</div>
              <div style={{ ...FONT, fontSize: 11, color: C.text3, lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ─── PUBLIC PAGE CMS ───────────────────────────────────────────────────── */
export function PublicPageCMS({ db, reload, toast, activeHackathon }) {
  const [tab,setTab]=useState("content");
  const [partners,setPartners]=useState([]);
  const [team,setTeam]=useState([]);
  const [pModal,setPModal]=useState(null);const [pForm,setPForm]=useState({});const [pSaving,setPSaving]=useState(false);
  const [tModal,setTModal]=useState(null);const [tForm,setTForm]=useState({});const [tSaving,setTSaving]=useState(false);
  const [hackForm,setHackForm]=useState({});const [hSaving,setHSaving]=useState(false);
  const [uploading,setUploading]=useState(false);

  const hack=db.hackathons.find(h=>h.id===activeHackathon);
  const selH=activeHackathon;

  useEffect(() => { if (hack) setHackForm({ ...hack }); }, [hack?.id, hack?.updatedAt]);

  const loadPartners = () => {
    if (!selH) return;
    GET(`/api/partners?hackathonId=${selH}`)
      .then(d => setPartners(Array.isArray(d) ? d : []))
      .catch(() => setPartners([]));
  };
  const loadTeam = () => {
    if (!selH) return;
    GET(`/api/orgteam?hackathonId=${selH}`)
      .then(d => setTeam(Array.isArray(d) ? d : []))
      .catch(() => setTeam([]));
  };
  useEffect(() => { loadPartners(); loadTeam(); }, [selH]);

  const pf=k=>e=>setPForm(p=>({...p,[k]:e.target.value}));
  const tf=k=>e=>setTForm(p=>({...p,[k]:e.target.value}));
  const hf=k=>e=>setHackForm(prev=>({...prev,[k]:e.target?.value??e}));

  const handleImg=async(e,setter,field="avatarUrl")=>{
    const file=e.target.files?.[0]; if(!file)return;
    if(file.size>2*1024*1024){toast("Image must be under 2MB","error");return;}
    setUploading(true);
    const reader=new FileReader();
    reader.onload=ev=>{setter(p=>({...p,[field]:ev.target.result}));setUploading(false);};
    reader.readAsDataURL(file);
  };

  const saveHack=async()=>{
    setHSaving(true);
    try{
      await PUT(`/api/hackathons/${selH}`,hackForm);
      await reload();
      toast("Page settings saved");
    }catch(e){
      toast(e.message||"Save failed","error");
    }finally{
      setHSaving(false);
    }
  };

  // Partners CRUD
  const savePartner=async()=>{
    if(!pForm.name?.trim())return toast("Name required","error");
    setPSaving(true);
    try{
      if(pModal==="new") await POST("/api/partners",{...pForm,hackathonId:selH});
      else await PUT(`/api/partners/${pModal.id}`,pForm);
      loadPartners();
      toast(pModal==="new"?"Partner added":"Updated");
      setPModal(null);
    }catch(e){
      toast(e.message||"Save failed","error");
    }finally{
      setPSaving(false);
    }
  };
  const delPartner=async id=>{try{await DEL(`/api/partners/${id}`);await loadPartners();toast("Removed");}catch(e){toast(e.message,"error");}};

  // Team CRUD
  const saveTeamMember=async()=>{
    if(!tForm.name?.trim())return toast("Name required","error");
    setTSaving(true);
    try{
      if(tModal==="new") await POST("/api/orgteam",{...tForm,hackathonId:selH});
      else await PUT(`/api/orgteam/${tModal.id}`,tForm);
      loadTeam();
      toast(tModal==="new"?"Member added":"Updated");
      setTModal(null);
    }catch(e){
      toast(e.message||"Save failed","error");
    }finally{
      setTSaving(false);
    }
  };
  const delTeamMember=async id=>{try{await DEL(`/api/orgteam/${id}`);await loadTeam();toast("Removed");}catch(e){toast(e.message,"error");}};

  if(!selH) return <Empty icon="🌐" title="Select a hackathon from the sidebar" sub="Use the dropdown at the top of the sidebar to choose an event." />;
  if(!hack) return <Empty icon="🌐" title="Hackathon not found" />;

  const pubUrl=`${window.location.origin}/register/${selH}`;

  const TABS=[
    {id:"content",label:"Content & Settings"},
    {id:"keynotes",label:"KeyNotes"},
    {id:"chairs",label:"Session Chairs"},
    {id:"team",label:"Org Team"},
    {id:"partners",label:"Partners"},
  ];

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <h1 style={{...FONT,fontSize:18,fontWeight:600,color:C.text,marginBottom:2}}>Public Page CMS</h1>
          <p style={{...FONT,fontSize:12,color:C.text3}}>{hack.name}</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Chip label={hack.published?"Live":"Draft"} color={hack.published?"green":"neutral"} />
          <Btn variant={hack.published?"secondary":"success"} size="sm"
            onClick={async()=>{try{await PUT(`/api/hackathons/${selH}`,{...hack,published:!hack.published});await reload();toast(hack.published?"Unpublished":"Published — now live!");}catch(e){toast(e.message,"error");}}}>
            {hack.published?"Unpublish":"Publish"}
          </Btn>
          {hack.published&&<>
            <Btn size="sm" variant="secondary" onClick={()=>{navigator.clipboard?.writeText(pubUrl);toast("URL copied!");}}>Copy URL</Btn>
            <Btn size="sm" variant="blue" onClick={()=>window.open(pubUrl,"_blank")}>Preview →</Btn>
          </>}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:1,marginBottom:20,background:C.bg2,borderRadius:R.sm,padding:3,border:`1px solid ${C.border}`,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{...FONT,padding:"6px 14px",fontSize:12,fontWeight:500,
            borderRadius:R.sm,border:"none",cursor:"pointer",background:tab===t.id?C.bg:C.bg2,
            color:tab===t.id?C.text:C.text3,transition:"all 0.1s",whiteSpace:"nowrap"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content & Settings ── */}
      {tab==="content"&&(
        <Card>
          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:16}}>Basic Info</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Event Tagline"><input style={IN} value={hackForm.tagline||""} onChange={hf("tagline")} placeholder="Build the future in 48 hours" /></Field>
            <Field label="Prize Pool"><input style={IN} value={hackForm.prizePool||""} onChange={hf("prizePool")} placeholder="$25,000 in prizes" /></Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Contact Email"><input type="email" style={IN} value={hackForm.contactEmail||""} onChange={hf("contactEmail")} placeholder="contact@hackfest.com" /></Field>
            <Field label="Registration Deadline"><input style={IN} value={hackForm.registrationDeadline||""} onChange={hf("registrationDeadline")} placeholder="June 30, 2025" /></Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Max Participants"><input type="number" style={IN} value={hackForm.maxParticipants||""} onChange={hf("maxParticipants")} placeholder="200" /></Field>
            <Field label="Max Teams"><input type="number" style={IN} value={hackForm.maxTeams||""} onChange={hf("maxTeams")} placeholder="50" /></Field>
          </div>

          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginTop:18,marginBottom:12,paddingTop:14,borderTop:`1px solid ${C.border}`}}>Appearance</div>
          <Field label="Event Logo URL" hint="Shows in navbar and hero — paste any image URL">
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {hackForm.eventLogoUrl&&<img src={hackForm.eventLogoUrl} style={{height:36,maxWidth:80,objectFit:"contain",border:`1px solid ${C.border}`,borderRadius:R.sm,padding:4,background:"#111"}} />}
              <input style={{...IN,flex:1}} value={hackForm.eventLogoUrl||""} onChange={hf("eventLogoUrl")} placeholder="https://... logo image URL" />
            </div>
          </Field>
          <Field label="Accent / Banner Color" hint="Controls hero gradient and all highlights on the public page">
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(hackForm.bannerColor||"")?hackForm.bannerColor:"#6366f1"} onChange={hf("bannerColor")} style={{width:44,height:36,borderRadius:R.sm,border:`1px solid ${C.border}`,cursor:"pointer",padding:2}} />
              <input style={{...IN,flex:1}} value={hackForm.bannerColor||"#6366f1"} onChange={hf("bannerColor")} placeholder="#6366f1" />
              <div style={{width:44,height:36,borderRadius:R.sm,background:hackForm.bannerColor||"#6366f1",border:`1px solid ${C.border}`}} />
            </div>
          </Field>

          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginTop:18,marginBottom:12,paddingTop:14,borderTop:`1px solid ${C.border}`}}>Content Sections</div>
          <Field label="Tracks" hint="Comma-separated: AI/ML, Sustainability, Security, Social Impact, ...">
            <input style={IN} value={hackForm.tracks||""} onChange={hf("tracks")} placeholder="AI/ML, Sustainability, Security, Social Impact" />
          </Field>
          <Field label="About (long form)" hint="Full description shown in the About section">
            <textarea style={{...TA,minHeight:100}} value={hackForm.websiteAbout||hackForm.description||""} onChange={hf("websiteAbout")} placeholder="Write a compelling event description..." />
          </Field>
          <Field label="Stats Bar" hint="One per line — emoji | value | label">
            <textarea style={{...TA,minHeight:80}} value={hackForm.websiteStats||""} onChange={hf("websiteStats")} placeholder={"🏆 | $25,000 | Prize Pool\n👥 | 200+ | Participants\n🎯 | 6 | Tracks\n⭐ | 15 | Judges"} />
          </Field>
          <Field label="Promo Video URL" hint="YouTube or Vimeo — embedded on the public page">
            <input style={IN} value={hackForm.promoVideoUrl||""} onChange={hf("promoVideoUrl")} placeholder="https://youtube.com/watch?v=..." />
          </Field>
          <Field label="Prizes" hint='One per line: "1st Place | $10,000 + AWS Credits"'>
            <textarea style={{...TA,minHeight:80}} value={hackForm.websitePrizes||""} onChange={hf("websitePrizes")} placeholder={"1st Place | $10,000 + AWS Credits\n2nd Place | $5,000\n3rd Place | $2,500 + Mentorship"} />
          </Field>

          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginTop:18,marginBottom:12,paddingTop:14,borderTop:`1px solid ${C.border}`}}>Schedule / Agenda</div>
          <Field label="Schedule" hint="Day headers (no |) then events: 9:00 AM | Session Name">
            <textarea style={{...TA,minHeight:120}} value={hackForm.schedule||""} onChange={hf("schedule")} placeholder={"Day 1\n9:00 AM | Registration & Breakfast\n10:00 AM | Opening Ceremony\n11:00 AM | Hacking Begins\n\nDay 2\n9:00 AM | Morning Check-in\n6:00 PM | Submission Deadline"} />
          </Field>

          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginTop:18,marginBottom:12,paddingTop:14,borderTop:`1px solid ${C.border}`}}>Venue</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Venue Name"><input style={IN} value={hackForm.venueName||""} onChange={hf("venueName")} placeholder="Convention Center" /></Field>
            <Field label="Google Maps URL"><input style={IN} value={hackForm.venueMapsUrl||""} onChange={hf("venueMapsUrl")} placeholder="https://maps.google.com/..." /></Field>
          </div>
          <Field label="Venue Address">
            <textarea style={{...TA,minHeight:56}} value={hackForm.venueAddress||""} onChange={hf("venueAddress")} placeholder={"123 Main St\nMcKinney, TX 75070"} />
          </Field>

          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginTop:18,marginBottom:12,paddingTop:14,borderTop:`1px solid ${C.border}`}}>Social Media</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Twitter / X"><input style={IN} value={hackForm.socialTwitter||""} onChange={hf("socialTwitter")} placeholder="https://twitter.com/..." /></Field>
            <Field label="LinkedIn"><input style={IN} value={hackForm.socialLinkedin||""} onChange={hf("socialLinkedin")} placeholder="https://linkedin.com/..." /></Field>
            <Field label="Instagram"><input style={IN} value={hackForm.socialInstagram||""} onChange={hf("socialInstagram")} placeholder="https://instagram.com/..." /></Field>
            <Field label="Facebook"><input style={IN} value={hackForm.socialFacebook||""} onChange={hf("socialFacebook")} placeholder="https://facebook.com/..." /></Field>
          </div>

          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginTop:18,marginBottom:12,paddingTop:14,borderTop:`1px solid ${C.border}`}}>Community Links</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Discord Server URL"><input style={IN} value={hackForm.discordUrl||""} onChange={hf("discordUrl")} placeholder="https://discord.gg/..." /></Field>
            <Field label="WhatsApp Group URL"><input style={IN} value={hackForm.whatsappGroupUrl||""} onChange={hf("whatsappGroupUrl")} placeholder="https://chat.whatsapp.com/..." /></Field>
            <Field label="Slack Channel URL"><input style={IN} value={hackForm.slackUrl||""} onChange={hf("slackUrl")} placeholder="https://yourworkspace.slack.com/..." /></Field>
          </div>

          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginTop:18,marginBottom:12,paddingTop:14,borderTop:`1px solid ${C.border}`}}>Problem Statements</div>
          <Field label="Problem Statements" hint='One problem per block, separated by blank line. First line = title, rest = description. Or use JSON array: [{"title":"..","description":".."}]'>
            <textarea style={{...TA,minHeight:120}} value={hackForm.problemStatements||""} onChange={hf("problemStatements")}
              placeholder={"AI for Healthcare\nBuild a solution using AI and real-time data.\n\nClimate Tech\nCreate a tool to reduce carbon footprint."} />
          </Field>

          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginTop:18,marginBottom:12,paddingTop:14,borderTop:`1px solid ${C.border}`}}>Resources & Tools</div>
          <Field label="Resources" hint="One per line: Name | URL | Description">
            <textarea style={{...TA,minHeight:80}} value={hackForm.resources||""} onChange={hf("resources")}
              placeholder={"OpenAI API | https://platform.openai.com | GPT-4 access\nFigma | https://figma.com | Free prototyping tool\nAWS Credits | https://aws.amazon.com/activate | $100 credits"} />
          </Field>

          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginTop:18,marginBottom:12,paddingTop:14,borderTop:`1px solid ${C.border}`}}>People's Choice Voting</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Enable Public Voting">
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <input type="checkbox" checked={!!hackForm.peoplesChoiceOpen} onChange={e=>setHackForm(p=>({...p,peoplesChoiceOpen:e.target.checked}))} />
                <span style={{...FONT,fontSize:13,color:C.text}}>Allow public to vote for teams</span>
              </label>
            </Field>
            <Field label="Voting Closes" hint="Leave blank for no deadline">
              <input type="datetime-local" style={IN} value={hackForm.peoplesChoiceEnd||""} onChange={hf("peoplesChoiceEnd")} />
            </Field>
          </div>

          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginTop:18,marginBottom:12,paddingTop:14,borderTop:`1px solid ${C.border}`}}>Code of Conduct</div>
          <Field label="Code of Conduct" hint="Shown on public page before registration form">
            <textarea style={{...TA,minHeight:100}} value={hackForm.codeOfConduct||""} onChange={hf("codeOfConduct")}
              placeholder={"Be respectful to all participants, judges, and organizers.\nHarassment or toxic behavior will not be tolerated.\nAll work must be original.\nTeams must have 1-5 members."} />
          </Field>

          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginTop:18,marginBottom:12,paddingTop:14,borderTop:`1px solid ${C.border}`}}>Gallery & Testimonials</div>
          <Field label="Gallery Images" hint="One image URL per line — clickable grid on public page">
            <textarea style={{...TA,minHeight:80}} value={hackForm.galleryImages||""} onChange={hf("galleryImages")} placeholder={"https://example.com/photo1.jpg\nhttps://example.com/photo2.jpg\nhttps://example.com/photo3.jpg"} />
          </Field>
          <Field label="Testimonials" hint="Blank line between each. Line 1: quote, Line 2: name, Line 3: role/org">
            <textarea style={{...TA,minHeight:100}} value={hackForm.websiteTestimonials||""} onChange={hf("websiteTestimonials")} placeholder={"Best hackathon I have attended!\nSrikanth R.\nSenior Architect, Caesars Digital\n\nIncredible judges and mentors.\nJane Doe\nCTO, TechStartup Inc"} />
          </Field>

          <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginTop:18,marginBottom:12,paddingTop:14,borderTop:`1px solid ${C.border}`}}>FAQ</div>
          <Field label="FAQ" hint="Blank line between Q&A pairs. Q: on one line, A: on next">
            <textarea style={{...TA,minHeight:100}} value={hackForm.faq||""} onChange={hf("faq")} placeholder={"Q: Who can participate?\nA: Anyone 18+ with a laptop and ideas.\n\nQ: Is it free?\nA: Yes, completely free to enter."} />
          </Field>

          <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
            <Btn onClick={saveHack} disabled={hSaving} size="lg">{hSaving&&<Spinner/>} Save All Settings</Btn>
          </div>
        </Card>
      )}
      {/* ── KeyNotes ── */}
      {tab==="keynotes"&&selH&&(
        <Card>
          <PeopleEditor title="Keynote Speakers" type="keynote" hackathonId={selH} toast={toast} />
        </Card>
      )}

      {/* ── Session Chairs ── */}
      {tab==="chairs"&&selH&&(
        <Card>
          <PeopleEditor title="Session Chairs" type="session_chair" hackathonId={selH} toast={toast} />
        </Card>
      )}

      {/* ── Org Team ── */}
      {tab==="team"&&(
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text}}>Organizing Team <span style={{color:C.text3,fontWeight:400}}>({team.length})</span></div>
            <Btn size="sm" onClick={()=>{setTForm({hackathonId:selH});setTModal("new");}}>+ Add Member</Btn>
          </div>
          {team.length===0?<div style={{...FONT,fontSize:12,color:C.text3,fontStyle:"italic"}}>No team members added yet.</div>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
              {team.map(m=>(
                <div key={m.id} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:R.sm,padding:14}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                    {m.avatarUrl?<img src={m.avatarUrl} style={{width:36,height:36,borderRadius:"50%",objectFit:"cover"}} />:<Avatar name={m.name} size={36}/>}
                    <div><div style={{...FONT,fontSize:12,fontWeight:600,color:C.text}}>{m.name}</div><div style={{...FONT,fontSize:11,color:C.text3}}>{m.role}</div></div>
                  </div>
                  <div style={{display:"flex",gap:5}}>
                    <Btn size="sm" variant="secondary" onClick={()=>{setTForm({...m});setTModal(m);}}>Edit</Btn>
                    <Btn size="sm" variant="danger" onClick={()=>delTeamMember(m.id)}>✕</Btn>
                  </div>
                </div>
              ))}
            </div>
          }
          {tModal&&<Modal title={tModal==="new"?"Add Team Member":"Edit Member"} onClose={()=>setTModal(null)}>
            <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:14,padding:12,background:C.bg2,borderRadius:R.sm,border:`1px solid ${C.border}`}}>
              <div style={{width:60,height:60,borderRadius:"50%",overflow:"hidden",flexShrink:0,background:tForm.avatarUrl?"transparent":C.bg3,border:`2px dashed ${tForm.avatarUrl?C.bdGreen:C.border2}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {tForm.avatarUrl?<img src={tForm.avatarUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} />:<span style={{fontSize:22,opacity:0.3}}>👤</span>}
              </div>
              <div style={{flex:1}}>
                <label style={{...FONT,display:"inline-flex",alignItems:"center",gap:5,fontSize:12,fontWeight:500,padding:"5px 10px",borderRadius:R.sm,border:`1px solid ${C.border2}`,cursor:"pointer",background:C.bg,color:C.text2,marginBottom:5}}>
                  {uploading?<><Spinner size={10}/> Uploading…</>:<>📷 {tForm.avatarUrl?"Change":"Upload"}</>}
                  <input type="file" accept="image/*" onChange={e=>handleImg(e,setTForm)} style={{display:"none"}} disabled={uploading}/>
                </label>
                <input style={{...IN,fontSize:12}} value={tForm.avatarUrl&&!tForm.avatarUrl.startsWith("data:")?tForm.avatarUrl:""} onChange={e=>setTForm(p=>({...p,avatarUrl:e.target.value}))} placeholder="Or paste image URL" />
              </div>
            </div>
            <Field label="Full Name" required><input style={IN} value={tForm.name||""} onChange={tf("name")} /></Field>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Role"><input style={IN} value={tForm.role||""} onChange={tf("role")} placeholder="Lead Organizer" /></Field>
              <Field label="Organization"><input style={IN} value={tForm.org||""} onChange={tf("org")} /></Field>
            </div>
            <Field label="LinkedIn URL"><input style={IN} value={tForm.linkedinUrl||""} onChange={tf("linkedinUrl")} placeholder="https://linkedin.com/in/…" /></Field>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <Btn variant="secondary" onClick={()=>setTModal(null)}>Cancel</Btn>
              <Btn onClick={saveTeamMember} disabled={tSaving}>{tSaving&&<Spinner/>} Save</Btn>
            </div>
          </Modal>}
        </Card>
      )}

      {/* ── Partners ── */}
      {tab==="partners"&&(
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text}}>Partners & Sponsors <span style={{color:C.text3,fontWeight:400}}>({partners.length})</span></div>
            <Btn size="sm" onClick={()=>{setPForm({hackathonId:selH,tier:"general"});setPModal("new");}}>+ Add Partner</Btn>
          </div>
          <div style={{...FONT,fontSize:12,color:C.text3,marginBottom:14}}>
            Tier display order: <strong>Platinum → Gold → Silver → Bronze → Media → General</strong>
          </div>
          {partners.length===0?<div style={{...FONT,fontSize:12,color:C.text3,fontStyle:"italic"}}>No partners added yet.</div>
            :<DataTable cols={[
              {key:"name",label:"Partner",render:(v,r)=>(
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  {r.logoUrl?<img src={r.logoUrl} style={{height:28,maxWidth:60,objectFit:"contain"}} />:<div style={{width:28,height:28,background:C.bg3,borderRadius:4}} />}
                  <div><div style={{fontWeight:500}}>{v}</div>{r.websiteUrl&&<a href={r.websiteUrl} target="_blank" style={{fontSize:11,color:C.blue,textDecoration:"none"}}>{r.websiteUrl.slice(0,30)}…</a>}</div>
                </div>
              )},
              {key:"tier",label:"Tier",render:v=><Chip label={v} color={v==="platinum"?"amber":v==="gold"?"amber":v==="silver"?"neutral":"neutral"} />},
              {key:"id",label:"",render:(_,r)=><div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
                <Btn size="sm" variant="secondary" onClick={()=>{setPForm({...r});setPModal(r);}}>Edit</Btn>
                <Btn size="sm" variant="danger" onClick={()=>delPartner(r.id)}>✕</Btn>
              </div>},
            ]} rows={partners} />
          }
          {pModal&&<Modal title={pModal==="new"?"Add Partner":"Edit Partner"} onClose={()=>setPModal(null)}>
            <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:14,padding:12,background:C.bg2,borderRadius:R.sm,border:`1px solid ${C.border}`}}>
              <div style={{width:80,height:56,borderRadius:R.sm,overflow:"hidden",flexShrink:0,background:pForm.logoUrl?"transparent":C.bg3,border:`2px dashed ${pForm.logoUrl?C.bdGreen:C.border2}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {pForm.logoUrl?<img src={pForm.logoUrl} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}} />:<span style={{fontSize:20,opacity:0.3}}>🖼</span>}
              </div>
              <div style={{flex:1}}>
                <label style={{...FONT,display:"inline-flex",alignItems:"center",gap:5,fontSize:12,fontWeight:500,padding:"5px 10px",borderRadius:R.sm,border:`1px solid ${C.border2}`,cursor:"pointer",background:C.bg,color:C.text2,marginBottom:5}}>
                  {uploading?<><Spinner size={10}/> Uploading…</>:<>📷 {pForm.logoUrl?"Change":"Upload"} Logo</>}
                  <input type="file" accept="image/*" onChange={e=>handleImg(e,setPForm,"logoUrl")} style={{display:"none"}} disabled={uploading}/>
                </label>
                <input style={{...IN,fontSize:12}} value={pForm.logoUrl&&!pForm.logoUrl.startsWith("data:")?pForm.logoUrl:""} onChange={e=>setPForm(p=>({...p,logoUrl:e.target.value}))} placeholder="Or paste logo URL" />
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Partner Name" required><input style={IN} value={pForm.name||""} onChange={pf("name")} /></Field>
              <Field label="Tier">
                <select style={IN} value={pForm.tier||"general"} onChange={pf("tier")}>
                  {["platinum","gold","silver","bronze","media","general"].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Website URL"><input style={IN} value={pForm.websiteUrl||""} onChange={pf("websiteUrl")} placeholder="https://…" /></Field>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <Btn variant="secondary" onClick={()=>setPModal(null)}>Cancel</Btn>
              <Btn onClick={savePartner} disabled={pSaving}>{pSaving&&<Spinner/>} Save</Btn>
            </div>
          </Modal>}
        </Card>
      )}
    </div>
  );
}

/* ─── PUBLIC PAGES ADMIN ───────────────────────────────────────────────── */
export function PublicPagesAdmin({ db, reload, toast, activeHackathon }) {
  const [selH,setSelH]=useState(activeHackathon||db.hackathons[0]?.id||"");
  const [regs,setRegs]=useState([]);
  const [tab,setTab]=useState("all");
  const [converting,setConverting]=useState({});

  const loadRegs=useCallback(async()=>{
    if(!selH)return;
    try{ const d=await GET(`/api/registrations?hackathonId=${selH}`); setRegs(d); }catch{}
  },[selH]);
  useEffect(()=>{ loadRegs(); },[loadRegs]);

  const hack=db.hackathons.find(h=>h.id===selH);
  const pubUrl=`${window.location.origin}/register/${selH}`;

  const publish=async val=>{
    try{await PUT(`/api/hackathons/${hack.id}`,{...hack,published:val});await reload();toast(val?"Published!":"Unpublished");}
    catch(e){toast(e.message,"error");}
  };
  const updateReg=async(id,status)=>{
    try{await PUT(`/api/registrations/${id}`,{status});setRegs(r=>r.map(x=>x.id===id?{...x,status}:x));toast(`Registration ${status}`);}
    catch(e){toast(e.message,"error");}
  };
  const delReg=async id=>{
    try{await DEL(`/api/registrations/${id}`);setRegs(r=>r.filter(x=>x.id!==id));}
    catch(e){toast(e.message,"error");}
  };

  // Convert approved registration → actual Team or Judge record
  const convertReg=async(reg)=>{
    setConverting(p=>({...p,[reg.id]:true}));
    try{
      if(reg.type==="team"){
        const teamName=reg.teamName||reg.name;
        const exists=db.teams.some(t=>t.hackathonId===selH&&t.name.toLowerCase()===teamName.toLowerCase());
        if(exists){toast(`Team "${teamName}" already exists in this hackathon`,"error");return;}
        await POST("/api/teams",{
          hackathonId:selH,
          name:teamName,
          project:"",
          category:"",
          members:reg.name+(reg.teamSize>1?` + ${reg.teamSize-1} more`:""),
        });
        await reload();
        toast(`✓ Team "${teamName}" added — go to Teams to fill in project details`);
      } else {
        const exists=db.judges.some(j=>j.name.toLowerCase()===reg.name.toLowerCase());
        if(exists){toast(`Judge "${reg.name}" already exists`,"error");return;}
        // Create judge profile
        const judgeRes = await POST("/api/judges",{name:reg.name,org:reg.org||"",role:""});
        // Auto-create user login linked to judge profile
        const tempPassword = Math.random().toString(36).slice(2,10);
        try {
          await POST("/api/users",{
            name: reg.name,
            email: reg.email,
            password: tempPassword,
            role: "judge",
            judgeId: judgeRes.id,
          });
          await POST("/api/assignments",{hackathonId:selH, userId: judgeRes.id}).catch(()=>{});
          await reload();
          toast(`✓ Judge "${reg.name}" added with login: ${reg.email} / ${tempPassword} — share this password!`);
          navigator.clipboard?.writeText(`Email: ${reg.email}
Password: ${tempPassword}`).catch(()=>{});
        } catch(userErr) {
          // User account may already exist (OAuth signup etc.) — judge profile still created
          await reload();
          toast(`✓ Judge profile created. Login already exists for ${reg.email} — link in User Management.`);
        }
      }
    }catch(e){toast(e.message,"error");}
    setConverting(p=>({...p,[reg.id]:false}));
  };

  const pending  =regs.filter(r=>r.status==="pending");
  const approved =regs.filter(r=>r.status==="approved");
  const rejected =regs.filter(r=>r.status==="rejected");
  const filtered =tab==="pending"?pending:tab==="approved"?approved:tab==="rejected"?rejected:regs;

  const RegCard=({r})=>{
    const busy=!!converting[r.id];
    const alreadyAdded=r.type==="team"
      ?db.teams.some(t=>t.hackathonId===selH&&t.name.toLowerCase()===(r.teamName||r.name).toLowerCase())
      :db.judges.some(j=>j.name.toLowerCase()===r.name.toLowerCase());
    return(
      <Card style={{marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start",flex:1,minWidth:0}}>
            <Avatar name={r.name} size={38}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,flexWrap:"wrap"}}>
                <span style={{...FONT,fontSize:13,fontWeight:600,color:C.text}}>{r.name}</span>
                <Chip label={r.type} color={r.type==="judge"?"blue":"neutral"} />
                <Chip label={r.status} color={r.status==="approved"?"green":r.status==="rejected"?"red":"amber"} />
                {alreadyAdded&&r.status==="approved"&&(
                  <Chip label={r.type==="judge"?"✓ In Judges":"✓ In Teams"} color="green" />
                )}
              </div>
              <div style={{...FONT,fontSize:12,color:C.text3,marginBottom:3}}>{r.email}{r.org?` · ${r.org}`:""}</div>
              {r.type==="team"&&r.teamName&&(
                <div style={{...FONT,fontSize:12,color:C.text2,marginBottom:3}}>
                  🚀 <strong>{r.teamName}</strong>{r.teamSize?` · ${r.teamSize} member${r.teamSize!==1?"s":""}`:""}
                </div>
              )}
              {r.message&&(
                <div style={{...FONT,fontSize:11,color:C.text3,fontStyle:"italic",
                  borderLeft:`3px solid ${C.border2}`,paddingLeft:8,lineHeight:1.5,marginTop:4}}>
                  "{r.message.slice(0,140)}{r.message.length>140?"…":""}"
                </div>
              )}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0,alignItems:"flex-end"}}>
            <div style={{display:"flex",gap:5}}>
              {r.status!=="approved"&&<Btn size="sm" variant="success" onClick={()=>updateReg(r.id,"approved")}>Approve</Btn>}
              {r.status!=="rejected"&&<Btn size="sm" variant="danger"  onClick={()=>updateReg(r.id,"rejected")}>Reject</Btn>}
              <Btn size="sm" variant="ghost" onClick={()=>delReg(r.id)}>✕</Btn>
            </div>
            {/* Create team login */}
              {r.status==="approved"&&<CreateLoginBtn regId={r.id} email={r.email} onCreated={()=>{loadRegs();toast("Login created & emailed!");}}/> }
              {r.status==="pending"&&<AIScreenReg registrationId={r.id} hackathonId={selH}
              onApply={async(status)=>{ await PUT(`/api/registrations/${r.id}`,{status}); await loadRegs(); toast("Status updated"); }}
            />}
            {r.status==="approved"&&!alreadyAdded&&(
              <button onClick={()=>convertReg(r)} disabled={busy}
                style={{...FONT,fontSize:12,fontWeight:600,padding:"6px 13px",borderRadius:R.sm,
                  cursor:busy?"wait":"pointer",border:"none",display:"flex",alignItems:"center",gap:5,
                  background:r.type==="judge"?C.bgBlue:C.bgGreen,
                  color:r.type==="judge"?C.blue:C.green,
                  opacity:busy?0.6:1}}>
                {busy?<><Spinner size={11}/> Adding…</>
                  :r.type==="judge"?"＋ Add to Judges":"＋ Add to Teams"}
              </button>
            )}
            {r.status==="approved"&&alreadyAdded&&(
              <div style={{...FONT,fontSize:11,color:C.green}}>✓ Added to {r.type==="judge"?"Judges":"Teams"}</div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return(
    <div>
      <SectionHeader title="Registrations" count="Review applications and onboard approved participants" />
      <div style={{display:"grid",gridTemplateColumns:"210px 1fr",gap:14,alignItems:"start"}}>
        <Card pad={0} style={{overflow:"hidden"}}>
          <div style={{...FONT,fontSize:11,fontWeight:500,color:C.text3,letterSpacing:"0.05em",textTransform:"uppercase",
            padding:"8px 14px",background:C.bg2,borderBottom:`1px solid ${C.border}`}}>Hackathons</div>
          {db.hackathons.map(h=>(
            <div key={h.id} onClick={()=>setSelH(h.id)}
              style={{padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${C.border}`,
                background:selH===h.id?"#eff6ff":"transparent",transition:"background 0.1s"}}
              onMouseEnter={e=>{if(selH!==h.id)e.currentTarget.style.background=C.bg2;}}
              onMouseLeave={e=>{if(selH!==h.id)e.currentTarget.style.background="transparent";}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{...FONT,fontSize:13,fontWeight:500,color:C.text}}>{h.name}</span>
                <Chip label={h.published?"live":"draft"} color={h.published?"green":"neutral"} />
              </div>
              <div style={{...FONT,fontSize:11,color:C.text3,marginTop:2}}>{h.status} · {regs.filter(r=>r.hackathonId===h.id||selH===h.id).length} regs</div>
            </div>
          ))}
        </Card>

        {hack?(
          <div>
            <Card style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{...FONT,fontSize:14,fontWeight:600,color:C.text,marginBottom:2}}>{hack.name}</div>
                  <div style={{...FONT,fontSize:12,color:C.text3}}>{hack.tagline||"No tagline"}</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <Chip label={hack.published?"Published":"Draft"} color={hack.published?"green":"neutral"} />
                  <Btn variant={hack.published?"secondary":"success"} size="sm" onClick={()=>publish(!hack.published)}>
                    {hack.published?"Unpublish":"Publish"}
                  </Btn>
                  {hack.published&&<>
                    <Btn size="sm" variant="blue" onClick={()=>{navigator.clipboard?.writeText(pubUrl);toast("URL copied!");}}>Copy URL</Btn>
                    <Btn size="sm" variant="secondary" onClick={()=>{
                    // Open preview in new tab — works even if not published
                    const previewUrl = `${window.location.origin}/register/${selH}?preview=1&token=${encodeURIComponent(localStorage.getItem("hf_token")||"")}`;
                    window.open(previewUrl,"_blank");
                  }}>Preview →</Btn>
                  </>}
                </div>
              </div>
            </Card>

            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
              <Stat label="Total" value={regs.length} />
              <Stat label="Pending"  value={pending.length}  color={pending.length>0?C.amber:C.text} />
              <Stat label="Approved" value={approved.length} color={C.green} />
              <Stat label="Rejected" value={rejected.length} color={rejected.length>0?C.red:C.text} />
            </div>

            {approved.length>0&&(
              <div style={{...FONT,fontSize:12,background:C.bgBlue,border:`1px solid ${C.bdBlue}`,
                borderRadius:R.sm,padding:"10px 14px",marginBottom:14,color:C.blue,lineHeight:1.6}}>
                💡 <strong>How to onboard:</strong> Approve a registration, then click
                <strong> "＋ Add to Teams"</strong> or <strong>"＋ Add to Judges"</strong>.
                That creates the record — then go to Teams/Judges to fill in details,
                and User Management to create a login for judges.
              </div>
            )}

            <div style={{display:"flex",gap:1,marginBottom:14,background:C.bg2,borderRadius:R.sm,padding:3,border:`1px solid ${C.border}`}}>
              {[{id:"all",l:`All (${regs.length})`},{id:"pending",l:`Pending (${pending.length})`},
                {id:"approved",l:`Approved (${approved.length})`},{id:"rejected",l:`Rejected (${rejected.length})`}]
                .map(t=>(
                  <button key={t.id} onClick={()=>setTab(t.id)}
                    style={{...FONT,flex:1,padding:"6px 10px",fontSize:12,fontWeight:500,borderRadius:R.sm,
                      border:"none",cursor:"pointer",background:tab===t.id?C.bg:C.bg2,
                      color:tab===t.id?C.text:C.text3,transition:"all 0.1s",whiteSpace:"nowrap"}}>
                    {t.l}
                  </button>
                ))
              }
            </div>

            {filtered.length===0
              ?<Empty icon="📬" title={regs.length===0?"No registrations yet":"None in this category"}
                  sub={regs.length===0?(hack.published?"Share the public link to get registrations.":"Publish this hackathon first."):"Try a different filter."} />
              :filtered.map(r=><RegCard key={r.id} r={r} />)
            }
          </div>
        ):<Empty icon="🌐" title="Select a hackathon" />}
      </div>
    </div>
  );
}
