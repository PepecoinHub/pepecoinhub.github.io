#!/usr/bin/env python3
"""Daily snapshot of the Pepecoin rich list.

Pulls the richest addresses from Pepecoin Service (/api/v3/addresses), the
circulating supply from PepeBlocks (/ext/getmoneysupply) and the block height
from Pepecoin Service (/api/status), then writes one file per UTC day to
docs/data/snapshots/YYYY-MM-DD.json.

Nothing is written unless the data passes basic sanity checks, so a bad API
response can never poison the history.

Usage:
    python scripts/snapshot.py                 # normal daily run
    python scripts/snapshot.py --rows 2000     # how many addresses to keep
    python scripts/snapshot.py --out-dir /tmp/x
"""
import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.request

SERVICE = os.environ.get("PEPE_SERVICE", "https://pepecoinservice.org").rstrip("/")
SUPPLY_URL = os.environ.get("PEPE_SUPPLY_URL", "https://pepeblocks.com/ext/getmoneysupply")
USER_AGENT = os.environ.get(
    "PEPE_USER_AGENT", "pepecoin-holder-watch/1.0 (daily snapshot, 1 run per day)"
)

SATS = 10**8                      # balances come back in 1e-8 units
BLOCK_REWARD = 10_000             # PEP per block (Pepecoin Service home page)
# Supply measured on 2026-10-03 (PepeBlocks /ext/getmoneysupply) at this block.
# Used only when the live supply endpoint is unreachable.
ANCHOR_HEIGHT = 1_235_437
ANCHOR_SUPPLY_PEP = 104_791_880_000

MAX_PAGES = 200


# --------------------------------------------------------------------------- http
def http_get(url, tries=4, timeout=40):
    last = None
    for attempt in range(tries):
        req = urllib.request.Request(
            url, headers={"User-Agent": USER_AGENT, "Accept": "application/json, text/plain"}
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8")
        except urllib.error.HTTPError as err:
            last = err
            if err.code in (400, 404, 413, 422):   # client errors will not fix themselves
                raise
            wait = 5 * (attempt + 1)
            if err.code == 429:
                wait = int(err.headers.get("Retry-After", "30") or 30)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as err:
            last = err
            wait = 3 * (2 ** attempt)
        if attempt < tries - 1:
            print(f"  retry in {wait}s ({last})", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"GET {url} failed after {tries} tries: {last}")


def get_json(url):
    return json.loads(http_get(url))


# ------------------------------------------------------------------------- fetchers
def fetch_rows(target, pause):
    """Return (rows, info). rows = [(address, balance_sats, is_miner, last_seen)] sorted desc."""
    ladder = []
    for lim in (target, 500, 250, 100, 50, 10):
        if lim <= target and lim not in ladder:
            ladder.append(lim)

    first = None
    for lim in ladder:
        try:
            first = get_json(f"{SERVICE}/api/v3/addresses?page=1&limit={lim}")
            break
        except urllib.error.HTTPError as err:
            print(f"  limit={lim} rejected (HTTP {err.code}), trying a smaller page", file=sys.stderr)
    if first is None:
        raise RuntimeError("rich list endpoint rejected every page size")

    paging = first.get("paging") or {}
    items = first.get("addresses") or []
    # The server may clamp the page size; page numbers only line up with the size it reports.
    eff = int(paging.get("limit") or len(items) or 1)
    total_pages = int(paging.get("total_pages") or MAX_PAGES)
    info = {"holders_listed": paging.get("total_count"), "page_size": eff}

    rows, seen = [], set()

    def add(batch):
        for it in batch:
            addr = it.get("address")
            try:
                bal = int(it.get("balance"))
            except (TypeError, ValueError):
                continue
            if not addr or bal <= 0 or addr in seen:
                continue
            seen.add(addr)
            rows.append((addr, bal, 1 if it.get("isMiner") else 0, int(it.get("lastSeen") or 0)))

    add(items)
    page = 2
    while len(rows) < target and page <= min(total_pages, MAX_PAGES):
        time.sleep(pause)
        data = get_json(f"{SERVICE}/api/v3/addresses?page={page}&limit={eff}")
        batch = data.get("addresses") or []
        if not batch:
            break
        add(batch)
        page += 1

    rows.sort(key=lambda r: -r[1])
    return rows[:target], info


def fetch_height():
    try:
        data = get_json(f"{SERVICE}/api/status")
        h = (data.get("backend") or {}).get("blocks") or (data.get("blockbook") or {}).get("bestHeight")
        return int(h) if h else None
    except Exception as err:  # height is nice to have, never fatal
        print(f"  height unavailable: {err}", file=sys.stderr)
        return None


def fetch_supply(height):
    """Return (supply_sats, source)."""
    try:
        raw = http_get(SUPPLY_URL, tries=3).strip()
        pep = float(raw)
        if 50e9 < pep < 500e9:
            return int(round(pep * SATS)), "pepeblocks"
        print(f"  supply {raw!r} outside plausible range, using estimate", file=sys.stderr)
    except Exception as err:
        print(f"  live supply unavailable: {err}", file=sys.stderr)
    est = ANCHOR_SUPPLY_PEP
    if height:
        est += BLOCK_REWARD * (height - ANCHOR_HEIGHT)
    return int(est * SATS), "estimate"


# ------------------------------------------------------------------------ validation
def validate(rows, supply, min_rows):
    problems = []
    if len(rows) < min_rows:
        problems.append(f"only {len(rows)} rows, need at least {min_rows}")
    if rows:
        top_share = rows[0][1] / supply
        if top_share > 0.25:
            problems.append(f"top address holds {top_share:.1%} of supply, that looks wrong")
        total = sum(r[1] for r in rows)
        if total > supply * 1.01:
            problems.append("listed balances exceed the supply")
    return problems


# --------------------------------------------------------------------------- output
def write_snapshot(path, meta, rows):
    head = '{"meta":' + json.dumps(meta, separators=(",", ":")) + ',\n"rows":[\n'
    body = ",\n".join(
        json.dumps([a, str(b), m, ls], separators=(",", ":")) for a, b, m, ls in rows
    )
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(head + body + "\n]}\n")
    os.replace(tmp, path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--rows", type=int, default=int(os.environ.get("PEPE_ROWS", "2000")),
                    help="addresses to keep (default 2000: top 1000 for the charts, plus a buffer "
                         "so the without-exchanges view still has enough rows)")
    ap.add_argument("--min-rows", type=int, default=int(os.environ.get("PEPE_MIN_ROWS", "1000")))
    ap.add_argument("--pause", type=float, default=1.5, help="seconds between pages")
    ap.add_argument("--out-dir", default=os.path.join(os.path.dirname(__file__), "..", "docs", "data", "snapshots"))
    ap.add_argument("--date", help="override snapshot date (YYYY-MM-DD, UTC); default today")
    args = ap.parse_args()

    today = args.date or dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    print(f"Snapshot {today}: fetching top {args.rows} from {SERVICE}")

    rows, info = fetch_rows(args.rows, args.pause)
    height = fetch_height()
    supply, source = fetch_supply(height)

    problems = validate(rows, supply, args.min_rows)
    if problems:
        print("Refusing to write snapshot:", *problems, sep="\n  - ", file=sys.stderr)
        return 1

    try:
        count = int(json.loads(http_get(f"{SERVICE}/api/v3/getaddresscount")).get("count"))
    except Exception:
        count = None

    meta = {
        "date": today,
        "fetched_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "height": height,
        "supply_sats": str(supply),
        "supply_source": source,
        "address_count": count,
        "holders_listed": info.get("holders_listed"),
        "rows": len(rows),
    }
    out_dir = os.path.abspath(args.out_dir)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{today}.json")
    write_snapshot(path, meta, rows)

    pep = lambda s: s / SATS
    print(f"  wrote {path}")
    print(f"  rows={len(rows)} height={height} supply={pep(supply):,.0f} PEP ({source})")
    print(f"  top1={pep(rows[0][1]):,.0f} PEP ({rows[0][1] / supply:.2%} of supply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
