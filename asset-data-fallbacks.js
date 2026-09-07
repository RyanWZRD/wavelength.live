(()=>{
'use strict';
if(window.__wavelengthAssetDataFallbacks)return;
window.__wavelengthAssetDataFallbacks=true;

const nativeFetch=window.fetch.bind(window);
const SPOT_HOSTS=['api.binance.com','api1.binance.com','api2.binance.com','api3.binance.com','data-api.binance.vision'];
const FUTURES_HOSTS=['fapi.binance.com','fapi1.binance.com','fapi2.binance.com','fapi3.binance.com'];

function hostCandidates(url){
  let u;
  try{u=new URL(url,location.href)}catch{return null}
  const spot=SPOT_HOSTS.includes(u.hostname),fut=FUTURES_HOSTS.includes(u.hostname);
  if(!spot&&!fut)return null;
  const hosts=spot?SPOT_HOSTS:FUTURES_HOSTS;
  return hosts.map(h=>{const x=new URL(u.href);x.hostname=h;return x.href});
}

async function resilientFetch(input,init){
  const raw=typeof input==='string'?input:input?.url;
  const candidates=raw?hostCandidates(raw):null;
  if(!candidates)return nativeFetch(input,init);
  let lastError=null,lastResponse=null;
  for(const url of candidates){
    try{
      const r=await nativeFetch(url,{...init,cache:'no-store'});
      lastResponse=r;
      if(r.ok)return r;
      // Retry rate limit, geo restriction and transient upstream failures.
      if(![418,429,451,500,502,503,504].includes(r.status))return r;
    }catch(e){lastError=e}
  }
  if(lastResponse)return lastResponse;
  throw lastError||new Error('All market-data endpoints failed');
}
window.fetch=resilientFetch;

const $=s=>document.querySelector(s);
const n=(v,d=2)=>v==null||!Number.isFinite(+v)?'—':(+v).toLocaleString('en-GB',{maximumFractionDigits:d,minimumFractionDigits:d});
const compact=v=>v==null||!Number.isFinite(+v)?'—':new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:2}).format(+v);
const money=v=>v==null||!Number.isFinite(+v)?'—':(+v>=1?'$'+(+v).toLocaleString('en-GB',{maximumFractionDigits:2,minimumFractionDigits:2}):'$'+(+v).toLocaleString('en-GB',{maximumFractionDigits:8}));

function symbol(){
  const q=new URLSearchParams(location.search);
  return (window.WavelengthAssetSymbol||q.get('symbol')||'BTC').toUpperCase().replace(/[^A-Z0-9]/g,'');
}

async function paprikaJSON(path){
  const r=await nativeFetch('https://api.coinpaprika.com/v1'+path,{cache:'no-store'});
  if(!r.ok)throw new Error(`CoinPaprika ${r.status}`);
  return r.json();
}

async function loadFundamentalsFallback(){
  const root=$('#fundamentalMetrics'),desc=$('#fundamentalDescription');
  if(!root)return;
  // Leave successful CoinGecko data alone.
  if(root.querySelector('.metric-row'))return;
  const text=(root.textContent||'').toLowerCase();
  if(!text.includes('unavailable')&&!text.includes('rate-limited')&&!text.includes('loading'))return;
  const sym=symbol();
  try{
    const search=await paprikaJSON(`/search?q=${encodeURIComponent(sym)}&c=currencies&limit=10`);
    const hit=(search.currencies||[]).find(x=>String(x.symbol||'').toUpperCase()===sym)||(search.currencies||[])[0];
    if(!hit?.id)throw new Error('No fundamentals match');
    const [ticker,coin]=await Promise.all([
      paprikaJSON(`/tickers/${encodeURIComponent(hit.id)}`),
      paprikaJSON(`/coins/${encodeURIComponent(hit.id)}`).catch(()=>null)
    ]);
    const usd=ticker?.quotes?.USD||{};
    const vals=[
      ['Market cap',usd.market_cap==null?'—':'$'+compact(usd.market_cap)],
      ['FDV',usd.fully_diluted_market_cap==null?'—':'$'+compact(usd.fully_diluted_market_cap)],
      ['Circulating supply',compact(ticker?.circulating_supply)],
      ['Max supply',compact(ticker?.max_supply)],
      ['Market-cap rank',ticker?.rank==null?'—':'#'+ticker.rank],
      ['ATH',usd.ath_price==null?'—':money(usd.ath_price)]
    ];
    root.innerHTML=vals.map(x=>`<div class="metric-row"><small>${x[0]}</small><b>${x[1]}</b></div>`).join('');
    if(desc){
      const d=String(coin?.description||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      desc.textContent=(d?d.slice(0,420)+(d.length>420?'…':''):'Fundamentals supplied by fallback public market data.')+' · Fallback: CoinPaprika';
    }
    const name=$('#assetName');
    if(name&&ticker?.name)name.textContent=`${ticker.name} · ${sym}/USDT`;
  }catch(e){
    console.warn('Fundamentals fallback unavailable',e);
    if(root&&!root.querySelector('.metric-row'))root.innerHTML='<div class="empty">Public fundamentals providers are temporarily unavailable. Price, chart and technical analysis can still operate independently.</div>';
  }
}

function showDataHealth(){
  const chartMeta=$('#chartMeta'),tech=$('#technicalMetrics');
  if(chartMeta&&/unavailable/i.test(chartMeta.textContent||'')&&tech&&!tech.querySelector('.metric-row')){
    tech.innerHTML='<div class="empty">Market candle providers are temporarily unreachable from this browser. Wavelength tried multiple Binance public endpoints automatically.</div>';
  }
}

function start(){
  setTimeout(loadFundamentalsFallback,2200);
  setTimeout(loadFundamentalsFallback,5000);
  setTimeout(showDataHealth,6500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
