#!/usr/bin/env python3
"""Public read-only continuity collector for Decision Quality v2.

Keeps forward ranking evidence alive when the private research runner is unavailable.
Uses public Binance spot data only. No orders, credentials, strategy mutation or capital authority.
"""
from __future__ import annotations
import json, math, statistics, time, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

API='https://api.binance.com/api/v3'
OUT=Path('decision-quality-v2.json')
HIST=Path('decision-quality-v2-history.jsonl')
EXCLUDE={'USDC','BUSD','TUSD','FDUSD','USDP','DAI','EUR','GBP','EURI','USTC','PAX','UST','USD1','RLUSD','USDE','USDS','XUSD','BFUSD','WBTC','WBETH','BETH','BNSOL','ETHW','BTTC','PAXG','XAUT'}
LEV=('UP','DOWN','BULL','BEAR')
TRADFI={'AAPL','ABBV','ADBE','AMD','AMAT','AMZN','ARM','ASML','AVGO','BABA','BMNR','BRK','COIN','COHR','CRCL','CRDO','CRM','CRWD','DELL','DJT','EWY','FLNC','GME','GOOGL','GS','HOOD','IBM','INTC','INTW','IREN','LITE','META','MRNA','MRVL','MSFT','MSTR','MUU','NBIS','NFLX','NOK','NVDA','ORCL','PLTR','PYPL','QCOM','QQQ','RBLX','RKLB','SMCI','SMH','SNXX','SOXL','SOXS','SPCX','SPY','SQQQ','STX','TSLA','TSM','TQQQ','USAR','WDC'}
MIN_QV=5_000_000.0; DEEP=60; ACTIVE=20

def now(): return datetime.now(timezone.utc).isoformat()
def clamp(x,a=0,b=100): return max(a,min(b,float(x)))
def get(path,params=None):
    u=API+path
    if params:u+='?'+urllib.parse.urlencode(params)
    req=urllib.request.Request(u,headers={'User-Agent':'Wavelength-Continuity/1.0'})
    with urllib.request.urlopen(req,timeout=25) as r:return json.loads(r.read().decode())
def pct(a,b): return (a/b-1)*100 if b else 0.0
def valid_base(s):
    if not s or s in EXCLUDE or any(s.endswith(z) for z in LEV):return False
    if not s.isascii() or not s.isalnum():return False
    if s.endswith('B') and s[:-1] in TRADFI:return False
    return True

def discover():
    info=get('/exchangeInfo'); tick=get('/ticker/24hr'); tmap={x.get('symbol'):x for x in tick}
    rows=[]
    for x in info.get('symbols',[]):
        if x.get('status')!='TRADING' or x.get('quoteAsset')!='USDT' or not x.get('isSpotTradingAllowed',True):continue
        pair=x.get('symbol',''); base=x.get('baseAsset','')
        if not valid_base(base):continue
        t=tmap.get(pair) or {}
        try:px=float(t.get('lastPrice') or 0);qv=float(t.get('quoteVolume') or 0);chg=float(t.get('priceChangePercent') or 0)
        except:continue
        if px<=0 or qv<MIN_QV:continue
        rows.append({'symbol':base,'pair':pair,'price':px,'quote_volume_24h':qv,'change_24h_pct':chg})
    rows.sort(key=lambda x:x['quote_volume_24h'],reverse=True)
    return rows[:DEEP]

def enrich(x):
    k=get('/klines',{'symbol':x['pair'],'interval':'1d','limit':60})
    c=[float(r[4]) for r in k];h=[float(r[2]) for r in k];l=[float(r[3]) for r in k]
    if len(c)<35:return None
    r1=pct(c[-1],c[-2]);r7=pct(c[-1],c[-8]);r30=pct(c[-1],c[-31]);t20=pct(c[-1],statistics.mean(c[-20:]));t50=pct(c[-1],statistics.mean(c[-50:]))
    rets=[pct(c[i],c[i-1]) for i in range(max(1,len(c)-20),len(c))]
    vol=statistics.pstdev(rets) if len(rets)>1 else 0
    gains=[];loss=[]
    for i in range(len(c)-14,len(c)):
        d=c[i]-c[i-1];gains.append(max(0,d));loss.append(max(0,-d))
    ag=sum(gains)/14;al=sum(loss)/14;rsi=100 if al==0 else 100-100/(1+ag/al)
    regime='BULL' if c[-1]>statistics.mean(c[-20:])>statistics.mean(c[-50:]) else ('BEAR' if c[-1]<statistics.mean(c[-20:])<statistics.mean(c[-50:]) else 'RANGE')
    return {**x,'ret_1d_pct':r1,'ret_7d_pct':r7,'ret_30d_pct':r30,'trend20_pct':t20,'trend50_pct':t50,'rsi14':rsi,'vol20_pct':vol,'regime':regime}

def rank(rows):
    if not rows:return []
    def percentile(vals,v):
        s=sorted(vals); return 100*(sum(1 for z in s if z<=v)-.5)/len(s)
    q=[math.log10(max(1,x['quote_volume_24h'])) for x in rows]; rel=[.2*x['ret_1d_pct']+.45*x['ret_7d_pct']+.35*x['ret_30d_pct'] for x in rows]
    out=[]
    for x,rv in zip(rows,rel):
        rs=percentile(rel,rv);liq=percentile(q,math.log10(max(1,x['quote_volume_24h'])))
        trend=clamp(50+x['trend20_pct']*3+x['trend50_pct']*1.5)
        momentum=clamp(100-abs(x['rsi14']-62)*2.5)
        risk=clamp(85-x['vol20_pct']*7)
        regime={'BULL':85,'RANGE':55,'BEAR':25}.get(x['regime'],50)
        score=.30*rs+.20*trend+.15*momentum+.15*liq+.10*risk+.10*regime
        out.append({**x,'opportunity_score':round(score,1),'components':{'relative_strength':round(rs,1),'trend':round(trend,1),'momentum_quality':round(momentum,1),'liquidity':round(liq,1),'risk_efficiency':round(risk,1),'regime_fit':round(regime,1)}})
    out.sort(key=lambda x:x['opportunity_score'],reverse=True)
    for i,x in enumerate(out,1):x['rank']=i
    return out

def depth(symbol):
    try:d=get('/depth',{'symbol':symbol+'USDT','limit':100})
    except:return {'available':False}
    bids=[(float(p),float(q)) for p,q in d.get('bids',[])];asks=[(float(p),float(q)) for p,q in d.get('asks',[])]
    if not bids or not asks:return {'available':False}
    mid=(bids[0][0]+asks[0][0])/2;spread=(asks[0][0]-bids[0][0])/mid*10000
    dep=sum(p*q for p,q in bids if p>=mid*.995)+sum(p*q for p,q in asks if p<=mid*1.005)
    def impact(side,usd):
        book=asks if side=='buy' else bids;left=usd;notional=qty=0
        for p,q in book:
            take=min(left,p*q);notional+=take;qty+=take/p;left-=take
            if left<=1e-9:break
        if left>1e-6 or qty<=0:return None
        avg=notional/qty;return round(((avg/mid-1)*10000 if side=='buy' else (1-avg/mid)*10000),2)
    return {'available':True,'spread_bps':round(spread,2),'depth_50bps_usd':round(dep,2),'impact_bps':{str(n):{'buy':impact('buy',n),'sell':impact('sell',n)} for n in (1000,10000,50000)}}

def read_hist():
    out=[]
    if HIST.exists():
        for line in HIST.read_text().splitlines():
            try:out.append(json.loads(line))
            except:pass
    return out[-80:]

def outcome_review(history,current):
    cmap={x['symbol']:x for x in current};resolved=[];missed=[];attrib=[];nowts=datetime.now(timezone.utc).timestamp()
    for snap in history:
        try:age=(nowts-datetime.fromisoformat(snap['generated_at'].replace('Z','+00:00')).timestamp())/3600
        except:continue
        if age<20 or age>40:continue
        prior=snap.get('ranking',[])
        for p in prior:
            cur=cmap.get(p['symbol']);entry=float(p.get('price') or 0)
            if not cur or entry<=0:continue
            ret=pct(cur['price'],entry); rec={'symbol':p['symbol'],'prior_rank':p['rank'],'forward_return_pct':round(ret,2),'outcome':'POSITIVE' if ret>0 else 'NEGATIVE','components':p.get('components',{})}
            resolved.append(rec)
            if p['rank']>10 and ret>=5:missed.append(rec)
            if p['rank']<=10:attrib.append(rec)
        break
    return resolved,missed,attrib

def main():
    deep=discover(); enriched=[]
    for i,x in enumerate(deep):
        try:
            z=enrich(x)
            if z:enriched.append(z)
        except Exception as e: print('enrich',x['symbol'],e)
        time.sleep(.03)
    ranking=rank(enriched);active=ranking[:ACTIVE]
    liq={x['symbol']:depth(x['symbol']) for x in active}
    history=read_hist();resolved,missed,attrib=outcome_review(history,ranking)
    alerts=[]
    for x in ranking[:10]:
        reasons=[]
        if x['rank']<=5:reasons.append('top-5 opportunity rank')
        if x['components']['relative_strength']>=70:reasons.append('strong relative strength')
        if x['regime']=='BULL':reasons.append('bull regime')
        l=liq.get(x['symbol'],{}); 
        if l.get('available') and (l.get('spread_bps') or 999)<12:reasons.append('acceptable quoted spread')
        if len(reasons)>=3:alerts.append({'symbol':x['symbol'],'reasons':reasons,'message':x['symbol']+' · '+' · '.join(reasons)})
    rs=[{'rank':i+1,'symbol':x['symbol'],'1d':round(x['ret_1d_pct'],2),'7d':round(x['ret_7d_pct'],2),'30d':round(x['ret_30d_pct'],2)} for i,x in enumerate(sorted(ranking,key=lambda x:(.2*x['ret_1d_pct']+.45*x['ret_7d_pct']+.35*x['ret_30d_pct']),reverse=True))]
    pos=sum(1 for x in attrib if x['forward_return_pct']>0);sc={'state':'MEASURED' if len(attrib)>=20 else 'COLLECTING_FORWARD_EVIDENCE','resolved_outcomes':len(attrib),'top10_positive_rate_pct':round(100*pos/len(attrib),1) if attrib else None,'missed_opportunities':len(missed),'collector_issues':0}
    payload={'schema':'wavelength-decision-quality-v2-continuity','mode':'PUBLIC_READ_ONLY_CONTINUITY','generated_at':now(),'authority':'FALLBACK_WHILE_PRIVATE_RUNNER_UNAVAILABLE','orders_enabled':False,'live_money_enabled':False,'execution_authority':False,'automatic_promotion':False,'automatic_allocation':False,'strategy_rule_mutation':False,'parameter_mutation':False,'universe':{'requested':DEEP,'analysed':len(ranking)},'ranking':ranking,'alerts':alerts,'liquidity':liq,'relative_strength_matrix':rs,'missed_opportunities':missed,'outcome_attribution':attrib,'research_scorecard':sc,'note':'Public continuity collector. Frozen history is append-only; outcome review uses prior snapshots only.'}
    OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
    snap={'generated_at':payload['generated_at'],'ranking':[{k:x[k] for k in ['rank','symbol','price','opportunity_score','components']} for x in ranking]}
    with HIST.open('a') as f:f.write(json.dumps(snap,sort_keys=True)+'\n')
    print(json.dumps({'analysed':len(ranking),'top10':[x['symbol'] for x in ranking[:10]],'alerts':len(alerts),'resolved':len(attrib),'missed':len(missed)},indent=2))
if __name__=='__main__':main()
