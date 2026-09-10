(() => {
  const root = document.getElementById('igMt4ManualDemoTicketPanel');
  if (!root) return;
  const esc=(s)=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const fmt=(v,d=2)=>(v==null||Number.isNaN(Number(v)))?'—':Number(v).toFixed(d);
  const when=(s)=>{if(!s)return'—';const d=new Date(s);return Number.isNaN(d.getTime())?esc(s):d.toLocaleString([],{dateStyle:'medium',timeStyle:'short'});};
  const metric=(label,value,sub='')=>`<div class="card"><div class="card-meta">${esc(label)}</div><div style="font-size:1.3rem;font-weight:800;margin-top:4px">${esc(value)}</div>${sub?`<div class="card-meta" style="margin-top:4px">${esc(sub)}</div>`:''}</div>`;

  async function load(){
    try{
      const r=await fetch(`ig-mt4-manual-demo-ticket.json?ts=${Date.now()}`,{cache:'no-store'});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const p=await r.json(), t=p.ticket||{};
      const ready=p.status==='PASS_MANUAL_DEMO_READY';
      const badgeClass=ready?'good':'warn';
      const badgeText=ready?'MANUAL DEMO READY':'BLOCKED';
      root.innerHTML=`
        <div class="card-head"><div><div class="card-title">IG MT4 Manual Demo Ticket</div><div class="card-meta">Operator-facing Gold ticket · manual demo only · no automatic execution</div></div><span class="badge ${badgeClass}">${badgeText}</span></div>
        <div class="grid4" style="margin-bottom:14px">
          ${metric('Direction',t.direction||'—',`Quality ${t.entry_quality||'—'}`)}
          ${metric('Symbol',t.symbol||'—',t.internal_symbol||'')}
          ${metric('MT4 size',fmt(t.valid_mt4_size,1),`Target risk ${fmt(t.target_risk_pct,2)}%`)}
          ${metric('Estimated risk',`£${fmt(t.estimated_risk_gbp,2)}`,`${fmt(t.estimated_risk_pct,5)}%`)}
        </div>
        <div class="grid4" style="margin-bottom:14px">
          ${metric('Entry reference',fmt(t.entry_reference,4))}
          ${metric('Stop',fmt(t.stop,4),`Distance ${fmt(t.stop_distance,4)}`)}
          ${metric('Target',fmt(t.target,4))}
          ${metric('Action',ready?'MANUAL DEMO ONLY':'DO NOT PLACE',ready?'Confirm IG-DEMO + symbol first':'Ticket prerequisites not satisfied')}
        </div>
        <div class="card-meta">${esc(t.cash_value_basis||'')} · Updated ${when(p.generated_at)}. This card cannot place orders and has no live-money authority.</div>`;
    } catch(err) {
      root.innerHTML=`<div class="card-head"><div><div class="card-title">IG MT4 Manual Demo Ticket</div><div class="card-meta">Read-only operator ticket</div></div><span class="badge warn">UNAVAILABLE</span></div><div class="empty">Manual demo ticket feed unavailable: ${esc(err.message)}</div>`;
    }
  }
  load();
  setInterval(load,30000);
})();
