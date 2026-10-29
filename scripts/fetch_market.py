#!/usr/bin/env python3
"""Fetch the market page data into docs/data/market-live.json.

Runs in the deploy job right after fetch_prices.py (every hour and on every publish), so
visitors read one file from this site instead of asking four APIs themselves. The file is
published with the site and not committed. market.js asks the APIs in the browser for
anything missing here.

  CoinGecko     prices, 24 h and 7 d change, 7 d sparkline, charts (1 and 90 days), global market
  alternative.me  Fear & Greed index, last 31 days
  DefiLlama     total stablecoin supply (USD-pegged), last 31 days
  Deribit       Bitcoin implied volatility index (DVOL), last 31 days
  CoinGecko     Altcoin Season Index: how many of the top 50 coins (no stablecoins, wrapped or
                staked tokens) beat Bitcoin over 30 days; 75+ is altcoin season, 25 or less Bitcoin season
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.request

COINS = ["bitcoin", "litecoin", "dogecoin", "pepecoin-network"]
CG = "https://api.coingecko.com/api/v3/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "data", "market-live.json")
UA = {"Accept": "application/json", "User-Agent": "pepecoinhub.com market page"}


def get(url, tries=(0, 15, 30)):
    for wait in tries:   # the CoinGecko free limit resets within a minute
        time.sleep(wait)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.load(r)
        except Exception as exc:  # noqa: BLE001
            print(f"{url}: {exc}", file=sys.stderr)
    return None


def thin(points, keep=400):
    d = [p for p in points or [] if p and p[1] is not None and p[1] > 0]
    if len(d) > keep:
        s = -(-len(d) // keep)
        d = [p for i, p in enumerate(d) if i % s == 0 or i == len(d) - 1]
    return d


def r(x, n=6):
    return float(f"{x:.{n}g}")


def coingecko(out):
    j = get(CG + "coins/markets?vs_currency=usd&ids=" + ",".join(COINS)
            + "&sparkline=true&price_change_percentage=24h,7d")
    if j:
        out["coins"] = {c["id"]: {
            "price": c.get("current_price"),
            "ch24": c.get("price_change_percentage_24h_in_currency", c.get("price_change_percentage_24h")),
            "ch7": c.get("price_change_percentage_7d_in_currency"),
            "spark": [r(p) for p in ((c.get("sparkline_in_7d") or {}).get("price") or [])[::2] if p],
        } for c in j}
    time.sleep(3)
    for coin in COINS:
        for days in (1, 90):
            j = get(CG + f"coins/{coin}/market_chart?vs_currency=usd&days={days}")
            if j and j.get("prices"):
                out["series"].setdefault(coin, {})[str(days)] = [[p[0], r(p[1])] for p in thin(j["prices"], 300 if days == 1 else 1100)]
            time.sleep(3)
    j = get(CG + "global")
    d = (j or {}).get("data")
    if d:
        out["global"] = {
            "mcap": d["total_market_cap"]["usd"],
            "vol": d["total_volume"]["usd"],
            "ch24": d.get("market_cap_change_percentage_24h_usd"),
            "btc": d["market_cap_percentage"]["btc"],
        }


# stablecoins, gold tokens and wrapped, staked or bridged copies of other coins don't count
SKIP_SYMBOLS = {"usdt", "usdc", "dai", "usde", "usds", "fdusd", "tusd", "pyusd", "usd1", "usdd", "usdp", "gusd", "frax",
                "rlusd", "usdtb", "usd0", "susde", "susds", "bfusd", "usdf", "usdg", "xaut", "paxg", "buidl", "usyc", "ustb"}
SKIP_WORDS = ("wrapped", "staked", "bridged", "restaked", "liquid staking", "usd")


def season_index(rows):
    """The Altcoin Season Index from coins/markets rows (price_change_percentage_30d_in_currency), or None."""
    btc = next((c for c in rows if c["id"] == "bitcoin"), None)
    if not btc or btc.get("price_change_percentage_30d_in_currency") is None:
        return None
    alts = []
    for c in rows:
        name, sym, ch = (c.get("name") or "").lower(), (c.get("symbol") or "").lower(), c.get("price_change_percentage_30d_in_currency")
        if c["id"] == "bitcoin" or ch is None or sym in SKIP_SYMBOLS or any(w in name for w in SKIP_WORDS):
            continue
        if sym.endswith("btc") or sym.startswith(("st", "w", "cb")) and sym[1:] in ("eth", "btc", "steth", "sol") or sym in ("weeth", "wsteth", "reth", "cbeth", "meth", "jitosol", "msol", "bnsol"):
            continue
        if 0.97 < (c.get("current_price") or 0) < 1.03 and abs(ch) < 3:
            continue   # an unlisted dollar stablecoin
        alts.append(ch)
        if len(alts) == 50:
            break
    if len(alts) < 40:
        return None
    beat = sum(1 for ch in alts if ch > btc["price_change_percentage_30d_in_currency"])
    return {"value": round(100 * beat / len(alts)), "beat": beat, "of": len(alts), "btc30": btc["price_change_percentage_30d_in_currency"]}


def altseason(out):
    time.sleep(3)
    j = get(CG + "coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=30d")
    s = season_index(j or [])
    if s:
        out["season"] = s


def fear_greed(out):
    j = get("https://api.alternative.me/fng/?limit=31", (0, 10))
    rows = (j or {}).get("data") or []
    if rows:   # newest first
        out["fng"] = {"value": int(rows[0]["value"]), "series": [[int(x["timestamp"]) * 1000, int(x["value"])] for x in reversed(rows)]}


def stablecoins(out):
    j = get("https://stablecoins.llama.fi/stablecoincharts/all", (0, 10))
    rows = [x for x in (j or [])[-31:] if (x.get("totalCirculatingUSD") or {}).get("peggedUSD")]
    if rows:
        out["stable"] = {"series": [[int(x["date"]) * 1000, round(x["totalCirculatingUSD"]["peggedUSD"])] for x in rows]}
        out["stable"]["value"] = out["stable"]["series"][-1][1]


def dvol(out):
    end = int(time.time() * 1000)
    j = get("https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&resolution=1D"
            f"&start_timestamp={end - 31 * 86400000}&end_timestamp={end}", (0, 10))
    rows = ((j or {}).get("result") or {}).get("data") or []
    if rows:   # [time, open, high, low, close]
        rows.sort(key=lambda x: x[0])
        out["dvol"] = {"series": [[x[0], round(x[4], 2)] for x in rows]}
        out["dvol"]["value"] = out["dvol"]["series"][-1][1]


def main():
    out = {"generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "coins": None, "series": {}}
    time.sleep(20)   # fetch_prices.py just used up part of the CoinGecko minute
    for step in (coingecko, altseason, fear_greed, stablecoins, dvol):
        try:
            step(out)
        except Exception as exc:  # noqa: BLE001 - one source failing must not lose the others
            print(f"{step.__name__}: {exc}", file=sys.stderr)
    have = [k for k in ("coins", "global", "season", "fng", "stable", "dvol") if out.get(k)]
    print(f"market-live.json: {', '.join(have) or 'nothing'}; charts {sum(len(v) for v in out['series'].values())}/8")
    if not have:
        return 0   # publish without the file, the page asks the APIs itself
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
