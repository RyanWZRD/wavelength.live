#!/usr/bin/env python3
"""Public read-only liveness and shadow-progress heartbeat.

Event-driven sources are checked for availability/parseability without changing
substantive evidence timestamps. Private-runner scheduled shadow feeds additionally
receive a progress check against the latest completed 4h bar. No orders, strategy
changes, synthetic signals or evidence backfill are performed.
"""
from __future__ import annotations
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

MANIFEST=Path('source-manifest.json')
OUT=Path('source-heartbeats.json')

def dt(v):
    try:return datetime.fromisoformat(str(v).replace('Z','+00:00'))
    except:return None

def now_dt(): return datetime.now(timezone.utc)
def iso(x): return x.isoformat() if x else None

def expected_completed_4h(now):
    boundary=now.replace(hour=(now.hour//4)*4,minute=0,second=0,microsecond=0)
    return boundary-timedelta(hours=4)

def main():
    manifest=json.loads(MANIFEST.read_text()); n=now_dt(); checked_at=iso(n); rows=[]
    for s in manifest.get('sources',[]):
        cadence=str(s.get('cadence') or '')
        progress_mode=s.get('freshness_basis')=='HEARTBEAT_PROGRESS'
        if not cadence.startswith('EVENT_DRIVEN') and not progress_mode: continue
        p=Path(s['path']); ok=False; err=None; generated=None; data={}
        try:
            data=json.loads(p.read_text()); ok=True
            generated=data.get('generated_at') or data.get('updated_at')
        except Exception as e:
            err=f'{type(e).__name__}: {e}'
        row={'id':s['id'],'path':s['path'],'checked_at':checked_at,'available_and_parseable':ok,'last_event_or_generation_at':generated,'error':err}
        if progress_mode:
            cur=data
            for part in str(s.get('progress_path') or '').split('.'):
                if not part: continue
                cur=cur.get(part) if isinstance(cur,dict) else None
            latest=dt(cur); expected=expected_completed_4h(n)
            lag=((expected-latest).total_seconds()/60) if latest else None
            progress_ok=bool(ok and latest and latest>=expected)
            row.update({
                'progress_check':True,
                'latest_shadow_bar':iso(latest),
                'expected_completed_shadow_bar':iso(expected),
                'shadow_progress_lag_minutes':round(max(0,lag),1) if lag is not None else None,
                'progress_ok':progress_ok,
                'authority_state':'CURRENT' if progress_ok else 'PRIVATE_PUBLISHER_STALLED'
            })
        rows.append(row)
    payload={
        'schema':'wavelength-source-heartbeats-v1.1','mode':'PUBLIC_READ_ONLY_HEARTBEAT',
        'generated_at':checked_at,'orders_enabled':False,'execution_authority':False,
        'strategy_rule_mutation':False,'parameter_mutation':False,'sources':rows
    }
    OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
    print(json.dumps({'checked':len(rows),'healthy':sum(x['available_and_parseable'] for x in rows),'progress_stalled':[x['id'] for x in rows if x.get('progress_check') and not x.get('progress_ok')]},indent=2))

if __name__=='__main__': main()
