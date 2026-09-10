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
      const v = p.validity || {};
      const ready = p.status === 'PASS_MANUAL_DEMO_READY';
      const expired = p.status === 'EXPIRED_DO_NOT_ENTER' || v.state === 'EXPIRED';
      const staleData = p.status === 'STALE_DATA_DO_NOT_ENTER' || v.state === 'STALE_DATA';
      const quality = String(t.entry_quality || '—').toUpperCase();
      const statusText = ready ? 'READY — MANUAL DEMO ONLY' : expired ? 'EXPIRED — DO NOT ENTER' : staleData ? 'STALE DATA — DO NOT ENTER' : 'BLOCKED — DO NOT PLACE';
      const reason = v.reason || (ready ? 'Ticket is within its permitted manual-entry window.' : 'Ticket is not currently valid for entry.');
      root.innerHTML = `
        <div class="section-head"><div class="kicker">Gold demo validation</div><h2>Manual MT4 demo ticket</h2><p>Current read-only Wavelength ticket for controlled IG MT4 demo validation. <strong>No order is placed automatically.</strong></p></div>
        <div class="landing-card" style="border-color:${ready?'#496d52':'#7a4a43'}">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:15px">
            <div>
              <div style="display:inline-flex;align-items:center;padding:7px 10px;border:1px solid ${ready?'#496d52':'#7a4a43'};border-radius:7px;background:${ready?'rgba(73,109,82,.14)':'rgba(122,74,67,.16)'};font:800 9px 'IBM Plex Mono',monospace;letter-spacing:.06em">${esc(statusText)}</div>
              <h3 style="margin:10px 0 0;font:800 26px 'Bricolage Grotesque',sans-serif">${esc(t.direction)} ${esc(t.symbol)}</h3>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <span class="plan-tag" style="font-size:9px;padding:6px 9px">ENTRY QUALITY: ${esc(quality)}</span>
              <span class="plan-tag" style="font-size:9px;padding:6px 9px">TARGET RISK: ${fmt(t.target_risk_pct,2)}%</span>
            </div>
          </div>
          <div style="margin-bottom:12px;padding:10px 12px;border:1px solid ${ready?'#344a61':'#7a4a43'};border-radius:8px;color:${ready?'#aebfd0':'#e2b1aa'};font:700 9px 'IBM Plex Mono',monospace;line-height:1.65">${esc(reason)}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px">
            ${[['Entry reference',fmt(t.entry_reference,2)],['Stop',fmt(t.stop,2)],['Target',fmt(t.target,2)],['MT4 volume',fmt(t.valid_mt4_size,2)],['Est. risk',`£${fmt(t.estimated_risk_gbp,2)}`],['Actual risk',`${fmt(t.estimated_risk_pct,5)}%`]].map(([a,b])=>`<div style="border:1px solid #25364a;border-radius:8px;padding:12px;min-width:0"><div style="color:#8094a8;font:600 8px 'IBM Plex Mono',monospace;text-transform:uppercase">${a}</div><div style="margin-top:5px;font:800 18px 'Bricolage Grotesque',sans-serif;white-space:nowrap;overflow:visible">${esc(b)}</div></div>`).join('')}
          </div>
          ${ready
            ? `<div style="margin-top:14px;padding:10px 12px;border:1px solid #344a61;border-radius:8px;color:#aebfd0;font:700 9px 'IBM Plex Mono',monospace;line-height:1.7">MANUAL DEMO ONLY · Confirm IG-DEMO and ${esc(t.symbol)} before any manual entry · Do not increase volume above ${fmt(t.valid_mt4_size,2)} · No broker connection · No automatic execution · No live-money authority.</div>`
            : `<div style="margin-top:14px;padding:10px 12px;border:1px solid #7a4a43;border-radius:8px;color:#e2b1aa;font:800 9px 'IBM Plex Mono',monospace;line-height:1.7">DO NOT ENTER THIS TICKET · Wait for a new qualifying Gold assessment and a freshly generated CURRENT ticket.</div>`}
          <div style="margin-top:10px;color:#879bae;font:500 9px 'IBM Plex Mono',monospace;line-height:1.6">Ticket updated ${when(p.generated_at)}${v.signal_time?` · Signal ${when(v.signal_time)}`:''}${v.signal_age_minutes!=null?` · Age ${fmt(v.signal_age_minutes,1)} min`:''}</div>
        </div>`;
    } catch (err) {
      root.innerHTML = `<div class="section-head"><div class="kicker">Gold demo validation</div><h2>Manual MT4 demo ticket</h2></div><div class="landing-card"><div style="color:#91a4b8">Ticket feed unavailable: ${esc(err.message)}</div></div>`;
    }
  }
  load();
  setInterval(load,30000);
})();
