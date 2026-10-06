#!/usr/bin/env python3
"""Build docs/data/reconstructed_daily.json from a folder of reconstructed daily snapshots.

The live history starts with the first snapshot.py run. Earlier days were rebuilt by
replaying the Pepecoin blockchain block by block on a full node (see README). That
replay writes one file per UTC day in the same format as docs/data/snapshots/*.json.
Only some of those days are committed as snapshot files (weekly, then daily); this
script turns *every* day into a compact trend series so the chart is daily for the
whole period without committing hundreds of extra snapshot files.

    python scripts/build_reconstructed_daily.py /path/to/replay/daily --from 2024-06-03

Days that already have a live snapshot in docs/data/snapshots are skipped. The
numbers are computed with the same code as build_summary.py. The "without exchanges"
numbers depend on labels.json; build_summary.py stops using them if the set of
excluded addresses changes, until this script is run again.
"""
import argparse
import datetime as dt
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_summary as bs  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("replay_dir", help="folder with reconstructed YYYY-MM-DD.json files")
    ap.add_argument("--from", dest="first", default=None, help="first day to include (YYYY-MM-DD)")
    ap.add_argument("--to", dest="last", default=None, help="last day to include (YYYY-MM-DD)")
    ap.add_argument("--data-dir", default=os.path.join(HERE, "..", "docs", "data"))
    args = ap.parse_args()
    data_dir = os.path.abspath(args.data_dir)

    labels = bs.load_labels(os.path.join(data_dir, "labels.json"))
    live = set()
    for path in glob.glob(os.path.join(data_dir, "snapshots", "????-??-??.json")):
        with open(path, encoding="utf-8") as fh:
            if not bs.is_reconstructed(json.load(fh)["meta"]):
                live.add(os.path.basename(path)[:10])

    days = []
    for snap in bs.load_snapshots(args.replay_dir):
        d = snap["date"].isoformat()
        if (args.first and d < args.first) or (args.last and d > args.last) or d in live:
            continue
        if not snap["rc"]:
            sys.exit(f"{d}: not marked as reconstructed, refusing to mix it in")
        row = [d, str(snap["supply"])]
        for view in ("all", "ex"):
            m = bs.metrics(*bs.make_view(snap, labels, view))
            row += [m["shares"], m["tiers"], m["rest"]]
        days.append(row)
    if not days:
        sys.exit("no days selected")

    out = {
        "_readme": "Daily top-N shares rebuilt from the Pepecoin blockchain for the days before the live "
                   "snapshots. Row: date, supply_sats, all-view shares, tiers, rest, ex-view shares, tiers, "
                   "rest (percent). Written by scripts/build_reconstructed_daily.py, read by build_summary.py.",
        "schema": 1,
        "source": "chain-replay",
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tops": bs.TOPS,
        "tiers": [list(t) for t in bs.TIERS],
        "excluded": bs.excluded_set(labels),
        "days": days,
    }
    path = os.path.join(data_dir, "reconstructed_daily.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
        fh.write("\n")
    print(f"Wrote {path}: {len(days)} days, {days[0][0]} .. {days[-1][0]} "
          f"({os.path.getsize(path) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
