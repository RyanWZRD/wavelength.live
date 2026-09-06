(()=>{
'use strict';
const WORKFLOW_URL='https://github.com/RyanWZRD/wavelength.bot/actions/workflows/manual-candidate-v3-paper-close.yml';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(managed,meta=''){
  const panel=document.querySelector('#autoPaperPanel');
  if(!panel)return;
  let box=document.querySelector('#manualV3CloseControl');
  if(!box){
    box=document.createElement('div');
    box.id='manualV3CloseControl';
    box.style.cssText='margin-top:14px;padding-top:14px;border-top:1px solid var(--border2);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap';
    panel.appendChild(box);
  }
  box.innerHTML=`<div><div style="font:700 .75rem var(--mono);color:${managed?'var(--loss)':'var(--dim)'}">${managed?'MANUAL EXIT AVAILABLE':'MANUAL EXIT STANDBY'}</div><div class="card-meta" style="margin-top:5px;max-width:720px">${managed?'Candidate V3 has a managed Alpaca PAPER position. Manual close is recorded as MANUAL_USER_CLOSE and excluded from strategy-graduation evidence.':'No managed Candidate V3 PAPER position is currently reported.'}${meta?` · ${esc(meta)}`:''}</div></div><button class="pill-btn" id="manualV3CloseBtn" ${managed?'':'disabled'} style="${managed?'border-color:rgba(244,87,79,.45);color:var(--loss);background:var(--lossSoft)':'opacity:.45;cursor:not-allowed'}">Close V3 PAPER position</button>`;
  const btn=document.querySelector('#manualV3CloseBtn');
  if(managed&&btn)btn.addEventListener('click',()=>{
    const ok=window.confirm('Close the current Candidate V3 Alpaca PAPER position?\n\nThis is a manual intervention. Wavelength will record MANUAL_USER_CLOSE, submit a PAPER market exit, verify the broker is flat, and remove any orphan protective stop. It will not count as an autonomous strategy exit.');
    if(!ok)return;
    window.open(WORKFLOW_URL,'_blank','noopener,noreferrer');
  });
}
async function install(){
  try{
    const r=await fetch(`paper-ops-status.json?t=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`status ${r.status}`);
    const d=await r.json();
    render(d.candidate_v3_managed===true,d.generated_at?`status ${new Date(d.generated_at).toLocaleString()}`:'');
  }catch(e){
    console.warn('Manual V3 close status unavailable',e);
    render(false,'status feed unavailable');
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
setInterval(install,60000);
})();
