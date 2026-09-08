(()=>{
'use strict';
const LW=window.LightweightCharts;
if(LW?.createChart&&!LW.__wavelengthLayoutWrapped){
  LW.__wavelengthLayoutWrapped=true;
  const create=LW.createChart.bind(LW);
  LW.createChart=(container,options={})=>{
    const chart=create(container,{...options,timeScale:{...(options.timeScale||{}),rightBarStaysOnScroll:true}});
    try{
      const api=chart.timeScale();
      const fit=api.fitContent.bind(api);
      api.fitContent=()=>{
        fit();
        requestAnimationFrame(()=>{
          try{
            const r=api.getVisibleLogicalRange?.();
            if(!r||!Number.isFinite(r.from)||!Number.isFinite(r.to))return;
            api.setVisibleLogicalRange({from:r.from,to:r.to+24});
          }catch(e){console.warn('Wavelength future chart space',e)}
        });
      };
    }catch(e){console.warn('Wavelength chart range fallback',e)}
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
