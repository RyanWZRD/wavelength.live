(()=>{
'use strict';
if(window.__wavelengthCoinLive)return;
window.__wavelengthCoinLive=true;

const q=new URLSearchParams(location.search);
const symbol=(window.WavelengthCoinSymbol||q.get('symbol')||'BTC').toUpperCase().replace(/[^A-Z0-9]/g,'');
const pair=`${symbol}USDT`;
const $=s=>document.querySelector(s);
const money=v=>v==null||!Number.isFinite(+v)?'—':(+v>=1?'$'+(+v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'$'+(+v).toLocaleString('en-US',{maximumFractionDigits:8}));
const pct=v=>v==null||!Number.isFinite(+v)?'—':`${+v>=0?'+':''}${(+v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}%`;

let tickerWS=null,klineWS=null,reconnectTicker=null,reconnectKline=null,lastPrice=null,currentInterval=null;

function flash(el,dir){
  if(!el||!dir)return;
  el.animate([
    {backgroundColor:dir>0?'rgba(34,197,94,.28)':'rgba(239,68,68,.28)'},
    {backgroundColor:'transparent'}
  ],{duration:520,easing:'ease-out'});
}

function connectTicker(){
  clearTimeout(reconnectTicker);
  try{tickerWS?.close()}catch{}
  tickerWS=new WebSocket(`wss://stream.binance.com:9443/ws/${pair.toLowerCase()}@ticker`);
  tickerWS.onmessage=e=>{
    try{
      const d=JSON.parse(e.data),price=+d.c;
      if(!Number.isFinite(price))return;
      const el=$('#coinPrice'),dir=lastPrice==null?0:price>lastPrice?1:price<lastPrice?-1:0;
      if(el){el.textContent=money(price);flash(el,dir)}
      lastPrice=price;
      const change=$('#coinChange');
      if(change){
        change.textContent=`${pct(+d.P)} 24h · high ${money(+d.h)} · low ${money(+d.l)}`;
        change.className=`card-meta ${+d.P>0?'up':+d.P<0?'down':'neutral'}`;
      }
      const status=$('#coinStatus');
      if(status){status.className='status-pill';status.innerHTML='<span class="dot"></span>LIVE DATA'}
    }catch{}
  };
  tickerWS.onclose=()=>{reconnectTicker=setTimeout(connectTicker,2500)};
  tickerWS.onerror=()=>{try{tickerWS.close()}catch{}};
}

function selectedInterval(){
  return document.querySelector('#timeframes .tab.active')?.dataset.tf||'4h';
}

function connectKline(force=false){
  const interval=selectedInterval();
  if(!force&&interval===currentInterval&&klineWS?.readyState===WebSocket.OPEN)return;
  currentInterval=interval;
  clearTimeout(reconnectKline);
  try{klineWS?.close()}catch{}
  klineWS=new WebSocket(`wss://stream.binance.com:9443/ws/${pair.toLowerCase()}@kline_${interval}`);
  klineWS.onmessage=e=>{
    try{
      const d=JSON.parse(e.data),k=d.k,series=window.__wavelengthCoinCandleSeries;
      if(!k||!series||typeof series.update!=='function')return;
      series.update({time:Math.floor(+k.t/1000),open:+k.o,high:+k.h,low:+k.l,close:+k.c});
    }catch{}
  };
  klineWS.onclose=()=>{reconnectKline=setTimeout(()=>connectKline(true),2500)};
  klineWS.onerror=()=>{try{klineWS.close()}catch{}};
}

function bindTimeframes(){
  document.querySelectorAll('#timeframes .tab').forEach(btn=>btn.addEventListener('click',()=>setTimeout(()=>connectKline(true),80)));
}

function start(){
  connectTicker();
  bindTimeframes();
  const wait=setInterval(()=>{if(window.__wavelengthCoinCandleSeries){clearInterval(wait);connectKline(true)}},100);
  setTimeout(()=>clearInterval(wait),10000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
