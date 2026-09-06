#!/usr/bin/env python3
from __future__ import annotations
import json, statistics
from datetime import datetime, timezone
from pathlib import Path

SRC=Path('outcome-warehouse.json');OUT=Path('outcome-analytics.json');HORIZONS=('4h','12h','24h','3d','7d')
MIN_ESTABLISHED=30;MIN_DISCOVERY_SEGMENT=5;MIN_DISCOVERY_COMPARISON=5;MIN_FRESH_CONFIRMATION=15

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

def resolved4h(e):
    o=(e.get('outcomes') or {}).get('4h') or {}
    return o.get('status')=='RESOLVED' and o.get('return_pct') is not None

def clean_value(v):
    s=str(v)
    return s not in ('UNKNOWN','None','null','False')

def hypothesis_queue(events, dimensions):
    resolved=[e for e in events if resolved4h(e)]
    queue=[]
    for dim,tab in dimensions:
        for value,stats in tab.items():
            if not clean_value(value):continue
            seg=[e for e in resolved if str((e.get('segments') or {}).get(dim))==str(value)] if dim!='stage' else [e for e in resolved if str(e.get('stage') or 'UNKNOWN')==str(value)]
            comp=[e for e in resolved if e not in seg]
            if len(seg)<MIN_DISCOVERY_SEGMENT or len(comp)<MIN_DISCOVERY_COMPARISON:continue
            s=summarize(seg,'4h');c=summarize(comp,'4h')
            if s['mean_return_pct'] is None or c['mean_return_pct'] is None:continue
            mean_lift=s['mean_return_pct']-c['mean_return_pct']
            hit_lift=(s['positive_rate_pct'] or 0)-(c['positive_rate_pct'] or 0)
            gates={
                'segment_positive_mean':s['mean_return_pct']>0,
                'segment_positive_median':(s['median_return_pct'] or 0)>0,
                'mean_lift_ge_0_75pct':mean_lift>=0.75,
                'positive_rate_lift_ge_10pp':hit_lift>=10.0,
            }
            passed=sum(gates.values())
            status='CANDIDATE_TO_CHALLENGE' if passed==len(gates) else 'WATCHLIST'
            if status=='WATCHLIST' and not (s['mean_return_pct']>c['mean_return_pct'] and passed>=2):continue
            queue.append({
                'hypothesis_id':f"4h:{dim}:{value}",
                'status':status,'dimension':dim,'value':value,'horizon':'4h',
                'discovery_sample_n':s['n'],'comparison_sample_n':c['n'],
                'segment_mean_return_pct':s['mean_return_pct'],'comparison_mean_return_pct':c['mean_return_pct'],'mean_return_lift_pct':mean_lift,
                'segment_median_return_pct':s['median_return_pct'],'segment_positive_rate_pct':s['positive_rate_pct'],'comparison_positive_rate_pct':c['positive_rate_pct'],'positive_rate_lift_pp':hit_lift,
                'gates':gates,'same_sample_discovery':True,'automatic_strategy_change':False,'automatic_promotion':False,
                'fresh_confirmation_required':True,'minimum_fresh_matching_events':MIN_FRESH_CONFIRMATION,
                'falsification_rule':f"Collect at least {MIN_FRESH_CONFIRMATION} fresh matching 4h outcomes after hypothesis creation; reject if fresh mean return <= comparison baseline or fresh positive rate does not exceed baseline.",
                'statement':f"{dim}={value} may improve 4h forward outcomes versus the rest of the observed sample; this is a discovery hypothesis, not an edge claim."
            })
    queue.sort(key=lambda x:(x['status']=='CANDIDATE_TO_CHALLENGE',x['mean_return_lift_pct'],x['positive_rate_lift_pp']),reverse=True)
    return queue[:12]

def main():
    data=json.loads(SRC.read_text());events=data.get('events') or []
    payload={
      'mode':'WAVELENGTH_RESEARCH_OUTCOME_ANALYTICS_V2_REGIME_HYPOTHESIS_READ_ONLY','generated_at':datetime.now(timezone.utc).isoformat(),
      'orders_enabled':False,'live_money_enabled':False,'execution_authority':False,'automatic_promotion':False,'strategy_rule_mutation':False,
      'minimum_established_sample':MIN_ESTABLISHED,'minimum_discovery_segment':MIN_DISCOVERY_SEGMENT,'minimum_discovery_comparison':MIN_DISCOVERY_COMPARISON,
      'minimum_fresh_confirmation':MIN_FRESH_CONFIRMATION,'event_count':len(events),'horizons':list(HORIZONS),
      'overall':{h:summarize(events,h) for h in HORIZONS},
      'by_score_band':table(events,'score_band'),'by_adx_band':table(events,'adx_band'),'by_relative_strength':table(events,'relative_strength_band'),'by_trend':table(events,'trend'),'by_setup':table(events,'setup'),'by_regime':table(events,'regime'),
    }
    stage_groups={}
    for e in events:stage_groups.setdefault(str(e.get('stage') or 'UNKNOWN'),[]).append(e)
    payload['by_stage']={k:{h:summarize(v,h) for h in HORIZONS} for k,v in stage_groups.items()}
    known=[e for e in events if (e.get('segments') or {}).get('regime') not in (None,'UNKNOWN')]
    payload['regime_coverage']={'known_context_events':len(known),'total_events':len(events),'coverage_pct':100*len(known)/len(events) if events else 0.0,'state':'BUILDING' if len(known)<MIN_ESTABLISHED else 'ESTABLISHED_CONTEXT_SAMPLE'}
    leaders=[]
    dimensions=[('score_band',payload['by_score_band']),('stage',payload['by_stage']),('adx_band',payload['by_adx_band']),('relative_strength_band',payload['by_relative_strength']),('trend',payload['by_trend']),('setup',payload['by_setup']),('regime',payload['by_regime'])]
    for dim,tab in dimensions:
        for name,stats in tab.items():
            s=stats['4h']
            if s['n']:
                leaders.append({'dimension':dim,'value':name,**s})
    leaders.sort(key=lambda x:(x['mean_return_pct'] is not None,x['mean_return_pct'] or -1e9),reverse=True)
    payload['provisional_4h_leaders']=leaders[:12]
    payload['hypotheses']=hypothesis_queue(events,dimensions)
    payload['hypothesis_governance']={
        'same_sample_discovery_only':True,'fresh_forward_confirmation_required':True,'can_change_strategy_rules':False,'can_promote_strategy':False,'can_allocate_capital':False,
        'principle':'Generate hypotheses from observed effects, then try to falsify them on fresh forward evidence before any research conclusion.'
    }
    payload['warnings']=['All segments with n < 30 are explicitly provisional.','Hypotheses are generated from the same sample that discovered them and therefore require fresh independent confirmation.','These summaries and hypotheses cannot promote, allocate, execute or mutate strategy rules.']
    OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
    print('analytics events',len(events),'4h',payload['overall']['4h']['n'],'hypotheses',len(payload['hypotheses']),'regime_context',len(known))
if __name__=='__main__':main()
