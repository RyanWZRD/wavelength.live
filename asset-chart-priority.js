(()=>{
'use strict';
if(window.__wavelengthAssetChartPriority)return;
window.__wavelengthAssetChartPriority=true;

function pinPrimaryLayout(){
  const page=document.querySelector('.page.asset-shell')||document.querySelector('.asset-shell');
  const header=page?.querySelector(':scope > header.topbar')||document.querySelector('header.topbar');
  const price=document.getElementById('assetPriceSummary');
  const canvas=document.getElementById('priceChart');
  const chart=canvas?.closest('section.card');
  if(!page||!header||!price||!chart)return;
  if(header.nextElementSibling!==price)header.insertAdjacentElement('afterend',price);
  if(price.nextElementSibling!==chart)price.insertAdjacentElement('afterend',chart);
  price.dataset.assetPrimary='price';
  chart.dataset.assetPrimary='chart';
}

let queued=false;
function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;pinPrimaryLayout()});
}

function start(){
  pinPrimaryLayout();
  const page=document.querySelector('.page.asset-shell')||document.querySelector('.asset-shell')||document.body;
  new MutationObserver(schedule).observe(page,{childList:true,subtree:false});
  [100,300,750,1500,3000].forEach(ms=>setTimeout(pinPrimaryLayout,ms));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
