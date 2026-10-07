#!/usr/bin/env python3
"""Turn the daily snapshots into the files the web page reads.

Reads   docs/data/snapshots/*.json   and   docs/data/labels.json
        docs/data/reconstructed_daily.json   (optional, daily shares rebuilt from the chain)
Writes  docs/data/summary.json       (everything the page needs)
        docs/data/shares.csv         (daily share of supply held by top N, for download)

Snapshots come in two kinds. Live ones are written every day by snapshot.py.
Reconstructed ones (meta.reconstructed = true) were rebuilt by replaying the
blockchain for the days before the live history began. Both are treated the
same in the numbers; reconstructed points carry "rc" so the page can draw them
differently. reconstructed_daily.json only adds trend points on days that have
no snapshot file; it never overrides a snapshot.

Two views are computed for every number:
  all  every address as it appears on chain
  ex   without addresses tagged as exchange / pool / burn. Their balances
       are also taken out of the denominator, so the figure answers "how
       concentrated is the rest of the supply".
"""
import argparse
import bisect
import csv
import datetime as dt
import glob
import itertools
import json
import os
import sys

SATS = 10**8
TOPS = [10, 25, 50, 100, 400, 1000]
TIERS = [(1, 10), (11, 50), (51, 100), (101, 400), (401, 1000)]
# Comparison periods for the tiles, the change table and "who moved": days back
# from the latest snapshot, or "all" for the earliest snapshot there is.
# For a 5-year column add 1825 before "all".
PERIODS = [1, 7, 14, 30, 90, 180, 365, 730, "all"]
EXCLUDE_TYPES = {"exchange", "pool", "burn"}
LIST_LEN = 10          # entries per churn list
# "Who moved" and the holders table cover this many top addresses. Concentration
# charts (TOPS / TIERS) still stop at 1000; snapshots store more as a buffer.
TRACK = 1000
HERE = os.path.dirname(os.path.abspath(__file__))


# -------------------------------------------------------------------------- loading
def load_labels(path):
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as fh:
        raw = json.load(fh)
    return {k: v for k, v in raw.items() if not k.startswith("_") and isinstance(v, dict)}


def is_reconstructed(meta):
    return bool(meta.get("reconstructed")) or meta.get("supply_source") == "chain-replay"


def excluded_set(labels):
    return sorted(a for a, v in labels.items() if v.get("type") in EXCLUDE_TYPES)


def load_daily_series(path, labels):
    """Optional daily points rebuilt from the chain: {date: {"supply", "all", "ex"}}.

    The "ex" numbers depend on which addresses were tagged when the file was made,
    so they are only used while labels.json still excludes exactly those addresses.
    The "all" numbers do not depend on tags and are always used."""
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as fh:
        raw = json.load(fh)
    if raw.get("tops") != TOPS or [list(t) for t in TIERS] != raw.get("tiers"):
        print(f"{os.path.basename(path)}: tops/tiers differ from this script, ignoring it", file=sys.stderr)
        return {}
    ex_ok = raw.get("excluded") == excluded_set(labels)
    if not ex_ok:
        print(f"{os.path.basename(path)}: exchange/pool tags changed since it was made, so its "
              "'without exchanges' points are skipped (regenerate it to bring them back)", file=sys.stderr)
    out = {}
    for d, supply, s_all, t_all, r_all, s_ex, t_ex, r_ex in raw["days"]:
        out[dt.date.fromisoformat(d)] = {
            "supply": int(supply),
            "all": {"shares": s_all, "tiers": t_all, "rest": r_all},
            "ex": {"shares": s_ex, "tiers": t_ex, "rest": r_ex} if ex_ok else None,
        }
    return out


def load_snapshots(directory):
    snaps = []
    for path in sorted(glob.glob(os.path.join(directory, "????-??-??.json"))):
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        meta = data["meta"]
        rows = [(r[0], int(r[1]), int(r[2]), int(r[3])) for r in data["rows"]]
        snaps.append({
            "date": dt.date.fromisoformat(meta["date"]),
            "meta": meta,
            "supply": int(meta["supply_sats"]),
            "rows": rows,
            "rc": is_reconstructed(meta),
        })
    snaps.sort(key=lambda s: s["date"])
    return snaps


# ------------------------------------------------------------------------- one view
def classify(addr, labels):
    """Only hand-kept tags from labels.json. The API's own miner flag is not shown."""
    lab = labels.get(addr)
    if lab:
        return lab.get("name"), lab.get("type", "other")
    return None, None


def make_view(snap, labels, view):
    """Return (rows, denominator_sats). rows = [(addr, bal, name, type, last)]."""
    rows = []
    excluded = 0
    for addr, bal, _miner, last in snap["rows"]:
        name, typ = classify(addr, labels)
        if view == "ex" and typ in EXCLUDE_TYPES:
            excluded += bal
            continue
        rows.append((addr, bal, name, typ, last))
    denom = snap["supply"] - (excluded if view == "ex" else 0)
    return rows, denom


def metrics(rows, denom):
    """Shares (% of denominator) for each top-N, each tier, and the remainder."""
    pref = list(itertools.accumulate(r[1] for r in rows))

    def upto(n):
        return pref[n - 1] if len(pref) >= n else None

    def pct(x):
        return None if x is None else round(x / denom * 100, 4)

    shares = [pct(upto(n)) for n in TOPS]
    tiers = []
    for lo, hi in TIERS:
        a, b = upto(hi), (upto(lo - 1) if lo > 1 else 0)
        tiers.append(None if a is None else a - b)
    top_n = upto(1000)
    rest = None if top_n is None else denom - top_n
    return {
        "shares": shares,
        "tiers": [pct(t) for t in tiers],
        "rest": pct(rest),
        "tiers_sats": tiers,
        "rest_sats": rest,
    }


# ----------------------------------------------------------------------------- churn
def pep(sats):
    return round(sats / SATS, 2)


def churn(cur_rows, ref_rows, labels):
    cur = {r[0]: (i + 1, r[1]) for i, r in enumerate(cur_rows[:TRACK])}
    ref = {r[0]: (i + 1, r[1]) for i, r in enumerate(ref_rows[:TRACK])}
    cur_all = {r[0]: (i + 1, r[1]) for i, r in enumerate(cur_rows)}

    def lab(a):
        return (labels.get(a) or {}).get("name")

    entered = sorted((a for a in cur if a not in ref), key=lambda a: -cur[a][1])
    exited = sorted((a for a in ref if a not in cur), key=lambda a: -ref[a][1])
    moves = [(a, cur[a][1] - ref[a][1]) for a in cur if a in ref]
    gain = sorted((m for m in moves if m[1] > 0), key=lambda m: -m[1])[:LIST_LEN]
    loss = sorted((m for m in moves if m[1] < 0), key=lambda m: m[1])[:LIST_LEN]

    return {
        "entered": len(entered),
        "exited": len(exited),
        "entered_top": [{"a": a, "b": pep(cur[a][1]), "r": cur[a][0], "l": lab(a)} for a in entered[:LIST_LEN]],
        "exited_top": [{
            "a": a, "b": pep(ref[a][1]), "r": ref[a][0], "l": lab(a),
            "now": pep(cur_all[a][1]) if a in cur_all else None,
        } for a in exited[:LIST_LEN]],
        "gainers": [{"a": a, "d": pep(d), "b": pep(cur[a][1]), "r": cur[a][0], "l": lab(a)} for a, d in gain],
        "losers": [{"a": a, "d": pep(d), "b": pep(cur[a][1]), "r": cur[a][0], "l": lab(a)} for a, d in loss],
        "cutoff_now": pep(cur_rows[TRACK - 1][1]) if len(cur_rows) >= TRACK else None,
        "cutoff_ref": pep(ref_rows[TRACK - 1][1]) if len(ref_rows) >= TRACK else None,
    }


# ----------------------------------------------------------------------- reference day
def find_ref(snaps, dates, latest_date, days):
    """Latest snapshot on or before (latest - days), provided it is not stale.
    days == "all" means the earliest snapshot."""
    if days == "all":
        return snaps[0] if snaps[0]["date"] < latest_date else None
    target = latest_date - dt.timedelta(days=days)
    i = bisect.bisect_right(dates, target) - 1
    if i < 0:
        return None
    slack = max(2, -(-days * 15 // 100))     # missed cron runs: allow ~15% (min 2 days) drift
    if (target - dates[i]).days > slack:
        return None
    return snaps[i]


# --------------------------------------------------------------------------- network
def snapshot_time(meta):
    """Unix time of the snapshot's tip: the last block for chain-replay days, the fetch time for live ones."""
    if meta.get("block_time"):
        return int(meta["block_time"])
    fetched = meta.get("fetched_at")
    if not fetched:
        return None
    return int(dt.datetime.strptime(fetched, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc).timestamp())


def write_network(snaps, path):
    """docs/data/network.json for network.html: one row per snapshot,
    [date, block height, supply in PEP, addresses with a balance, unix time].
    Live snapshots count addresses from the rich-list total (holders_listed); the API's own
    address count lags, and the chain replay counts the same thing as holders_listed."""
    rows = []
    for s in snaps:
        m = s["meta"]
        holders = m.get("holders_listed") or m.get("address_count")
        t = snapshot_time(m)
        if m.get("height") is None or t is None:
            continue
        rows.append([s["date"].isoformat(), int(m["height"]), round(s["supply"] / SATS), holders, t])
    out = {
        "schema": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "columns": ["date", "height", "supply_pep", "addresses_with_balance", "time"],
        "rows": rows,
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    return len(rows)


# ------------------------------------------------------------------------------ main
def build(data_dir, out_path, csv_path):
    snaps = load_snapshots(os.path.join(data_dir, "snapshots"))
    labels = load_labels(os.path.join(data_dir, "labels.json"))
    if not snaps:
        print("No snapshots found, nothing to build.", file=sys.stderr)
        return 1
    daily = load_daily_series(os.path.join(data_dir, "reconstructed_daily.json"), labels)

    dates = [s["date"] for s in snaps]
    latest = snaps[-1]

    views = {}
    cache = {}   # (date, view) -> (rows, denom, metrics)
    for view in ("all", "ex"):
        for s in snaps:
            rows, denom = make_view(s, labels, view)
            cache[(s["date"], view)] = (rows, denom, metrics(rows, denom))

        # one point per snapshot, plus reconstructed daily points on days without one
        points = {}
        for s in snaps:
            m = cache[(s["date"], view)][2]
            e = {"d": s["date"].isoformat(), "s": m["shares"], "t": m["tiers"], "r": m["rest"]}
            if s["rc"]:
                e["rc"] = 1
            points[s["date"]] = e
        for d, day in daily.items():
            if d in points or d > latest["date"] or day[view] is None:
                continue
            m = day[view]
            points[d] = {"d": d.isoformat(), "s": m["shares"], "t": m["tiers"], "r": m["rest"], "rc": 2}
        history = [points[d] for d in sorted(points)]

        cur_rows, cur_denom, cur_m = cache[(latest["date"], view)]
        deltas, churns = {}, {}
        for p in PERIODS:
            ref = find_ref(snaps, dates, latest["date"], p)
            if ref is None:
                deltas[str(p)] = None
                churns[str(p)] = None
                continue
            ref_rows, _, ref_m = cache[(ref["date"], view)]
            pp = [None if (a is None or b is None) else round(a - b, 4)
                  for a, b in zip(cur_m["shares"], ref_m["shares"])]
            deltas[str(p)] = {"ref": ref["date"].isoformat(), "pp": pp}
            churns[str(p)] = dict(churn(cur_rows, ref_rows, labels), ref=ref["date"].isoformat())
            if ref["rc"]:
                deltas[str(p)]["rc"] = 1
                churns[str(p)]["rc"] = 1

        views[view] = {
            "denominator": pep(cur_denom),
            "excluded_pep": pep(latest["supply"] - cur_denom),
            "shares": cur_m["shares"],
            "tiers": cur_m["tiers"],
            "tiers_pep": [None if t is None else pep(t) for t in cur_m["tiers_sats"]],
            "rest": cur_m["rest"],
            "rest_pep": None if cur_m["rest_sats"] is None else pep(cur_m["rest_sats"]),
            "cutoff_pep": pep(cur_rows[TRACK - 1][1]) if len(cur_rows) >= TRACK else None,
            "history": history,
            "deltas": deltas,
            "churn": churns,
        }

    # holders table: every fetched row with its rank in both views
    ex_rows, ex_denom, _ = cache[(latest["date"], "ex")]
    ex_rank = {r[0]: i + 1 for i, r in enumerate(ex_rows)}
    holders = []
    for i, (addr, bal, _miner, last) in enumerate(latest["rows"]):
        name, typ = classify(addr, labels)
        r_ex = ex_rank.get(addr)
        holders.append([
            i + 1, addr, pep(bal),
            round(bal / latest["supply"] * 100, 5),
            name, typ, last or None,
            r_ex, None if r_ex is None else round(bal / ex_denom * 100, 5),
        ])

    meta = latest["meta"]
    live = [s for s in snaps if not s["rc"]]
    all_dates = sorted({e["d"] for v in views.values() for e in v["history"]})
    summary = {
        "schema": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "latest": {
            "date": latest["date"].isoformat(),
            "height": meta.get("height"),
            "supply": pep(latest["supply"]),
            "supply_source": meta.get("supply_source"),
            "address_count": meta.get("address_count"),
            "rows": len(latest["rows"]),
        },
        "first_date": all_dates[0],
        "snapshots": len(snaps),
        "live_snapshots": len(live),
        "first_live_date": live[0]["date"].isoformat() if live else None,
        "reconstructed_snapshots": len(snaps) - len(live),
        "reconstructed_daily": sum(1 for e in views["all"]["history"] if e.get("rc") == 2),
        "tops": TOPS,
        "tiers": [list(t) for t in TIERS],
        "periods": PERIODS,
        "track": TRACK,
        "views": views,
        "holders": holders,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(summary, fh, separators=(",", ":"), ensure_ascii=False)

    with open(csv_path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["date", "supply_pep"] + [f"top{n}_pct_all" for n in TOPS] + [f"top{n}_pct_ex" for n in TOPS]
                   + ["source"])
        by_date = {s["date"].isoformat(): s for s in snaps}
        ex_hist = {e["d"]: e for e in views["ex"]["history"]}
        blank = [None] * len(TOPS)
        for a in views["all"]["history"]:
            d = a["d"]
            snap = by_date.get(d)
            supply = snap["supply"] if snap else daily[dt.date.fromisoformat(d)]["supply"]
            e = ex_hist.get(d, {}).get("s", blank)
            source = "reconstructed-daily" if a.get("rc") == 2 else "reconstructed" if a.get("rc") else "live"
            w.writerow([d, pep(supply)] + ["" if v is None else v for v in a["s"] + e] + [source])

    try:   # the network page is extra; never let it stop the summary
        n = write_network(snaps, os.path.join(data_dir, "network.json"))
        print(f"Built network.json with {n} row(s)")
    except Exception as exc:  # noqa: BLE001
        print(f"network.json skipped: {exc}", file=sys.stderr)

    try:   # same: the plain-HTML numbers on the rich list page are a bonus
        write_rich_list_static(summary, os.path.join(data_dir, "..", "rich-list.html"))
        print("Updated the plain-HTML summary in rich-list.html")
    except Exception as exc:  # noqa: BLE001
        print(f"rich-list.html summary skipped: {exc}", file=sys.stderr)

    size = os.path.getsize(out_path) / 1024
    print(f"Built {out_path} ({size:.0f} KB) from {len(snaps)} snapshot(s) "
          f"({len(live)} live, {len(snaps) - len(live)} reconstructed) and "
          f"{summary['reconstructed_daily']} reconstructed daily point(s), latest {latest['date']}")
    return 0


RICH_LIST_START = "<!-- static-summary:start -->"
RICH_LIST_END = "<!-- static-summary:end -->"


def write_rich_list_static(summary, html_path):
    """Put today's numbers into rich-list.html as plain HTML, for search engines and visitors
    without JavaScript. app.js replaces this block with the charts, so the page looks the same."""
    with open(html_path, encoding="utf-8") as fh:
        page = fh.read()
    a, b = page.find(RICH_LIST_START), page.find(RICH_LIST_END)
    if a < 0 or b < a:
        raise ValueError("static-summary markers not found")
    latest = summary["latest"]
    day = dt.date.fromisoformat(latest["date"])
    when = f"{day:%b} {day.day}, {day.year}"
    shares = summary["views"]["all"]["shares"]
    parts = " · ".join(f"top {n:,}: {v:.2f}%" for n, v in zip(summary["tops"], shares) if v is not None)
    block_at = f" (block {latest['height']:,})" if latest.get("height") else ""
    block = (
        f"{RICH_LIST_START}\n"
        f'  <header class="page-head">\n'
        f'    <p class="eyebrow">Rich list · snapshot of {when}</p>\n'
        f"    <h1>Pepecoin Holder Watch</h1>\n"
        f'    <p class="lede">How much of the PEP supply sits in the biggest wallets, and how that changes. '
        f"One snapshot of the top ~2000 addresses every day; the charts focus on the top 1000.</p>\n"
        f"  </header>\n"
        f'  <p id="boot">Share of the circulating supply held by the largest addresses on {when}{block_at}: {parts}. '
        f'Every day since February 2024: <a href="data/shares.csv">shares.csv</a>.</p>\n'
        f"  {RICH_LIST_END}"
    )
    page = page[:a] + block + page[b + len(RICH_LIST_END):]
    with open(html_path, "w", encoding="utf-8") as fh:
        fh.write(page)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--data-dir", default=os.path.join(HERE, "..", "docs", "data"))
    args = ap.parse_args()
    data_dir = os.path.abspath(args.data_dir)
    return build(data_dir, os.path.join(data_dir, "summary.json"), os.path.join(data_dir, "shares.csv"))


if __name__ == "__main__":
    sys.exit(main())
