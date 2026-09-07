(()=>{
'use strict';
const esc=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cls=s=>({COLLECTING:'ok',NO_NEW_EVENT:'',WAITING_FOR_OUTCOME:'warn',STALLED:'bad',FAILED:'bad',DUPLICATE:'warn',NEW:'warn'}[s]||'warn');
const age=m=>m==null?'—':m<60?`${Math.round(m)}m`:`${(m/60).toFixed(1)}h`;
async function run(){
 let p; try{const r=await fetch('collection-audit.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(r.status);p=await r.json()}catch(e){return}
 const anchor=document.querySelector('.hero'); if(!anchor||document.getElementById('collectionAudit'))return;
 const s=document.createElement('section');s.className='card';s.id='collectionAudit';
 const counts=p.state_counts||{};
 s.innerHTML=`<div class="card-head"><div><div class="card-title">Collection Audit</div><div class="card-meta">Proof that Wavelength collectors are accumulating distinct evidence · ${esc(p.generated_at||'')}</div></div><span class="badge ${p.overall_state==='HEALTHY_COLLECTING'?'ok':'warn'}">${esc(p.overall_state)}</span></div>
 <div class="grid4" style="margin-bottom:12px"><div class="asset-stat"><span>Collectors</span><b>${p.collector_count??'—'}</b></div><div class="asset-stat"><span>Collecting</span><b>${counts.COLLECTING??0}</b></div><div class="asset-stat"><span>Waiting / no event</span><b>${(counts.WAITING_FOR_OUTCOME||0)+(counts.NO_NEW_EVENT||0)}</b></div><div class="asset-stat"><span>Problems</span><b>${(counts.STALLED||0)+(counts.FAILED||0)}</b></div></div>
 <div class="table-wrap"><table class="market-table"><thead><tr><th class="left">Collector</th><th class="left">Cadence</th><th>Records</th><th>Δ</th><th>Last unique</th><th>Status</th></tr></thead><tbody>${(p.collectors||[]).map(r=>`<tr><td class="left"><b>${esc(r.label)}</b><div class="card-meta">${esc(r.reason)}</div></td><td class="left">${esc(r.cadence)}</td><td>${r.count??0}</td><td>${r.delta_records>0?'+':''}${r.delta_records??0}</td><td>${age(r.age_minutes)}</td><td><span class="badge ${cls(r.state)}">${esc(r.state)}</span></td></tr>`).join('')}</tbody></table></div>
 <div class="card-meta" style="margin-top:10px">COLLECTING requires record growth or a genuinely different semantic fingerprint. A new timestamp alone does not count. NEW needs another audit cycle before accumulation is considered proven.</div>`;
 anchor.insertAdjacentElement('afterend',s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,250));else setTimeout(run,250);
})();
