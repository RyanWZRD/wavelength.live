#!/usr/bin/env python3
"""Public read-only continuity collector for Decision Quality v2.
Keeps forward ranking evidence alive when the private research runner is unavailable.
No orders, credentials, strategy mutation or capital authority.
"""
from __future__ import annotations
import json,math,statistics,time,urllib.parse,urllib.request
from datetime import datetime,timezone
from pathlib import Path
API='https://data-api.binance.vision/api/v3';OUT=Path('decision-quality-v2.json');HIST=Path('decision-quality-v2-history.jsonl')
EXCLUDE={'USDC','BUSD','TUSD','FDUSD','USDP','DAI','EUR','GBP','EURI','USTC','PAX','UST','USD1','RLUSD','USDE','USDS','XUSD','BFUSD','WBTC','WBETH','BETH','BNSOL','ETHW','BTTC','PAXG','XAUT'};LEV=('UP','DOWN','BULL','BEAR')
TRADFI={'AAPL','ABBV','ADBE','AMD','AMAT','AMZN','ARM','ASML','AVGO','BABA','BMNR','BRK','COIN','COHR','CRCL','CRDO','CRM','CRWD','DELL','DJT','EWY','FLNC','GME','GOOGL','GS','HOOD','IBM','INTC','INTW','IREN','LITE','META','MRNA','MRVL','MSFT','MSTR','MUU','NBIS','NFLX','NOK','NVDA','ORCL','PLTR','PYPL','QCOM','QQQ','RBLX','RKLB','SMCI','SMH','SNXX','SOXL','SOXS','SPCX','SPY','SQQQ','STX','TSLA','TSM','TQQQ','USAR','WDC'}
MIN_QV=5_000_000.;DEEP=60;ACTIVE=20

def now():return datetime.now(timezone.utc).isoformat()
def clamp(x,a=0,b=100):return max(a,min(b,float(x)))
def get(path,params=None):
 u=API+path+('?' + urllib.parse.urlencode(params) if params else '');req=urllib.request.Request(u,headers={'User-Agent':'Wavelength-Continuity/1.1'})
 with urllib.request.urlopen(req,timeout=25) as r:return json.loads(r.read().decode())
def pct(a,b):return (a/b-1)*100 if b else 0.
def valid(s):return bool(s and s not in EXCLUDE and not any(s.endswith(z) for z in LEV) and s.isascii() and s.isalnum() and not(s.endswith('B') and s[:-1] in TRADFI))
def discover():
 info=get('/exchangeInfo');tm={x.get('symbol'):x for x in get('/ticker/24hr')};rows=[]
 for x in info.get('symbols',[]):
  if x.get('status')!='TRADING' or x.get('quoteAsset')!='USDT' or not x.get('isSpotTradingAllowed',True):continue
  pair=x.get('symbol','');base=x.get('baseAsset','');t=tm.get(pair) or {}
  if not valid(base):continue
  try:px=float(t.get('lastPrice') or 0);qv=float(t.get('quoteVolume') or 0);chg=float(t.get('priceChangePercent') or 0)
  except:continue
  if px>0 and qv>=MIN_QV:rows.append({'symbol':base,'pair':pair,'price':px,'quote_volume_24h':qv,'change_24h_pct':chg})
 rows.sort(key=lambda x:x['quote_volume_24h'],reverse=True);return rows[:DEEP]
def enrich(x):
 k=get('/klines',{'symbol':x['pair'],'interval':'1d','limit':60});c=[float(r[4]) for r in k]
 if len(c)<50:return None
 r1=pct(c[-1],c[-2]);r7=pct(c[-1],c[-8]);r30=pct(c[-1],c[-31]);m20=statistics.mean(c[-20:]);m50=statistics.mean(c[-50:]);t20=pct(c[-1],m20);t50=pct(c[-1],m50);rets=[pct(c[i],c[i-1]) for i in range(len(c)-20,len(c))];vol=statistics.pstdev(rets)
 gl=[max(0,c[i]-c[i-1]) for i in range(len(c)-14,len(c))];ls=[max(0,c[i-1]-c[i]) for i in range(len(c)-14,len(c))];ag=sum(gl)/14;al=sum(ls)/14;rsi=100 if al==0 else 100-100/(1+ag/al);reg='BULL' if c[-1]>m20>m50 else('BEAR' if c[-1]<m20<m50 else'RANGE')
 return {**x,'ret_1d_pct':r1,'ret_7d_pct':r7,'ret_30d_pct':r30,'trend20_pct':t20,'trend50_pct':t50,'rsi14':rsi,'vol20_pct':vol,'regime':reg}
def components(rows):
 rel=[.2*x['ret_1d_pct']+.45*x['ret_7d_pct']+.35*x['ret_30d_pct'] for x in rows];q=[math.log10(max(1,x['quote_volume_24h'])) for x in rows]
 def per(vals,v):s=sorted(vals);return 100*(sum(z<=v for z in s)-.5)/len(s)
 out=[]
 for x,rv,qv in zip(rows,rel,q):
  rs=per(rel,rv);liq=per(q,qv);trend=clamp(50+x['trend20_pct']*3+x['trend50_pct']*1.5);mom=clamp(100-abs(x['rsi14']-62)*2.5);risk=clamp(85-x['vol20_pct']*7);reg={'BULL':85,'RANGE':55,'BEAR':25}.get(x['regime'],50);imp=clamp(50+x['ret_1d_pct']*5)
  out.append({**x,'components':{'relative_strength':round(rs,1),'trend':round(trend,1),'momentum_quality':round(mom,1),'liquidity':round(liq,1),'risk_efficiency':round(risk,1),'regime_fit':round(reg,1),'current_impulse':round(imp,1)}})
 return out
def rank(rows,version):
 out=[]
 for x in components(rows):
  c=x['components']
  if version=='v2.0':score=.30*c['relative_strength']+.20*c['trend']+.15*c['momentum_quality']+.15*c['liquidity']+.10*c['risk_efficiency']+.10*c['regime_fit'];pen={}
  else:
   score=.22*c['relative_strength']+.17*c['trend']+.12*c['momentum_quality']+.17*c['liquidity']+.12*c['risk_efficiency']+.10*c['regime_fit']+.10*c['current_impulse']
   pen={'reversal':round(min(18,max(0,(-x['ret_1d_pct']-5)*1.4)),1),'overextension':round(min(8,max(0,(x['rsi14']-78)*.8)),1),'extreme_volatility':round(min(10,max(0,(30-c['risk_efficiency'])*.35)),1)};score-=sum(pen.values())
  out.append({**x,'opportunity_score':round(clamp(score),1),'model_version':version,'penalties':pen})
 out.sort(key=lambda x:x['opportunity_score'],reverse=True)
 for i,x in enumerate(out,1):x['rank']=i
 return out
def depth(symbol):
 try:d=get('/depth',{'symbol':symbol+'USDT','limit':100})
 except:return {'available':False}
 bids=[(float(p),float(q)) for p,q in d.get('bids',[])];asks=[(float(p),float(q)) for p,q in d.get('asks',[])];
 if not bids or not asks:return {'available':False}
 mid=(bids[0][0]+asks[0][0])/2;spread=(asks[0][0]-bids[0][0])/mid*10000;dep=sum(p*q for p,q in bids if p>=mid*.995)+sum(p*q for p,q in asks if p<=mid*1.005)
 def impact(book,usd,buy):
  left=usd;notional=qty=0
  for p,q in book:
   take=min(left,p*q);notional+=take;qty+=take/p;left-=take
   if left<=1e-9:break
  if left>1e-6 or qty<=0:return None
  avg=notional/qty;return round((avg/mid-1)*10000 if buy else (1-avg/mid)*10000,2)
 return {'available':True,'spread_bps':round(spread,2),'depth_50bps_usd':round(dep,2),'impact_bps':{str(n):{'buy':impact(asks,n,True),'sell':impact(bids,n,False)} for n in(1000,10000,50000)}}
def history():
 a=[]
 if HIST.exists():
  for line in HIST.read_text().splitlines():
   try:a.append(json.loads(line))
   except:pass
 return a[-100:]
def review(hist,current):
 cmap={x['symbol']:x for x in current};nowts=datetime.now(timezone.utc).timestamp();miss=[];att=[]
 for s in hist:
  try:age=(nowts-datetime.fromisoformat(s['generated_at'].replace('Z','+00:00')).timestamp())/3600
  except:continue
  if not 20<=age<=40:continue
  for p in s.get('ranking',[]):
   cur=cmap.get(p['symbol']);entry=float(p.get('price') or 0)
   if not cur or entry<=0:continue
   ret=round(pct(cur['price'],entry),2);r={'symbol':p['symbol'],'prior_rank':p['rank'],'forward_return_pct':ret,'outcome':'POSITIVE' if ret>0 else'NEGATIVE','components':p.get('components',{}),'model_version':s.get('model_version','unknown')}
   if p['rank']>10 and ret>=5:miss.append(r)
   if p['rank']<=10:att.append(r)
  break
 return miss,att
def main():
 rows=[]
 for x in discover():
  try:z=enrich(x);rows.append(z) if z else None
  except Exception as e:print('enrich',x['symbol'],e)
  time.sleep(.03)
 baseline=rank(rows,'v2.0');ranking=rank(rows,'v2.1');liq={x['symbol']:depth(x['symbol']) for x in ranking[:ACTIVE]};miss,att=review(history(),ranking);alerts=[]
 for x in ranking[:10]:
  reasons=[]
  if x['rank']<=5:reasons.append('top-5 opportunity rank')
  if x['components']['relative_strength']>=70:reasons.append('strong relative strength')
  if x['regime']=='BULL':reasons.append('bull regime')
  if x['components']['current_impulse']>=55:reasons.append('positive current impulse')
  l=liq.get(x['symbol'],{});
  if l.get('available') and (l.get('spread_bps') or 999)<12:reasons.append('acceptable quoted spread')
  if len(reasons)>=3:alerts.append({'symbol':x['symbol'],'reasons':reasons,'message':x['symbol']+' · '+' · '.join(reasons)})
 rs=sorted(ranking,key=lambda x:(.2*x['ret_1d_pct']+.45*x['ret_7d_pct']+.35*x['ret_30d_pct']),reverse=True);rs=[{'rank':i+1,'symbol':x['symbol'],'1d':round(x['ret_1d_pct'],2),'7d':round(x['ret_7d_pct'],2),'30d':round(x['ret_30d_pct'],2)} for i,x in enumerate(rs)];pos=sum(x['forward_return_pct']>0 for x in att);sc={'state':'MEASURED' if len(att)>=20 else'COLLECTING_FORWARD_EVIDENCE','resolved_outcomes':len(att),'top10_positive_rate_pct':round(100*pos/len(att),1) if att else None,'missed_opportunities':len(miss),'collector_issues':0}
 payload={'schema':'wavelength-decision-quality-v2-continuity','mode':'PUBLIC_READ_ONLY_CONTINUITY','generated_at':now(),'authority':'FALLBACK_WHILE_PRIVATE_RUNNER_UNAVAILABLE','ranking_model':'v2.1','baseline_model':'v2.0_FROZEN','orders_enabled':False,'live_money_enabled':False,'execution_authority':False,'automatic_promotion':False,'automatic_allocation':False,'strategy_rule_mutation':False,'parameter_mutation':False,'universe':{'requested':DEEP,'analysed':len(ranking)},'ranking':ranking,'ranking_baseline_v2_0':baseline,'alerts':alerts,'liquidity':liq,'relative_strength_matrix':rs,'missed_opportunities':miss,'outcome_attribution':att,'research_scorecard':sc,'note':'v2.0 remains frozen. v2.1 adds contemporaneous reversal, overextension and extreme-volatility penalties; future forward outcomes must decide which model is better.'};OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
 snap={'generated_at':payload['generated_at'],'model_version':'v2.1','ranking':[{k:x[k] for k in ['rank','symbol','price','opportunity_score','components','penalties']} for x in ranking],'baseline_top10':[x['symbol'] for x in baseline[:10]]};
 with HIST.open('a') as f:f.write(json.dumps(snap,sort_keys=True)+'\n')
 print(json.dumps({'model':'v2.1','analysed':len(ranking),'top10':[x['symbol'] for x in ranking[:10]],'baseline_top10':[x['symbol'] for x in baseline[:10]],'alerts':len(alerts),'resolved':len(att),'missed':len(miss)},indent=2))
if __name__=='__main__':main()
