(()=>{
'use strict';
const LW=window.LightweightCharts;
if(LW?.createChart&&!LW.__wavelengthLayoutWrapped){
  LW.__wavelengthLayoutWrapped=true;
  const create=LW.createChart.bind(LW);
  LW.createChart=(container,options={})=>{
    const chart=create(container,{...options,timeScale:{...(options.timeScale||{}),rightOffset:12,rightBarStaysOnScroll:true}});
    try{
      const api=chart.timeScale();
      const fit=api.fitContent.bind(api);
      api.fitContent=()=>{fit();api.applyOptions({rightOffset:12,rightBarStaysOnScroll:true})};
      const originalTimeScale=chart.timeScale.bind(chart);
      try{chart.timeScale=()=>api}catch{}
      const reinforce=()=>{try{api.applyOptions({rightOffset:12,rightBarStaysOnScroll:true})}catch{}};
      document.addEventListener('click',e=>{if(e.target?.closest?.('[data-tf]'))setTimeout(reinforce,900)},true);
      setTimeout(reinforce,1200);
      setTimeout(reinforce,3000);
    }catch(e){console.warn('Wavelength chart spacing fallback',e)}
    return chart;
  };
}
function reorder(){
  const chart=document.querySelector('.chart-shell');
  if(!chart)return;
  const history=document.querySelector('#coinHistory');
  const outcomes=document.querySelector('#coinOutcomeLineage');
  if(history&&chart.nextElementSibling!==history)chart.insertAdjacentElement('afterend',history);
  const anchor=history||chart;
  if(outcomes&&anchor.nextElementSibling!==outcomes)anchor.insertAdjacentElement('afterend',outcomes);
}
function start(){
  reorder();
  const root=document.querySelector('.page')||document.body;
  new MutationObserver(reorder).observe(root,{childList:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
