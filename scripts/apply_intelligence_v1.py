#!/usr/bin/env python3
from pathlib import Path

MODEL='WAVELENGTH_INTELLIGENCE_V1'
VERSION=1


def replace_once(path, old, new):
    p=Path(path); text=p.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'expected migration anchor missing in {path}: {old[:100]}')
    p.write_text(text.replace(old,new,1))

Path('intelligence-model.js').write_text(r'''(function(root){
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
''')

Path('scripts/intelligence_model.py').write_text('''MODEL="WAVELENGTH_INTELLIGENCE_V1"\nVERSION=1\n\ndef canonical_score(*, ema20=None, ema80=None, close=None, ema200=None, rsi=None, adx=None, volume_ratio=None, vs_btc_30=None, d90=None, atr_pct=None):\n    s=0\n    if ema20 is not None and ema80 is not None and ema20>ema80:s+=20\n    if close is not None and ema200 is not None and close>ema200:s+=20\n    if rsi is not None and 50<=rsi<=75:s+=20\n    if adx is not None and adx>=35:s+=20\n    if volume_ratio is not None and volume_ratio>=1:s+=10\n    if (vs_btc_30 or 0)>5:s+=8\n    elif (vs_btc_30 or 0)>0:s+=4\n    if (d90 or 0)>20:s+=5\n    if volume_ratio is not None and volume_ratio>=1.25:s+=5\n    if atr_pct is not None and atr_pct>7:s-=8\n    if rsi is not None and rsi>75:s-=8\n    return max(0,min(100,round(s)))\n''')

Path('scripts/check_intelligence_v1.py').write_text('''from intelligence_model import MODEL,VERSION,canonical_score\nfixtures=[\n ({"ema20":110,"ema80":100,"close":120,"ema200":90,"rsi":60,"adx":40,"volume_ratio":1.4,"vs_btc_30":8,"d90":30,"atr_pct":3},100),\n ({"ema20":90,"ema80":100,"close":80,"ema200":100,"rsi":80,"adx":15,"volume_ratio":0.7,"vs_btc_30":-8,"d90":-20,"atr_pct":9},0),\n ({"ema20":110,"ema80":100,"close":120,"ema200":90,"rsi":80,"adx":40,"volume_ratio":1.1,"vs_btc_30":2,"d90":25,"atr_pct":8},51),\n]\nassert MODEL=="WAVELENGTH_INTELLIGENCE_V1" and VERSION==1\nfor x,expected in fixtures:\n    got=canonical_score(**x)\n    assert got==expected,(x,got,expected)\nprint('python canonical fixtures pass')\n''')

Path('scripts/check_intelligence_v1.js').write_text(r'''const m=require('../intelligence-model.js');
const fixtures=[
 [{ema20:110,ema80:100,close:120,ema200:90,rsi:60,adx:40,volumeRatio:1.4,vsBtc30:8,d90:30,atrPct:3},100],
 [{ema20:90,ema80:100,close:80,ema200:100,rsi:80,adx:15,volumeRatio:.7,vsBtc30:-8,d90:-20,atrPct:9},0],
 [{ema20:110,ema80:100,close:120,ema200:90,rsi:80,adx:40,volumeRatio:1.1,vsBtc30:2,d90:25,atrPct:8},51],
];
if(m.MODEL!=='WAVELENGTH_INTELLIGENCE_V1'||m.VERSION!==1)throw new Error('bad model metadata');
for(const [x,e] of fixtures){const g=m.score(x);if(g!==e)throw new Error(`score ${g} != ${e}`)}
console.log('javascript canonical fixtures pass');
''')

replace_once('index.html','<link rel="stylesheet" href="styles.css"><script src="app.js" defer></script>','<link rel="stylesheet" href="styles.css"><script src="intelligence-model.js" defer></script><script src="app.js" defer></script>')
replace_once('coin.html','<script src="https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js"></script><script src="shared-nav.js" defer></script><script src="coin.js" defer></script><script src="coin-intelligence.js" defer></script>','<script src="https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js"></script><script src="intelligence-model.js" defer></script><script src="shared-nav.js" defer></script><script src="coin.js" defer></script><script src="coin-intelligence.js" defer></script>')

old_app="function intelligenceScore(c){const t=c.tech;if(!t||t.error)return 0;let s=t.score||0;const rs=c.relative||{};if((rs.vsBtc30||0)>5)s+=8;else if((rs.vsBtc30||0)>0)s+=4;if((rs.d90||0)>20)s+=5;if(t.volRatio>=1.25)s+=5;if(t.atrPct>7)s-=8;if(t.rsi>75)s-=8;if(c.deriv){const f=Math.abs(c.deriv.funding||0);if(f>.001)s-=8;if(c.deriv.oiChange24h>8&&c.chg_24h>2)s+=4}return clamp(Math.round(s),0,100)}"
new_app="function intelligenceScore(c){const t=c.tech;if(!t||t.error)return 0;const rs=c.relative||{};return WavelengthIntelligence.score({ema20:t.ema20,ema80:t.ema80,close:t.close,ema200:t.ema200,rsi:t.rsi,adx:t.adx,volumeRatio:t.volRatio,vsBtc30:rs.vsBtc30,d90:rs.d90,atrPct:t.atrPct})}"
replace_once('app.js',old_app,new_app)
replace_once('app.js',"opportunities.push({symbol:c.symbol,start:Date.now(),entry:c.price,score:c.intelScore||0,h:{},done:false})","opportunities.push({symbol:c.symbol,start:Date.now(),entry:c.price,score:c.intelScore||0,score_model:WavelengthIntelligence.MODEL,score_version:WavelengthIntelligence.VERSION,h:{},done:false})")
replace_once('app.js',"$('#marketsMeta').textContent=`${order.length} liquid markets · live prices · technical, relative-strength and derivatives scan complete`","$('#marketsMeta').textContent=`${order.length} liquid markets · ${WavelengthIntelligence.MODEL} spot score · derivatives shown separately`")

replace_once('coin-intelligence.js','function perf(ks,days){','function atr(ks,p=14){if(ks.length<2)return null;const tr=[];for(let i=1;i<ks.length;i++){const h=+ks[i][2],lo=+ks[i][3],pc=+ks[i-1][4];tr.push(Math.max(h-lo,Math.abs(h-pc),Math.abs(lo-pc)))}if(tr.length<p)return null;let a=tr.slice(0,p).reduce((x,y)=>x+y,0)/p;for(let i=p;i<tr.length;i++)a=(a*(p-1)+tr[i])/p;return a}\nfunction perf(ks,days){')
replace_once('coin-intelligence.js',"A=adx(k4),recent=vols.slice(-4)","A=adx(k4),atrValue=atr(k4),atrPct=atrValue&&close?100*atrValue/close:null,recent=vols.slice(-4)")
old_coin="let score=0;if(e20>e80)score+=20;if(close>e200)score+=20;if(R>=50&&R<=75)score+=20;if(A>=35)score+=20;if(vr>=1)score+=10;if(vs30>5)score+=8;else if(vs30>0)score+=4;if(d90>20)score+=5;if(vr>=1.25)score+=5;if(R>75)score-=8;if(Math.abs(funding||0)>.001)score-=8;if(oi>8&&chg>2)score+=4;"
new_coin="const score=WavelengthIntelligence.score({ema20:e20,ema80:e80,close,ema200:e200,rsi:R,adx:A,volumeRatio:vr,vsBtc30:vs30,d90,atrPct});"
replace_once('coin-intelligence.js',old_coin,new_coin)
replace_once('coin-intelligence.js',"$('#readMeta').textContent=`4h Wavelength intelligence · ${pair} · research only`;","$('#readMeta').textContent=`${WavelengthIntelligence.MODEL} spot score · ${pair} · derivatives overlay separate · research only`;")

hist=Path('scripts/update_intelligence_history.py')
t=hist.read_text()
if 'from intelligence_model import MODEL, VERSION, canonical_score' not in t:
    t=t.replace('from pathlib import Path\n','from pathlib import Path\nfrom intelligence_model import MODEL, VERSION, canonical_score\n',1)
old="""    a30=perf(kd,30);d90=perf(kd,90);vs30=(a30-btc30) if a30 is not None and btc30 is not None else 0.0;chg=float(tick['priceChangePercent']);score=0
    if e20 is not None and e80 is not None and e20>e80:score+=20
    if e200 is not None and close>e200:score+=20
    if R is not None and 50<=R<=75:score+=20
    if A is not None and A>=35:score+=20
    if vr is not None and vr>=1:score+=10
    if vs30>5:score+=8
    elif vs30>0:score+=4
    if d90 is not None and d90>20:score+=5
    if vr is not None and vr>=1.25:score+=5
    if R is not None and R>75:score-=8
    score=max(0,min(100,round(score)));setup=bool(bull and R is not None and 50<=R<=75 and A is not None and A>=35)
"""
new="""    a30=perf(kd,30);d90=perf(kd,90);vs30=(a30-btc30) if a30 is not None and btc30 is not None else 0.0;chg=float(tick['priceChangePercent']);atr_pct=(100*atr/close if atr and close else None)
    score=canonical_score(ema20=e20,ema80=e80,close=close,ema200=e200,rsi=R,adx=A,volume_ratio=vr,vs_btc_30=vs30,d90=d90,atr_pct=atr_pct);setup=bool(bull and R is not None and 50<=R<=75 and A is not None and A>=35)
"""
if new not in t:
    if old not in t: raise SystemExit('history scoring anchor missing')
    t=t.replace(old,new,1)
t=t.replace("'score':score,'trend':", "'score':score,'score_model':MODEL,'score_version':VERSION,'trend':",1)
t=t.replace("'atr_pct':safe_round(100*atr/close if atr and close else None,3)","'atr_pct':safe_round(atr_pct,3)",1)
t=t.replace("'durable_derivatives_history':False", "'durable_derivatives_history':False,'score_model':MODEL,'score_version':VERSION",1)
hist.write_text(t)

ware=Path('scripts/build_outcome_warehouse.py');t=ware.read_text()
t=t.replace("score=e.get('score')\n", "score=e.get('score')\n        score_model=e.get('score_model') or 'LEGACY_RADAR_UNVERSIONED'\n        score_version=e.get('score_version')\n",1)
t=t.replace("'symbol':sym,'captured_at':capt,'rank':e.get('rank'),'score':score,", "'symbol':sym,'captured_at':capt,'rank':e.get('rank'),'score':score,'score_model':score_model,'score_version':score_version,",1)
t=t.replace("'score_band':band(score,[65,75,85,101],['<65','65-74','75-84','85+']),", "'score_band':band(score,[65,75,85,101],['<65','65-74','75-84','85+']),\n                'score_model':score_model,\n                'score_model_band':f\"{score_model}:{band(score,[65,75,85,101],['<65','65-74','75-84','85+'])}\",",1)
t=t.replace("'Composite regimes combine trend, ADX band and BTC-relative-strength state and are descriptive only.'", "'Composite regimes combine trend, ADX band and BTC-relative-strength state and are descriptive only.','Score lineage is explicit; legacy/unversioned radar scores are never silently treated as WAVELENGTH_INTELLIGENCE_V1.'",1)
ware.write_text(t)

ana=Path('scripts/build_outcome_analytics.py');t=ana.read_text()
t=t.replace("'by_score_band':table(events,'score_band')", "'by_score_band':table(events,'score_band'),'by_score_model_band':table(events,'score_model_band')",1)
t=t.replace("dimensions=[('score_band',payload['by_score_band']),", "dimensions=[('score_model_band',payload['by_score_model_band']),",1)
t=t.replace("'All segments with n < 30 are explicitly provisional.'", "'All segments with n < 30 are explicitly provisional.','Score-band hypotheses are model-qualified so legacy and canonical scores are not pooled.'",1)
ana.write_text(t)

print('canonical intelligence v1 migration applied')
