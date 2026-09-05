(()=>{
'use strict';
if(!document.querySelector('script[data-shared-nav-loader]')){const s=document.createElement('script');s.src='shared-nav.js';s.defer=true;s.dataset.sharedNavLoader='1';document.head.appendChild(s)}
const OPPS='wavelength_opportunities';
function num(v){if(v==null)return null;const x=parseFloat(String(v).replace(/[^0-9+\-.]/g,''));return Number.isFinite(x)?x:null}
function txt(el){return el?.textContent?.trim()||''}
function capture(){
  let opps;try{opps=JSON.parse(localStorage.getItem(OPPS)||'[]')}catch{return}
  if(!Array.isArray(opps)||!opps.length)return;
  let changed=false;
  const regime=txt(document.querySelector('#regimeCard .regime-value'))||null;
  for(const o of opps){
    if(o.features||o.done)continue;
    const row=document.querySelector(`tr.market-row[data-sym="${CSS.escape(o.symbol||'')}"]`);
    if(!row)continue;
    const c=[...row.children];
    if(c.length<11)continue;
    const trend=txt(c[5]);
    const rsi=num(txt(c[6]));
    const adx=num(txt(c[7]));
    const rs30=num(txt(c[8]));
    const funding=num(txt(c[9]));
    const intel=num(txt(c[10]));
    o.features={captured_at:new Date().toISOString(),regime,trend,rsi,adx,rs30,funding,intel,strong_trend:adx!=null&&adx>=35,healthy_momentum:rsi!=null&&rsi>=50&&rsi<=75,rs_leader:rs30!=null&&rs30>=5,rs_laggard:rs30!=null&&rs30<=-5,crowded_longs:funding!=null&&funding>=0.05,high_intel:intel!=null&&intel>=75};
    changed=true;
  }
  if(changed)localStorage.setItem(OPPS,JSON.stringify(opps.slice(-80)));
}
setInterval(capture,2500);setTimeout(capture,1200);
})();
