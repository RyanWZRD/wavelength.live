#!/usr/bin/env python3
"""Public read-only continuity collector for Dynamic Market Universe v2.

Rebuilds a clean crypto-only Binance USDT spot universe from the public data mirror.
No orders, credentials, strategy mutation, promotion authority or capital allocation.
"""
from __future__ import annotations
import hashlib, json, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

API='https://data-api.binance.vision/api/v3'
OUT=Path('dynamic-market-universe-v2-continuity.json')
HIST=Path('dynamic-market-universe-v2-continuity-history.jsonl')
MIN_QV=5_000_000.0
RESEARCH_LIMIT=180
DEEP_LIMIT=60
ACTIVE_LIMIT=20
EXCLUDE={'USDC','BUSD','TUSD','FDUSD','USDP','DAI','EUR','GBP','EURI','USTC','PAX','UST','USD1','RLUSD','USDE','USDS','XUSD','BFUSD','WBTC','WBETH','BETH','BNSOL','ETHW','BTTC','PAXG','XAUT'}
LEV=('UP','DOWN','BULL','BEAR')
TRADFI={'AAPL','ABBV','ADBE','AMD','AMAT','AMZN','ARM','ASML','AVGO','BABA','BMNR','BRK','COIN','COHR','CRCL','CRDO','CRM','CRWD','DELL','DJT','EWY','FLNC','GME','GOOGL','GS','HOOD','IBM','INTC','INTW','IREN','LITE','META','MRNA','MRVL','MSFT','MSTR','MUU','NBIS','NFLX','NOK','NVDA','ORCL','PLTR','PYPL','QCOM','QQQ','RBLX','RKLB','SMCI','SMH','SNXX','SOXL','SOXS','SPCX','SPY','SQQQ','STX','TSLA','TSM','TQQQ','USAR','WDC'}

def now(): return datetime.now(timezone.utc).isoformat()
def get(path,params=None):
    u=API+path
    if params:u+='?'+urllib.parse.urlencode(params)
    req=urllib.request.Request(u,headers={'User-Agent':'Wavelength-Universe-Continuity/1.0'})
    with urllib.request.urlopen(req,timeout=30) as r:return json.loads(r.read().decode())
def valid_base(s):
    if not s or s in EXCLUDE:return False,'stable_or_wrapped'
    if any(s.endswith(z) for z in LEV):return False,'leveraged'
    if not s.isascii() or not s.isalnum():return False,'invalid_symbol'
    if s.endswith('B') and s[:-1] in TRADFI:return False,'tradfi_wrapper'
    return True,None
def fp(v):return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':')).encode()).hexdigest()[:20]
def main():
    info=get('/exchangeInfo');ticks=get('/ticker/24hr');tmap={x.get('symbol'):x for x in ticks}
    raw=0;eligible=[];excluded={'stable_or_wrapped':0,'leveraged':0,'tradfi_wrapper':0,'invalid_symbol':0,'non_trading_or_non_spot':0,'below_liquid_threshold':0}
    for x in info.get('symbols',[]):
        if x.get('quoteAsset')!='USDT':continue
        raw+=1
        if x.get('status')!='TRADING' or not x.get('isSpotTradingAllowed',True):
            excluded['non_trading_or_non_spot']+=1;continue
        base=x.get('baseAsset','');ok,why=valid_base(base)
        if not ok:excluded[why]+=1;continue
        t=tmap.get(x.get('symbol','')) or {}
        try:px=float(t.get('lastPrice') or 0);qv=float(t.get('quoteVolume') or 0);chg=float(t.get('priceChangePercent') or 0)
        except:continue
        if px<=0:continue
        eligible.append({'symbol':base,'pair':x.get('symbol'),'price':px,'quote_volume_24h':qv,'change_24h_pct':chg})
    eligible.sort(key=lambda z:z['quote_volume_24h'],reverse=True)
    liquid=[x for x in eligible if x['quote_volume_24h']>=MIN_QV][:RESEARCH_LIMIT]
    excluded['below_liquid_threshold']=sum(1 for x in eligible if x['quote_volume_24h']<MIN_QV)
    deep=liquid[:DEEP_LIMIT]
    # Active tier is a discovery shortlist only: large absolute move + liquidity. It is not an investment recommendation.
    active=sorted(deep,key=lambda x:(abs(x['change_24h_pct']), x['quote_volume_24h']),reverse=True)[:ACTIVE_LIMIT]
    fingerprint=fp({'eligible':[x['symbol'] for x in eligible],'liquid':[x['symbol'] for x in liquid],'deep':[x['symbol'] for x in deep],'active':[x['symbol'] for x in active]})
    payload={
      'schema':'wavelength-dynamic-market-universe-v2-continuity','mode':'PUBLIC_READ_ONLY_CONTINUITY','authority':'FALLBACK_WHILE_PRIVATE_RUNNER_UNAVAILABLE','generated_at':now(),'universe_fingerprint':fingerprint,
      'orders_enabled':False,'live_money_enabled':False,'execution_authority':False,'automatic_promotion':False,'automatic_allocation':False,'strategy_rule_mutation':False,'parameter_mutation':False,
      'policy':{'trading_spot_only':True,'stable_like_assets_excluded':True,'leveraged_tokens_excluded':True,'tradfi_wrappers_excluded':True,'ascii_alphanumeric_symbols_only':True,'research_min_quote_volume_24h_usd_proxy':MIN_QV,'research_limit':RESEARCH_LIMIT,'deep_limit':DEEP_LIMIT,'active_limit':ACTIVE_LIMIT,'frozen_strategy_cohorts_unchanged':True},
      'counts':{'raw_usdt_pairs':raw,'eligible':len(eligible),'liquid_research':len(liquid),'deep_intelligence':len(deep),'active_opportunity':len(active)},
      'coverage':{'discovery_pct':100.0,'liquid_of_eligible_pct':round(100*len(liquid)/len(eligible),2) if eligible else 0,'deep_of_liquid_pct':round(100*len(deep)/len(liquid),2) if liquid else 0},
      'excluded_counts':excluded,
      'tiers':{'eligible':[x['symbol'] for x in eligible],'liquid_research':[x['symbol'] for x in liquid],'deep_intelligence':[x['symbol'] for x in deep],'active_opportunity':[x['symbol'] for x in active]},
      'active_context':active,
      'note':'Continuity universe only. Existing frozen strategy cohorts remain unchanged. Active opportunity is a research-discovery tier, not execution authority.'
    }
    OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
    with HIST.open('a') as f:f.write(json.dumps({'generated_at':payload['generated_at'],'fingerprint':fingerprint,'counts':payload['counts']},sort_keys=True)+'\n')
    print(json.dumps({'fingerprint':fingerprint,'counts':payload['counts'],'excluded_counts':excluded,'deep_head':payload['tiers']['deep_intelligence'][:10]},indent=2))
if __name__=='__main__':main()
