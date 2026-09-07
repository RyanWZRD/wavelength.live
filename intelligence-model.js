(function(root){
'use strict';
const MODEL='WAVELENGTH_INTELLIGENCE_V1', VERSION=1;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function score(x){
  let s=0;
  if(x.ema20!=null&&x.ema80!=null&&x.ema20>x.ema80)s+=20;
  if(x.close!=null&&x.ema200!=null&&x.close>x.ema200)s+=20;
  if(x.rsi!=null&&x.rsi>=50&&x.rsi<=75)s+=20;
  if(x.adx!=null&&x.adx>=35)s+=20;
  if(x.volumeRatio!=null&&x.volumeRatio>=1)s+=10;
  if((x.vsBtc30??0)>5)s+=8; else if((x.vsBtc30??0)>0)s+=4;
  if((x.d90??0)>20)s+=5;
  if(x.volumeRatio!=null&&x.volumeRatio>=1.25)s+=5;
  if(x.atrPct!=null&&x.atrPct>7)s-=8;
  if(x.rsi!=null&&x.rsi>75)s-=8;
  return clamp(Math.round(s),0,100);
}
const api={MODEL,VERSION,score};
root.WavelengthIntelligence=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

/*
 * Markets startup render governor.
 * app.js intentionally calculates each market independently, but its scan loop
 * also re-renders the entire 40-row scanner after every completed coin. With
 * parallel workers that can mean dozens of DOM replacements during the first
 * few seconds, causing visible row reordering, scrollbar movement and text
 * flicker. Keep the first populated table visible, coalesce startup rebuilds,
 * then apply the latest complete snapshot once. Live tick updates use
 * textContent and are therefore unaffected.
 */
(()=>{
'use strict';
if(window.__wavelengthMarketRenderGovernor)return;
window.__wavelengthMarketRenderGovernor=true;

const proto=Element.prototype;
const descriptor=Object.getOwnPropertyDescriptor(proto,'innerHTML');
if(!descriptor?.get||!descriptor?.set||descriptor.configurable===false)return;

const originalGet=descriptor.get;
const originalSet=descriptor.set;
let startupLocked=false;
let startupFinished=false;
let pendingHTML=null;
let releaseTimer=null;

function release(target){
  if(startupFinished)return;
  startupFinished=true;
  startupLocked=false;
  if(releaseTimer){clearTimeout(releaseTimer);releaseTimer=null;}
  if(pendingHTML!=null&&target?.isConnected){
    const html=pendingHTML;
    pendingHTML=null;
    originalSet.call(target,html);
  }
}

Object.defineProperty(proto,'innerHTML',{
  configurable:descriptor.configurable,
  enumerable:descriptor.enumerable,
  get:originalGet,
  set(value){
    if(this?.id==='marketBody'&&!startupFinished&&typeof value==='string'&&value.includes('class="market-row"')){
      if(!startupLocked){
        startupLocked=true;
        originalSet.call(this,value);
        releaseTimer=setTimeout(()=>release(this),6500);
        return;
      }
      pendingHTML=value;
      return;
    }
    return originalSet.call(this,value);
  }
});
})();
