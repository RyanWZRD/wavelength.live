(()=>{
'use strict';
const esc=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const cls=s=>({COLLECTING:'ok',NO_NEW_EVENT:'',WAITING_FOR_OUTCOME:'warn',STALLED:'bad',FAILED:'bad',DUPLICATE:'',NEW:'warn'}[s]||'warn');
const age=m=>m==null?'—':m<60?`${Math.round(m)}m`:`${(m/60).toFixed(1)}h`;
const proofLabel=s=>({PROVEN_ACCUMULATING:'PROVEN',RUNNING_NO_DISTINCT_EVENT:'RUNNING',WAITING:'WAITING',ISSUE:'ISSUE'}[s]||s||'—');
async function fetchJson(name){try{const r=await fetch(name+'?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(r.status);return await r.json()}catch{return null}}
function minutesOld(v){const t=Date.parse(v||'');return Number.isFinite(t)?(Date.now()-t)/60000:Infinity}
async function run(){
 let p=await fetchJson('collection-audit.json'),authority='PRIVATE';
 if(!p||minutesOld(p.generated_at)>110){const fallback=await fetchJson('collection-audit-continuity.json');if(fallback){p=fallback;authority='PUBLIC CONTINUITY'}}
 if(!p)return;
 const anchor=document.querySelector('.hero');if(!anchor||document.getElementById('collectionAudit'))return;
 const s=document.createElement('section');s.className='card';s.id='collectionAudit';const counts=p.state_counts||{},u=p.universe_coverage||{},uc=u.counts||{},ux=u.excluded_counts||{};
 const problem=(counts.STALLED||0)+(counts.FAILED||0),proven=p.proven_accumulating_collectors??counts.COLLECTING??0,operational=p.operational_collectors??((p.collector_count||0)-problem),conf=p.evidence_confidence_pct,raw=uc.raw_usdt_pairs??uc.raw_tradable_usdt;
 s.innerHTML=`<div class="card-head"><div><div class="card-title">Collection Audit</div><div class="card-meta">${esc(authority)} · audited proof of operation versus distinct evidence accumulation · run ${esc(p.audit_run??'—')} · ${esc(p.generated_at||'')}</div></div><span class="badge ${problem?'bad':proven?'ok':'warn'}">${esc(p.overall_state)}</span></div>
 <div class="grid4" style="margin-bottom:12px"><div class="asset-stat"><span>Operational</span><b>${operational}/${p.collector_count??'—'}</b></div><div class="asset-stat"><span>Proven accumulating</span><b>${proven}</b></div><div class="asset-stat"><span>Evidence confidence</span><b>${conf==null?'—':conf+'%'}</b></div><div class="asset-stat"><span>Actual problems</span><b>${problem}</b></div></div>
 ${uc.eligible!=null?`<div class="analysis-list" style="margin-bottom:14px"><div class="analysis-row"><span class="analysis-label">Dynamic universe coverage</span><strong>${raw??'—'} raw USDT · ${uc.eligible??'—'} eligible crypto · ${uc.liquid_research??'—'} liquid research · ${uc.deep_intelligence??'—'} deep · ${uc.active_opportunity??'—'} active</strong></div><div class="analysis-row"><span class="analysis-label">Universe exclusions</span><strong>${Object.entries(ux).map(([k,v])=>`${k.replaceAll('_',' ')} ${v}`).join(' · ')||'—'}</strong></div><div class="analysis-row"><span class="analysis-label">Universe fingerprint</span><strong>${esc(u.fingerprint||'—')}</strong></div></div>`:''}
 <div class="table-wrap"><table class="market-table"><thead><tr><th class="left">Collector</th><th class="left">Cadence</th><th>Records</th><th>Δ</th><th>Last source obs.</th><th>Proof</th><th>Status</th></tr></thead><tbody>${(p.collectors||[]).map(r=>`<tr><td class="left"><b>${esc(r.label)}</b><div class="card-meta">${esc(r.reason)}</div></td><td class="left">${esc(r.cadence)}</td><td>${r.count??0}</td><td>${r.delta_records>0?'+':''}${r.delta_records??0}</td><td>${age(r.age_minutes)}</td><td><span class="badge ${r.proof_status==='PROVEN_ACCUMULATING'?'ok':r.proof_status==='ISSUE'?'bad':'warn'}">${esc(proofLabel(r.proof_status))}</span><div class="card-meta">${r.advance_cycles??0}/${r.audit_cycles_observed??'—'} advancing cycles</div></td><td><span class="badge ${cls(r.state)}">${esc(r.state==='DUPLICATE'?'RAN / NO CHANGE':r.state)}</span></td></tr>`).join('')}</tbody></table></div>
 <div class="card-meta" style="margin-top:10px">A fresh timestamp proves a collector ran; it does not prove new evidence accumulated. If private audit evidence exceeds 110 minutes, this panel automatically switches to PUBLIC CONTINUITY so stale authority cannot masquerade as current health.</div>`;
 anchor.insertAdjacentElement('afterend',s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,250));else setTimeout(run,250);
})();
