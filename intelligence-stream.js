(()=>{
const $=s=>document.querySelector(s),esc=s=>String(s??'—').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
let lastSource=null;
function ago(ts){if(!ts)return '—';const d=(Date.now()-new Date(ts).getTime())/1000;if(d<60)return `${Math.max(0,Math.floor(d))}s ago`;if(d<3600)return `${Math.floor(d/60)}m ago`;return `${Math.floor(d/3600)}h ago`}
function icon(k){return ({TOP_CHANGED:'★',VERDICT_CHANGED:'◆',RANK_MOVE:'↕',CONVICTION_MOVE:'◉',ROBUSTNESS_MOVE:'⬡',TIMEFRAME_SHIFT:'≋',EVIDENCE_GAP_CHANGE:'▦',BASELINE:'◎'})[k]||'•'}
function render(d){const root=$('#intelligenceStream');if(!root)return;const events=d.events||[],cycle=d.current_cycle_events||[];const latest=events.slice(0,18);const active=cycle.length;
 $('#thoughtState').textContent=active?`${active} MATERIAL CHANGE${active===1?'':'S'}`:'MARKET OBSERVED • NO MATERIAL CHANGE';
 $('#thoughtTime').textContent=`Evidence cycle ${ago(d.source_generated_at||d.generated_at)}`;
 root.innerHTML=latest.map((e,i)=>`<a class="thought ${e.severity==='HIGH'?'hot':''}" href="${e.symbol?`conviction-room.html?symbol=${encodeURIComponent(e.symbol)}`:'#'}"><div class="thought-icon">${icon(e.kind)}</div><div class="thought-copy"><b>${esc(e.headline)}</b><div>${esc(e.detail)}</div><small>${esc(e.kind.replaceAll('_',' '))} • ${ago(e.at)} • ${esc(e.evidence_policy||'observed')}</small></div>${i===0?'<span class="live-dot"></span>':''}</a>`).join('')||'<div class="empty">No intelligence transitions recorded yet.</div>';
 const stages=['OBSERVE','RANK','CHALLENGE','COMPARE','WATCH'];$('#thinkingStages').innerHTML=stages.map((x,i)=>`<span class="think-stage ${i===((new Date(d.generated_at||0).getMinutes())%stages.length)?'active':''}">${x}</span>`).join('');
}
async function poll(){try{const r=await fetch('intelligence-stream.json?'+Date.now());if(!r.ok)throw 0;const d=await r.json();render(d);if(lastSource&&lastSource!==d.source_generated_at){const el=$('#thoughtPulse');el?.classList.add('flash');setTimeout(()=>el?.classList.remove('flash'),1200)}lastSource=d.source_generated_at}catch(e){const root=$('#intelligenceStream');if(root)root.innerHTML='<div class="empty">Intelligence stream unavailable.</div>'}}
window.addEventListener('DOMContentLoaded',()=>{poll();setInterval(poll,60000)});
})();