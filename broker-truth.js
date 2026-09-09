(()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
async function loadBrokerTruth(){
  const box=$('#brokerTruth');
  const badge=$('#brokerTruthBadge');
  const body=$('#brokerTruthBody');
  if(!box||!badge||!body)return;
  try{
    const r=await fetch(`operator-incident-centre.json?t=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`broker truth ${r.status}`);
    const d=await r.json();
    const b=d?.broker_reconciliation||{};
    const count=Number(b.account_position_count||0);
    const symbols=Array.isArray(b.account_position_symbols)?b.account_position_symbols:[];
    const open=Boolean(b.account_has_open_positions)||count>0;
    const problems=Array.isArray(b.problems)?b.problems:[];
    const when=b.broker_snapshot_generated_at?new Date(b.broker_snapshot_generated_at).toLocaleString():'—';
    badge.textContent=open?'BROKER POSITION OPEN':'BROKER FLAT';
    badge.className='badge '+(open?'bad':'good');
    body.innerHTML=open
      ? `<div class="analysis-row"><span class="analysis-label">Alpaca broker positions</span><strong>${count}</strong></div><div class="analysis-row"><span class="analysis-label">Symbols</span><strong>${esc(symbols.join(', ')||'Unknown')}</strong></div><div class="analysis-row"><span class="analysis-label">Reconciliation</span><strong>${esc(b.state||'REVIEW')}</strong></div><div class="analysis-row"><span class="analysis-label">New Wavelength entries</span><strong>${b.new_entries_should_be_blocked?'BLOCKED':'NOT BLOCKED'}</strong></div><div class="analysis-row"><span class="analysis-label">Broker snapshot</span><strong>${esc(when)}</strong></div>${problems.length?`<div class="strategy-history"><p><strong>Manual review required:</strong> ${esc(problems.join(' · '))}</p></div>`:''}<div class="strategy-history"><p><strong>Important:</strong> the Alpaca broker account is not flat. The internal simulated paper portfolio shown below is a separate research simulation and must not be interpreted as your Alpaca balance or Alpaca position state.</p></div>`
      : `<div class="analysis-row"><span class="analysis-label">Alpaca broker positions</span><strong>0</strong></div><div class="analysis-row"><span class="analysis-label">Reconciliation</span><strong>${esc(b.state||'—')}</strong></div><div class="analysis-row"><span class="analysis-label">Broker snapshot</span><strong>${esc(when)}</strong></div><div class="strategy-history"><p>Broker reconciliation currently reports no open Alpaca positions. The simulated paper portfolio below remains a separate research account.</p></div>`;
  }catch(e){
    console.error(e);
    badge.textContent='BROKER STATUS UNAVAILABLE';
    badge.className='badge warn';
    body.innerHTML='<div class="empty">Broker truth feed unavailable. Do not infer that Alpaca is flat from the simulated paper portfolio below.</div>';
  }
}
loadBrokerTruth();
setInterval(loadBrokerTruth,60000);
})();
