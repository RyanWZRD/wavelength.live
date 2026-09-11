(()=>{
const q=s=>document.querySelector(s);
if(!q('#validationCommandGrid'))return;
const esc=v=>String(v??'—').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmt=(v,d=1)=>v==null?'—':Number(v).toFixed(d);
const badge=s=>{const x=String(s||'UNKNOWN').toUpperCase();const c=/GREEN|FRESH|READY|PASS|LONG|SHORT|HEALTHY/.test(x)?'ok':/RED|STALE|MISSING|FAIL|BLOCKED|EXPIRED/.test(x)?'bad':'warn';return `<span class="badge ${c}">${esc(x)}</span>`};
const metric=(label,value,sub='')=>`<div class="metric"><div class="metric-label">${esc(label)}</div><div class="metric-value">${value}</div>${sub?`<div class="metric-sub">${esc(sub)}</div>`:''}</div>`;
const table=(heads,rows)=>`<table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${heads.length}">No evidence yet.</td></tr>`}</tbody></table>`;
async function j(path){const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`${path} ${r.status}`);return r.json()}
(async()=>{
 const paths=['platform-health.json','ig-mt4-manual-demo-ticket.json','gold-decision.json','autonomous-live-forward-paper.json','crypto-opportunity-funnel.json','crypto-challengers-eth.json','crypto-challengers-btc.json','candidate-v3-forward-evidence.json','crowding-v2-forward-evidence.json'];
 const [health,goldTicket,goldDecision,auto,funnel,eth,btc,v3,crowding]=await Promise.all(paths.map(j));
 const t=goldTicket.ticket||{},v=goldTicket.validity||{},gd=goldDecision.latest_assessment||{};
 const dir=String(t.direction||'').toUpperCase(),hasSignal=dir==='LONG'||dir==='SHORT',ready=goldTicket.status==='PASS_MANUAL_DEMO_READY';
 const goldState=ready?'READY':hasSignal?'SIGNAL BLOCKED':'NO SIGNAL';
 const ad=auto.activity_diagnostics||{},cv3=ad.candidate_v3||{},cc=ad.crowding_v2||{};
 const closest=funnel.closest_actionable||{};
 const challengerRows=[];
 for(const d of [eth,btc])for(const [id,s] of Object.entries(d.strategies||{}))challengerRows.push([esc(d.symbol),esc(id),badge(s.position||'FLAT'),esc(s.entries??0),esc(s.completed_trades??0),`${fmt(s.realised_net_return_pct_sum,2)}%`,esc(s.last_action||'—')]);
 const wf=Object.entries(health.workflows||{});
 const feed=Object.entries(health.feeds||{});
 q('#validationCommandBadge').className=`badge ${health.overall_state==='GREEN'?'ok':health.overall_state==='RED'?'bad':'warn'}`;
 q('#validationCommandBadge').textContent=health.overall_state||'UNKNOWN';
 q('#validationCommandMeta').textContent=`Unified Gold + crypto validation · ${health.summary?.workflows_green??0}/${health.summary?.workflows_total??0} key workflows green · ${health.summary?.feeds_fresh??0}/${health.summary?.feeds_total??0} feeds fresh`;
 q('#validationCommandGrid').innerHTML=[
   metric('Gold',badge(goldState),ready?'Manual demo ticket current':hasSignal?(v.reason||'Signal not entry-ready'):'Waiting for qualifying setup'),
   metric('Candidate V3',`${fmt(cv3.readiness_pct,0)}%`,`${cv3.position||'FLAT'} · ${cv3.completed_forward_trades??0} completed`),
   metric('Crowding v2',badge(cc.position||crowding.position||'FLAT'),`${cc.completed_forward_trades??0} completed forward trades`),
   metric('Closest crypto lane',`${fmt(closest.readiness_pct,0)}%`,`${closest.label||closest.id||'—'} · ${closest.position||'FLAT'}`)
 ].join('');
 q('#goldValidationTable').innerHTML=table(['State','Direction','Quality','Confidence','Score','Action / reason'],[[badge(goldState),esc(t.direction||gd.decision||'FLAT'),esc(t.entry_quality||gd.entry_quality||'NO_ENTRY'),`${fmt(gd.confidence,1)}%`,fmt(gd.directional_score,1),esc(ready?'MANUAL DEMO ONLY':v.reason||'Wait')]]);
 q('#cryptoValidationTable').innerHTML=table(['Lane','Position','Entries','Completed','Return','Last action'],challengerRows.map(r=>[`${r[0]} · ${r[1]}`,r[2],r[3],r[4],r[5],r[6]]));
 q('#workflowHealthTable').innerHTML=table(['Workflow','State','Failure streak','Latest','Feed health'],wf.map(([id,x])=>{const f=health.feeds?.[id];return [esc(id),badge(x.state),esc(x.consecutive_completed_failures??'—'),esc(x.latest_conclusion||x.latest_status||'—'),f?badge(f.state):'—']}));
 q('#feedHealthTable').innerHTML=table(['Evidence feed','State','Age','Max age'],feed.map(([id,x])=>[esc(id),badge(x.state),x.age_hours==null?'—':`${fmt(x.age_hours,2)}h`,`${fmt(x.max_age_hours,1)}h`]));
 q('#cryptoClosestTable').innerHTML=table(['Closest lane','Readiness','Position','Entries','Completed','Missing conditions'],closest.id?[[esc(closest.label||closest.id),`${fmt(closest.readiness_pct,0)}%`,badge(closest.position),esc(closest.entries??'—'),esc(closest.completed_trades??'—'),esc((closest.missing_conditions||[]).join(', ')||'None')]]:[]);
})().catch(e=>{q('#validationCommandBadge').className='badge bad';q('#validationCommandBadge').textContent='UNAVAILABLE';q('#validationCommandMeta').textContent=`Unified validation feed unavailable: ${e.message}`});
})();
