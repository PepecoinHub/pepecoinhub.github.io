#!/usr/bin/env python3
"""Tell Bing (and the other IndexNow engines: Yandex, Seznam, Naver) which pages changed.

Reads docs/sitemap.xml and sends the URLs whose <lastmod> is today (UTC) to IndexNow in one
request. With --all it sends every URL in the sitemap (the "Run workflow" button does that).
The key is the file docs/<key>.txt, which the engines fetch from the live site to check that
the request comes from the site's owner. Never fails the build: a refused request only warns.
"""
import datetime as dt
import glob
import json
import os
import re
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, "..", "docs")
HOST = "pepecoinhub.com"
ENDPOINT = "https://api.indexnow.org/indexnow"


def find_key():
    for path in glob.glob(os.path.join(DOCS, "*.txt")):
        name = os.path.basename(path)[:-4]
        if re.fullmatch(r"[0-9a-f]{32}", name):
            with open(path, encoding="utf-8") as fh:
                if fh.read().strip() == name:
                    return name
    return None


def main():
    key = find_key()
    if not key:
        print("::warning::no IndexNow key file in docs/, nothing sent")
        return
    with open(os.path.join(DOCS, "sitemap.xml"), encoding="utf-8") as fh:
        pages = re.findall(r"<loc>([^<]+)</loc><lastmod>([^<]*)</lastmod>", fh.read())
    today = dt.datetime.now(dt.timezone.utc).date().isoformat()
    urls = [loc for loc, date in pages if "--all" in sys.argv or date == today]
    if not urls:
        print("No page changed today, nothing sent.")
        return
    body = json.dumps({"host": HOST, "key": key, "keyLocation": f"https://{HOST}/{key}.txt",
                       "urlList": urls}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"IndexNow: HTTP {resp.status}, {len(urls)} URL(s) sent")
    except urllib.error.HTTPError as e:
        print(f"::warning::IndexNow refused the request: HTTP {e.code} {e.read()[:300]!r}")
    except OSError as e:
        print(f"::warning::IndexNow not reached: {e}")


if __name__ == "__main__":
    main()
