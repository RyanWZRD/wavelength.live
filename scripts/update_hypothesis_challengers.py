#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, math, random, statistics
from datetime import datetime, timezone
from pathlib import Path

ANALYTICS=Path('outcome-analytics.json')
WAREHOUSE=Path('outcome-warehouse.json')
OUT=Path('hypothesis-challengers.json')
BOOTSTRAP_DRAWS=5000
CONFIDENCE_LEVEL=0.90
MIN_EFFECT_LIFT_PCT=0.25
FAMILY_ALPHA=0.10


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


def deterministic_rng(hid, event_ids):
    raw=hid+'|'+','.join(sorted(str(x) for x in event_ids if x))
    seed=int(hashlib.sha256(raw.encode()).hexdigest()[:16],16)
    return random.Random(seed)


def bootstrap_mean_ci(vals, hid, event_ids, draws=BOOTSTRAP_DRAWS, confidence=CONFIDENCE_LEVEL):
    if len(vals)<2:return {'draws':0,'confidence':confidence,'low':None,'high':None,'probability_mean_gt_baseline':None}
    rng=deterministic_rng(hid,event_ids)
    n=len(vals); means=[]
    for _ in range(draws):
        means.append(sum(vals[rng.randrange(n)] for __ in range(n))/n)
    means.sort()
    tail=(1-confidence)/2
    lo=means[max(0,min(draws-1,int(tail*draws)))]
    hi=means[max(0,min(draws-1,int((1-tail)*draws)-1))]
    return {'draws':draws,'confidence':confidence,'low':lo,'high':hi,'means':means}


def binomial_tail(k,n,p):
    if n<=0:return None
    p=max(0.0,min(1.0,p))
    return sum(math.comb(n,i)*(p**i)*((1-p)**(n-i)) for i in range(k,n+1))


def leave_one_group_out(rows,horizon,keyfn,baseline):
    groups={}
    for e in rows:
        k=keyfn(e)
        if k is None:continue
        groups.setdefault(str(k),[]).append(e)
    if len(groups)<2:return {'state':'INSUFFICIENT_GROUP_DIVERSITY','groups':len(groups),'all_means_beat_baseline':None,'worst_mean_return_pct':None}
    vals=[]
    for name in sorted(groups):
        subset=[e for e in rows if e not in groups[name]]
        s=summarize(subset,horizon)
        if s['n'] and s['mean_return_pct'] is not None:vals.append(s['mean_return_pct'])
    return {'state':'MEASURED','groups':len(groups),'all_means_beat_baseline':bool(vals) and all(v>baseline for v in vals),'worst_mean_return_pct':min(vals) if vals else None}


def statistical_robustness(record, rows, fresh, family_size):
    horizon=record['horizon']; baseline=float(record['comparison_baseline']['mean_return_pct']); hit_baseline=float(record['comparison_baseline']['positive_rate_pct'])/100
    vals=[float((e.get('outcomes') or {}).get(horizon,{}).get('return_pct')) for e in rows]
    event_ids=[e.get('event_id') for e in rows]
    boot=bootstrap_mean_ci(vals,record['hypothesis_id'],event_ids)
    means=boot.pop('means',[])
    boot['probability_mean_gt_baseline']=sum(x>baseline for x in means)/len(means) if means else None
    wins=sum(v>0 for v in vals)
    raw_p=binomial_tail(wins,len(vals),hit_baseline) if vals else None
    corrected=min(1.0,raw_p*max(1,family_size)) if raw_p is not None else None
    ex_best=sorted(vals,reverse=True)[1:] if len(vals)>1 else []
    ex_best_mean=mean(ex_best)
    symbol_loo=leave_one_group_out(rows,horizon,lambda e:e.get('symbol'),baseline)
    month_loo=leave_one_group_out(rows,horizon,lambda e:str(e.get('captured_at') or '')[:7],baseline)
    checks={
        'minimum_effect_size':fresh['mean_return_pct'] is not None and fresh['mean_return_pct']>=baseline+MIN_EFFECT_LIFT_PCT,
        'median_positive':fresh['median_return_pct'] is not None and fresh['median_return_pct']>0,
        'bootstrap_90pct_lower_above_baseline':boot['low'] is not None and boot['low']>baseline,
        'bootstrap_probability_ge_90pct':boot['probability_mean_gt_baseline'] is not None and boot['probability_mean_gt_baseline']>=CONFIDENCE_LEVEL,
        'hit_rate_family_adjusted_p_le_alpha':corrected is not None and corrected<=FAMILY_ALPHA,
        'ex_best_mean_above_baseline':ex_best_mean is not None and ex_best_mean>baseline,
    }
    # Cross-asset/month consistency are reported but do not block confirmation until diversity exists.
    if symbol_loo['state']=='MEASURED':checks['leave_one_asset_out']=symbol_loo['all_means_beat_baseline']
    if month_loo['state']=='MEASURED':checks['leave_one_month_out']=month_loo['all_means_beat_baseline']
    return {
        'policy':{'bootstrap_draws':BOOTSTRAP_DRAWS,'confidence_level':CONFIDENCE_LEVEL,'minimum_effect_lift_pct':MIN_EFFECT_LIFT_PCT,'family_alpha':FAMILY_ALPHA,'multiple_testing':'BONFERRONI_ACTIVE_CHALLENGERS'},
        'bootstrap_mean_return_pct':boot,
        'hit_rate_test':{'wins':wins,'n':len(vals),'baseline_positive_rate_pct':hit_baseline*100,'raw_one_sided_p':raw_p,'family_size':max(1,family_size),'bonferroni_p':corrected},
        'ex_best_mean_return_pct':ex_best_mean,
        'leave_one_asset_out':symbol_loo,
        'leave_one_month_out':month_loo,
        'checks':checks,
        'blocking_checks_passed':all(checks.values()) if checks else False,
    }


def lifecycle(record, fresh, robustness):
    n=fresh['n'];need=int(record['minimum_fresh_matching_events'])
    if n==0:return 'PENDING'
    if n<need:return 'SURVIVING'
    return_pass=(fresh['mean_return_pct'] is not None and fresh['mean_return_pct']>record['comparison_baseline']['mean_return_pct'])
    hit_pass=(fresh['positive_rate_pct'] is not None and fresh['positive_rate_pct']>record['comparison_baseline']['positive_rate_pct'])
    if not (return_pass and hit_pass):return 'FALSIFIED'
    return 'CONFIRMED' if robustness.get('blocking_checks_passed') else 'SURVIVING'


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
                'hypothesis_id':hid,'created_at':now,'created_from_analytics_generated_at':analytics.get('generated_at'),
                'dimension':h['dimension'],'value':h['value'],'horizon':h['horizon'],'statement':h['statement'],
                'minimum_fresh_matching_events':h['minimum_fresh_matching_events'],
                'discovery_baseline':{'sample_n':h['discovery_sample_n'],'mean_return_pct':h['segment_mean_return_pct'],'median_return_pct':h['segment_median_return_pct'],'positive_rate_pct':h['segment_positive_rate_pct'],'mean_return_lift_pct':h['mean_return_lift_pct'],'positive_rate_lift_pp':h['positive_rate_lift_pp']},
                'comparison_baseline':{'sample_n':h['comparison_sample_n'],'mean_return_pct':h['comparison_mean_return_pct'],'positive_rate_pct':h['comparison_positive_rate_pct']},
                'falsification_rule':h['falsification_rule'],'same_sample_discovery':True,'fresh_forward_only':True,
                'automatic_strategy_change':False,'automatic_promotion':False,'capital_allocation_authority':False,'execution_authority':False,
            }

    events=warehouse.get('events') or []
    family_size=max(1,len(records))
    out=[]
    for hid,r in sorted(records.items()):
        fresh_rows=resolved_after(events,r['created_at'],r['dimension'],r['value'],r['horizon'])
        fresh=summarize(fresh_rows,r['horizon'])
        robustness=statistical_robustness(r,fresh_rows,fresh,family_size) if fresh['n'] else {'blocking_checks_passed':False,'checks':{},'policy':{'bootstrap_draws':BOOTSTRAP_DRAWS,'confidence_level':CONFIDENCE_LEVEL,'minimum_effect_lift_pct':MIN_EFFECT_LIFT_PCT,'family_alpha':FAMILY_ALPHA,'multiple_testing':'BONFERRONI_ACTIVE_CHALLENGERS'}}
        status=lifecycle(r,fresh,robustness)
        need=int(r['minimum_fresh_matching_events'])
        r['status']=status;r['updated_at']=now;r['fresh_evidence']=fresh;r['fresh_event_ids']=[e.get('event_id') for e in fresh_rows];r['statistical_robustness']=robustness
        r['progress']={'resolved_matching_events':fresh['n'],'required_matching_events':need,'remaining':max(0,need-fresh['n']),'pct':min(100.0,100*fresh['n']/need) if need else 100.0}
        r['decision_checks']={
            'sample_requirement_met':fresh['n']>=need,
            'mean_return_beats_frozen_comparison':None if fresh['n']<need else fresh['mean_return_pct']>r['comparison_baseline']['mean_return_pct'],
            'positive_rate_beats_frozen_comparison':None if fresh['n']<need else fresh['positive_rate_pct']>r['comparison_baseline']['positive_rate_pct'],
            'statistical_robustness_established':None if fresh['n']<need else robustness.get('blocking_checks_passed',False),
        }
        out.append(r)

    counts={s:sum(r['status']==s for r in out) for s in ('PENDING','SURVIVING','FALSIFIED','CONFIRMED')}
    payload={
        'mode':'WAVELENGTH_FORWARD_HYPOTHESIS_CHALLENGERS_V2_STATISTICAL_READ_ONLY','generated_at':now,
        'orders_enabled':False,'live_money_enabled':False,'execution_authority':False,'automatic_promotion':False,'strategy_rule_mutation':False,'capital_allocation_authority':False,
        'lifecycle':['PENDING','SURVIVING','FALSIFIED','CONFIRMED'],'challenger_count':len(out),'status_counts':counts,'challengers':out,
        'statistical_policy':{'bootstrap_draws':BOOTSTRAP_DRAWS,'confidence_level':CONFIDENCE_LEVEL,'minimum_effect_lift_pct':MIN_EFFECT_LIFT_PCT,'family_alpha':FAMILY_ALPHA,'multiple_testing':'BONFERRONI_ACTIVE_CHALLENGERS'},
        'principles':[
            'Birth timestamps and discovery/comparison baselines are immutable once a challenger is created.',
            'Only resolved matching outcomes captured strictly after challenger creation count as fresh evidence.',
            'Core return/hit-rate failure after minimum sample falsifies; passing core gates is not enough to confirm.',
            'Confirmation additionally requires deterministic bootstrap, effect-size, median, hit-rate and ex-best robustness gates; leave-one-asset/month checks become blocking when diversity exists.',
            'Confirmation is research evidence only and cannot change strategy rules, promote strategies, allocate capital or execute orders.'
        ]
    }
    OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
    print('challengers',len(out),counts)

if __name__=='__main__':main()
