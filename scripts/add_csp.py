#!/usr/bin/env python3
"""Inject a Content-Security-Policy (and a couple of companion security headers)
as <meta> tags into the static pages that do not already have one.

GitHub Pages cannot send HTTP response headers, so the policy is delivered via
<meta http-equiv>. The games/ pages already ship a CSP by hand; this script
covers the serious site, the PondOS meme edition and the i18n mirrors.

For a strict script-src we must allowlist every INLINE <script> by its
SHA-256 hash (CSP 'sha256-...'). This script computes those hashes per page
from the exact bytes between <script ...> and </script>, so the policy matches
what the browser will hash. JSON-LD blocks (type="application/ld+json") are
data, not scripts, and are not covered by script-src, so they are skipped.

Idempotent: re-running updates the managed block between the marker comments
and never touches a page that carries a hand-written CSP already.

Usage:
  python3 scripts/add_csp.py          # write changes
  python3 scripts/add_csp.py --check  # exit 1 if any page would change (CI)
"""
import base64
import glob
import hashlib
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'docs')
BEGIN = '<!-- csp:begin (managed by scripts/add_csp.py) -->'
END = '<!-- csp:end -->'

SUPA = 'https://azbwciqfbsdpwubznncg.supabase.co'
# Hosts the pages actually fetch from (price.js / market.js data feeds + analytics).
CONNECT = ['\'self\'', SUPA, 'wss://azbwciqfbsdpwubznncg.supabase.co',
           'https://pepecoinhub.goatcounter.com',
           'https://api.coingecko.com', 'https://www.deribit.com',
           # DefiLlama: market.js hits stablecoins.*, the compare.html age chart
           # hits coins.* (built inline as LL = 'https://coins.llama.fi/').
           'https://stablecoins.llama.fi', 'https://coins.llama.fi',
           'https://api.alternative.me']
# Executable scripts loaded by <script src>: self + goatcounter counter.
SCRIPT_HOSTS = ['\'self\'', 'https://gc.zgo.at']
IMG = ['\'self\'', 'data:', 'blob:', 'https://gc.zgo.at',
       'https://pepecoinhub.goatcounter.com']
STYLE = ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com']
FONT = ['\'self\'', 'https://fonts.gstatic.com']

# <script> ... </script> where the opening tag has no src= and is not JSON-LD.
INLINE_RE = re.compile(
    r'<script(?![^>]*\bsrc=)(?![^>]*type=["\']application/(?:ld\+json|json)["\'])[^>]*>(.*?)</script>',
    re.DOTALL | re.IGNORECASE)


def sha256_b64(text: str) -> str:
    return base64.b64encode(hashlib.sha256(text.encode('utf-8')).digest()).decode('ascii')


def inline_hashes(html: str):
    # Hash the content exactly as it sits between the tags (the browser hashes
    # the element's text content, CRLF/LF as present in the file).
    seen, out = set(), []
    for m in INLINE_RE.finditer(html):
        h = sha256_b64(m.group(1))
        if h not in seen:
            seen.add(h)
            out.append(h)
    return out


def build_meta(html: str) -> str:
    hashes = inline_hashes(html)
    script_src = ' '.join(SCRIPT_HOSTS + ["'sha256-%s'" % h for h in hashes])
    policy = '; '.join([
        "default-src 'self'",
        'script-src ' + script_src,
        'style-src ' + ' '.join(STYLE),
        'font-src ' + ' '.join(FONT),
        'img-src ' + ' '.join(IMG),
        'media-src \'self\' blob:',
        'connect-src ' + ' '.join(CONNECT),
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        # Note: frame-ancestors is intentionally omitted. It is ignored in a
        # <meta> CSP (header-only), and GitHub Pages cannot send headers, so
        # clickjacking protection has to be handled elsewhere. Keeping it here
        # would only emit a console warning on every page.
    ])
    lines = [
        BEGIN,
        '<meta http-equiv="Content-Security-Policy" content="%s">' % policy,
        '<meta name="referrer" content="strict-origin-when-cross-origin">',
        END,
    ]
    return '\n'.join(lines)


def strip_managed(html: str) -> str:
    return re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END) + r'\n?', '', html, flags=re.DOTALL)


def process(path: str):
    html = open(path, encoding='utf-8').read()
    # Never touch a page that already ships a hand-written CSP outside our block.
    if 'Content-Security-Policy' in strip_managed(html):
        return None
    base = strip_managed(html)
    meta = build_meta(base)
    m = re.search(r'<meta charset=[^>]*>\s*', base, re.IGNORECASE)
    if not m:
        m = re.search(r'<head[^>]*>\s*', base, re.IGNORECASE)
        if not m:
            return None
        insert_at = m.end()
    else:
        insert_at = m.end()
    new = base[:insert_at] + meta + '\n' + base[insert_at:]
    return None if new == html else new


def main():
    check = '--check' in sys.argv
    pages = [p for p in glob.glob(os.path.join(DOCS, '**', '*.html'), recursive=True)
             if os.sep + 'games' + os.sep not in p
             # Search Console / IndexNow verification stubs must stay byte-exact.
             and not os.path.basename(p).startswith('google')]
    changed = []
    for p in sorted(pages):
        new = process(p)
        if new is None:
            continue
        changed.append(os.path.relpath(p, ROOT))
        if not check:
            open(p, 'w', encoding='utf-8').write(new)
    if check:
        for c in changed:
            print('would change', c)
        print('CSP check: %d page(s) out of date' % len(changed))
        return 1 if changed else 0
    print('CSP written to %d page(s)' % len(changed))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
