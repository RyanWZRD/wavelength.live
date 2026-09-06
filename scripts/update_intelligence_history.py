#!/usr/bin/env python3
from __future__ import annotations
import json, math, statistics, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from intelligence_model import MODEL, VERSION, canonical_score

OUT=Path('intelligence-history.json')
MAX_COINS=40
KEEP=540
SPOT='https://data-api.binance.vision/api/v3'
EXCLUDE={'USDC','BUSD','TUSD','FDUSD','USDP','DAI','EUR','GBP','EURI','USTC','PAX','UST','WBTC','WBETH'}
MARKET_CONTEXT_MODEL='WAVELENGTH_MARKET_CONTEXT_V1'
MARKET_CONTEXT_VERSION=1

def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':'wavelength-intelligence-history/1.0'})
    with urllib.request.urlopen(req,timeout=8) as r:return json.load(r)

def ema(vals,p):
    if len(vals)<p:return None
    e=sum(vals[:p])/p;k=2/(p+1)
    for x in vals[p:]:e=x*k+e*(1-k)
    return e

def rsi(vals,p=14):
    if len(vals)<=p:return None
    g=l=0.0
    for i in range(1,p+1):d=vals[i]-vals[i-1];g+=max(d,0);l+=max(-d,0)
    g/=p;l/=p
    for i in range(p+1,len(vals)):
        d=vals[i]-vals[i-1];g=(g*(p-1)+max(d,0))/p;l=(l*(p-1)+max(-d,0))/p
    return 100.0 if l==0 else 100-100/(1+g/l)

def atr_adx(ks,p=14):
    if len(ks)<p*2+2:return None,None
    tr=[];plus=[];minus=[]
    for i in range(1,len(ks)):
        h=float(ks[i][2]);lo=float(ks[i][3]);pc=float(ks[i-1][4]);ph=float(ks[i-1][2]);pl=float(ks[i-1][3]);up=h-ph;down=pl-lo
        tr.append(max(h-lo,abs(h-pc),abs(lo-pc)));plus.append(up if up>down and up>0 else 0.0);minus.append(down if down>up and down>0 else 0.0)
    a=sum(tr[:p])/p;ps=sum(plus[:p])/p;ms=sum(minus[:p])/p;dx=[]
    for i in range(p,len(tr)):
        a=(a*(p-1)+tr[i])/p;ps=(ps*(p-1)+plus[i])/p;ms=(ms*(p-1)+minus[i])/p;pdi=100*ps/a if a else 0;mdi=100*ms/a if a else 0;dx.append(100*abs(pdi-mdi)/(pdi+mdi) if pdi+mdi else 0)
    if len(dx)<p:return a,None
    x=sum(dx[:p])/p
    for v in dx[p:]:x=(x*(p-1)+v)/p
    return a,x

def perf(ks,days):
    c=[float(k[4]) for k in ks];return 100*(c[-1]/c[-1-days]-1) if len(c)>days and c[-1-days] else None

def safe_round(v,d=4):return None if v is None or not math.isfinite(v) else round(v,d)

def band(v,cuts,labels):
    if v is None:return 'UNKNOWN'
    x=float(v)
    for c,l in zip(cuts,labels):
        if x<c:return l
    return labels[-1]

def fetch_symbol(symbol,btc30):
    pair=symbol+'USDT';k4=get(f'{SPOT}/klines?symbol={pair}&interval=4h&limit=240');kd=get(f'{SPOT}/klines?symbol={pair}&interval=1d&limit=120');tick=get(f'{SPOT}/ticker/24hr?symbol={pair}')
    closes=[float(k[4]) for k in k4];vols=[float(k[5]) for k in k4];close=closes[-1];e20=ema(closes,20);e80=ema(closes,80);e200=ema(closes,200);R=rsi(closes);atr,A=atr_adx(k4)
    recent=sum(vols[-4:])/4;prior=vols[-24:-4];vr=recent/(sum(prior)/len(prior)) if prior and sum(prior) else None;bull=bool(e20 is not None and e80 is not None and e200 is not None and e20>e80 and close>e200);bear=bool(e20 is not None and e80 is not None and e200 is not None and e20<e80 and close<e200)
    a30=perf(kd,30);d90=perf(kd,90);vs30=(a30-btc30) if a30 is not None and btc30 is not None else 0.0;chg=float(tick['priceChangePercent']);atr_pct=(100*atr/close if atr and close else None)
    score=canonical_score(ema20=e20,ema80=e80,close=close,ema200=e200,rsi=R,adx=A,volume_ratio=vr,vs_btc_30=vs30,d90=d90,atr_pct=atr_pct);setup=bool(bull and R is not None and 50<=R<=75 and A is not None and A>=35)
    return symbol,{'ts':datetime.now(timezone.utc).isoformat(),'price':safe_round(float(tick['lastPrice']),8),'chg_24h_pct':safe_round(chg,3),'score':score,'score_model':MODEL,'score_version':VERSION,'trend':'BULLISH' if bull else 'BEARISH' if bear else 'MIXED','rsi':safe_round(R,2),'adx':safe_round(A,2),'atr_pct':safe_round(atr_pct,3),'volume_ratio':safe_round(vr,3),'vs_btc_30d_pct':safe_round(vs30,3),'setup':setup}

def market_context(now, snapshots):
    btc=snapshots.get('BTC') or {}
    usable=list(snapshots.values())
    bullish=sum(x.get('trend')=='BULLISH' for x in usable)
    setups=sum(x.get('setup') is True for x in usable)
    high_score=sum(isinstance(x.get('score'),(int,float)) and x['score']>=80 for x in usable)
    n=len(usable)
    adxs=[float(x['adx']) for x in usable if isinstance(x.get('adx'),(int,float))]
    atrs=[float(x['atr_pct']) for x in usable if isinstance(x.get('atr_pct'),(int,float))]
    btc_atr=btc.get('atr_pct');btc_adx=btc.get('adx');btc_trend=btc.get('trend') or 'UNKNOWN'
    bullish_pct=100*bullish/n if n else None;setup_pct=100*setups/n if n else None;high_score_pct=100*high_score/n if n else None
    breadth='BROAD' if bullish_pct is not None and bullish_pct>=65 else 'MIXED' if bullish_pct is not None and bullish_pct>=40 else 'NARROW' if bullish_pct is not None else 'UNKNOWN'
    volatility=band(btc_atr,[2.0,4.0,1e9],['LOW','NORMAL','HIGH'])
    btc_strength=band(btc_adx,[20,35,1e9],['WEAK','MODERATE','STRONG'])
    return {
        'ts':now,'context_model':MARKET_CONTEXT_MODEL,'context_version':MARKET_CONTEXT_VERSION,
        'btc_trend':btc_trend,'btc_adx':btc_adx,'btc_adx_regime':btc_strength,'btc_atr_pct':btc_atr,'btc_volatility_regime':volatility,
        'btc_chg_24h_pct':btc.get('chg_24h_pct'),'btc_score':btc.get('score'),
        'universe_n':n,'bullish_breadth_pct':safe_round(bullish_pct,2),'setup_breadth_pct':safe_round(setup_pct,2),'high_score_breadth_pct':safe_round(high_score_pct,2),
        'breadth_regime':breadth,'median_adx':safe_round(statistics.median(adxs),2) if adxs else None,'median_atr_pct':safe_round(statistics.median(atrs),3) if atrs else None,
        'market_regime':f'BTC:{btc_trend}|VOL:{volatility}|BREADTH:{breadth}',
        'durable_derivatives_context':False,'derivatives_context_state':'UNAVAILABLE_DURABLE_PROVIDER'
    }

def main():
    data=json.loads(OUT.read_text()) if OUT.exists() else {'symbols':{}};tickers=get(f'{SPOT}/ticker/24hr');universe=[]
    for t in sorted((x for x in tickers if x['symbol'].endswith('USDT')),key=lambda x:float(x.get('quoteVolume') or 0),reverse=True):
        s=t['symbol'][:-4]
        if s in EXCLUDE or s in universe:continue
        universe.append(s)
        if len(universe)>=MAX_COINS:break
    btc=get(f'{SPOT}/klines?symbol=BTCUSDT&interval=1d&limit=120');btc30=perf(btc,30);now=datetime.now(timezone.utc).isoformat();updated=0;snapshots={}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures={pool.submit(fetch_symbol,s,btc30):s for s in universe}
        for fut in as_completed(futures):
            s=futures[fut]
            try:
                symbol,snap=fut.result();snapshots[symbol]=snap;arr=data.setdefault('symbols',{}).setdefault(symbol,[]);arr.append(snap);data['symbols'][symbol]=arr[-KEEP:];updated+=1;print(symbol,snap['score'],snap['trend'])
            except Exception as e:print('WARN',s,e)
    contexts=data.setdefault('market_context',[]);contexts.append(market_context(now,snapshots));data['market_context']=contexts[-KEEP:]
    data.update({'mode':'WAVELENGTH_COIN_INTELLIGENCE_HISTORY_READ_ONLY','generated_at':now,'orders_enabled':False,'live_money_enabled':False,'execution_authority':False,'retention_points_per_symbol':KEEP,'sample_interval_hours':4,'universe_size':len(universe),'updated_symbols':updated,'durable_derivatives_history':False,'score_model':MODEL,'score_version':VERSION,'market_context_model':MARKET_CONTEXT_MODEL,'market_context_version':MARKET_CONTEXT_VERSION});OUT.write_text(json.dumps(data,indent=2,sort_keys=True)+'\n')

if __name__=='__main__':main()
