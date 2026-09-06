#!/usr/bin/env python3
from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path

HISTORY=Path('intelligence-history.json')
RADAR=Path('hourly-radar-outcomes.json')
OUT=Path('outcome-warehouse.json')
HORIZONS=('4h','12h','24h','3d','7d')
MARKET_CONTEXT_MODEL='WAVELENGTH_MARKET_CONTEXT_V1'
MARKET_CONTEXT_VERSION=1

def load(path, default):
    try:return json.loads(path.read_text())
    except Exception:return default

def nearest(arr,ts,key='ts',max_hours=6):
    target=datetime.fromisoformat(ts.replace('Z','+00:00')).timestamp();best=None;best_dt=None
    for x in arr:
        try:t=datetime.fromisoformat(str(x.get(key,'')).replace('Z','+00:00')).timestamp()
        except Exception:continue
        dt=abs(t-target)
        if best is None or dt<best_dt:best=x;best_dt=dt
    return best if best_dt is not None and best_dt<=max_hours*3600 else None

def nearest_snapshot(history,symbol,ts):return nearest((history.get('symbols') or {}).get(symbol,[]),ts)
def nearest_market_context(history,ts):return nearest(history.get('market_context') or [],ts)

def band(v,cuts,labels):
    if v is None:return 'UNKNOWN'
    x=float(v)
    for c,l in zip(cuts,labels):
        if x<c:return l
    return labels[-1]

def regime_label(trend, adx_band, rs_band):
    trend=str(trend or 'UNKNOWN').upper();adx_band=str(adx_band or 'UNKNOWN');rs_band=str(rs_band or 'UNKNOWN').upper()
    if trend=='UNKNOWN' and adx_band=='UNKNOWN' and rs_band=='UNKNOWN':return 'UNKNOWN'
    return f'{trend}|ADX:{adx_band}|RS:{rs_band}'

def combine(*parts):
    vals=[str(x) for x in parts]
    return 'UNKNOWN' if any(x in ('UNKNOWN','None','null') for x in vals) else '|'.join(vals)

def main():
    history=load(HISTORY,{'symbols':{},'market_context':[]});radar=load(RADAR,{'recent_events':[]});rows=[]
    for e in radar.get('recent_events') or []:
        sym=str(e.get('symbol') or '').upper();capt=e.get('captured_at')
        if not sym or not capt:continue
        snap=nearest_snapshot(history,sym,capt);market=nearest_market_context(history,capt);outcomes={}
        for h in HORIZONS:
            o=(e.get('horizons') or {}).get(h) or {'status':'PENDING'};r=o.get('return_pct')
            outcomes[h]={'status':o.get('status','PENDING'),'return_pct':r,'positive':None if r is None else bool(r>0),'mfe_pct':o.get('mfe_pct'),'mae_pct':o.get('mae_pct')}
        score=e.get('score');score_model=e.get('score_model') or 'LEGACY_RADAR_UNVERSIONED';score_version=e.get('score_version')
        trend=snap.get('trend') if snap else 'UNKNOWN';adx_band=band(snap.get('adx') if snap else None,[20,35,1e9],['<20','20-34','35+']);rs_band=band(snap.get('vs_btc_30d_pct') if snap else None,[-5,5,1e9],['LAGGING','NEUTRAL','LEADING'])
        score_band=band(score,[65,75,85,101],['<65','65-74','75-84','85+'])
        coin_vol=band(snap.get('atr_pct') if snap else None,[2,5,1e9],['LOW','NORMAL','HIGH'])
        volume_regime=band(snap.get('volume_ratio') if snap else None,[0.8,1.25,1e9],['QUIET','NORMAL','EXPANDING'])
        btc_trend=(market or {}).get('btc_trend','UNKNOWN');btc_vol=(market or {}).get('btc_volatility_regime','UNKNOWN');breadth=(market or {}).get('breadth_regime','UNKNOWN');market_regime=(market or {}).get('market_regime','UNKNOWN')
        row={
            'event_id':e.get('event_id') or f"radar:{sym}:{capt}",'source':'HOURLY_RADAR_FORWARD_EPISODE','symbol':sym,'captured_at':capt,'rank':e.get('rank'),'score':score,'score_model':score_model,'score_version':score_version,
            'peak_score':e.get('peak_score'),'stage':e.get('stage'),'entry_reference':e.get('entry_reference'),
            'features':{'trend':snap.get('trend') if snap else None,'rsi':snap.get('rsi') if snap else None,'adx':snap.get('adx') if snap else None,'atr_pct':snap.get('atr_pct') if snap else None,'volume_ratio':snap.get('volume_ratio') if snap else None,'vs_btc_30d_pct':snap.get('vs_btc_30d_pct') if snap else None,'setup':snap.get('setup') if snap else None,'snapshot_ts':snap.get('ts') if snap else None},
            'market_context':{
                'context_model':(market or {}).get('context_model'),'context_version':(market or {}).get('context_version'),'snapshot_ts':(market or {}).get('ts'),
                'btc_trend':(market or {}).get('btc_trend'),'btc_adx':(market or {}).get('btc_adx'),'btc_adx_regime':(market or {}).get('btc_adx_regime'),'btc_atr_pct':(market or {}).get('btc_atr_pct'),'btc_volatility_regime':(market or {}).get('btc_volatility_regime'),'btc_chg_24h_pct':(market or {}).get('btc_chg_24h_pct'),'btc_score':(market or {}).get('btc_score'),
                'bullish_breadth_pct':(market or {}).get('bullish_breadth_pct'),'setup_breadth_pct':(market or {}).get('setup_breadth_pct'),'high_score_breadth_pct':(market or {}).get('high_score_breadth_pct'),'breadth_regime':(market or {}).get('breadth_regime'),'median_adx':(market or {}).get('median_adx'),'median_atr_pct':(market or {}).get('median_atr_pct'),'market_regime':(market or {}).get('market_regime'),
                'durable_derivatives_context':False,'derivatives_context_state':'UNAVAILABLE_DURABLE_PROVIDER'
            },
            'segments':{
                'score_band':score_band,'score_model':score_model,'score_model_band':f'{score_model}:{score_band}','adx_band':adx_band,'relative_strength_band':rs_band,'trend':trend,'setup':bool(snap.get('setup')) if snap else None,'regime':regime_label(trend,adx_band,rs_band),
                'coin_volatility_regime':coin_vol,'volume_regime':volume_regime,'btc_trend':btc_trend,'btc_volatility_regime':btc_vol,'breadth_regime':breadth,'market_regime':market_regime,
                'score_band_x_btc_trend':combine(score_band,btc_trend),'score_band_x_breadth':combine(score_band,breadth),'adx_x_btc_trend':combine(adx_band,btc_trend),'rs_x_btc_trend':combine(rs_band,btc_trend),'adx_x_rs':combine(adx_band,rs_band),'trend_x_btc_volatility':combine(trend,btc_vol),'setup_x_breadth':combine('SETUP' if snap and snap.get('setup') else 'NO_SETUP' if snap else 'UNKNOWN',breadth)
            },
            'outcomes':outcomes,
        }
        rows.append(row)
    rows.sort(key=lambda x:x['captured_at']);resolved={h:sum(1 for r in rows if r['outcomes'][h]['status']=='RESOLVED') for h in HORIZONS};known_regimes=sum(1 for r in rows if (r.get('segments') or {}).get('regime')!='UNKNOWN');known_market=sum(1 for r in rows if (r.get('segments') or {}).get('market_regime')!='UNKNOWN')
    payload={
        'mode':'WAVELENGTH_OUTCOME_WAREHOUSE_V3_MARKET_CONTEXT_READ_ONLY','generated_at':datetime.now(timezone.utc).isoformat(),'orders_enabled':False,'live_money_enabled':False,'execution_authority':False,'automatic_promotion':False,'strategy_rule_mutation':False,
        'source_lineage':['hourly-radar-outcomes.json','intelligence-history.json'],'horizons':list(HORIZONS),'event_count':len(rows),'resolved_counts':resolved,'regime_context_events':known_regimes,'market_context_events':known_market,'market_context_model':MARKET_CONTEXT_MODEL,'market_context_version':MARKET_CONTEXT_VERSION,'events':rows,
        'notes':['Forward outcomes are observational research evidence, not trading instructions.','Coin features and market context use nearest durable snapshots within six hours; absent context remains null rather than guessed.','Market context includes BTC trend/volatility and liquid-universe breadth.','Durable derivatives context remains unavailable and is explicitly excluded from hypothesis generation.','Score lineage is explicit; legacy/unversioned radar scores are never silently treated as WAVELENGTH_INTELLIGENCE_V1.']
    }
    OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n');print(f"warehouse events={len(rows)} resolved4h={resolved['4h']} regime_context={known_regimes} market_context={known_market}")
if __name__=='__main__':main()
