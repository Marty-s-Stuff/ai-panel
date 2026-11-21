# Plugin checks (2026-11-21)

Docs were read from the vendors' own sites on 2026-11-21 (via a fetch helper, so a few pages were only summarised, noted below). Nobody was signed in. Real chat and sign-in are untested for all four.

## OpenAI Codex CLI (`codex.json`)
- Docs: https://github.com/openai/codex, https://developers.openai.com/codex/cli (redirects to learn.chatgpt.com/docs/codex/cli), /codex/auth (-> learn.chatgpt.com/docs/auth), /codex/cli/reference (-> learn.chatgpt.com/docs/developer-commands?surface=cli), /codex/guides/agents-md (-> learn.chatgpt.com/docs/agent-configuration/agents-md), learn.chatgpt.com/codex/config-file/environment-variables, learn.chatgpt.com/codex/windows/wsl. The auth and reference pages were partly summarised.
- Install: official PowerShell installer `powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"` (the script was downloaded and read first; it fetches from releases.openai.com, checks a sha256). No winget in the docs. Size not stated in docs; the Windows package on the release is 161 MB (zst) to 215 MB (tar.gz). Installed to `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe` and added to the user PATH.
- `codex --version` -> `codex-cli 0.171.0`
- `codex login status` signed out -> `Not logged in`, exit code 1.
- Sign-in: `codex login` (browser, ChatGPT), `codex login --device-auth` (beta; must be enabled in ChatGPT security settings). API key: the docs only give `printenv OPENAI_API_KEY | codex login --with-api-key` (stdin), which the app must not do. `OPENAI_API_KEY` is NOT documented as read by the interactive tool, and `CODEX_API_KEY` is documented for non-interactive runs only. So the API-key route in the plugin is "Codex's own sign-in screen" (args `[]`), where the key is pasted into Codex's own prompt.
- Sign-out: `codex logout` (no flags).
- System prompt: `-c developer_instructions=<text>` works. Tested with `codex debug prompt-input -c ...`: the text appears in the model input (the raw, unquoted form is accepted). Not in the docs pages read; keep `panelNote` free of double quotes and backslashes. AGENTS.md is also read (`~/.codex/AGENTS.md`, then project root down to the current folder).
- Not tested / unknown: the exact text when signed in (guess: "Logged in using ChatGPT" / "Logged in using an API key"; the status regexes `loggedIn` and `methods` are written to be loose for that); whether the third sign-in choice (no args) really offers an API-key option; Windows sandbox behaviour and whether the TUI runs well inside ConPTY; whether Free ChatGPT accounts can use the CLI (sources conflict).
- `dropEnv`: none (the docs do not say any env var overrides the stored sign-in).

## Google Antigravity CLI (`antigravity.json`)
- Docs: https://antigravity.google/docs/getting-started (the old /docs/cli/install redirects to /docs/install?tab=cli), /docs/cli/reference/, /docs/cli/headless/, /docs/rules/. Not read: /docs/cli/troubleshooting/, /docs/settings, /docs/permissions, /docs/cli/using/.
- Install: `irm https://antigravity.google/cli/install.ps1 | iex` (script read first; it downloads from storage.googleapis.com, checks sha512). Size 238.6 MB (`cli_windows_x64.exe`). Installed to `%LOCALAPPDATA%\agy\bin\agy.exe`; that folder was added to the user PATH (new terminals see it; the install script still printed a warning because the current session had not refreshed).
- `agy --version` -> `1.5.14`
- Status: none exists (no `agy status`/`whoami`/`login`/`logout`). The `status` block is left out. Signed-out check not possible.
- Sign-in: automatic on first start (browser, Google OAuth, paste code back over SSH). Gemini API key route needs `"modelProvider": "gemini"` in `~/.gemini/antigravity-cli/settings.json` plus a `GEMINI_API_KEY` env var; `GEMINI_API_KEY` alone does nothing. Sign-out: `/logout` inside the chat (no effect with an API key).
- Instructions: no CLI flag for a system prompt. Reads `AGENTS.md` / `GEMINI.md` / `.agents/rules/*.md` from the start folder up to the repo root, and `~/.gemini/AGENTS.md`. Other flags: `-i "prompt"` (initial prompt, interactive), `-p` (print mode), `--settings <json>` (per-session settings).
- Not tested: everything past `--version` and `--help`. `dropEnv`: none (docs say env vars only matter with `modelProvider` set).

## GitHub Copilot CLI (`github-copilot.json`)
- Docs: https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli, .../authenticate-copilot-cli, .../customize-copilot/add-custom-instructions, https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference, https://github.com/github/copilot-cli. The command reference was partly summarised.
- Install: `winget install GitHub.Copilot` (MSI from github.com/github/copilot-cli, 129.9 MB). Also installed winget dependency Microsoft.PowerShell 7.7 (the package requires it; not asked for separately). Installed to `%LOCALAPPDATA%\GitHubCopilotCLI\copilot.exe`, on PATH.
- `copilot --version` -> `GitHub Copilot CLI 1.0.114.` then `Run 'copilot update' to check for updates.`
- Status: none (no whoami). `/user` inside the chat; `gh auth status` outside.
- Sign-in: `copilot login` (browser flow on desktop; `--web-flow` / `--device-code` force a mode; `--with-token` reads stdin, not used). Sign-out: **there is no `copilot logout` command** (checked: `copilot logout` -> "Invalid command format"). The docs give `/logout` inside the chat. So the draft's `signOut` was removed.
- Token env vars `COPILOT_GITHUB_TOKEN`, then `GH_TOKEN`, then `GITHUB_TOKEN` silently override the stored sign-in (docs + `copilot login --help`), so they are in `dropEnv`. Side effect: someone who deliberately uses a token from the environment loses it in the panel.
- Instructions: no flag for a system prompt. Reads `AGENTS.md`, `.github/copilot-instructions.md`, `CLAUDE.md`, `GEMINI.md`, `~/.copilot/copilot-instructions.md`; env var `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` (comma list of extra folders with `AGENTS.md`) could point at a folder the engine writes the panel note into (not done). `-i "prompt"` starts interactive with a first prompt.
- Not tested: real sign-in/chat, whether `/logout` removes the Windows Credential Manager entry.

## Kiro CLI (`kiro.json`)
- Docs: https://kiro.dev/docs/getting-started/installation/ (old /docs/cli/installation/ redirects there), /docs/cli/, /docs/getting-started/authentication/, /docs/reference/cli-commands/, /docs/cli/chat/, /docs/steering/, /docs/custom-agents/, /docs/reference/exit-codes/.
- Install: the docs show only `curl -fsSL https://cli.kiro.dev/install | bash`, but the PowerShell script `irm 'https://cli.kiro.dev/install.ps1' | iex` exists and works (script read first; it downloads an MSI and checks sha256). Size 345 MB (361,938,944 bytes). The script says "C:\Program Files\Kiro-Cli\" but it actually installed per-user to `%LOCALAPPDATA%\Kiro-Cli\kiro-cli.exe`; no admin prompt appeared. Added to PATH.
- `kiro-cli --version` -> `kiro-cli 3.5.0`
- `kiro-cli whoami` signed out -> `Not logged in`, exit code 1. `kiro-cli whoami --format json` signed out -> `{"account":null}`, exit code 1. The signed-in JSON field names are NOT documented and could not be seen, so the plugin uses the plain-text `whoami` (docs: `Logged in with Builder ID`, `Logged in with IAM Identity Center (<url>)`). Note: the exit code is 1 when signed out, so the engine must read the output rather than rely on exit 0.
- Sign-in: `kiro-cli login` (picker: Builder ID / Google / GitHub / Identity Center), `--use-device-flow` for remote. Docs say `--license`/`--social` are generally ignored locally. Sign-out: `kiro-cli logout`. API key: `KIRO_API_KEY` (Pro-and-up plans only); sign-in via browser wins over it, so no `dropEnv`.
- Instructions: no system-prompt flag. Reads `AGENTS.md` and `.kiro/steering/*.md` (workspace) and `~/.kiro/steering/`. Custom agents (`.kiro/agents/<name>.json` with a `prompt` field) selected with `--agent`.
- Not tested: signed-in whoami text, the sign-in menu inside the panel.
