// The AI panel's engine for Electron apps (main process): runs the picked AI assistant in a pseudo-console (node-pty,
// ConPTY); ai-panel.js shows it through the preload's bridge (node/preload.js). A plugin is a JSON file describing a
// command-line AI assistant (agents/README.md). Only commands a plugin defines are ever started, and sign-in is the
// assistant's own flow (browser / its own key prompt), so the app never sees a password or key.
//
//   require('ai-panel').setup({ ipcMain, app, shell, dialog, getWin: () => win, appName: 'Simple GLB Editor', sessionVar: 'GLB_SESSION_NAME' })
// node-pty comes from the app's own dependencies.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, execFileSync } = require('child_process');

const VERSION = '1.2.4';
const appData = () => process.env.APPDATA || os.homedir();
/** Marty's own plugins, shared by every app ("Add another assistant…" opens it). */
const sharedDir = () => path.join(appData(), 'ai-agents');

function engine({ appName = 'the app', sessionVar = null, builtInDir = path.join(__dirname, '..', 'agents'), extraDirs = [] } = {}) {
  /** Built-in, then the folders the apps used before the shared one (so nothing is lost), then extra, then the shared one (last wins on the same id). */
  const agentDirs = () => [builtInDir, path.join(appData(), 'simple-glb-editor', 'agents'), path.join(os.homedir(), '.hollow-editor', 'agents'), ...extraDirs, sharedDir()];
  function loadAgents() {
    const out = new Map();
    agentDirs().forEach((d, i) => {
      let files = []; try { files = fs.readdirSync(d).filter(f => f.toLowerCase().endsWith('.json')).sort(); } catch {}
      for (const f of files) {
        try { const a = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); if (!a.id || !a.find) continue; a.builtIn = i === 0; a.file = path.join(d, f); out.set(a.id, a); }
        catch (e) { console.warn('AI plugin', f, 'skipped:', e.message); }
      }
    });
    return out;
  }
  const agentById = id => { const all = loadAgents(); const a = all.get(id) || all.get('claude-code') || [...all.values()][0]; if (!a) throw new Error('No AI plugin found'); return a; };
  /** The assistant's program: the first `where <command>` hit, else the first listed path that exists (~ = home folder). */
  const exeFound = new Map(); // where.exe blocks for a moment on every call: remember what was found (not misses, so a later install is seen)
  function findExe(a) {
    const known = exeFound.get(a.id); if (known && fs.existsSync(known)) return known;
    for (const c of a.find.commands || []) {
      try { const hit = execFileSync('where.exe', [c], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/).map(x => x.trim()).find(l => /\.(exe|cmd|bat)$/i.test(l)); if (hit) { exeFound.set(a.id, hit); return hit; } } catch {}
    }
    for (const p of a.find.paths || []) { const full = p.replace(/^~(?=[\\/])/, os.homedir()); if (fs.existsSync(full)) { exeFound.set(a.id, full); return full; } }
    return null;
  }
  const fill = (a, args) => (args || []).map(x => String(x).replace(/\{panelNote\}/g, (a.panelNote || '').replace(/\{appName\}/g, appName)).replace(/\{appName\}/g, appName));
  const plain = a => ({ id: a.id, name: a.name || a.id, program: a.program || a.name || a.id, icon: a.icon || '🤖', description: (a.description || '').replace(/\{appName\}/g, appName), builtIn: !!a.builtIn,
    installed: !!findExe(a), install: a.install || null, signIn: (a.signIn || []).map(x => ({ id: x.id, label: x.label, tip: x.tip || '' })), signOut: a.signOut ? { confirm: a.signOut.confirm || null } : null, hasStatus: !!a.status });
  /** The environment for the assistant: this app's, minus what the plugin drops (e.g. markers of a session that opened the app), plus its own. */
  function cleanEnv(a) {
    const drop = (a.dropEnv || []).map(r => new RegExp(r, 'i'));
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !drop.some(r => r.test(k))));
    const name = 'In-app ' + (a.name || a.id); // names the assistant's tab / session in the app's MCP server
    return Object.assign(env, { TERM: 'xterm-256color', COLORTERM: 'truecolor', AI_PANEL_SESSION_NAME: name }, sessionVar ? { [sessionVar]: name } : {}, a.env || {});
  }
  const pick = (o, dotted) => String(dotted || '').split('.').reduce((v, k) => (v == null ? v : v[k]), o);
  /** The sign-in status from the status command's output: JSON (`json` field paths) or plain text (`match` regexes). */
  function readStatus(s, out) {
    if (s.match) {
      const loggedIn = new RegExp(s.match.loggedIn || '$^', 'im').test(out);
      const method = Object.entries(s.match.methods || {}).find(([rx]) => new RegExp(rx, 'im').test(out))?.[1] || null;
      return { installed: true, loggedIn, method: loggedIn ? method : null };
    }
    const j = JSON.parse(out), m = s.json || {}, raw = pick(j, m.method);
    return { installed: true, loggedIn: !!pick(j, m.loggedIn), method: raw ? (s.methods || {})[raw] || raw : null };
  }
  // npm-installed tools are .cmd files, which Node can't run without a shell (since 2024): go through cmd.exe, quoted
  const q = x => (/[\s"&|<>^()%!]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
  const viaCmd = (exe, args) => (/\.(cmd|bat)$/i.test(exe) ? [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${[exe, ...args].map(q).join(' ')}"`], { windowsVerbatimArguments: true }] : [exe, args, {}]);
  const status = id => new Promise(resolve => {
    const a = agentById(id), exe = findExe(a); if (!exe) return resolve({ installed: false, loggedIn: false });
    if (!a.status) return resolve({ installed: true, loggedIn: null });
    const [file, args, extra] = viaCmd(exe, fill(a, a.status.args));
    execFile(file, args, { timeout: 20000, windowsHide: true, env: cleanEnv(a), ...extra }, (err, out, errOut) => {
      try { resolve(readStatus(a.status, a.status.match ? out + '\n' + errOut : out)); }
      catch { resolve({ installed: true, loggedIn: false, error: String(err?.message || 'no answer') }); }
    });
  });
  /** kind: 'chat' | 'signin' (with signInId) | 'signout' | 'version' — the args come from the plugin, never from the page. */
  function spawnSpec({ agent, kind = 'chat', signInId } = {}) {
    const a = agentById(agent), exe = findExe(a); if (!exe) throw new Error((a.program || a.name) + ' is not installed');
    const spec = kind === 'chat' ? a.chat : kind === 'version' ? a.version : kind === 'signout' ? a.signOut : kind === 'signin' ? (a.signIn || []).find(x => x.id === signInId) : null;
    if (!spec) throw new Error(`${a.name} has no "${kind}" command`);
    return { exe, args: fill(a, spec.args), env: cleanEnv(a) };
  }
  function openFolder() { // "Add another assistant…": the shared plugins folder, with the how-to guide in it
    const dir = sharedDir(); fs.mkdirSync(dir, { recursive: true });
    const guide = path.join(dir, 'README.md'); if (!fs.existsSync(guide)) try { fs.copyFileSync(path.join(builtInDir, 'README.md'), guide); } catch {}
    return dir;
  }
  return { agentDirs, loadAgents, agentById, findExe, plain, cleanEnv, readStatus, status, spawnSpec, openFolder };
}

/** Wires the engine to the window: the IPC names node/preload.js uses. Returns the engine (for self-tests). */
function setup({ ipcMain, app, shell, dialog, getWin, pty, ...opts }) {
  const E = engine(opts), terms = new Map(); let seq = 0, ptyLib = pty || null;
  ipcMain.handle('agents:list', () => [...E.loadAgents().values()].map(E.plain));
  ipcMain.handle('agents:openFolder', async () => { const dir = E.openFolder(); await shell.openPath(dir); return dir; });
  ipcMain.handle('term:info', (_e, id) => E.plain(E.agentById(id)));
  ipcMain.handle('term:status', (_e, id) => E.status(id));
  ipcMain.handle('term:pickFolder', async (_e, start) => { const r = await dialog.showOpenDialog(getWin(), { title: 'Where should the AI assistant work?', defaultPath: start || undefined, properties: ['openDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
  ipcMain.handle('term:folderExists', (_e, p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });
  ipcMain.handle('term:start', (e, o = {}) => {
    const { exe, args, env } = E.spawnSpec(o), { cwd, cols = 100, rows = 30 } = o;
    ptyLib ||= require('node-pty');
    const p = ptyLib.spawn(exe, args, { name: 'xterm-256color', cols, rows, cwd: cwd && fs.existsSync(cwd) ? cwd : os.homedir(), env });
    const id = ++seq, wc = e.sender; terms.set(id, p);
    p.onData(d => { if (!wc.isDestroyed()) wc.send('term:data', id, d); });
    p.onExit(({ exitCode }) => { terms.delete(id); if (!wc.isDestroyed()) wc.send('term:exit', id, exitCode); });
    return id;
  });
  ipcMain.on('term:write', (_e, id, d) => { try { terms.get(id)?.write(d); } catch {} });
  ipcMain.on('term:resize', (_e, id, c, r) => { try { if (c > 1 && r > 1) terms.get(id)?.resize(c, r); } catch {} });
  ipcMain.on('term:kill', (_e, id) => { try { terms.get(id)?.kill(); } catch {} });
  // panel updates (node/boot.js, built into the app): check / install a newer 1.x / back to the built-in copy
  ipcMain.handle('aipanel:update', async (_e, what, tag) => {
    if (what === 'restart') { // "Restart now" after an install: the app's own restart, else Electron's relaunch
      setTimeout(opts.restart || (() => {
        // a portable exe (electron-builder) runs from an unpacked temp copy: start the real .exe again, not that copy
        const exe = process.env.PORTABLE_EXECUTABLE_FILE;
        app.relaunch(exe ? { execPath: exe, args: process.argv.slice(1) } : undefined); app.quit();
      }), 300); // (after this answer reaches the page)
      return true;
    }
    if (!opts.boot) throw new Error('This app has no panel updater');
    const r = await opts.boot.update(what, tag);
    if (what === 'check') r.canRestart = true;
    return r;
  });
  app.on('will-quit', () => { for (const p of terms.values()) try { p.kill(); } catch {} });
  return E;
}

module.exports = { VERSION, setup, engine, sharedDir };
