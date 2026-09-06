#!/usr/bin/env python3
from __future__ import annotations
import json, math, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT=Path('intelligence-history.json')
MAX_COINS=40
KEEP=540
EXCLUDE={'USDC','BUSD','TUSD','FDUSD','USDP','DAI','EUR','GBP','EURI','USTC','PAX','UST','WBTC','WBETH'}

def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':'wavelength-intelligence-history/1.0'})
    with urllib.request.urlopen(req,timeout=20) as r:
        return json.load(r)

def ema(vals,p):
    if len(vals)<p:return None
    e=sum(vals[:p])/p;k=2/(p+1)
    for x in vals[p:]:e=x*k+e*(1-k)
    return e

def rsi(vals,p=14):
    if len(vals)<=p:return None
    g=l=0.0
    for i in range(1,p+1):
        d=vals[i]-vals[i-1];g+=max(d,0);l+=max(-d,0)
    g/=p;l/=p
    for i in range(p+1,len(vals)):
        d=vals[i]-vals[i-1];g=(g*(p-1)+max(d,0))/p;l=(l*(p-1)+max(-d,0))/p
    return 100.0 if l==0 else 100-100/(1+g/l)

def atr_adx(ks,p=14):
    if len(ks)<p*2+2:return None,None
    tr=[];plus=[];minus=[]
    for i in range(1,len(ks)):
        h=float(ks[i][2]);lo=float(ks[i][3]);pc=float(ks[i-1][4]);ph=float(ks[i-1][2]);pl=float(ks[i-1][3])
        up=h-ph;down=pl-lo
        tr.append(max(h-lo,abs(h-pc),abs(lo-pc)))
        plus.append(up if up>down and up>0 else 0.0);minus.append(down if down>up and down>0 else 0.0)
    a=sum(tr[:p])/p;ps=sum(plus[:p])/p;ms=sum(minus[:p])/p;dx=[]
    for i in range(p,len(tr)):
        a=(a*(p-1)+tr[i])/p;ps=(ps*(p-1)+plus[i])/p;ms=(ms*(p-1)+minus[i])/p
        pdi=100*ps/a if a else 0;mdi=100*ms/a if a else 0;dx.append(100*abs(pdi-mdi)/(pdi+mdi) if pdi+mdi else 0)
    if len(dx)<p:return a,None
    x=sum(dx[:p])/p
    for v in dx[p:]:x=(x*(p-1)+v)/p
    return a,x

def perf(ks,days):
    c=[float(k[4]) for k in ks]
    return 100*(c[-1]/c[-1-days]-1) if len(c)>days and c[-1-days] else None

def safe_round(v,d=4):
    return None if v is None or not math.isfinite(v) else round(v,d)

def fetch_symbol(symbol,btc30):
    pair=symbol+'USDT';base='https://api.binance.com/api/v3'
    k4=get(f'{base}/klines?symbol={pair}&interval=4h&limit=240')
    kd=get(f'{base}/klines?symbol={pair}&interval=1d&limit=120')
    tick=get(f'{base}/ticker/24hr?symbol={pair}')
    closes=[float(k[4]) for k in k4];vols=[float(k[5]) for k in k4];close=closes[-1]
    e20=ema(closes,20);e80=ema(closes,80);e200=ema(closes,200);R=rsi(closes);atr,A=atr_adx(k4)
    recent=sum(vols[-4:])/4;prior=vols[-24:-4];vr=recent/(sum(prior)/len(prior)) if prior and sum(prior) else None
    bull=bool(e20 is not None and e80 is not None and e200 is not None and e20>e80 and close>e200)
    bear=bool(e20 is not None and e80 is not None and e200 is not None and e20<e80 and close<e200)
    a30=perf(kd,30);d90=perf(kd,90);vs30=(a30-btc30) if a30 is not None and btc30 is not None else 0.0
    funding=oi=None
    try:
        p=get(f'https://fapi.binance.com/fapi/v1/premiumIndex?symbol={pair}')
        o=get(f'https://fapi.binance.com/futures/data/openInterestHist?symbol={pair}&period=4h&limit=7')
        funding=float(p.get('lastFundingRate') or 0)
        if isinstance(o,list) and len(o)>1:
            a=float(o[-1]['sumOpenInterestValue']);b=float(o[0]['sumOpenInterestValue']);oi=100*(a/b-1) if b else None
    except Exception:
        pass
    chg=float(tick['priceChangePercent']);score=0
    if e20 is not None and e80 is not None and e20>e80:score+=20
    if e200 is not None and close>e200:score+=20
    if R is not None and 50<=R<=75:score+=20
    if A is not None and A>=35:score+=20
    if vr is not None and vr>=1:score+=10
    if vs30>5:score+=8
    elif vs30>0:score+=4
    if d90 is not None and d90>20:score+=5
    if vr is not None and vr>=1.25:score+=5
    if R is not None and R>75:score-=8
    if funding is not None and abs(funding)>.001:score-=8
    if oi is not None and oi>8 and chg>2:score+=4
    score=max(0,min(100,round(score)))
    setup=bool(bull and R is not None and 50<=R<=75 and A is not None and A>=35)
    return {'ts':datetime.now(timezone.utc).isoformat(),'price':safe_round(float(tick['lastPrice']),8),'chg_24h_pct':safe_round(chg,3),'score':score,'trend':'BULLISH' if bull else 'BEARISH' if bear else 'MIXED','rsi':safe_round(R,2),'adx':safe_round(A,2),'atr_pct':safe_round(100*atr/close if atr and close else None,3),'volume_ratio':safe_round(vr,3),'vs_btc_30d_pct':safe_round(vs30,3),'funding_pct':safe_round(funding*100 if funding is not None else None,5),'oi_24h_pct':safe_round(oi,3),'setup':setup}

def main():
    data=json.loads(OUT.read_text()) if OUT.exists() else {'symbols':{}}
    tickers=get('https://api.binance.com/api/v3/ticker/24hr')
    universe=[]
    for t in sorted((x for x in tickers if x['symbol'].endswith('USDT')),key=lambda x:float(x.get('quoteVolume') or 0),reverse=True):
        s=t['symbol'][:-4]
        if s in EXCLUDE or s in universe:continue
        universe.append(s)
        if len(universe)>=MAX_COINS:break
    btc=get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=120');btc30=perf(btc,30)
    now=datetime.now(timezone.utc).isoformat();updated=0
    for s in universe:
        try:
            snap=fetch_symbol(s,btc30);arr=(data.setdefault('symbols',{})).setdefault(s,[]);arr.append(snap);data['symbols'][s]=arr[-KEEP:];updated+=1
            print(s,snap['score'],snap['trend'])
            time.sleep(.08)
        except Exception as e:
            print('WARN',s,e)
    data.update({'mode':'WAVELENGTH_COIN_INTELLIGENCE_HISTORY_READ_ONLY','generated_at':now,'orders_enabled':False,'live_money_enabled':False,'execution_authority':False,'retention_points_per_symbol':KEEP,'sample_interval_hours':4,'universe_size':len(universe),'updated_symbols':updated})
    OUT.write_text(json.dumps(data,indent=2,sort_keys=True)+'\n')

if __name__=='__main__':main()
