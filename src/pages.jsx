import { useState, useEffect, useCallback } from "react";
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
  return <CrudPage title="Judges" icon="👨‍⚖️" items={db.judges} emptyMsg="No judges registered"
    saveItem={async(id,form)=>{try{id?await PUT(`/api/judges/${id}`,form):await POST("/api/judges",form);await reload();toast(id?"Updated":"Added");}catch(e){toast(e.message,"error");throw e;}}}
    delItem={async id=>{try{await DEL(`/api/judges/${id}`);await reload();toast("Removed");}catch(e){toast(e.message,"error");}}}
    renderRow={(_,open,del)=>[
      {key:"name",label:"Name",render:(v,r)=><div style={{display:"flex",alignItems:"center",gap:10}}><Avatar name={v} size={30}/><div><div style={{fontWeight:500}}>{v}</div><div style={{fontSize:11,color:C.text3}}>{r.org}</div></div></div>},
      {key:"role",label:"Role"},
      {key:"id",label:"",render:(_,r)=><div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
        <Btn size="sm" variant="secondary" onClick={()=>open(r)}>Edit</Btn>
        <Btn size="sm" variant="danger" onClick={()=>del(r.id)}>Remove</Btn>
      </div>},
    ]}
    modalBody={(form,f)=><>
      <Field label="Full Name" required><input style={IN} value={form.name||""} onChange={f("name")} /></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Organization"><input style={IN} value={form.org||""} onChange={f("org")} /></Field>
        <Field label="Role / Title"><input style={IN} value={form.role||""} onChange={f("role")} /></Field>
      </div>
    </>}
  />;
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
export function FeedbackPage({ db, reload, toast, activeHackathon, currentUser }) {
  const hack=db.hackathons.find(h=>h.id===activeHackathon);
  const teams=db.teams.filter(t=>t.hackathonId===activeHackathon);
  const criteria=db.criteria.filter(c=>c.hackathonId===activeHackathon);
  const [teamId,setTeamId]=useState(teams[0]?.id||"");
  const [judgeId,setJudgeId]=useState(currentUser?.judgeId||db.judges[0]?.id||"");
  const [scores,setScores]=useState({});
  const [comments,setComments]=useState({});
  const [overall,setOverall]=useState("");
  const [meta,setMeta]=useState({submissionNumber:"",demoVideoLink:"NA",githubRepo:"",liveProjectLink:"NA",pptsPhotos:"NA"});
  const [saving,setSaving]=useState(false);const [savedOk,setSavedOk]=useState(false);
  const isJudge=currentUser?.role==="judge";
  const existing=db.feedbacks.find(f=>f.teamId===teamId&&f.judgeId===judgeId&&f.hackathonId===activeHackathon);

  useEffect(()=>{
    if(existing){
      setScores(existing.scores||{});setComments(existing.comments||{});setOverall(existing.overall||"");
      setMeta({submissionNumber:existing.submissionNumber||"",demoVideoLink:existing.demoVideoLink||"NA",githubRepo:existing.githubRepo||"",liveProjectLink:existing.liveProjectLink||"NA",pptsPhotos:existing.pptsPhotos||"NA"});
    } else { setScores({});setComments({});setOverall("");setMeta({submissionNumber:"",demoVideoLink:"NA",githubRepo:"",liveProjectLink:"NA",pptsPhotos:"NA"}); }
    setSavedOk(false);
  },[teamId,judgeId]);

  const score=calcScore(scores,criteria);
  const fm=k=>e=>setMeta(p=>({...p,[k]:e.target.value}));

  const submit=async()=>{
    if(!criteria.every(c=>scores[c.id]!=null))return toast("Please score all criteria before submitting","error");
    setSaving(true);
    try{
      await POST("/api/feedbacks",{hackathonId:activeHackathon,teamId,judgeId,scores,comments,overall,...meta});
      await reload();toast("Feedback saved successfully");setSavedOk(true);
    }catch(e){toast(e.message,"error");}
    setSaving(false);
  };

  if(!activeHackathon) return <Empty icon="✍️" title="Select a hackathon" />;
  if(!criteria.length) return <Empty icon="📋" title="No criteria defined" sub="An admin needs to add evaluation criteria first." />;
  if(!teams.length)    return <Empty icon="👥" title="No teams registered" sub="An admin needs to add teams first." />;

  const judge=db.judges.find(j=>j.id===judgeId);

  return (
    <div>
      <SectionHeader title="Submit Feedback" count={hack?.name} />
      {/* Judge + Team selectors */}
      <Card style={{marginBottom:14,background:"#f8faff",border:`1px solid ${C.bdBlue}`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Team">
            <select style={IN} value={teamId} onChange={e=>setTeamId(e.target.value)}>
              {teams.map(t=><option key={t.id} value={t.id}>{t.name} — {t.project}</option>)}
            </select>
          </Field>
          <Field label="Judge">
            {isJudge
              ? <div style={{...IN,background:C.bg2,color:C.text2,cursor:"default",display:"flex",alignItems:"center",gap:8}}>
                  <Avatar name={judge?.name} size={20}/>{judge?.name}
                </div>
              : <select style={IN} value={judgeId} onChange={e=>setJudgeId(e.target.value)}>
                  {db.judges.map(j=><option key={j.id} value={j.id}>{j.name} ({j.org})</option>)}
                </select>
            }
          </Field>
        </div>
      </Card>

      {existing&&<div style={{...FONT,background:C.bgBlue,border:`1px solid ${C.bdBlue}`,borderRadius:R.sm,padding:"9px 13px",fontSize:12,color:C.blue,marginBottom:14}}>
        ✏️ Editing existing submission — last saved {fmtDt(existing.submittedAt)}. Saving will overwrite.
      </div>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:16}}>
        <div>
          {/* Project Metadata Section */}
          <Card style={{marginBottom:14}}>
            <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:14,paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>
              📋 Project Details
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Submission Project Number">
                <input style={IN} value={meta.submissionNumber} onChange={fm("submissionNumber")} placeholder="e.g. SUB-001" />
              </Field>
              <Field label="Judge ID">
                <input style={{...IN,background:C.bg2,color:C.text3}} value={judgeId} readOnly />
              </Field>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Demo Video Link" hint="Enter NA if not available">
                <input style={IN} value={meta.demoVideoLink} onChange={fm("demoVideoLink")} placeholder="https://youtube.com/... or NA" />
              </Field>
              <Field label="GitHub Repository">
                <input style={IN} value={meta.githubRepo} onChange={fm("githubRepo")} placeholder="https://github.com/..." />
              </Field>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Live Project Link" hint="Enter NA if not available">
                <input style={IN} value={meta.liveProjectLink} onChange={fm("liveProjectLink")} placeholder="https://... or NA" />
              </Field>
              <Field label="PPTs & Photos">
                <input style={IN} value={meta.pptsPhotos} onChange={fm("pptsPhotos")} placeholder="Drive link or NA" />
              </Field>
            </div>
          </Card>

          {/* Scoring Section */}
          <Card>
            <div style={{...FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:16,paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>
              ⭐ Scoring Criteria
            </div>
            {criteria.map(c=>{
              const s=scores[c.id]??0;const has=scores[c.id]!=null;
              const sc=has?(s>=8?C.green:s>=6?C.blue:s>=4?C.amber:C.red):C.text3;
              return(
                <div key={c.id} style={{marginBottom:20,paddingBottom:20,borderBottom:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <div>
                      <div style={{...FONT,fontSize:14,fontWeight:600,color:C.text}}>{c.name}</div>
                      <div style={{...FONT,fontSize:12,color:C.text3,marginTop:1}}>{c.description}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{...MONO,fontSize:24,fontWeight:600,color:sc,lineHeight:1}}>{has?s:"—"}</div>
                      <div style={{...FONT,fontSize:11,color:C.text3,marginTop:1}}>/ {c.maxScore} pts · {c.weight}%</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                    <input type="range" min={0} max={c.maxScore} value={s} style={{flex:1,accentColor:"#2563eb",cursor:"pointer"}} onChange={e=>setScores(p=>({...p,[c.id]:+e.target.value}))} />
                    <div style={{display:"flex",gap:4}}>
                      {[0,2,4,6,8,10].filter(v=>v<=c.maxScore).map(v=>(
                        <button key={v} onClick={()=>setScores(p=>({...p,[c.id]:v}))}
                          style={{...MONO,width:28,height:24,fontSize:11,border:`1px solid ${scores[c.id]===v?C.blue:C.border}`,borderRadius:4,cursor:"pointer",background:scores[c.id]===v?C.bgBlue:C.bg,color:scores[c.id]===v?C.blue:C.text3}}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea style={{...TA,minHeight:56}} placeholder={`Detailed comments on ${c.name}...`} value={comments[c.id]||""} onChange={e=>setComments(p=>({...p,[c.id]:e.target.value}))} />
                </div>
              );
            })}
          </Card>
        </div>

        {/* Summary panel */}
        <div style={{position:"sticky",top:20,alignSelf:"start"}}>
          <Card>
            <div style={{...FONT,fontSize:11,fontWeight:500,color:C.text3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:16}}>Score Summary</div>
            <div style={{textAlign:"center",padding:"16px 0 20px",borderBottom:`1px solid ${C.border}`,marginBottom:16}}>
              <div style={{...MONO,fontSize:56,fontWeight:500,lineHeight:1,color:score==null?C.border:score>=8?C.green:score>=6?C.blue:C.amber}}>{score??"—"}</div>
              <div style={{...FONT,fontSize:11,color:C.text3,marginTop:6}}>weighted score / 10</div>
            </div>
            {criteria.map(c=>(
              <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{flex:1}}>
                  <div style={{...FONT,fontSize:12,color:C.text2}}>{c.name}</div>
                  <div style={{...FONT,fontSize:10,color:C.text3}}>{c.weight}% weight</div>
                </div>
                <span style={{...MONO,fontSize:12,color:scores[c.id]!=null?C.text:C.text3}}>
                  {scores[c.id]!=null?`${scores[c.id]}/${c.maxScore}`:"—"}
                </span>
              </div>
            ))}
            <div style={{borderTop:`1px solid ${C.border}`,marginTop:14,paddingTop:14}}>
              <Field label="Overall Summary">
                <textarea style={{...TA,minHeight:72}} value={overall} onChange={e=>setOverall(e.target.value)} placeholder="Overall assessment of this team..." />
              </Field>
              <Btn full size="lg" onClick={submit} disabled={saving}>{saving&&<Spinner/>} {existing?"Update Feedback":"Submit Feedback"}</Btn>
              {savedOk&&<div style={{...FONT,textAlign:"center",fontSize:12,color:C.green,marginTop:10}}>✓ Saved to database</div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── ALL FEEDBACK ─────────────────────────────────────────────────────── */
export function AllFeedbackPage({ db, reload, toast, activeHackathon }) {
  const [ft,setFt]=useState("all");const [fj,setFj]=useState("all");
  const hack=db.hackathons.find(h=>h.id===activeHackathon);
  const criteria=db.criteria.filter(c=>c.hackathonId===activeHackathon);
  const teams=db.teams.filter(t=>t.hackathonId===activeHackathon);
  const fbs=db.feedbacks.filter(f=>f.hackathonId===activeHackathon&&(ft==="all"||f.teamId===ft)&&(fj==="all"||f.judgeId===fj));
  const del=async id=>{try{await DEL(`/api/feedbacks/${id}`);await reload();toast("Deleted");}catch(e){toast(e.message,"error");}};
  if(!activeHackathon) return <Empty icon="📊" title="Select a hackathon" />;
  return (
    <div>
      <SectionHeader title="All Feedback" count={`${fbs.length} submissions · ${hack?.name||""}`} />
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <select style={{...IN,width:"auto"}} value={ft} onChange={e=>setFt(e.target.value)}><option value="all">All Teams</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select style={{...IN,width:"auto"}} value={fj} onChange={e=>setFj(e.target.value)}><option value="all">All Judges</option>{db.judges.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select>
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
const EXTRA_PAGES=[{id:"dashboard",label:"Dashboard"},{id:"reports",label:"Reports"},{id:"all-feedback",label:"All Feedback"},{id:"criteria",label:"Criteria"}];

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
  const admins=users.filter(u=>u.role==="admin"),judges=users.filter(u=>u.role==="judge");
  return(
    <div>
      <SectionHeader title="User Management" count={`${users.length} users`} action={<Btn onClick={()=>open(null)}>+ Add User</Btn>} />
      <div style={{display:"grid",gridTemplateColumns:"270px 1fr",gap:14,alignItems:"start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[{label:"Admins",list:admins},{label:"Judges",list:judges}].map(({label,list})=>(
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
                        <div style={{...FONT,fontSize:13,fontWeight:500,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</div>
                        <div style={{...FONT,fontSize:11,color:C.text3}}>{u.oauthProvider?`via ${u.oauthProvider}`:u.email}</div>
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
                      <Chip label={selUser.role} color={selUser.role==="admin"?"blue":"neutral"} />
                      {selUser.oauthProvider&&<Chip label={selUser.oauthProvider} color="purple" />}
                    </div>
                    <div style={{...FONT,fontSize:12,color:C.text3}}>{selUser.email}</div>
                    {selUser.judgeId&&<div style={{...FONT,fontSize:11,color:C.text3,marginTop:1}}>Linked to: {db.judges?.find(j=>j.id===selUser.judgeId)?.name||selUser.judgeId}</div>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <Btn size="sm" variant="secondary" onClick={()=>open(selUser)}>Edit</Btn>
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
              </>
            )}
          </div>
        ):<Empty icon="👆" title="Select a user" sub="Click a user on the left to manage their access and hackathon assignments." />}
      </div>
      {modal&&(
        <Modal title={modal==="new"?"Add User":"Edit User"} onClose={close}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Full Name" required><input style={IN} value={form.name||""} onChange={f("name")} /></Field>
            <Field label="Role"><select style={IN} value={form.role||"judge"} onChange={f("role")}><option value="judge">Judge</option><option value="admin">Admin</option></select></Field>
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

/* ─── PUBLIC PAGES ADMIN ───────────────────────────────────────────────── */
export function PublicPagesAdmin({ db, reload, toast }) {
  const [selH,setSelH]=useState(db.hackathons[0]?.id||"");
  const [regs,setRegs]=useState([]);const [tab,setTab]=useState("overview");
  useEffect(()=>{ if(!selH)return; GET(`/api/registrations?hackathonId=${selH}`).then(setRegs).catch(()=>{}); },[selH,db.feedbacks]);
  const hack=db.hackathons.find(h=>h.id===selH);
  const pubUrl=`${window.location.origin}/register/${selH}`;
  const publish=async val=>{try{await PUT(`/api/hackathons/${hack.id}`,{...hack,published:val});await reload();toast(val?"Published! Share the link.":"Unpublished");}catch(e){toast(e.message,"error");}};
  const updateReg=async(id,status)=>{try{await PUT(`/api/registrations/${id}`,{status});setRegs(r=>r.map(x=>x.id===id?{...x,status}:x));toast(`Registration ${status}`);}catch(e){toast(e.message,"error");}};
  const delReg=async id=>{try{await DEL(`/api/registrations/${id}`);setRegs(r=>r.filter(x=>x.id!==id));}catch(e){toast(e.message,"error");}};
  return(
    <div>
      <SectionHeader title="Public Pages" count="Manage hackathon visibility and incoming registrations" />
      <div style={{display:"grid",gridTemplateColumns:"230px 1fr",gap:14,alignItems:"start"}}>
        <Card pad={0} style={{overflow:"hidden"}}>
          <div style={{...FONT,fontSize:11,fontWeight:500,color:C.text3,letterSpacing:"0.05em",textTransform:"uppercase",padding:"8px 14px",background:C.bg2,borderBottom:`1px solid ${C.border}`}}>Hackathons</div>
          {db.hackathons.map(h=>(
            <div key={h.id} onClick={()=>setSelH(h.id)}
              style={{padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${C.border}`,background:selH===h.id?"#eff6ff":"transparent",transition:"background 0.1s"}}
              onMouseEnter={e=>{if(selH!==h.id)e.currentTarget.style.background=C.bg2;}}
              onMouseLeave={e=>{if(selH!==h.id)e.currentTarget.style.background="transparent";}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{...FONT,fontSize:13,fontWeight:500,color:C.text}}>{h.name}</span>
                <Chip label={h.published?"live":"draft"} color={h.published?"green":"neutral"} />
              </div>
              <div style={{...FONT,fontSize:11,color:C.text3,marginTop:2}}>{h.status}</div>
            </div>
          ))}
        </Card>
        {hack?(
          <div>
            <Card style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div><h2 style={{...FONT,fontSize:16,fontWeight:600,color:C.text,marginBottom:4}}>{hack.name}</h2>
                  <div style={{...FONT,fontSize:12,color:C.text3}}>{hack.tagline||"No tagline"}</div></div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <Chip label={hack.published?"Published":"Draft"} color={hack.published?"green":"neutral"} />
                  <Btn variant={hack.published?"secondary":"success"} size="sm" onClick={()=>publish(!hack.published)}>{hack.published?"Unpublish":"Publish Now"}</Btn>
                </div>
              </div>
              {hack.published&&(
                <div style={{display:"flex",alignItems:"center",gap:10,background:C.bg2,borderRadius:R.sm,padding:"9px 12px"}}>
                  <span style={{...MONO,fontSize:11,color:C.text2,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pubUrl}</span>
                  <Btn size="sm" variant="blue" onClick={()=>{navigator.clipboard?.writeText(pubUrl);toast("URL copied!");}}>Copy</Btn>
                  <Btn size="sm" variant="secondary" onClick={()=>window.open(pubUrl,"_blank")}>Preview</Btn>
                </div>
              )}
            </Card>
            <div style={{display:"flex",gap:1,marginBottom:14,background:C.bg2,borderRadius:R.sm,padding:3,border:`1px solid ${C.border}`}}>
              {["overview","registrations"].map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{...FONT,flex:1,padding:"6px 12px",fontSize:12,fontWeight:500,borderRadius:R.sm,border:"none",cursor:"pointer",background:tab===t?C.bg:C.bg2,color:tab===t?C.text:C.text3,transition:"all 0.1s",textTransform:"capitalize"}}>
                  {t}{t==="registrations"&&` (${regs.length})`}
                </button>
              ))}
            </div>
            {tab==="overview"&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                <Stat label="Total Registrations" value={regs.length} />
                <Stat label="Pending" value={regs.filter(r=>r.status==="pending").length} color={C.amber} />
                <Stat label="Approved" value={regs.filter(r=>r.status==="approved").length} color={C.green} />
              </div>
            )}
            {tab==="registrations"&&(
              regs.length===0?<Empty icon="📬" title="No registrations yet" sub={hack.published?"Share the link to receive registrations.":"Publish this hackathon first."} />
                :regs.map(r=>(
                  <Card key={r.id} style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                        <Avatar name={r.name} size={36}/>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                            <span style={{...FONT,fontSize:13,fontWeight:500,color:C.text}}>{r.name}</span>
                            <Chip label={r.type} color={r.type==="judge"?"blue":"neutral"} />
                            <Chip label={r.status} color={r.status==="approved"?"green":r.status==="rejected"?"red":"amber"} />
                          </div>
                          <div style={{...FONT,fontSize:12,color:C.text3}}>{r.email}{r.org?` · ${r.org}`:""}</div>
                          {r.teamName&&<div style={{...FONT,fontSize:11,color:C.text3,marginTop:1}}>Team: {r.teamName} ({r.teamSize} members)</div>}
                          {r.message&&<div style={{...FONT,fontSize:12,color:C.text2,marginTop:5,fontStyle:"italic"}}>"{r.message}"</div>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:5,flexShrink:0}}>
                        {r.status!=="approved"&&<Btn size="sm" variant="success" onClick={()=>updateReg(r.id,"approved")}>Approve</Btn>}
                        {r.status!=="rejected"&&<Btn size="sm" variant="danger" onClick={()=>updateReg(r.id,"rejected")}>Reject</Btn>}
                        <Btn size="sm" variant="ghost" onClick={()=>delReg(r.id)}>✕</Btn>
                      </div>
                    </div>
                  </Card>
                ))
            )}
          </div>
        ):<Empty icon="🌐" title="Select a hackathon" />}
      </div>
    </div>
  );
}
