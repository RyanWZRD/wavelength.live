(() => {
  const root = document.getElementById('goldDecisionPanel');
  if (!root) return;
  const fmt=(v,d=1)=>(v==null||Number.isNaN(Number(v)))?'—':Number(v).toFixed(d);
  const esc=(s)=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const when=(s)=>{if(!s)return'—';const d=new Date(s);return Number.isNaN(d.getTime())?esc(s):d.toLocaleString([],{dateStyle:'medium',timeStyle:'short'});};
  const badge=(decision)=>`<span class="badge ${decision==='LONG'?'good':decision==='SHORT'?'bad':'warn'}">${esc(decision||'—')}</span>`;
  const metric=(label,value,sub='')=>`<div class="card"><div class="card-meta">${esc(label)}</div><div style="font-size:1.35rem;font-weight:800;margin-top:4px">${esc(value)}</div>${sub?`<div class="card-meta" style="margin-top:4px">${esc(sub)}</div>`:''}</div>`;
  const tf=(v)=>v===1?'Bullish':v===-1?'Bearish':'Mixed';
  async function load(){
    try{
      const r=await fetch(`gold-decision.json?ts=${Date.now()}`,{cache:'no-store'}); if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const p=await r.json(),a=p.latest_assessment||{},e60=(p.forward_evidence_summary||{})['60m']||{},e240=(p.forward_evidence_summary||{})['240m']||{},reasons=Array.isArray(a.reasons)?a.reasons:[],opps=Array.isArray(p.recent_opportunities)?p.recent_opportunities:[],align=a.timeframe_alignment||{},pol=p.policy||{},stale=a.data_stale===true;
      root.innerHTML=`
        <div class="card-head"><div><div class="card-title">Gold Decision Engine</div><div class="card-meta">5m timing · 15m structure · 1h context · scans every ${esc(p.scan_frequency_minutes??5)} min · GC=F research proxy</div></div>${badge(a.decision)}</div>
        <div class="grid4" style="margin-bottom:14px">
          ${metric('Decision',a.decision||'—',stale?'Feed stale / fail closed':`Entry quality ${a.entry_quality||'NO_ENTRY'}`)}
          ${metric('Confidence',`${fmt(a.confidence,1)}%`,`Standard ${fmt(pol.standard_confidence_min,0)}% · Strong ${fmt(pol.strong_confidence_min,0)}%`)}
          ${metric('Directional score',fmt(a.directional_score,1),`Qualifies at ±${fmt(pol.directional_score_abs_min,1)}`)}
          ${metric('Reference price',fmt(a.reference_price,2),`Bar ${when(a.signal_time)}`)}
        </div>
        <div class="grid4" style="margin-bottom:14px">
          ${metric('5m timing',tf(align['5m']), 'Entry timing layer')}
          ${metric('15m structure',tf(align['15m']), 'Intraday structure')}
          ${metric('1h context',tf(align['1h']), 'Broader context')}
          ${metric('Alignment',String(align.aligned_count??0),`Needs ${pol.min_timeframes_aligned??2} aligned`)}
        </div>
        <div class="grid2" style="margin-bottom:14px">
          <div class="card"><div class="card-title" style="font-size:1rem">Why the engine decided this</div><div style="margin-top:10px">${reasons.length?reasons.map(x=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)"><div><strong>${esc(x.factor)}</strong><div class="card-meta">${esc(x.reason)}</div></div><div style="font-family:IBM Plex Mono,monospace;font-weight:700">${Number(x.score)>0?'+':''}${fmt(x.score,1)}</div></div>`).join(''):'<div class="empty">No score components available.</div>'}</div></div>
          <div class="card"><div class="card-title" style="font-size:1rem">Forward evidence</div><div class="grid2" style="margin-top:10px">${metric('1h resolved',String(e60.resolved??0),`Mean ${fmt(e60.mean_net_bps,2)} bps · PF ${fmt(e60.profit_factor,2)}`)}${metric('4h resolved',String(e240.resolved??0),`Mean ${fmt(e240.mean_net_bps,2)} bps · PF ${fmt(e240.profit_factor,2)}`)}</div><div class="card-meta" style="margin-top:10px">Research cost assumption: ${fmt(pol.base_round_trip_cost_bps_for_research,1)} bps. No forced trades. Current gate: ${esc(p.research_gate||'NO_EDGE_CLAIM')}.</div></div>
        </div>
        <div class="card"><div class="card-title" style="font-size:1rem">Recent qualifying opportunities</div><div style="margin-top:10px">${opps.length?`<div class="table-wrap"><table class="market-table"><thead><tr><th class="left">Time</th><th>Side</th><th>Quality</th><th>Confidence</th><th>Score</th><th>1h</th><th>4h</th></tr></thead><tbody>${opps.slice().reverse().map(o=>`<tr><td class="left">${when(o.signal_time)}</td><td>${esc(o.decision||'—')}</td><td>${esc(o.entry_quality||'—')}</td><td>${fmt(o.confidence,1)}%</td><td>${fmt(o.directional_score,1)}</td><td>${fmt(o?.outcome_60m?.net_bps_after_6bps,2)}</td><td>${fmt(o?.outcome_240m?.net_bps_after_6bps,2)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No qualifying LONG/SHORT opportunity has been logged yet.</div>'}</div></div>
        <div class="card-meta" style="margin-top:12px">Updated ${when(p.generated_at)} · ${esc(p.status||'—')}. GC=F is a research proxy, not broker XAU/USD execution truth. Paper/live eligibility remains disabled.</div>`;
    }catch(err){root.innerHTML=`<div class="card-head"><div><div class="card-title">Gold Decision Engine</div><div class="card-meta">Read-only genuine-forward research</div></div><span class="badge warn">UNAVAILABLE</span></div><div class="empty">Gold decision feed unavailable: ${esc(err.message)}</div>`;}
  }
  load(); setInterval(load,30000);
})();
