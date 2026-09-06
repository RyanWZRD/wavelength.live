#!/usr/bin/env python3
from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path

HISTORY=Path('intelligence-history.json')
RADAR=Path('hourly-radar-outcomes.json')
OUT=Path('outcome-warehouse.json')
HORIZONS=('4h','12h','24h','3d','7d')

def load(path, default):
    try:return json.loads(path.read_text())
    except Exception:return default

def nearest_snapshot(history,symbol,ts):
    arr=(history.get('symbols') or {}).get(symbol,[])
    target=datetime.fromisoformat(ts.replace('Z','+00:00')).timestamp()
    best=None;best_dt=None
    for x in arr:
        try:t=datetime.fromisoformat(str(x.get('ts','')).replace('Z','+00:00')).timestamp()
        except Exception:continue
        dt=abs(t-target)
        if best is None or dt<best_dt:best=x;best_dt=dt
    return best if best_dt is not None and best_dt<=6*3600 else None

def band(v,cuts,labels):
    if v is None:return 'UNKNOWN'
    x=float(v)
    for c,l in zip(cuts,labels):
        if x<c:return l
    return labels[-1]

def main():
    history=load(HISTORY,{'symbols':{}});radar=load(RADAR,{'recent_events':[]})
    rows=[]
    for e in radar.get('recent_events') or []:
        sym=str(e.get('symbol') or '').upper();capt=e.get('captured_at')
        if not sym or not capt:continue
        snap=nearest_snapshot(history,sym,capt)
        outcomes={}
        for h in HORIZONS:
            o=(e.get('horizons') or {}).get(h) or {'status':'PENDING'}
            r=o.get('return_pct')
            outcomes[h]={
                'status':o.get('status','PENDING'),
                'return_pct':r,
                'positive':None if r is None else bool(r>0),
                'mfe_pct':o.get('mfe_pct'),
                'mae_pct':o.get('mae_pct'),
            }
        score=e.get('score')
        row={
            'event_id':e.get('event_id') or f"radar:{sym}:{capt}",
            'source':'HOURLY_RADAR_FORWARD_EPISODE',
            'symbol':sym,'captured_at':capt,'rank':e.get('rank'),'score':score,
            'peak_score':e.get('peak_score'),'stage':e.get('stage'),'entry_reference':e.get('entry_reference'),
            'features':{
                'trend':snap.get('trend') if snap else None,
                'rsi':snap.get('rsi') if snap else None,
                'adx':snap.get('adx') if snap else None,
                'atr_pct':snap.get('atr_pct') if snap else None,
                'volume_ratio':snap.get('volume_ratio') if snap else None,
                'vs_btc_30d_pct':snap.get('vs_btc_30d_pct') if snap else None,
                'setup':snap.get('setup') if snap else None,
                'snapshot_ts':snap.get('ts') if snap else None,
            },
            'segments':{
                'score_band':band(score,[65,75,85,101],['<65','65-74','75-84','85+']),
                'adx_band':band(snap.get('adx') if snap else None,[20,35,1e9],['<20','20-34','35+']),
                'relative_strength_band':band(snap.get('vs_btc_30d_pct') if snap else None,[-5,5,1e9],['LAGGING','NEUTRAL','LEADING']),
                'trend':snap.get('trend') if snap else 'UNKNOWN',
                'setup':bool(snap.get('setup')) if snap else None,
            },
            'outcomes':outcomes,
        }
        rows.append(row)
    rows.sort(key=lambda x:x['captured_at'])
    resolved={h:sum(1 for r in rows if r['outcomes'][h]['status']=='RESOLVED') for h in HORIZONS}
    payload={
        'mode':'WAVELENGTH_OUTCOME_WAREHOUSE_V1_READ_ONLY','generated_at':datetime.now(timezone.utc).isoformat(),
        'orders_enabled':False,'live_money_enabled':False,'execution_authority':False,
        'automatic_promotion':False,'strategy_rule_mutation':False,
        'source_lineage':['hourly-radar-outcomes.json','intelligence-history.json'],
        'horizons':list(HORIZONS),'event_count':len(rows),'resolved_counts':resolved,
        'events':rows,
        'notes':['Forward outcomes are observational research evidence, not trading instructions.','Feature enrichment is nearest durable intelligence snapshot within six hours; absent context remains null rather than guessed.']
    }
    OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
    print(f"warehouse events={len(rows)} resolved4h={resolved['4h']}")
if __name__=='__main__':main()
