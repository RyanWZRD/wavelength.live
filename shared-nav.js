(()=>{
const nav=document.querySelector('.nav');if(!nav)return;
const p=(location.pathname.split('/').pop()||'index.html').toLowerCase();
const items=[['index.html','Overview'],['index.html#markets','Markets'],['index.html#intelligence','Intelligence'],['learning.html','Learning'],['paper.html','Paper P&L'],['research.html','Research'],['outcomes.html','Outcomes'],['governance.html','Governance'],['compare.html','Compare'],['mobile.html','Mobile'],['strategies.html','Strategies'],['bot.html','Bot']];
nav.innerHTML=items.map(([h,l])=>{const base=h.split('#')[0],active=(p===base||(!p&&base==='index.html'))&&!h.includes('#');return `<a${active?' class="active"':''} href="${h}">${l}</a>`}).join('');
const top=document.querySelector('.topbar');if(top&&!document.querySelector('.strategy-boundary')){const b=document.createElement('span');b.className='strategy-boundary badge warn';b.textContent='1H RADAR ≠ 4H STRATEGY';b.title='Hourly radar is research prioritisation only. Candidate V3 and the wider-market paper engine make decisions from their own closed 4-hour rules.';top.appendChild(b)}
window.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('.metric,.ev-kpi,.analysis-row,.pro-kpi').forEach(el=>{if(!el.title)el.title='Metric source/timeframe may differ. See Research / Governance for evidence provenance, maturity and research locks.'})});
if(!document.querySelector('script[data-wl-terminal]')){const s=document.createElement('script');s.src='terminal-ui.js';s.defer=true;s.dataset.wlTerminal='1';document.head.appendChild(s)}
if(!document.querySelector('script[data-wl-final]')){const s=document.createElement('script');s.src='final-ui.js';s.defer=true;s.dataset.wlFinal='1';document.head.appendChild(s)}
if((p==='index.html'||!p)&&!document.querySelector('script[data-wl-observation]')){const s=document.createElement('script');s.src='observation-experience.js';s.defer=true;s.dataset.wlObservation='1';document.head.appendChild(s)}
})();
