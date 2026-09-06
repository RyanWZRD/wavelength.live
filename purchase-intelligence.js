(()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,d=2)=>v==null||!Number.isFinite(+v)?'—':(+v).toLocaleString('en-GB',{maximumFractionDigits:d,minimumFractionDigits:d});
const pct=v=>v==null||!Number.isFinite(+v)?'—':`${+v>=0?'+':''}${n(+v,2)}%`;
const money=v=>v==null||!Number.isFinite(+v)?'—':'$'+(+v).toLocaleString('en-GB',{maximumFractionDigits:+v>=1?2:8});
const compact=v=>v==null||!Number.isFinite(+v)?'—':new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:2}).format(+v);
const tone=v=>/GOOD_ASSET_GOOD_ENTRY|QUALIFIED|RISK_ON/.test(String(v||''))?'good':/AVOID|POOR|WEAK|RISK_OFF|CONFLICT/.test(String(v||''))?'bad':'warn';
const label=s=>String(s||'').replaceAll('_',' ');
let data=null;
async function load(){
  try{
    const r=await fetch(`purchase-intelligence.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(r.status);data=await r.json();render();$('#piFeed').className='status-pill';$('#piFeed').innerHTML='<span class="dot"></span>LIVE';
  }catch(e){$('#piFeed').className='status-pill bad';$('#piFeed').innerHTML='<span class="dot"></span>UNAVAILABLE';$('#piGrid').innerHTML='<div class="empty">Purchase-intelligence feed is not available yet. The scheduled server collector may not have completed its first run.</div>'}
}
function dimScore(d){return d&&d.available&&Number.isFinite(+d.score)?n(d.score,0):'—'}
function renderSummary(assets){
  const good=assets.filter(a=>a.verdict==='GOOD_ASSET_GOOD_ENTRY_EVIDENCE').length;
  const conflict=assets.filter(a=>a.evidence_conflict).length;
  const avg=assets.filter(a=>Number.isFinite(+a.fusion_score));
  const av=avg.length?avg.reduce((s,a)=>s+(+a.fusion_score),0)/avg.length:null;
  const top=assets[0];
  $('#piSummary').innerHTML=[['Assets covered',assets.length],['Good asset + entry',good],['Evidence conflicts',conflict],['Top fusion',top?`${esc(top.symbol)} ${n(top.fusion_score,0)}`:'—']].map(([k,v])=>`<div class="pi-kpi"><span>${k}</span><b>${v}</b></div>`).join('');
  $('#piMeta').textContent=`Updated ${data.generated_at?new Date(data.generated_at).toLocaleString():'—'} · average fusion ${n(av,1)} · no order authority`;
}
function renderGlobal(){
  const g=data.global||{},m=g.market_context||{},s=g.stablecoin_liquidity||{};
  const b=m.breadth||{};
  $('#globalContext').innerHTML=[
    ['Market regime',m.regime||'UNKNOWN'],
    ['Above EMA200',pct(b.above_ema200_pct)],
    ['EMA20 > EMA80',pct(b.ema20_above_80_pct)],
    ['Stablecoin 7d',pct(s.change_7d_pct)]
  ].map(([k,v])=>`<div class="pi-kpi"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
}
function details(a){
  const d=a.dimensions||{},l=d.liquidity||{},x=d.derivatives||{},f=d.fundamental||{},t=d.technical||{};
  const slip=l.estimated_buy_slippage_bps||{};
  return `<div class="pi-detail">
    <div class="pi-sources"><b>Technical:</b> ${esc((t.why||[]).join(' · ')||'No current technical explanation')}<br>
    <b>Against:</b> ${esc((t.against||[]).join(' · ')||'No major technical negatives')}<br>
    <b>Execution:</b> spread ${n(l.spread_bps,2)} bps · $1k buy slippage ${n(slip['1000'],2)} bps · $10k ${n(slip['10000'],2)} bps · 1% bid depth ${compact(l.bid_depth_1pct_usd)} · 1% ask depth ${compact(l.ask_depth_1pct_usd)}<br>
    <b>Derivatives:</b> funding ${x.funding_rate==null?'—':n(100*x.funding_rate,4)+'%'} · spot/futures volume ${n(x.spot_to_futures_quote_volume,2)}x · OI 24h ${pct(x.open_interest_value_change_24h_pct)}<br>
    <b>Fundamentals:</b> rank ${f.market_cap_rank??'—'} · market cap ${compact(f.market_cap_usd)} · MC/FDV ${n(f.market_cap_to_fdv,2)} · volume/MC ${n(f.volume_to_market_cap,3)}<br>
    <b>Coverage:</b> ${a.coverage?.available_dimensions??0}/${a.coverage?.total_dimensions??0} dimensions (${a.coverage?.pct??0}%)
    </div>
  </div>`;
}
function card(a){
  const d=a.dimensions||{};
  return `<article class="pi-card" data-symbol="${esc(a.symbol)}"><div class="pi-head"><div><a class="asset-link" href="asset.html?symbol=${encodeURIComponent(a.symbol)}"><b>${esc(a.symbol)}</b></a><div class="card-meta">${money(a.price)} · ${pct(a.change_24h_pct)}</div></div><div style="text-align:right"><div class="pi-score">${n(a.fusion_score,0)}</div><span class="badge ${tone(a.verdict)}">${esc(label(a.verdict))}</span></div></div>
  <div class="pi-dims">${[['Technical',d.technical],['Liquidity',d.liquidity],['Derivatives',d.derivatives],['Market',d.market_context],['Fundamental',d.fundamental],['Stablecoin',d.stablecoin_liquidity]].map(([k,v])=>`<div class="pi-dim"><small>${k}</small><b>${dimScore(v)}</b></div>`).join('')}</div>
  ${a.evidence_conflict?`<div class="pi-conflict"><b>EVIDENCE CONFLICT</b><br>${esc((a.conflicts||[]).map(label).join(' · '))}</div>`:''}
  ${details(a)}</article>`;
}
function renderAssets(){
  const q=($('#piSearch').value||'').trim().toUpperCase(),vf=$('#piVerdict').value;
  let assets=(data.assets||[]).filter(a=>(!q||a.symbol.includes(q))&&(vf==='ALL'||a.verdict===vf||(vf==='AVOID'&&String(a.verdict).startsWith('AVOID'))));
  $('#piGrid').innerHTML=assets.length?assets.map(card).join(''):'<div class="empty">No matching assets.</div>';
  $('#piGrid').querySelectorAll('.pi-card').forEach(el=>el.addEventListener('click',e=>{if(e.target.closest('a'))return;el.classList.toggle('open')}));
}
function renderCoverage(){
  const first=(data.assets||[])[0],dims=first?.dimensions||{};
  const names={technical:'Technical / decision journal',liquidity:'Order book / slippage',derivatives:'Spot vs futures / funding / OI',market_context:'BTC + breadth / regime',stablecoin_liquidity:'Stablecoin liquidity',fundamental:'Fundamentals',onchain_exchange_flows:'On-chain exchange flows',event_catalyst_risk:'Token unlock / catalyst risk',macro_context:'Macro context'};
  $('#coveragePanel').innerHTML=Object.entries(names).map(([k,v])=>{const x=dims[k]||{};return `<div><b>${esc(v)}:</b> ${x.available?'AVAILABLE':esc(x.status||'UNAVAILABLE')}</div>`}).join('');
  const f=data.freshness||{};$('#freshnessPanel').innerHTML=Object.entries(f).map(([k,v])=>`<div><b>${esc(label(k))}:</b> ${esc(v||'—')}</div>`).join('');
}
function render(){const assets=data.assets||[];renderSummary(assets);renderGlobal();renderAssets();renderCoverage()}
function init(){
  $('#piSearch').addEventListener('input',renderAssets);$('#piVerdict').addEventListener('change',renderAssets);load();setInterval(load,300000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
