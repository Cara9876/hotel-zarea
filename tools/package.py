#!/usr/bin/env python3
"""Create a reproducible hosting package from the checked-out commit."""
import argparse
import hashlib
import json
import re
import subprocess
import zipfile
from pathlib import Path
from check_site import check

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', required=True)
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,79}', args.version):
        parser.error('Invalid version')
    check()
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    if subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip():
        raise SystemExit('Commit changes before creating a release.')
    paths = []
    for name in ('site', 'server', 'licenses'):
        paths.extend(p for p in (ROOT / name).rglob('*') if p.is_file())
    paths.extend(ROOT / name for name in ('DEPLOYMENT.txt', 'THIRD_PARTY_NOTICES.md'))
    entries = {}
    for path in sorted(paths):
        if path.is_symlink() or path.name.startswith('.') or '__pycache__' in path.parts:
            raise SystemExit(f'Unexpected file in release: {path}')
        entries[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    entries['RELEASE.json'] = (json.dumps({'version': args.version, 'commit': commit,
        'siteDirectory': 'site', 'fileCount': len(entries)}, indent=2) + '\n').encode()
    entries['SHA256SUMS.txt'] = ''.join(f'{hashlib.sha256(data).hexdigest()}  {name}\n'
        for name, data in sorted(entries.items())).encode()
    out = ROOT / 'dist'
    out.mkdir(exist_ok=True)
    archive = out / 'hotel-zarea-current.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            bundle.writestr(info, data)
    with zipfile.ZipFile(archive) as bundle:
        assert bundle.testzip() is None
        for line in bundle.read('SHA256SUMS.txt').decode().splitlines():
            digest, name = line.split('  ', 1)
            assert hashlib.sha256(bundle.read(name)).hexdigest() == digest, name
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    print(f'{archive.name}: {len(entries)} entries, {archive.stat().st_size:,} bytes, SHA-256 {digest}')


if __name__ == '__main__':
    main()
