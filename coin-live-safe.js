(()=>{
'use strict';
if(window.__wavelengthCoinLiveSafe)return;
window.__wavelengthCoinLiveSafe=true;

const $=s=>document.querySelector(s);
const q=new URLSearchParams(location.search);
const symbol=(q.get('symbol')||'BTC').toUpperCase().replace(/[^A-Z0-9]/g,'');
const pair=`${symbol}USDT`;
const money=v=>v==null||!Number.isFinite(+v)?'—':(+v>=1?'$'+(+v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'$'+(+v).toLocaleString('en-US',{maximumFractionDigits:8}));
const pct=v=>v==null||!Number.isFinite(+v)?'—':`${+v>=0?'+':''}${(+v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
let lastPrice=null,tickerBusy=false,chartBusy=false;

function flash(el,dir){
  if(!el||!dir||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  try{el.animate([{backgroundColor:dir>0?'rgba(34,197,94,.24)':'rgba(239,68,68,.24)'},{backgroundColor:'transparent'}],{duration:480,easing:'ease-out'})}catch{}
}

async function refreshTicker(){
  if(tickerBusy||document.hidden)return;
  tickerBusy=true;
  try{
    const r=await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(pair)}`,{cache:'no-store'});
    if(!r.ok)throw new Error(r.status);
    const d=await r.json(),price=+d.lastPrice;
    if(Number.isFinite(price)){
      const el=$('#coinPrice'),dir=lastPrice==null?0:price>lastPrice?1:price<lastPrice?-1:0;
      if(el){el.textContent=money(price);flash(el,dir)}
      lastPrice=price;
    }
    const ch=$('#coinChange');
    if(ch){
      const p=+d.priceChangePercent;
      ch.textContent=`${pct(p)} 24h · high ${money(+d.highPrice)} · low ${money(+d.lowPrice)}`;
      ch.className=`card-meta ${p>0?'up':p<0?'down':'neutral'}`;
    }
  }catch(e){console.debug('Live ticker refresh skipped',e)}finally{tickerBusy=false}
}

function refreshChart(){
  if(chartBusy||document.hidden)return;
  const btn=$('#timeframes .tab.active');
  if(!btn)return;
  chartBusy=true;
  try{btn.click()}catch(e){console.debug('Live chart refresh skipped',e)}
  setTimeout(()=>{chartBusy=false},1800);
}

function start(){
  setTimeout(refreshTicker,1500);
  setInterval(refreshTicker,2000);
  setInterval(refreshChart,6000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshTicker();setTimeout(refreshChart,500)}});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
