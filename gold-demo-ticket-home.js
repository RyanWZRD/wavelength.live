(() => {
  const root = document.getElementById('goldDemoTicketHome');
  if (!root) return;
  const esc = (s) => String(s ?? '—').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const fmt = (v,d=2) => (v == null || Number.isNaN(Number(v))) ? '—' : Number(v).toFixed(d);
  const when = (s) => { if (!s) return '—'; const d = new Date(s); return Number.isNaN(d.getTime()) ? esc(s) : d.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}); };
  async function load(){
    try {
      const r = await fetch(`ig-mt4-manual-demo-ticket.json?ts=${Date.now()}`, {cache:'no-store'});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const p = await r.json();
      const t = p.ticket || {};
      const ready = p.status === 'PASS_MANUAL_DEMO_READY';
      root.innerHTML = `
        <div class="section-head"><div class="kicker">Gold demo validation</div><h2>Manual MT4 demo ticket</h2><p>Current read-only Wavelength ticket for controlled IG MT4 demo validation. No order is placed automatically.</p></div>
        <div class="landing-card" style="border-color:${ready?'#496d52':'#66552a'}">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:15px">
            <div><div class="kicker">${ready?'READY FOR MANUAL DEMO':'BLOCKED'}</div><h3 style="margin:7px 0 0;font:800 24px 'Bricolage Grotesque',sans-serif">${esc(t.direction)} ${esc(t.symbol)}</h3></div>
            <span class="plan-tag">${esc(t.entry_quality)}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:9px">
            ${[['Entry',fmt(t.entry_reference,2)],['Stop',fmt(t.stop,2)],['Target',fmt(t.target,2)],['MT4 size',fmt(t.valid_mt4_size,2)],['Est. risk',`£${fmt(t.estimated_risk_gbp,2)}`],['Risk %',`${fmt(t.estimated_risk_pct,3)}%`]].map(([a,b])=>`<div style="border:1px solid #25364a;border-radius:8px;padding:11px"><div style="color:#8094a8;font:600 8px 'IBM Plex Mono',monospace;text-transform:uppercase">${a}</div><div style="margin-top:5px;font:800 17px 'Bricolage Grotesque',sans-serif">${esc(b)}</div></div>`).join('')}
          </div>
          <div style="margin-top:13px;color:#879bae;font:500 9px 'IBM Plex Mono',monospace;line-height:1.6">Updated ${when(p.generated_at)} · Manual demo only · No broker connection · No automatic execution · No live-money authority.</div>
        </div>`;
    } catch (err) {
      root.innerHTML = `<div class="section-head"><div class="kicker">Gold demo validation</div><h2>Manual MT4 demo ticket</h2></div><div class="landing-card"><div style="color:#91a4b8">Ticket feed unavailable: ${esc(err.message)}</div></div>`;
    }
  }
  load();
  setInterval(load,30000);
})();
