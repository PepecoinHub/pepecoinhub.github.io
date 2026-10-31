#!/usr/bin/env python3
"""Fetch PEP and PEPE prices from CoinGecko into docs/data/price-live.json for the price page.

Runs in the deploy job (every hour and on every publish), so visitors read one file from
this site instead of asking CoinGecko themselves, whose free API allows only a few requests
a minute. The file is published with the site and not committed. price.js falls back to
CoinGecko in the browser for anything missing here.

Same requests and the same shapes as price.js: market_chart for 1, 30 and 365 days (thinned
to about 400 points) and the two coins/markets lists.
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.request

API = "https://api.coingecko.com/api/v3/"
PEP, PEPE = "pepecoin-network", "pepe"
POW = ["dogecoin", "monacoin", "bellscoin", "dingocoin", "luckycoin", "junkcoin"]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "data", "price-live.json")
KEEP = ["id", "current_price", "market_cap", "total_supply", "circulating_supply",
        "price_change_percentage_24h", "ath", "ath_date"]


def get(path):
    for wait in (0, 15, 30):   # the free limit resets within a minute
        time.sleep(wait)
        try:
            req = urllib.request.Request(API + path, headers={"Accept": "application/json", "User-Agent": "pepecoinhub.com price page"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as exc:  # noqa: BLE001
            print(f"{path}: {exc}", file=sys.stderr)
    return None


def thin(prices):
    d = [p for p in prices or [] if p and p[1] and p[1] > 0]
    if len(d) > 400:
        s = -(-len(d) // 400)
        d = [p for i, p in enumerate(d) if i % s == 0 or i == len(d) - 1]
    return d


def main():
    out = {"generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "series": {}, "markets": None}
    for coin in (PEP, PEPE):
        for days in (1, 30, 365):
            j = get(f"coins/{coin}/market_chart?vs_currency=usd&days={days}")
            if j and j.get("prices"):
                out["series"].setdefault(coin, {})[str(days)] = thin(j["prices"])
            time.sleep(3)
    # Quotes are fetched once, before HTML generation, by fetch_quotes.py.
    try:
        with open(os.path.join(os.path.dirname(OUT), 'market-prices.json'), encoding='utf-8') as fh:
            out['markets'] = json.load(fh)['markets']
    except (OSError, ValueError, KeyError):
        pass
    got = sum(len(v) for v in out["series"].values())
    print(f"price-live.json: {got}/6 charts, markets {'yes' if out['markets'] else 'no'}")
    if not got and not out["markets"]:
        return 0   # nothing at all: publish without the file, the page asks CoinGecko itself
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
