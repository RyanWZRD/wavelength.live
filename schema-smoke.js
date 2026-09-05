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
 'pre-trade-evidence.json':['mode','generated_at','orders_enabled','readiness_state','rehearsal_state','trade_two_locked']
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
if(failed)process.exit(1);
console.log('Runtime feed schema smoke: PASS');
