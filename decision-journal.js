(()=>{
'use strict';
const KEY='wavelength_decision_journal_v1', MAX=600, H=[['4h',4],['24h',24],['3d',72],['7d',168]];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,d=2)=>v==null||!Number.isFinite(+v)?'—':(+v).toLocaleString('en-GB',{maximumFractionDigits:d,minimumFractionDigits:d});
const pct=v=>v==null||!Number.isFinite(+v)?'—':`${+v>=0?'+':''}${n(+v,2)}%`;
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
function save(rows){localStorage.setItem(KEY,JSON.stringify(rows.slice(-MAX)))}
function num(t){const m=String(t||'').replace(/[$,% ,]/g,'').match(/-?\d+(?:\.\d+)?/);return m?+m[0]:null}
function scanner(){const b=$('#marketBody');if(!b)return[];return [...b.querySelectorAll('tr')].map(tr=>{const td=[...tr.querySelectorAll('td')];if(td.length<11)return null;const symbol=(td[1]?.textContent||'').trim().split(/\s+/)[0].replace(/[^A-Z0-9]/gi,'').toUpperCase();if(!symbol)return null;return{symbol,price:num(td[2]?.textContent),change:num(td[3]?.textContent),rsi:num(td[6]?.textContent),adx:num(td[7]?.textContent),rs:num(td[8]?.textContent),intel:num(td[10]?.textContent)}}).filter(Boolean)}
function classify(x){let score=0,why=[],against=[];
  if(x.intel!=null){score+=Math.min(45,x.intel*.45);why.push(`intelligence ${n(x.intel,0)}`);if(x.intel<50)against.push('low intelligence score')}
  if(x.adx!=null){score+=Math.min(20,x.adx/2);if(x.adx>=30)why.push(`ADX ${n(x.adx,1)} confirms trend strength`);else against.push(`ADX ${n(x.adx,1)} below 30`)}
  if(x.rsi!=null&&x.rsi>=48&&x.rsi<=74){score+=15;why.push(`RSI ${n(x.rsi,1)} in trend zone`)}else if(x.rsi!=null)against.push(`RSI ${n(x.rsi,1)} outside 48–74 trend zone`);
  if(x.rs!=null&&x.rs>0){score+=10;why.push(`relative strength +${n(x.rs,1)}% vs BTC`)}else if(x.rs!=null)against.push(`relative strength ${n(x.rs,1)}% vs BTC`);
  if(x.change!=null&&Math.abs(x.change)>=2){score+=5;why.push(`${pct(x.change)} 24h move`)}
  score=Math.min(99,Math.round(score));
  const decision=score>=75&&x.adx>=30&&x.rsi>=48&&x.rsi<=74?'QUALIFIED':score>=58?'WATCH':'REJECT';
  const invalidation=[];if(x.adx!=null)invalidation.push('trend strength falls below ADX 25');if(x.rsi!=null)invalidation.push('RSI exits trend zone');if(x.rs!=null)invalidation.push('relative strength deteriorates');
  return{...x,score,decision,why,against,invalidation};
}
function updateOutcomes(rows,live){const now=Date.now(),map=Object.fromEntries(live.map(x=>[x.symbol,x]));for(const r of rows){const x=map[r.symbol];if(!x?.price||!r.price)continue;r.outcomes=r.outcomes||{};const age=(now-r.at)/3600000;for(const[k,h]of H)if(r.outcomes[k]==null&&age>=h)r.outcomes[k]=100*(x.price/r.price-1);if(age>=168)r.reviewed=true}return rows}
function record(){const live=scanner();if(!live.length)return;let rows=updateOutcomes(load(),live),now=Date.now();for(const raw of live){const x=classify(raw);if(!x.price)continue;const last=[...rows].reverse().find(r=>r.symbol===x.symbol);const stale=!last||now-last.at>=6*3600000;const changed=!last||last.decision!==x.decision;const material=!last||Math.abs((last.score||0)-x.score)>=10;if(changed||material||stale){rows.push({id:`${x.symbol}-${now}`,at:now,at_iso:new Date(now).toISOString(),symbol:x.symbol,price:x.price,decision:x.decision,score:x.score,inputs:{intel:x.intel,adx:x.adx,rsi:x.rsi,relative_strength_vs_btc:x.rs,change_24h:x.change},why:x.why,against:x.against,invalidation:x.invalidation,outcomes:{},reviewed:false,authority:'RESEARCH_ONLY_NO_ORDER_AUTHORITY'})}}
  save(rows);window.WavelengthDecisionJournal={rows,refresh:record};renderMini(rows)}
function renderMini(rows){const host=$('#watchingNow');if(!host||$('#decisionJournalMini'))return;const sec=document.createElement('section');sec.className='card';sec.id='decisionJournalMini';const recent=rows.slice(-8).reverse();sec.innerHTML=`<div class="card-head"><div><div class="card-title">Decision journal</div><div class="card-meta">Why Wavelength qualified, watched or rejected each market</div></div><a class="pill-btn" href="decisions.html">Open full journal →</a></div><div class="table-wrap"><table class="market-table"><thead><tr><th class="left">Coin</th><th>Decision</th><th>Score</th><th class="left">Reason</th></tr></thead><tbody>${recent.map(r=>`<tr><td class="left"><a class="asset-link" href="asset.html?symbol=${encodeURIComponent(r.symbol)}">${esc(r.symbol)}</a></td><td>${esc(r.decision)}</td><td>${r.score}</td><td class="left">${esc((r.decision==='REJECT'?r.against:r.why).slice(0,2).join(' · ')||'No explanation')}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Waiting for scanner decisions…</td></tr>'}</tbody></table></div>`;host.parentNode.insertBefore(sec,host.nextSibling)}
function init(){const body=$('#marketBody');if(!body)return setTimeout(init,500);let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(record,200)}).observe(body,{childList:true,subtree:true});setTimeout(record,500);setInterval(record,5*60*1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();