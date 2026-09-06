#!/usr/bin/env python3
from __future__ import annotations
import json, statistics
from datetime import datetime, timezone
from pathlib import Path

SRC=Path('outcome-warehouse.json');OUT=Path('outcome-analytics.json');HORIZONS=('4h','12h','24h','3d','7d');MIN_ESTABLISHED=30

def mean(xs):return sum(xs)/len(xs) if xs else None

def median(xs):return statistics.median(xs) if xs else None

def summarize(events,h):
    vals=[];mfes=[];maes=[]
    for e in events:
        o=(e.get('outcomes') or {}).get(h) or {}
        if o.get('status')!='RESOLVED' or o.get('return_pct') is None:continue
        vals.append(float(o['return_pct']))
        if o.get('mfe_pct') is not None:mfes.append(float(o['mfe_pct']))
        if o.get('mae_pct') is not None:maes.append(float(o['mae_pct']))
    n=len(vals);wins=sum(v>0 for v in vals)
    return {'n':n,'maturity':'ESTABLISHED_SAMPLE' if n>=MIN_ESTABLISHED else 'PROVISIONAL_SMALL_SAMPLE','positive_rate_pct':100*wins/n if n else None,'mean_return_pct':mean(vals),'median_return_pct':median(vals),'mean_mfe_pct':mean(mfes),'mean_mae_pct':mean(maes)}

def groups(events,key,path='segments'):
    out={}
    for e in events:
        value=(e.get(path) or {}).get(key)
        if value is None:continue
        out.setdefault(str(value),[]).append(e)
    return out

def table(events,key):
    return {name:{h:summarize(rows,h) for h in HORIZONS} for name,rows in groups(events,key).items()}

def main():
    data=json.loads(SRC.read_text());events=data.get('events') or []
    payload={
      'mode':'WAVELENGTH_RESEARCH_OUTCOME_ANALYTICS_V1_READ_ONLY','generated_at':datetime.now(timezone.utc).isoformat(),
      'orders_enabled':False,'live_money_enabled':False,'execution_authority':False,'automatic_promotion':False,'strategy_rule_mutation':False,
      'minimum_established_sample':MIN_ESTABLISHED,'event_count':len(events),'horizons':list(HORIZONS),
      'overall':{h:summarize(events,h) for h in HORIZONS},
      'by_score_band':table(events,'score_band'),'by_stage':{name:{h:summarize(rows,h) for h in HORIZONS} for name,rows in groups(events,'stage',path='root').items()} if False else {},
      'by_adx_band':table(events,'adx_band'),'by_relative_strength':table(events,'relative_strength_band'),'by_trend':table(events,'trend'),'by_setup':table(events,'setup'),
    }
    stage_groups={}
    for e in events:stage_groups.setdefault(str(e.get('stage') or 'UNKNOWN'),[]).append(e)
    payload['by_stage']={k:{h:summarize(v,h) for h in HORIZONS} for k,v in stage_groups.items()}
    # Rank currently-resolved groups by 4h mean, but never call small samples an edge.
    leaders=[]
    dimensions=[('score_band',payload['by_score_band']),('stage',payload['by_stage']),('adx',payload['by_adx_band']),('relative_strength',payload['by_relative_strength']),('trend',payload['by_trend']),('setup',payload['by_setup'])]
    for dim,tab in dimensions:
        for name,stats in tab.items():
            s=stats['4h']
            if s['n']:
                leaders.append({'dimension':dim,'value':name,**s})
    leaders.sort(key=lambda x:(x['mean_return_pct'] is not None,x['mean_return_pct'] or -1e9),reverse=True)
    payload['provisional_4h_leaders']=leaders[:12]
    payload['warnings']=['All segments with n < 30 are explicitly provisional.','These summaries describe observed forward outcomes and cannot promote, allocate or mutate strategy rules.']
    OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
    print('analytics events',len(events),'4h',payload['overall']['4h']['n'])
if __name__=='__main__':main()
