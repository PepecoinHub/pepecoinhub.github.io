#!/usr/bin/env python3
"""Check translated pages against their English originals.

    python3 scripts/check_i18n.py pl [de ...]

For every docs/<lang>/<page>.html that has an English docs/<page>.html it checks:
the html lang, canonical, og:url and hreflang links; JSON-LD that parses; local links and
images that exist; and that the page keeps the English page's ids, links and scripts
(only the words should differ). Exit code 1 if anything is wrong.
"""
import json
import os
import re
import sys
from html.parser import HTMLParser

DOCS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")
SITE = "https://pepecoinhub.com/"
TAGS = {"pl": "pl", "es": "es", "de": "de", "fr": "fr", "tr": "tr", "it": "it", "zh": "zh-Hans"}


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.scripts, self.ld, self.alts = [], [], [], [], {}
        self.lang = self.canonical = self.ogurl = None
        self._ld = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")
        if tag == "link" and a.get("rel") == "alternate" and a.get("hreflang"):
            self.alts[a["hreflang"]] = a.get("href")
        if tag == "meta" and a.get("property") == "og:url":
            self.ogurl = a.get("content")
        skip = tag == "link" and a.get("rel") not in ("stylesheet", "icon")   # canonical, alternate, preconnect
        skip = skip or (tag == "a" and "hreflang" in a)   # footer links to the other language versions
        for k in ("href", "src"):
            if a.get(k) and not skip and not (tag == "script" and k == "src"):
                self.links.append(a[k])
        if a.get("srcset"):
            self.links += [part.strip().split(" ")[0] for part in a["srcset"].split(",")]
        if tag == "script":
            if a.get("src"):
                self.scripts.append(a["src"])
            if a.get("type") == "application/ld+json":
                self._ld = ""

    def handle_data(self, data):
        if self._ld is not None:
            self._ld += data

    def handle_endtag(self, tag):
        if tag == "script" and self._ld is not None:
            self.ld.append(self._ld)
            self._ld = None


def parse(path):
    p = Page()
    with open(path, encoding="utf-8") as fh:
        p.feed(fh.read())
    return p


def local(url):
    return not re.match(r"^(https?:|mailto:|#|data:|javascript:)", url) and url != ""


def norm(url, lang):
    """A link from /<lang>/x.html, written the way the English page would write it."""
    url = re.sub(r"[?#].*$", "", url)
    return url[3:] if url.startswith("../") else url


def check(lang):
    bad = 0
    folder = os.path.join(DOCS, lang)
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".html"):
            continue
        path, en_path = os.path.join(folder, name), os.path.join(DOCS, name)
        if not os.path.exists(en_path):
            continue
        errs, warn = [], []
        try:
            t, e = parse(path), parse(en_path)
        except Exception as exc:  # noqa: BLE001
            print(f"{lang}/{name}: does not parse: {exc}")
            bad += 1
            continue
        url = SITE + lang + "/" + ("" if name == "index.html" else name)
        if t.lang != TAGS[lang]:
            errs.append(f'<html lang="{t.lang}">, expected "{TAGS[lang]}"')
        if t.canonical != url:
            errs.append(f"canonical {t.canonical}, expected {url}")
        if e.ogurl and t.ogurl != url:
            errs.append(f"og:url {t.ogurl}, expected {url}")
        if t.alts != e.alts:
            errs.append("hreflang links differ from the English page")
        for i, block in enumerate(t.ld):
            try:
                json.loads(block)
            except ValueError as exc:
                errs.append(f"JSON-LD #{i + 1} does not parse: {exc}")
        if len(t.ld) != len(e.ld):
            errs.append(f"{len(t.ld)} JSON-LD blocks, English has {len(e.ld)}")
        for one in t.links + t.scripts:
            if not local(one):
                continue
            target = os.path.normpath(os.path.join(folder, re.sub(r"[?#].*$", "", one)))
            if one.endswith("/") or os.path.isdir(target):
                target = os.path.join(target, "index.html")
            if not os.path.exists(target):
                errs.append(f"missing local file: {one}")
        if sorted(t.ids) != sorted(e.ids):
            missing = [i for i in e.ids if i not in t.ids]
            extra = [i for i in t.ids if i not in e.ids]
            errs.append(f"ids differ from English (missing {missing[:6]}, extra {extra[:6]})")
        elif t.ids != e.ids:
            warn.append("same ids as English, in a different order")
        en_links = [norm(u, "en") for u in e.links if local(u)]
        tr_links = [norm(u, lang) for u in t.links if local(u)]
        if sorted(set(en_links)) != sorted(set(tr_links)):
            a, b = set(en_links) - set(tr_links), set(tr_links) - set(en_links)
            warn.append(f"local links differ (only in English: {sorted(a)[:6]}, only here: {sorted(b)[:6]})")
        ext_en = sorted({u for u in e.links if re.match(r"^https?:", u)})
        ext_tr = sorted({u for u in t.links if re.match(r"^https?:", u)})
        if ext_en != ext_tr:
            a, b = set(ext_en) - set(ext_tr), set(ext_tr) - set(ext_en)
            warn.append(f"external links differ (only in English: {sorted(a)[:4]}, only here: {sorted(b)[:4]})")
        if [norm(s, lang) for s in t.scripts] != [norm(s, "en") for s in e.scripts]:
            errs.append("script tags differ from English")
        for m in errs:
            print(f"ERROR {lang}/{name}: {m}")
        for m in warn:
            print(f"warn  {lang}/{name}: {m}")
        bad += bool(errs)
        if not errs and not warn:
            print(f"ok    {lang}/{name}")
    return bad


if __name__ == "__main__":
    langs = sys.argv[1:] or list(TAGS)
    sys.exit(1 if sum(check(l) for l in langs) else 0)
