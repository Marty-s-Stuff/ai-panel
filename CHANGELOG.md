# Changelog

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
