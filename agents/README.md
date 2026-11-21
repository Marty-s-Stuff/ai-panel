# AI assistant plugins

The AI panel (the **🤖** button at the end of the app's menu line, Ctrl+`) runs a command-line AI assistant in a terminal inside the app. Each assistant is described by one plugin file: a `.json` file in

- **the built-in folder** (`agents/`, shipped with the panel): Claude Code, OpenAI Codex, Google Antigravity, GitHub Copilot and Kiro.
- **your plugins folder**: `%APPDATA%\ai-agents\`, **shared by every app**. Drop a `.json` file in it and reopen the ▾ menu's assistant list. A file with the same `id` as a built-in plugin replaces it (to change how Claude starts, for example). **➕ Add another assistant…** opens this folder.
- (still read, so nothing is lost: the older per-app folders `%APPDATA%\simple-glb-editor\agents\` and `%USERPROFILE%\.hollow-editor\agents\`.)

The ▾ menu lists every plugin, and you pick which one the panel uses. The panel, the answer buttons, the "Where should it work?" box and the notifications work the same for every plugin.

The app only ever starts the commands a plugin lists, and signing in is the assistant's own flow (usually in your browser), so the app never sees passwords or keys. Only install plugins you trust: a plugin decides which program runs.

## Letting the assistant drive the app

The panel gives the assistant a terminal in the folder you pick. To let it control the app itself (open, edit, save…), the assistant needs the app's **MCP server**, registered in that assistant's own settings. Each assistant is started with `AI_PANEL_SESSION_NAME` = "In-app <name>" (and the app's own variable, e.g. `GLB_SESSION_NAME`) so the MCP server can name its session.

## The file

```json
{
  "id": "my-assistant",
  "name": "My Assistant",
  "program": "My Assistant CLI",
  "icon": "✨",
  "description": "Shown as the tooltip in the ▾ menu. {appName} = the app's name.",
  "find": { "commands": ["my-assistant"], "paths": ["~/.local/bin/my-assistant.exe"] },
  "install": { "command": "winget install MyAssistant", "shell": "PowerShell", "url": "https://example.com/my-assistant" },
  "chat": { "args": ["--system-prompt-append", "{panelNote}"] },
  "version": { "args": ["--version"] },
  "env": { "MY_ASSISTANT_COLOR": "1" },
  "dropEnv": ["^MY_ASSISTANT_TOKEN$"],
  "status": {
    "args": ["auth", "status", "--json"],
    "json": { "loggedIn": "loggedIn", "method": "method" },
    "methods": { "subscription": "My subscription", "api": "API key" }
  },
  "signIn": [
    { "id": "browser", "label": "Sign in…", "tip": "Opens the sign-in page in your browser.", "args": ["login"], "intro": "Your browser opens; finish there." }
  ],
  "signOut": { "args": ["logout"], "confirm": "Sign My Assistant out on this computer?" },
  "panelNote": "You are running inside {appName}'s AI panel. Offer choices as a numbered list at the end of your message."
}
```

| Field | Needed | What it does |
|---|---|---|
| `id` | yes | Unique name. The same id as a built-in plugin replaces it. |
| `find` | yes | How to find the program: `commands` are looked up on the PATH (`.exe`, `.cmd`, `.bat`), then `paths` are tried (`~` = your home folder). |
| `chat` | yes | Arguments for a conversation. `{panelNote}` is replaced by `panelNote`, `{appName}` by the app's name. |
| `name`, `program`, `icon`, `description` | no | What the button, panel header and menu show. |
| `install` | no | Shown in the panel when the program is not found. |
| `version` | no | A quick command, used by self-tests. |
| `env` | no | Extra environment variables. |
| `dropEnv` | no | Regular expressions: environment variables to remove before starting (e.g. markers of a session that opened the app, or tokens that would silently sign the assistant in). |
| `status` | no | A command that tells whether you are signed in. Its output is read in one of two ways:<br>• **JSON**: `json.loggedIn` / `json.method` are the fields to read (dotted paths work, `a.b.c`), and `methods` turns the method into readable words.<br>• **plain text**: `"match": { "loggedIn": "<regex>", "methods": { "<regex>": "readable words" } }`. The regexes are tested (ignoring case, `^`/`$` per line) against everything the command prints.<br>Without `status` the menu just says the assistant is ready. |
| `signIn` | no | Sign-in choices for the **▾** menu, each with its own arguments. |
| `signOut` | no | The sign-out command (with an optional confirmation question). |
| `panelNote` | no | Text handed to the assistant through `{panelNote}`. The answer bar turns a numbered list (1. 2. 3.) or A) B) C) at the end of its message into buttons, so asking for that helps. |
