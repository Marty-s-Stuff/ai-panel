# Adding the AI panel to an app

Each app names **one version tag** and gets it **when the app is rebuilt**, from GitHub (`Marty-s-Stuff/ai-panel`). Nothing changes while an app runs. To update an app later, change its tag and rebuild.

Each app has its own Claude session; that session does the switch, one app at a time. **Keep everything the app's panel does today** (check the list at the end).

## Electron apps (Simple GLB Editor, Simple A/V Editor)

1. **Dependency.** In `package.json` → `dependencies`: `"ai-panel": "github:Marty-s-Stuff/ai-panel#v1.0.0"`, then `npm install`. The app's own `node-pty` and `@xterm/*` stay as they are (the panel uses the app's `node-pty`).
2. **Front-end files.** The page can't load from `node_modules` in the packaged app, so copy them where the page's other files are. In the GLB editor, `scripts/vendor.js` (run by `npm run dist`) is the place: copy `node_modules/ai-panel/{ai-panel.html, ai-panel.css, ai-panel.js, xterm/}` to `vendor/ai-panel/`. An app without xterm yet uses the panel's `xterm/` folder.
3. **Main process.** Remove the app's own "AI assistant plugins + in-app terminal" code (in the GLB editor: `main.js`, from that comment to `app.on('will-quit', … terms …)`). **Keep what sits in between and isn't the terminal**: `menu:get`, `menu:run`, `win:focus`, `app.setAppUserModelId`. Then add:
   ```js
   require('ai-panel').setup({ ipcMain, app, shell, dialog, getWin: () => win, appName: 'Simple GLB Editor', sessionVar: 'GLB_SESSION_NAME' });
   ```
   `sessionVar` is the variable the app's MCP server reads to name the assistant's session. Leave it out if the app has no MCP server.
4. **Preload.** Replace the app's terminal bridge with the block in `node/preload.js` (a sandboxed preload can't `require` it, so copy it). It exposes `window.aiPanelBridge`. (If the app keeps the old name `window.glbTerm`, the panel finds that too.)
5. **Markup.** Replace the app's `#claudeDropdown` and `#term` blocks with `ai-panel.html`. Paste it, or load it at start like Hollow Editor does. The button goes at the **right end of the menu line**; the panel goes at the end of `<body>`.
6. **CSS.** Link `vendor/ai-panel/xterm/xterm.css` and `vendor/ai-panel/ai-panel.css`, and remove the app's old `#term…`, `.term-…`, `#termCard`, `#termChoices`, `#termWs`, `.ws-…`, `.splitbtn` and `#btnClaude` rules. To keep the GLB editor's look, add to its `:root`: `--ai: #7e57c2; --ok: #81c784;`, and to `:root[data-theme="light"]`: `--ok: #2e7d32;`. Keep the app's own rule that makes room for the docked panel (`body.termside > #main …`).
7. **Front end.** Load `xterm/xterm.js` and `xterm/addon-fit.js` as classic scripts, then:
   ```js
   import { initTerminal } from '../vendor/ai-panel/ai-panel.js';
   const claudeTerm = initTerminal({ appName: 'Simple GLB Editor', status, settings, workFolder: () => libraryPath,
     workFolderName: 'Library', workFolderIcon: '📚', notify, away, onShow, onHide });
   ```
   Pass `below: () => document.querySelector('#menubar')`, or keep the app's own code that sets `--term-top` / `--term-side-top` / `--term-side-bottom` (the GLB editor's `placeTerm()`). Fire `theme-changed` on `window` when the theme switches.
8. **Build.** Make sure the packaged app includes `node_modules/ai-panel/**` (electron-builder includes dependencies by itself) and `vendor/ai-panel/**`.

## Python apps (Hollow Editor)

1. **Getting it.** Copy `python/sync.py` from this repo into the app's own tools, **outside** the folder it fills (Hollow: `editor/tools/ai_panel_sync.py`), so the build can run it before that folder exists. Then have the build run it before PyInstaller, with the version on one line (Hollow: `AI_PANEL_VERSION` in `editor/tools/build_exe.py`):
   ```
   py <editor>/tools/ai_panel_sync.py v1.1.0 <editor>/ai-panel
   ```
   The script only replaces a folder it made itself (it writes `.ai-panel-version` in it), so the app's current `aipanel/` folder must be retired by hand, not overwritten.
   Use a folder name with a hyphen (`ai-panel/`): the engine module is called `aipanel`, and a folder with the same name would hide it.
2. **Server.**
   ```python
   sys.path.insert(0, os.path.join(EDITOR_DIR, 'ai-panel', 'python'))
   import aipanel
   aipanel.configure(app_name='Hollow Editor', session_var='HOLLOW_SESSION_NAME', builtin_dir=os.path.join(EDITOR_DIR, 'ai-panel', 'agents'))
   # the route (POST only, so other sites can't read it):
   if method == 'POST' and path.startswith('/api/term/'):
       return 200, aipanel.handle(path[len('/api/term/'):], j())
   ```
   Call `aipanel.kill_all()` when the server stops. Serve `ai-panel/` as static files. Pass `builtin_dir` explicitly, because inside a PyInstaller exe the module's own path isn't the folder.
3. **PyInstaller.** Add `ai-panel` to the data folders, `aipanel` to the hidden imports (with `ai-panel/python` on the search path), and keep `--collect-all winpty`.
4. **Front end.**
   ```js
   import { initTerminal } from '/ai-panel/ai-panel.js';
   import { httpBridge } from '/ai-panel/bridge-http.js';
   const term = initTerminal({ appName: 'Hollow Editor', status: toast, settings, workFolder: () => projectPath,
     workFolderName: 'your game', workFolderIcon: '🎮',
     bridge: httpBridge({ headers: { 'X-Hollow': '1' }, pickFolder: start => post('/api/pick', { kind: 'folder', title: 'Where should the AI assistant work?', start }).then(j => (j.ok ? j.path : null), () => null) }) });
   ```
   `term.send(dir, message)` and `term.startIn(dir, agentId, message)` work as before (the "Send to <agent>" buttons).

## Panel updates without a rebuild (from v1.2.0): a one-time change

From v1.2.0 the panel can update itself: at start the app asks GitHub for a newer **1.x**, and the ▾ menu offers **Install / Not now / Skip this version**. An installed version is used from the app's **next start**; **↩ Use the built-in AI panel** goes back. Only versions with the same first number as the built-in one are used (a 2.0 still needs a rebuild), and never versions before 1.2.0.

The choosing is done by a small **boot** file that is built into the app and never replaced by an update, so a bad update can always be undone. Each app needs this once:

**Electron apps**
1. `package.json`: `"ai-panel": "github:Marty-s-Stuff/ai-panel#v1.2.0"`, then `npm install`.
2. `main.js`: replace the `require('ai-panel').setup({...})` line with
   ```js
   const aiBoot = require('ai-panel/node/boot.js').createBoot({ updateDir: path.join(app.getPath('userData'), 'ai-panel') });
   require(path.join(aiBoot.dir, 'node', 'aipanel.js')).setup({ ipcMain, app, shell, dialog, getWin: () => win, appName: '…', sessionVar: '…', boot: aiBoot, pty: require('node-pty') });
   ```
   (`pty` matters: an updated copy lives outside the app, where `require('node-pty')` would not find the app's own.)
3. Preload: add the new last line of `node/preload.js` to the app's copy: `update: (what, tag) => ipcRenderer.invoke('aipanel:update', what, tag),`
4. **Serve the page's panel files from `aiBoot.dir`**: wherever the page loads `ai-panel.html` / `.css` / `.js`, `bridge-http.js` and `xterm/` (the GLB editor: `vendor/ai-panel/…`), answer those requests from `aiBoot.dir` instead of the copy made at build time. `aiBoot.dir` is `node_modules/ai-panel` (built in, inside the app's asar) or the installed version's folder.

**Python apps (Hollow Editor)**
1. Copy `python/aipanel_boot.py` into the app's tools, next to `ai_panel_sync.py` (outside the synced folder), and bump the synced version to `v1.2.0`.
2. Server:
   ```python
   import aipanel_boot
   AI_BOOT = aipanel_boot.Boot(builtin_dir=os.path.join(EDITOR_DIR, 'ai-panel'), update_dir=os.path.join(os.path.expanduser('~'), '.hollow-editor', 'ai-panel'))
   sys.path.insert(0, os.path.join(AI_BOOT.dir, 'python'))
   import aipanel
   aipanel.configure(app_name='Hollow Editor', session_var='HOLLOW_SESSION_NAME', builtin_dir=os.path.join(AI_BOOT.dir, 'agents'), boot=AI_BOOT)
   ```
   and serve `/ai-panel/…` from `AI_BOOT.dir`.
3. PyInstaller: bundle `aipanel_boot` as a normal module, but **not** `aipanel` (a bundled copy would win over a downloaded one; it is imported from `AI_BOOT.dir` at run time). Keep `ai-panel/` as data and `--collect-all winpty`; add hidden imports for the standard modules `aipanel.py` uses (`itertools`, `json`, `re`, `shutil`, `subprocess`, `threading`).

**Check:** the ▾ menu ends with "AI panel v1.2.0 (built in)". When v1.2.1 is out: a dot on ▾ → Install → restart → "AI panel v1.2.1 (updated)"; then ↩ Use the built-in AI panel → restart → "v1.2.0 (built in)" again.

## Check after switching (everything the panel did before)

- the 🤖 button opens and closes it, Ctrl+` too, and the ▾ menu shows the sign-in state
- Claude signs in and out both ways (subscription / Anthropic API)
- answer buttons, Esc / Enter / arrow buttons, Shift+Enter, drop-down → docked → floating (drag, resize), both resize grips, light and dark theme (and any other theme the app has)
- New conversation → "Where should it work?" → it starts there; recent folders are remembered (the settings key is still `terminal`)
- notifications while the window isn't in front
- the app's MCP server still names the session (`GLB_SESSION_NAME` / `HOLLOW_SESSION_NAME`)
- your plugins still show (old per-app folders are still read; new ones go in `%APPDATA%\ai-agents`)
- Hollow: `send` / `startIn` and its "Send to <agent>" buttons
- the app's own self-test, if it has one
