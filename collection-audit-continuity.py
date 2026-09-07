#!/usr/bin/env python3
"""Public continuity audit for critical research evidence while private runner is unavailable."""
from __future__ import annotations
import hashlib,json
from datetime import datetime,timezone
from pathlib import Path
OUT=Path('collection-audit-continuity.json');HIST=Path('collection-audit-continuity-history.jsonl')

def now():return datetime.now(timezone.utc)
def load(p):
 try:return json.loads(Path(p).read_text())
 except:return {}
def parse(v):
 try:return datetime.fromisoformat(str(v).replace('Z','+00:00'))
 except:return None
def lines(p):
 try:return [x for x in Path(p).read_text().splitlines() if x.strip()]
 except:return []
def fp(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':'),default=str).encode()).hexdigest()[:16]
def row(id,label,path,cadence,expected_min,history=None,kind='feed'):
 d=load(path);gen=parse(d.get('generated_at'));age=(now()-gen).total_seconds()/60 if gen else None
 count=len(lines(history)) if history else (int(((d.get('counts') or {}).get('eligible') or 0)) if kind=='universe' else (1 if d else 0))
 state='FAILED' if not d else ('STALLED' if age is None or age>expected_min*1.75 else ('COLLECTING' if history and count>0 else 'NO_NEW_EVENT'))
 proof='PROVEN_ACCUMULATING' if history and count>1 else ('WAITING' if history and count<=1 else ('ISSUE' if state in {'FAILED','STALLED'} else 'RUNNING_NO_DISTINCT_EVENT'))
 reason='Evidence file missing.' if not d else (f'Last source observation {age:.0f}m ago exceeds expected window.' if state=='STALLED' else (f'{count} frozen history snapshots persisted.' if history else 'Feed is present within its expected window.'))
 return {'id':id,'label':label,'path':path,'cadence':cadence,'expected_min':expected_min,'kind':kind,'count':count,'delta_records':0,'source_observation_at':d.get('generated_at'),'age_minutes':round(age,1) if age is not None else None,'state':state,'proof_status':proof,'reason':reason,'advance_cycles':max(0,count-1) if history else 0,'audit_cycles_observed':count if history else 1,'semantic_fingerprint':fp(d) if d else None,'model_version':d.get('ranking_model') if id=='decision_quality' else None,'data':d}
def main():
 rows=[row('decision_quality','Decision Quality v2 continuity','decision-quality-v2.json','4_HOURLY',300,'decision-quality-v2-history.jsonl'),row('dynamic_universe','Dynamic Market Universe v2','dynamic-market-universe-v2.json','4_HOURLY',300,None,'universe'),row('private_audit','Private Collection Audit authority','collection-audit.json','HOURLY',90)]
 problems=sum(r['state'] in {'FAILED','STALLED'} for r in rows);proven=sum(r['proof_status']=='PROVEN_ACCUMULATING' for r in rows);oper=sum(r['state'] not in {'FAILED','STALLED'} for r in rows)
 u=rows[1]['data'];payload={'schema':'wavelength-collection-audit-continuity-v1','mode':'PUBLIC_READ_ONLY_CONTINUITY','generated_at':now().isoformat(),'audit_run':len(lines(HIST))+1,'overall_state':'DEGRADED' if problems else ('HEALTHY_COLLECTING' if proven else 'EARLY_EVIDENCE'),'evidence_confidence_pct':round(100*(.55*oper/len(rows)+.45*proven/len(rows))),'collector_count':len(rows),'operational_collectors':oper,'proven_accumulating_collectors':proven,'decision_quality_model':next((r.get('model_version') for r in rows if r['id']=='decision_quality'),None),'state_counts':{s:sum(r['state']==s for r in rows) for s in ['COLLECTING','NO_NEW_EVENT','WAITING_FOR_OUTCOME','STALLED','FAILED','DUPLICATE','NEW']},'universe_coverage':{'counts':u.get('counts',{}),'coverage':u.get('coverage',{}),'excluded_counts':u.get('excluded_counts',{}),'fingerprint':u.get('universe_fingerprint')},'collectors':[{k:v for k,v in r.items() if k!='data'} for r in rows],'orders_enabled':False,'execution_authority':False,'interpretation':'Fallback audit only. It explicitly surfaces stale private authority rather than allowing stale data to look healthy.'}
 OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n');
 with HIST.open('a') as f:f.write(json.dumps({'generated_at':payload['generated_at'],'audit_run':payload['audit_run'],'overall_state':payload['overall_state'],'decision_quality_model':payload.get('decision_quality_model'),'fingerprint':fp([(r['id'],r['state'],r['count'],r['semantic_fingerprint']) for r in rows])},sort_keys=True)+'\n')
 print(json.dumps({'state':payload['overall_state'],'problems':problems,'proven':proven,'decision_quality_model':payload.get('decision_quality_model')},indent=2))
if __name__=='__main__':main()
