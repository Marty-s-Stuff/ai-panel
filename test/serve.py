"""Self-test server: serves the panel (test/selftest.html) with the Python engine behind POST /api/term/*, plus a fake
assistant plugin (test/fake-agent.cmd), so nothing real is spent.  Run:  py -3.11 test/serve.py  -> http://127.0.0.1:5199/test/selftest.html"""
import json, mimetypes, os, sys
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'python'))
import aipanel  # noqa: E402

TMP = os.path.join(ROOT, 'test', '.agents')   # the fake plugin, written with this computer's path in it
os.makedirs(TMP, exist_ok=True)
with open(os.path.join(TMP, 'fake.json'), 'w', encoding='utf-8') as f:
    json.dump({'id': 'fake', 'name': 'Fake', 'program': 'Fake agent', 'icon': '🧪', 'description': 'Test plugin for {appName}.',
               'find': {'paths': [os.path.join(ROOT, 'test', 'fake-agent.cmd')]}, 'chat': {'args': ['--note', '{panelNote}']}, 'version': {'args': ['--version']},
               'status': {'args': ['status'], 'match': {'loggedIn': '^Logged in', 'methods': {'ChatGPT': 'ChatGPT sign-in', 'API key': 'API key'}}},
               'signIn': [{'id': 'login', 'label': 'Sign in (fake)…', 'args': ['login']}], 'signOut': {'args': ['logout']},
               'panelNote': 'Inside {appName}.'}, f)
with open(os.path.join(TMP, 'missing.json'), 'w', encoding='utf-8') as f:
    json.dump({'id': 'missing', 'name': 'Missing', 'find': {'commands': ['no-such-ai-program-xyz']}, 'chat': {'args': []},
               'install': {'command': 'winget install Nothing', 'shell': 'PowerShell'}}, f)
aipanel.configure(app_name='Self-test', session_var='FAKE_APP_VAR', extra_dirs=[TMP])


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype='application/json'):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        p = os.path.normpath(os.path.join(ROOT, self.path.split('?')[0].lstrip('/')))
        if not p.startswith(ROOT) or not os.path.isfile(p):
            return self._send(404, b'not found', 'text/plain')
        ctype = 'text/javascript' if p.endswith('.js') else mimetypes.guess_type(p)[0] or 'application/octet-stream'
        with open(p, 'rb') as fh:
            self._send(200, fh.read(), ctype)

    def do_POST(self):
        if not self.path.startswith('/api/term/'):
            return self._send(404, b'{}')
        n = int(self.headers.get('Content-Length') or 0)
        d = json.loads(self.rfile.read(n) or b'{}')
        self._send(200, json.dumps(aipanel.handle(self.path[len('/api/term/'):], d)).encode())


if __name__ == '__main__':
    print('AI panel self-test: http://127.0.0.1:5199/test/selftest.html', flush=True)
    try:
        ThreadingHTTPServer(('127.0.0.1', 5199), H).serve_forever()
    finally:
        aipanel.kill_all()
