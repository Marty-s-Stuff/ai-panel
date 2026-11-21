# AI Panel

One AI panel for all of Marty's apps (Simple GLB Editor, Hollow Editor, Simple A/V Editor): sign in to a command-line AI assistant (Claude Code, OpenAI Codex, Google Antigravity, GitHub Copilot, Kiro, or your own plugin) and chat with it in a terminal inside the app, so it can work on your files and, through the app's MCP server, control the app.

Written once here, so a fix or a new assistant reaches every app. **Each app names the version it uses and picks it up when the app is rebuilt** (never live while it runs). How to add it to an app: [ADOPTING.md](ADOPTING.md).

## What's in it

| Path | What it is |
|---|---|
| `ai-panel.html` | the markup: the 🤖 split button + ▾ menu (for the end of the app's menu line), then the panel |
| `ai-panel.css` | its look, drawn only with the app's theme tokens (below) |
| `ai-panel.js` | the front end: `initTerminal({...})` (ES module) |
| `bridge-http.js` | `httpBridge()`: the way to the engine for apps whose page talks to a local server (Python) |
| `node/aipanel.js`, `node/preload.js` | the Electron engine (main process, node-pty) and the preload block to copy |
| `python/aipanel.py` | the Python engine (pywinpty) with a ready `/api/term/*` handler |
| `python/sync.py` | copies a tagged version from GitHub into a Python app's folder before its build |
| `node/boot.js`, `python/aipanel_boot.py` | the updater, built into each app: picks the built-in or an installed newer 1.x, checks GitHub, installs, goes back |
| `agents/` | the built-in assistant plugins, the plugin guide (`README.md`) and `CHECKS.md` (what was checked in each tool's docs) |
| `xterm/` | xterm.js 6 and its fit add-on (MIT), the terminal display |
| `test/` | self-tests with a fake assistant (no real AI usage) |

## What the panel does

- three layouts, switched with the layout button: a drop-down over the top of the app, docked on the right, or a **floating window** you drag by its title row and resize at its corner (position and size are remembered)
- a message box (Enter sends, Shift+Enter = new line), keys ↑ ↓ Tab Esc Enter as buttons
- **answer buttons** made from the choices on screen (numbered menus, menus without numbers such as "❯ Yes, I trust this folder", and numbered / lettered lists), and a status chip: *Working… / Your turn / Waiting for your answer*
- "Where should it work?" on every new conversation, with recent folders
- sign in / sign out with each assistant's own flow, and which way you're signed in (subscription, API…)
- desktop notifications when the assistant finishes or asks something while you look elsewhere
- **AI assistant plugins**: pick the assistant in the ▾ menu; ➕ Add another assistant… opens the shared plugins folder `%APPDATA%\ai-agents` ([agents/README.md](agents/README.md))

The engines only ever run commands a plugin defines (never a command line from the page), and the app never handles passwords or API keys.

## Theme tokens

The CSS uses only these tokens from the app's `:root` (dark) and `:root[data-theme="light"]`. They are the Simple GLB Editor's names: `--panel`, `--title`, `--border`, `--text`, `--muted`, `--accent`, `--ctl`, `--ctl-border`, `--ctl-hover`, `--field`, `--primary`, `--primary-border`, `--primary-hover`, `--tint2`. The terminal's own colours are read from `--field`, `--text`, `--accent`, `--muted` and `--row-sel`. The menu uses the app's own `.menu` styles (`--menu`, `--menu-hover`).

Optional panel tokens (with their defaults): `--ai` the panel's highlight colour (`--accent`; the GLB editor uses its purple `#7e57c2`), `--ok` the "Your turn" colour (`--accent`), `--on-primary` text on primary buttons (`#fff`), `--ai-round` how round the corners are (`1` = as drawn, `0` = square, `0.5` = half), `--ai-font` the font stack (`system-ui, "Segoe UI", …`).

When the app switches theme it should fire `window.dispatchEvent(new Event('theme-changed'))` so the terminal recolours.

### App themes (our look, Windows 10, Windows 11…)

**Each app styles the panel as it sees fit.** A theme is just a set of the tokens above, so when the app switches its own theme, the panel follows. For example, a Windows 10 look would set flat greys, `--accent: #0078d7`, `--ai-round: 0` and `--ai-font: "Segoe UI", sans-serif`; a Windows 11 look rounder corners (`--ai-round: 0.8`) and `"Segoe UI Variable", "Segoe UI", sans-serif`. For anything the tokens don't cover, the app can override any rule from `ai-panel.css` in its own CSS (load it after `ai-panel.css`).

## The front end

```js
import { initTerminal } from './aipanel/ai-panel.js';
const ai = initTerminal({
  appName: 'Simple GLB Editor',          // used in texts and in {appName} in plugins
  status: text => showStatus(text),     // the app's status line or toast
  settings,                              // {get(key, default), set(key, value)}: kept under 'terminal'
  workFolder: () => libraryPath,         // the app's own folder, offered first in "Where should it work?"
  workFolderName: 'Library', workFolderIcon: '📚',
  below: () => document.querySelector('#menubar'), // optional: the drop-down hangs under this element
  bridge: window.aiPanelBridge,          // Electron: the preload's object (default); Python apps: httpBridge({...})
  notify, away,                          // optional: the app's own desktop notifications
  onShow, onHide,                        // optional
});
```

It returns `toggle(on)`, `open()`, `newConversation()`, `startIn(dir, agentId, message)`, `send(dir, message)`, `useAgent(id)`, `agents()`, `agent()`, `loadAgents()`, `signIn(id)`, `signOut()`, `refreshAuth()`, `folder()`, `running`, `version`, and for tests `_term`, `_findChoices()`, `_write(text)`.

The page also needs `xterm/xterm.css`, `ai-panel.css`, and the classic scripts `xterm/xterm.js` and `xterm/addon-fit.js` before the module runs.

Events: the panel fires `term-placed` and `panels-changed` on `window` when it opens, closes or docks; while docked it sets `body.termside` and `--term-w`, and the app makes room (e.g. `body.termside > #main { margin-right: calc(var(--term-w) + 12px); }`). Without `below`, the app sets `--term-top` (and `--term-side-top` / `--term-side-bottom` for the docked column) itself.

## Tests

```powershell
node test/check.mjs
```
CSS tokens only, every plugin valid and documented, and the Electron engine (plugin folders, fill-ins, both status formats, a `.cmd` program, environment).

```powershell
py -3.11 test/serve.py
```
then open http://127.0.0.1:5199/test/selftest.html: the whole panel against the Python engine and a fake assistant (`test/fake-agent.js`). Pick 🧪 Fake in ▾ › AI assistant; type `choices`, `menu`, `pick`, `env`, `bye`. In the browser console, `await choiceCases()` checks the answer bar against screens seen in real assistants (every line must say "ok").

## Versions

Tagged `v1.0.0`, `v1.1.0`… on GitHub ([CHANGELOG.md](CHANGELOG.md)). `AI_PANEL_VERSION` in `ai-panel.js`, `VERSION` in both engines and `package.json` say which one an app has.

**Updates without a rebuild (from v1.2.0):** at start the app's updater (`node/boot.js` / `python/aipanel_boot.py`, built into the app) asks GitHub for a newer 1.x, and the ▾ menu offers **Install / Not now / Skip this version**. It is used from the app's next start; **↩ Use the built-in AI panel** goes back. A new first number (2.0) still needs the apps rebuilt. The one-time change per app is in [ADOPTING.md](ADOPTING.md#panel-updates-without-a-rebuild-from-v120-a-one-time-change). So: **keep 1.x versions compatible** (same `initTerminal` options, bridge calls and engine `setup` / `configure`), or make it 2.0.
