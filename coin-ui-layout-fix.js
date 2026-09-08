(()=>{
'use strict';
const LW=window.LightweightCharts;
if(LW?.createChart&&!LW.__wavelengthLayoutWrapped){
  LW.__wavelengthLayoutWrapped=true;
  const create=LW.createChart.bind(LW);
  LW.createChart=(container,options={})=>{
    if(getComputedStyle(container).position==='static')container.style.position='relative';
    const chart=create(container,{...options,rightPriceScale:{...(options.rightPriceScale||{}),minimumWidth:150},timeScale:{...(options.timeScale||{}),rightBarStaysOnScroll:true}});
    try{chart.priceScale('right').applyOptions({minimumWidth:150})}catch(e){console.warn('Wavelength price scale width',e)}

    const emaLabels=[];
    const originalAddSeries=chart.addSeries.bind(chart);
    function scheduleEmaLabels(){
      requestAnimationFrame(()=>requestAnimationFrame(renderEmaLabels));
    }
    function renderEmaLabels(){
      let scaleWidth=0;
      try{scaleWidth=chart.priceScale('right').width?.()||0}catch{}
      const maxY=Math.max(24,container.clientHeight-30);
      const active=[];
      for(const tag of emaLabels){
        if(!Number.isFinite(tag.value))continue;
        let y=null;try{y=tag.series.priceToCoordinate(tag.value)}catch{}
        if(y==null||!Number.isFinite(y))continue;
        active.push({...tag,y:Math.max(12,Math.min(maxY,y))});
      }
      active.sort((a,b)=>a.y-b.y);
      for(let i=1;i<active.length;i++)if(active[i].y-active[i-1].y<20)active[i].y=active[i-1].y+20;
      for(const tag of emaLabels){if(tag.el)tag.el.style.display='none'}
      for(const tag of active){
        if(!tag.el){
          tag.el=document.createElement('span');
          tag.el.className='wl-ema-axis-title';
          Object.assign(tag.el.style,{position:'absolute',zIndex:'12',pointerEvents:'none',padding:'2px 5px',borderRadius:'2px',font:"700 10px 'IBM Plex Mono',monospace",lineHeight:'16px',letterSpacing:'.02em',boxShadow:'0 0 0 1px rgba(0,0,0,.18)',whiteSpace:'nowrap'});
          container.appendChild(tag.el);
        }
        tag.el.textContent=tag.title;
        tag.el.style.background=tag.color;
        tag.el.style.color='#071018';
        tag.el.style.right=`${scaleWidth+6}px`;
        tag.el.style.top=`${tag.y}px`;
        tag.el.style.transform='translateY(-50%)';
        tag.el.style.display='block';
      }
    }
    chart.addSeries=(seriesType,seriesOptions={},paneIndex)=>{
      const originalTitle=String(seriesOptions?.title||'');
      const isEma=/^EMA(?:20|80|200)$/i.test(originalTitle);
      const series=originalAddSeries(seriesType,isEma?{...seriesOptions,title:''}:seriesOptions,paneIndex);
      if(isEma){
        const tag={series,title:originalTitle.toUpperCase(),color:seriesOptions.color||'#E8A33D',value:null,el:null};
        emaLabels.push(tag);
        const originalSetData=series.setData.bind(series);
        series.setData=data=>{
          originalSetData(data);
          const last=Array.isArray(data)?data.at(-1):null;
          tag.value=Number(last?.value??last?.close);
          scheduleEmaLabels();
        };
      }
      return series;
    };

    try{
      const api=chart.timeScale();
      const fit=api.fitContent.bind(api);
      api.fitContent=()=>{
        fit();
        requestAnimationFrame(()=>{
          try{
            const r=api.getVisibleLogicalRange?.();
            if(r&&Number.isFinite(r.from)&&Number.isFinite(r.to))api.setVisibleLogicalRange({from:r.from,to:r.to+24});
          }catch(e){console.warn('Wavelength future chart space',e)}
          scheduleEmaLabels();
        });
      };
      api.subscribeVisibleLogicalRangeChange?.(scheduleEmaLabels);
    }catch(e){console.warn('Wavelength chart range fallback',e)}
    try{new ResizeObserver(scheduleEmaLabels).observe(container)}catch{}
    return chart;
  };
}
function reorder(){
  const hero=document.querySelector('.coin-hero');
  const chart=document.querySelector('.chart-shell');
  const read=document.querySelector('#wavelengthRead');
  if(!hero||!chart)return;
  if(hero.nextElementSibling!==chart)hero.insertAdjacentElement('afterend',chart);
  if(read&&chart.nextElementSibling!==read)chart.insertAdjacentElement('afterend',read);
  const history=document.querySelector('#coinHistory');
  if(history&&read&&read.nextElementSibling!==history)read.insertAdjacentElement('afterend',history);
  const outcomes=document.querySelector('#coinOutcomeLineage');
  const anchor=history||read||chart;
  if(outcomes&&anchor&&anchor.nextElementSibling!==outcomes)anchor.insertAdjacentElement('afterend',outcomes);
}
function start(){
  reorder();
  const root=document.querySelector('.page')||document.body;
  new MutationObserver(reorder).observe(root,{childList:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
