#!/usr/bin/env python3
"""Offline checks: local HTML references, duplicate IDs, JSON and JS syntax."""
import collections
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.refs = [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        for key in ('href', 'src'):
            if attrs.get(key):
                self.refs.append(attrs[key])


def main():
    errors = []
    pages = list(DOCS.rglob('*.html'))
    for path in pages:
        page = Page()
        page.feed(path.read_text(encoding='utf-8'))
        for ident, count in collections.Counter(page.ids).items():
            if count > 1:
                errors.append(f'{path.relative_to(ROOT)}: duplicate ID {ident}')
        for ref in page.refs:
            url = urlsplit(ref)
            if url.scheme or url.netloc:
                continue
            target = (DOCS / unquote(url.path).lstrip('/') if url.path.startswith('/')
                      else path.parent / unquote(url.path)) if url.path else path
            if target.is_dir():
                target = target / 'index.html'
            if not target.exists():
                errors.append(f'{path.relative_to(ROOT)}: missing {ref}')
    jsons = list(DOCS.rglob('*.json'))
    for path in jsons:
        try:
            json.loads(path.read_text(encoding='utf-8'))
        except (ValueError, UnicodeError) as exc:
            errors.append(f'{path.relative_to(ROOT)}: {exc}')
    scripts = list(DOCS.rglob('*.js')) + list((ROOT / 'scripts').glob('*.mjs'))
    for path in scripts:
        result = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True)
        if result.returncode:
            errors.append(result.stderr)
    print(f'Checked {len(pages)} HTML pages, {len(jsons)} JSON files, {len(scripts)} JS files')
    for error in errors:
        print(error)
    return bool(errors)


if __name__ == '__main__':
    raise SystemExit(main())
