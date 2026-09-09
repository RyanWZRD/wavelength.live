(()=>{
'use strict';
if(window.WavelengthScenarioLab)return;
const STORE='wavelength_scenario_runs_v1';
function boot(ev){
  const W=ev?.detail||window.WA;if(!W?.data)return;
  const {q,e,n,h,gl,sl}=W;
  const policy=()=>({minEvidence:70,minProviders:3,rejectStale:true,requireInvalidation:true,maxConcentration:25,...gl(W.K.policy,{})});
  const rows=()=>{try{const x=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
  const saveRows=x=>localStorage.setItem(STORE,JSON.stringify(x.slice(0,50)));
  const holdings=()=>{const x=gl(W.K.holdings,[]);return Array.isArray(x)?x:[]};
  const hv=z=>n(z?.value??z?.amount??z?.current_value??z?.market_value)??0;
  const hs=z=>String(z?.symbol??z?.asset??z?.coin??'').toUpperCase();
  const fam=z=>String(z?.dimension??z?.name??'').toLowerCase();
  const label=s=>h(String(s||'').replace(/_/g,' '));
  function inject(){
    if(q('#scenarioLab'))return;
    const anchor=q('#decisionLearning')||q('#monthlyReport')?.closest('section');
    const html=`<section class="card" id="scenarioLab"><div class="card-head"><div><div class="wl-os-kicker">Scenario Lab</div><div class="card-title">What breaks first if the world stops cooperating?</div><div class="card-meta">Assumption stress · policy survival · no price targets · no probability forecasts</div></div><span class="dd-chip" id="scenarioState">READY</span></div><div class="dd-controls"><div class="dd-field"><label>Asset</label><select id="scenarioSymbol"></select></div><div class="dd-field"><label>Planned amount (£)</label><input id="scenarioAmount" type="number" min="1" step="50" value="500"></div><button class="wl-os-btn primary" id="scenarioRun">Run all stresses</button><button class="wl-os-btn" id="scenarioSave">Save snapshot</button></div><div id="scenarioBase" class="dd-list"></div><div class="dd-grid3" id="scenarioGrid" style="margin-top:12px"></div><div class="dd-grid2" style="margin-top:12px"><div><div class="card-title">Combined failure chain</div><div class="card-meta">How multiple stresses interact with the current thesis</div><div id="scenarioCompound" class="dd-list"></div></div><div><div class="card-title">Saved scenario memory</div><div class="card-meta">Frozen stress snapshots for later comparison</div><div id="scenarioMemory" class="dd-list"></div></div></div></section>`;
    if(anchor)anchor.insertAdjacentHTML('afterend',html);else q('.dd-page footer')?.insertAdjacentHTML('beforebegin',html);
  }
  function concentration(sym,planned){const hsx=holdings(),tot=hsx.reduce((s,z)=>s+hv(z),0),cur=hsx.filter(z=>hs(z)===sym).reduce((s,z)=>s+hv(z),0),post=tot+planned;return post>0?(cur+planned)/post*100:null}
  function scenario(x,type,planned){
    const p=policy(),supports=W.supports(x.a),risks=W.risks(x.a),all=[...supports,...risks],affected=new Set(),introduced=[],providerLoss=0,notes=[];
    const hit=(names,state='STALE')=>{for(const z of all){const f=fam(z);if(names.some(k=>f.includes(k))){affected.add(f);introduced.push({family:f,state})}}};
    if(type==='REGIME'){hit(['market_context','macro_context']);notes.push('Market and macro context deteriorate together.');}
    if(type==='LIQUIDITY'){hit(['liquidity','stablecoin_liquidity']);providerLoss=Math.min(1,x.providers);notes.push('Liquidity support deteriorates and stablecoin-liquidity confirmation weakens.');}
    if(type==='CATALYST'){hit(['event_catalyst']);notes.push('The event/catalyst case fails to corroborate or loses availability.');}
    if(type==='EVIDENCE_DECAY'){for(const z of supports.slice(0,3)){affected.add(fam(z));introduced.push({family:fam(z),state:'STALE'})}providerLoss=Math.min(2,x.providers);notes.push('Three leading support families age without fresh corroboration.');}
    if(type==='CONCENTRATION'){notes.push('Only portfolio concentration is stressed; market evidence is held unchanged.');}
    if(type==='COMBINED'){hit(['market_context','macro_context','liquidity','stablecoin_liquidity','event_catalyst']);for(const z of supports.slice(0,2)){affected.add(fam(z));introduced.push({family:fam(z),state:'STALE'})}providerLoss=Math.min(2,x.providers);notes.push('Regime, liquidity, catalyst and evidence-decay stresses occur together.');}
    const postProviders=Math.max(0,x.providers-providerLoss),conc=concentration(x.sym,planned),stale=introduced.some(z=>['STALE','MISSING','UNAVAILABLE'].includes(z.state));
    const inv=String(x.a?.counterfactual?.thesis_invalidation||'').trim().toLowerCase();
    const invHits=[...affected].filter(f=>inv.includes(f.replace(/_/g,' '))||inv.includes(f)).length;
    const checks=[];
    checks.push({name:'Evidence quality',state:type==='CONCENTRATION'?(x.e!=null&&x.e>=p.minEvidence?'PASS':'BREACH'):'UNKNOWN',detail:type==='CONCENTRATION'?`${x.e==null?'—':x.e.toFixed(1)} / minimum ${p.minEvidence}`:'Hypothetical evidence score is not fabricated.'});
    checks.push({name:'Independent providers',state:postProviders>=p.minProviders?'PASS':'BREACH',detail:`${postProviders} projected available / minimum ${p.minProviders}`});
    if(p.rejectStale)checks.push({name:'Stale/missing dependencies',state:stale?'BREACH':'PASS',detail:stale?'Stress introduces a stale/unavailable material dependency.':'No new stale dependency introduced.'});
    if(p.requireInvalidation)checks.push({name:'Published invalidation',state:inv?'PASS':'BREACH',detail:inv?(invHits?`${invHits} invalidation-linked evidence famil${invHits===1?'y':'ies'} stressed; reassessment required.`:'Explicit invalidation exists; this stress does not directly match its named evidence.'):'No explicit invalidation published.'});
    if(conc!=null)checks.push({name:'Planned concentration',state:conc<=p.maxConcentration?'PASS':'BREACH',detail:`${conc.toFixed(1)}% post-plan / maximum ${p.maxConcentration}%`});
    const breaches=checks.filter(c=>c.state==='BREACH').length,unknown=checks.filter(c=>c.state==='UNKNOWN').length;
    const supportHit=supports.filter(z=>affected.has(fam(z))).map(z=>label(z.dimension||z.name));
    const status=breaches?'BREACH':(invHits||unknown?'REASSESS':'SURVIVES');
    return{type,status,breaches,unknown,checks,affected:[...affected],supportHit,postProviders,conc,notes,invHits};
  }
  const chip=s=>s==='SURVIVES'?'good':s==='BREACH'?'bad':'warn';
  function card(r){return`<div class="dd-row"><div class="dd-row-head"><div><b>${e(label(r.type))}</b><p>${e(r.notes.join(' '))}</p></div><span class="dd-chip ${chip(r.status)}">${r.status}</span></div><div class="dd-meta">Affected families: ${r.affected.length?r.affected.map(label).join(', '):'none'} · projected providers ${r.postProviders}${r.conc==null?'':` · concentration ${r.conc.toFixed(1)}%`}</div>${r.supportHit.length?`<p><strong>Current support impaired:</strong> ${e(r.supportHit.join(', '))}</p>`:''}<div class="dd-list">${r.checks.map(c=>`<div class="dd-note"><span class="dd-chip ${c.state==='PASS'?'good':c.state==='BREACH'?'bad':'warn'}">${c.state}</span> <strong>${e(c.name)}</strong> · ${e(c.detail)}</div>`).join('')}</div></div>`}
  function memory(){const z=rows();q('#scenarioMemory').innerHTML=z.length?z.slice(0,8).map(r=>`<div class="dd-row"><b>${e(r.symbol)} · £${Number(r.planned||0).toLocaleString()} · ${e(r.overall)}</b><p>${new Date(r.saved_at).toLocaleString()} · ${r.breaches} explicit policy breach${r.breaches===1?'':'es'} · ${r.reassess} reassessment stress${r.reassess===1?'':'es'}</p><div class="dd-meta">Frozen scenario snapshot; current evidence is not backfilled into it.</div></div>`).join(''):'<div class="dd-empty">No saved scenario snapshots yet.</div>'}
  function run(){
    const sym=String(q('#scenarioSymbol').value||'').toUpperCase(),planned=Math.max(0,n(q('#scenarioAmount').value)||0),x=W.current(sym);if(!x?.a)return;
    const p=policy(),sup=W.supports(x.a),ris=W.risks(x.a),conc=concentration(sym,planned);
    q('#scenarioBase').innerHTML=`<div class="dd-conclusion"><h3>${e(sym)} · £${planned.toLocaleString()} scenario baseline</h3><p>Current evidence ${e(x.g)} ${x.e==null?'—':x.e.toFixed(1)}/100 · ${x.providers} independent providers · ${sup.length} leading support families · ${ris.length} published fragile/negative families.</p><div class="dd-meta">Post-plan concentration ${conc==null?'unknown — no entered portfolio':conc.toFixed(1)+'%'} · policy max ${p.maxConcentration}% · opportunity ${x.r?`DQ #${x.r.rank}`:'not currently ranked'}</div></div>`;
    const types=['REGIME','LIQUIDITY','CATALYST','EVIDENCE_DECAY','CONCENTRATION'],out=types.map(t=>scenario(x,t,planned));q('#scenarioGrid').innerHTML=out.map(card).join('');
    const combined=scenario(x,'COMBINED',planned);q('#scenarioCompound').innerHTML=card(combined)+`<div class="dd-note">Scenario Lab changes assumptions, not prices. A BREACH means an explicit personal-policy rule fails under the stated stress. REASSESS means the thesis becomes materially uncertain or an invalidation-linked dependency is stressed. It is not a forecast.</div>`;
    const all=[...out,combined],breaches=all.filter(r=>r.status==='BREACH').length,reassess=all.filter(r=>r.status==='REASSESS').length,overall=breaches?'FRAGILE UNDER STRESS':reassess?'REQUIRES REASSESSMENT':'SURVIVES STATED STRESSES';
    q('#scenarioState').textContent=overall;q('#scenarioState').className='dd-chip '+(breaches?'bad':reassess?'warn':'good');window.WavelengthScenarioLab.last={symbol:sym,planned,overall,breaches,reassess,scenarios:all,base:{evidence:x.e,grade:x.g,providers:x.providers,concentration:conc},saved_at:null};
  }
  function save(){run();const z=window.WavelengthScenarioLab.last;if(!z)return;const frozen={...z,saved_at:new Date().toISOString()};saveRows([frozen,...rows()]);memory();q('#scenarioState').textContent='SNAPSHOT SAVED'}
  inject();const syms=[...W.data.assetMap.keys()].sort();q('#scenarioSymbol').innerHTML=syms.map(s=>`<option value="${e(s)}">${e(s)}</option>`).join('');const initial=q('#thesisSymbol')?.value||q('#buySymbol')?.value||W.watch()[0]||syms[0];if(initial)q('#scenarioSymbol').value=String(initial).toUpperCase();if(q('#buyAmount')?.value)q('#scenarioAmount').value=q('#buyAmount').value;q('#scenarioRun').onclick=run;q('#scenarioSave').onclick=save;window.addEventListener('wavelength:ambition-selection',ev=>{if(ev.detail?.sym){q('#scenarioSymbol').value=ev.detail.sym;run()}});memory();run();
}
window.WavelengthScenarioLab={last:null};window.addEventListener('wavelength:ambition-ready',boot,{once:true});if(window.WA?.data)boot({detail:window.WA});
})();
