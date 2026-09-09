(()=>{
'use strict';
if(window.WavelengthDecisionLearning)return;
const onReady=ev=>{
  const W=ev?.detail||window.WA;if(!W?.data)return;
  const q=W.q,e=W.e,n=W.n,h=W.h,gl=W.gl;
  const personal=Array.isArray(gl(W.K.decisions,[]))?gl(W.K.decisions,[]):[];
  const server=Array.isArray(W.data.journal?.records)?W.data.journal.records:[];
  const ts=x=>Date.parse(x||0);
  const outcomeOf=r=>{const o=r?.exact_outcomes||{};if(n(o['24h'])!=null)return{h:'24h',v:n(o['24h'])};if(n(o['4h'])!=null)return{h:'4h',v:n(o['4h'])};return null};
  const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
  const signed=v=>v==null?'—':`${v>=0?'+':''}${v.toFixed(2)}%`;
  const norm=s=>h(String(s||'').replace(/\b\d+(?:\.\d+)?x?\b/g,'#').replace(/\s+/g,' ').trim());
  function match(rec){
    const t=ts(rec.saved_at),sym=String(rec.symbol||'').toUpperCase();if(!t||!sym)return null;
    let best=null,dist=Infinity;
    for(const r of server){if(String(r.symbol||'').toUpperCase()!==sym)continue;const d=Math.abs(ts(r.at)-t);if(d<dist){dist=d;best=r}}
    if(!best||dist>6*3600000)return null;const o=outcomeOf(best);return o?{record:best,outcome:o,hours:dist/3600000}:null;
  }
  function process(rec){
    let score=0,parts=[];
    const es=n(rec.evidence_score);if(es!=null&&es>=80){score+=3;parts.push('strong frozen evidence')}else if(es!=null&&es>=65){score+=2;parts.push('usable frozen evidence')}else if(es!=null){score+=1;parts.push('thin frozen evidence')}
    const inv=String(rec.invalidation||'').trim();if(inv){score+=2;parts.push('explicit invalidation')}else parts.push('no saved invalidation');
    const cc=Array.isArray(rec.change_conditions)?rec.change_conditions:[];if(cc.length){score+=2;parts.push('change conditions saved')}
    const ob=Array.isArray(rec.objections)?rec.objections:[];if(ob.length){score+=1;parts.push('objections preserved')}
    if(rec.surfaced===false){parts.push('not forced into a surfaced ranking')}
    return{score,max:8,label:score>=6?'STRONG PROCESS':score>=4?'MIXED PROCESS':'WEAK PROCESS',cls:score>=6?'good':score>=4?'warn':'bad',parts};
  }
  function inject(){
    if(q('#decisionLearning'))return;
    const anchor=q('#evidenceReputation')?.closest('.dd-grid2')||q('#monthlyReport')?.closest('section');
    const html=`<section class="card" id="decisionLearning"><div class="card-head"><div><div class="wl-os-kicker">Decision Learning Engine</div><div class="card-title">Was the reasoning good — regardless of what happened next?</div><div class="card-meta">Frozen process + later observed outcomes · association, not prediction</div></div><span class="dd-chip" id="learningState">BUILDING</span></div><div class="dd-report-grid" id="learningKpis"></div><div class="dd-grid2" style="margin-top:12px"><div><div class="card-title">Process vs outcome</div><div class="card-meta">Separates disciplined reasoning from luck</div><div id="processOutcome" class="dd-list"></div></div><div><div class="card-title">Your recurring process patterns</div><div class="card-meta">What your frozen decisions repeatedly include or omit</div><div id="personalPatterns" class="dd-list"></div></div></div><div class="dd-grid2" style="margin-top:12px"><div><div class="card-title">Evidence family learning</div><div class="card-meta">Observed matched outcomes when a frozen support/objection was present</div><div id="evidenceLearning" class="dd-list"></div></div><div><div class="card-title">Objection learning</div><div class="card-meta">Which server-side objections have accompanied weaker or stronger later outcomes</div><div id="objectionLearning" class="dd-list"></div></div></div><div class="dd-grid2" style="margin-top:12px"><div><div class="card-title">Wait-for-confirmation test</div><div class="card-meta">Observed outcome cohorts by frozen server decision class</div><div id="confirmationLearning" class="dd-list"></div></div><div><div class="card-title">Learning maturity</div><div class="card-meta">What Wavelength can and cannot conclude yet</div><div id="learningMaturity" class="dd-list"></div></div></div></section>`;
    if(anchor)anchor.insertAdjacentHTML('afterend',html);else q('.dd-page footer')?.insertAdjacentHTML('beforebegin',html);
  }
  inject();
  const matched=personal.map(r=>({r,m:match(r),p:process(r)})).filter(x=>x.m);
  const resolvedServer=server.map(r=>({r,o:outcomeOf(r)})).filter(x=>x.o);
  const quadrants={goodGood:0,goodBad:0,badGood:0,badBad:0,mixed:0};
  for(const x of matched){const goodOutcome=x.m.outcome.v>=0;if(x.p.label==='STRONG PROCESS')quadrants[goodOutcome?'goodGood':'goodBad']++;else if(x.p.label==='WEAK PROCESS')quadrants[goodOutcome?'badGood':'badBad']++;else quadrants.mixed++}
  q('#learningKpis').innerHTML=`<div class="dd-report-stat"><span>Personal frozen decisions</span><b>${personal.length}</b></div><div class="dd-report-stat"><span>Matched server outcomes</span><b>${matched.length}</b></div><div class="dd-report-stat"><span>Strong-process decisions</span><b>${personal.filter(r=>process(r).label==='STRONG PROCESS').length}</b></div><div class="dd-report-stat"><span>Resolved server observations</span><b>${resolvedServer.length}</b></div>`;
  q('#processOutcome').innerHTML=matched.length?matched.slice(0,12).map(x=>{const v=x.m.outcome.v,good=v>=0,lab=x.p.label==='STRONG PROCESS'?(good?'GOOD PROCESS · POSITIVE OUTCOME':'GOOD PROCESS · NEGATIVE OUTCOME'):x.p.label==='WEAK PROCESS'?(good?'WEAK PROCESS · POSITIVE OUTCOME':'WEAK PROCESS · NEGATIVE OUTCOME'):`MIXED PROCESS · ${good?'POSITIVE':'NEGATIVE'} OUTCOME`;return`<div class="dd-row"><div class="dd-row-head"><div><b>${e(x.r.symbol)} · ${e(lab)}</b><p>${e(x.p.parts.join(' · '))}</p><div class="dd-meta">Process ${x.p.score}/${x.p.max} · matched server ${e(x.m.outcome.h)} ${signed(v)} · nearest frozen server observation ${x.m.hours.toFixed(1)}h away</div></div><span class="dd-chip ${x.p.cls}">${e(x.p.label)}</span></div></div>`}).join(''):'<div class="dd-empty">No personal decision can yet be paired with a nearby resolved server observation. Wavelength will not invent an outcome.</div>';
  const total=personal.length||1,hasInv=personal.filter(r=>String(r.invalidation||'').trim()).length,hasCond=personal.filter(r=>Array.isArray(r.change_conditions)&&r.change_conditions.length).length,hasObj=personal.filter(r=>Array.isArray(r.objections)&&r.objections.length).length,strongCount=personal.filter(r=>process(r).label==='STRONG PROCESS').length;
  const patterns=[['Explicit invalidation saved',hasInv],['Change conditions saved',hasCond],['Objections preserved',hasObj],['Strong-process rubric',strongCount]];
  q('#personalPatterns').innerHTML=personal.length?patterns.map(([lab,c])=>`<div class="dd-row"><b>${e(lab)}</b><p>${c} of ${personal.length} decisions · ${(100*c/total).toFixed(0)}%</p></div>`).join('')+'<div class="dd-note">These are process-completeness observations, not claims that one behaviour causes better returns.</div>':'<div class="dd-empty">Save decisions in Purchase Decision Mode to begin building a personal process history.</div>';
  const fam=new Map();
  for(const x of matched){for(const kind of ['support','objections'])for(const raw of Array.isArray(x.r[kind])?x.r[kind]:[]){const k=`${kind}:${h(raw)}`,z=fam.get(k)||{kind,name:h(raw),vals:[]};z.vals.push(x.m.outcome.v);fam.set(k,z)}}
  const famRows=[...fam.values()].sort((a,b)=>b.vals.length-a.vals.length||Math.abs(avg(b.vals)||0)-Math.abs(avg(a.vals)||0));
  q('#evidenceLearning').innerHTML=famRows.length?famRows.slice(0,10).map(z=>`<div class="dd-row"><b>${e(z.name)}</b> <span class="dd-chip ${z.kind==='support'?'good':'warn'}">${z.kind.toUpperCase()}</span><p>Observed in ${z.vals.length} matched personal decision${z.vals.length===1?'':'s'} · average matched outcome ${signed(avg(z.vals))}</p><div class="dd-meta">Small-sample association only; no predictive weight is assigned.</div></div>`).join(''):'<div class="dd-empty">Not enough matched personal decisions yet to compare evidence families.</div>';
  const obs=new Map();
  for(const {r,o} of resolvedServer){for(const raw of Array.isArray(r.against)?r.against:[]){const k=norm(raw),z=obs.get(k)||{name:k,vals:[]};z.vals.push(o.v);obs.set(k,z)}}
  const obsRows=[...obs.values()].filter(z=>z.vals.length>=3).sort((a,b)=>b.vals.length-a.vals.length).slice(0,10);
  q('#objectionLearning').innerHTML=obsRows.length?obsRows.map(z=>`<div class="dd-row"><b>${e(z.name)}</b><p>${z.vals.length} resolved observations · average later outcome ${signed(avg(z.vals))}</p><div class="dd-meta">Descriptive cohort only; repeated objection text has been normalised to reduce numeric noise.</div></div>`).join(''):'<div class="dd-empty">No objection cohort has enough resolved observations yet.</div>';
  const byDecision=new Map();
  for(const {r,o} of resolvedServer){const k=String(r.decision||'UNKNOWN').toUpperCase(),z=byDecision.get(k)||[];z.push(o.v);byDecision.set(k,z)}
  const classes=['QUALIFIED','WATCH','REJECT'].filter(k=>byDecision.has(k));
  q('#confirmationLearning').innerHTML=classes.length?classes.map(k=>{const vals=byDecision.get(k),pos=vals.filter(v=>v>0).length;return`<div class="dd-row"><b>${e(k)}</b><p>${vals.length} resolved observations · average ${signed(avg(vals))} · positive ${((100*pos/vals.length)||0).toFixed(0)}%</p></div>`}).join('')+'<div class="dd-note">This tests whether stronger frozen confirmation states have differed in observed outcomes. It does not prove that waiting causes a better result.</div>':'<div class="dd-empty">Confirmation cohorts are not yet resolved.</div>';
  const minPersonal=12,minFamily=6,personalReady=matched.length>=minPersonal,familyReady=famRows.some(z=>z.vals.length>=minFamily),serverReady=resolvedServer.length>=50;
  q('#learningMaturity').innerHTML=`<div class="dd-row"><b>Personal process learning</b><p>${matched.length}/${minPersonal} matched decisions · ${personalReady?'usable descriptive sample':'collecting'}</p></div><div class="dd-row"><b>Evidence-family learning</b><p>${familyReady?'At least one family has a usable descriptive sample':'No family has '+minFamily+' matched decisions yet'}</p></div><div class="dd-row"><b>Server cohort learning</b><p>${resolvedServer.length} resolved observations · ${serverReady?'descriptive comparisons available':'collecting'}</p></div><div class="dd-note">Wavelength will not turn these cohorts into probabilities, causal claims or automatic strategy changes. Good process can still produce a bad outcome; weak process can still get lucky.</div>`;
  q('#learningState').textContent=matched.length?'LEARNING · DESCRIPTIVE':'COLLECTING';q('#learningState').className='dd-chip '+(matched.length?'good':'warn');
  window.WavelengthDecisionLearning={matched,quadrants,process,match};
};
window.addEventListener('wavelength:ambition-ready',onReady,{once:true});
if(window.WA?.data)onReady({detail:window.WA});
})();
