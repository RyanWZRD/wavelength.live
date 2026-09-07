(()=>{
'use strict';
if(window.__wavelengthDecisionScienceV2)return;window.__wavelengthDecisionScienceV2=true;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pct=v=>v==null||!Number.isFinite(+v)?'—':`${+v>=0?'+':''}${(+v).toFixed(2)}%`;
const store=()=>{try{return JSON.parse(localStorage.getItem('wavelength_di_replays')||'[]')}catch{return[]}};
const symbol=()=>String(window.WavelengthAssetSymbol||new URLSearchParams(location.search).get('symbol')||'BTC').toUpperCase();
function ensure(){if($('#decisionScienceV2'))return;const anchor=$('#decisionIntegrity');if(!anchor)return;const s=document.createElement('section');s.className='card';s.id='decisionScienceV2';s.innerHTML=`<div class="card-head"><div><div class="card-title">Decision Science v2</div><div class="card-meta">Empirical calibration · simple-baseline competition · multi-dimensional analogues</div></div><span class="badge warn" id="ds2Badge">COLLECTING</span></div><div class="grid4" id="ds2Kpis"><div class="empty">Waiting for resolved forward replays…</div></div><div class="grid2" style="margin-top:14px"><div><div class="card-title" style="font-size:14px">Reliability / calibration</div><div id="ds2Calibration" class="context-list"></div></div><div><div class="card-title" style="font-size:14px">Simple models Wavelength must beat</div><div id="ds2Baselines" class="analysis-list"></div></div></div><div class="grid2" style="margin-top:14px"><div><div class="card-title" style="font-size:14px">Nearest successful analogues</div><div id="ds2Success" class="context-list"></div></div><div><div class="card-title" style="font-size:14px">Nearest failed analogues</div><div id="ds2Failure" class="context-list"></div></div></div><div class="analysis-list" style="margin-top:14px"><div class="analysis-row"><span class="analysis-label">Anti-overfitting rule</span><strong>FAILURES STAY VISIBLE · NO SCORE RETUNING FROM THIS PANEL</strong></div><div class="analysis-row"><span class="analysis-label">Calibration claim</span><strong id="ds2Claim">INSUFFICIENT SAMPLE</strong></div></div>`;anchor.insertAdjacentElement('afterend',s)}
function context(title,copy,kind=''){return `<div class="context-item"><strong class="${kind}">${esc(title)}</strong><p>${esc(copy)}</p></div>`}
function row(label,value,kind=''){return `<div class="analysis-row"><span class="analysis-label">${esc(label)}</span><strong class="${kind}">${esc(value)}</strong></div>`}
function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function hit(a){return a.length?100*a.filter(x=>x>0).length/a.length:null}
function dim(r,k){return r?.dimensions?.[k]}
function trendBull(r){return /bull/i.test(String(dim(r,'trend')?.value||''))}
function rsiPreferred(r){const v=Number(dim(r,'momentum')?.value);return Number.isFinite(v)&&v>=50&&v<=75}
function adxStrong(r){const v=Number(dim(r,'trend_strength')?.value);return Number.isFinite(v)&&v>=30}
function volumeStrong(r){const v=Number(dim(r,'participation')?.value);return Number.isFinite(v)&&v>=1.2}
function deterministicHalf(r){let h=0;for(const c of String(r.replay_id||r.observed_at||''))h=(h*31+c.charCodeAt(0))>>>0;return h%2===0}
function calibration(resolved){if(resolved.length<8)return null;const brier=mean(resolved.map(r=>{const p=clamp((+r.score||0)/100,0,1),y=r.outcome_24h>0?1:0;return (p-y)**2}));const buckets={};for(const r of resolved){const b=Math.floor((+r.score||0)/10)*10;(buckets[b]??=[]).push(r)}let weighted=0,n=0;const parts=[];for(const [b,rs] of Object.entries(buckets)){const pred=mean(rs.map(r=>(+r.score||0)/100)),actual=rs.filter(r=>r.outcome_24h>0).length/rs.length;weighted+=Math.abs(pred-actual)*rs.length;n+=rs.length;parts.push({b:+b,n:rs.length,pred,actual,meanReturn:mean(rs.map(r=>r.outcome_24h))})}return {brier,ece:n?weighted/n:null,parts}}
function model(name,resolved,pred){const selected=resolved.filter(pred),rets=selected.map(r=>r.outcome_24h);return {name,n:selected.length,mean:mean(rets),hit:hit(rets)}}
function baselineModels(resolved){return [
 model('Wavelength score ≥60',resolved,r=>(+r.score||0)>=60),
 model('Buy/hold all observations',resolved,()=>true),
 model('Bullish trend only',resolved,trendBull),
 model('RSI 50–75 only',resolved,rsiPreferred),
 model('ADX ≥30 only',resolved,adxStrong),
 model('Volume ≥1.2× only',resolved,volumeStrong),
 model('Deterministic random 50%',resolved,deterministicHalf),
 ]}
function vector(r){const rank=Number(dim(r,'fundamentals')?.value?.rank),rsi=Number(dim(r,'momentum')?.value),adx=Number(dim(r,'trend_strength')?.value),vol=Number(dim(r,'participation')?.value),fund=Number(dim(r,'derivatives')?.value?.funding);return [
 (+r.score||50)/100,
 trendBull(r)?1:/bear/i.test(String(dim(r,'trend')?.value||''))?-1:0,
 Number.isFinite(rsi)?clamp((rsi-50)/30,-1,1):0,
 Number.isFinite(adx)?clamp((adx-20)/30,-1,1):0,
 Number.isFinite(vol)?clamp((vol-1)/1.5,-1,1):0,
 Number.isFinite(fund)?clamp(fund/.1,-1,1):0,
 Number.isFinite(rank)?1-clamp(rank/200,0,1):0,
 ]}
function distance(a,b){const va=vector(a),vb=vector(b),w=[2,2,1.2,1.2,1,1,0.6];let s=0,z=0;for(let i=0;i<va.length;i++){s+=w[i]*(va[i]-vb[i])**2;z+=w[i]}return Math.sqrt(s/z)}
function analogueRows(current,resolved,positive){return resolved.filter(r=>(r.outcome_24h>0)===positive).map(r=>({...r,distance:distance(current,r)})).sort((a,b)=>a.distance-b.distance).slice(0,5)}
function analogueHtml(rows){if(!rows.length)return '<div class="empty">No resolved analogue in this class yet.</div>';return rows.map(r=>context(`${new Date(r.observed_at).toLocaleString()} · distance ${r.distance.toFixed(3)}`,`Score ${r.score}/100 · 24h outcome ${pct(r.outcome_24h)} · ${r.label||''}`,r.outcome_24h>0?'up':'down')).join('')}
function thesisDecomposition(current,ledger){const hist=ledger.filter(r=>r.symbol===current.symbol&&r.replay_id!==current.replay_id).sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at));const prior=hist[0];if(!prior)return null;const changes=[];for(const k of Object.keys(current.dimensions||{})){const a=current.dimensions?.[k]?.contribution??0,b=prior.dimensions?.[k]?.contribution??0;if(a!==b)changes.push(`${k.replaceAll('_',' ')} ${b>=0?'+':''}${b}→${a>=0?'+':''}${a}`)}return {delta:(+current.score||0)-(+prior.score||0),changes:changes.slice(0,4)}}
function render(){ensure();const di=window.WavelengthDecisionIntegrity;if(!di?.snapshot)return;const current=di.snapshot,ledger=store(),resolved=ledger.filter(r=>r.symbol===symbol()&&Number.isFinite(r.outcome_24h));const cal=calibration(resolved),models=baselineModels(resolved),wl=models[0],best=models.filter(x=>x.n>=3&&x.mean!=null).sort((a,b)=>b.mean-a.mean)[0];const successes=analogueRows(current,resolved,true),failures=analogueRows(current,resolved,false),thesis=thesisDecomposition(current,ledger);
 $('#ds2Badge').textContent=resolved.length>=20?'CALIBRATION ACTIVE':resolved.length>=8?'PROVISIONAL':'COLLECTING';$('#ds2Badge').className='badge '+(resolved.length>=20?'good':'warn');$('#ds2Kpis').innerHTML=[['Resolved 24h',resolved.length],['Brier',cal?cal.brier.toFixed(3):'—'],['Calibration error',cal?`${(cal.ece*100).toFixed(1)}%`:'—'],['Best simple comparator',best?.name||'—']].map(x=>`<div class="metric"><div class="metric-label">${x[0]}</div><div class="metric-value">${esc(x[1])}</div></div>`).join('');
 $('#ds2Calibration').innerHTML=cal?cal.parts.map(p=>context(`Score ${p.b}–${p.b+9}`,`${p.n} obs · mean predicted ${(p.pred*100).toFixed(1)}% · empirical positive ${(p.actual*100).toFixed(1)}% · mean return ${pct(p.meanReturn)}`)).join(''):context('No probability claim yet',`${resolved.length}/8 minimum resolved 24h replays. A score is not treated as a probability until empirical calibration exists.`);
 $('#ds2Baselines').innerHTML=models.map(m=>row(m.name,`${m.n} obs · mean ${pct(m.mean)} · hit ${m.hit==null?'—':m.hit.toFixed(0)+'%'}`,m.name.startsWith('Wavelength')&&best?.name===m.name?'up':m.n>=3&&wl.mean!=null&&m.mean>wl.mean?'accent':'' )).join('');
 $('#ds2Success').innerHTML=analogueHtml(successes);$('#ds2Failure').innerHTML=analogueHtml(failures);
 const claim=resolved.length>=20&&cal?.ece!=null&&cal.ece<=.15?'PROVISIONALLY CALIBRATED':resolved.length>=8?'MEASURING · NOT YET TRUSTED':'INSUFFICIENT SAMPLE';$('#ds2Claim').textContent=claim;
 if(thesis){$('#ds2Claim').textContent+=` · thesis ${thesis.delta>=0?'+':''}${thesis.delta} pts${thesis.changes.length?' · '+thesis.changes.join(', '):''}`}
}
function start(){ensure();render();setInterval(render,30000);const di=$('#decisionIntegrity');if(di)new MutationObserver(()=>setTimeout(render,250)).observe(di,{childList:true,subtree:true,characterData:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,800));else setTimeout(start,800);
})();
