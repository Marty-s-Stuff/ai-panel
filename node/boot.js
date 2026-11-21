// The AI panel's updater for Electron apps. It is built INTO the app and never replaced by an update, so a bad panel
// update can always be undone ("Use the built-in version"). It decides which copy of the panel the app uses:
//   - the built-in one (node_modules/ai-panel, the version the app was built with), or
//   - a newer 1.x you chose to install from GitHub (the ▾ menu offers Install / Not now / Skip), kept in updateDir.
// Only versions with the same first number as the built-in one, from 1.2.0 on, are used (a 2.0 needs the app rebuilt).
//
//   const boot = require('ai-panel/node/boot.js').createBoot({ updateDir: path.join(app.getPath('userData'), 'ai-panel') });
//   require(path.join(boot.dir, 'node', 'aipanel.js')).setup({ ..., boot, pty: require('node-pty') });
//   // and the page's panel files (ai-panel.*, bridge-http.js, xterm/) are served from boot.dir
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MIN = [1, 2, 0]; // the first version that has the updater: older ones could not undo themselves
const KEEP = ['ai-panel.html', 'ai-panel.css', 'ai-panel.js', 'bridge-http.js', 'node/', 'python/', 'agents/', 'xterm/', 'README.md', 'ADOPTING.md', 'CHANGELOG.md'];
const parse = v => { const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '')); return m ? m.slice(1).map(Number) : null; };
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const versionIn = dir => { try { return /VERSION = '(\d+\.\d+\.\d+)'/.exec(fs.readFileSync(path.join(dir, 'node', 'aipanel.js'), 'utf8'))[1]; } catch { return null; } };

/** A .tar.gz from GitHub (one top folder) -> the KEEP files, written under `to`. */
function untar(gz, to) {
  const buf = zlib.gunzipSync(gz); let n = 0;
  for (let at = 0; at + 512 <= buf.length;) {
    const h = buf.subarray(at, at + 512); if (!h[0]) break;
    const str = (a, b) => h.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
    const size = parseInt(str(124, 136).trim() || '0', 8), type = String.fromCharCode(h[156] || 48), prefix = str(345, 500), name = (prefix ? prefix + '/' : '') + str(0, 100);
    const body = buf.subarray(at + 512, at + 512 + size); at += 512 + Math.ceil(size / 512) * 512;
    const rel = name.split('/').slice(1).join('/'); // drop "ai-panel-1.2.1/"
    if (type !== '0' || !rel || !KEEP.some(k => rel === k || (k.endsWith('/') && rel.startsWith(k)))) continue;
    const out = path.resolve(to, rel); if (!out.startsWith(path.resolve(to) + path.sep)) continue; // never outside the folder
    fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, body); n++;
  }
  return n;
}

function createBoot({ updateDir, builtInDir = path.join(__dirname, '..'), repo = 'Marty-s-Stuff/ai-panel' }) {
  const builtIn = versionIn(builtInDir), major = parse(builtIn)?.[0];
  const current = path.join(updateDir, 'current.json'), versions = path.join(updateDir, 'versions');
  const readTag = () => { try { return JSON.parse(fs.readFileSync(current, 'utf8')).tag || null; } catch { return null; } };
  const usable = tag => { const v = parse(tag); return !!v && v[0] === major && cmp(v, MIN) >= 0; };
  const folderOk = d => ['ai-panel.js', 'ai-panel.css', 'ai-panel.html', 'node/aipanel.js', 'python/aipanel.py', 'agents/claude-code.json'].every(f => fs.existsSync(path.join(d, f)));
  // which copy this run uses: decided once, at start
  const tag = readTag(), cand = tag && usable(tag) ? path.join(versions, tag) : null;
  const active = cand && folderOk(cand) && versionIn(cand) === tag.slice(1) ? tag : null;
  const dir = active ? cand : builtInDir, running = active ? tag.slice(1) : builtIn;
  const ua = { 'User-Agent': 'ai-panel-updater', Accept: 'application/vnd.github+json' };
  async function tags() {
    const r = await fetch(`https://api.github.com/repos/${repo}/tags?per_page=100`, { headers: ua }); if (!r.ok) throw new Error('GitHub said ' + r.status);
    return (await r.json()).map(t => t.name).filter(usable).sort((a, b) => cmp(parse(b), parse(a)));
  }
  /** what: 'check' | 'install' (tag) | 'builtin'. The tag is checked against GitHub's own list; the page never picks a URL. */
  async function update(what, wanted) {
    const chosen = usable(readTag()) ? readTag() : null, pending = chosen === active ? null : chosen || 'built-in'; // chosen, used from the next start
    if (what === 'check') {
      let latest = null; try { latest = (await tags()).find(t => cmp(parse(t), parse(running)) > 0) || null; } catch { /* offline: no offer */ }
      return { builtIn, running, active, pending, latest, notes: `https://github.com/${repo}/blob/main/CHANGELOG.md` };
    }
    if (what === 'builtin') { fs.mkdirSync(updateDir, { recursive: true }); fs.writeFileSync(current, JSON.stringify({ tag: null })); return { pending: active ? 'built-in' : null }; }
    if (what !== 'install') throw new Error('unknown update call');
    if (!usable(wanted) || !(await tags()).includes(wanted)) throw new Error(`${wanted} is not a version this app can use`);
    const r = await fetch(`https://github.com/${repo}/archive/refs/tags/${wanted}.tar.gz`, { headers: { 'User-Agent': ua['User-Agent'] } }); if (!r.ok) throw new Error('Download failed: ' + r.status);
    const to = path.join(versions, wanted), tmp = to + '.new';
    fs.rmSync(tmp, { recursive: true, force: true }); untar(Buffer.from(await r.arrayBuffer()), tmp);
    if (!folderOk(tmp) || versionIn(tmp) !== wanted.slice(1)) { fs.rmSync(tmp, { recursive: true, force: true }); throw new Error('The download was not a complete AI panel'); }
    fs.rmSync(to, { recursive: true, force: true }); fs.renameSync(tmp, to);
    for (const old of fs.readdirSync(versions)) if (old !== wanted && old !== active) fs.rmSync(path.join(versions, old), { recursive: true, force: true }); // keep the new one and the one running
    fs.writeFileSync(current, JSON.stringify({ tag: wanted }));
    return { pending: wanted };
  }
  return { dir, builtIn, running, active, update };
}

module.exports = { createBoot };
