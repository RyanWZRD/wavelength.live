(()=>{'use strict';
if(window.__wlFreshnessBanner)return;window.__wlFreshnessBanner=true;
const FRIENDLY={data_truth_v3:'Data Truth v3',data_truth_v4:'Data Truth v4',conviction_room:'Conviction Room',market_command:'Market Command',proof_programme:'Proof Programme',validation_calibration:'Validation',decision_robustness:'Decision Robustness',institutional_research_v2:'Research v2',market_memory:'Market Memory',portfolio:'Portfolio'};
const fmt=x=>Number.isFinite(+x)?(+x<1?`${Math.max(1,Math.round(+x*60))}m`:`${(+x).toFixed(1)}h`):'unknown age';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let report=null;
async function load(){try{const r=await fetch(`system-integrity.json?t=${Date.now()}`,{cache:'no-store'});if(r.ok)report=await r.json()}catch{}replaceLegacy();renderSpecific()}
function legacy(){return [...document.querySelectorAll('.page > .card')].find(x=>x.textContent?.includes('Data availability warning:')&&x.textContent?.includes('Do not interpret missing data'))}
function rows(){return report?.module_freshness||[]}
function describe(xs){return xs.map(x=>`${FRIENDLY[x.module]||x.module} (${fmt(x.age_hours)})`).join(', ')}
function make(kind,html){const b=document.createElement('div');b.id='wlFreshnessNotice';b.className='card';b.style.borderColor=kind==='critical'?'#9b5b48':'#8a6a35';b.style.background=kind==='critical'?'rgba(155,91,72,.06)':'rgba(138,106,53,.045)';b.innerHTML=html;return b}
function replaceLegacy(){const old=legacy();if(!old)return;if(!report){return}old.remove();renderSpecific()}
function renderSpecific(){if(document.querySelector('#wlFreshnessNotice'))return;const page=document.querySelector('.page');if(!page||!report)return;const offline=!navigator.onLine,stale=rows().filter(x=>x.status==='STALE'||x.status==='MISSING'||x.status==='UNAVAILABLE'),aging=rows().filter(x=>x.status==='AGING');let node=null;if(offline||stale.length){const detail=offline?'This device is offline.':`Stale/unavailable: ${describe(stale)}.`;node=make('critical',`<strong>Data availability warning:</strong> ${esc(detail)} Some research views may be incomplete; missing data is not a “no signal”.`)}else if(aging.length){node=make('soft',`<strong>Data freshness notice:</strong> ${esc(describe(aging))}. Core feeds remain available; these slower research modules are aging and should be read with their timestamps.`)}if(node)page.prepend(node)}
const mo=new MutationObserver(()=>{if(legacy())replaceLegacy()});
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',()=>{mo.observe(document.body,{childList:true,subtree:true});load()});else{mo.observe(document.body,{childList:true,subtree:true});load()}
window.addEventListener('online',()=>{document.querySelector('#wlFreshnessNotice')?.remove();load()});window.addEventListener('offline',()=>{document.querySelector('#wlFreshnessNotice')?.remove();load()});
})();
