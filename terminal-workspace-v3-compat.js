(()=>{'use strict';
if(window.__wavelengthTerminalWorkspaceV3Compat)return;window.__wavelengthTerminalWorkspaceV3Compat=true;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function modal(title,body,onOpen){const d=document.createElement('div');d.className='wlv2-modal';d.innerHTML=`<div class="wlv2-modal-card"><div class="wlv2-modal-head"><b>${esc(title)}</b><span style="flex:1"></span><button data-close>ESC</button></div><div class="wlv2-modal-body">${body}</div></div>`;document.body.appendChild(d);d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-close]'))d.remove()});onOpen?.(d.querySelector('.wlv2-modal-card'));return d}
window.WavelengthTerminalV2=Object.assign(window.WavelengthTerminalV2||{},{modal});
})();