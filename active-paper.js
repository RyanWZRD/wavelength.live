(()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
function row(label,value){return `<div class="analysis-row"><span class="analysis-label">${esc(label)}</span><strong>${esc(value)}</strong></div>`}
function relabelLegacyRule(){
  const rules=$('#rules'); if(!rules)return;
  [...rules.querySelectorAll('.analysis-row')].forEach(r=>{
    const l=r.querySelector('.analysis-label'),v=r.querySelector('strong');
    if(l&&l.textContent.trim()==='Daily trade quota'){
      l.textContent='Legacy forced daily trade';
      if(v)v.textContent='OFF · retired lane does not create new entries';
    }
  });
}
async function loadActivePaper(){
  const badge=$('#activePaperBadge'),body=$('#activePaperBody'),state=$('#activeEngineState'),meta=$('#activeEngineMeta');
  if(!badge||!body)return;
  try{
    const r=await fetch(`automatic-paper-status.json?t=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`active paper ${r.status}`);
    const d=await r.json();
    const enabled=d.automatic_paper_orders_enabled===true;
    const live=d.live_money_enabled===true;
    const safetyBlocked=d.entry_safety_switch?.blocked===true;
    const gateBlocked=d.graduation_gate?.blocked===true;
    const operational=enabled&&!live&&!safetyBlocked&&!gateBlocked;
    const signal=d.signal_action||'—',result=d.result||'—',reason=d.reason||'—';
    badge.textContent=operational?'PAPER READY':'PAPER BLOCKED';
    badge.className='badge '+(operational?'good':'bad');
    if(state)state.textContent=operational?'READY':'BLOCKED';
    if(meta)meta.textContent=`Candidate V3 · ${d.execution_phase||'—'} · Alpaca PAPER only`;
    const when=d.generated_at?new Date(d.generated_at).toLocaleString():'—';
    body.innerHTML=[
      row('PAPER order capability',enabled?'ENABLED':'DISABLED'),
      row('Live money','DISABLED'),
      row('Execution phase',d.execution_phase||'—'),
      row('Entry safety switch',safetyBlocked?'BLOCKED':(d.entry_safety_switch?.reason||'CLEAR')),
      row('Graduation / rehearsal gate',gateBlocked?'BLOCKED':(d.graduation_gate?.reason||'CLEAR')),
      row('Latest signal',signal),
      row('Latest execution result',result),
      row('Latest reason',reason),
      row('Last evaluated',when),
      row('Forced daily trade requirement','OFF · trades occur only on a qualifying signal')
    ].join('')+`<div class="strategy-history"><p><strong>${signal==='NO_SIGNAL'?'Why no trade?':'Latest decision:'}</strong> ${esc(reason)}. A flat result is valid when Candidate V3 has no entry signal; this is different from the executor being disabled.</p></div>`;
  }catch(e){
    console.error(e);
    badge.textContent='PAPER STATUS UNAVAILABLE';badge.className='badge warn';
    if(state)state.textContent='UNKNOWN';
    body.innerHTML='<div class="empty">Active PAPER status feed unavailable. Do not infer that trading is disabled from the retired legacy simulation below.</div>';
  }
  relabelLegacyRule();
}
loadActivePaper();
setInterval(loadActivePaper,60000);
setInterval(relabelLegacyRule,1000);
})();
