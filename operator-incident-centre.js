(()=>{
const q=s=>document.querySelector(s);
const esc=v=>String(v??'—').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const badge=s=>{const x=String(s||'UNKNOWN').toUpperCase();const c=/GREEN|PASS|FRESH|RECONCILED|MATCH/.test(x)?'ok':/RED|FAIL|MISMATCH|MISSING|STALE/.test(x)?'bad':'warn';return `<span class="badge ${c}">${esc(x)}</span>`};
const metric=(label,value,sub='')=>`<div class="metric"><div class="metric-label">${esc(label)}</div><div class="metric-value">${value}</div>${sub?`<div class="metric-sub">${esc(sub)}</div>`:''}</div>`;
const table=(heads,rows)=>`<table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${heads.length}">No operational incidents.</td></tr>`}</tbody></table>`;
async function load(){
 const r=await fetch(`operator-incident-centre.json?v=${Date.now()}`,{cache:'no-store'});
 if(!r.ok)throw new Error(`operator-incident-centre.json ${r.status}`);
 return r.json();
}
(async()=>{
 const p=await load();
 const overall=String(p.overall_state||'UNKNOWN').toUpperCase();
 const cls=overall==='GREEN'?'ok':overall==='RED'?'bad':'warn';
 q('#operatorBadge').className=`badge ${cls}`;q('#operatorBadge').textContent=overall;
 q('#operatorMeta').textContent=`Read-only operational controls · generated ${new Date(p.generated_at).toLocaleString()} · no execution authority`;
 const b=p.baseline_drift||{},e=p.evidence_integrity||{},r=p.broker_reconciliation||{},o=p.existing_operations||{};
 q('#operatorGrid').innerHTML=[
  metric('Baseline drift',badge(b.state||'UNKNOWN'),`${(b.changed_critical_files||[]).length} critical change(s)`),
  metric('Evidence vault',badge(e.state||'UNKNOWN'),`${e.failure_count??0} integrity failure(s)`),
  metric('Broker truth',badge(r.state||'UNKNOWN'),r.new_entries_should_be_blocked?'mismatch advisory':'runtime agrees'),
  metric('Open incidents',String(o.unacknowledged_incidents??0),`circuit ${o.circuit_breaker||'UNKNOWN'}`)
 ].join('');
 q('#operatorComponentTable').innerHTML=table(['Component','State','Detail'],(p.components||[]).map(x=>[esc(x.component),badge(x.state),esc(x.detail)]));
 q('#operatorActionTable').innerHTML=table(['Actionable item'],(p.actionable_items||[]).map(x=>[esc(x)]));
 q('#baselineDriftTable').innerHTML=table(['Critical file','State','Baseline hash','Current hash'],(b.file_checks||[]).map(x=>[esc(x.path),badge(x.state),`<code>${esc((x.baseline_sha256||'').slice(0,12))}</code>`,`<code>${esc((x.current_sha256||'').slice(0,12))}</code>`]));
 const probs=r.problems||[];
 q('#brokerTruthTable').innerHTML=table(['Broker/runtime field','Value'],[
  ['Position qty',esc(r.position_qty)],['Runtime qty',esc(r.runtime_position_qty)],['Open ETH orders',esc(r.open_eth_order_count)],['Protective stops',esc(r.protective_stop_count)],['Stop remaining qty',esc(r.protective_stop_remaining_qty)],['Runtime stop',esc(r.runtime_stop_price)],['Guardian',badge(r.guardian_status)],['Problems',esc(probs.join(', ')||'None')]
 ]);
})().catch(err=>{
 q('#operatorBadge').className='badge bad';q('#operatorBadge').textContent='UNAVAILABLE';q('#operatorMeta').textContent=`Operational controls feed unavailable: ${err.message}`;
});
})();