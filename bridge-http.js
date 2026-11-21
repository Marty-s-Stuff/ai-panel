// The AI panel's bridge for apps whose page talks to a local HTTP server (Hollow Editor: python/aipanel.py behind
// POST /api/term/*). Output comes by long-polling /read. Pass the result to initTerminal({ bridge }).
//   base        where the routes are (default '/api/term/')
//   headers     extra headers every call sends (e.g. the app's anti-CSRF header { 'X-Hollow': '1' })
//   pickFolder  (start) => Promise<path|null>: the app's own folder picker (a web page can't open one itself)
export function httpBridge({ base = '/api/term/', headers = {}, pickFolder = async () => null } = {}) {
  const api = (k, d = {}) => fetch(base + k, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(d) })
    .then(async r => { const j = await r.json(); if (!j.ok) throw new Error(j.error || 'It did not work'); return j; });
  const dataCbs = [], exitCbs = [];
  let wbuf = '', wid = 0, wbusy = false;   // keystrokes go one request at a time, in order (several typed meanwhile go together)
  function flush() { if (wbusy || !wbuf) return; wbusy = true; const d = wbuf; wbuf = ''; api('write', { id: wid, data: d }).catch(() => {}).finally(() => { wbusy = false; flush(); }); }
  async function pump(id) {   // the output: each read waits on the server until there is something new
    let pos = 0;
    for (;;) {
      let j; try { j = await api('read', { id, pos }); } catch { exitCbs.forEach(f => f(id, 0)); return; }
      if (j.data) dataCbs.forEach(f => f(id, j.data));
      pos = j.pos;
      if (j.exited) { exitCbs.forEach(f => f(id, j.code)); return; }
    }
  }
  return {
    agents: () => api('agents').then(j => j.agents),
    openAgentsFolder: () => api('openAgents').then(j => j.value),
    info: agent => api('info', { agent }).then(j => j.value),
    status: agent => api('status', { agent }).then(j => j.value),
    start: async o => { const id = (await api('start', o)).value; pump(id); return id; },
    pickFolder,
    folderExists: path => api('folderExists', { path }).then(j => j.value),
    write: (id, data) => { if (id !== wid) { wbuf = ''; wid = id; } wbuf += data; flush(); },
    resize: (id, cols, rows) => { api('resize', { id, cols, rows }).catch(() => {}); },
    kill: id => { api('kill', { id }).catch(() => {}); },
    onData: cb => dataCbs.push(cb),
    onExit: cb => exitCbs.push(cb),
    update: (what, tag) => api('update', { what, tag }).then(j => j.value),   // panel updates: 'check' | 'install' (tag) | 'builtin'
  };
}
