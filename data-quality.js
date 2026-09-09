(()=>{'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),n=(v,d=2)=>v==null||!Number.isFinite(+v)?'—':(+v).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d});
async function get(u){const r=await fetch(u+(u.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error(`${r.status} ${u}`);return r.json()}
function ageHours(ts){if(!ts)return null;const t=new Date(ts).getTime(),ms=Date.now()-t;return Number.isFinite(ms)?Math.max(0,ms/3600000):null}
function stamp(d){return d?.generated_at||d?.updated_at||d?.recorded_at||d?.observed_at||d?.timestamp||null}
function tone(status){return ['FRESH','CURRENT · NO NEW EVENT'].includes(status)?'good':['STALE','DEGRADED','MISSING','CONFLICT','ERROR'].includes(status)?'bad':status==='ARCHIVAL'?'':'warn'}
function timeLabel(h){return h==null?'—':`${n(h,2)}h`}
function classify(def,data,hb,manifest,heartbeatDoc){
  if(def.retired||def.criticality==='ARCHIVAL'||def.cadence==='RETIRED_ARCHIVAL')return{status:'ARCHIVAL',basis:'Retired · excluded from health',age:ageHours(stamp(data)),actionable:false};
  const max=Number(def.max_age_minutes)||300,agingFraction=Number(manifest?.freshness_policy?.aging_fraction)||.75;
  const fileAge=ageHours(stamp(data));
  const heartbeatMax=Number(manifest?.freshness_policy?.event_driven_heartbeat_max_age_minutes)||150;
  const hbCheckAge=ageHours(hb?.checked_at);
  const hbCurrent=!!hb&&hb.available_and_parseable===true&&hbCheckAge!=null&&hbCheckAge*60<=heartbeatMax;
  if(def.freshness_basis==='HEARTBEAT_PROGRESS'){
    if(!hb)return{status:fileAge!=null&&fileAge*60<=max?'AGING':'DEGRADED',basis:'Progress heartbeat unavailable',age:fileAge,actionable:true};
    if(!hbCurrent)return{status:'DEGRADED',basis:'Progress heartbeat stale/unavailable',age:fileAge,checkAge:hbCheckAge,actionable:true};
    if(hb.progress_ok===true&&String(hb.authority_state||'').toUpperCase()==='CURRENT')return{status:'FRESH',basis:'Forward progress current',age:fileAge,checkAge:hbCheckAge,actionable:false};
    return{status:'STALE',basis:'Forward progress behind expected completed bar',age:fileAge,checkAge:hbCheckAge,actionable:true};
  }
  if(String(def.cadence||'').startsWith('EVENT_DRIVEN')){
    if(hbCurrent)return{status:'CURRENT · NO NEW EVENT',basis:'Liveness checked; no new event required',age:fileAge,checkAge:hbCheckAge,actionable:false};
  }
  if(fileAge==null)return{status:'MISSING',basis:'No trustworthy source timestamp',age:null,actionable:true};
  const expected=Number(def.expected_interval_minutes)||null;
  const soft=Math.min(max*agingFraction,expected?expected*1.5:max*agingFraction);
  const mins=fileAge*60;
  if(mins<=soft)return{status:'FRESH',basis:expected?`Within ${expected}m cadence tolerance`:'Within freshness policy',age:fileAge,actionable:false};
  if(mins<=max)return{status:'AGING',basis:`Older than preferred cadence; hard limit ${max}m`,age:fileAge,actionable:false};
  return{status:'STALE',basis:`Exceeded ${max}m freshness limit`,age:fileAge,actionable:true};
}
async function feeds(){
  const [manifest,heartbeatDoc]=await Promise.all([get('source-manifest.json'),get('source-heartbeats.json')]);
  const byHeartbeat=new Map((heartbeatDoc.sources||[]).map(x=>[x.id,x]));
  const preferred=['decision_quality','decision_quality_v3','decision_quality_v31','dynamic_universe','heartbeats','v3_forward','crowding','auto_paper','execution','bot_ops','alerts','research','radar'];
  const byId=new Map((manifest.sources||[]).map(x=>[x.id,x]));
  const defs=preferred.map(id=>byId.get(id)).filter(Boolean);
  const rows=await Promise.all(defs.map(async def=>{
    let data=null,error=null;
    try{data=def.id==='heartbeats'?heartbeatDoc:await get(def.path)}catch(e){error=e}
    if(error&&!def.retired)return{def,data:null,health:{status:'MISSING',basis:'Feed unavailable or unparsable',age:null,actionable:true},mode:'unavailable'};
    const health=classify(def,data,byHeartbeat.get(def.id),manifest,heartbeatDoc);
    return{def,data,health,mode:data?.mode||data?.status||'—'};
  }));
  $('#feedBody').innerHTML=rows.map(({def,health})=>{
    const age=health.checkAge!=null?`${timeLabel(health.age)} ${def.freshness_basis==='HEARTBEAT_PROGRESS'?'data':'event'} · ${timeLabel(health.checkAge)} check`:timeLabel(health.age);
    const cadence=[String(def.cadence||'—').replaceAll('_',' '),String(def.authority||'—').replaceAll('_',' ')].join(' · ');
    return `<tr title="${esc(health.basis)}"><td class="left"><strong>${esc(def.label||def.id)}</strong><div class="card-meta">${esc(health.basis)}</div></td><td>${esc(age)}</td><td><span class="badge ${tone(health.status)}">${esc(health.status)}</span></td><td>${esc(cadence)}</td></tr>`;
  }).join('');
  const actionable=rows.filter(r=>r.health.actionable&&r.health.status!=='ARCHIVAL').length;
  const aging=rows.filter(r=>r.health.status==='AGING').length;
  const degraded=rows.filter(r=>['STALE','DEGRADED','MISSING','CONFLICT','ERROR'].includes(r.health.status)).length;
  const badge=$('#feedBadge');
  if(actionable){badge.textContent=`${actionable} NEED ATTENTION${aging?` · ${aging} AGING`:''}`;badge.className='badge bad'}
  else if(aging){badge.textContent=`${aging} AGING · NO FAILURES`;badge.className='badge warn'}
  else{badge.textContent='CANONICAL FEEDS HEALTHY';badge.className='badge good'}
  return{actionable,aging,degraded};
}
async function prices(){
  const syms=[['BTC','bitcoin'],['ETH','ethereum'],['SOL','solana']];
  let cg=null,cgError=null;
  try{cg=await get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd')}catch(e){cgError=e}
  const out=[];
  for(const [sym,id] of syms){
    let bp=null,cp=null,binanceError=null;
    try{const b=await get(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}USDT`);bp=Number(b.price)}catch(e){binanceError=e}
    if(cg&&cg[id]&&Number.isFinite(Number(cg[id].usd)))cp=Number(cg[id].usd);
    const comparable=Number.isFinite(bp)&&Number.isFinite(cp)&&cp>0;
    const diff=comparable?100*(bp/cp-1):null;
    out.push({sym,bp:Number.isFinite(bp)?bp:null,cp:Number.isFinite(cp)?cp:null,diff,comparable,binanceError,cgError});
  }
  $('#priceMetrics').innerHTML=out.map(x=>`<div class="metric"><div class="metric-label">${x.sym} source gap</div><div class="metric-value ${x.diff!=null&&Math.abs(x.diff)>.5?'accent':x.diff!=null?'up':''}">${x.diff==null?'—':`${x.diff>=0?'+':''}${n(x.diff,3)}%`}</div><div class="card-meta">Binance ${x.bp==null?'—':'$'+n(x.bp,2)} · CG ${x.cp==null?'—':'$'+n(x.cp,2)}</div></div>`).join('');
  const compared=out.filter(x=>x.comparable);
  const unavailable=out.length-compared.length;
  const max=compared.length?Math.max(...compared.map(x=>Math.abs(x.diff))):null;
  const badge=$('#priceBadge');
  let state='UNAVAILABLE';
  if(!compared.length){badge.textContent='CHECK UNAVAILABLE';badge.className='badge warn'}
  else if(max<=0.5&&unavailable===0){state='ALIGNED';badge.textContent='SOURCES ALIGNED';badge.className='badge good'}
  else if(max<=0.5){state='PARTIAL';badge.textContent=`PARTIAL CHECK · ${compared.length}/${out.length}`;badge.className='badge warn'}
  else if(max<=1){state='GAP';badge.textContent='CHECK GAP';badge.className='badge warn'}
  else{state='CONFLICT';badge.textContent='SOURCE WARNING';badge.className='badge bad'}
  let title,body;
  if(state==='UNAVAILABLE'){
    title='Independent price cross-check unavailable';
    body='No valid Binance-versus-CoinGecko comparison was completed in this browser session. This is a provider/network availability issue, not evidence of a price discrepancy.';
  }else if(state==='PARTIAL'){
    title='Independent price cross-check partially available';
    body=`${compared.length} of ${out.length} assets were compared successfully. Missing comparisons are reported as unavailable and are not treated as discrepancies.`;
  }else if(state==='ALIGNED'){
    title='Independent spot cross-check looks normal';
    body='All requested Binance-versus-CoinGecko comparisons completed within the 0.5% alignment threshold.';
  }else{
    title='Measured source discrepancy detected';
    body=`At least one completed Binance-versus-CoinGecko comparison differs by ${n(max,3)}%. Only completed comparisons contribute to this warning.`;
  }
  $('#priceNotes').innerHTML=`<div class="context-item"><strong>${esc(title)}</strong><p>${esc(body)} Comparison is diagnostic only; no strategy candle, signal or threshold is replaced by this browser-side check.</p></div>`;
  return{state,max,compared:compared.length,total:out.length};
}
async function load(){
  try{
    $('#dqStatus').className='status-pill warn';
    const [health,price]=await Promise.all([feeds(),prices()]);
    const priceConflict=price.state==='CONFLICT';
    const priceUnavailable=price.state==='UNAVAILABLE'||price.state==='PARTIAL';
    const review=health.actionable||priceConflict;
    const monitor=!review&&(health.aging||priceUnavailable||price.state==='GAP');
    $('#dqStatus').className='status-pill '+(review?'bad':monitor?'warn':'');
    $('#dqStatus').innerHTML='<span class="dot"></span>'+(review?'REVIEW':monitor?'MONITOR':'HEALTHY');
  }catch(e){console.error(e);$('#dqStatus').className='status-pill bad';$('#dqStatus').innerHTML='<span class="dot"></span>CHECK FAILED'}
}
load();setInterval(load,60000);
})();
