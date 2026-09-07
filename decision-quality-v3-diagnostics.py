#!/usr/bin/env python3
"""Decision Quality v3.1 diagnostics.

Read-only diagnostics over frozen Decision Quality history and resolved forward
outcomes. It does not place orders, promote models, allocate capital, mutate
strategy rules, or change model parameters.
"""
from __future__ import annotations
import json, math, statistics, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

API='https://data-api.binance.vision/api/v3'
HISTORY=Path('decision-quality-v2-history.jsonl')
RESOLVED=Path('decision-quality-v3-resolved.jsonl')
EVAL=Path('decision-quality-v3-evaluation.json')
PATHS=Path('decision-quality-v3-paths.jsonl')
OUT=Path('decision-quality-v3-diagnostics.json')
HIST=Path('decision-quality-v3-diagnostics-history.jsonl')
CERT=Path('decision-quality-v3-certificates.json')
ALPHA=.05
MIN_CHALLENGER_SNAPSHOTS=10
MIN_CHALLENGER_OUTCOMES=100


def now(): return datetime.now(timezone.utc).isoformat()
def mean(xs): return statistics.mean(xs) if xs else None
def med(xs): return statistics.median(xs) if xs else None
def sd(xs): return statistics.pstdev(xs) if len(xs)>1 else None
def rnd(x,n=4): return None if x is None or not math.isfinite(float(x)) else round(float(x),n)
def load_json(path,default=None):
    try:return json.loads(path.read_text())
    except:return {} if default is None else default
def load_jsonl(path):
    out=[]
    if not path.exists(): return out
    for line in path.read_text().splitlines():
        try:out.append(json.loads(line))
        except:pass
    return out

def get(path,params=None):
    u=API+path+('?' + urllib.parse.urlencode(params) if params else '')
    req=urllib.request.Request(u,headers={'User-Agent':'Wavelength-DQ31-Diagnostics/1.0'})
    with urllib.request.urlopen(req,timeout=25) as r:return json.loads(r.read().decode())

def regime_from(asset):
    v=float((asset.get('components') or {}).get('regime_fit') or 50)
    return 'BULL' if v>=70 else ('BEAR' if v<=35 else 'RANGE')

def band(rank):
    r=int(rank or 999)
    return '1-5' if r<=5 else ('6-10' if r<=10 else ('11-20' if r<=20 else ('21-40' if r<=40 else '41+')))

def score_bucket(score):
    s=float(score or 0)
    lo=int(max(0,min(90,math.floor(s/10)*10)))
    return f'{lo}-{lo+9 if lo<90 else 100}'

def path_key(r,a):return (r.get('snapshot_generated_at'),int(r.get('horizon_hours') or 0),a.get('symbol'))
def fetch_path(r,a):
    try:
        start=int(datetime.fromisoformat(r['snapshot_generated_at'].replace('Z','+00:00')).timestamp()*1000)
        end=int(datetime.fromisoformat(r['target_at'].replace('Z','+00:00')).timestamp()*1000)
        rows=get('/klines',{'symbol':a['symbol']+'USDT','interval':'1h','startTime':start,'endTime':end,'limit':1000})
        if not rows:return None
        entry=float(a['entry_price']); highs=[float(x[2]) for x in rows]; lows=[float(x[3]) for x in rows]
        hi=max(highs);lo=min(lows);ihi=highs.index(hi);ilo=lows.index(lo)
        return {'snapshot_generated_at':r['snapshot_generated_at'],'horizon_hours':r['horizon_hours'],'symbol':a['symbol'],'mfe_pct':rnd((hi/entry-1)*100),'mae_pct':rnd((lo/entry-1)*100),'time_to_peak_hours':ihi,'time_to_trough_hours':ilo,'bars':len(rows)}
    except Exception as e:
        print('path',a.get('symbol'),e);return None

def ensure_paths(records):
    existing=load_jsonl(PATHS);done={path_key(x,x) for x in existing};new=[]
    for r in records:
        for a in r.get('assets',[]):
            k=path_key(r,a)
            if k in done:continue
            p=fetch_path(r,a)
            if p:new.append(p);done.add(k)
    if new:
        with PATHS.open('a') as f:
            for x in new:f.write(json.dumps(x,sort_keys=True)+'\n')
    return existing+new

def normal_cdf(x):return .5*(1+math.erf(x/math.sqrt(2)))
def two_sample_p(a,b):
    if len(a)<5 or len(b)<5:return None
    ma,mb=mean(a),mean(b);va=statistics.pvariance(a);vb=statistics.pvariance(b);se=math.sqrt(va/len(a)+vb/len(b))
    if not se:return 1.0
    z=abs(ma-mb)/se
    return max(0.0,min(1.0,2*(1-normal_cdf(z))))
def corr(xs,ys):
    if len(xs)<3 or len(xs)!=len(ys):return None
    mx,my=mean(xs),mean(ys);dx=[x-mx for x in xs];dy=[y-my for y in ys];den=math.sqrt(sum(x*x for x in dx)*sum(y*y for y in dy))
    return sum(a*b for a,b in zip(dx,dy))/den if den else None
def corr_p(r,n):
    if r is None or n<8 or abs(r)>=1:return None
    z=.5*math.log((1+r)/(1-r))*math.sqrt(max(1,n-3))
    return max(0.0,min(1.0,2*(1-normal_cdf(abs(z)))))
def holm(tests):
    vals=[(i,t['p_value']) for i,t in enumerate(tests) if t.get('p_value') is not None]
    vals.sort(key=lambda x:x[1]);m=len(vals);passed=[]
    blocked=False
    for rank,(idx,p) in enumerate(vals,1):
        threshold=ALPHA/(m-rank+1)
        ok=(p<=threshold) and not blocked
        if not ok:blocked=True
        tests[idx]['holm_threshold']=rnd(threshold,6);tests[idx]['holm_pass']=ok
        if ok:passed.append(tests[idx].get('id'))
    return {'family_alpha':ALPHA,'tests':len(vals),'passed':passed,'method':'HOLM_BONFERRONI'}

def aggregate(records,paths,history,eval_feed):
    assets=[]
    for r in records:
        for a in r.get('assets',[]):
            x=dict(a);x['horizon_hours']=r['horizon_hours'];x['snapshot_generated_at']=r['snapshot_generated_at'];x['regime']=regime_from(a);x['rank_band']=band(a.get('rank'));x['score_bucket']=score_bucket(a.get('score'));assets.append(x)
    pmap={(x['snapshot_generated_at'],x['horizon_hours'],x['symbol']):x for x in paths}
    for a in assets:a['path']=pmap.get((a['snapshot_generated_at'],a['horizon_hours'],a['symbol']))

    regime_proof=[]
    for h in (24,72,168):
        for reg in ('BULL','RANGE','BEAR'):
            xs=[a for a in assets if a['horizon_hours']==h and a['regime']==reg]
            regime_proof.append({'horizon_hours':h,'regime':reg,'n':len(xs),'mean_return_pct':rnd(mean([x['forward_return_pct'] for x in xs])),'positive_rate_pct':rnd(100*mean([x['forward_return_pct']>0 for x in xs])) if xs else None})

    rank_bands=[]
    for h in (24,72,168):
        for b in ('1-5','6-10','11-20','21-40','41+'):
            xs=[a for a in assets if a['horizon_hours']==h and a['rank_band']==b]
            rank_bands.append({'horizon_hours':h,'band':b,'n':len(xs),'mean_return_pct':rnd(mean([x['forward_return_pct'] for x in xs])),'positive_rate_pct':rnd(100*mean([x['forward_return_pct']>0 for x in xs])) if xs else None})

    calibration=[]
    for h in (24,72,168):
        for b in sorted({score_bucket(x) for x in range(0,101,10)}):
            xs=[a for a in assets if a['horizon_hours']==h and a['score_bucket']==b]
            calibration.append({'horizon_hours':h,'score_bucket':b,'n':len(xs),'empirical_positive_probability_pct':rnd(100*mean([x['forward_return_pct']>0 for x in xs])) if xs else None,'mean_return_pct':rnd(mean([x['forward_return_pct'] for x in xs]))})

    disagreement=[]
    for r in records:
        baseline=set(r.get('baseline_top10') or []);model={a['symbol'] for a in r.get('assets',[]) if int(a.get('rank') or 999)<=10};only21=sorted(model-baseline);only20=sorted(baseline-model)
        amap={a['symbol']:a for a in r.get('assets',[])}
        disagreement.append({'snapshot_generated_at':r['snapshot_generated_at'],'horizon_hours':r['horizon_hours'],'v2_1_only':only21,'v2_0_only':only20,'v2_1_only_mean_return_pct':rnd(mean([amap[s]['forward_return_pct'] for s in only21 if s in amap])),'v2_0_only_mean_return_pct':rnd(mean([amap[s]['forward_return_pct'] for s in only20 if s in amap])),'symmetric_difference_count':len(set(model)^baseline)})

    tests=[];penalty_attr=[]
    pkeys=sorted({k for a in assets for k,v in (a.get('penalties') or {}).items() if float(v or 0)>0})
    for k in pkeys:
        on=[a['forward_return_pct'] for a in assets if float((a.get('penalties') or {}).get(k) or 0)>0];off=[a['forward_return_pct'] for a in assets if float((a.get('penalties') or {}).get(k) or 0)==0]
        p=two_sample_p(on,off);row={'id':'penalty:'+k,'penalty':k,'n_penalized':len(on),'n_unpenalized':len(off),'penalized_mean_return_pct':rnd(mean(on)),'unpenalized_mean_return_pct':rnd(mean(off)),'effect_pct_points':rnd((mean(on)-mean(off)) if on and off else None),'p_value':rnd(p,6)};tests.append(dict(row));penalty_attr.append(row)

    factor_stability=[]
    fkeys=sorted({k for a in assets for k in (a.get('components') or {})})
    for k in fkeys:
        overall=[]
        for h in (24,72,168):
            xs=[a for a in assets if a['horizon_hours']==h and k in (a.get('components') or {})]
            r=corr([float(a['components'][k]) for a in xs],[float(a['forward_return_pct']) for a in xs]);p=corr_p(r,len(xs));overall.append(r)
            row={'id':f'factor:{k}:{h}','factor':k,'horizon_hours':h,'n':len(xs),'correlation':rnd(r),'p_value':rnd(p,6)};tests.append(dict(row));factor_stability.append(row)
        signs={1 if x and x>0 else -1 if x and x<0 else 0 for x in overall if x is not None};
        for row in factor_stability:
            if row['factor']==k:row['stable_sign_across_horizons']=len(signs)<=1 and bool(signs)

    mt=holm(tests)
    test_map={t['id']:t for t in tests}
    for r in penalty_attr:r.update({k:v for k,v in test_map.get(r['id'],{}).items() if k in ('holm_threshold','holm_pass')})
    for r in factor_stability:r.update({k:v for k,v in test_map.get(r['id'],{}).items() if k in ('holm_threshold','holm_pass')})

    decay=[]
    snaps=history[-24:]
    for i in range(len(snaps)-1):
        a={x['symbol']:int(x['rank']) for x in snaps[i].get('ranking',[])};b={x['symbol']:int(x['rank']) for x in snaps[i+1].get('ranking',[])};common=set(a)&set(b)
        top=[s for s in common if a[s]<=10]
        decay.append({'from':snaps[i].get('generated_at'),'to':snaps[i+1].get('generated_at'),'top10_retention_pct':rnd(100*mean([b[s]<=10 for s in top])) if top else None,'mean_abs_rank_change':rnd(mean([abs(b[s]-a[s]) for s in common])) if common else None,'n_common':len(common)})

    path_analysis=[]
    for h in (24,72,168):
        xs=[a for a in assets if a['horizon_hours']==h and a.get('path')]
        path_analysis.append({'horizon_hours':h,'n':len(xs),'mean_mfe_pct':rnd(mean([x['path']['mfe_pct'] for x in xs])),'mean_mae_pct':rnd(mean([x['path']['mae_pct'] for x in xs])),'median_time_to_peak_hours':rnd(med([x['path']['time_to_peak_hours'] for x in xs]),1),'median_time_to_trough_hours':rnd(med([x['path']['time_to_trough_hours'] for x in xs]),1)})

    def why(a,kind):
        c=a.get('components') or {};p=a.get('penalties') or {};reasons=[]
        if c.get('liquidity',100)<35:reasons.append('LOW_LIQUIDITY')
        if c.get('current_impulse',50)<45:reasons.append('WEAK_IMPULSE')
        if c.get('regime_fit',50)<=35:reasons.append('BEAR_REGIME')
        if c.get('relative_strength',50)<40:reasons.append('WEAK_RELATIVE_STRENGTH')
        if c.get('risk_efficiency',50)<30:reasons.append('HIGH_VOLATILITY')
        for k,v in p.items():
            if float(v or 0)>0:reasons.append('PENALTY_'+k.upper())
        if not reasons:reasons=['UNEXPLAINED_'+kind]
        return reasons
    false_pos=[];missed=[]
    for a in assets:
        if int(a.get('rank') or 999)<=10 and a['forward_return_pct']<0:false_pos.append({'symbol':a['symbol'],'rank':a['rank'],'return_pct':a['forward_return_pct'],'horizon_hours':a['horizon_hours'],'taxonomy':why(a,'FALSE_POSITIVE')})
        if int(a.get('rank') or 0)>10 and a['forward_return_pct']>=5:missed.append({'symbol':a['symbol'],'rank':a['rank'],'return_pct':a['forward_return_pct'],'horizon_hours':a['horizon_hours'],'taxonomy':why(a,'MISSED_WINNER')})

    expected=sum(len(r.get('assets') or []) for r in records);resolved=len(assets)
    survivorship={'frozen_snapshot_assets_evaluated':resolved,'live_universe_membership_required':False,'principle':'Assets remain in evaluation even if they later leave the dynamic universe.','coverage_pct':rnd(100*resolved/expected) if expected else None}
    quality=[]
    for a in assets:
        completeness=len(a.get('components') or {})/7 if a.get('components') else 0;path_ok=1 if a.get('path') else 0;score=.65*completeness+.35*path_ok
        quality.append(score)
    evidence_quality={'mean_quality_pct':rnd(100*mean(quality)) if quality else None,'complete_component_requirement':7,'path_evidence_weight_pct':35,'component_completeness_weight_pct':65}

    ev=(eval_feed.get('evaluation') or {});resolved_snaps=int(ev.get('resolved_snapshots') or 0);resolved_outcomes=int(ev.get('resolved_asset_outcomes') or 0)
    significant=[t for t in tests if t.get('holm_pass')]
    walk_forward_ready=resolved_snaps>=MIN_CHALLENGER_SNAPSHOTS and resolved_outcomes>=MIN_CHALLENGER_OUTCOMES and bool(significant)
    registry={'champion':{'id':'v2.0_FROZEN','state':'FROZEN_BASELINE'},'challengers':[{'id':'v2.1','state':'FORWARD_TEST','promotion_allowed':False}], 'proposals':[],'walk_forward_gate':{'required_snapshots':MIN_CHALLENGER_SNAPSHOTS,'required_asset_outcomes':MIN_CHALLENGER_OUTCOMES,'multiple_testing_signal_required':True,'eligible_to_propose':walk_forward_ready}}
    if walk_forward_ready:
        for t in significant[:5]:registry['proposals'].append({'hypothesis_id':'DQ31-'+t['id'].replace(':','-').upper(),'source_test':t['id'],'state':'PROPOSE_ONLY','fresh_forward_cohort_required':True,'automatic_promotion':False})

    latest=load_json(Path('decision-quality-v2.json'),{})
    certs=[]
    cal_by={(x['horizon_hours'],x['score_bucket']):x for x in calibration}
    for a in (latest.get('ranking') or [])[:20]:
        b=score_bucket(a.get('opportunity_score'));c72=cal_by.get((72,b),{})
        liq=(latest.get('liquidity') or {}).get(a['symbol'],{})
        certs.append({'symbol':a['symbol'],'rank':a.get('rank'),'score':a.get('opportunity_score'),'empirical_positive_probability_72h_pct':c72.get('empirical_positive_probability_pct'),'probability_sample_n':c72.get('n',0),'regime':a.get('regime'),'liquidity':liq,'model':'v2.1','model_disagreement_note':'Top-10 disagreement tracked against frozen v2.0','evidence_quality_state':'MEASURED' if c72.get('n',0)>=20 else 'EARLY','automatic_trade_authority':False})
    CERT.write_text(json.dumps({'generated_at':now(),'schema':'wavelength-decision-certificates-v1','certificates':certs,'orders_enabled':False},indent=2,sort_keys=True)+'\n')

    return {'regime_proof':regime_proof,'rank_band_proof':rank_bands,'confidence_calibration':calibration,'model_disagreement':disagreement,'penalty_attribution':penalty_attr,'factor_stability':factor_stability,'rank_persistence_decay':decay,'path_analysis':path_analysis,'false_positive_taxonomy':false_pos[:50],'missed_winner_taxonomy':sorted(missed,key=lambda x:x['return_pct'],reverse=True)[:50],'survivorship':survivorship,'evidence_quality':evidence_quality,'multiple_testing':mt,'champion_challenger_registry':registry,'decision_certificates_count':len(certs)}

def main():
    records=load_jsonl(RESOLVED);history=load_jsonl(HISTORY);ev=load_json(EVAL,{})
    paths=ensure_paths(records) if records else load_jsonl(PATHS)
    diagnostics=aggregate(records,paths,history,ev)
    payload={'schema':'wavelength-decision-quality-v3-1-diagnostics','mode':'READ_ONLY_DIAGNOSTICS','generated_at':now(),'orders_enabled':False,'execution_authority':False,'automatic_promotion':False,'automatic_allocation':False,'strategy_rule_mutation':False,'parameter_mutation':False,'resolved_records':len(records),'path_records':len(paths),'diagnostics':diagnostics,'interpretation':'Diagnostics may generate challenger hypotheses only after corrected evidence gates. They cannot alter or promote models.'}
    OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
    with HIST.open('a') as f:f.write(json.dumps({'generated_at':payload['generated_at'],'resolved_records':len(records),'path_records':len(paths),'walk_forward_eligible':diagnostics['champion_challenger_registry']['walk_forward_gate']['eligible_to_propose'],'multiple_testing_passes':len(diagnostics['multiple_testing']['passed'])},sort_keys=True)+'\n')
    print(json.dumps({'resolved_records':len(records),'path_records':len(paths),'multiple_testing_passes':len(diagnostics['multiple_testing']['passed']),'walk_forward_eligible':diagnostics['champion_challenger_registry']['walk_forward_gate']['eligible_to_propose']},indent=2))
if __name__=='__main__':main()
