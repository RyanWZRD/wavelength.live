(()=>{
'use strict';
if(window.__wavelengthAssetDecisionEvidence)return;window.__wavelengthAssetDecisionEvidence=true;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=s=>{const m=String(s??'').replace(/,/g,'').match(/[-+]?\d+(?:\.\d+)?/);return m?Number(m[0]):null};
const symbol=()=>String(window.WavelengthAssetSymbol||new URLSearchParams(location.search).get('symbol')||'—').toUpperCase();
let assurance=null;
function metricMap(id){const out={};$$('.metric-row',$(id)||document.createElement('div')).forEach(row=>{const k=$('small',row)?.textContent?.trim();const v=$('b',row)?.textContent?.trim();if(k)out[k.toLowerCase()]=v||''});return out}
function hasResolved(id){const el=$(id);if(!el)return false;const t=el.textContent||'';return !/loading|calculating|unavailable|rate-limited/i.test(t)&&t.trim().length>4}
function item(title,copy,kind=''){return `<div class="context-item"><strong class="${kind}">${esc(title)}</strong><p>${esc(copy)}</p></div>`}
function row(label,value,kind=''){return `<div class="analysis-row"><span class="analysis-label">${esc(label)}</span><strong class="${kind}">${esc(value)}</strong></div>`}
function ensurePanel(){
 if($('#decisionEvidence'))return;
 const anchor=$('#wavelengthReadCard')||$('#priceChart')?.closest('section.card');if(!anchor)return;
 const s=document.createElement('section');s.className='card';s.id='decisionEvidence';
 s.innerHTML=`<div class="card-head"><div><div class="card-title">Decision Evidence + Assurance</div><div class="card-meta" id="decisionEvidenceMeta">Independent synthesis of the evidence already shown on this workstation · research only</div></div><span class="badge warn" id="decisionEvidenceBadge">ASSESSING</span></div>
 <div class="grid4" id="decisionEvidenceKpis"><div class="empty">Waiting for market evidence…</div></div>
 <div class="grid2" style="margin-top:14px"><div><div class="card-title" style="font-size:14px">Supporting evidence</div><div class="context-list" id="decisionEvidenceSupport"><div class="empty">Waiting…</div></div></div><div><div class="card-title" style="font-size:14px">Contradictions / missing evidence</div><div class="context-list" id="decisionEvidenceRisks"><div class="empty">Waiting…</div></div></div></div>
 <div class="analysis-list" id="decisionEvidenceBoundary" style="margin-top:14px"></div>
 <div id="decisionAssuranceRoom" style="margin-top:18px;border-top:1px solid var(--border,#283044);padding-top:16px"><div class="card-head"><div><div class="card-title">Coin Intelligence Room</div><div class="card-meta">Source quality · counterfactuals · calibration · lifecycle · evidence value</div></div><span class="badge warn" id="assuranceGrade">LOADING</span></div><div class="grid4" id="assuranceKpis"><div class="empty">Decision Assurance feed will appear after the next consolidated research cycle.</div></div><div class="grid2" style="margin-top:14px"><div><div class="card-title" style="font-size:14px">Why this evidence is trusted</div><div class="context-list" id="assurancePositive"></div></div><div><div class="card-title" style="font-size:14px">Fragility / what changes the view</div><div class="context-list" id="assuranceFragility"></div></div></div><div class="grid2" style="margin-top:14px"><div><div class="card-title" style="font-size:14px">Counterfactual</div><div class="analysis-list" id="assuranceCounterfactual"></div></div><div><div class="card-title" style="font-size:14px">Calibration & evidence value</div><div class="analysis-list" id="assuranceCalibration"></div></div></div><div style="margin-top:14px"><div class="card-title" style="font-size:14px">Research lifecycle</div><div class="analysis-list" id="assuranceLifecycle"></div></div></div>`;
 anchor.insertAdjacentElement('afterend',s)
}
function renderLocal(){
 ensurePanel();if(!$('#decisionEvidence'))return;
 const tech=metricMap('#technicalMetrics'),der=metricMap('#derivativeMetrics'),fund=metricMap('#fundamentalMetrics');
 const support=[],risk=[],missing=[];let score=50,observed=0,total=8;
 const trend=tech.trend||'';if(trend){observed++;if(/bull/i.test(trend)){score+=12;support.push(['Trend structure',`${trend} structure on the selected timeframe.`])}else if(/bear/i.test(trend)){score-=14;risk.push(['Trend structure',`${trend} structure is a material contradiction.`])}else risk.push(['Trend structure','Trend is mixed rather than cleanly aligned.'])}else missing.push('trend structure');
 const rsi=num(tech.rsi);if(rsi!=null){observed++;if(rsi>=50&&rsi<=75){score+=8;support.push(['Momentum',`RSI ${rsi.toFixed(1)} is inside Wavelength’s preferred trend zone.`])}else if(rsi>80||rsi<35){score-=7;risk.push(['Momentum',`RSI ${rsi.toFixed(1)} is outside the preferred zone and may indicate extension or weakness.`])}else risk.push(['Momentum',`RSI ${rsi.toFixed(1)} is not in the preferred 50–75 trend zone.`])}else missing.push('RSI');
 const adx=num(tech.adx);if(adx!=null){observed++;if(adx>=30){score+=9;support.push(['Trend strength',`ADX ${adx.toFixed(1)} indicates meaningful trend strength.`])}else if(adx<20){score-=7;risk.push(['Trend strength',`ADX ${adx.toFixed(1)} indicates weak trend strength.`])}else risk.push(['Trend strength',`ADX ${adx.toFixed(1)} is developing but not strong.`])}else missing.push('ADX');
 const vr=num(tech['volume ratio']);if(vr!=null){observed++;if(vr>=1.2){score+=7;support.push(['Participation',`Recent volume is ${vr.toFixed(2)}× its baseline.`])}else if(vr<0.75){score-=4;risk.push(['Participation',`Volume is only ${vr.toFixed(2)}× baseline, so participation is weak.`])}else support.push(['Participation',`Volume is near its recent baseline at ${vr.toFixed(2)}×.`])}else missing.push('volume confirmation');
 const crowd=(der['crowding read']||'').trim(),funding=num(der.funding);if(crowd||funding!=null){observed++;if(/crowded/i.test(crowd)){score-=8;risk.push(['Derivatives crowding',`${crowd}${funding!=null?` · funding ${funding.toFixed(3)}%`:''}.`])}else{score+=4;support.push(['Derivatives positioning',`${crowd||'Funding context available'}${funding!=null?` · funding ${funding.toFixed(3)}%`:''}.`])}}else missing.push('derivatives positioning');
 const rank=num(fund['market-cap rank']);if(rank!=null){observed++;if(rank<=20){score+=6;support.push(['Market depth proxy',`Market-cap rank #${Math.round(rank)} supports established liquidity/coverage.`])}else if(rank<=100){score+=3;support.push(['Market depth proxy',`Market-cap rank #${Math.round(rank)} provides usable market context.`])}else{score-=3;risk.push(['Market depth proxy',`Market-cap rank #${Math.round(rank)} implies a thinner, less established asset.`])}}else missing.push('market-cap rank');
 const feed=$('#assetFeed')?.textContent?.trim()||'';if(feed){observed++;if(/LIVE STREAM/i.test(feed)){score+=7;support.push(['Data freshness','Live streaming price/candle feed is connected.'])}else if(/^LIVE$/i.test(feed)){score+=4;support.push(['Data freshness','Live market data is available.'])}else{score-=5;risk.push(['Data freshness',`Feed state is ${feed}; current evidence may be degraded.`])}}else missing.push('feed freshness');
 if(hasResolved('#assetMemory')){observed++;score+=3;support.push(['Historical context','Market Memory / analogue evidence is available for comparison.'])}else missing.push('historical analogue context');
 score=Math.round(clamp(score,0,100));const completeness=Math.round(observed/total*100),confidence=completeness>=88?'HIGH':completeness>=63?'MEDIUM':'LOW';
 let label='MIXED EVIDENCE',badge='warn';if(score>=75){label='STRONG RESEARCH CANDIDATE';badge='good'}else if(score>=60){label='RESEARCH CANDIDATE';badge='good'}else if(score<40){label='WEAK / CONTRADICTED';badge='bad'};
 if(missing.length)risk.push(['Missing evidence',missing.join(', ')+'.']);
 $('#decisionEvidenceBadge').textContent=label;$('#decisionEvidenceBadge').className=`badge ${badge}`;
 $('#decisionEvidenceMeta').textContent=`${symbol()} · live workstation synthesis + frozen Decision Assurance · no order or strategy authority`;
 $('#decisionEvidenceKpis').innerHTML=[['Evidence strength',`${score}/100`,score>=60?'up':score<40?'down':'neutral'],['Completeness',`${completeness}%`,confidence==='HIGH'?'up':'neutral'],['Supporting',String(support.length),'up'],['Contradicting / missing',String(risk.length),risk.length?'accent':'']].map(x=>`<div class="metric"><div class="metric-label">${x[0]}</div><div class="metric-value ${x[2]}">${x[1]}</div></div>`).join('');
 $('#decisionEvidenceSupport').innerHTML=support.length?support.map(x=>item(x[0],x[1],'up')).join(''):'<div class="empty">No strong supporting evidence is resolved yet.</div>';
 $('#decisionEvidenceRisks').innerHTML=risk.length?risk.map(x=>item(x[0],x[1],'accent')).join(''):'<div class="empty">No material contradictions currently resolved.</div>';
 $('#decisionEvidenceBoundary').innerHTML=row('Live evidence completeness',`${completeness}% (${observed}/${total} dimensions)`)+row('Interpretation',label)+row('Trading permission','NONE · RESEARCH PRIORITISATION ONLY','accent')+row('Invalidation','Reassess if trend, ADX, RSI, participation, crowding or feed quality materially deteriorates.');
 renderAssurance();
}
function renderAssurance(){
 if(!assurance)return;
 const asset=(assurance.assets||[]).find(a=>String(a.symbol||'').toUpperCase()===symbol());
 const cal=assurance.calibration||{}, abl=assurance.ablation||{};
 if(!asset){$('#assuranceGrade').textContent='NO ASSET ROW';return}
 const conf=asset.evidence_confidence||{}, counts=conf.counts||{};
 $('#assuranceGrade').textContent=`${conf.grade||'—'} ${conf.provisional?'PROVISIONAL':'ASSURED'}`;$('#assuranceGrade').className=`badge ${Number(conf.score)>=70?'good':Number(conf.score)<55?'bad':'warn'}`;
 $('#assuranceKpis').innerHTML=[['Evidence confidence',`${conf.score??'—'}/100`],['Direct / proxy',`${counts.direct||0} / ${counts.proxy||0}`],['Independent providers',String(conf.independent_provider_count||0)],['Exact 24h calibration',String(cal.resolved_24h||0)]].map(x=>`<div class="metric"><div class="metric-label">${esc(x[0])}</div><div class="metric-value">${esc(x[1])}</div></div>`).join('');
 const pos=(asset.decision_decomposition?.positive||[]);$('#assurancePositive').innerHTML=pos.length?pos.map(x=>item(x.dimension,`${x.semantic_class} · ${x.freshness} · ${x.provider||'provider unavailable'} · quality ${x.quality_score}/100`,'up')).join(''):'<div class="empty">No assurance evidence resolved.</div>';
 const neg=(asset.decision_decomposition?.negative_or_fragile||[]),changes=(asset.decision_decomposition?.what_would_change_the_decision||[]);$('#assuranceFragility').innerHTML=(neg.map(x=>item(x.dimension,`${x.semantic_class} · ${x.freshness} · quality ${x.quality_score}/100`,'accent')).join('')+changes.slice(0,3).map((x,i)=>item(`Change trigger ${i+1}`,x,'accent')).join(''))||'<div class="empty">No material fragility resolved.</div>';
 const cf=asset.counterfactual||{};$('#assuranceCounterfactual').innerHTML=row('Bull case',cf.bull_case||'—')+row('Base case',cf.base_case||'—')+row('Bear case',cf.bear_case||'—')+row('Thesis invalidation',cf.thesis_invalidation||'—','accent');
 const monotonic=cal.monotonic_higher_score_better===true?'YES':cal.monotonic_higher_score_better===false?'NO':'NOT YET ASSESSED';$('#assuranceCalibration').innerHTML=row('Calibration status',cal.status||'UNAVAILABLE')+row('Resolved exact 24h',String(cal.resolved_24h||0))+row('Higher score reliably better?',monotonic)+row('Probability language',cal.probability_language_allowed?'CALIBRATED':'BLOCKED UNTIL GATES PASS','accent')+row('Ablation readiness',`${abl.status||'UNAVAILABLE'} · ${abl.matched_24h_outcomes_available||0}/${abl.minimum_recommended_matched_outcomes||150} matched outcomes`)+row('Incremental values fabricated?','NO');
 const life=(assurance.lifecycle||[]).filter(x=>/v3|crowding/i.test(`${x.strategy_id} ${x.name}`));$('#assuranceLifecycle').innerHTML=life.length?life.slice(0,4).map(x=>row(x.name||x.strategy_id,`${x.stage} · ${x.completed_forward_trades||0} completed forward trades · next: ${x.next_gate}`)).join(''):row('Lifecycle','Waiting for strategy lifecycle feed');
}
async function loadAssurance(){
 try{const r=await fetch(`decision-assurance-v1.json?ts=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);assurance=await r.json();renderAssurance()}catch(e){const g=$('#assuranceGrade');if(g){g.textContent='AWAITING DAILY FEED';g.className='badge warn'}}
}
let timer=null;function schedule(){clearTimeout(timer);timer=setTimeout(renderLocal,250)}
function start(){ensurePanel();['#technicalMetrics','#derivativeMetrics','#fundamentalMetrics','#assetFeed','#assetMemory','#marketStats'].forEach(sel=>{const el=$(sel);if(el)new MutationObserver(schedule).observe(el,{childList:true,subtree:true,characterData:true,attributes:true})});renderLocal();loadAssurance()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
