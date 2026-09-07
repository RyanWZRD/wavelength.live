#!/usr/bin/env python3
from pathlib import Path

APP=Path('app.js')
INDEX=Path('index.html')
app=APP.read_text(encoding='utf-8')
old='const MAX_COINS=40, EXCLUDE='
new='const MAX_COINS=60, EXCLUDE='
if old in app:
    app=app.replace(old,new,1)
elif new not in app:
    raise SystemExit('Expected MAX_COINS invariant not found; refusing unsafe patch')
APP.write_text(app,encoding='utf-8')

idx=INDEX.read_text(encoding='utf-8')
idx=idx.replace('Selecting the top 40 liquid USDT markets…','Dynamic deep-intelligence tier · up to 60 markets selected from the broader liquid research universe…')
INDEX.write_text(idx,encoding='utf-8')
print('Markets UI expanded from fixed 40 to dynamic deep tier of up to 60; broad discovery/research remains server-side.')
