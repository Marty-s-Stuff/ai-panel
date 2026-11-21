// A pretend AI assistant for the self-tests (no real AI usage). Started through fake-agent.cmd, like npm-installed tools.
//   (no args / --note <text>)  chat: a prompt; "choices" -> a numbered list; "menu" -> a ❯ menu; "pick" -> a ❯ menu without
//                              numbers (arrows + Enter answer it); "env" -> its session name; "bye" -> exits; else echoes
//   login / logout             prints a line and exits (as a sign-in flow would)
//   status                     plain-text status, like `codex login status`
//   --version                  a version line
const args = process.argv.slice(2), out = s => process.stdout.write(s.replace(/\n/g, '\r\n'));
if (args[0] === '--version') { out('fake-agent 1.0.0\n'); process.exit(0); }
if (args[0] === 'status') { out(process.env.FAKE_SIGNED_OUT ? 'Not logged in\n' : 'Logged in using ChatGPT\n'); process.exit(process.env.FAKE_SIGNED_OUT ? 1 : 0); }
if (args[0] === 'login' || args[0] === 'logout') { out(args[0] === 'login' ? 'Fake sign-in done.\n' : 'Fake sign-out done.\n'); setTimeout(() => process.exit(0), 300); }
else {
  const note = args[0] === '--note' ? args[1] : '';
  out(`Fake agent ready.${note ? ' Note: ' + note.slice(0, 40) : ''}\n> `);
  let line = '', pick = -1; const PICK = ['Yes, trust it', 'No, exit', 'Ask me later'];
  process.stdin.setRawMode?.(true);
  process.stdin.on('data', b => {
    const s = b.toString().replace(/\x1b\[20[01]~/g, '').replace(/\x1b\[([AB])/g, (m, d) => { if (pick >= 0) pick = Math.max(0, Math.min(PICK.length - 1, pick + (d === 'B' ? 1 : -1))); return ''; });
    for (const ch of s) {
      if ((ch === '\r' || ch === '\n') && pick >= 0) { out('Picked: ' + PICK[pick] + '\n> '); pick = -1; continue; }
      if (ch === '\r' || ch === '\n') {
        const cmd = line.trim(); line = ''; out('\n');
        if (cmd === 'bye') { out('Goodbye.\n'); process.exit(0); }
        if (cmd === 'pick') { out('Trust this folder?\n\n ❯ ' + PICK[0] + '\n   ' + PICK.slice(1).join('\n   ') + '\n\n Enter to confirm\n'); pick = 0; continue; }
        if (cmd === 'choices') out('Pick one:\n1. Red\n2. Green\n3. Something else - type what you want\n');
        else if (cmd === 'menu') out('Allow it?\n❯ 1. Yes\n  2. No\n');
        else if (cmd === 'env') out('Session: ' + process.env.AI_PANEL_SESSION_NAME + ' / ' + process.env.FAKE_APP_VAR + '\n');
        else if (cmd) out('You said: ' + cmd + '\n');
        out('> ');
      } else if (ch === '\x7f' || ch === '\b') { if (line) { line = line.slice(0, -1); out('\b \b'); } }
      else if (ch >= ' ') { line += ch; out(ch); }
    }
  });
}
