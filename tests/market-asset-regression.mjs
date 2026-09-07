import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const baseURL=process.env.WL_TEST_URL||'http://127.0.0.1:4173';

// Source-level invariants catch the exact regressions that previously reached production.
const normalizer=fs.readFileSync('asset-symbol-normalizer.js','utf8');
const asset=fs.readFileSync('asset.js','utf8');
const shell=fs.readFileSync('terminal-shell.js','utf8');
const html=fs.readFileSync('asset.html','utf8');
assert.match(normalizer,/s\.slice\(0,h\)===s\.slice\(h\)/,'duplicated ticker invariant missing');
assert.match(asset,/window\.WavelengthAssetSymbol/,'asset engine must consume canonical symbol');
assert.match(asset,/wss:\/\/stream\.binance\.com:9443\/stream\?streams=/,'asset live combined stream missing');
assert.match(asset,/applyLiveTicker/,'live ticker updater missing');
assert.match(asset,/applyLiveKline/,'live candle updater missing');
assert.match(shell,/e\.ctrlKey\|\|e\.metaKey\|\|e\.altKey\|\|e\.shiftKey/,'browser modifier/F-key guard missing');
assert.match(html,/asset-decision-evidence\.js/,'Decision Evidence is not wired into asset page');

const candles=[];
const start=Date.UTC(2026,0,1);
for(let i=0;i<300;i++){
  const openTime=start+i*4*60*60*1000;
  const open=50000+i*30;
  const close=open+20+(i%7);
  candles.push([openTime,String(open),String(close+80),String(open-80),String(close),String(100+i),openTime+14399999,String((100+i)*close),1000+i,'50','2500000','0']);
}
const lastOpen=candles.at(-1)[0];

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});

await page.addInitScript(({lastOpen})=>{
  class FakeWebSocket {
    static CONNECTING=0; static OPEN=1; static CLOSING=2; static CLOSED=3;
    constructor(url){
      this.url=url;this.readyState=FakeWebSocket.CONNECTING;window.__wlFakeSocketURL=url;window.__wlFakeTickerCount=0;
      setTimeout(()=>{
        this.readyState=FakeWebSocket.OPEN;this.onopen?.({type:'open'});
        const send=(data)=>this.onmessage?.({data:JSON.stringify({stream:'mock',data})});
        setTimeout(()=>{window.__wlFakeTickerCount++;send({e:'24hrTicker',c:'60001.00',P:'1.10',h:'61000',l:'58000',q:'2500000000',n:123456});},120);
        setTimeout(()=>{window.__wlFakeTickerCount++;send({e:'24hrTicker',c:'60002.50',P:'1.12',h:'61000',l:'58000',q:'2501000000',n:123500});},360);
        setTimeout(()=>send({e:'kline',k:{t:lastOpen,T:lastOpen+14399999,o:'58970',h:'60100',l:'58800',c:'60002.50',v:'155',q:'9300000',n:1200,V:'80',Q:'4800000'}}),520);
      },60);
    }
    close(){this.readyState=FakeWebSocket.CLOSED;this.onclose?.({type:'close'});}
    send(){}
  }
  window.WebSocket=FakeWebSocket;
}, {lastOpen});

await page.route('https://api.binance.com/**',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname.includes('/ticker/24hr')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({lastPrice:'60000.00',priceChangePercent:'1.00',highPrice:'61000',lowPrice:'58000',quoteVolume:'2500000000',count:123000})});
  if(u.pathname.includes('/klines')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(candles)});
  return route.fulfill({status:404,body:'{}'});
});
await page.route('https://fapi.binance.com/**',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname.includes('/premiumIndex')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({lastFundingRate:'0.0001'})});
  if(u.pathname.includes('/openInterestHist')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{sumOpenInterestValue:'1000000'},{sumOpenInterestValue:'1030000'}])});
  return route.fulfill({status:404,body:'{}'});
});
await page.route('https://api.coingecko.com/**',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname.endsWith('/search')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({coins:[{id:'bitcoin',symbol:'btc',market_cap_rank:1}]})});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'bitcoin',name:'Bitcoin',symbol:'btc',market_cap_rank:1,categories:['Layer 1'],genesis_date:'2009-01-03',market_data:{market_cap:{usd:1200000000000},fully_diluted_valuation:{usd:1250000000000},total_volume:{usd:30000000000},circulating_supply:19900000,total_supply:19900000,max_supply:21000000,ath:{usd:70000},ath_change_percentage:{usd:-14},price_change_percentage_7d:2,price_change_percentage_30d:4,price_change_percentage_1y:45,market_cap_change_percentage_24h:1},description:{en:'Bitcoin test fixture.'},links:{homepage:['https://bitcoin.org'],blockchain_site:['https://mempool.space']}})});
});
await page.route('https://fonts.googleapis.com/**',r=>r.abort());
await page.route('https://fonts.gstatic.com/**',r=>r.abort());

// Hard regression: duplicated ticker must be canonical before any market request.
await page.goto(`${baseURL}/asset.html?symbol=BTCBTC`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>new URLSearchParams(location.search).get('symbol')==='BTC');
assert.equal(new URL(page.url()).searchParams.get('symbol'),'BTC');
await page.waitForFunction(()=>document.querySelector('#assetSymbol')?.textContent?.trim()==='BTC');
await page.waitForFunction(()=>!/Loading|Calculating/i.test(document.querySelector('#technicalMetrics')?.textContent||''));
await page.waitForFunction(()=>!/Loading/i.test(document.querySelector('#fundamentalMetrics')?.textContent||''));
await page.waitForFunction(()=>(window.__wlFakeTickerCount||0)>=2);
await page.waitForFunction(()=>document.querySelector('#assetFeed')?.textContent?.includes('LIVE STREAM'));
assert.match(await page.locator('#assetPrice').innerText(),/60,002\.50/,'headline price did not receive live ticker update');
assert.ok((await page.locator('#priceChart').evaluate(c=>c.width))>0,'chart canvas was not rendered');
assert.match(await page.locator('#chartMeta').innerText(),/LIVE/,'current candle did not receive live kline update');
await page.waitForSelector('#decisionEvidence');
assert.doesNotMatch(await page.locator('#decisionEvidence').innerText(),/Waiting for market evidence/i);
assert.match(await page.locator('#decisionEvidenceBoundary').innerText(),/RESEARCH PRIORITISATION ONLY/);
assert.match(await page.evaluate(()=>window.__wlFakeSocketURL||''),/btcusdt@ticker\/btcusdt@kline_4h/,'wrong websocket symbol/timeframe');

// Navigation regression: one Markets click must settle directly on #markets.
await page.goto(`${baseURL}/index.html`,{waitUntil:'domcontentloaded'});
await page.waitForSelector('#markets');
const marketsLink=page.locator('a[href*="#markets"]').first();
await marketsLink.click();
await page.waitForFunction(()=>location.hash==='#markets');
assert.equal(new URL(page.url()).hash,'#markets');

await browser.close();
console.log('Wavelength Markets + Asset regression suite passed');
