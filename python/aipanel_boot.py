"""The AI panel's updater for Python apps. It is built INTO the app and never replaced by an update, so a bad panel
update can always be undone ("Use the built-in version"). It decides which copy of the panel the app uses:
  - the built-in one (the version the app was built with), or
  - a newer 1.x you chose to install from GitHub (the ▾ menu offers Install / Not now / Skip), kept in update_dir.
Only versions with the same first number as the built-in one, from 1.2.0 on, are used (a 2.0 needs the app rebuilt).

    boot = aipanel_boot.Boot(builtin_dir=<app>/ai-panel, update_dir=%APPDATA%/<app>/ai-panel)
    sys.path.insert(0, os.path.join(boot.dir, 'python')); import aipanel
    aipanel.configure(..., builtin_dir=os.path.join(boot.dir, 'agents'), boot=boot)
    # and serve the page's panel files (/ai-panel/...) from boot.dir
Keep this file OUTSIDE the folder it chooses (e.g. the app's tools/), and don't bundle aipanel.py as a module in an exe:
it is imported from boot.dir at run time."""
import io, json, os, re, shutil, tarfile, urllib.request

MIN = (1, 2, 0)   # the first version that has the updater: older ones could not undo themselves
KEEP = ('ai-panel.html', 'ai-panel.css', 'ai-panel.js', 'bridge-http.js', 'node/', 'python/', 'agents/', 'xterm/', 'README.md', 'ADOPTING.md', 'CHANGELOG.md')
NEEDED = ('ai-panel.js', 'ai-panel.css', 'ai-panel.html', 'node/aipanel.js', 'python/aipanel.py', 'agents/claude-code.json')
UA = {'User-Agent': 'ai-panel-updater', 'Accept': 'application/vnd.github+json'}


def parse(v):
    m = re.match(r'^v?(\d+)\.(\d+)\.(\d+)$', str(v or ''))
    return tuple(int(x) for x in m.groups()) if m else None


def version_in(d):
    try:
        with open(os.path.join(d, 'python', 'aipanel.py'), encoding='utf-8') as fh:
            return re.search(r"VERSION = '(\d+\.\d+\.\d+)'", fh.read()).group(1)
    except (OSError, AttributeError):
        return None


class Boot:
    def __init__(self, builtin_dir, update_dir, repo='Marty-s-Stuff/ai-panel'):
        self.builtin_dir, self.update_dir, self.repo = os.path.abspath(builtin_dir), update_dir, repo
        self.builtin = version_in(self.builtin_dir)
        self.major = (parse(self.builtin) or (None,))[0]
        self.versions = os.path.join(update_dir, 'versions')
        # which copy this run uses: decided once, at start
        tag = self._read_tag()
        cand = os.path.join(self.versions, tag) if tag and self._usable(tag) else None
        self.active = tag if cand and self._folder_ok(cand) and version_in(cand) == tag[1:] else None
        self.dir = cand if self.active else self.builtin_dir
        self.running = self.active[1:] if self.active else self.builtin

    def _read_tag(self):
        try:
            with open(os.path.join(self.update_dir, 'current.json'), encoding='utf-8') as fh:
                return json.load(fh).get('tag')
        except (OSError, ValueError):
            return None

    def _write_tag(self, tag):
        os.makedirs(self.update_dir, exist_ok=True)
        with open(os.path.join(self.update_dir, 'current.json'), 'w', encoding='utf-8') as fh:
            json.dump({'tag': tag}, fh)

    def _usable(self, tag):
        v = parse(tag)
        return bool(v) and v[0] == self.major and v >= MIN

    @staticmethod
    def _folder_ok(d):
        return all(os.path.isfile(os.path.join(d, *f.split('/'))) for f in NEEDED)

    def _tags(self):
        with urllib.request.urlopen(urllib.request.Request(f'https://api.github.com/repos/{self.repo}/tags?per_page=100', headers=UA), timeout=15) as r:
            names = [t['name'] for t in json.load(r)]
        return sorted((n for n in names if self._usable(n)), key=parse, reverse=True)

    def update(self, what, wanted=None):
        """what: 'check' | 'install' (wanted = a tag) | 'builtin'. The tag is checked against GitHub's own list; the page never picks a URL."""
        chosen = self._read_tag()
        chosen = chosen if chosen and self._usable(chosen) else None
        pending = None if chosen == self.active else (chosen or 'built-in')   # chosen, used from the next start
        if what == 'check':
            try:
                latest = next((t for t in self._tags() if parse(t) > parse(self.running)), None)
            except Exception:   # offline / GitHub busy: no offer
                latest = None
            return {'builtIn': self.builtin, 'running': self.running, 'active': self.active, 'pending': pending, 'latest': latest,
                    'notes': f'https://github.com/{self.repo}/blob/main/CHANGELOG.md'}
        if what == 'builtin':
            self._write_tag(None)
            return {'pending': 'built-in' if self.active else None}
        if what != 'install':
            raise ValueError('unknown update call')
        if not self._usable(wanted) or wanted not in self._tags():
            raise ValueError(f'{wanted} is not a version this app can use')
        req = urllib.request.Request(f'https://github.com/{self.repo}/archive/refs/tags/{wanted}.tar.gz', headers={'User-Agent': UA['User-Agent']})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        to = os.path.join(self.versions, wanted)
        tmp = to + '.new'
        shutil.rmtree(tmp, ignore_errors=True)
        root = os.path.abspath(tmp)
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tar:
            for m in tar.getmembers():
                rel = m.name.split('/', 1)[1] if '/' in m.name else ''   # drop "ai-panel-1.2.1/"
                if not m.isfile() or not rel or not any(rel == k or (k.endswith('/') and rel.startswith(k)) for k in KEEP):
                    continue
                out = os.path.abspath(os.path.join(tmp, *rel.split('/')))
                if not out.startswith(root + os.sep):   # never outside the folder
                    continue
                os.makedirs(os.path.dirname(out), exist_ok=True)
                with open(out, 'wb') as fh:
                    fh.write(tar.extractfile(m).read())
        if not self._folder_ok(tmp) or version_in(tmp) != wanted[1:]:
            shutil.rmtree(tmp, ignore_errors=True)
            raise ValueError('The download was not a complete AI panel')
        shutil.rmtree(to, ignore_errors=True)
        os.replace(tmp, to)
        for old in os.listdir(self.versions):   # keep the new one and the one running
            if old not in (wanted, self.active):
                shutil.rmtree(os.path.join(self.versions, old), ignore_errors=True)
        self._write_tag(wanted)
        return {'pending': wanted}
