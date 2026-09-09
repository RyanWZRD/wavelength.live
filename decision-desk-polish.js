(()=>{'use strict';if(window.__wlDecisionDeskPolish)return;window.__wlDecisionDeskPolish=true;
const humanise=s=>String(s||'').replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g,m=>m.split('_').map((p,i)=>i? p : p.charAt(0).toUpperCase()+p.slice(1)).join(' '));
function symbolFrom(root){const h=root.querySelector('.dd-conclusion h3');if(!h)return'';const parts=(h.textContent||'').split('—');return(parts.at(-1)||'').trim().toUpperCase()}
function polish(){const root=document.getElementById('purchaseReport');if(!root)return;
const sym=symbolFrom(root);
for(const note of root.querySelectorAll('.dd-note')){if((note.textContent||'').startsWith('Not currently surfaced:')&&!note.dataset.surfacePolished){note.dataset.surfacePolished='1';note.innerHTML=`<strong>Why isn’t ${sym||'this asset'} surfaced?</strong> Strong evidence alone does not guarantee a place in today’s Opportunity Radar. Wavelength also requires the asset to satisfy the current opportunity and confirmation conditions. ${sym||'This asset'} has Decision Assurance coverage, but it did not qualify for today’s surfaced set, so no current Opportunity Score or confirmation stage is being assigned.`}}
for(const box of root.querySelectorAll('.dd-box')){const heading=box.querySelector('b')?.textContent?.trim();if(heading==='Portfolio effect'){const p=box.querySelector('p');if(p&&/^Entered portfolio value:\s*£0(?:\.0+)?\./.test(p.textContent||'')){p.innerHTML=`<strong>No portfolio entered yet.</strong><br>Wavelength can assess the ${sym||'asset'} thesis, but portfolio concentration cannot be evaluated until you add your holdings.<div class="dd-actions" style="margin-top:8px"><a class="wl-os-btn" href="portfolio-intelligence.html${sym?`?candidate=${encodeURIComponent(sym)}`:''}">Add portfolio</a></div>`}}}
const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const n of nodes){const next=humanise(n.nodeValue);if(next!==n.nodeValue)n.nodeValue=next}
}
const start=()=>{const root=document.getElementById('purchaseReport');if(!root)return;polish();let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish()})}).observe(root,{childList:true,subtree:true})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
