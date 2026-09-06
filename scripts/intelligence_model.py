MODEL="WAVELENGTH_INTELLIGENCE_V1"
VERSION=1

def canonical_score(*, ema20=None, ema80=None, close=None, ema200=None, rsi=None, adx=None, volume_ratio=None, vs_btc_30=None, d90=None, atr_pct=None):
    s=0
    if ema20 is not None and ema80 is not None and ema20>ema80:s+=20
    if close is not None and ema200 is not None and close>ema200:s+=20
    if rsi is not None and 50<=rsi<=75:s+=20
    if adx is not None and adx>=35:s+=20
    if volume_ratio is not None and volume_ratio>=1:s+=10
    if (vs_btc_30 or 0)>5:s+=8
    elif (vs_btc_30 or 0)>0:s+=4
    if (d90 or 0)>20:s+=5
    if volume_ratio is not None and volume_ratio>=1.25:s+=5
    if atr_pct is not None and atr_pct>7:s-=8
    if rsi is not None and rsi>75:s-=8
    return max(0,min(100,round(s)))
