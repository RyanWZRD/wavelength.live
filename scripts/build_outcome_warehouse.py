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

def regime_label(trend, adx_band, rs_band):
    trend=str(trend or 'UNKNOWN').upper()
    adx_band=str(adx_band or 'UNKNOWN')
    rs_band=str(rs_band or 'UNKNOWN').upper()
    if trend=='UNKNOWN' and adx_band=='UNKNOWN' and rs_band=='UNKNOWN':return 'UNKNOWN'
    return f'{trend}|ADX:{adx_band}|RS:{rs_band}'

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
        score_model=e.get('score_model') or 'LEGACY_RADAR_UNVERSIONED'
        score_version=e.get('score_version')
        trend=snap.get('trend') if snap else 'UNKNOWN'
        adx_band=band(snap.get('adx') if snap else None,[20,35,1e9],['<20','20-34','35+'])
        rs_band=band(snap.get('vs_btc_30d_pct') if snap else None,[-5,5,1e9],['LAGGING','NEUTRAL','LEADING'])
        row={
            'event_id':e.get('event_id') or f"radar:{sym}:{capt}",
            'source':'HOURLY_RADAR_FORWARD_EPISODE',
            'symbol':sym,'captured_at':capt,'rank':e.get('rank'),'score':score,'score_model':score_model,'score_version':score_version,
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
                'score_model':score_model,
                'score_model_band':f"{score_model}:{band(score,[65,75,85,101],['<65','65-74','75-84','85+'])}",
                'adx_band':adx_band,
                'relative_strength_band':rs_band,
                'trend':trend,
                'setup':bool(snap.get('setup')) if snap else None,
                'regime':regime_label(trend,adx_band,rs_band),
            },
            'outcomes':outcomes,
        }
        rows.append(row)
    rows.sort(key=lambda x:x['captured_at'])
    resolved={h:sum(1 for r in rows if r['outcomes'][h]['status']=='RESOLVED') for h in HORIZONS}
    known_regimes=sum(1 for r in rows if (r.get('segments') or {}).get('regime')!='UNKNOWN')
    payload={
        'mode':'WAVELENGTH_OUTCOME_WAREHOUSE_V2_REGIME_AWARE_READ_ONLY','generated_at':datetime.now(timezone.utc).isoformat(),
        'orders_enabled':False,'live_money_enabled':False,'execution_authority':False,
        'automatic_promotion':False,'strategy_rule_mutation':False,
        'source_lineage':['hourly-radar-outcomes.json','intelligence-history.json'],
        'horizons':list(HORIZONS),'event_count':len(rows),'resolved_counts':resolved,
        'regime_context_events':known_regimes,
        'events':rows,
        'notes':['Forward outcomes are observational research evidence, not trading instructions.','Feature enrichment is nearest durable intelligence snapshot within six hours; absent context remains null rather than guessed.','Composite regimes combine trend, ADX band and BTC-relative-strength state and are descriptive only.','Score lineage is explicit; legacy/unversioned radar scores are never silently treated as WAVELENGTH_INTELLIGENCE_V1.']
    }
    OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
    print(f"warehouse events={len(rows)} resolved4h={resolved['4h']} regime_context={known_regimes}")
if __name__=='__main__':main()
