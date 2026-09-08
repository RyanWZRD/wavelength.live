(()=>{
'use strict';
if(window.__wavelengthAssetChartPresentationV1)return;
window.__wavelengthAssetChartPresentationV1=true;

const signalLabels=new Set(['STRONG','CANDIDATE','WEAK','MIXED','DECISION']);
const proto=window.CanvasRenderingContext2D&&CanvasRenderingContext2D.prototype;
if(!proto)return;

const originalClearRect=proto.clearRect;
const originalFillText=proto.fillText;
const originalBeginPath=proto.beginPath;
const originalMoveTo=proto.moveTo;
const originalLineTo=proto.lineTo;
const originalStroke=proto.stroke;

proto.clearRect=function(...args){
  if(this.canvas?.id==='livePriceChart'){
    this.__wlSignalLabelPositions=[];
    this.__wlLastPathPoint=null;
  }
  return originalClearRect.apply(this,args);
};

proto.beginPath=function(...args){
  if(this.canvas?.id==='livePriceChart')this.__wlLastPathPoint=null;
  return originalBeginPath.apply(this,args);
};
proto.moveTo=function(x,y){
  if(this.canvas?.id==='livePriceChart')this.__wlLastPathPoint={x:Number(x),y:Number(y)};
  return originalMoveTo.call(this,x,y);
};
proto.lineTo=function(x,y){
  if(this.canvas?.id==='livePriceChart')this.__wlLastPathPoint={x:Number(x),y:Number(y)};
  return originalLineTo.call(this,x,y);
};

function isEmaBlue(style){
  const s=String(style||'').toLowerCase().replace(/\s+/g,'');
  return s==='#60a5fa'||s==='rgb(96,165,250)'||s==='rgba(96,165,250,1)';
}

proto.stroke=function(...args){
  const isAsset=this.canvas?.id==='livePriceChart';
  const p=isAsset&&this.__wlLastPathPoint?{...this.__wlLastPathPoint}:null;
  const ema=isAsset&&p&&isEmaBlue(this.strokeStyle);
  const result=originalStroke.apply(this,args);
  if(ema&&Number.isFinite(p.x)&&Number.isFinite(p.y)){
    const w=this.canvas.clientWidth||this.canvas.width||0;
    const x=Math.max(12,Math.min(w-150,p.x+8));
    const y=Math.max(18,p.y-10);
    this.save();
    this.globalAlpha=1;
    this.font="700 10px 'IBM Plex Mono',monospace";
    const tw=this.measureText('EMA20').width;
    this.fillStyle='#60a5fa';
    this.fillRect(x,y-12,tw+10,18);
    this.fillStyle='#071018';
    originalFillText.call(this,'EMA20',x+5,y+1);
    this.restore();
  }
  return result;
};

proto.fillText=function(text,x,y,maxWidth){
  if(this.canvas?.id!=='livePriceChart'||!signalLabels.has(String(text))){
    return arguments.length>3?originalFillText.call(this,text,x,y,maxWidth):originalFillText.call(this,text,x,y);
  }

  const positions=this.__wlSignalLabelPositions||(this.__wlSignalLabelPositions=[]);
  const width=this.measureText(String(text)).width;
  let drawX=Number(x)||0;
  let drawY=Number(y)||0;
  const clientWidth=this.canvas.clientWidth||this.canvas.width||0;

  if(clientWidth&&drawX+width>clientWidth-104) drawX=Math.max(12,drawX-width-18);

  const collides=positions.some(p=>Math.abs(drawX-p.x)<Math.max(78,(width+p.width)/2+18)&&Math.abs(drawY-p.y)<26);
  if(collides)return;

  positions.push({x:drawX,y:drawY,width});
  if(positions.length>24)positions.shift();
  return arguments.length>3?originalFillText.call(this,text,drawX,drawY,maxWidth):originalFillText.call(this,text,drawX,drawY);
};
})();
