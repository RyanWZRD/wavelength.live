(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const human=s=>String(s||'').replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase());
const num=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
const time=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(t)):'—'};
function metric(l,v,sub=''){return `<div class="metric"><div class="metric-label">${esc(l)}</div><div class="metric-value">${v}</div>${sub?`<div class="metric-sub">${esc(sub)}</div>`:''}</div>`}
async function load(){const root=$('#intradayTradeDetails');if(!root)return;try{const r=await fetch(`gold-intraday-v3.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`feed ${r.status}`);const d=await r.json(),b=d.best_candidate||{},has=!!(b&&b.qualifies),pricing=d.pricing_market||{};
if(has){root.innerHTML=[metric('Entry / reference',num(b.reference_price,2),'IG Spot Gold mid'),metric('Stop loss',num(b.stop,2)),metric('Take profit',num(b.target,2)),metric('Setup score',`${num(b.score,1)} / ${num(b.threshold,1)}`),metric('Setup',esc(human(b.setup))),metric('Direction',esc(b.direction||'—')),metric('Signal time',esc(time(b.signal_time)),'Europe/London'),metric('Pricing',esc(human(b.reference_price_source||d.pricing_basis||'IG Spot Gold')))].join('');
const note=$('#intradayTradeNote');if(note)note.innerHTML=`<strong>Trade plan:</strong> qualifying v3 candidate active · entry, stop and target anchored to verified IG Spot Gold · current IG mid ${esc(num(pricing.mid,2))} · observation only; no order authority.`;
}else{root.innerHTML=[metric('Entry / reference','Waiting','No qualifying setup'),metric('Stop loss','Waiting'),metric('Take profit','Waiting'),metric('Setup score','No qualifier'),metric('Setup','—'),metric('Direction','FLAT'),metric('Signal time','—'),metric('Pricing',esc(human(d.pricing_basis||'IG Spot Gold')))].join('');const note=$('#intradayTradeNote');if(note)note.innerHTML=`<strong>Trade plan:</strong> waiting for a qualifying v3 setup. Current verified IG Spot mid ${esc(num(pricing.mid,2))}.`}
}catch(e){root.innerHTML='<div class="empty">Intraday trade-plan feed unavailable.</div>';const note=$('#intradayTradeNote');if(note)note.textContent=`Trade-plan load failed: ${e.message}`}}
load();setInterval(load,60000)})();
