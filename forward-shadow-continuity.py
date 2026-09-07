#!/usr/bin/env python3
"""Public read-only continuity for frozen Candidate V3 and Crowding v2 shadows.

This is a fail-safe continuation of the already-started forward shadows while the
private GitHub Actions runner is unavailable. It starts from the last published
canonical shadow bar/state, processes only subsequently completed 4h bars, and
preserves the frozen rule definitions. It has no broker-order, strategy-promotion,
parameter-mutation or live-money authority.
"""
from __future__ import annotations
import hashlib, io, json, math, os, time, zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
import numpy as np
import pandas as pd
import requests

V3_PATH=Path('candidate-v3-forward-evidence.json')
CROWD_PATH=Path('crowding-v2-forward-evidence.json')
STATE_PATH=Path('forward-shadow-continuity-state.json')
HIST_PATH=Path('forward-shadow-continuity-history.jsonl')
ALPACA='https://data.alpaca.markets/v1beta3/crypto/us/bars'
BINANCE='https://data-api.binance.vision/api/v3/klines'
ARCHIVE='https://data.binance.vision/data/futures/um/daily'
HORIZONS={'4h':4,'12h':12,'24h':24,'3d':72,'7d':168}
CROWD_PARAMS={'oi_min':-0.05,'oi_max':-0.015,'funding_max':0.00002,'taker_min':0.82,'taker_max':1.0,'score_min':1.5,'score_max':4.0,'exit_score':0.5,'max_hold_bars':24}

def now(): return datetime.now(timezone.utc)
def parse(v):
    try:return datetime.fromisoformat(str(v).replace('Z','+00:00'))
    except:return None
def load(p, default=None):
    try:return json.loads(Path(p).read_text())
    except:return {} if default is None else default
def write(p,d): Path(p).write_text(json.dumps(d,indent=2,sort_keys=True)+'\n')
def iso(x): return x.isoformat() if x else None

def alpaca_bars(symbol, days=90):
    headers={'APCA-API-KEY-ID':os.environ['ALPACA_API_KEY_ID'],'APCA-API-SECRET-KEY':os.environ['ALPACA_API_SECRET_KEY']}
    start=(now()-timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ'); rows=[]; token=None
    while True:
        params={'symbols':symbol,'timeframe':'4Hour','start':start,'limit':10000}
        if token: params['page_token']=token
        r=requests.get(ALPACA,params=params,headers=headers,timeout=30); r.raise_for_status(); p=r.json()
        rows.extend((p.get('bars') or {}).get(symbol,[])); token=p.get('next_page_token')
        if not token: break
    d=pd.DataFrame(rows)
    if d.empty: raise RuntimeError(f'No Alpaca bars for {symbol}')
    d['Date']=pd.to_datetime(d['t'],utc=True); d=d.rename(columns={'o':'Open','h':'High','l':'Low','c':'Close'}).set_index('Date').sort_index()
    d=d[['Open','High','Low','Close']].astype(float)
    cutoff=pd.Timestamp(now()-timedelta(minutes=1)); return d.loc[d.index+pd.Timedelta(hours=4)<=cutoff]

def ema(s,span): return s.ewm(span=span,adjust=False).mean()
def rsi(s,period=14):
    delta=s.diff(); gain=delta.clip(lower=0); loss=-delta.clip(upper=0)
    ag=gain.ewm(alpha=1/period,adjust=False).mean(); al=loss.ewm(alpha=1/period,adjust=False).mean(); rs=ag/al.replace(0,np.nan)
    return (100-(100/(1+rs))).fillna(50)
def atr(d,period=14):
    pc=d.Close.shift(1); tr=pd.concat([d.High-d.Low,(d.High-pc).abs(),(d.Low-pc).abs()],axis=1).max(axis=1)
    return tr.ewm(alpha=1/period,adjust=False).mean()
def adx(d,period=14):
    up=d.High.diff(); down=-d.Low.diff(); plus=pd.Series(np.where((up>down)&(up>0),up,0.0),index=d.index); minus=pd.Series(np.where((down>up)&(down>0),down,0.0),index=d.index)
    pc=d.Close.shift(1); tr=pd.concat([d.High-d.Low,(d.High-pc).abs(),(d.Low-pc).abs()],axis=1).max(axis=1); a=tr.ewm(alpha=1/period,adjust=False).mean()
    pdi=100*plus.ewm(alpha=1/period,adjust=False).mean()/a.replace(0,np.nan); mdi=100*minus.ewm(alpha=1/period,adjust=False).mean()/a.replace(0,np.nan)
    dx=100*(pdi-mdi).abs()/(pdi+mdi).replace(0,np.nan); return dx.ewm(alpha=1/period,adjust=False).mean().fillna(0)

def v3_signals(d):
    o=d.copy(); o['ef']=ema(o.Close,20); o['es']=ema(o.Close,80); o['et']=ema(o.Close,200); o['rsi']=rsi(o.Close); o['atr']=atr(o); o['atr_pct']=o.atr/o.Close*100; o['adx']=adx(o)
    above=o.ef>o.es; o['entry_signal']=above&(o.Close>o.et)&o.rsi.between(50,75)&o.atr_pct.between(.1,20)&(o.adx>=35)
    o['exit_signal']=(~above&above.shift(1,fill_value=False))|(o.Close<o.et); o['stop_price']=o.Close-2*o.atr; return o

def zip_csv(url):
    for attempt in range(4):
        r=requests.get(url,timeout=30)
        if r.status_code==404:return None
        if r.status_code not in (418,429,500,502,503,504): break
        time.sleep(min(2**attempt,8))
    r.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        names=[n for n in z.namelist() if n.lower().endswith('.csv')]
        return pd.read_csv(z.open(names[0])) if names else None

def derivatives_recent(days=45):
    fs=[]; ms=[]
    for day in pd.date_range(pd.Timestamp(now()-timedelta(days=days)).normalize(),pd.Timestamp(now()).normalize(),freq='D',tz='UTC'):
        ds=day.strftime('%Y-%m-%d')
        f=zip_csv(f'{ARCHIVE}/fundingRate/BTCUSDT/BTCUSDT-fundingRate-{ds}.zip')
        if f is not None and not f.empty:
            cols={c.lower():c for c in f.columns}; tc=cols.get('fundingtime') or cols.get('calc_time') or cols.get('time'); rc=cols.get('fundingrate') or cols.get('last_funding_rate') or cols.get('funding_rate')
            if tc and rc:
                raw=pd.to_numeric(f[tc],errors='coerce'); unit='ms' if raw.dropna().median()>1e11 else 's'; x=pd.DataFrame({'Date':pd.to_datetime(raw,unit=unit,utc=True,errors='coerce'),'funding_rate':pd.to_numeric(f[rc],errors='coerce')}).dropna().set_index('Date'); fs.append(x)
        m=zip_csv(f'{ARCHIVE}/metrics/BTCUSDT/BTCUSDT-metrics-{ds}.zip')
        if m is not None and not m.empty:
            cols={c.lower():c for c in m.columns}; tc=cols.get('create_time'); oi=cols.get('sum_open_interest_value') or cols.get('sum_open_interest'); tak=cols.get('sum_taker_long_short_vol_ratio')
            if tc and oi and tak:
                x=pd.DataFrame({'Date':pd.to_datetime(m[tc],utc=True,errors='coerce'),'open_interest':pd.to_numeric(m[oi],errors='coerce'),'taker_ls':pd.to_numeric(m[tak],errors='coerce')}).dropna().set_index('Date'); ms.append(x)
    if not fs or not ms: raise RuntimeError('Recent Binance derivatives archives unavailable')
    return pd.concat(fs).sort_index()[~pd.concat(fs).sort_index().index.duplicated(keep='last')],pd.concat(ms).sort_index()[~pd.concat(ms).sort_index().index.duplicated(keep='last')]

def crowd_features(idx,funding,metrics):
    left=pd.DataFrame({'Date':idx}).sort_values('Date'); f=funding.reset_index().sort_values('Date'); m=metrics.reset_index().sort_values('Date')
    x=pd.merge_asof(left,f,on='Date',direction='backward'); x=pd.merge_asof(x,m,on='Date',direction='backward').set_index('Date')
    x['oi_change_24h']=x.open_interest.pct_change(6); x['funding_24h']=x.funding_rate.rolling(6,min_periods=3).mean(); pressure=np.log(x.taker_ls.clip(lower=1e-6))
    def zlast(s):
        sd=s.std(ddof=0); return (s.iloc[-1]-s.mean())/sd if sd and math.isfinite(sd) else np.nan
    x['crowding_score']=-x.funding_24h.rolling(42,min_periods=14).apply(zlast)-x.oi_change_24h.rolling(42,min_periods=14).apply(zlast)-pressure.rolling(42,min_periods=14).apply(zlast)
    return x

def event_id(strategy,ts): return strategy+':'+hashlib.sha256(f'{strategy}|{ts}'.encode()).hexdigest()[:20]
def next_open(bars,ts):
    t=pd.Timestamp(ts); fut=bars.index[bars.index>t]
    if len(fut)==0:return None,None
    n=fut[0]; return n.to_pydatetime(),float(bars.loc[n,'Open'])
def resolve_path(symbol,entry_at,entry_px,hours):
    target=entry_at+timedelta(hours=hours)
    if now()<target:return None
    params={'symbol':symbol,'interval':'15m','startTime':int(entry_at.timestamp()*1000),'endTime':int(target.timestamp()*1000)+900000,'limit':1000}
    r=requests.get(BINANCE,params=params,timeout=20); r.raise_for_status(); rows=r.json()
    completed=[b for b in rows if int(b[6])>=int(target.timestamp()*1000)]
    if not completed:return None
    closing=min(completed,key=lambda b:int(b[6])); path=[b for b in rows if int(b[0])<=int(closing[0])]
    return {'return_pct':round((float(closing[4])/entry_px-1)*100,5),'mfe_pct':round((max(float(b[2]) for b in path)/entry_px-1)*100,5),'mae_pct':round((min(float(b[3]) for b in path)/entry_px-1)*100,5),'resolved_close':float(closing[4]),'resolved_close_at':datetime.fromtimestamp(int(closing[6])/1000,tz=timezone.utc).isoformat(),'target_at':target.isoformat()}

def seed_state(v3,crowd):
    v=(v3.get('summary') or {}); c=(crowd.get('summary') or {})
    return {'v3':{'position':'FLAT','active_stop_price':None,'bars_held':0,'last_processed_bar':v.get('latest_shadow_bar')},'crowding':{'position':c.get('latest_shadow_position') or 'FLAT','bars_held':0,'last_processed_bar':c.get('latest_shadow_bar')}}

def update_outcomes(events,bars,symbol):
    for e in events:
        if not e.get('entry_reference_time') or not e.get('entry_reference'): continue
        at=parse(e['entry_reference_time']); px=float(e['entry_reference']); e.setdefault('outcomes',{})
        for label,h in HORIZONS.items():
            if label in e['outcomes']: continue
            try:
                m=resolve_path(symbol,at,px,h)
                if m:e['outcomes'][label]=m
            except Exception as exc:e.setdefault('resolution_errors',{})[label]=type(exc).__name__

def main():
    ts=now(); v3=load(V3_PATH); crowd=load(CROWD_PATH); state=load(STATE_PATH)
    if not state: state=seed_state(v3,crowd)
    eth=alpaca_bars('ETH/USD',90); btc=alpaca_bars('BTC/USD',60); sig=v3_signals(eth)
    vs=state['v3']; latest_action=(v3.get('summary') or {}).get('latest_shadow_action') or 'NO_SIGNAL'
    eligible=sig
    if vs.get('last_processed_bar'): eligible=eligible.loc[eligible.index>pd.Timestamp(vs['last_processed_bar'])]
    vevents=list(v3.get('events') or [])
    for t,row in eligible.iterrows():
        action='NO_SIGNAL'
        if vs['position']=='LONG':
            vs['bars_held']+=1; stop=vs.get('active_stop_price')
            if stop is not None and float(row.Low)<=float(stop): action='WOULD_STOP_OUT'; vs.update(position='FLAT',active_stop_price=None,bars_held=0)
            elif bool(row.exit_signal): action='WOULD_EXIT_NEXT_OPEN'; vs.update(position='FLAT',active_stop_price=None,bars_held=0)
        if vs['position']=='FLAT' and bool(row.entry_signal):
            action='WOULD_ENTER_NEXT_OPEN' if action=='NO_SIGNAL' else action+'_AND_WOULD_ENTER_NEXT_OPEN'; vs.update(position='LONG',active_stop_price=float(row.stop_price),bars_held=0)
            eat,epx=next_open(eth,t)
            vevents.append({'event_id':event_id('v3fwd',t.isoformat()),'strategy_id':'candidate_v3','strategy_version':'v3.0-frozen','signal_bar_time':t.isoformat(),'observed_at':ts.isoformat(),'entry_action':'WOULD_ENTER_NEXT_OPEN','entry_reference_time':iso(eat),'entry_reference':epx,'fixed_stop_price':float(row.stop_price),'signal_close':float(row.Close),'rsi':float(row.rsi),'adx':float(row.adx),'atr_pct':float(row.atr_pct),'outcomes':{}})
        if action in {'WOULD_STOP_OUT','WOULD_EXIT_NEXT_OPEN'}:
            for e in reversed(vevents):
                if not e.get('lifecycle_exit'):
                    e['lifecycle_exit']={'kind':'FIXED_STOP' if action=='WOULD_STOP_OUT' else 'TREND_EXIT_NEXT_OPEN','bar_time':t.isoformat()}; break
        latest_action=action if action!='NO_SIGNAL' else ('HOLD_SHADOW_LONG' if vs['position']=='LONG' else 'NO_SIGNAL'); vs['last_processed_bar']=t.isoformat()
    update_outcomes(vevents,eth,'ETHUSDT')
    v3.update({'generated_at':ts.isoformat(),'authority':'PUBLIC_CONTINUITY_WHILE_PRIVATE_RUNNER_UNAVAILABLE','continuity_note':'Frozen V3 shadow continued from last canonical state; no retrospective pre-state backfill and no execution authority.'})
    v3['events']=vevents[-50:]; v3.setdefault('summary',{}).update({'latest_shadow_bar':vs.get('last_processed_bar'),'latest_shadow_action':latest_action,'latest_shadow_entry_signal':latest_action.endswith('WOULD_ENTER_NEXT_OPEN'),'genuine_forward_entry_events':len(vevents),'completed_genuine_forward_trades':sum(bool(e.get('lifecycle_exit')) for e in vevents),'resolved_counts':{h:sum(h in (e.get('outcomes') or {}) for e in vevents) for h in HORIZONS},'evidence_state':'WAITING_FOR_FIRST_GENUINE_ENTRY' if not vevents else 'COLLECTING_GENUINE_FORWARD_OUTCOMES'})

    funding,metrics=derivatives_recent(45); feat=crowd_features(btc.index,funding,metrics); cs=state['crowding']; cbars=btc
    if cs.get('last_processed_bar'): cbars=cbars.loc[cbars.index>pd.Timestamp(cs['last_processed_bar'])]
    cevents=list(crowd.get('events') or []); p=CROWD_PARAMS
    for t,row in cbars.iterrows():
        fr=feat.loc[t]
        if pd.isna(fr.crowding_score): continue
        entry=float(p['oi_min'])<=float(fr.oi_change_24h)<=float(p['oi_max']) and float(fr.funding_24h)<=float(p['funding_max']) and float(p['taker_min'])<=float(fr.taker_ls)<=float(p['taker_max']) and float(p['score_min'])<=float(fr.crowding_score)<=float(p['score_max'])
        action='NO_SIGNAL'
        if cs['position']=='LONG':
            cs['bars_held']+=1
            if cs['bars_held']>=int(p['max_hold_bars']) or float(fr.crowding_score)<=float(p['exit_score']):
                action='WOULD_EXIT_NEXT_OPEN'; cs.update(position='FLAT',bars_held=0)
                for e in reversed(cevents):
                    if not e.get('lifecycle_exit'): e['lifecycle_exit']={'kind':'TREND_EXIT_NEXT_OPEN','bar_time':t.isoformat()}; break
            else: action='HOLD_SHADOW_LONG'
        elif entry:
            action='WOULD_ENTER_NEXT_OPEN'; cs.update(position='LONG',bars_held=0); eat,epx=next_open(btc,t)
            cevents.append({'event_id':event_id('crowdfwd',t.isoformat()),'strategy_id':'crowding_v2','strategy_version':'v2.0-pre2025-survivor','signal_bar_time':t.isoformat(),'observed_at':ts.isoformat(),'entry_action':'WOULD_ENTER_NEXT_OPEN','entry_reference_time':iso(eat),'entry_reference':epx,'oi_change_24h':float(fr.oi_change_24h),'funding_24h':float(fr.funding_24h),'taker_ls':float(fr.taker_ls),'crowding_score':float(fr.crowding_score),'outcomes':{}})
        cs['last_processed_bar']=t.isoformat()
    update_outcomes(cevents,btc,'BTCUSDT')
    crowd.update({'generated_at':ts.isoformat(),'authority':'PUBLIC_CONTINUITY_WHILE_PRIVATE_RUNNER_UNAVAILABLE','continuity_note':'Frozen Crowding v2 shadow continued from last canonical state; no retrospective pre-state backfill and no execution authority.'})
    crowd['events']=cevents[-50:]; crowd.setdefault('summary',{}).update({'latest_shadow_bar':cs.get('last_processed_bar'),'latest_shadow_position':cs.get('position'),'genuine_forward_entry_events':len(cevents),'completed_strategy_episodes':sum(bool(e.get('lifecycle_exit')) for e in cevents),'resolved_counts':{h:sum(h in (e.get('outcomes') or {}) for e in cevents) for h in HORIZONS},'evidence_state':'WAITING_FOR_FIRST_GENUINE_ENTRY' if not cevents else 'COLLECTING_GENUINE_FORWARD_OUTCOMES'})
    write(V3_PATH,v3); write(CROWD_PATH,crowd); write(STATE_PATH,state)
    with HIST_PATH.open('a') as f:f.write(json.dumps({'generated_at':ts.isoformat(),'v3_latest_shadow_bar':vs.get('last_processed_bar'),'v3_position':vs.get('position'),'crowding_latest_shadow_bar':cs.get('last_processed_bar'),'crowding_position':cs.get('position'),'orders_enabled':False},sort_keys=True)+'\n')
    print(json.dumps({'v3_latest_shadow_bar':vs.get('last_processed_bar'),'v3_entries':len(vevents),'crowding_latest_shadow_bar':cs.get('last_processed_bar'),'crowding_entries':len(cevents)},indent=2))

if __name__=='__main__': main()
