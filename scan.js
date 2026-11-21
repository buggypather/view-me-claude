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

/** All processes as { pid, name, cmd, started } — one cheap call per check. */
async function processes() {
  if (process.platform === 'win32') {
    const ps = "Get-CimInstance Win32_Process -Filter \"Name='node.exe' OR Name='claude.exe' OR Name='java.exe' OR Name='gradle.exe' OR Name='cmd.exe' OR Name='bun.exe'\" | ForEach-Object { '{0}\t{1}\t{2}\t{3}' -f $_.ProcessId, $_.Name, $_.CreationDate.ToString('o'), ($_.CommandLine -replace '\\s+',' ') }";
    const out = (await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], 15000)) || '';
    return out.split(/\r?\n/).filter(Boolean).map(l => { const [pid, name, started, cmd] = l.split('\t'); return { pid, name, started, cmd: cmd || '' }; });
  }
  const out = (await run('ps', ['-eo', 'pid=,lstart=,args='])) || '';
  return out.split('\n').filter(Boolean).map(l => {
    const m = /^\s*(\d+)\s+(\w+ \w+\s+\d+ [\d:]+ \d+)\s+(.*)$/.exec(l);
    return m ? { pid: m[1], started: new Date(m[2]).toISOString(), cmd: m[3], name: path.basename(m[3].split(' ')[0]) } : null;
  }).filter(Boolean);
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
  return { agents, builds };
}

function short(cmd) {
  const s = cmd.replace(/"/g, '').replace(/[A-Z]:\\[^ ]*\\|\/[^ ]*\//g, '');
  return s.length > 90 ? s.slice(0, 87) + '…' : s;
}

module.exports = { parseAdb, classify, phones, processes, short };
