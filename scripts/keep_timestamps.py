#!/usr/bin/env python3
"""Undo data files whose only change is the "generated_at" timestamp.

build_summary.py rewrites summary.json and network.json on every run, and their
"generated_at" changes even when the data did not. Without this step every push
to main made a "data: snapshot" commit that changed nothing but the timestamp.
Run it after the build and before "git add"; files that really changed are left alone.
"""
import json
import subprocess
import sys

FILES = ["docs/data/summary.json", "docs/data/network.json", "docs/data/reconstructed_daily.json"]


def strip(obj):
    if isinstance(obj, dict):
        obj = {k: v for k, v in obj.items() if k != "generated_at"}
    return obj


def main():
    for path in FILES:
        try:
            old = subprocess.run(["git", "show", f"HEAD:{path}"], capture_output=True, check=True).stdout
            with open(path, "rb") as fh:
                new = fh.read()
        except (subprocess.CalledProcessError, FileNotFoundError):
            continue  # new file or not tracked yet: keep it
        if old == new:
            continue
        try:
            same = strip(json.loads(old)) == strip(json.loads(new))
        except ValueError:
            continue
        if same:
            with open(path, "wb") as fh:
                fh.write(old)
            print(f"{path}: only generated_at changed, kept the committed version")
    return 0


if __name__ == "__main__":
    sys.exit(main())
