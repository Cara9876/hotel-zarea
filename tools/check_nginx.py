#!/usr/bin/env python3
"""Exercise the supplied nginx configuration with a temporary local certificate."""
import shutil
import ssl
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def check():
    nginx = shutil.which('nginx')
    if not nginx:
        raise SystemExit('nginx is required for this check.')
    with tempfile.TemporaryDirectory(prefix='zarea-nginx-') as tmp:
        folder = Path(tmp)
        cert, key = folder / 'cert.pem', folder / 'key.pem'
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                        '-keyout', str(key), '-out', str(cert), '-days', '1',
                        '-subj', '/CN=localhost'], check=True, capture_output=True)
        config = (ROOT / 'server/nginx-zarea.conf').read_text()
        config = config.replace('listen 80;', 'listen 127.0.0.1:18080;')
        config = config.replace('listen [::]:80;', '')
        config = config.replace('listen 443 ssl http2;', 'listen 127.0.0.1:18443 ssl;')
        config = config.replace('listen [::]:443 ssl http2;', '')
        config = config.replace('/var/www/zarea', str(ROOT / 'site'))
        config = config.replace('/etc/ssl/zarea/fullchain.pem', str(cert))
        config = config.replace('/etc/ssl/zarea/privkey.pem', str(key))
        config = config.replace('zarea.example.org', 'localhost')
        conf = folder / 'nginx.conf'
        conf.write_text(f'pid {folder}/nginx.pid;\nerror_log {folder}/error.log;\n'
                        f'events {{}}\nhttp {{ access_log off; {config} }}\n')
        command = [nginx, '-p', str(folder), '-c', str(conf)]
        subprocess.run(command + ['-t'], check=True)
        process = subprocess.Popen(command + ['-g', 'daemon off;'])
        context = ssl._create_unverified_context()

        def request(path, method='GET', headers=None):
            req = urllib.request.Request('https://127.0.0.1:18443' + path,
                                         method=method, headers=headers or {})
            try:
                return urllib.request.urlopen(req, context=context, timeout=5)
            except urllib.error.HTTPError as exc:
                return exc

        try:
            for _ in range(50):
                try:
                    with request('/') as response:
                        assert response.status == 200
                    break
                except urllib.error.URLError:
                    time.sleep(.1)
            else:
                raise RuntimeError('nginx did not start')
            cases = [('/', 'text/html'), ('/css/site.css', 'text/css'),
                     ('/js/site.js', 'application/javascript'),
                     ('/data/site.json', 'application/json'),
                     ('/data/landmarks.geojson', 'application/geo+json')]
            for path, mime in cases:
                with request(path) as response:
                    assert response.status == 200, path
                    assert response.headers.get_content_type() == mime, (path, response.headers)
                    for header in ('Content-Security-Policy', 'X-Content-Type-Options',
                                   'X-Frame-Options', 'Strict-Transport-Security'):
                        assert response.headers.get(header), (path, header)
                    assert response.headers.get('Cache-Control') == 'no-cache', path
            for path in ('/.git/HEAD', '/assets/docs/', '/missing.html'):
                with request(path) as response:
                    assert response.status in (403, 404), (path, response.status)
                    assert response.headers.get('Content-Security-Policy'), path
            with request('/index.html', method='POST') as response:
                assert response.status in (403, 405)
            with request('/assets/video/hero-montage-v1.mp4', headers={'Range': 'bytes=0-1023'}) as response:
                assert response.status == 206
                assert response.headers.get_content_type() == 'video/mp4'
                assert len(response.read()) == 1024
            print('PASS: nginx syntax, MIME types, headers, cache, access rules and video ranges.')
        finally:
            process.terminate()
            process.wait(timeout=10)


if __name__ == '__main__':
    check()
