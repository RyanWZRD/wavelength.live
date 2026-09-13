(() => {
  const root = document.getElementById('goldDemoTicketHome');
  if (!root) return;
  const esc = (s) => String(s ?? '—').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const fmt = (v,d=2) => (v == null || Number.isNaN(Number(v))) ? '—' : Number(v).toFixed(d);
  const when = (s) => { if (!s) return '—'; const d = new Date(s); return Number.isNaN(d.getTime()) ? esc(s) : d.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}); };

  async function load(){
    try {
      const [ticketRes, quoteRes] = await Promise.all([
        fetch(`ig-mt4-manual-demo-ticket.json?ts=${Date.now()}`, {cache:'no-store'}),
        fetch(`ig-gold-quote.json?ts=${Date.now()}`, {cache:'no-store'})
      ]);
      if (!ticketRes.ok) throw new Error(`ticket HTTP ${ticketRes.status}`);
      const p = await ticketRes.json();
      const q = quoteRes.ok ? await quoteRes.json() : {};
      const t = p.ticket || {};
      const v = p.validity || {};
      const direction = String(t.direction || '').toUpperCase();
      const quality = String(t.entry_quality || '—').toUpperCase();
      const hasSignal = direction === 'LONG' || direction === 'SHORT';
      const noSignal = !hasSignal || quality === 'NO_ENTRY';
      const ready = p.status === 'PASS_MANUAL_DEMO_READY';
      const statusText = ready ? 'READY · MANUAL DEMO' : noSignal ? 'FLAT · MONITORING' : 'SIGNAL · CHECK TICKET';
      const border = ready ? '#496d52' : noSignal ? '#344a61' : '#7a4a43';
      const statusBg = ready ? 'rgba(73,109,82,.14)' : noSignal ? 'rgba(52,74,97,.18)' : 'rgba(122,74,67,.16)';
      const spot = q.mid ?? null;
      const market = q.market_name || 'Spot Gold';
      root.innerHTML = `
        <div class="landing-card" style="border-color:${border};display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center">
          <div>
            <div class="kicker">Gold monitor</div>
            <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:7px">
              <div style="font:800 26px 'Bricolage Grotesque',sans-serif">${esc(statusText)}</div>
              <span style="display:inline-flex;padding:6px 9px;border:1px solid ${border};border-radius:999px;background:${statusBg};font:800 8px 'IBM Plex Mono',monospace">${esc(direction || 'FLAT')}</span>
            </div>
            <div style="margin-top:8px;color:#91a4b8;font-size:11px;line-height:1.6">${esc(market)}${spot != null ? ` · ${fmt(spot,2)}` : ''}${hasSignal ? ` · ${esc(quality)}` : ''}. The detailed operational ticket now lives in its own Gold workspace.</div>
            <div style="margin-top:7px;color:#778da2;font:500 8px 'IBM Plex Mono',monospace">Ticket updated ${when(p.generated_at)}${v.signal_time?` · Signal ${when(v.signal_time)}`:''}</div>
          </div>
          <a class="landing-btn primary" href="gold-ticket.html" style="white-space:nowrap">Open Gold Ticket →</a>
        </div>`;
    } catch (err) {
      root.innerHTML = `<div class="landing-card"><div class="kicker">Gold monitor</div><div style="margin-top:7px;font:800 22px 'Bricolage Grotesque',sans-serif">Gold ticket unavailable</div><div style="margin-top:7px;color:#91a4b8;font-size:11px">${esc(err.message)}</div><a class="landing-btn" href="gold-ticket.html" style="margin-top:12px">Open Gold workspace →</a></div>`;
    }
  }
  load();
  setInterval(load,30000);
})();
