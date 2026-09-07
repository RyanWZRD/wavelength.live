#!/usr/bin/env python3
"""Compatibility runner for public frozen forward shadow continuity.

Supplies Binance funding data using the archive layout used by the private research
pipeline, with a current-period read-only API fallback, normalises timestamp units,
then executes the isolated continuity engine unchanged.
"""
from __future__ import annotations
import importlib.util, io, zipfile
from pathlib import Path
import pandas as pd
import requests

spec=importlib.util.spec_from_file_location('forward_shadow_continuity',Path('forward-shadow-continuity.py'))
mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
MONTHLY='https://data.binance.vision/data/futures/um/monthly/fundingRate'
FAPI='https://fapi.binance.com/fapi/v1/fundingRate'
ORIGINAL_CROWD_FEATURES=mod.crowd_features

def monthly_funding(start,end):
    frames=[]
    months=pd.period_range(pd.Timestamp(start).tz_convert(None).to_period('M'),pd.Timestamp(end).tz_convert(None).to_period('M'),freq='M')
    for month in months:
        ms=str(month); url=f'{MONTHLY}/BTCUSDT/BTCUSDT-fundingRate-{ms}.zip'; r=requests.get(url,timeout=30)
        if r.status_code==404: continue
        r.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            names=[n for n in z.namelist() if n.lower().endswith('.csv')]
            if not names: continue
            f=pd.read_csv(z.open(names[0])); cols={c.lower():c for c in f.columns}
            tc=cols.get('fundingtime') or cols.get('calc_time') or cols.get('time'); rc=cols.get('fundingrate') or cols.get('last_funding_rate') or cols.get('funding_rate')
            if tc and rc:
                raw=pd.to_numeric(f[tc],errors='coerce'); unit='ms' if raw.dropna().median()>1e11 else 's'
                frames.append(pd.DataFrame({'Date':pd.to_datetime(raw,unit=unit,utc=True,errors='coerce'),'funding_rate':pd.to_numeric(f[rc],errors='coerce')}).dropna().set_index('Date'))
    return frames

def api_funding(start,end):
    try:
        r=requests.get(FAPI,params={'symbol':'BTCUSDT','startTime':int(start.timestamp()*1000),'endTime':int(end.timestamp()*1000),'limit':1000},timeout=30); r.raise_for_status(); p=r.json()
        if not isinstance(p,list) or not p:return []
        return [pd.DataFrame({'Date':pd.to_datetime([x['fundingTime'] for x in p],unit='ms',utc=True),'funding_rate':[float(x['fundingRate']) for x in p]}).set_index('Date')]
    except Exception:return []

def corrected_derivatives_recent(days=45):
    end=pd.Timestamp(mod.now()); start=end-pd.Timedelta(days=days); fs=monthly_funding(start,end)
    newest=max((f.index.max() for f in fs if not f.empty),default=None); api_start=(newest+pd.Timedelta(seconds=1)) if newest is not None else start
    fs.extend(api_funding(api_start,end)); ms=[]
    for day in pd.date_range(start.normalize(),end.normalize(),freq='D',tz='UTC'):
        ds=day.strftime('%Y-%m-%d'); m=mod.zip_csv(f'{mod.ARCHIVE}/metrics/BTCUSDT/BTCUSDT-metrics-{ds}.zip')
        if m is None or m.empty: continue
        cols={c.lower():c for c in m.columns}; tc=cols.get('create_time'); oi=cols.get('sum_open_interest_value') or cols.get('sum_open_interest'); tak=cols.get('sum_taker_long_short_vol_ratio')
        if tc and oi and tak: ms.append(pd.DataFrame({'Date':pd.to_datetime(m[tc],utc=True,errors='coerce'),'open_interest':pd.to_numeric(m[oi],errors='coerce'),'taker_ls':pd.to_numeric(m[tak],errors='coerce')}).dropna().set_index('Date'))
    if not fs: raise RuntimeError('Binance funding data unavailable from monthly archive and API fallback')
    if not ms: raise RuntimeError('Binance metrics daily archives unavailable')
    f=pd.concat(fs).sort_index(); f=f[~f.index.duplicated(keep='last')]; m=pd.concat(ms).sort_index(); m=m[~m.index.duplicated(keep='last')]
    return f,m

def normalized_crowd_features(idx,funding,metrics):
    f=funding.copy(); m=metrics.copy(); f.index=pd.DatetimeIndex(f.index).as_unit('ns'); m.index=pd.DatetimeIndex(m.index).as_unit('ns')
    ni=pd.DatetimeIndex(idx).as_unit('ns')
    return ORIGINAL_CROWD_FEATURES(ni,f,m)

mod.derivatives_recent=corrected_derivatives_recent
mod.crowd_features=normalized_crowd_features
if __name__=='__main__': mod.main()
