(()=>{
'use strict';
const VERSION='20260907-1453';
if(window.__wavelengthLiveMarketRepaintLoader)return;
window.__wavelengthLiveMarketRepaintLoader=true;
const s=document.createElement('script');
s.src=`live-market-repaint.js?v=${VERSION}`;
s.async=true;
s.dataset.wlLiveMarketRepaint='direct';
document.head.appendChild(s);
})();
