#!/usr/bin/env python3
"""Check local asset references, media lists and bundled script integrity."""
import base64
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
PATHS = re.compile(r'(?<![\w/])(?:assets|css|data|js|vendor)/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+')


def check():
    errors = []
    files = [p for p in SITE.rglob('*') if p.is_file()]
    for p in files:
        if p.is_symlink():
            errors.append(f'Symbolic link: {p.relative_to(SITE)}')
        if p.suffix not in ('.html', '.js', '.css', '.json', '.geojson'):
            continue
        text = p.read_text(encoding='utf-8')
        for ref in set(PATHS.findall(text)):
            if not (SITE / ref).is_file():
                errors.append(f'{p.relative_to(SITE)}: missing {ref}')
        if p.suffix in ('.json', '.geojson'):
            json.loads(text)
        if p.suffix == '.css':
            for url in re.findall(r'url\(\s*[\"\']?([^\s)\"\']+)', text):
                if ':' not in url and not url.startswith('#'):
                    if not (p.parent / url.split('?')[0]).is_file():
                        errors.append(f'{p.relative_to(SITE)}: missing {url}')

    class IntegrityParser(HTMLParser):
        def handle_starttag(self, tag, attrs):
            attrs = dict(attrs)
            if 'integrity' not in attrs:
                return
            ref = attrs.get('src', attrs.get('href', '')).split('?')[0]
            digest = base64.b64encode(hashlib.sha384((SITE / ref).read_bytes()).digest()).decode()
            if attrs['integrity'] != 'sha384-' + digest:
                errors.append(f'Integrity mismatch: {ref}')

    IntegrityParser().feed((SITE / 'index.html').read_text())
    for name in ('media.json', 'concept-media.json'):
        for item in json.loads((SITE / 'data' / name).read_text()):
            for key in ('src', 'poster', 'thumbnail'):
                ref = item[key]
                if not re.fullmatch(r'assets/(img|video)/[\w.-]+', ref):
                    errors.append(f'Invalid media path: {ref}')
                elif not (SITE / ref).is_file():
                    errors.append(f'Missing media: {ref}')
    if errors:
        raise SystemExit('\n'.join(errors))
    print(f'PASS: {len(files)} site files; asset references, media and integrity verified.')


if __name__ == '__main__':
    check()
