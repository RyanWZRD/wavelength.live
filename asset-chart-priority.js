(()=>{
'use strict';
if(window.__wavelengthAssetChartPriority)return;
window.__wavelengthAssetChartPriority=true;

function pinChart(){
  const page=document.querySelector('.page.asset-shell')||document.querySelector('.asset-shell');
  const header=page?.querySelector(':scope > header.topbar')||document.querySelector('header.topbar');
  const canvas=document.getElementById('priceChart');
  const chart=canvas?.closest('section.card');
  if(!page||!header||!chart)return;
  const desired=header.nextElementSibling;
  if(desired!==chart)header.insertAdjacentElement('afterend',chart);
  chart.dataset.assetChartPriority='primary';
}

let queued=false;
function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;pinChart()});
}

function start(){
  pinChart();
  const page=document.querySelector('.page.asset-shell')||document.querySelector('.asset-shell')||document.body;
  new MutationObserver(schedule).observe(page,{childList:true,subtree:false});
  // Dynamic workstation modules can finish after DOMContentLoaded/shared-nav loaders.
  [100,300,750,1500,3000].forEach(ms=>setTimeout(pinChart,ms));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
