"""The AI panel's engine for apps with a Python server (Hollow Editor): runs the picked AI assistant in a Windows
pseudo-console (pywinpty); ai-panel.js shows it through bridge-http.js. A plugin is a JSON file describing a command-line
AI assistant (agents/README.md). Only commands a plugin defines are ever started, and sign-in is the assistant's own
flow (browser / its own key prompt), so the app never sees a password or key.

Use:  import aipanel; aipanel.configure(app_name='Hollow Editor', session_var='HOLLOW_SESSION_NAME')
      then route POST /api/term/<kind> to  aipanel.handle(kind, json_body)  -> dict to send back as JSON."""
import itertools, json, os, re, shutil, subprocess, threading

VERSION = '1.2.1'
HERE = os.path.dirname(os.path.abspath(__file__))
_terms, _ids, _lock = {}, itertools.count(1), threading.Lock()
_cfg = {'app_name': 'the app', 'session_var': None, 'builtin_dir': os.path.join(HERE, '..', 'agents'), 'extra_dirs': [], 'boot': None}


def configure(app_name=None, session_var=None, builtin_dir=None, extra_dirs=None, boot=None):
    """app_name fills {appName} in plugins; session_var (e.g. 'HOLLOW_SESSION_NAME') is set to "In-app <assistant>" for
    the app's own MCP server; builtin_dir = where the shipped agents/ folder is; extra_dirs = more plugin folders;
    boot = the app's aipanel_boot.Boot (panel updates)."""
    for k, v in (('app_name', app_name), ('session_var', session_var), ('builtin_dir', builtin_dir), ('extra_dirs', extra_dirs), ('boot', boot)):
        if v is not None:
            _cfg[k] = v


def shared_dir():
    """Marty's own plugins, shared by every app ("Add another assistant…" opens it)."""
    return os.path.join(os.environ.get('APPDATA') or os.path.expanduser('~'), 'ai-agents')


def agent_dirs():
    """Built-in, then the folders the apps used before the shared one (so nothing is lost), then extra, then the shared one (last wins on the same id)."""
    old = [os.path.join(os.environ.get('APPDATA') or os.path.expanduser('~'), 'simple-glb-editor', 'agents'), os.path.join(os.path.expanduser('~'), '.hollow-editor', 'agents')]
    return [os.path.normpath(_cfg['builtin_dir'])] + old + list(_cfg['extra_dirs']) + [shared_dir()]


def load_agents():
    out = {}
    for i, d in enumerate(agent_dirs()):
        try:
            files = sorted(f for f in os.listdir(d) if f.lower().endswith('.json'))
        except OSError:
            continue
        for f in files:
            try:
                with open(os.path.join(d, f), encoding='utf-8') as fh:
                    a = json.load(fh)
                if a.get('id') and a.get('find'):
                    a['builtIn'] = i == 0
                    out[a['id']] = a
            except (OSError, ValueError):
                pass
    return out


def agent(aid):
    all_ = load_agents()
    a = all_.get(aid) or all_.get('claude-code') or next(iter(all_.values()), None)
    if not a:
        raise ValueError('No AI plugin found')
    return a


def find_exe(a):
    for c in a['find'].get('commands') or []:
        hit = shutil.which(c)
        if hit:
            return hit
    for p in a['find'].get('paths') or []:
        full = os.path.expanduser(p)
        if os.path.isfile(full):
            return full
    return None


def fill(a, args):
    note = (a.get('panelNote') or '').replace('{appName}', _cfg['app_name'])
    return [str(x).replace('{panelNote}', note).replace('{appName}', _cfg['app_name']) for x in args or []]


def plain(a):
    return {'id': a['id'], 'name': a.get('name') or a['id'], 'program': a.get('program') or a.get('name') or a['id'], 'icon': a.get('icon') or '🤖',
            'description': (a.get('description') or '').replace('{appName}', _cfg['app_name']), 'builtIn': bool(a.get('builtIn')), 'installed': bool(find_exe(a)), 'install': a.get('install'),
            'signIn': [{'id': x['id'], 'label': x['label'], 'tip': x.get('tip') or ''} for x in a.get('signIn') or []],
            'signOut': {'confirm': a['signOut'].get('confirm')} if a.get('signOut') else None, 'hasStatus': bool(a.get('status'))}


def clean_env(a):
    """This app's environment minus what the plugin drops (e.g. markers of a session that opened the app), plus its own."""
    drop = [re.compile(r, re.I) for r in a.get('dropEnv') or []]
    env = {k: v for k, v in os.environ.items() if not any(r.search(k) for r in drop)}
    name = 'In-app ' + (a.get('name') or a['id'])   # names the assistant's tab / session in the app's MCP server
    env.update({'TERM': 'xterm-256color', 'COLORTERM': 'truecolor', 'AI_PANEL_SESSION_NAME': name})
    if _cfg['session_var']:
        env[_cfg['session_var']] = name
    env.update(a.get('env') or {})
    return env


def _pick(o, dotted):
    for k in str(dotted or '').split('.'):
        o = o.get(k) if isinstance(o, dict) else None
    return o


def read_status(s, out):
    """The sign-in status from the status command's output: JSON (`json` field paths) or plain text (`match` regexes)."""
    if s.get('match'):
        m = s['match']
        logged = bool(re.search(m.get('loggedIn') or '$^', out, re.I | re.M))
        method = next((label for rx, label in (m.get('methods') or {}).items() if re.search(rx, out, re.I | re.M)), None)
        return {'installed': True, 'loggedIn': logged, 'method': method if logged else None}
    j, m = json.loads(out), s.get('json') or {}
    raw = _pick(j, m.get('method'))
    return {'installed': True, 'loggedIn': bool(_pick(j, m.get('loggedIn'))), 'method': (s.get('methods') or {}).get(raw, raw) if raw else None}


def status(aid):
    a = agent(aid)
    exe = find_exe(a)
    if not exe:
        return {'installed': False, 'loggedIn': False}
    if not a.get('status'):
        return {'installed': True, 'loggedIn': None}
    try:
        r = subprocess.run([exe] + fill(a, a['status']['args']), capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=20, env=clean_env(a),
                           stdin=subprocess.DEVNULL, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        return read_status(a['status'], r.stdout + ('\n' + r.stderr if a['status'].get('match') else ''))
    except (OSError, ValueError, subprocess.SubprocessError) as e:
        return {'installed': True, 'loggedIn': False, 'error': str(e)}


def open_folder():
    """"Add another assistant…": the shared plugins folder, with the how-to guide copied in."""
    d = shared_dir()
    os.makedirs(d, exist_ok=True)
    guide = os.path.join(d, 'README.md')
    if not os.path.isfile(guide):
        try:
            shutil.copyfile(os.path.join(agent_dirs()[0], 'README.md'), guide)
        except OSError:
            pass
    os.startfile(d)
    return d


class Term:
    """One running assistant. Output is kept in one growing string; the page asks for everything after its last position."""
    def __init__(self, argv, cwd, env, cols, rows):
        from winpty import PtyProcess   # pywinpty: only needed once a terminal starts
        self.p = PtyProcess.spawn(argv, cwd=cwd, env=env, dimensions=(rows, cols))
        self.out, self.code, self.cond = '', None, threading.Condition()
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        while True:
            try:
                d = self.p.read(65536)
            except EOFError:
                break
            except Exception:
                if not self.p.isalive():
                    break
                continue
            with self.cond:
                self.out += d
                self.cond.notify_all()
        with self.cond:
            self.code = self.p.exitstatus if self.p.exitstatus is not None else 0
            self.cond.notify_all()

    def read(self, pos, wait=20):
        """Everything after `pos`; waits up to `wait` s for something new (the page asks again straight away)."""
        with self.cond:
            if len(self.out) <= pos and self.code is None:
                self.cond.wait(wait)
            return {'data': self.out[pos:], 'pos': len(self.out), 'exited': self.code is not None, 'code': self.code}


def start(d):
    """d: {agent, kind: 'chat'|'signin'|'signout'|'version', signInId, cwd, cols, rows}. The command line comes from the plugin, never from the page."""
    a = agent(d.get('agent'))
    exe = find_exe(a)
    if not exe:
        raise ValueError((a.get('program') or a.get('name')) + ' is not installed')
    kind = d.get('kind') or 'chat'
    spec = {'chat': a.get('chat'), 'version': a.get('version'), 'signout': a.get('signOut'),
            'signin': next((x for x in a.get('signIn') or [] if x['id'] == d.get('signInId')), None)}.get(kind)
    if not spec:
        raise ValueError(f'{a.get("name")} has no "{kind}" command')
    cwd = d.get('cwd') if isinstance(d.get('cwd'), str) and os.path.isdir(d['cwd']) else os.path.expanduser('~')
    t = Term([exe] + fill(a, spec.get('args')), cwd, clean_env(a), max(20, int(d.get('cols') or 100)), max(5, int(d.get('rows') or 30)))
    with _lock:
        tid = next(_ids)
        _terms[tid] = t
    return tid


def get(tid):
    t = _terms.get(int(tid or 0))
    if not t:
        raise ValueError('That terminal is not running')
    return t


def write(tid, data):
    get(tid).p.write(str(data))


def resize(tid, cols, rows):
    if int(cols) > 1 and int(rows) > 1:
        get(tid).p.setwinsize(int(rows), int(cols))


def kill(tid):
    t = _terms.pop(int(tid or 0), None)
    if t:
        try:
            t.p.terminate(force=True)
        except Exception:
            pass


def kill_all():
    for tid in list(_terms):
        kill(tid)


def handle(kind, d):
    """The whole /api/term/<kind> route: returns the JSON reply ({'ok': True, ...} or {'ok': False, 'error': ...}).
    Serve it on POST only, so other web sites can't read it."""
    d = d if isinstance(d, dict) else {}
    try:
        if kind == 'agents':
            return {'ok': True, 'agents': [plain(a) for a in load_agents().values()]}
        if kind == 'info':
            return {'ok': True, 'value': plain(agent(d.get('agent')))}
        if kind == 'status':
            return {'ok': True, 'value': status(d.get('agent'))}
        if kind == 'openAgents':
            return {'ok': True, 'value': open_folder()}
        if kind == 'folderExists':
            return {'ok': True, 'value': isinstance(d.get('path'), str) and os.path.isdir(d['path'])}
        if kind == 'start':
            return {'ok': True, 'value': start(d)}
        if kind == 'update':   # panel updates (aipanel_boot.py, built into the app)
            if not _cfg['boot']:
                return {'ok': False, 'error': 'This app has no panel updater'}
            try:
                return {'ok': True, 'value': _cfg['boot'].update(d.get('what'), d.get('tag'))}
            except Exception as e:   # a failed download (network, bad archive) must not take the server down
                return {'ok': False, 'error': str(e)}
        if kind == 'read':
            return {'ok': True, **get(d.get('id')).read(int(d.get('pos') or 0))}
        if kind == 'write':
            write(d.get('id'), d.get('data') or '')
        elif kind == 'resize':
            resize(d.get('id'), d.get('cols') or 0, d.get('rows') or 0)
        elif kind == 'kill':
            kill(d.get('id'))
        else:
            return {'ok': False, 'error': 'unknown terminal call'}
        return {'ok': True}
    except ImportError:
        return {'ok': False, 'error': 'The AI terminal needs pywinpty (pip install pywinpty).'}
    except (ValueError, OSError, TypeError) as e:
        return {'ok': False, 'error': str(e)}
