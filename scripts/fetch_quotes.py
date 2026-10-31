#!/usr/bin/env python3
"""Fetch one quote snapshot for both editions. Failures keep the last good data and time."""
import datetime as dt
import json
from pathlib import Path
import sys
import time
import urllib.request

DOCS = Path(__file__).resolve().parents[1] / "docs"
API = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&"
IDS = "pepecoin-network,pepe,bitcoin,litecoin,dogecoin,monacoin,bellscoin,dingocoin,luckycoin,junkcoin"
KEEP = ("id", "symbol", "name", "current_price", "market_cap", "total_supply", "circulating_supply",
        "price_change_percentage_24h", "ath", "ath_date", "last_updated")


def get(query):
    for pause in (0, 10, 20):
        if pause:
            time.sleep(pause)
        try:
            req = urllib.request.Request(API + query, headers={"Accept": "application/json", "User-Agent": "pepecoinhub.com quotes"})
            with urllib.request.urlopen(req, timeout=25) as response:
                return json.load(response)
        except Exception as exc:
            print(f"Quotes request failed: {exc}", file=sys.stderr)
    return None


def saved_price(snapshot, network):
    a = next(c for c in snapshot["markets"] if c["id"] == "pepecoin-network")
    row = network["rows"][-1]
    def col(key):
        return row[network["columns"].index(key)]
    measured = a.get("last_updated") or snapshot["generated_at"]
    return {
        "schema": 2, "date": measured[:10], "updated_at": measured,
        "price_usd": a["current_price"], "change_24h": a.get("price_change_percentage_24h"),
        "supply": col("supply_pep"), "supply_time": dt.datetime.fromtimestamp(col("time"), dt.timezone.utc).isoformat(),
        "supply_source": "https://pepeblocks.com/", "source": "https://api.coingecko.com/api/v3/coins/markets",
        "market_cap": a["current_price"] * col("supply_pep"),
        "reported_market_cap": a.get("market_cap"), "reported_supply": a.get("total_supply") or a.get("circulating_supply"),
        "top_caps": sorted([c["market_cap"] for c in snapshot["markets"]
                            if c.get("top") and c["id"] != "pepecoin-network" and (c.get("market_cap") or 0) > 0], reverse=True),
    }


def main():
    own = get("ids=" + IDS)
    top = get("order=market_cap_desc&per_page=250&page=1")
    if not own or not top or len(top) < 100 or not any(c.get("id") == "pepecoin-network" and (c.get("current_price") or 0) > 0 for c in own):
        print("Keeping the previous quotes and their original timestamps; no complete snapshot fetched.", file=sys.stderr)
        return 0
    top_ids = {c["id"] for c in top}
    rows = {c["id"]: {k: c.get(k) for k in KEEP} for c in top}
    rows.update({c["id"]: {k: c.get(k) for k in KEEP} for c in own})
    for ident, row in rows.items():
        row["top"] = ident in top_ids and ident != "pepecoin-network"
    snapshot = {"schema": 1, "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "source": "https://api.coingecko.com/api/v3/coins/markets", "markets": list(rows.values())}
    network = json.loads((DOCS / "data/network.json").read_text(encoding="utf-8"))
    price = saved_price(snapshot, network)
    snapshot["pep_supply"] = {"value": price["supply"], "time": price["supply_time"], "source": price["supply_source"]}
    for name, value in (("market-prices.json", snapshot), ("price.json", price)):
        (DOCS / "data" / name).write_text(json.dumps(value, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Published one quote snapshot: {len(rows)} assets, PEP measured at {price['updated_at']}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
