// Quick checks with plain Node (no Electron, no real AI):  node test/check.mjs
//  1. ai-panel.css uses theme tokens only (fixed colours only as defaults of the panel's own optional tokens, or black shadows)
//  2. every built-in plugin is valid JSON with id / find / chat, and the guide documents every field they use
//  3. the Electron engine: plugin folders, {appName} / {panelNote}, JSON and plain-text status, a .cmd program, env
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))), require = createRequire(import.meta.url);
let fails = 0; const ok = (cond, what) => { console.log((cond ? '  ok   ' : '  FAIL ') + what); if (!cond) fails++; };

console.log('CSS tokens');
const css = fs.readFileSync(path.join(ROOT, 'ai-panel.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const own = ['--ai', '--ok', '--on-primary', '--ai-round', '--ai-font'];   // the panel's optional tokens: may carry a default
const stripped = css.replace(/var\((--[\w-]+),\s*([^()]|\([^()]*\))*\)/g, (m, name) => (own.includes(name) ? 'var(' + name + ')' : m.replace(/#[0-9a-f]{3,8}\b/gi, 'BAD')));
const bad = [...stripped.matchAll(/#[0-9a-f]{3,8}\b|BAD|\b(rgba?|hsla?)\((?!0,\s*0,\s*0,)[^)]*\)|:\s*(white|black|red|green|blue|purple|gray|grey)\b/gi)].map(m => m[0]);
ok(!bad.length, 'no fixed colours' + (bad.length ? ': ' + [...new Set(bad)].join(', ') : ''));
const used = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(m => m[1]))].filter(t => !own.includes(t) && !/^--term-/.test(t)).sort();
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
ok(used.every(t => readme.includes('`' + t + '`')), 'README lists every token the CSS uses (' + used.join(' ') + ')');

console.log('Plugins');
const dir = path.join(ROOT, 'agents'), guide = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  let a; try { a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { ok(false, f + ': ' + e.message); continue; }
  ok(a.id && a.find && a.chat && Array.isArray(a.chat.args), `${f}: id, find, chat`);
  const unknown = Object.keys(a).filter(k => !guide.includes('`' + k + '`')); ok(!unknown.length, `${f}: fields documented` + (unknown.length ? ' (not: ' + unknown + ')' : ''));
  if (a.status?.match) for (const rx of [a.status.match.loggedIn, ...Object.keys(a.status.match.methods || {})]) try { new RegExp(rx); } catch { ok(false, `${f}: bad regex ${rx}`); }
}

console.log('Electron engine (node/aipanel.js)');
const { engine } = require(path.join(ROOT, 'node', 'aipanel.js'));
const tmp = fs.mkdtempSync(path.join(process.env.TEMP || '.', 'aipanel-'));
fs.writeFileSync(path.join(tmp, 'fake.json'), JSON.stringify({ id: 'fake', name: 'Fake', description: 'for {appName}', find: { paths: [path.join(ROOT, 'test', 'fake-agent.cmd')] }, chat: { args: ['--note', '{panelNote}'] }, panelNote: 'Inside {appName}.',
  status: { args: ['status'], match: { loggedIn: '^Logged in', methods: { 'ChatGPT': 'ChatGPT sign-in' } } }, dropEnv: ['^FAKE_DROP_ME$'] }));
const E = engine({ appName: 'Check', sessionVar: 'FAKE_APP_VAR', extraDirs: [tmp] });
const all = E.loadAgents();
ok(all.has('claude-code') && all.get('claude-code').builtIn, 'built-in Claude Code loads');
ok(all.has('fake') && !all.get('fake').builtIn, 'extra folder loads');
ok(E.agentDirs().at(-1).toLowerCase().endsWith(path.join('ai-agents').toLowerCase()), 'shared folder %APPDATA%\\ai-agents comes last (wins)');
const p = E.plain(all.get('fake')); ok(p.installed && p.description === 'for Check', 'found by path; {appName} in description');
process.env.FAKE_DROP_ME = '1';
const s = E.spawnSpec({ agent: 'fake' }); ok(s.args.join(' ') === '--note Inside Check.', 'chat args: {panelNote} with {appName}');
ok(s.env.AI_PANEL_SESSION_NAME === 'In-app Fake' && s.env.FAKE_APP_VAR === 'In-app Fake' && !('FAKE_DROP_ME' in s.env), 'env: session names set, dropEnv removed');
let threw = ''; try { E.spawnSpec({ agent: 'fake', kind: 'signout' }); } catch (e) { threw = e.message; } ok(/no "signout"/.test(threw), 'no command the plugin lacks');
ok(E.readStatus({ json: { loggedIn: 'a.in', method: 'm' }, methods: { x: 'Words' } }, '{"a":{"in":true},"m":"x"}').method === 'Words', 'JSON status');
ok(E.readStatus({ match: { loggedIn: '^Logged in' } }, 'Not logged in').loggedIn === false, 'plain-text status: "Not logged in" is signed out');
const st = await E.status('fake'); ok(st.loggedIn === true && st.method === 'ChatGPT sign-in', 'status through a .cmd program: ' + JSON.stringify(st));
process.env.FAKE_SIGNED_OUT = '1'; const st2 = await E.status('fake'); delete process.env.FAKE_SIGNED_OUT;
ok(st2.loggedIn === false, 'status: signed out (exit code 1) reads as signed out');
fs.rmSync(tmp, { recursive: true, force: true });

console.log('Updater (node/boot.js)');
const { createBoot } = require(path.join(ROOT, 'node', 'boot.js'));
const VER = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version, upd = fs.mkdtempSync(path.join(process.env.TEMP || '.', 'aipanel-upd-'));
let B = createBoot({ updateDir: upd, builtInDir: ROOT });
ok(B.dir === ROOT && B.builtIn === VER && !B.active, 'nothing installed: the built-in copy (v' + VER + ')');
const copy = path.join(upd, 'versions', 'v' + VER); // stand-in for a downloaded version: this folder's files
for (const f of ['ai-panel.js', 'ai-panel.css', 'ai-panel.html', 'node', 'python', 'agents']) fs.cpSync(path.join(ROOT, f), path.join(copy, f), { recursive: true });
fs.writeFileSync(path.join(upd, 'current.json'), JSON.stringify({ tag: 'v' + VER }));
B = createBoot({ updateDir: upd, builtInDir: ROOT }); ok(B.dir === copy && B.active === 'v' + VER, 'an installed version is used at start');
fs.renameSync(copy, path.join(upd, 'versions', 'v1.9.9')); fs.writeFileSync(path.join(upd, 'current.json'), JSON.stringify({ tag: 'v1.9.9' }));
B = createBoot({ updateDir: upd, builtInDir: ROOT }); ok(B.dir === ROOT, 'a folder whose version does not match its name is ignored');
fs.writeFileSync(path.join(upd, 'current.json'), JSON.stringify({ tag: 'v2.0.0' }));
B = createBoot({ updateDir: upd, builtInDir: ROOT }); ok(B.dir === ROOT, 'another first number (v2.0.0) is never used');
let refused = ''; try { await B.update('install', 'v1.1.0'); } catch (e) { refused = e.message; } ok(/not a version/.test(refused), 'versions before the updater (v1.1.0) are refused');
await B.update('builtin'); ok(JSON.parse(fs.readFileSync(path.join(upd, 'current.json'), 'utf8')).tag === null, '"Use the built-in version" clears the choice');
try { // a real GitHub download (needs the internet): unpack v1.1.0 and check only the panel's files come out
  const r = await fetch('https://github.com/Marty-s-Stuff/ai-panel/archive/refs/tags/v1.1.0.tar.gz'); const gz = Buffer.from(await r.arrayBuffer());
  const out = path.join(upd, 'untar');
  const src = fs.readFileSync(path.join(ROOT, 'node', 'boot.js'), 'utf8'); ok(/function untar/.test(src), 'boot.js has its own unpacker');
  const mod = { exports: {} }; new Function('module', 'exports', 'require', '__dirname', src + '\nmodule.exports.untar = untar;')(mod, mod.exports, require, path.join(ROOT, 'node'));
  const n = mod.exports.untar(gz, out);
  ok(n > 10 && fs.existsSync(path.join(out, 'ai-panel.js')) && fs.existsSync(path.join(out, 'xterm', 'xterm.js')) && !fs.existsSync(path.join(out, 'test')), `GitHub download unpacked: ${n} panel files, no test/ folder`);
} catch (e) { ok(false, 'GitHub download: ' + e.message); }
fs.rmSync(upd, { recursive: true, force: true });

console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
