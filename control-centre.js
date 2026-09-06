(()=>{
const q=s=>document.querySelector(s), esc=v=>String(v??'—').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pct=v=>v==null?'—':`${Number(v).toFixed(2)}%`; const num=v=>v==null?'—':Number(v).toFixed(2);
const badge=(s)=>{const x=String(s||'UNKNOWN').toUpperCase();const c=/PASS|FRESH|READY|VALIDATED|OK|BROAD|BULLISH|HEALTHY|ARMED/.test(x)?'ok':/FAIL|STALE|MISSING|ERROR|HARD|ATTENTION|DEGRADED|ACTION_REQUIRED/.test(x)?'bad':'warn';return `<span class="badge ${c}">${esc(x)}</span>`};
const table=(heads,rows)=>`<table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${heads.length}">No evidence yet.</td></tr>`}</tbody></table>`;
const metric=(label,value,sub='')=>`<div class="metric"><div class="metric-label">${esc(label)}</div><div class="metric-value">${value}</div>${sub?`<div class="metric-sub">${esc(sub)}</div>`:''}</div>`;
async function j(path){const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`${path} ${r.status}`);return r.json()}
const specs={
 validation:{path:'validation.json',max:5},
 graduation:{path:'paper-graduation.json',max:2},
 analytics:{path:'outcome-analytics.json',max:6},
 history:{path:'intelligence-history.json',max:6},
 challenger:{path:'strategy-challenger-results.json',max:48},
 risk:{path:'institutional-risk-stress.json',max:48},
 alerts:{path:'wavelength-alerts.json',max:2}
};
function tsOf(x){return x?.generated_at||x?.updated_at||null}
function freshness(name,x,max){const t=tsOf(x);if(!t)return {name,state:'MISSING_TIMESTAMP',age:null,max};const age=(Date.now()-Date.parse(t))/36e5;return {name,state:age>max?'STALE':age>max*.75?'AGING':'FRESH',age,max}}
function shortTime(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString()}
(async()=>{
 const data={},opAlarms=[],researchNotices=[];
 await Promise.all(Object.entries(specs).map(async([k,s])=>{try{data[k]=await j(s.path)}catch(e){opAlarms.push({sev:'MISSING',source:k,msg:e.message})}}));
 const fresh=Object.entries(specs).filter(([k])=>data[k]).map(([k,s])=>freshness(k,data[k],s.max));
 fresh.filter(f=>f.state!=='FRESH').forEach(f=>opAlarms.push({sev:f.state,source:f.name,msg:f.age==null?'No generated timestamp':`Age ${f.age.toFixed(1)}h; operational maximum ${f.max}h`}));
 const g=data.graduation;
 if(g?.portfolio_paper_risk_gate?.simultaneous_new_entries_allowed===false)researchNotices.push({sev:'BLOCK',source:'portfolio',msg:`Expected evidence gate: ${g.portfolio_paper_risk_gate.state}`});
 (g?.strategies||[]).forEach(s=>(s.hard_blockers||[]).forEach(b=>researchNotices.push({sev:'BLOCK',source:s.strategy_id,msg:b})));
 const c=data.challenger;
 (c?.strategies||[]).forEach(s=>{if(s.status!=='PASS')researchNotices.push({sev:s.status||'WARN',source:s.strategy_id,msg:'Strategy challenger not fully passed'});const d=(s.tests||[]).find(t=>t.test==='EXECUTION_DELAY');if(s.strategy_id==='crowding_v2'&&d?.metric?.ex_best_return_pct<0)researchNotices.push({sev:'THIN',source:'crowding_v2',msg:`Exact-delay ex-best return ${pct(d.metric.ex_best_return_pct)}`})});
 const alertFeed=data.alerts||{};
 (alertFeed.input_errors||[]).forEach(e=>opAlarms.push({sev:'ERROR',source:'alerts',msg:e}));
 const critical=opAlarms.some(a=>/STALE|MISSING|FAIL|ERROR/.test(a.sev)), aging=opAlarms.some(a=>a.sev==='AGING');
 const state=critical?'ATTENTION REQUIRED':aging?'MONITOR':'HEALTHY';
 q('#ccStatus').className=`status-pill ${critical?'bad':aging?'warn':'ok'}`;q('#ccStatus').innerHTML=`<span class="dot"></span>${state}`;
 const allFresh=fresh.length===Object.keys(specs).length&&fresh.every(f=>f.state==='FRESH');q('#healthBadge').className=`badge ${allFresh?'ok':'warn'}`;q('#healthBadge').textContent=allFresh?'ALL OPERATIONAL FEEDS FRESH':'CHECK PIPELINE';q('#healthMeta').textContent=`${fresh.filter(f=>f.state==='FRESH').length}/${Object.keys(specs).length} operational feeds fresh · ${opAlarms.length} pipeline alert(s) · ${researchNotices.length} evidence notice(s)`;
 q('#healthGrid').innerHTML=[metric('Operational feeds',`${fresh.filter(f=>f.state==='FRESH').length}/${Object.keys(specs).length}`,'fresh'),metric('Pipeline alerts',String(opAlarms.length),'actionable'),metric('Hypothesis sample',String(data.analytics?.hypothesis_eligible_event_count??0),'canonical V1'),metric('Market context',`${num(data.analytics?.market_context_coverage?.coverage_pct)}%`,'canonical coverage')].join('');
 const notices=[...opAlarms.map(a=>({...a,type:'PIPELINE'})),...researchNotices.map(a=>({...a,type:'EVIDENCE'}))];q('#alarmTable').innerHTML=table(['Type','Severity','Source','Reason'],notices.map(a=>[badge(a.type),badge(a.sev),esc(a.source),esc(a.msg)]));

 const alerts=alertFeed.latest_alerts||[];const actionCount=alerts.filter(a=>a.severity==='ACTION_REQUIRED').length;const materialCount=alerts.filter(a=>a.severity==='MATERIAL').length;
 q('#alertBadge').className=`badge ${alertFeed.engine_state==='ARMED'?'ok':'bad'}`;q('#alertBadge').textContent=alertFeed.engine_state||'UNKNOWN';
 q('#alertMeta').textContent=`Consolidated signal, Crowding and gate monitoring · delivery ${alertFeed.delivery?.channel||'UNKNOWN'} · ${alerts.length} retained recent alert(s)`;
 q('#alertGrid').innerHTML=[metric('Engine',badge(alertFeed.engine_state||'UNKNOWN'),'hourly at :12'),metric('Delivery',badge(alertFeed.delivery?.channel||'UNKNOWN'),'material events only'),metric('Action required',String(actionCount),'recent retained'),metric('Material',String(materialCount),'recent retained')].join('');
 q('#alertHistory').innerHTML=table(['When','Severity','Kind','Subject','Alert'],alerts.map(a=>[esc(shortTime(a.created_at)),badge(a.severity),esc(a.kind),esc(a.subject),`<strong>${esc(a.title)}</strong><div class="card-meta">${esc(a.message)}</div>`]));

 const vs=data.validation?.strategies||{};q('#strategyTable').innerHTML=table(['Strategy','Position','Days','Trades','Return','PF','Status','Still unmet'],Object.values(vs).map(s=>[esc(s.name),esc(s.position),num(s.observation_days),esc(s.completed_trades),pct(s.return_pct),num(s.profit_factor),badge(s.status),esc((s.unmet_gates||[]).join(', '))]));
 q('#graduationTable').innerHTML=table(['Strategy','Lifecycle','Forward','PAPER entry','Blockers'],(g?.strategies||[]).map(s=>[esc(s.strategy_id),badge(s.lifecycle_state),`${num(s.forward?.days_observed)}d / ${esc(s.forward?.completed_trades)} trades`,badge(s.new_paper_entries_allowed?'ALLOWED':'BLOCKED'),esc((s.blockers||[]).join(', '))]));
 const mc=data.history?.market_context?.slice(-1)[0]||{};q('#regimeGrid').innerHTML=[metric('Market regime',badge(mc.market_regime||'UNKNOWN')),metric('BTC trend',badge(mc.btc_trend||'UNKNOWN')),metric('BTC volatility',badge(mc.btc_volatility_regime||'UNKNOWN')),metric('Bullish breadth',pct(mc.bullish_breadth_pct),`${esc(mc.universe_n||0)} symbols`)].join('');
 const pr=g?.portfolio_paper_risk_gate||data.risk?.shadow_candidate_research||{};q('#riskGrid').innerHTML=[metric('Co-admission',badge(pr.state||pr.admission_state||'UNKNOWN')),metric('Stress',pct(pr.simultaneous_drawdown_stress_pct)),metric('Warning',pct(pr.warning_threshold_pct)),metric('Hard',pct(pr.hard_threshold_pct))].join('');
 const hs=data.analytics?.hypotheses||[];q('#hypothesisTable').innerHTML=table(['Hypothesis','Status','Discovery N','Fresh requirement','Why it exists'],hs.map(h=>[esc(h.hypothesis_id||`${h.dimension}:${h.value}`),badge(h.status),esc(h.discovery_sample_n??h.segment?.n??'—'),esc(h.minimum_fresh_matching_events??15),esc(h.statement||'Discovery candidate awaiting forward falsification')]));
})().catch(e=>{q('#ccStatus').className='status-pill bad';q('#ccStatus').innerHTML='<span class="dot"></span>ATTENTION REQUIRED';q('#healthMeta').textContent=e.message});
})();