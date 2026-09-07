(()=>{
'use strict';
if(window.__wavelengthCoinChartBridge)return;
window.__wavelengthCoinChartBridge=true;

function install(){
  const lw=window.LightweightCharts;
  if(!lw||typeof lw.createChart!=='function')return false;
  if(lw.createChart.__wavelengthBridged)return true;
  const originalCreate=lw.createChart.bind(lw);
  function createChart(el,opts){
    const chart=originalCreate(el,opts);
    window.__wavelengthCoinChart=chart;
    if(chart&&typeof chart.addSeries==='function'){
      const originalAdd=chart.addSeries.bind(chart);
      let count=0;
      chart.addSeries=function(type,seriesOpts){
        const series=originalAdd(type,seriesOpts);
        count++;
        if(count===1)window.__wavelengthCoinCandleSeries=series;
        return series;
      };
    }
    return chart;
  }
  createChart.__wavelengthBridged=true;
  lw.createChart=createChart;
  return true;
}

if(!install()){
  let tries=0;
  const timer=setInterval(()=>{if(install()||++tries>40)clearInterval(timer)},50);
}
})();
