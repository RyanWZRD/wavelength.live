(()=>{
'use strict';
if(window.__wavelengthAssetLiveChartV2)return;window.__wavelengthAssetLiveChartV2=true;
const $=s=>document.querySelector(s);
const qp=new URLSearchParams(location.search);
let base=String(window.WavelengthAssetSymbol||qp.get('symbol')||'BTC').toUpperCase().replace(/[^A-Z0-9]/g,'');
if(base.length%2===0){const h=base.length/2;if(base.slice(0,h)===base.slice(h))base=base.slice(0,h)}
const pair=`${base}USDT`, streamPair=pair.toLowerCase();
const INTERVALS=['1s','1m','5m','15m','30m','1h','4h','1d'];
let interval=localStorage.getItem('wavelength_asset_chart_interval')||'4h';if(!INTERVALS.includes(interval))interval='4h';
let chartType=localStorage.getItem('wavelength_asset_chart_type')||'candles';if(!['candles','line'].includes(chartType))chartType='candles';
let rows=[],ws=null,reconnect=null,hover=-1,raf=0,lastTrade=0;
const money=v=>v==null||!Number.isFinite(+v)?'—':(+v>=1?'$'+(+v).toLocaleString('en-GB',{maximumFractionDigits:2,minimumFractionDigits:2}):'$'+(+v).toLocaleString('en-GB',{maximumFractionDigits:8}));
function apiInterval(v){return v}
async function getJSON(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${r.status}`);return r.json()}
function ensure(){
 const old=$('#priceChart'),wrap=old?.closest('.chart-wrap'),head=wrap?.parentElement?.querySelector('.card-head');if(!old||!wrap||!head)return false;
 old.style.display='none';
 let canvas=$('#livePriceChart');if(!canvas){canvas=document.createElement('canvas');canvas.id='livePriceChart';canvas.style.cssText='width:100%;height:100%;display:block';wrap.insertBefore(canvas,wrap.firstChild)}
 let tip=$('#liveChartTip');if(!tip){tip=document.createElement('div');tip.id='liveChartTip';tip.className='tooltip';wrap.appendChild(tip)}
 const controls=head.querySelector('.range-row');if(controls&&!controls.dataset.liveV2){
   controls.dataset.liveV2='1';controls.innerHTML=`<span class="chart-mode-group"><button class="range-btn chart-type-btn" data-chart-type="candles">Candles</button><button class="range-btn chart-type-btn" data-chart-type="line">Line</button></span><span class="chart-interval-group">${INTERVALS.map(x=>`<button class="range-btn chart-int-btn" data-chart-interval="${x}">${x.toUpperCase()}</button>`).join('')}</span>`;
   controls.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;if(t.dataset.chartType){chartType=t.dataset.chartType;localStorage.setItem('wavelength_asset_chart_type',chartType);paintButtons();scheduleDraw()}if(t.dataset.chartInterval&&t.dataset.chartInterval!==interval){interval=t.dataset.chartInterval;localStorage.setItem('wavelength_asset_chart_interval',interval);paintButtons();load().then(connect)}})
 }
 paintButtons();bindHover(canvas,tip);return true;
}
function paintButtons(){document.querySelectorAll('.chart-type-btn').forEach(b=>b.classList.toggle('active',b.dataset.chartType===chartType));document.querySelectorAll('.chart-int-btn').forEach(b=>b.classList.toggle('active',b.dataset.chartInterval===interval))}
function normalise(k){return {t:+k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5],T:+k[6]}}
async function load(){
 try{const raw=await getJSON(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${apiInterval(interval)}&limit=300`);rows=raw.map(normalise);hover=-1;setMeta('LIVE');scheduleDraw()}catch(e){setMeta('UNAVAILABLE');}
}
function setMeta(state){const m=$('#chartMeta');if(m)m.textContent=`${base}/USDT · ${interval.toUpperCase()} · ${chartType==='candles'?'CANDLES':'LINE'} · ${state}`}
function connect(){
 clearTimeout(reconnect);if(ws){ws.onclose=null;try{ws.close()}catch{}};
 const streams=`${streamPair}@aggTrade/${streamPair}@kline_${interval}`;
 try{ws=new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)}catch{return}
 ws.onopen=()=>setMeta('LIVE');
 ws.onmessage=e=>{try{const m=JSON.parse(e.data),d=m.data||{};if(d.e==='aggTrade')applyTrade(+d.p,+d.T);else if(d.e==='kline')applyKline(d.k)}catch{}};
 ws.onerror=()=>{try{ws.close()}catch{}};
 ws.onclose=()=>{setMeta('RECONNECTING');reconnect=setTimeout(connect,1800)};
}
function intervalMs(v){const m={ '1s':1000,'1m':60000,'5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'4h':14400000,'1d':86400000};return m[v]||14400000}
function applyTrade(price,ts){if(!Number.isFinite(price)||!rows.length)return;lastTrade=price;let r=rows[rows.length-1],bucket=Math.floor(ts/intervalMs(interval))*intervalMs(interval);if(bucket>r.t){rows.push({t:bucket,o:r.c,h:price,l:price,c:price,v:0,T:bucket+intervalMs(interval)-1});if(rows.length>300)rows.shift();r=rows[rows.length-1]}else if(bucket===r.t){r.c=price;r.h=Math.max(r.h,price);r.l=Math.min(r.l,price)}scheduleDraw()}
function applyKline(k){if(!k)return;const r={t:+k.t,o:+k.o,h:+k.h,l:+k.l,c:+k.c,v:+k.v,T:+k.T},last=rows[rows.length-1];if(last&&last.t===r.t)rows[rows.length-1]=r;else if(!last||r.t>last.t){rows.push(r);if(rows.length>300)rows.shift()}scheduleDraw();setMeta('LIVE')}
function scheduleDraw(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;draw()})}
function draw(){
 const canvas=$('#livePriceChart');if(!canvas||!rows.length)return;const rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;if(rect.width<10||rect.height<10)return;canvas.width=Math.floor(rect.width*dpr);canvas.height=Math.floor(rect.height*dpr);const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);const w=rect.width,h=rect.height,p={l:12,r:72,t:18,b:28};
 const lows=rows.map(r=>chartType==='candles'?r.l:r.c),highs=rows.map(r=>chartType==='candles'?r.h:r.c),lo=Math.min(...lows),hi=Math.max(...highs),span=(hi-lo)||1;const plotW=w-p.l-p.r,plotH=h-p.t-p.b,x=i=>p.l+(i+.5)*plotW/rows.length,y=v=>p.t+(hi-v)*plotH/span;
 ctx.clearRect(0,0,w,h);ctx.font='10px IBM Plex Mono';for(let i=0;i<5;i++){const yy=p.t+i*plotH/4;ctx.globalAlpha=.17;ctx.strokeStyle='#94a3b8';ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(w-p.r,yy);ctx.stroke();ctx.globalAlpha=.75;ctx.fillStyle='#94a3b8';ctx.fillText(money(hi-i*span/4),w-p.r+8,yy+3)}ctx.globalAlpha=1;
 if(chartType==='line'){ctx.strokeStyle='#9db5d8';ctx.lineWidth=2;ctx.beginPath();rows.forEach((r,i)=>i?ctx.lineTo(x(i),y(r.c)):ctx.moveTo(x(i),y(r.c)));ctx.stroke()}else{
   const cw=Math.max(1.2,Math.min(8,plotW/rows.length*.68));rows.forEach((r,i)=>{const xx=x(i),up=r.c>=r.o,top=y(Math.max(r.o,r.c)),bot=y(Math.min(r.o,r.c));ctx.strokeStyle=up?'#49d17d':'#ef6b73';ctx.fillStyle=up?'#49d17d':'#ef6b73';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xx,y(r.h));ctx.lineTo(xx,y(r.l));ctx.stroke();ctx.fillRect(xx-cw/2,top,cw,Math.max(1,bot-top))})
 }
 if(hover>=0&&hover<rows.length){const r=rows[hover],xx=x(hover);ctx.strokeStyle='#64748b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xx,p.t);ctx.lineTo(xx,h-p.b);ctx.stroke()}
 const live=rows[rows.length-1]?.c;if(Number.isFinite(live)){const yy=y(live);ctx.globalAlpha=.9;ctx.fillStyle='#cbd5e1';ctx.fillRect(w-p.r,yy-9,p.r,18);ctx.fillStyle='#0f172a';ctx.font='10px IBM Plex Mono';ctx.fillText(money(live),w-p.r+5,yy+3);ctx.globalAlpha=1}
}
function bindHover(c,tip){if(c.dataset.hoverV2)return;c.dataset.hoverV2='1';c.addEventListener('mousemove',e=>{if(!rows.length)return;const r=c.getBoundingClientRect(),plotW=r.width-84,ratio=Math.max(0,Math.min(1,(e.clientX-r.left-12)/plotW));hover=Math.max(0,Math.min(rows.length-1,Math.floor(ratio*rows.length)));const k=rows[hover];tip.style.display='block';tip.style.left=Math.min(r.width-220,e.clientX-r.left+12)+'px';tip.style.top=Math.max(6,e.clientY-r.top-54)+'px';tip.textContent=chartType==='candles'?`${new Date(k.t).toLocaleString()} · O ${money(k.o)} H ${money(k.h)} L ${money(k.l)} C ${money(k.c)}`:`${new Date(k.t).toLocaleString()} · ${money(k.c)}`;scheduleDraw()});c.addEventListener('mouseleave',()=>{hover=-1;tip.style.display='none';scheduleDraw()})}
function start(){if(!ensure()){setTimeout(start,150);return}load().then(connect);addEventListener('resize',scheduleDraw);new MutationObserver(()=>{ensure();scheduleDraw()}).observe(document.querySelector('.page.asset-shell')||document.body,{childList:true,subtree:false})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
