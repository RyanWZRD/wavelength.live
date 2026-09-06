(()=>{
'use strict';
const qs=new URLSearchParams(location.search);
const symbol=(qs.get('symbol')||'ETH').toUpperCase().replace(/[^A-Z0-9]/g,'');
const pair=symbol+'USDT';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,d=1)=>v==null||!Number.isFinite(+v)?'—':(+v).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=v=>v==null||!Number.isFinite(+v)?'—':`${+v>=0?'+':''}${n(v,1)}%`;
const cls=v=>+v>0?'up':+v<0?'down':'neutral';
async function get(url){const r=await fetch(url);if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json()}
function ema(vals,p){if(vals.length<p)return null;let e=vals.slice(0,p).reduce((a,b)=>a+b,0)/p,k=2/(p+1);for(let i=p;i<vals.length;i++)e=vals[i]*k+e*(1-k);return e}
function rsi(vals,p=14){if(vals.length<=p)return null;let g=0,l=0;for(let i=1;i<=p;i++){const d=vals[i]-vals[i-1];g+=Math.max(0,d);l+=Math.max(0,-d)}g/=p;l/=p;for(let i=p+1;i<vals.length;i++){const d=vals[i]-vals[i-1];g=(g*(p-1)+Math.max(0,d))/p;l=(l*(p-1)+Math.max(0,-d))/p}return l===0?100:100-100/(1+g/l)}
function tfState(ks){const c=ks.map(k=>+k[4]),close=c.at(-1),e20=ema(c,20),e80=ema(c,80),e200=ema(c,200),R=rsi(c);let state='MIXED';if(e20>e80&&close>e200)state='BULLISH';else if(e20<e80&&close<e200)state='BEARISH';return{state,close,e20,e80,e200,rsi:R,change:100*(close/c[Math.max(0,c.length-2)]-1)}}
function metric(label,value,kind=''){return `<div class="metric"><div class="metric-label">${esc(label)}</div><div class="metric-value ${kind}">${esc(value)}</div></div>`}
function row(label,value,kind=''){return `<div class="analysis-row"><span class="analysis-label">${esc(label)}</span><strong class="${kind}">${esc(value)}</strong></div>`}
function card(title,meta,id){return `<section class="card" id="${id}"><div class="card-head"><div><div class="card-title">${title}</div><div class="card-meta">${meta}</div></div></div><div class="empty">Loading…</div></section>`}
function install(){
 const chart=document.querySelector('.chart-shell'); if(!chart)return;
 const wrap=document.createElement('div');wrap.id='coinTerminalV1';wrap.innerHTML=[
 card('Multi-timeframe regime','Independent market context · does not alter V3/Crowding','terminalTimeframes'),
 card('Historical analogue explorer','Similar past daily states · descriptive outcomes, never strategy evidence','terminalAnalogues'),
 card('Portfolio & correlation context','BTC relationship, watchlist overlap and current Wavelength PAPER exposure','terminalPortfolio'),
 card('Strategy permission boundary','Exactly what this coin is and is not authorised to do','terminalPermission')
 ].join('');
 chart.parentNode.insertBefore(wrap,chart.nextSibling);
}
async function loadTimeframes(){const el=$('#terminalTimeframes');if(!el)return;try{
 const specs=[['1h','1H'],['4h','4H'],['1d','1D'],['1w','1W']];
 const data=await Promise.all(specs.map(([tf])=>get(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${tf}&limit=240`)));
 const states=data.map((ks,i)=>({...tfState(ks),label:specs[i][1]}));
 const bulls=states.filter(x=>x.state==='BULLISH').length,bears=states.filter(x=>x.state==='BEARISH').length;
 const alignment=bulls>=3?'BROAD BULL ALIGNMENT':bears>=3?'BROAD BEAR ALIGNMENT':'MIXED TIMEFRAMES';
 el.querySelector('.card-meta').textContent=`${pair} · 1h / 4h / 1d / 1w · ${alignment}`;
 el.lastElementChild.outerHTML=`<div class="grid4">${states.map(s=>metric(s.label,`${s.state} · RSI ${n(s.rsi,0)}`,s.state==='BULLISH'?'up':s.state==='BEARISH'?'down':'neutral')).join('')}</div><div class="analysis-list" style="margin-top:12px">${row('Alignment',alignment,bulls>=3?'up':bears>=3?'down':'neutral')}${row('Bullish timeframes',`${bulls}/4`,bulls>=3?'up':'')}${row('Bearish timeframes',`${bears}/4`,bears>=3?'down':'')}${row('Research authority','CONTEXT ONLY · NO STRATEGY RULE CHANGES','accent')}</div>`;
 }catch(e){console.error(e);el.lastElementChild.outerHTML='<div class="empty">Multi-timeframe data unavailable for this market.</div>'}}
function returns(closes,i,h){return i+h<closes.length?100*(closes[i+h]/closes[i]-1):null}
async function loadAnalogues(){const el=$('#terminalAnalogues');if(!el)return;try{
 const ks=await get(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=1d&limit=1000`),c=ks.map(k=>+k[4]);
 if(c.length<260)throw new Error('insufficient history');
 const current={r:rsi(c),p20:c.at(-1)/ema(c,20)-1,p80:c.at(-1)/ema(c,80)-1,m30:100*(c.at(-1)/c[c.length-31]-1)};
 const matches=[];
 for(let i=220;i<c.length-8;i++){
   const hist=c.slice(0,i+1),r=rsi(hist),e20=ema(hist,20),e80=ema(hist,80),m30=100*(c[i]/c[i-30]-1);
   if(r==null||!e20||!e80)continue;
   const d=Math.abs(r-current.r)/12+Math.abs((c[i]/e20-1)-current.p20)*18+Math.abs((c[i]/e80-1)-current.p80)*10+Math.abs(m30-current.m30)/18;
   matches.push({i,d,r,m30,r1:returns(c,i,1),r3:returns(c,i,3),r7:returns(c,i,7),date:new Date(+ks[i][0]).toISOString().slice(0,10)});
 }
 matches.sort((a,b)=>a.d-b.d);const best=matches.slice(0,20);
 const avg=h=>{const xs=best.map(x=>x[h]).filter(Number.isFinite);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null};
 const hit=h=>{const xs=best.map(x=>x[h]).filter(Number.isFinite);return xs.length?100*xs.filter(x=>x>0).length/xs.length:null};
 const recent=best.slice(0,6);
 el.querySelector('.card-meta').textContent=`Nearest 20 historical daily states from up to 1,000 Binance candles · similarity uses RSI, EMA distance and 30d momentum`;
 el.lastElementChild.outerHTML=`<div class="grid3">${metric('Next 1d avg',pct(avg('r1')),cls(avg('r1')))}${metric('Next 3d avg',pct(avg('r3')),cls(avg('r3')))}${metric('Next 7d avg',pct(avg('r7')),cls(avg('r7')))}${metric('7d positive',`${n(hit('r7'),0)}%`,hit('r7')>=50?'up':'down')}${metric('Matches','20','')}${metric('Method','DESCRIPTIVE','accent')}</div><div class="table-wrap" style="margin-top:14px"><table class="market-table"><thead><tr><th class="left">Past state</th><th>Similarity</th><th>RSI</th><th>30d</th><th>+1d</th><th>+3d</th><th>+7d</th></tr></thead><tbody>${recent.map(x=>`<tr><td class="left">${x.date}</td><td>${n(x.d,2)}</td><td>${n(x.r,0)}</td><td class="${cls(x.m30)}">${pct(x.m30)}</td><td class="${cls(x.r1)}">${pct(x.r1)}</td><td class="${cls(x.r3)}">${pct(x.r3)}</td><td class="${cls(x.r7)}">${pct(x.r7)}</td></tr>`).join('')}</tbody></table></div><div class="card-meta" style="margin-top:12px">Analogue outcomes are contextual research only. They do not modify, validate, promote or create a trading signal.</div>`;
 }catch(e){console.error(e);el.lastElementChild.outerHTML='<div class="empty">Not enough reliable daily history to build analogue outcomes for this market.</div>'}}
function corr(a,b){const m=Math.min(a.length,b.length);if(m<20)return null;const x=a.slice(-m),y=b.slice(-m),mx=x.reduce((p,q)=>p+q,0)/m,my=y.reduce((p,q)=>p+q,0)/m;let num=0,dx=0,dy=0;for(let i=0;i<m;i++){const X=x[i]-mx,Y=y[i]-my;num+=X*Y;dx+=X*X;dy+=Y*Y}return dx&&dy?num/Math.sqrt(dx*dy):null}
function dailyReturns(ks){const c=ks.map(k=>+k[4]),r=[];for(let i=1;i<c.length;i++)r.push(c[i]/c[i-1]-1);return r}
async function loadPortfolio(){const el=$('#terminalPortfolio');if(!el)return;try{
 const requests=[get(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=1d&limit=120`)];if(symbol!=='BTC')requests.push(get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=120'));const [asset,btcRaw]=await Promise.all(requests);const btc=symbol==='BTC'?asset:btcRaw,c= corr(dailyReturns(asset),dailyReturns(btc));
 let ops=null,portfolio=null;try{[ops,portfolio]=await Promise.all([get(`paper-ops-status.json?t=${Date.now()}`),get(`paper-portfolio.json?t=${Date.now()}`)])}catch{}
 const managed=ops?.candidate_v3_managed===true;const simOpen=Array.isArray(portfolio?.positions)?portfolio.positions.length:0;const watch=new Set(JSON.parse(localStorage.getItem('wavelength_watchlist')||'[]'));const overlap=watch.has(symbol);
 const corrLabel=c==null?'UNKNOWN':c>=.75?'HIGH':c>=.45?'MODERATE':c>=0?'LOW':'NEGATIVE';
 el.querySelector('.card-meta').textContent=`90–120d daily-return relationship · current local watchlist and published PAPER state`;
 el.lastElementChild.outerHTML=`<div class="grid4">${metric('BTC correlation',c==null?'—':n(c,2),c>=.75?'accent':'')}${metric('Correlation read',corrLabel,corrLabel==='HIGH'?'accent':'')}${metric('On watchlist',overlap?'YES':'NO',overlap?'up':'')}${metric('V3 broker managed',managed?'YES':'NO',managed?'up':'neutral')}</div><div class="analysis-list" style="margin-top:12px">${row('Legacy simulated open positions',simOpen)}${row('Portfolio interpretation',c>=.75?'Moves have been tightly linked to BTC; adding exposure would provide limited diversification.':c>=.45?'BTC relationship is meaningful but not dominant.':'Recent BTC relationship is relatively low or negative.','')}${row('Risk authority','OBSERVATION ONLY · PORTFOLIO GOVERNOR REMAINS SEPARATE','accent')}</div>`;
 }catch(e){console.error(e);el.lastElementChild.outerHTML='<div class="empty">Portfolio/correlation context unavailable.</div>'}}
async function loadPermission(){const el=$('#terminalPermission');if(!el)return;let validation=null,graduation=null;try{[validation,graduation]=await Promise.all([get(`validation.json?t=${Date.now()}`),get(`paper-graduation.json?t=${Date.now()}`)])}catch{}
 const isEth=symbol==='ETH';let v3='NOT APPLICABLE';let lifecycle='RESEARCH ONLY';let detail='Candidate V3 validation does not transfer to this asset.';
 if(isEth){v3='FROZEN VALIDATION ASSET';lifecycle='SHADOW / PAPER REHEARSAL';detail='ETH/USD is Candidate V3’s frozen validation asset. Genuine V3 signals may enter Alpaca PAPER, but the strategy rules remain frozen and forward gates are unchanged.'}
 const crowd='NO INHERITED AUTHORITY';
 el.querySelector('.card-meta').textContent=`Frozen strategies stay isolated from Coin Intelligence Terminal research`;
 el.lastElementChild.outerHTML=`<div class="grid2"><div class="analysis-list">${row('Candidate V3',v3,isEth?'up':'neutral')}${row('V3 lifecycle',lifecycle,isEth?'accent':'neutral')}${row('Crowding v2',crowd,'neutral')}${row('Terminal order authority','NONE','up')}</div><div class="context-list"><div class="context-item"><strong>${isEth?'ETH validation boundary':'Research-only asset'}</strong><p>${esc(detail)}</p></div><div class="context-item"><strong>Hard separation</strong><p>Multi-timeframe reads, analogue outcomes, fundamentals, correlation and intelligence scores cannot alter V3/Crowding parameters, generate strategy permission, or count toward their graduation evidence.</p></div></div></div>`;
}
async function loadAll(){await Promise.allSettled([loadTimeframes(),loadAnalogues(),loadPortfolio(),loadPermission()])}
function start(){install();loadAll();setInterval(()=>{loadTimeframes();loadPortfolio();loadPermission()},5*60*1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
