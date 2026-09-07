(()=>{
'use strict';
if(window.__wavelengthAssetChartPresentationV1)return;
window.__wavelengthAssetChartPresentationV1=true;

const signalLabels=new Set(['STRONG','CANDIDATE','WEAK','MIXED','DECISION']);
const proto=window.CanvasRenderingContext2D&&CanvasRenderingContext2D.prototype;
if(!proto)return;

const originalClearRect=proto.clearRect;
const originalFillText=proto.fillText;

proto.clearRect=function(...args){
  if(this.canvas?.id==='livePriceChart') this.__wlSignalLabelPositions=[];
  return originalClearRect.apply(this,args);
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

  // Keep labels away from the live-price scale on the right edge.
  if(clientWidth&&drawX+width>clientWidth-104) drawX=Math.max(12,drawX-width-18);

  // One readable label per collision cluster; triangles remain visible for every event.
  const collides=positions.some(p=>Math.abs(drawX-p.x)<Math.max(78,(width+p.width)/2+18)&&Math.abs(drawY-p.y)<26);
  if(collides)return;

  positions.push({x:drawX,y:drawY,width});
  if(positions.length>24)positions.shift();
  return arguments.length>3?originalFillText.call(this,text,drawX,drawY,maxWidth):originalFillText.call(this,text,drawX,drawY);
};
})();
