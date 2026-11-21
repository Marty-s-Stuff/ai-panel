"""Copies one tagged version of the AI panel from GitHub into a Python app's folder, before the app's build.
The app keeps the version it wants on one line (its build script), e.g.:
    py aipanel/python/sync.py v1.0.0 aipanel
Only a folder that is empty or was made by this script (it holds .ai-panel-version) is replaced."""
import io, os, shutil, sys, urllib.request, zipfile

REPO = 'Marty-s-Stuff/ai-panel'
KEEP = ('ai-panel.html', 'ai-panel.css', 'ai-panel.js', 'bridge-http.js', 'node/', 'python/', 'agents/', 'xterm/', 'README.md', 'ADOPTING.md', 'CHANGELOG.md')


def sync(tag, dest):
    dest = os.path.abspath(dest)
    mark = os.path.join(dest, '.ai-panel-version')
    if os.path.isdir(dest) and os.listdir(dest) and not os.path.isfile(mark):
        raise SystemExit(f'{dest} has files that did not come from this script: not replacing it.')
    if os.path.isfile(mark) and open(mark, encoding='utf-8').read().strip() == tag:
        print(f'AI panel {tag} is already in {dest}')
        return
    url = f'https://github.com/{REPO}/archive/refs/tags/{tag}.zip'
    print(f'Downloading AI panel {tag} from {url}')
    with urllib.request.urlopen(url, timeout=60) as r:
        z = zipfile.ZipFile(io.BytesIO(r.read()))
    tmp = dest + '.new'
    shutil.rmtree(tmp, ignore_errors=True)
    for n in z.namelist():
        rel = n.split('/', 1)[1] if '/' in n else ''   # the zip has one top folder: ai-panel-1.0.0/
        if not rel or rel.endswith('/') or not rel.startswith(KEEP):
            continue
        out = os.path.join(tmp, *rel.split('/'))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, 'wb') as fh:
            fh.write(z.read(n))
    with open(os.path.join(tmp, '.ai-panel-version'), 'w', encoding='utf-8') as fh:
        fh.write(tag)
    shutil.rmtree(dest, ignore_errors=True)
    os.replace(tmp, dest)
    print(f'AI panel {tag} is now in {dest}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Use: sync.py <tag, e.g. v1.0.0> <folder>')
    sync(sys.argv[1], sys.argv[2])
