(()=>{
'use strict';
const esc=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function row(a,b,c=''){return `<div class="analysis-row"><span class="analysis-label">${esc(a)}</span><strong class="${c}">${esc(b)}</strong></div>`}
function install(){
 const safety=document.querySelector('#ordersState');
 if(safety){safety.textContent='PAPER ENABLED';safety.className='up';const label=safety.closest('.analysis-row')?.querySelector('.analysis-label');if(label)label.textContent='Automatic Alpaca PAPER orders';}
 const live=document.querySelector('#liveReady');if(live){live.textContent='DISABLED';live.className='down'}
 const anchor=[...document.querySelectorAll('.card-title')].find(x=>x.textContent.trim()==='Safety architecture')?.closest('section');
 if(!anchor)return;
 if(!document.querySelector('#autoPaperPanel')){
   const s=document.createElement('section');s.className='card';s.id='autoPaperPanel';s.innerHTML=`<div class="card-head"><div><div class="card-title">Automatic Alpaca PAPER · Candidate V3</div><div class="card-meta" id="autoPaperMeta">Loading automatic paper state…</div></div><span class="badge warn" id="autoPaperBadge">ARMED</span></div><div class="grid2"><div class="analysis-list" id="autoPaperState"><div class="empty">Waiting for first automatic PAPER evaluation…</div></div><div class="analysis-list" id="autoPaperBoundary"></div></div>`;
   anchor.parentNode.insertBefore(s,anchor);
 }
 const multiAnchor=document.querySelector('#autoPaperPanel')||anchor;
 if(!document.querySelector('#multiPaperPanel')){
   const m=document.createElement('section');m.className='card';m.id='multiPaperPanel';m.innerHTML=`<div class="card-head"><div><div class="card-title">Experimental multi-asset Alpaca PAPER</div><div class="card-meta" id="multiPaperMeta">Loading wider-market paper state…</div></div><span class="badge warn" id="multiPaperBadge">EXPERIMENTAL</span></div><div class="grid2"><div class="analysis-list" id="multiPaperState"><div class="empty">Waiting for wider-market evaluation…</div></div><div class="analysis-list" id="multiPaperActions"></div></div><div class="card-meta" style="margin-top:12px">Separate from Candidate V3. These wider-market rules are experimental PAPER only and are not validated for live capital.</div>`;
   multiAnchor.parentNode.insertBefore(m,multiAnchor.nextSibling);
 }
 fetch(`automatic-paper-status.json?t=${Date.now()}`).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(d=>{
   const active=d.automatic_paper_orders_enabled===true&&d.live_money_enabled===false;
   document.querySelector('#autoPaperBadge').textContent=active?'AUTO PAPER ON':'CHECK STATE';document.querySelector('#autoPaperBadge').className='badge '+(active?'good':'warn');
   document.querySelector('#autoPaperMeta').textContent=`Candidate V3 · latest ${d.generated_at?new Date(d.generated_at).toLocaleString():'—'} · public controls remain read-only`;
   document.querySelector('#autoPaperState').innerHTML=[row('Latest V3 signal',d.signal_action),row('Execution plan',d.plan_action),row('Plan allowed',d.plan_allowed===true?'YES':d.plan_allowed===false?'NO':'—',d.plan_allowed===true?'up':''),row('Latest result',d.result),row('Reason',d.reason)].join('');
   const sanity=d.entry_sanity;document.querySelector('#autoPaperBoundary').innerHTML=[row('Automatic PAPER execution',d.automatic_paper_orders_enabled?'ENABLED':'DISABLED',d.automatic_paper_orders_enabled?'up':'down'),row('Live money',d.live_money_enabled?'ENABLED':'DISABLED',d.live_money_enabled?'down':'up'),row('Alpaca PAPER endpoint lock',d.paper_endpoint_locked?'ENFORCED':'UNKNOWN',d.paper_endpoint_locked?'up':''),row('Entry price/data sanity',sanity?sanity.passed?'PASSED':'REJECTED':'NOT NEEDED',sanity?(sanity.passed?'up':'down'):'')].join('');
 }).catch(()=>{document.querySelector('#autoPaperMeta').textContent='Automatic PAPER is armed privately; waiting for first post-deployment evaluation.';document.querySelector('#autoPaperState').innerHTML=row('Latest evaluation','WAITING FOR NEXT 4H V3 SCAN');document.querySelector('#autoPaperBoundary').innerHTML=[row('Automatic PAPER execution','ENABLED','up'),row('Live money','DISABLED','up'),row('Public order controls','NONE','up')].join('')});
 fetch(`multi-asset-paper-status.json?t=${Date.now()}`).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(d=>{
   const active=d.automatic_paper_orders_enabled===true&&d.live_money_enabled===false;
   const managed=Array.isArray(d.managed_symbols)?d.managed_symbols:[];const qualified=Array.isArray(d.qualified_symbols)?d.qualified_symbols:[];const acts=Array.isArray(d.actions)?d.actions:[];
   document.querySelector('#multiPaperBadge').textContent=d.kill_switch?'KILL SWITCH':active?'AUTO PAPER ON':'CHECK STATE';document.querySelector('#multiPaperBadge').className='badge '+(d.kill_switch?'bad':active?'good':'warn');
   document.querySelector('#multiPaperMeta').textContent=`Wider-market experimental v1 · latest ${d.generated_at?new Date(d.generated_at).toLocaleString():'—'}`;
   document.querySelector('#multiPaperState').innerHTML=[row('Qualified now',qualified.length?qualified.join(', '):'NONE'),row('Managed Alpaca PAPER positions',managed.length?managed.join(', '):'NONE'),row('Risk per trade',`${d.risk_per_trade_pct??'—'}%`),row('Max positions',d.max_positions),row('Max notional / asset',`${d.max_notional_per_asset_pct??'—'}%`),row('Kill switch',d.kill_switch||'CLEAR',d.kill_switch?'down':'up'),row('Live money',d.live_money_enabled?'ENABLED':'DISABLED',d.live_money_enabled?'down':'up')].join('');
   document.querySelector('#multiPaperActions').innerHTML=acts.length?acts.slice(0,8).map(a=>row(a.symbol,`${a.action}${a.reason?` · ${a.reason}`:''}`,String(a.action||'').startsWith('ENTRY_PROTECTED')?'up':String(a.action||'').startsWith('REJECT')?'neutral':'' )).join(''):row('Latest actions','NONE');
 }).catch(()=>{document.querySelector('#multiPaperMeta').textContent='Waiting for the first published multi-asset PAPER snapshot.';document.querySelector('#multiPaperState').innerHTML=[row('Automatic PAPER execution','ENABLED','up'),row('Live money','DISABLED','up'),row('Public order controls','NONE','up')].join('');document.querySelector('#multiPaperActions').innerHTML=row('Latest actions','WAITING')});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
