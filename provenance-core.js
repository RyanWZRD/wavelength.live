(()=>{'use strict';
const GENERATED_KEYS=['generated_at','updated_at'];
const OBSERVED_KEYS=['observed_at','recorded_at','as_of','timestamp'];
const get=(o,p)=>String(p||'').split('.').reduce((v,k)=>v==null?null:v[k],o);
const validTs=v=>v&&Number.isFinite(Date.parse(v));
const firstTs=(o,paths,keys)=>{for(const p of paths||[]){const v=get(o,p);if(validTs(v))return v}for(const k of keys){const v=o?.[k];if(validTs(v))return v}return null};
const ageMin=(ts,now)=>validTs(ts)?Math.max(0,(now-Date.parse(ts))/60000):null;
const truthyConflict=d=>{
 const direct=['conflict','data_conflict','source_conflict','source_disagreement','evidence_conflict'];
 for(const k of direct){const v=d?.[k];if(v===true||String(v||'').toUpperCase()==='CONFLICT')return `${k} reported`}
 const states=['state','status','data_state','evidence_state','consensus_state'];
 for(const k of states){if(/CONFLICT|DISAGREE/i.test(String(d?.[k]||'')))return `${k}: ${d[k]}`}
 return null;
};
function directState(s,d,now){
 const generated=firstTs(d,s.generated_at_paths,GENERATED_KEYS);
 const observed=firstTs(d,s.observed_at_paths,OBSERVED_KEYS);
 const basis=observed||generated;
 const age=ageMin(basis,now),max=Math.max(1,Number(s.max_age_minutes||0)),agingAt=max*0.75;
 const conflict=truthyConflict(d);
 let state=conflict?'CONFLICT':age==null?'MISSING':age>max?'STALE':age>=agingAt?'AGING':'FRESH';
 return {generated_at:generated,observed_at:observed,effective_timestamp:basis,age_minutes:age,direct_state:state,conflict_reason:conflict};
}
async function inspect(){
 const m=await fetch(`source-manifest.json?t=${Date.now()}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()});
 const now=Date.now(),defs=m.sources||[],payloads={},rows={};
 await Promise.all(defs.map(async s=>{try{const r=await fetch(`${s.path}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error(r.status);payloads[s.id]=await r.json();rows[s.id]={...s,available:true,...directState(s,payloads[s.id],now)}}catch(e){rows[s.id]={...s,available:false,generated_at:null,observed_at:null,effective_timestamp:null,age_minutes:null,direct_state:'MISSING',conflict_reason:null,error:String(e)}}}));
 const resolving=new Set();
 function resolve(id){
  const r=rows[id];if(!r)return null;if(r.effective_state)return r;if(resolving.has(id)){r.effective_state='CONFLICT';r.reasons=['Dependency cycle detected'];return r}
  resolving.add(id);const deps=(r.dependencies||[]).map(resolve).filter(Boolean);const reasons=[];
  let state=r.direct_state;
  for(const d of deps){
   if(d.effective_state==='CONFLICT'){state='CONFLICT';reasons.push(`Upstream ${d.label}: CONFLICT`)}
   else if(d.effective_state==='MISSING'){if(state!=='CONFLICT')state='DEGRADED';reasons.push(`Upstream ${d.label}: MISSING`)}
   else if(['STALE','DEGRADED'].includes(d.effective_state)){if(!['CONFLICT','MISSING','STALE'].includes(state))state='DEGRADED';reasons.push(`Upstream ${d.label}: ${d.effective_state}`)}
   else if(d.effective_state==='AGING'&&state==='FRESH'){state='AGING';reasons.push(`Upstream ${d.label}: AGING`)}
  }
  if(r.direct_state==='STALE')state='STALE';if(r.direct_state==='MISSING')state='MISSING';if(r.direct_state==='CONFLICT')state='CONFLICT';
  if(r.direct_state==='STALE')reasons.unshift(`Own evidence age exceeds ${r.max_age_minutes}m limit`);
  if(r.direct_state==='AGING')reasons.unshift(`Own evidence is approaching ${r.max_age_minutes}m limit`);
  if(r.conflict_reason)reasons.unshift(r.conflict_reason);
  r.effective_state=state;r.fresh=state==='FRESH';r.reasons=reasons;r.upstreams=deps.map(d=>({id:d.id,label:d.label,state:d.effective_state,age_minutes:d.age_minutes,path:d.path}));resolving.delete(id);return r;
 }
 defs.forEach(s=>resolve(s.id));
 function lineage(id,seen=new Set()){if(seen.has(id)||!rows[id])return[];seen.add(id);const r=rows[id];return [{id:r.id,label:r.label,path:r.path,state:r.effective_state,generated_at:r.generated_at,observed_at:r.observed_at,age_minutes:r.age_minutes},...(r.dependencies||[]).flatMap(d=>lineage(d,seen))]}
 const out=defs.map(s=>({...rows[s.id],lineage:lineage(s.id)}));return {manifest:m,rows:out,checked_at:new Date(now).toISOString()};
}
function status(rows){if(!rows.length)return'UNKNOWN';const states=rows.map(x=>x.effective_state);if(states.includes('CONFLICT'))return'CONFLICT';if(states.includes('MISSING'))return'MISSING DATA';if(states.includes('STALE'))return'STALE DATA';if(states.includes('DEGRADED'))return'DEGRADED';if(states.includes('AGING'))return'AGING DATA';return'FRESH'}
async function badge(){const top=document.querySelector('.topbar');if(!top||document.querySelector('#wlProvenanceBadge'))return;const a=document.createElement('a');a.id='wlProvenanceBadge';a.href='provenance.html';a.className='status-pill warn';a.innerHTML='<span class="dot"></span>DATA CHECK';top.appendChild(a);try{const x=await inspect(),s=status(x.rows),affected=x.rows.filter(r=>r.effective_state!=='FRESH');a.className=`status-pill ${s==='FRESH'?'':['AGING DATA','STALE DATA','DEGRADED'].includes(s)?'warn':'bad'}`;a.innerHTML=`<span class="dot"></span>${s}`;a.title=s==='FRESH'?'All declared evidence and upstream dependencies are fresh':`${affected.length} source(s) affected · click for transitive provenance`;}catch(e){a.className='status-pill bad';a.innerHTML='<span class="dot"></span>SOURCE UNKNOWN'}}
window.WavelengthProvenance={inspect,status};if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',badge);else badge();})();
