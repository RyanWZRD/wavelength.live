(()=>{
'use strict';
if(window.__wavelengthLiveMarketRepaint)return;
window.__wavelengthLiveMarketRepaint=true;

let ws=null,reconnectTimer=null,paintTimer=null,lastTickAt=0;
const pending=new Map();
const money=v=>v==null||!Number.isFinite(+v)?'—':(+v>=1?'$'+(+v).toLocaleString('en-US',{maximumFractionDigits:2,minimumFractionDigits:2}):'$'+(+v).toLocaleString('en-US',{maximumFractionDigits:8}));
const compact=v=>v==null||!Number.isFinite(+v)?'—':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(+v);
const pct=v=>v==null||!Number.isFinite(+v)?'—':`${+v>=0?'+':''}${(+v).toLocaleString('en-US',{maximumFractionDigits:2,minimumFractionDigits:2})}%`;
const cls=v=>+v>0?'up':+v<0?'down':'neutral';

function symbols(){return [...new Set([...document.querySelectorAll('#marketBody tr[data-sym]')].map(r=>r.dataset.sym).filter(Boolean))]}
function applyDirection(el,value){if(!el)return;el.classList.remove('up','down','neutral');el.classList.add(cls(value))}
function paintOne(symbol,t){
  document.querySelectorAll(`#marketBody tr[data-sym="${CSS.escape(symbol)}"]`).forEach(row=>{
    const cells=row.children;if(cells.length<5)return;
    cells[2].textContent=money(t.price);
    cells[3].textContent=pct(t.change);
    applyDirection(cells[3],t.change);
    cells[4].textContent='$'+compact(t.volume);
  });
  document.querySelectorAll(`.mover[data-open="${CSS.escape(symbol)}"]`).forEach(card=>{
    const p=card.querySelector('.mover-price'),c=card.querySelector('.mover-change');
    if(p)p.textContent=money(t.price);
    if(c){
      const suffix=c.textContent.includes('· intel')?' · '+c.textContent.split('· ').slice(1).join('· '):'';
      c.textContent=pct(t.change)+suffix;
      applyDirection(c,t.change);
    }
  });
  document.querySelectorAll(`#derivativesBody tr[data-open="${CSS.escape(symbol)}"]`).forEach(row=>{
    const cells=row.children;if(cells.length<4)return;
    cells[3].textContent=pct(t.change);applyDirection(cells[3],t.change);
  });
}
function flush(){paintTimer=null;for(const [s,t] of pending){paintOne(s,t)}pending.clear()}
function schedulePaint(){if(paintTimer)return;paintTimer=setTimeout(flush,120)}
function feedState(state){
  const el=document.querySelector('#feedStatus');if(!el)return;
  if(state==='live'){el.className='status-pill';el.innerHTML='<span class="dot"></span>LIVE'}
  else if(state==='warn'){el.className='status-pill warn';el.innerHTML='<span class="dot"></span>RECONNECTING'}
}
function connect(){
  const syms=symbols();
  if(!syms.length){setTimeout(connect,350);return}
  if(ws)try{ws.close()}catch{}
  clearTimeout(reconnectTimer);
  const streams=syms.map(s=>`${s.toLowerCase()}usdt@ticker`).join('/');
  ws=new WebSocket('wss://stream.binance.com:9443/stream?streams='+streams);
  ws.onopen=()=>feedState('live');
  ws.onmessage=e=>{
    try{
      const d=JSON.parse(e.data).data;if(!d?.s?.endsWith('USDT'))return;
      const s=d.s.slice(0,-4);lastTickAt=Date.now();
      pending.set(s,{price:+d.c,change:+d.P,volume:+d.q});schedulePaint();
    }catch{}
  };
  ws.onclose=()=>{feedState('warn');reconnectTimer=setTimeout(connect,3000)};
  ws.onerror=()=>{try{ws.close()}catch{}};
}
setInterval(()=>{if(ws?.readyState===WebSocket.OPEN&&lastTickAt&&Date.now()-lastTickAt>15000){try{ws.close()}catch{}}},5000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect,{once:true});else connect();
})();
