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

console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
