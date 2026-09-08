(()=>{
'use strict';
if(window.WavelengthOS)return;
const cache=new Map();
const get=async path=>{if(cache.has(path))return cache.get(path);const p=fetch(path,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`${path} ${r.status}`);return r.json()}).catch(()=>null);cache.set(path,p);return p};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const pct=v=>num(v)==null?'—':`${num(v)>=0?'+':''}${num(v).toFixed(2)}%`;
const title=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
const assurance=async()=>await get('decision-assurance-v1.json')||{};
const assets=async()=>Array.isArray((await assurance()).assets)?(await assurance()).assets:[];
const asset=async symbol=>(await assets()).find(a=>String(a.symbol).toUpperCase()===String(symbol).toUpperCase())||null;
const score=a=>num(a?.evidence_confidence?.score)||0;
const grade=a=>a?.evidence_confidence?.grade||'—';
const quality=a=>a?.evidence_confidence?.counts||a?.coin_intelligence?.source_quality||{};
const ranked=async()=>[...(await assets())].sort((a,b)=>score(b)-score(a));
const params=()=>Object.fromEntries(new URLSearchParams(location.search));
const nav=active=>`<div class="wl-os-customer-nav">${[['wavelength-today.html','Today'],['discover.html','Discover'],['portfolio-intelligence.html','My Portfolio'],['index.html#markets','Assets'],['proof-ledger.html','Proof'],['ask-wavelength.html','Ask Wavelength']].map(([h,l])=>`<a class="${active===l?'active':''}" href="${h}">${l}</a>`).join('')}</div>`;
const boot=(active)=>{document.body.classList.add('wl-customer-os');const top=document.querySelector('.topbar');if(top&&!document.querySelector('.wl-os-customer-nav'))top.insertAdjacentHTML('afterend',nav(active));};
const dimensions=a=>{const all=[...(a?.decision_decomposition?.positive||[]),...(a?.decision_decomposition?.negative_or_fragile||[])];const map={};all.forEach(x=>map[x.dimension]=x);return map};
const deskMap={technical:'Technical',derivatives:'Derivatives',onchain_exchange_flows:'On-chain',macro_context:'Macro',liquidity:'Liquidity',fundamental:'Fundamentals',stablecoin_liquidity:'Stablecoins',event_catalyst_risk:'Catalyst Risk',market_context:'Market Context'};
const committee=a=>Object.entries(deskMap).map(([k,name])=>{const d=dimensions(a)[k];const q=num(d?.quality_score);let vote='NO DATA';if(q!=null)vote=q>=85?'SUPPORT':q>=65?'WATCH':'OBJECT';return {key:k,name,vote,score:q,provider:d?.provider||'—',freshness:d?.freshness||'—',semantic:d?.semantic_class||'—'}});
const objections=a=>(a?.decision_decomposition?.negative_or_fragile||a?.evidence_confidence?.weakest_evidence||[]).slice(0,5);
const positives=a=>(a?.decision_decomposition?.positive||a?.evidence_confidence?.strongest_evidence||[]).slice(0,5);
const proof=async()=>{const a=await assurance();const calibration=await get('signal-calibration.json')||{};const outcomes=await get('outcome-analytics.json')||{};return {assurance:a,calibration,outcomes,ablation:a.ablation||{}}};
const walk=(obj,fn,path='root')=>{if(obj==null)return;if(Array.isArray(obj)){fn(obj,path);obj.forEach((v,i)=>walk(v,fn,`${path}[${i}]`));return}if(typeof obj==='object')Object.entries(obj).forEach(([k,v])=>walk(v,fn,`${path}.${k}`))};
const findRecords=obj=>{const out=[];walk(obj,(arr,path)=>{if(arr.length&&arr.length<5000&&arr.some(x=>x&&typeof x==='object'&&('symbol'in x||'coin'in x||'asset'in x)))arr.forEach(x=>{if(x&&typeof x==='object')out.push({...x,__path:path})})});return out};
const journal=async()=>findRecords(await get('decision-journal.json')||{});
const outcomeRecords=async()=>findRecords(await get('outcome-analytics.json')||{});
const holdings=()=>{try{return JSON.parse(localStorage.getItem('wavelength_portfolio_v1')||'[]')}catch{return[]}};
const saveHoldings=v=>localStorage.setItem('wavelength_portfolio_v1',JSON.stringify(v));
const parseSymbols=q=>[...new Set((String(q).toUpperCase().match(/\b[A-Z]{2,8}\b/g)||[]).filter(x=>!['WHAT','WHY','SHOW','BEST','BUY','SELL','WATCH','PROOF','VERSUS','COMPARE','WITH','THE','AND','FOR','NOW'].includes(x)))];
const CONTEXT_KEY='wavelength_research_context_v1';
const cleanSymbol=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const researchContext=()=>{const q=new URLSearchParams(location.search),direct=cleanSymbol(q.get('symbol')||q.get('candidate'));if(direct)return direct;const fromQuestion=parseSymbols(q.get('q')||'')[0];if(fromQuestion)return cleanSymbol(fromQuestion);try{return cleanSymbol(localStorage.getItem(CONTEXT_KEY)||'')}catch{return''}};
const rememberContext=s=>{s=cleanSymbol(s);if(!s)return;try{localStorage.setItem(CONTEXT_KEY,s)}catch{}};
const journeyTargets={'decision-room.html':'symbol','replay.html':'symbol','thesis-watch.html':'symbol','evidence-map.html':'symbol','proof-ledger.html':'symbol','portfolio-intelligence.html':'candidate'};
function bridgeContext(){const q=new URLSearchParams(location.search),explicit=cleanSymbol(q.get('symbol')||q.get('candidate'))||cleanSymbol(parseSymbols(q.get('q')||'')[0]);if(explicit)rememberContext(explicit);const sym=explicit||researchContext();if(!sym)return;document.querySelectorAll('a[href]').forEach(a=>{let u;try{u=new URL(a.getAttribute('href'),location.href)}catch{return}const file=(u.pathname.split('/').pop()||'').toLowerCase(),param=journeyTargets[file];if(!param)return;if(!u.searchParams.get(param))u.searchParams.set(param,sym);a.setAttribute('href',(u.pathname.split('/').pop()||file)+u.search+u.hash)});const file=(location.pathname.split('/').pop()||'').toLowerCase();if(file==='portfolio-intelligence.html'){const fill=()=>{const el=document.getElementById('candidate');if(!el)return false;if(!el.value)el.value=sym;return true};if(!fill()){let n=0,t=setInterval(()=>{if(fill()||++n>80)clearInterval(t)},100)}}}
const glossary={
'Opportunity':'Research-priority score: how strongly Wavelength prioritises investigating this asset. It is not a probability of profit.',
'Opportunity score':'Research-priority score: how strongly Wavelength prioritises investigating this asset. It is not a probability of profit.',
'Evidence quality':'0–100 assessment of the quality, freshness, directness and independence of the current evidence.',
'Evidence grade':'Letter-grade summary of current evidence quality. It describes evidence strength, not expected return.',
'Evidence confidence':'Coverage and maturity of the evidence system. It is not prediction confidence or a probability.',
'Opportunity stage':'Current confirmation state of the research thesis, such as WATCH, DEVELOPING or NEAR_CONFIRMATION.',
'Research Conviction Index':'Discovery ranking index combining 55% opportunity priority and 45% evidence quality. It is not a probability.',
'RCI':'Research Conviction Index: 55% opportunity priority + 45% evidence quality. It is a ranking index, not a probability.'
};
function applyGlossary(){const candidates=document.querySelectorAll('span,small,.label,.card-title,.card-meta,.wl-os-kicker');candidates.forEach(el=>{const t=String(el.textContent||'').trim();for(const [k,v] of Object.entries(glossary)){if((t===k||t.startsWith(k+' ')||t.includes(k+':'))&&!el.title){el.title=v;el.dataset.wlTerm=k;break}}})}
function journeyBar(){const file=(location.pathname.split('/').pop()||'').toLowerCase(),eligible=new Set(['decision-room.html','replay.html','thesis-watch.html','evidence-map.html','portfolio-intelligence.html','ask-wavelength.html']),sym=researchContext();if(!eligible.has(file)||!sym||document.getElementById('wlInvestigationBar'))return;rememberContext(sym);if(!document.getElementById('wl-journey-style')){const st=document.createElement('style');st.id='wl-journey-style';st.textContent='.wl-investigation-bar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 11px;border:1px solid #26384c;border-radius:9px;background:#08111a;color:#8195aa;font:600 9px "IBM Plex Mono",monospace}.wl-investigation-bar strong{color:#d8e3ed}.wl-investigation-bar a{padding:4px 7px;border:1px solid #32465c;border-radius:999px;color:#aebed0;text-decoration:none}.wl-investigation-bar a:hover{border-color:#d4a63a;color:#e7bd60}.wl-investigation-bar details{margin-left:auto;position:relative}.wl-investigation-bar summary{cursor:pointer;color:#8fa3b8}.wl-investigation-terms{position:absolute;right:0;top:24px;z-index:30;width:min(430px,82vw);padding:10px;border:1px solid #34475c;border-radius:9px;background:#0a141f;box-shadow:0 12px 32px rgba(0,0,0,.35)}.wl-investigation-terms div{margin:5px 0;color:#9dafc0;line-height:1.45}.wl-investigation-terms b{color:#d6e0ea}@media(max-width:760px){.wl-investigation-bar details{margin-left:0;width:100%}}';document.head.appendChild(st)}const u=s=>encodeURIComponent(s),bar=document.createElement('div');bar.id='wlInvestigationBar';bar.className='wl-investigation-bar';bar.innerHTML=`<strong>Investigating ${esc(sym)}</strong><a href="coin.html?symbol=${u(sym)}">Live asset</a><a href="decision-room.html?symbol=${u(sym)}">Decision Room</a><a href="ask-wavelength.html?q=${u('Why '+sym+'?')}">Ask</a><a href="proof-ledger.html?symbol=${u(sym)}">Proof</a><a href="replay.html?symbol=${u(sym)}">Replay</a><a href="thesis-watch.html?symbol=${u(sym)}">Thesis Watch</a><a href="evidence-map.html?symbol=${u(sym)}">Evidence Map</a><a href="portfolio-intelligence.html?candidate=${u(sym)}">Portfolio Fit</a><details><summary>Terms</summary><div class="wl-investigation-terms"><div><b>Opportunity</b> — research priority, not probability.</div><div><b>Evidence quality / grade</b> — strength, freshness, directness and independence of evidence.</div><div><b>Stage</b> — current confirmation state of the thesis.</div><div><b>RCI</b> — Discover ranking index: 55% opportunity + 45% evidence quality.</div></div></details>`;const top=document.querySelector('.topbar');if(top)top.insertAdjacentElement('afterend',bar);bridgeContext()}
function enhanceJourney(){bridgeContext();journeyBar();applyGlossary();let n=0;const t=setInterval(()=>{bridgeContext();applyGlossary();if(++n>20)clearInterval(t)},250)}
window.WavelengthOS={get,esc,num,pct,title,assurance,assets,asset,ranked,score,grade,quality,params,boot,dimensions,committee,objections,positives,proof,findRecords,journal,outcomeRecords,holdings,saveHoldings,parseSymbols,deskMap,researchContext,rememberContext,bridgeContext,applyGlossary,journeyBar};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceJourney);else enhanceJourney();
})();