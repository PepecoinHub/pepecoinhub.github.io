#!/usr/bin/env python3
"""Turn the daily snapshots into the files the web page reads.

Reads   docs/data/snapshots/*.json   and   docs/data/labels.json
Writes  docs/data/summary.json       (everything the page needs)
        docs/data/shares.csv         (daily share of supply held by top N, for download)

Two views are computed for every number:
  all  every address as it appears on chain
  ex   without addresses tagged as exchange / pool / miner / burn. Their balances
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
PERIODS = [1, 7, 14, 30, 90, 180, 365]
EXCLUDE_TYPES = {"exchange", "pool", "miner", "burn"}
LIST_LEN = 10          # entries per churn list
HERE = os.path.dirname(os.path.abspath(__file__))


# -------------------------------------------------------------------------- loading
def load_labels(path):
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as fh:
        raw = json.load(fh)
    return {k: v for k, v in raw.items() if not k.startswith("_") and isinstance(v, dict)}


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
        })
    snaps.sort(key=lambda s: s["date"])
    return snaps


# ------------------------------------------------------------------------- one view
def classify(addr, miner, labels):
    lab = labels.get(addr)
    if lab:
        return lab.get("name"), lab.get("type", "other")
    if miner:
        return None, "miner"
    return None, None


def make_view(snap, labels, view):
    """Return (rows, denominator_sats). rows = [(addr, bal, name, type, last)]."""
    rows = []
    excluded = 0
    for addr, bal, miner, last in snap["rows"]:
        name, typ = classify(addr, miner, labels)
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
    cur = {r[0]: (i + 1, r[1]) for i, r in enumerate(cur_rows[:1000])}
    ref = {r[0]: (i + 1, r[1]) for i, r in enumerate(ref_rows[:1000])}
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
        "cutoff_now": pep(cur_rows[999][1]) if len(cur_rows) >= 1000 else None,
        "cutoff_ref": pep(ref_rows[999][1]) if len(ref_rows) >= 1000 else None,
    }


# ----------------------------------------------------------------------- reference day
def find_ref(snaps, dates, latest_date, days):
    """Latest snapshot on or before (latest - days), provided it is not stale."""
    target = latest_date - dt.timedelta(days=days)
    i = bisect.bisect_right(dates, target) - 1
    if i < 0:
        return None
    slack = max(2, -(-days * 15 // 100))     # missed cron runs: allow ~15% (min 2 days) drift
    if (target - dates[i]).days > slack:
        return None
    return snaps[i]


# ------------------------------------------------------------------------------ main
def build(data_dir, out_path, csv_path):
    snaps = load_snapshots(os.path.join(data_dir, "snapshots"))
    labels = load_labels(os.path.join(data_dir, "labels.json"))
    if not snaps:
        print("No snapshots found, nothing to build.", file=sys.stderr)
        return 1

    dates = [s["date"] for s in snaps]
    latest = snaps[-1]

    views = {}
    cache = {}   # (date, view) -> (rows, denom, metrics)
    for view in ("all", "ex"):
        for s in snaps:
            rows, denom = make_view(s, labels, view)
            cache[(s["date"], view)] = (rows, denom, metrics(rows, denom))

        history = []
        for s in snaps:
            m = cache[(s["date"], view)][2]
            history.append({"d": s["date"].isoformat(), "s": m["shares"], "t": m["tiers"], "r": m["rest"]})

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

        views[view] = {
            "denominator": pep(cur_denom),
            "excluded_pep": pep(latest["supply"] - cur_denom),
            "shares": cur_m["shares"],
            "tiers": cur_m["tiers"],
            "tiers_pep": [None if t is None else pep(t) for t in cur_m["tiers_sats"]],
            "rest": cur_m["rest"],
            "rest_pep": None if cur_m["rest_sats"] is None else pep(cur_m["rest_sats"]),
            "cutoff_pep": pep(cur_rows[999][1]) if len(cur_rows) >= 1000 else None,
            "history": history,
            "deltas": deltas,
            "churn": churns,
        }

    # holders table: every fetched row with its rank in both views
    ex_rows, ex_denom, _ = cache[(latest["date"], "ex")]
    ex_rank = {r[0]: i + 1 for i, r in enumerate(ex_rows)}
    holders = []
    for i, (addr, bal, miner, last) in enumerate(latest["rows"]):
        name, typ = classify(addr, miner, labels)
        r_ex = ex_rank.get(addr)
        holders.append([
            i + 1, addr, pep(bal),
            round(bal / latest["supply"] * 100, 5),
            name, typ, last or None,
            r_ex, None if r_ex is None else round(bal / ex_denom * 100, 5),
        ])

    meta = latest["meta"]
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
        "first_date": snaps[0]["date"].isoformat(),
        "snapshots": len(snaps),
        "tops": TOPS,
        "tiers": [list(t) for t in TIERS],
        "periods": PERIODS,
        "views": views,
        "holders": holders,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(summary, fh, separators=(",", ":"), ensure_ascii=False)

    with open(csv_path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["date", "supply_pep"] + [f"top{n}_pct_all" for n in TOPS] + [f"top{n}_pct_ex" for n in TOPS])
        for i, s in enumerate(snaps):
            a = views["all"]["history"][i]["s"]
            e = views["ex"]["history"][i]["s"]
            w.writerow([s["date"].isoformat(), pep(s["supply"])] + ["" if v is None else v for v in a + e])

    size = os.path.getsize(out_path) / 1024
    print(f"Built {out_path} ({size:.0f} KB) from {len(snaps)} snapshot(s), latest {latest['date']}")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--data-dir", default=os.path.join(HERE, "..", "docs", "data"))
    args = ap.parse_args()
    data_dir = os.path.abspath(args.data_dir)
    return build(data_dir, os.path.join(data_dir, "summary.json"), os.path.join(data_dir, "shares.csv"))


if __name__ == "__main__":
    sys.exit(main())
