(()=>{
const nav=document.querySelector('.nav');if(!nav)return;
const p=(location.pathname.split('/').pop()||'index.html').toLowerCase();
const items=[['index.html','Overview'],['index.html#markets','Markets'],['index.html#intelligence','Intelligence'],['learning.html','Learning'],['paper.html','Paper P&L'],['research.html','Research'],['strategies.html','Strategies'],['bot.html','Bot']];
nav.innerHTML=items.map(([h,l])=>{const base=h.split('#')[0],active=(p===base||(!p&&base==='index.html'))&&!h.includes('#');return `<a${active?' class="active"':''} href="${h}">${l}</a>`}).join('');
const top=document.querySelector('.topbar');if(top&&!document.querySelector('.strategy-boundary')){const b=document.createElement('span');b.className='strategy-boundary badge warn';b.textContent='1H RADAR ≠ 4H STRATEGY';b.title='Hourly radar is research prioritisation only. Candidate V3 and the wider-market paper engine make decisions from their own closed 4-hour rules.';top.appendChild(b)}
window.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('.metric,.ev-kpi,.analysis-row,.pro-kpi').forEach(el=>{if(!el.title)el.title='Metric source/timeframe may differ. See Research → Data provenance for the evidence path and freshness.'})});
})();
