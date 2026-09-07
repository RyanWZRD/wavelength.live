#!/usr/bin/env python3
"""Public read-only heartbeat for event-driven provenance sources.

Checks that declared event-driven artifacts are present and parseable. It does NOT
rewrite source evidence timestamps or create synthetic events. Provenance may use
this heartbeat to distinguish CURRENT/NO_NEW_EVENT from a genuinely stale/missing
collector.
"""
from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path

MANIFEST=Path('source-manifest.json')
OUT=Path('source-heartbeats.json')

def now(): return datetime.now(timezone.utc).isoformat()

def main():
    manifest=json.loads(MANIFEST.read_text())
    checked_at=now(); rows=[]
    for s in manifest.get('sources',[]):
        cadence=str(s.get('cadence') or '')
        if not cadence.startswith('EVENT_DRIVEN'): continue
        p=Path(s['path']); ok=False; err=None; generated=None
        try:
            d=json.loads(p.read_text())
            ok=True
            generated=d.get('generated_at') or d.get('updated_at')
        except Exception as e:
            err=f'{type(e).__name__}: {e}'
        rows.append({
            'id':s['id'],'path':s['path'],'checked_at':checked_at,
            'available_and_parseable':ok,'last_event_or_generation_at':generated,
            'error':err
        })
    payload={
        'schema':'wavelength-source-heartbeats-v1',
        'mode':'PUBLIC_READ_ONLY_HEARTBEAT',
        'generated_at':checked_at,
        'orders_enabled':False,'execution_authority':False,
        'strategy_rule_mutation':False,'parameter_mutation':False,
        'sources':rows
    }
    OUT.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
    print(json.dumps({'checked':len(rows),'healthy':sum(x['available_and_parseable'] for x in rows)},indent=2))

if __name__=='__main__': main()
