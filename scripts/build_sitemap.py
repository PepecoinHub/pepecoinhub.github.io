#!/usr/bin/env python3
"""Set <lastmod> in docs/sitemap.xml to the date each page last changed in git.

The list of URLs stays as it is in sitemap.xml; only the dates are rewritten. A page with
uncommitted edits gets today's date. Needs the git history (in GitHub Actions: fetch-depth: 0).
Each URL also gets the page's language versions as <xhtml:link hreflang>, copied from the
<link rel="alternate" hreflang> tags in its <head>, so the HTML stays the one source for them.
"""
import datetime as dt
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, "..", "docs")
SITE = "https://pepecoinhub.com/"
XHTML_NS = 'xmlns:xhtml="http://www.w3.org/1999/xhtml"'


def last_change(path):
    rel = os.path.relpath(path, os.path.join(HERE, ".."))
    dirty = subprocess.run(["git", "status", "--porcelain", "--", rel], capture_output=True, text=True, check=True).stdout
    if dirty.strip():
        return dt.datetime.now(dt.timezone.utc).date().isoformat()
    out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", rel], capture_output=True, text=True, check=True).stdout
    return out.strip() or None


def alternates(path):
    try:
        with open(path, encoding="utf-8") as fh:
            head = fh.read().split("</head>", 1)[0]
    except OSError:
        return []
    return re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">', head)


def main():
    sitemap = os.path.join(DOCS, "sitemap.xml")
    with open(sitemap, encoding="utf-8") as fh:
        xml = fh.read()

    def fix(m):
        loc = m.group(1)
        page = loc[len(SITE):] if loc.startswith(SITE) else None
        if page is None:
            return m.group(0)
        if page == "" or page.endswith("/"):
            page += "index.html"
        path = os.path.join(DOCS, page)
        date = last_change(path) or m.group(2)
        links = "".join(f'\n    <xhtml:link rel="alternate" hreflang="{lang}" href="{href}"/>'
                        for lang, href in alternates(path))
        return f"<url><loc>{loc}</loc><lastmod>{date}</lastmod>{links}{chr(10) + '  ' if links else ''}</url>"

    new = re.sub(r"<url><loc>([^<]+)</loc><lastmod>([^<]*)</lastmod>(?:\s*<xhtml:link [^>]*/>)*\s*</url>", fix, xml)
    if XHTML_NS not in new:
        new = new.replace('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
                          f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" {XHTML_NS}>', 1)
    if new != xml:
        with open(sitemap, "w", encoding="utf-8") as fh:
            fh.write(new)
    print("sitemap.xml dates:", sorted(set(re.findall(r"<lastmod>([^<]+)", new))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
