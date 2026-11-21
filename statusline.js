#!/usr/bin/env node
// Claude Code status-line helper. Claude Code sends this script the session's details (including plan
// usage, when your version provides it) each time it redraws. We save them for the View Me Claude panel,
// then print a short status line. If you already had a status line, put its command in
// VIEW_ME_CLAUDE_NEXT and we'll pass the details on and print its line instead.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execSync } = require('node:child_process');
let raw = '';
process.stdin.on('data', c => (raw += c)).on('end', () => {
  let j = {};
  try { j = JSON.parse(raw); } catch {}
  try {
    const dir = path.join(os.homedir(), '.view-me-claude');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'usage.json'), JSON.stringify({ at: new Date().toISOString(), rate_limits: j.rate_limits, context_window: j.context_window }));
  } catch {}
  const next = process.env.VIEW_ME_CLAUDE_NEXT;
  if (next) { try { process.stdout.write(execSync(next, { input: raw, encoding: 'utf8', timeout: 5000 })); return; } catch {} }
  const r = j.rate_limits || {}, pc = x => (x && x.used_percentage != null ? Math.round(x.used_percentage) + '%' : '–');
  process.stdout.write(`${(j.model && j.model.display_name) || 'Claude'} · 5h ${pc(r.five_hour)} · week ${pc(r.seven_day)}`);
});
