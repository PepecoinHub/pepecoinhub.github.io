"""Latest videos of the official Pepecoin YouTube channel (@pepecoin) for Pond TV in the meme edition.

Writes docs/data/youtube.json: {"channel": {...}, "videos": [{"id", "title", "published"}]}, newest first.
Uses only public pages: the channel page (to find its channel id) and the channel's RSS feed. No API key.
The file has no timestamp of its own, so it changes (and gets committed) only when the videos change.
On any error the old file is kept, and the exit code is 1 (the workflow ignores it).
"""
import json
import pathlib
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

HANDLE = "pepecoin"
OUT = pathlib.Path(__file__).resolve().parent.parent / "docs" / "data" / "youtube.json"
KEEP = 12
UA = {"User-Agent": "Mozilla/5.0 (compatible; PepecoinHubBot/1.0; +https://pepecoinhub.com/)",
      "Accept-Language": "en", "Cookie": "CONSENT=YES+1"}
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015",
      "media": "http://search.yahoo.com/mrss/"}
VID = re.compile(r"^[A-Za-z0-9_-]{11}$")


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def channel_id():
    old = None
    try:
        old = json.loads(OUT.read_text())["channel"]["id"]
    except Exception:
        pass
    try:
        page = get(f"https://www.youtube.com/@{HANDLE}")
        for pat in (r'<link rel="canonical" href="https://www\.youtube\.com/channel/(UC[A-Za-z0-9_-]{22})"',
                    r'"externalId":"(UC[A-Za-z0-9_-]{22})"', r'"channelId":"(UC[A-Za-z0-9_-]{22})"'):
            m = re.search(pat, page)
            if m:
                return m.group(1)
    except Exception as e:
        print("channel page:", e)
    return old


def main():
    cid = channel_id()
    if not cid:
        print("no channel id found")
        return 1
    root = ET.fromstring(get(f"https://www.youtube.com/feeds/videos.xml?channel_id={cid}"))
    videos = []
    for e in root.findall("a:entry", NS):
        vid = (e.findtext("yt:videoId", "", NS) or "").strip()
        title = (e.findtext("a:title", "", NS) or "").strip()
        if not VID.match(vid) or not title:
            continue
        videos.append({"id": vid, "title": title[:120], "published": (e.findtext("a:published", "", NS) or "")[:10]})
    if not videos:
        print("feed had no videos")
        return 1
    data = {"_readme": "Latest videos of youtube.com/@pepecoin, for Pond TV. Made by scripts/fetch_youtube.py.",
            "channel": {"id": cid, "handle": "@" + HANDLE, "title": (root.findtext("a:title", "", NS) or "Pepecoin").strip()},
            "videos": videos[:KEEP]}
    text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    if not OUT.exists() or OUT.read_text() != text:
        OUT.write_text(text)
        print(f"{len(data['videos'])} videos from {cid}")
    else:
        print("no change")
    return 0


if __name__ == "__main__":
    sys.exit(main())
