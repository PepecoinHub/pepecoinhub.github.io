"""Network hashrate for the mining calculator (docs/mining.html).

Reads PepeBlocks' /api/getnetworkhashps and /api/getdifficulty once a day and writes
docs/data/mining.json. A failed fetch leaves yesterday's file in place.

    python scripts/mining_stats.py
"""
import datetime as dt
import json
import os
import sys
import urllib.request

BASE = os.environ.get("PEPE_EXPLORER", "https://pepeblocks.com").rstrip("/")
OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "data", "mining.json")
USER_AGENT = "pepecoin-holder-watch/1.0 (daily mining stats, 1 run per day)"


def get_number(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=40) as resp:
        return float(resp.read().decode("utf-8").strip())


def main():
    try:
        hashrate = get_number("/api/getnetworkhashps")
        difficulty = get_number("/api/getdifficulty")
    except Exception as err:  # keep the last good file
        print("mining stats not updated:", err, file=sys.stderr)
        return 0
    # 1 PH/s .. 1 EH/s is the plausible range for a Scrypt merge-mined coin today
    if not (1e12 <= hashrate <= 1e18) or difficulty <= 0:
        print(f"mining stats look wrong, not written: hashrate={hashrate} difficulty={difficulty}", file=sys.stderr)
        return 0
    data = {
        "schema": 1,
        "date": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d"),
        "updated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "hashrate_hs": round(hashrate),
        "difficulty": difficulty,
        "source": BASE + "/api/getnetworkhashps",
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1)
        fh.write("\n")
    print(f"  wrote {os.path.abspath(OUT)}: {hashrate / 1e15:.2f} PH/s, difficulty {difficulty:,.0f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
