const m=require('../intelligence-model.js');
const fixtures=[
 [{ema20:110,ema80:100,close:120,ema200:90,rsi:60,adx:40,volumeRatio:1.4,vsBtc30:8,d90:30,atrPct:3},100],
 [{ema20:90,ema80:100,close:80,ema200:100,rsi:80,adx:15,volumeRatio:.7,vsBtc30:-8,d90:-20,atrPct:9},0],
 [{ema20:110,ema80:100,close:120,ema200:90,rsi:80,adx:40,volumeRatio:1.1,vsBtc30:2,d90:25,atrPct:8},63],
];
if(m.MODEL!=='WAVELENGTH_INTELLIGENCE_V1'||m.VERSION!==1)throw new Error('bad model metadata');
for(const [x,e] of fixtures){const g=m.score(x);if(g!==e)throw new Error(`score ${g} != ${e}`)}
console.log('javascript canonical fixtures pass');
