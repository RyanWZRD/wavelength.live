#!/usr/bin/env python3
from __future__ import annotations
import json, statistics
from datetime import datetime, timezone
from pathlib import Path

SRC=Path('outcome-warehouse.json');OUT=Path('outcome-analytics.json');HORIZONS=('4h','12h','24h','3d','7d')
MIN_ESTABLISHED=30;MIN_DISCOVERY_SEGMENT=5;MIN_DISCOVERY_COMPARISON=5;MIN_MULTIFACTOR_SEGMENT=8;MIN_FRESH_CONFIRMATION=15
CANONICAL_SCORE_MODEL='WAVELENGTH_INTELLIGENCE_V1';CANONICAL_SCORE_VERSION=1
MARKET_CONTEXT_MODEL='WAVELENGTH_MARKET_CONTEXT_V1';MARKET_CONTEXT_VERSION=1
SINGLE_DIMENSIONS=('score_model_band','stage','adx_band','relative_strength_band','trend','setup','regime','coin_volatility_regime','volume_regime','btc_trend','btc_volatility_regime','breadth_regime','market_regime')
MULTIFACTOR_DIMENSIONS=('score_band_x_btc_trend','score_band_x_breadth','adx_x_btc_trend','rs_x_btc_trend','adx_x_rs','trend_x_btc_volatility','setup_x_breadth')

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

def table(events,key):return {name:{h:summarize(rows,h) for h in HORIZONS} for name,rows in groups(events,key).items()}

def stage_table(events):
    stage_groups={}
    for e in events:stage_groups.setdefault(str(e.get('stage') or 'UNKNOWN'),[]).append(e)
    return {k:{h:summarize(v,h) for h in HORIZONS} for k,v in stage_groups.items()}

def resolved4h(e):
    o=(e.get('outcomes') or {}).get('4h') or {}
    return o.get('status')=='RESOLVED' and o.get('return_pct') is not None

def canonical_event(e):return e.get('score_model')==CANONICAL_SCORE_MODEL and e.get('score_version')==CANONICAL_SCORE_VERSION

def market_context_event(e):
    m=e.get('market_context') or {}
    return m.get('context_model')==MARKET_CONTEXT_MODEL and m.get('context_version')==MARKET_CONTEXT_VERSION

def clean_value(v):
    s=str(v)
    return s not in ('UNKNOWN','None','null','False') and 'UNKNOWN' not in s

def segment_rows(resolved,dim,value):
    if dim=='stage':return [e for e in resolved if str(e.get('stage') or 'UNKNOWN')==str(value)]
    return [e for e in resolved if str((e.get('segments') or {}).get(dim))==str(value)]

def hypothesis_queue(events):
    resolved=[e for e in events if resolved4h(e)];queue=[]
    for dim in SINGLE_DIMENSIONS+MULTIFACTOR_DIMENSIONS:
        values=groups(resolved,dim) if dim!='stage' else {k:v for k,v in ((str(e.get('stage') or 'UNKNOWN'),[]) for e in resolved)}
        if dim=='stage':
            values={}
            for e in resolved:values.setdefault(str(e.get('stage') or 'UNKNOWN'),[]).append(e)
        min_seg=MIN_MULTIFACTOR_SEGMENT if dim in MULTIFACTOR_DIMENSIONS else MIN_DISCOVERY_SEGMENT
        for value,seg in values.items():
            if not clean_value(value):continue
            comp=[e for e in resolved if e not in seg]
            if len(seg)<min_seg or len(comp)<MIN_DISCOVERY_COMPARISON:continue
            s=summarize(seg,'4h');c=summarize(comp,'4h')
            if s['mean_return_pct'] is None or c['mean_return_pct'] is None:continue
            mean_lift=s['mean_return_pct']-c['mean_return_pct'];hit_lift=(s['positive_rate_pct'] or 0)-(c['positive_rate_pct'] or 0)
            gates={'segment_positive_mean':s['mean_return_pct']>0,'segment_positive_median':(s['median_return_pct'] or 0)>0,'mean_lift_ge_0_75pct':mean_lift>=0.75,'positive_rate_lift_ge_10pp':hit_lift>=10.0}
            passed=sum(gates.values());status='CANDIDATE_TO_CHALLENGE' if passed==len(gates) else 'WATCHLIST'
            if status=='WATCHLIST' and not (s['mean_return_pct']>c['mean_return_pct'] and passed>=2):continue
            family='MULTI_FACTOR_PREDECLARED' if dim in MULTIFACTOR_DIMENSIONS else 'SINGLE_FACTOR'
            queue.append({'hypothesis_id':f'4h:{dim}:{value}','status':status,'dimension':dim,'value':value,'horizon':'4h','hypothesis_family':family,'predeclared_dimension':True,'score_model':CANONICAL_SCORE_MODEL,'score_version':CANONICAL_SCORE_VERSION,'market_context_model':MARKET_CONTEXT_MODEL,'market_context_version':MARKET_CONTEXT_VERSION,'discovery_sample_n':s['n'],'comparison_sample_n':c['n'],'segment_mean_return_pct':s['mean_return_pct'],'comparison_mean_return_pct':c['mean_return_pct'],'mean_return_lift_pct':mean_lift,'segment_median_return_pct':s['median_return_pct'],'segment_positive_rate_pct':s['positive_rate_pct'],'comparison_positive_rate_pct':c['positive_rate_pct'],'positive_rate_lift_pp':hit_lift,'gates':gates,'same_sample_discovery':True,'automatic_strategy_change':False,'automatic_promotion':False,'fresh_confirmation_required':True,'minimum_fresh_matching_events':MIN_FRESH_CONFIRMATION,'falsification_rule':f'Collect at least {MIN_FRESH_CONFIRMATION} fresh matching canonical-V1 4h outcomes after hypothesis creation; reject if fresh mean return <= comparison baseline or fresh positive rate does not exceed baseline.','statement':f'{dim}={value} may improve 4h forward outcomes versus the rest of the canonical observed sample; this is a discovery hypothesis, not an edge claim.'})
    queue.sort(key=lambda x:(x['status']=='CANDIDATE_TO_CHALLENGE',x['hypothesis_family']=='MULTI_FACTOR_PREDECLARED',x['mean_return_lift_pct'],x['positive_rate_lift_pp']),reverse=True)
    return queue[:16]

def main():
    data=json.loads(SRC.read_text());events=data.get('events') or [];canonical=[e for e in events if canonical_event(e)];legacy=[e for e in events if not canonical_event(e)];canonical_context=[e for e in canonical if market_context_event(e)]
    payload={'mode':'WAVELENGTH_RESEARCH_OUTCOME_ANALYTICS_V4_MARKET_CONTEXT_HYPOTHESES','generated_at':datetime.now(timezone.utc).isoformat(),'orders_enabled':False,'live_money_enabled':False,'execution_authority':False,'automatic_promotion':False,'strategy_rule_mutation':False,'minimum_established_sample':MIN_ESTABLISHED,'minimum_discovery_segment':MIN_DISCOVERY_SEGMENT,'minimum_multifactor_segment':MIN_MULTIFACTOR_SEGMENT,'minimum_discovery_comparison':MIN_DISCOVERY_COMPARISON,'minimum_fresh_confirmation':MIN_FRESH_CONFIRMATION,'event_count':len(events),'horizons':list(HORIZONS),'canonical_score_model':CANONICAL_SCORE_MODEL,'canonical_score_version':CANONICAL_SCORE_VERSION,'market_context_model':MARKET_CONTEXT_MODEL,'market_context_version':MARKET_CONTEXT_VERSION,'hypothesis_eligible_event_count':len(canonical_context),'canonical_score_event_count':len(canonical),'legacy_descriptive_event_count':len(legacy),'canonical_forward_coverage':{'eligible_events':len(canonical),'total_events':len(events),'coverage_pct':100*len(canonical)/len(events) if events else 0.0,'state':'BUILDING' if len(canonical)<MIN_ESTABLISHED else 'ESTABLISHED_CANONICAL_SAMPLE'},'market_context_coverage':{'eligible_events':len(canonical_context),'canonical_events':len(canonical),'coverage_pct':100*len(canonical_context)/len(canonical) if canonical else 0.0,'state':'BUILDING' if len(canonical_context)<MIN_ESTABLISHED else 'ESTABLISHED_CONTEXT_SAMPLE'},'overall':{h:summarize(events,h) for h in HORIZONS},'canonical_overall':{h:summarize(canonical,h) for h in HORIZONS}}
    tables={d:(stage_table(events) if d=='stage' else table(events,d)) for d in SINGLE_DIMENSIONS+MULTIFACTOR_DIMENSIONS}
    payload.update({'by_score_band':table(events,'score_band'),'by_score_model_band':table(events,'score_model_band'),'by_stage':stage_table(events),'by_adx_band':table(events,'adx_band'),'by_relative_strength':table(events,'relative_strength_band'),'by_trend':table(events,'trend'),'by_setup':table(events,'setup'),'by_regime':table(events,'regime'),'by_coin_volatility':table(events,'coin_volatility_regime'),'by_volume_regime':table(events,'volume_regime'),'by_btc_trend':table(events,'btc_trend'),'by_btc_volatility':table(events,'btc_volatility_regime'),'by_breadth_regime':table(events,'breadth_regime'),'by_market_regime':table(events,'market_regime'),'multi_factor_tables':{d:table(events,d) for d in MULTIFACTOR_DIMENSIONS}})
    known=[e for e in events if (e.get('segments') or {}).get('regime') not in (None,'UNKNOWN')];payload['regime_coverage']={'known_context_events':len(known),'total_events':len(events),'coverage_pct':100*len(known)/len(events) if events else 0.0,'state':'BUILDING' if len(known)<MIN_ESTABLISHED else 'ESTABLISHED_CONTEXT_SAMPLE'}
    leaders=[]
    for dim,tab in tables.items():
        for name,stats in tab.items():
            s=stats['4h']
            if s['n']:leaders.append({'dimension':dim,'value':name,**s})
    leaders.sort(key=lambda x:(x['mean_return_pct'] is not None,x['mean_return_pct'] or -1e9),reverse=True);payload['provisional_4h_leaders']=leaders[:16]
    payload['hypotheses']=hypothesis_queue(canonical_context)
    payload['hypothesis_policy']={'search_space':'PREDECLARED_SINGLE_AND_TWO_FACTOR_SEGMENTS_ONLY','single_dimensions':list(SINGLE_DIMENSIONS),'multifactor_dimensions':list(MULTIFACTOR_DIMENSIONS),'minimum_multifactor_segment':MIN_MULTIFACTOR_SEGMENT,'derivatives_dimensions_enabled':False,'reason_derivatives_disabled':'No reliable durable derivatives history is available on the GitHub runner.'}
    payload['hypothesis_governance']={'same_sample_discovery_only':True,'fresh_forward_confirmation_required':True,'canonical_forward_only':True,'market_context_v1_required':True,'can_change_strategy_rules':False,'can_promote_strategy':False,'can_allocate_capital':False,'principle':'Automated discovery uses only birth-stamped canonical score V1 episodes with durable market-context V1, over a predeclared search space, then tries to falsify candidates on still-fresher evidence.'}
    payload['warnings']=['All segments with n < 30 are explicitly provisional.','Legacy/unversioned episodes are excluded from automatic hypothesis discovery.','Multi-factor discovery is restricted to predeclared two-factor combinations to reduce data-mining freedom.','Durable derivatives context is unavailable and excluded rather than imputed.','Existing durable challengers created before this cutoff remain frozen historical records and are not rewritten.','These summaries and hypotheses cannot promote, allocate, execute or mutate strategy rules.']
    OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n');print('analytics events',len(events),'canonical_context',len(canonical_context),'4h',payload['canonical_overall']['4h']['n'],'hypotheses',len(payload['hypotheses']))
if __name__=='__main__':main()
