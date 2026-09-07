#!/usr/bin/env python3
"""Decision Quality v3 forward evaluator.

Resolves frozen Decision Quality snapshots only after predeclared horizons using
historical Binance candles. This module measures; it cannot place orders,
auto-promote models, allocate capital, or mutate ranking parameters.
"""
from __future__ import annotations
import json, math, statistics, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

API='https://data-api.binance.vision/api/v3'
HISTORY=Path('decision-quality-v2-history.jsonl')
RESOLVED=Path('decision-quality-v3-resolved.jsonl')
OUT=Path('decision-quality-v3-evaluation.json')
HORIZONS={24:24,72:72,168:168}
MIN_SNAPSHOTS_MEASURED=5
MIN_ASSET_OUTCOMES_CALIBRATION=50
MIN_SNAPSHOTS_CHALLENGER=10
MIN_ASSET_OUTCOMES_CHALLENGER=100


def now(): return datetime.now(timezone.utc).isoformat()
def parse_ts(s): return datetime.fromisoformat(str(s).replace('Z','+00:00')).timestamp()
def mean(xs): return statistics.mean(xs) if xs else None
def med(xs): return statistics.median(xs) if xs else None
def pct(a,b): return (a/b-1)*100 if b else None
def safe_round(x,n=3): return None if x is None or not math.isfinite(float(x)) else round(float(x),n)

def get(path,params=None):
    u=API+path+('?' + urllib.parse.urlencode(params) if params else '')
    req=urllib.request.Request(u,headers={'User-Agent':'Wavelength-DQ3-Evaluator/1.0'})
    with urllib.request.urlopen(req,timeout=25) as r:
        return json.loads(r.read().decode())

def load_jsonl(path):
    out=[]
    if not path.exists(): return out
    for line in path.read_text().splitlines():
        try: out.append(json.loads(line))
        except Exception: pass
    return out

def candle_close_at(symbol,target_ts):
    start=int((target_ts-2*3600)*1000)
    rows=get('/klines',{'symbol':symbol+'USDT','interval':'1h','startTime':start,'limit':6})
    if not rows: return None
    best=min(rows,key=lambda r:abs((int(r[0])/1000)-target_ts))
    if abs((int(best[0])/1000)-target_ts)>2.5*3600: return None
    return float(best[4])

def resolve_snapshot(snapshot,hours):
    target=parse_ts(snapshot['generated_at'])+hours*3600
    ranking=snapshot.get('ranking') or []
    resolved=[]
    for r in ranking:
        entry=float(r.get('price') or 0)
        if entry<=0: continue
        try: close=candle_close_at(r['symbol'],target)
        except Exception as e:
            print('resolve',r.get('symbol'),hours,e); continue
        if close is None: continue
        ret=pct(close,entry)
        resolved.append({
            'symbol':r['symbol'],'rank':r.get('rank'),'score':r.get('opportunity_score'),
            'entry_price':entry,'exit_price':close,'forward_return_pct':safe_round(ret,4),
            'components':r.get('components') or {},'penalties':r.get('penalties') or {}
        })
    bysym={x['symbol']:x for x in resolved}
    model_top=[x for x in resolved if (x.get('rank') or 999)<=10]
    baseline_syms=snapshot.get('baseline_top10') or []
    baseline=[bysym[s] for s in baseline_syms if s in bysym]
    full=resolved
    btc=[bysym['BTC']] if 'BTC' in bysym else []
    return {
        'snapshot_generated_at':snapshot['generated_at'],'model_version':snapshot.get('model_version','unknown'),
        'horizon_hours':hours,'resolved_at':now(),'target_at':datetime.fromtimestamp(target,timezone.utc).isoformat(),
        'coverage':{'resolved_assets':len(resolved),'expected_assets':len(ranking),'model_top10':len(model_top),'baseline_top10':len(baseline)},
        'benchmarks':{
            'v2_1_top10_mean_return_pct':safe_round(mean([x['forward_return_pct'] for x in model_top])),
            'v2_0_top10_mean_return_pct':safe_round(mean([x['forward_return_pct'] for x in baseline])),
            'full_universe_mean_return_pct':safe_round(mean([x['forward_return_pct'] for x in full])),
            'btc_return_pct':safe_round(mean([x['forward_return_pct'] for x in btc])),
            'v2_1_top10_hit_rate_pct':safe_round(100*mean([x['forward_return_pct']>0 for x in model_top])) if model_top else None,
            'v2_0_top10_hit_rate_pct':safe_round(100*mean([x['forward_return_pct']>0 for x in baseline])) if baseline else None,
        },
        'assets':resolved,
        'baseline_top10':baseline_syms
    }

def pearson(xs,ys):
    if len(xs)<3 or len(xs)!=len(ys): return None
    mx,my=mean(xs),mean(ys);dx=[x-mx for x in xs];dy=[y-my for y in ys]
    den=math.sqrt(sum(x*x for x in dx)*sum(y*y for y in dy))
    return sum(a*b for a,b in zip(dx,dy))/den if den else None

def aggregate(records):
    assets=[a|{'horizon_hours':r['horizon_hours'],'snapshot_generated_at':r['snapshot_generated_at']} for r in records for a in r.get('assets',[])]
    score_cuts=[('0-59',0,60),('60-69',60,70),('70-79',70,80),('80-100',80,101)]
    score_buckets=[]
    for name,lo,hi in score_cuts:
        xs=[a for a in assets if a.get('score') is not None and lo<=float(a['score'])<hi]
        score_buckets.append({'bucket':name,'n':len(xs),'mean_return_pct':safe_round(mean([x['forward_return_pct'] for x in xs])),'positive_rate_pct':safe_round(100*mean([x['forward_return_pct']>0 for x in xs])) if xs else None})
    factors={}
    keys=sorted({k for a in assets for k in (a.get('components') or {})})
    for k in keys:
        pairs=[(float(a['components'][k]),float(a['forward_return_pct'])) for a in assets if k in (a.get('components') or {})]
        factors[k]={'n':len(pairs),'pearson_to_forward_return':safe_round(pearson([p[0] for p in pairs],[p[1] for p in pairs]),4)}
    top10=[a for a in assets if (a.get('rank') or 999)<=10]
    false_pos=sorted([a for a in top10 if a['forward_return_pct']<0],key=lambda x:x['forward_return_pct'])[:20]
    missed=sorted([a for a in assets if (a.get('rank') or 0)>10 and a['forward_return_pct']>=5],key=lambda x:x['forward_return_pct'],reverse=True)[:20]
    by_horizon=[]
    for h in sorted(HORIZONS):
        rs=[r for r in records if r['horizon_hours']==h]
        vals=lambda key:[r['benchmarks'].get(key) for r in rs if r['benchmarks'].get(key) is not None]
        v21=vals('v2_1_top10_mean_return_pct');v20=vals('v2_0_top10_mean_return_pct');full=vals('full_universe_mean_return_pct');btc=vals('btc_return_pct')
        by_horizon.append({'horizon_hours':h,'resolved_snapshots':len(rs),'v2_1_top10_mean_return_pct':safe_round(mean(v21)),'v2_0_top10_mean_return_pct':safe_round(mean(v20)),'full_universe_mean_return_pct':safe_round(mean(full)),'btc_mean_return_pct':safe_round(mean(btc)),'v2_1_minus_v2_0_pct_points':safe_round((mean(v21)-mean(v20)) if v21 and v20 else None),'v2_1_minus_universe_pct_points':safe_round((mean(v21)-mean(full)) if v21 and full else None)})
    snapshots=len({r['snapshot_generated_at'] for r in records});nassets=len(assets)
    measured=snapshots>=MIN_SNAPSHOTS_MEASURED and nassets>=MIN_ASSET_OUTCOMES_CALIBRATION
    challenger=snapshots>=MIN_SNAPSHOTS_CHALLENGER and nassets>=MIN_ASSET_OUTCOMES_CHALLENGER
    state='CHALLENGER_ELIGIBLE' if challenger else ('MEASURED' if measured else 'COLLECTING_FORWARD_EVIDENCE')
    gates={
        'measured':{
            'passed':measured,
            'required_resolved_snapshots':MIN_SNAPSHOTS_MEASURED,
            'required_asset_outcomes':MIN_ASSET_OUTCOMES_CALIBRATION,
            'current_resolved_snapshots':snapshots,
            'current_asset_outcomes':nassets,
        },
        'challenger_eligible':{
            'passed':challenger,
            'required_resolved_snapshots':MIN_SNAPSHOTS_CHALLENGER,
            'required_asset_outcomes':MIN_ASSET_OUTCOMES_CHALLENGER,
            'current_resolved_snapshots':snapshots,
            'current_asset_outcomes':nassets,
            'manual_review_required':True,
            'automatic_promotion':False,
        }
    }
    return {'state':state,'resolved_snapshots':snapshots,'resolved_asset_outcomes':nassets,'minimums':{'snapshots_for_measured':MIN_SNAPSHOTS_MEASURED,'asset_outcomes_for_calibration':MIN_ASSET_OUTCOMES_CALIBRATION,'snapshots_for_challenger':MIN_SNAPSHOTS_CHALLENGER,'asset_outcomes_for_challenger':MIN_ASSET_OUTCOMES_CHALLENGER},'gates':gates,'by_horizon':by_horizon,'score_calibration':score_buckets,'factor_diagnostics':factors,'false_positives':false_pos,'missed_winners':missed}

def main():
    snapshots=load_jsonl(HISTORY);existing=load_jsonl(RESOLVED)
    done={(r.get('snapshot_generated_at'),int(r.get('horizon_hours',0))) for r in existing}
    nowts=datetime.now(timezone.utc).timestamp();new=[]
    for s in snapshots:
        try: age=(nowts-parse_ts(s['generated_at']))/3600
        except Exception: continue
        for h in HORIZONS:
            key=(s['generated_at'],h)
            if key in done or age<h+1: continue
            rec=resolve_snapshot(s,h)
            if rec['coverage']['resolved_assets']>=max(10,int(.7*len(s.get('ranking') or []))):
                new.append(rec);done.add(key)
    if new:
        with RESOLVED.open('a') as f:
            for r in new:f.write(json.dumps(r,sort_keys=True)+'\n')
    all_records=existing+new
    evaluation=aggregate(all_records)
    payload={'schema':'wavelength-decision-quality-v3-evaluation-v1','mode':'READ_ONLY_FORWARD_EVALUATION','generated_at':now(),'orders_enabled':False,'execution_authority':False,'automatic_promotion':False,'automatic_allocation':False,'strategy_rule_mutation':False,'parameter_mutation':False,'horizons_hours':sorted(HORIZONS),'snapshot_count':len(snapshots),'new_resolutions':len(new),'evaluation':evaluation,'interpretation':'Model weights remain frozen. Results are descriptive until explicit forward-evidence gates are satisfied; challenger eligibility still requires manual review.'}
    OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
    print(json.dumps({'snapshots':len(snapshots),'new_resolutions':len(new),'state':evaluation['state'],'resolved_asset_outcomes':evaluation['resolved_asset_outcomes'],'gates':evaluation['gates']},indent=2))

if __name__=='__main__':main()
