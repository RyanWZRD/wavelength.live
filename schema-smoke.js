'use strict';
const fs=require('fs');
const specs={
 'paper-portfolio.json':['mode','generated_at','orders_enabled','paper_starting_equity','paper_equity','cash','open_positions','closed_trades_total','fees_paid_total','last_scan','weekly','rules'],
 'paper-accounting.json':['mode','orders_enabled','paper_started_at','lifetime_realized_pnl','lifetime_closed_trade_fees','lifetime_closed_trades'],
 'opportunity-radar.json':['mode','generated_at','orders_enabled','opportunities'],
 'opportunity-funnel.json':['mode','generated_at','orders_enabled','qualified','paper'],
 'validation.json':['mode','generated_at','orders_enabled','live_ready'],
 'research-evidence.json':['mode','generated_at','orders_enabled'],
 'governance-status.json':['mode','generated_at','orders_enabled'],
 'pre-trade-evidence.json':['mode','generated_at','orders_enabled','readiness_state','rehearsal_state','trade_two_locked'],
 'observation-status.json':['mode','generated_at','orders_enabled','why_no_trade','what_changed','next_events','milestones','daily_digest','freshness','funnel_history','qualified_history','paper_thesis_history','journal'],
 'paper-ops-status.json':['mode','generated_at','orders_enabled','automatic_paper_orders_enabled','live_money_enabled','paper_endpoint_locked','entry_safety_switch','portfolio','execution_health','daily_digest','retention_policy']
};
let failed=false;
for(const [file,keys] of Object.entries(specs)){
 if(!fs.existsSync(file)){console.error(`${file}: missing`);failed=true;continue}
 let p;try{p=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){console.error(`${file}: invalid JSON ${e.message}`);failed=true;continue}
 const missing=keys.filter(k=>!(k in p));
 if(missing.length){console.error(`${file}: missing ${missing.join(', ')}`);failed=true}
 if(p.orders_enabled!==false){console.error(`${file}: orders_enabled must be false`);failed=true}
}
const paper=JSON.parse(fs.readFileSync('paper-portfolio.json','utf8'));
if(!Array.isArray(paper.open_positions)||!Array.isArray(paper.recent_closed_trades)){console.error('paper arrays malformed');failed=true}
const radar=JSON.parse(fs.readFileSync('opportunity-radar.json','utf8'));
if(!Array.isArray(radar.opportunities)){console.error('radar opportunities malformed');failed=true}
const funnel=JSON.parse(fs.readFileSync('opportunity-funnel.json','utf8'));
if(!Array.isArray(funnel.qualified)||!Array.isArray(funnel.paper)){console.error('funnel arrays malformed');failed=true}
const obs=JSON.parse(fs.readFileSync('observation-status.json','utf8'));
for(const k of ['what_changed','next_events','milestones','funnel_history','qualified_history','paper_thesis_history','journal'])if(!Array.isArray(obs[k])){console.error(`observation ${k} malformed`);failed=true}
if(!fs.existsSync('multi-asset-paper-status.json')){console.error('multi-asset-paper-status.json: missing');failed=true}else{
 let m;try{m=JSON.parse(fs.readFileSync('multi-asset-paper-status.json','utf8'))}catch(e){console.error(`multi-asset-paper-status.json: invalid JSON ${e.message}`);failed=true;m={}}
 for(const k of ['mode','generated_at','orders_enabled','automatic_paper_orders_enabled','live_money_enabled','qualified_symbols','managed_symbols','actions','paper_endpoint_locked'])if(!(k in m)){console.error(`multi-asset-paper-status.json: missing ${k}`);failed=true}
 if(m.orders_enabled!==false){console.error('multi-asset public orders_enabled must be false');failed=true}
 if(m.automatic_paper_orders_enabled!==true){console.error('multi-asset automatic PAPER flag must be true');failed=true}
 if(m.live_money_enabled!==false){console.error('multi-asset live_money_enabled must be false');failed=true}
 if(m.paper_endpoint_locked!==true){console.error('multi-asset paper endpoint lock must be true');failed=true}
 for(const k of ['qualified_symbols','managed_symbols','actions'])if(!Array.isArray(m[k])){console.error(`multi-asset ${k} malformed`);failed=true}
}
const ops=JSON.parse(fs.readFileSync('paper-ops-status.json','utf8'));
if(ops.live_money_enabled!==false||ops.paper_endpoint_locked!==true||ops.automatic_paper_orders_enabled!==true){console.error('paper ops safety flags malformed');failed=true}
if(typeof ops.portfolio?.position_count!=='number'){console.error('paper ops position count malformed');failed=true}
if(!Array.isArray(ops.qualified_but_broker_unsupported)){console.error('paper ops unsupported list malformed');failed=true}
const forbidden=['equity','cash','market_value','total_market_value','unrealized_pl','total_unrealized_pl','qty','order_id','stop_price'];
function unsafe(v){if(Array.isArray(v))return v.some(unsafe);if(v&&typeof v==='object')return Object.entries(v).some(([k,x])=>forbidden.includes(k.toLowerCase())||unsafe(x));return false}
if(unsafe(ops)){console.error('paper ops public feed contains broker-account/execution detail');failed=true}
if(failed)process.exit(1);
console.log('Runtime feed schema smoke: PASS');
