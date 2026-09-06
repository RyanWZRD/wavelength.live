from intelligence_model import MODEL,VERSION,canonical_score
fixtures=[
 ({"ema20":110,"ema80":100,"close":120,"ema200":90,"rsi":60,"adx":40,"volume_ratio":1.4,"vs_btc_30":8,"d90":30,"atr_pct":3},100),
 ({"ema20":90,"ema80":100,"close":80,"ema200":100,"rsi":80,"adx":15,"volume_ratio":0.7,"vs_btc_30":-8,"d90":-20,"atr_pct":9},0),
 ({"ema20":110,"ema80":100,"close":120,"ema200":90,"rsi":80,"adx":40,"volume_ratio":1.1,"vs_btc_30":2,"d90":25,"atr_pct":8},63),
]
assert MODEL=="WAVELENGTH_INTELLIGENCE_V1" and VERSION==1
for x,expected in fixtures:
    got=canonical_score(**x)
    assert got==expected,(x,got,expected)
print('python canonical fixtures pass')
