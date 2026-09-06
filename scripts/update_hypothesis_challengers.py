#!/usr/bin/env python3
from __future__ import annotations
import json, statistics
from datetime import datetime, timezone
from pathlib import Path

ANALYTICS=Path('outcome-analytics.json')
WAREHOUSE=Path('outcome-warehouse.json')
OUT=Path('hypothesis-challengers.json')


def load(path, default):
    try:return json.loads(path.read_text())
    except Exception:return default


def parse_ts(s):
    return datetime.fromisoformat(str(s).replace('Z','+00:00'))


def mean(xs):return sum(xs)/len(xs) if xs else None

def median(xs):return statistics.median(xs) if xs else None


def matches(event, dimension, value):
    if dimension=='stage':
        actual=str(event.get('stage') or 'UNKNOWN')
    else:
        actual=str((event.get('segments') or {}).get(dimension))
    return actual==str(value)


def resolved_after(events, created_at, dimension, value, horizon):
    born=parse_ts(created_at)
    rows=[]
    for e in events:
        try:capt=parse_ts(e.get('captured_at'))
        except Exception:continue
        if capt <= born or not matches(e,dimension,value):continue
        o=(e.get('outcomes') or {}).get(horizon) or {}
        if o.get('status')!='RESOLVED' or o.get('return_pct') is None:continue
        rows.append(e)
    return rows


def summarize(events,horizon):
    vals=[];mfes=[];maes=[]
    for e in events:
        o=(e.get('outcomes') or {}).get(horizon) or {}
        if o.get('status')!='RESOLVED' or o.get('return_pct') is None:continue
        vals.append(float(o['return_pct']))
        if o.get('mfe_pct') is not None:mfes.append(float(o['mfe_pct']))
        if o.get('mae_pct') is not None:maes.append(float(o['mae_pct']))
    n=len(vals)
    return {
        'n':n,
        'mean_return_pct':mean(vals),
        'median_return_pct':median(vals),
        'positive_rate_pct':100*sum(v>0 for v in vals)/n if n else None,
        'mean_mfe_pct':mean(mfes),
        'mean_mae_pct':mean(maes),
    }


def lifecycle(record, fresh):
    n=fresh['n'];need=int(record['minimum_fresh_matching_events'])
    if n==0:return 'PENDING'
    if n<need:return 'SURVIVING'
    return_pass=(fresh['mean_return_pct'] is not None and fresh['mean_return_pct']>record['comparison_baseline']['mean_return_pct'])
    hit_pass=(fresh['positive_rate_pct'] is not None and fresh['positive_rate_pct']>record['comparison_baseline']['positive_rate_pct'])
    return 'CONFIRMED' if return_pass and hit_pass else 'FALSIFIED'


def main():
    analytics=load(ANALYTICS,{})
    warehouse=load(WAREHOUSE,{'events':[]})
    existing=load(OUT,{'challengers':[]})
    now=datetime.now(timezone.utc).isoformat()
    records={x.get('hypothesis_id'):x for x in existing.get('challengers') or [] if x.get('hypothesis_id')}

    for h in analytics.get('hypotheses') or []:
        if h.get('status')!='CANDIDATE_TO_CHALLENGE':continue
        hid=h['hypothesis_id']
        if hid not in records:
            records[hid]={
                'hypothesis_id':hid,
                'created_at':now,
                'created_from_analytics_generated_at':analytics.get('generated_at'),
                'dimension':h['dimension'],'value':h['value'],'horizon':h['horizon'],
                'statement':h['statement'],
                'minimum_fresh_matching_events':h['minimum_fresh_matching_events'],
                'discovery_baseline':{
                    'sample_n':h['discovery_sample_n'],
                    'mean_return_pct':h['segment_mean_return_pct'],
                    'median_return_pct':h['segment_median_return_pct'],
                    'positive_rate_pct':h['segment_positive_rate_pct'],
                    'mean_return_lift_pct':h['mean_return_lift_pct'],
                    'positive_rate_lift_pp':h['positive_rate_lift_pp'],
                },
                'comparison_baseline':{
                    'sample_n':h['comparison_sample_n'],
                    'mean_return_pct':h['comparison_mean_return_pct'],
                    'positive_rate_pct':h['comparison_positive_rate_pct'],
                },
                'falsification_rule':h['falsification_rule'],
                'same_sample_discovery':True,
                'fresh_forward_only':True,
                'automatic_strategy_change':False,
                'automatic_promotion':False,
                'capital_allocation_authority':False,
                'execution_authority':False,
            }

    events=warehouse.get('events') or []
    out=[]
    for hid,r in sorted(records.items()):
        fresh_rows=resolved_after(events,r['created_at'],r['dimension'],r['value'],r['horizon'])
        fresh=summarize(fresh_rows,r['horizon'])
        status=lifecycle(r,fresh)
        need=int(r['minimum_fresh_matching_events'])
        r['status']=status
        r['updated_at']=now
        r['fresh_evidence']=fresh
        r['fresh_event_ids']=[e.get('event_id') for e in fresh_rows]
        r['progress']={'resolved_matching_events':fresh['n'],'required_matching_events':need,'remaining':max(0,need-fresh['n']),'pct':min(100.0,100*fresh['n']/need) if need else 100.0}
        r['decision_checks']={
            'sample_requirement_met':fresh['n']>=need,
            'mean_return_beats_frozen_comparison':None if fresh['n']<need else fresh['mean_return_pct']>r['comparison_baseline']['mean_return_pct'],
            'positive_rate_beats_frozen_comparison':None if fresh['n']<need else fresh['positive_rate_pct']>r['comparison_baseline']['positive_rate_pct'],
        }
        out.append(r)

    counts={s:sum(r['status']==s for r in out) for s in ('PENDING','SURVIVING','FALSIFIED','CONFIRMED')}
    payload={
        'mode':'WAVELENGTH_FORWARD_HYPOTHESIS_CHALLENGERS_V1_READ_ONLY',
        'generated_at':now,
        'orders_enabled':False,'live_money_enabled':False,'execution_authority':False,
        'automatic_promotion':False,'strategy_rule_mutation':False,'capital_allocation_authority':False,
        'lifecycle':['PENDING','SURVIVING','FALSIFIED','CONFIRMED'],
        'challenger_count':len(out),'status_counts':counts,
        'challengers':out,
        'principles':[
            'Birth timestamps and discovery/comparison baselines are immutable once a challenger is created.',
            'Only resolved matching outcomes captured strictly after challenger creation count as fresh evidence.',
            'A challenger cannot confirm or falsify until its minimum fresh sample is reached.',
            'Confirmation is research evidence only and cannot change strategy rules, promote strategies, allocate capital or execute orders.'
        ]
    }
    OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
    print('challengers',len(out),counts)

if __name__=='__main__':main()
