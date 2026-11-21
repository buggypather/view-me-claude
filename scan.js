// The checks, kept apart from VS Code so they can be tested with plain Node.
const { execFile } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');

function run(cmd, args, timeout = 8000) {
  return new Promise(res =>
    execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 4 << 20 }, (err, out) => res(err && !out ? null : String(out || '')))
  );
}

function findAdb(setting) {
  if (setting) return setting;
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk') : path.join(os.homedir(), process.platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk'));
  return [path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb'), 'adb'];
}

/** `adb devices -l` output → [{ serial, state, model }] */
function parseAdb(text) {
  return text.split(/\r?\n/).slice(1).map(l => l.trim()).filter(Boolean).map(l => {
    const [serial, state, ...rest] = l.split(/\s+/);
    const model = (rest.find(r => r.startsWith('model:')) || '').slice(6).replace(/_/g, ' ');
    return { serial, state, model: model || serial };
  });
}

async function phones(adbSetting) {
  const tries = [].concat(findAdb(adbSetting));
  for (const adb of tries) {
    const out = await run(adb, ['devices', '-l']);
    if (out !== null) return { ok: true, list: parseAdb(out) };
  }
  return { ok: false, list: [] };
}

/** All processes as { pid, ppid, name, cmd, started, ports } — one call per check. */
async function processes() {
  if (process.platform === 'win32') {
    const ps = "$l=@{}; Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $l[[int]$_.OwningProcess] += @($_.LocalPort) }; Get-CimInstance Win32_Process | ForEach-Object { '{0}\t{1}\t{2}\t{3}\t{4}\t{5}' -f $_.ProcessId, $_.ParentProcessId, $_.Name, $(if($_.CreationDate){$_.CreationDate.ToString('o')}), (($l[[int]$_.ProcessId] | Sort-Object -Unique) -join ','), ($_.CommandLine -replace '\\s+',' ') }";
    const out = (await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], 20000)) || '';
    return out.split(/\r?\n/).filter(Boolean).map(l => { const [pid, ppid, name, started, ports, cmd] = l.split('\t'); return { pid, ppid, name, started, ports: ports ? ports.split(',') : [], cmd: cmd || '' }; });
  }
  const out = (await run('ps', ['-eo', 'pid=,ppid=,lstart=,args='])) || '';
  const ports = await listening();
  return out.split('\n').filter(Boolean).map(l => {
    const m = /^\s*(\d+)\s+(\d+)\s+(\w+ \w+\s+\d+ [\d:]+ \d+)\s+(.*)$/.exec(l);
    return m ? { pid: m[1], ppid: m[2], started: new Date(m[3]).toISOString(), cmd: m[4], name: path.basename(m[4].split(' ')[0]), ports: ports[m[1]] || [] } : null;
  }).filter(Boolean);
}

/** pid → listening TCP ports (macOS/Linux, via lsof). */
async function listening() {
  const out = (await run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-F', 'pn'])) || '';
  const map = {}; let pid = null;
  for (const l of out.split('\n')) {
    if (l[0] === 'p') pid = l.slice(1);
    else if (l[0] === 'n' && pid) { const port = l.split(':').pop(); (map[pid] = map[pid] || []).includes(port) || map[pid].push(port); }
  }
  return map;
}

const AGENT = /(^|[\\/\s])claude(\.exe|\.cmd)?(\s|$)|@anthropic-ai[\\/]claude-code|claude-code[\\/].*cli\.js|anthropic\.claude-code/i;
const BUILD = [
  [/GradleDaemon|gradle-wrapper|gradlew|gradle(\.exe)?\s/i, 'Gradle'],
  [/vite(\.js)?\s+build|vite[\\/]bin/i, 'Vite'],
  [/npm(-cli\.js)?\s+run\s+(build|android|ios)|npx\s+cap\s+(sync|run|build)/i, 'npm'],
  [/tsc(\.js)?(\s|$)/i, 'tsc'],
  [/cargo\s+(build|run)/i, 'Cargo'],
];

/** Sorts processes into Claude agents and builds. */
function classify(procs) {
  const agents = [], builds = [];
  for (const p of procs) {
    const c = p.cmd || '';
    if (/view-me-claude/i.test(c) || /^(sh|bash|zsh|cmd\.exe)$/i.test(p.name || '') || c.length > 2000) continue;
    const b = BUILD.find(([re]) => re.test(c));
    if (b) builds.push({ ...p, kind: b[1], label: short(c) });
    else if (AGENT.test(c) && !/--type=|crashpad|language-server|tsserver/i.test(c)) agents.push({ ...p, label: short(c) });
  }
  // Servers: anything listening on a port whose parent chain leads back to a Claude agent.
  const byPid = new Map(procs.map(p => [p.pid, p]));
  const agentPids = new Set(agents.map(a => a.pid));
  const fromAgent = p => { for (let q = p, n = 0; q && n < 20; q = byPid.get(q.ppid), n++) if (agentPids.has(q.ppid)) return byPid.get(q.ppid); return null; };
  const servers = procs.filter(p => p.ports && p.ports.length && !agentPids.has(p.pid)).map(p => ({ p, a: fromAgent(p) })).filter(x => x.a)
    .map(({ p, a }) => ({ ...p, label: short(p.cmd), agent: a.pid }));
  return { agents, builds, servers };
}

function short(cmd) {
  const s = cmd.replace(/"/g, '').replace(/[A-Z]:\\[^ ]*\\|\/[^ ]*\//g, '');
  return s.length > 90 ? s.slice(0, 87) + '…' : s;
}

/** Plan usage, saved by the status-line helper (statusline.js) each time Claude Code redraws. */
function usage(file = path.join(os.homedir(), '.view-me-claude', 'usage.json')) {
  try {
    const u = JSON.parse(require('node:fs').readFileSync(file, 'utf8'));
    return { at: u.at, five: u.rate_limits && u.rate_limits.five_hour, week: u.rate_limits && u.rate_limits.seven_day, ctx: u.context_window && u.context_window.used_percentage };
  } catch { return null; }
}

/** Recent Claude Code sessions (last few days) that have gone quiet: a transcript in ~/.claude/projects not written for a while. */
function retired(liveMinutes = 15, days = 3) {
  const fs = require('node:fs');
  const root = path.join(os.homedir(), '.claude', 'projects');
  const now = Date.now(), list = [];
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch { return list; }
  for (const d of dirs) {
    let files = [];
    try { files = fs.readdirSync(path.join(root, d)).filter(f => f.endsWith('.jsonl')); } catch { continue; }
    for (const f of files) {
      const full = path.join(root, d, f);
      let st; try { st = fs.statSync(full); } catch { continue; }
      const age = now - st.mtimeMs;
      if (age < liveMinutes * 60000 || age > days * 864e5) continue;
      list.push({ id: f.slice(0, -6), project: projectName(d), last: new Date(st.mtimeMs).toISOString(), title: firstPrompt(full) });
    }
  }
  return list.sort((a, b) => b.last.localeCompare(a.last)).slice(0, 30);
}
const projectName = d => d.split('-').filter(Boolean).pop() || d;
function firstPrompt(file) {
  try {
    const fd = require('node:fs').openSync(file, 'r'), buf = Buffer.alloc(65536);
    const n = require('node:fs').readSync(fd, buf, 0, buf.length, 0); require('node:fs').closeSync(fd);
    for (const l of buf.toString('utf8', 0, n).split('\n')) {
      try {
        const j = JSON.parse(l);
        if (j.type === 'summary' && j.summary) return j.summary;
        if (j.type === 'user' && j.message) { const c = j.message.content; const t = typeof c === 'string' ? c : (c.find && (c.find(x => x.type === 'text') || {}).text); if (t && !t.startsWith('<')) return t.slice(0, 80); }
      } catch {}
    }
  } catch {}
  return '(untitled)';
}

module.exports = { parseAdb, classify, phones, processes, short, usage, retired };
