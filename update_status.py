"""
Runs inside GitHub Actions (see .github/workflows/bot-status.yml) — checks the bot's
current Alpaca paper position/account and writes bot-status.json into this repo, which
the Actions workflow then commits and pushes. Native GitHub automation: no external
container or third-party credential needed, so it isn't affected by anything outside
this repo.

Independent of the trading bot's own logging (queries Alpaca directly) — stays correct
even if the bot's log format changes.

Reads from environment (set as encrypted GitHub Actions secrets):
  ALPACA_API_KEY_ID, ALPACA_API_SECRET_KEY
Optional:
  ALPACA_BASE_URL (defaults to paper trading)
"""
import os
import json
from datetime import datetime, timezone
from urllib.parse import quote
import requests

SYMBOL = "ETH/USD"
OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bot-status.json")


def get_env():
    return {
        "key": os.environ["ALPACA_API_KEY_ID"],
        "secret": os.environ["ALPACA_API_SECRET_KEY"],
        "trading_base": os.environ.get("ALPACA_BASE_URL", "https://paper-api.alpaca.markets"),
    }


def alpaca_get(env, path, params=None):
    headers = {"APCA-API-KEY-ID": env["key"], "APCA-API-SECRET-KEY": env["secret"]}
    r = requests.get(f"{env['trading_base']}{path}", headers=headers, params=params or {}, timeout=15)
    r.raise_for_status()
    return r.json()


def get_position(env):
    headers = {"APCA-API-KEY-ID": env["key"], "APCA-API-SECRET-KEY": env["secret"]}
    r = requests.get(f"{env['trading_base']}/v2/positions/{quote(SYMBOL.replace('/', ''), safe='')}",
                      headers=headers, timeout=15)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()


def get_stop_price(env):
    orders = alpaca_get(env, "/v2/orders", {"status": "open", "symbols": SYMBOL, "limit": 10})
    for o in orders:
        if o.get("type") == "stop_limit" and o.get("side") == "sell":
            return float(o["stop_price"])
    return None


def get_entry_time(env):
    # Most recent filled order is a buy iff the current position resulted from it
    # (long-only, one-position-at-a-time strategy).
    orders = alpaca_get(env, "/v2/orders", {
        "status": "closed", "symbols": SYMBOL, "limit": 5, "direction": "desc",
    })
    for o in orders:
        if o.get("status") == "filled" and o.get("side") == "buy":
            return o.get("filled_at")
        if o.get("status") == "filled" and o.get("side") == "sell":
            return None
    return None


def main():
    env = get_env()
    position = get_position(env)
    account = alpaca_get(env, "/v2/account")
    now = datetime.now(timezone.utc).isoformat()

    status = {
        "symbol": SYMBOL,
        "equity": float(account["equity"]),
        "cash": float(account["cash"]),
        "position": None,
        "updated_at": now,
    }
    if position is not None:
        status["position"] = {
            "qty": float(position["qty"]),
            "entry_price": float(position["avg_entry_price"]),
            "entry_time": get_entry_time(env),
            "stop_price": get_stop_price(env),
        }

    with open(OUT_PATH, "w") as f:
        json.dump(status, f, indent=2)
    print(json.dumps(status, indent=2))


if __name__ == "__main__":
    main()
