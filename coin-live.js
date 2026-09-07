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

let ws=null,reconnectTimer=null,lastPrice=null,currentInterval=null,lastMessageAt=0;
let tickerPoll=null,klinePoll=null;

function flash(el,dir){
  if(!el||!dir||typeof el.animate!=='function')return;
  el.animate([{backgroundColor:dir>0?'rgba(34,197,94,.28)':'rgba(239,68,68,.28)'},{backgroundColor:'transparent'}],{duration:520,easing:'ease-out'});
}
function paintTicker(d){
  const price=+(d.c??d.lastPrice);if(!Number.isFinite(price))return;
  const dir=lastPrice==null?0:price>lastPrice?1:price<lastPrice?-1:0,el=$('#coinPrice');
  if(el){el.textContent=money(price);flash(el,dir)}lastPrice=price;
  const P=+(d.P??d.priceChangePercent),h=+(d.h??d.highPrice),l=+(d.l??d.lowPrice),change=$('#coinChange');
  if(change){change.textContent=`${pct(P)} 24h · high ${money(h)} · low ${money(l)}`;change.className=`card-meta ${P>0?'up':P<0?'down':'neutral'}`}
  const status=$('#coinStatus');if(status){status.className='status-pill';status.innerHTML='<span class="dot"></span>LIVE DATA'}
}
function paintKline(k){
  const series=window.__wavelengthCoinCandleSeries;if(!k||!series||typeof series.update!=='function')return;
  series.update({time:Math.floor(+(k.t??k[0])/1000),open:+(k.o??k[1]),high:+(k.h??k[2]),low:+(k.l??k[3]),close:+(k.c??k[4])});
}
function selectedInterval(){return document.querySelector('#timeframes .tab.active')?.dataset.tf||'4h'}

function connect(force=false){
  const interval=selectedInterval();
  if(!force&&ws?.readyState===WebSocket.OPEN&&interval===currentInterval)return;
  currentInterval=interval;clearTimeout(reconnectTimer);try{ws?.close()}catch{}
  const streams=`${pair.toLowerCase()}@ticker/${pair.toLowerCase()}@kline_${interval}`;
  ws=new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
  ws.onopen=()=>{lastMessageAt=Date.now()};
  ws.onmessage=e=>{try{const msg=JSON.parse(e.data),d=msg.data||msg;lastMessageAt=Date.now();if(d.e==='24hrTicker')paintTicker(d);else if(d.e==='kline')paintKline(d.k)}catch{}};
  ws.onclose=()=>{reconnectTimer=setTimeout(()=>connect(true),2500)};
  ws.onerror=()=>{try{ws.close()}catch{}};
}

async function pollTicker(){
  if(Date.now()-lastMessageAt<5000)return;
  try{const r=await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(pair)}`,{cache:'no-store'});if(r.ok)paintTicker(await r.json())}catch{}
}
async function pollKline(){
  if(Date.now()-lastMessageAt<5000)return;
  const interval=selectedInterval();
  try{const r=await fetch(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${encodeURIComponent(interval)}&limit=1`,{cache:'no-store'});if(r.ok){const rows=await r.json();if(rows?.[0])paintKline(rows[0])}}catch{}
}
function bindTimeframes(){document.querySelectorAll('#timeframes .tab').forEach(btn=>btn.addEventListener('click',()=>setTimeout(()=>connect(true),120)))}
function start(){
  connect(true);bindTimeframes();
  tickerPoll=setInterval(pollTicker,3000);klinePoll=setInterval(pollKline,5000);
  setInterval(()=>{if(lastMessageAt&&Date.now()-lastMessageAt>15000){try{ws?.close()}catch{}}},5000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
