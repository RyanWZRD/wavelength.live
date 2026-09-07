(()=>{
'use strict';
if(window.__wavelengthCoinBootstrapResilience)return;
window.__wavelengthCoinBootstrapResilience=true;

/* Canonicalise any pair-shaped or accidental display-text symbol before coin.js reads it. */
const q=new URLSearchParams(location.search);
let raw=(q.get('symbol')||'BTC').trim();
const aliases={BITCOINBTC:'BTC',ETHEREUMETH:'ETH',SOLANASOL:'SOL',CARDANOADA:'ADA',DOGECOINDOGE:'DOGE',CHAINLINKLINK:'LINK',AVALANCHEAVAX:'AVAX',POLKADOTDOT:'DOT',LITECOINLTC:'LTC',STELLARXLM:'XLM',TONCOINTON:'TON',TRONTRX:'TRX',SHIBAINUSHIB:'SHIB',UNISWAPUNI:'UNI'};
const camelTail=raw.match(/([A-Z][A-Z0-9]{1,9})$/);
if(camelTail&&/[a-z]/.test(raw.slice(0,camelTail.index)))raw=camelTail[1];
let canonical=raw.toUpperCase().replace(/[^A-Z0-9]/g,'');
for(const quote of ['USDT','USDC','BUSD','USD'])if(canonical.endsWith(quote)&&canonical.length>quote.length){canonical=canonical.slice(0,-quote.length);break}
canonical=aliases[canonical]||canonical||'BTC';
if(q.get('symbol')!==canonical){q.set('symbol',canonical);history.replaceState(null,'',`${location.pathname}?${q.toString()}${location.hash}`)}
window.WavelengthCoinSymbol=canonical;

/* Browser REST resilience: UK networks and public API edges can reject one Binance hostname while another works. */
const nativeFetch=window.fetch.bind(window);
const SPOT=['api.binance.com','api1.binance.com','api2.binance.com','api3.binance.com','data-api.binance.vision'];
const FUT=['fapi.binance.com','fapi1.binance.com','fapi2.binance.com','fapi3.binance.com'];
function candidates(input){let u;try{u=new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}const hosts=SPOT.includes(u.hostname)?SPOT:FUT.includes(u.hostname)?FUT:null;if(!hosts)return null;return hosts.map(h=>{const x=new URL(u.href);x.hostname=h;return x.href})}
window.fetch=async function(input,init){const list=candidates(input);if(!list)return nativeFetch(input,init);let lastResponse,lastError;for(const url of list){try{const r=await nativeFetch(url,{...init,cache:'no-store'});lastResponse=r;if(r.ok)return r;if(![418,429,451,500,502,503,504].includes(r.status))return r}catch(e){lastError=e}}if(lastResponse)return lastResponse;throw lastError||new Error('All public market-data endpoints failed')};

/* Lightweight Charts compatibility. The page previously depended on an unpinned CDN build.
   Support both v4 and v5 APIs and provide a local lightweight fallback so a chart-CDN failure
   cannot prevent ticker, indicators, relative strength or fundamentals from starting. */
function installFallback(){
  const api={CandlestickSeries:{kind:'candles'},LineSeries:{kind:'line'}};
  api.createChart=function(el){
    let firstSeries=true,closeData=[];
    const canvas=document.createElement('canvas');canvas.style.width='100%';canvas.style.height='100%';canvas.style.display='block';el.innerHTML='';el.appendChild(canvas);
    function draw(){const r=el.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=Math.max(1,r.width),h=Math.max(260,r.height||420);canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(closeData.length<2)return;const vals=closeData.map(x=>Number(x.close??x.value)).filter(Number.isFinite);if(vals.length<2)return;const lo=Math.min(...vals),hi=Math.max(...vals),span=hi-lo||1,pad=22;ctx.strokeStyle='#9db5d8';ctx.lineWidth=2;ctx.beginPath();vals.forEach((v,i)=>{const x=pad+i*(w-pad*2)/(vals.length-1),y=pad+(hi-v)*(h-pad*2)/span;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
    window.addEventListener('resize',draw);
    return {addSeries(){const isFirst=firstSeries;firstSeries=false;return{setData(data){if(isFirst){closeData=data||[];draw()}}}},timeScale(){return{fitContent(){draw()}}},applyOptions(){draw()}};
  };
  window.LightweightCharts=api;
}

const lw=window.LightweightCharts;
if(!lw||typeof lw.createChart!=='function')installFallback();
else{
  const originalCreate=lw.createChart.bind(lw);
  if(!lw.CandlestickSeries)lw.CandlestickSeries={kind:'candles'};
  if(!lw.LineSeries)lw.LineSeries={kind:'line'};
  lw.createChart=function(el,opts){
    const chart=originalCreate(el,opts);
    if(typeof chart.addSeries!=='function'){
      let count=0;
      chart.addSeries=function(_seriesType,seriesOpts){count++;if(count===1&&typeof chart.addCandlestickSeries==='function')return chart.addCandlestickSeries(seriesOpts);if(typeof chart.addLineSeries==='function')return chart.addLineSeries(seriesOpts);return{setData(){}}};
    }
    return chart;
  };
}

/* Independent fundamentals recovery when CoinGecko is throttled. */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compact=v=>v==null||!Number.isFinite(+v)?'—':new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:2}).format(+v);
const money=v=>v==null||!Number.isFinite(+v)?'—':(+v>=1?'$'+(+v).toLocaleString('en-GB',{maximumFractionDigits:2,minimumFractionDigits:2}):'$'+(+v).toLocaleString('en-GB',{maximumFractionDigits:8}));
const fact=(label,value)=>`<div class="fact"><dt>${esc(label)}</dt><dd>${value==null||value===''?'—':value}</dd></div>`;
async function paprika(path){const r=await nativeFetch('https://api.coinpaprika.com/v1'+path,{cache:'no-store'});if(!r.ok)throw new Error(`CoinPaprika ${r.status}`);return r.json()}
async function recoverFundamentals(){
  const market=document.querySelector('#marketFacts'),project=document.querySelector('#projectFacts');if(!market||!project)return;
  if(market.querySelector('.fact')||project.querySelector('.fact'))return;
  const txt=(market.textContent+' '+project.textContent).toLowerCase();if(!txt.includes('unavailable')&&!txt.includes('loading'))return;
  try{
    const s=await paprika(`/search?q=${encodeURIComponent(canonical)}&c=currencies&limit=10`),hit=(s.currencies||[]).find(x=>String(x.symbol||'').toUpperCase()===canonical)||(s.currencies||[])[0];if(!hit?.id)throw new Error('No fallback match');
    const [ticker,coin]=await Promise.all([paprika(`/tickers/${encodeURIComponent(hit.id)}`),paprika(`/coins/${encodeURIComponent(hit.id)}`).catch(()=>null)]),usd=ticker?.quotes?.USD||{};
    market.innerHTML=[fact('Market cap',usd.market_cap==null?'—':'$'+compact(usd.market_cap)),fact('Fully diluted value',usd.fully_diluted_market_cap==null?'—':'$'+compact(usd.fully_diluted_market_cap)),fact('24h volume',usd.volume_24h==null?'—':'$'+compact(usd.volume_24h)),fact('Circulating supply',ticker?.circulating_supply==null?'—':compact(ticker.circulating_supply)+' '+canonical),fact('Total supply',ticker?.total_supply==null?'—':compact(ticker.total_supply)+' '+canonical),fact('Max supply',ticker?.max_supply==null?'—':compact(ticker.max_supply)+' '+canonical),fact('All-time high',usd.ath_price==null?'—':money(usd.ath_price)),fact('Market-cap rank',ticker?.rank==null?'—':'#'+ticker.rank)].join('');
    const tags=(coin?.tags||[]).slice(0,5).map(x=>x.name||x).join(', '),site=(coin?.links?.website||[])[0]||coin?.links?.website?.[0];
    project.innerHTML=[fact('Name',esc(ticker?.name||coin?.name||canonical)),fact('Categories',esc(tags||'—')),fact('Started',esc(coin?.started_at||'—')),fact('CoinPaprika ID',esc(hit.id)),fact('Homepage',site?`<a href="${esc(site)}" target="_blank" rel="noopener">Official site ↗</a>`:'—'),fact('Source','CoinPaprika fallback')].join('');
    const title=document.querySelector('#coinTitle');if(title&&ticker?.name&&!title.textContent.includes(ticker.name))title.textContent=`${ticker.name} (${canonical})`;
  }catch(e){console.warn('Coin fundamentals fallback unavailable',e)}
}
function startRecovery(){setTimeout(recoverFundamentals,2500);setTimeout(recoverFundamentals,5500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startRecovery,{once:true});else startRecovery();
})();
