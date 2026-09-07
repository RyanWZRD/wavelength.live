#!/usr/bin/env python3
"""Public read-only continuity publisher for Bot Operations and Alerts.

Rebuilds the two operational status feeds from current public continuity evidence.
It never places orders, changes strategies, promotes models, or enables live money.
"""
from __future__ import annotations
import json, hashlib
from datetime import datetime, timezone
from pathlib import Path

BOT=Path('bot-operations-status.json')
ALERTS=Path('wavelength-alerts.json')
DQ=Path('decision-quality-v2.json')
AUDIT=Path('collection-audit-continuity.json')
INCIDENT=Path('operator-incident-centre.json')
PORT=Path('paper-portfolio.json')
V3=Path('candidate-v3-forward-evidence.json')
CROWD=Path('crowding-v2-forward-evidence.json')

def load(p, default=None):
    try:return json.loads(Path(p).read_text())
    except:return {} if default is None else default

def now(): return datetime.now(timezone.utc).isoformat()

def aid(kind, subject, message):
    return hashlib.sha256(f'{kind}|{subject}|{message}'.encode()).hexdigest()[:20]

def main():
    ts=now(); dq=load(DQ); audit=load(AUDIT); inc=load(INCIDENT); port=load(PORT); v3=load(V3); crowd=load(CROWD)
    old_alerts=load(ALERTS, {'latest_alerts':[]})
    ops=inc.get('existing_operations') or {}
    broker=inc.get('broker_reconciliation') or {}
    collectors=audit.get('collectors') or []
    stalled=[x for x in collectors if x.get('state') in {'FAILED','STALLED'}]
    v3bar=(v3.get('summary') or {}).get('latest_shadow_bar')
    cbar=(crowd.get('summary') or {}).get('latest_shadow_bar')
    bot={
      'mode':'BOT_OPERATIONS_PUBLIC_CONTINUITY_READ_ONLY','authority':'PUBLIC_CONTINUITY_WHILE_PRIVATE_RUNNER_UNAVAILABLE',
      'generated_at':ts,'orders_enabled':False,'live_money_enabled':False,'execution_authority':False,
      'automatic_promotion':False,'strategy_rule_mutation':False,'scheduled_execution':False,
      'first_paper_launch_state':'BLOCKED','hard_blocker_count':len(stalled)+2,'soft_blocker_count':0,
      'reconciliation_confidence':ops.get('reconciliation_confidence'),
      'circuit_breaker':ops.get('circuit_breaker') or 'HARD_BLOCK','guardian_status':broker.get('guardian_status') or ops.get('guardian_status') or 'UNKNOWN',
      'data_health':'DEGRADED' if stalled else 'OK','unacknowledged_incidents':ops.get('unacknowledged_incidents',0),
      'closed_paper_trades':port.get('closed_trades_total',0),'canary_review_stage':'CANARY','twin_engine_status':'COLLECTING',
      'private_runner_state':'UNAVAILABLE','forward_shadow_progress':{'candidate_v3_latest_shadow_bar':v3bar,'crowding_v2_latest_shadow_bar':cbar},
      'strategies':[{'id':'candidate_v3','version':'v3.0-frozen','status':'FORWARD_SHADOW'}, {'id':'crowding_v2','version':'v2.0-pre2025-survivor','status':'FORWARD_SHADOW'}],
      'note':'Hourly public continuity observability. Private execution authority remains unavailable; no order controls or broker credentials are exposed.'
    }
    BOT.write_text(json.dumps(bot,indent=2,sort_keys=True)+'\n')

    generated=[]
    for a in (dq.get('alerts') or [])[:10]:
        sym=str(a.get('symbol') or 'market'); msg=str(a.get('message') or '')
        generated.append({'id':aid('DECISION_QUALITY',sym,msg),'kind':'DECISION_QUALITY_OPPORTUNITY','severity':'MATERIAL','subject':sym,'title':f'{sym} decision-quality alert','message':msg,'created_at':ts})
    if stalled:
        msg=', '.join(f"{x.get('label')}: {x.get('state')}" for x in stalled[:5])
        generated.append({'id':aid('COLLECTION_HEALTH','platform',msg),'kind':'PIPELINE_HEALTH','severity':'ACTION_REQUIRED','subject':'platform','title':'Collection pipeline requires attention','message':msg,'created_at':ts})
    # Preserve prior unique alerts as history, but do not count them as new this run.
    seen={x['id'] for x in generated}
    for a in old_alerts.get('latest_alerts') or []:
        if a.get('id') not in seen:
            generated.append(a); seen.add(a.get('id'))
        if len(generated)>=20: break
    payload={
      'mode':'WAVELENGTH_ALERT_ENGINE_PUBLIC_CONTINUITY_READ_ONLY','authority':'PUBLIC_CONTINUITY_WHILE_PRIVATE_RUNNER_UNAVAILABLE',
      'generated_at':ts,'engine_state':'ARMED','orders_enabled':False,'live_money_enabled':False,'execution_authority':False,
      'automatic_promotion':False,'capital_allocation_authority':False,'strategy_rule_mutation':False,
      'new_alert_count':len([x for x in generated if x.get('created_at')==ts]),'latest_alerts':generated,
      'delivery':{'channel':'IN_APP','notification_required':any(x.get('severity')=='ACTION_REQUIRED' and x.get('created_at')==ts for x in generated),'alert':next((x for x in generated if x.get('severity')=='ACTION_REQUIRED' and x.get('created_at')==ts),None)},
      'input_errors':[],'note':'Hourly public continuity alert evaluation. A fresh generated_at means the alert service ran; it does not mean a new substantive event occurred.'
    }
    ALERTS.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
    print(json.dumps({'generated_at':ts,'bot_data_health':bot['data_health'],'alerts_this_run':payload['new_alert_count']},indent=2))

if __name__=='__main__': main()
