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
