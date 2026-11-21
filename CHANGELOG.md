# Changelog

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
