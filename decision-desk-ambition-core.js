(()=>{
'use strict';
if(window.WA)return;
const q=s=>document.querySelector(s);
const e=v=>String(v??'—').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const n=v=>Number.isFinite(+v)?+v:null;
const h=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
const K={watch:'wavelength_watchlist_v2',decisions:'wavelength_user_decisions_v1',holdings:'wavelength_portfolio_v1',policy:'wavelength_research_policy_v1',theses:'wavelength_living_theses_v1'};
const gl=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
const sl=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const j=async p=>{const r=await fetch(`${p}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error(p);return r.json()};
const W={q,e,n,h,K,gl,sl,data:null};
W.supports=a=>(a?.decision_decomposition?.positive||a?.evidence_confidence?.strongest_evidence||[]).slice(0,6);
W.objections=a=>(a?.decision_decomposition?.negative_or_fragile||a?.evidence_confidence?.weakest_evidence||[]).slice(0,6);
W.conditions=a=>(a?.decision_decomposition?.what_would_change_the_decision||a?.evidence_confidence?.what_would_change_the_decision||[]).slice(0,5);
W.hist=s=>((W.data?.history?.symbols||{})[s]||[]).filter(x=>x?.ts).slice().sort((a,b)=>Date.parse(a.ts)-Date.parse(b.ts));
W.delta=s=>{const z=W.hist(s);if(z.length<2)return null;const a=n(z.at(-1)?.score),b=n(z.at(-2)?.score);return a==null||b==null?null:a-b};
W.watch=()=>[...new Set(gl(K.watch,[]).map(x=>String(x).toUpperCase()))].filter(s=>W.data?.assetMap.has(s));
W.current=s=>{const a=W.data.assetMap.get(s),r=W.data.rankMap.get(s)||null;return{sym:s,a,r,e:n(a?.evidence_confidence?.score),g:a?.evidence_confidence?.grade||'—',providers:n(a?.evidence_confidence?.independent_provider_count)??0,d:W.delta(s)}};
W.risks=a=>W.objections(a).map(x=>({name:h(x.dimension||x.name||'Evidence'),fresh:String(x.freshness||'UNKNOWN').toUpperCase(),proxy:String(x.semantic_class||'').includes('PROXY'),q:n(x.quality_score),provider:x.provider||'Unknown'}));
function inject(){
  if(q('#ambitionOS'))return;
  const hero=q('.dd-hero');
  if(hero)hero.insertAdjacentHTML('afterend','<section class="card" id="ambitionOS"><div class="card-head"><div><div class="wl-os-kicker">Wavelength Intelligence OS</div><div class="card-title">Good morning. What actually deserves attention?</div><div class="card-meta">Decision-relevant change · no price-noise thesis claims</div></div><span class="dd-chip" id="briefState">BUILDING</span></div><div id="morningBrief" class="dd-list"><div class="dd-empty">Building your decision brief…</div></div></section>');
  const m=q('#monthlyReport')?.closest('section');
  if(m)m.insertAdjacentHTML('beforebegin','<section class="dd-grid2"><div class="card"><div class="card-title">Living Thesis</div><div class="card-meta">A thesis that remembers why it exists and how it changes</div><div class="dd-controls"><div class="dd-field"><label>Asset</label><select id="thesisSymbol"></select></div><button class="wl-os-btn primary" id="thesisBuild">Open living thesis</button></div><div id="livingThesis" class="dd-list"></div></div><div class="card"><div class="card-title">Personal Research Policy</div><div class="card-meta">Make Wavelength judge ideas against your process, not your mood</div><div id="policyEditor"></div><div id="policyResult" class="dd-list"></div></div></section><section class="dd-grid2"><div class="card"><div class="card-title">Automatic Red Team + Stress Simulator</div><div class="card-meta">Try to break the thesis before you commit</div><div id="redTeam" class="dd-list"></div></div><div class="card"><div class="card-title">Historical Analogues</div><div class="card-meta">Past frozen Wavelength calls that resemble this situation</div><div id="analogues" class="dd-list"></div></div></section><section class="dd-grid2"><div class="card"><div class="card-title">Personal Decision Graph</div><div class="card-meta">Asset → evidence → policy → decision → outcome</div><div id="decisionGraph" class="dd-list"></div></div><div class="card"><div class="card-title">Research Memory</div><div class="card-meta">What Wavelength knew, what you froze, what changed afterwards</div><div id="researchMemory" class="dd-list"></div></div></section><section class="dd-grid2"><div class="card"><div class="card-title">Portfolio Thesis Map</div><div class="card-meta">Shared evidence dependencies · not correlation</div><div id="portfolioThesisMap" class="dd-list"></div></div><div class="card"><div class="card-title">Evidence Reputation & Maturity</div><div class="card-meta">Current provenance quality and sample maturity · not predictive accuracy</div><div id="evidenceReputation" class="dd-list"></div></div></section>');
}
async function load(){
  try{
    inject();
    const [assurance,history,journal,dq]=await Promise.all([j('decision-assurance-v1.json'),j('intelligence-history.json'),j('decision-journal.json'),j('decision-quality-v2.json')]);
    const assets=Array.isArray(assurance.assets)?assurance.assets:[];
    W.data={assurance,history,journal,dq,assets,assetMap:new Map(assets.map(a=>[String(a.symbol).toUpperCase(),a])),rankMap:new Map((dq.ranking||[]).map(r=>[String(r.symbol).toUpperCase(),r]))};
    q('#thesisSymbol').innerHTML=assets.map(a=>String(a.symbol).toUpperCase()).sort().map(s=>`<option value="${e(s)}">${e(s)}</option>`).join('');
    const p=W.watch()[0]||['LINK','BTC','ETH','SOL'].find(s=>W.data.assetMap.has(s))||assets[0]?.symbol;
    if(p)q('#thesisSymbol').value=String(p).toUpperCase();
    window.dispatchEvent(new CustomEvent('wavelength:ambition-ready',{detail:W}));
  }catch(err){
    console.error('Wavelength Intelligence OS',err);
    if(q('#morningBrief'))q('#morningBrief').innerHTML='<div class="dd-empty">Intelligence OS data could not load. Existing Decision Desk features remain available.</div>';
  }
}
window.WA=W;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(load,0));else setTimeout(load,0);
})();
