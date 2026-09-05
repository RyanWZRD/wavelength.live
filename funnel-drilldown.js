(()=>{
'use strict';
const esc=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=1)=>Number.isFinite(+v)?(+v).toFixed(d):'—';
const pct=(v,d=1)=>Number.isFinite(+v)?`${+v>=0?'+':''}${(+v).toFixed(d)}%`:'—';
const cache={radar:null,funnel:null,paper:null};
const labels=['WATCH','DEVELOPING','NEAR CONF.','QUALIFIED','PAPER'];
const stageKeys=['WATCH','DEVELOPING','NEAR_CONFIRMATION','QUALIFIED','PAPER'];

const style=document.createElement('style');style.textContent=`
.funnel-step.funnel-clickable{cursor:pointer;position:relative;transition:transform .12s ease,border-color .12s ease,background .12s ease}.funnel-step.funnel-clickable:hover,.funnel-step.funnel-clickable:focus-visible{transform:translateY(-2px);border-color:currentColor;background:rgba(255,255,255,.035);outline:none}.funnel-step.funnel-clickable:after{content:'inspect';display:block;margin-top:5px;font:500 9px 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;opacity:.45}.funnel-drill{position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:10020;display:none}.funnel-drill.open{display:block}.funnel-drill-panel{position:absolute;right:0;top:0;height:100%;width:min(620px,96vw);overflow:auto;background:#0f141c;border-left:1px solid var(--border,#24303a);padding:24px}.funnel-drill-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding-bottom:16px;border-bottom:1px solid var(--border,#24303a)}.funnel-drill-title{font:750 25px 'Bricolage Grotesque',sans-serif}.funnel-drill-meta{font:500 11px 'IBM Plex Mono',monospace;opacity:.62;margin-top:5px}.funnel-drill-close{border:1px solid var(--border,#24303a);background:transparent;color:inherit;border-radius:10px;padding:8px 11px;cursor:pointer}.funnel-member{padding:15px 0;border-bottom:1px solid rgba(255,255,255,.07)}.funnel-member-top{display:flex;justify-content:space-between;gap:12px;align-items:center}.funnel-member-symbol{font:750 20px 'Bricolage Grotesque',sans-serif}.funnel-member-symbol a{color:inherit}.funnel-member-score{font:700 17px 'IBM Plex Mono',monospace}.funnel-member-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:10px}.funnel-mini{padding:8px;border-radius:9px;background:rgba(255,255,255,.025)}.funnel-mini span{display:block;font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:.05em}.funnel-mini b{display:block;font:650 12px 'IBM Plex Mono',monospace;margin-top:3px}.funnel-empty{padding:24px 0;opacity:.66;line-height:1.55}.funnel-note{margin-top:16px;padding:12px;border:1px solid var(--border,#24303a);border-radius:10px;font-size:12px;opacity:.72;line-height:1.5}@media(max-width:620px){.funnel-member-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.funnel-drill-panel{padding:18px}}
`;document.head.appendChild(style);

async function get(name){try{const r=await fetch(`${name}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(String(r.status));return await r.json()}catch{return null}}
function ensureDrawer(){let root=document.querySelector('#funnelDrilldown');if(root)return root;root=document.createElement('div');root.id='funnelDrilldown';root.className='funnel-drill';root.innerHTML=`<div class="funnel-drill-panel" role="dialog" aria-modal="true" aria-labelledby="funnelDrillTitle"><div class="funnel-drill-head"><div><div class="funnel-drill-title" id="funnelDrillTitle">Opportunity stage</div><div class="funnel-drill-meta" id="funnelDrillMeta">Loading…</div></div><button class="funnel-drill-close" type="button">Close</button></div><div id="funnelDrillBody"></div></div>`;document.body.appendChild(root);root.querySelector('.funnel-drill-close').onclick=close;root.onclick=e=>{if(e.target===root)close()};return root}
function close(){ensureDrawer().classList.remove('open')}
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});

function membersFor(key){
 const radar=cache.radar?.opportunities||[];
 if(key==='WATCH'||key==='DEVELOPING'||key==='NEAR_CONFIRMATION')return radar.filter(x=>x.stage===key).map(x=>({...x,_source:'1H RADAR'}));
 if(key==='QUALIFIED')return (cache.funnel?.qualified||[]).map(x=>({...x,_source:'4H PAPER PIPELINE'}));
 const paper=(cache.funnel?.paper?.length?cache.funnel.paper:(cache.paper?.open_positions||[]));
 return paper.map(x=>({...x,_source:'4H PAPER PIPELINE'}));
}
function metric(label,value){return `<div class="funnel-mini"><span>${esc(label)}</span><b>${esc(value)}</b></div>`}
function row(x,key){
 const radar=key==='WATCH'||key==='DEVELOPING'||key==='NEAR_CONFIRMATION';
 const lead=radar?(Number.isFinite(+x.score)?`Score ${num(x.score,0)}`:'Radar'):(Number.isFinite(+x.intel)?`Intel ${num(x.intel,0)}`:'Qualified');
 const metrics=[];
 if(radar){metrics.push(metric('ADX',num(x.adx,1)),metric('RSI',num(x.rsi,1)),metric('24h',pct(x.change_24h,1)),metric('Volume',Number.isFinite(+x.volume_ratio)?`${num(x.volume_ratio,2)}×`:'—'));if(x.breakout_20h!=null)metrics.push(metric('20h breakout',x.breakout_20h?'YES':'NO'))}
 else {metrics.push(metric('ADX',num(x.adx,1)),metric('RSI',num(x.rsi,1)),metric('ATR',Number.isFinite(+x.atr_pct)?`${num(x.atr_pct,2)}%`:'—'),metric('vs BTC 30d',pct(x.vs_btc30,1)));if(Number.isFinite(+x.technical_score))metrics.push(metric('Technical',num(x.technical_score,0)))}
 return `<div class="funnel-member"><div class="funnel-member-top"><div><div class="funnel-member-symbol"><a href="coin.html?symbol=${encodeURIComponent(x.symbol||'')}">${esc(x.symbol)}</a></div><div class="funnel-drill-meta">${esc(x._source)} · open full coin workspace →</div></div><div class="funnel-member-score">${esc(lead)}</div></div><div class="funnel-member-metrics">${metrics.join('')}</div></div>`;
}
function sourceTime(key){const ts=(key==='QUALIFIED'||key==='PAPER')?(cache.funnel?.generated_at||cache.paper?.generated_at):cache.radar?.generated_at;return ts?new Date(ts).toLocaleString():'timestamp unavailable'}
async function openStage(key,label){
 const root=ensureDrawer(),title=root.querySelector('#funnelDrillTitle'),meta=root.querySelector('#funnelDrillMeta'),body=root.querySelector('#funnelDrillBody');root.classList.add('open');title.textContent=label;meta.textContent='Refreshing stage membership…';body.innerHTML='<div class="funnel-empty">Loading the coins behind this funnel stage…</div>';
 const [radar,funnel,paper]=await Promise.all([get('opportunity-radar.json'),get('opportunity-funnel.json'),get('paper-portfolio.json')]);if(radar)cache.radar=radar;if(funnel)cache.funnel=funnel;if(paper)cache.paper=paper;
 const xs=membersFor(key);meta.textContent=`${xs.length} coin${xs.length===1?'':'s'} · source ${sourceTime(key)}`;
 if(xs.length)body.innerHTML=xs.map(x=>row(x,key)).join('')+`<div class="funnel-note">${key==='QUALIFIED'?'Qualified means the wider-market 4h paper rules are satisfied. It is not Candidate V3 execution permission.':key==='PAPER'?'Paper means an open internal simulated position — not an Alpaca or real-money order.':'Watch, Developing and Near Confirmation are 1h radar research stages and do not alter the validated 4h strategy.'}</div>`;
 else if(key==='QUALIFIED'&&!cache.funnel)body.innerHTML='<div class="funnel-empty">The Qualified count is available, but the new membership feed is waiting for its first 4h snapshot. Wavelength will show the exact coin here as soon as that snapshot is published.</div>';
 else body.innerHTML='<div class="funnel-empty">No coins are currently in this stage.</div>';
}
function wire(){const steps=[...document.querySelectorAll('#opportunityFunnel .funnel-step')];if(steps.length!==5)return false;steps.forEach((el,i)=>{if(el.dataset.funnelWired)return;el.dataset.funnelWired='1';el.dataset.funnelStage=stageKeys[i];el.classList.add('funnel-clickable');el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label',`Inspect ${labels[i]} opportunity stage`);el.title=`Show coins in ${labels[i]}`;el.addEventListener('click',()=>openStage(stageKeys[i],labels[i]));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openStage(stageKeys[i],labels[i])}})});return true}
const observer=new MutationObserver(()=>wire());observer.observe(document.documentElement,{childList:true,subtree:true});wire();
Promise.all([get('opportunity-radar.json'),get('opportunity-funnel.json'),get('paper-portfolio.json')]).then(([r,f,p])=>{cache.radar=r;cache.funnel=f;cache.paper=p;wire()});
})();
