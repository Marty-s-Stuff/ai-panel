# Changelog

## v1.2.2 — 2026-11-21

- **Restart popup after an update**: "AI panel v… is installed. Restart <app> to use the latest terminal update", with **Restart now / Later** (also after "Use the built-in AI panel"). It says when a running conversation would be closed.
- **Restart now really restarts the app.** Electron apps need no change: `app.relaunch()` + `app.quit()`, relaunching the real `.exe` for portable builds; `setup({ restart })` can replace it. Python apps pass `configure(restart=<function>)`; without one, the popup asks you to close and reopen the app.
- The popup comes from the panel version that does the install, so it appears from installs made by v1.2.2 on.

## v1.2.1 — 2026-11-21

Fixes found by the Simple GLB Editor's session:
- The ▾ menu's items look like the app's own menu again (flat rows). The panel's button style now only covers its own buttons (`#claudeDropdown .splitbtn button`), not every item in the menu.
- Light themes: text an assistant prints in "white" (Claude Code's bold title, for example) was white on white. In light themes `white` / `brightWhite` / `black` now use the app's `--muted` / `--text` tokens.
- ADOPTING.md: load the panel in a non-blocking `(async () => { … })()` block, not with a top-level `await`.

## v1.2.0 — 2026-11-21

- **Panel updates without a rebuild.** At start the app asks GitHub for a newer 1.x; the ▾ menu shows a dot and offers **Install / Not now / Skip this version** (with a "What's new" link). An installed version is used from the app's next start; **↩ Use the built-in AI panel** goes back. The menu always ends with the running version ("AI panel v1.2.0 (built in)").
- The updater (`node/boot.js`, `python/aipanel_boot.py`) is built into each app and never replaced by an update. It only uses versions with the built-in one's first number, from 1.2.0 on, checks the tag against GitHub's own list, and only unpacks the panel's own files.
- New bridge call `update(what, tag)` (preload: IPC `aipanel:update`; HTTP: `/api/term/update`); `setup({ boot, pty })` / `configure(boot=…)`; `checkUpdate()` on the panel's handle.
- **One-time change per app**: ADOPTING.md › "Panel updates without a rebuild".

## v1.1.0 — 2026-11-21

- **Floating window**: a third layout (after drop-down and docked right). Drag it by its title row and resize it at its corner; its position and size are kept (settings `terminal.float`) and it stays on screen when the app window shrinks.
- **Answer buttons for menus without numbers** ("❯ Yes, I trust this folder" in Claude Code, Kiro's "Login now? > Yes / No"). A click moves the highlight with the arrow keys and presses Enter. The question line above the choices is left out.
- **Theme tokens for shape and font**: `--ai-round` (0 = square corners, for a Windows 10 look) and `--ai-font`. Apps style the panel through their own themes (README › App themes).
- The fake assistant in the self-test has a `pick` command (a menu without numbers).

## v1.0.0 — 2026-11-21

First shared version, made from the Simple GLB Editor's panel and Hollow Editor's copy of it.

- One widget for every app: `ai-panel.html` / `.css` / `.js`, an Electron engine (`node/`) and a Python engine (`python/`) that read the same plugins.
- No "Claude" left in the panel's own texts: the picked assistant's name is used everywhere; the app's name comes from `appName` (and `{appName}` in plugins).
- CSS uses the app's theme tokens only (checked by `test/check.mjs`); the terminal's colours come from the tokens too. Optional `--ai`, `--ok`, `--on-primary`.
- `below` option: the drop-down and the docked column start under an element the app names.
- Shared plugins folder `%APPDATA%\ai-agents` (the old per-app folders are still read).
- Plain-text sign-in status (`status.match`), for assistants without a JSON status (OpenAI Codex).
- `.cmd` programs (npm-installed tools) work for the status check in the Electron engine.
- Built-in plugins: Claude Code, OpenAI Codex, Google Antigravity, GitHub Copilot, Kiro (`agents/CHECKS.md` says what was checked).
- Fixed: the panel's first open never started the assistant (it checked the terminal's buffer length, which is never ≤ 1), so the panel looked empty and the "not installed" hint didn't show. Switching to an assistant that isn't installed now shows the hint straight away.
- Self-tests with a fake assistant (no real AI usage): `test/check.mjs`, `test/serve.py` + `test/selftest.html`.
- `python/sync.py`: copies a tagged version from GitHub into a Python app before its build.
