// A panel with your phones, Claude agents and builds. It checks only while the panel is visible,
// so it costs nothing when closed (written for slow computers).
const vscode = require('vscode');
const { phones, processes, classify, usage, retired } = require('./scan');

class Panel {
  constructor() { this.view = null; this.timer = null; this.busy = false; }
  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: false };
    view.webview.html = page('<p>Checking…</p>');
    view.onDidChangeVisibility(() => (view.visible ? this.start() : this.stop()));
    view.onDidDispose(() => { this.stop(); this.view = null; });
    this.start();
  }
  start() {
    this.stop();
    this.refresh();
    const secs = Math.max(3, vscode.workspace.getConfiguration('viewMeClaude').get('intervalSeconds', 10));
    this.timer = setInterval(() => this.refresh(), secs * 1000);
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  async refresh() {
    if (!this.view || !this.view.visible || this.busy) return;
    this.busy = true;
    try {
      const cfg = vscode.workspace.getConfiguration('viewMeClaude');
      const [ph, procs] = await Promise.all([phones(cfg.get('adbPath', '')), processes()]);
      const { agents, builds, servers } = classify(procs);
      if (this.view) this.view.webview.html = page(render(ph, agents, builds, servers, usage(), retired()));
    } catch (e) {
      if (this.view) this.view.webview.html = page(`<p>Couldn't check: ${esc(String(e))}</p>`);
    } finally { this.busy = false; }
  }
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return isNaN(m) ? '' : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60}m`; };

function render(ph, agents, builds, servers, use, gone) {
  const phoneRows = !ph.ok ? '<li class="dim">adb not found: set viewMeClaude.adbPath</li>'
    : ph.list.length ? ph.list.map(p => `<li><b>${esc(p.model)}</b> <span class="${p.state === 'device' ? 'ok' : 'warn'}">${esc(p.state === 'device' ? 'ready' : p.state)}</span><br><span class="dim">${esc(p.serial)}</span></li>`).join('')
    : '<li class="dim">No phones connected</li>';
  const procRows = (list, none) => list.length ? list.map(p => `<li>${p.kind ? `<b>${esc(p.kind)}</b> ` : ''}${esc(p.label)}<br><span class="dim">pid ${esc(p.pid)} · ${ago(p.started)}</span></li>`).join('') : `<li class="dim">${none}</li>`;
  const bar = (label, x) => {
    if (!x || x.used_percentage == null) return `<li class="dim">${label}: not known yet</li>`;
    const pct = Math.round(x.used_percentage), reset = x.resets_at ? new Date(typeof x.resets_at === 'number' ? x.resets_at * 1000 : x.resets_at) : null;
    return `<li>${label}: <b class="${pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : 'ok'}">${pct}%</b>${reset ? ` <span class="dim">resets ${reset.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>` : ''}<div class="track"><div style="width:${Math.min(100, pct)}%"></div></div></li>`;
  };
  const usageRows = use ? bar('5-hour session', use.five) + bar('Week', use.week) + (use.ctx != null ? `<li>Context: <b>${Math.round(use.ctx)}%</b></li>` : '') + `<li class="dim">as of ${new Date(use.at).toLocaleTimeString()}</li>`
    : '<li class="dim">Turn on the status-line helper (see README) to see usage.</li>';
  const serverRows = servers.length ? servers.map(s => `<li><b>:${esc(s.ports.join(', :'))}</b> ${esc(s.label)}<br><span class="dim">pid ${esc(s.pid)} · from agent ${esc(s.agent)} · ${ago(s.started)}</span></li>`).join('') : '<li class="dim">None running</li>';
  const goneRows = gone.length ? gone.map(g => `<li>${esc(g.title)}<br><span class="dim">${esc(g.project)} · ${ago(g.last)} ago</span><br><code>claude --resume ${esc(g.id)}</code></li>`).join('') : '<li class="dim">None in the last 3 days</li>';
  return `<h3>Usage</h3><ul>${usageRows}</ul>
<h3>Phones (${ph.list.length})</h3><ul>${phoneRows}</ul>
<h3>Claude agents (${agents.length})</h3><ul>${procRows(agents, 'None running')}</ul>
<h3>Builds (${builds.length})</h3><ul>${procRows(builds, 'None running')}</ul>
<h3>Servers from agents (${servers.length})</h3><ul>${serverRows}</ul>
<details><summary>Retired agents (${gone.length})</summary><ul>${goneRows}</ul></details>
<p class="dim">Updated ${new Date().toLocaleTimeString()}</p>`;
}

function page(body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><style>
*{font-family:var(--vscode-editor-font-family,monospace);transition:none!important;animation:none!important}
body{font-size:12px;color:var(--vscode-foreground);padding:4px 8px}
h3{font-size:12px;margin:12px 0 4px;text-transform:uppercase;opacity:.8}
ul{list-style:none;margin:0;padding:0}li{padding:4px 0;border-bottom:1px solid var(--vscode-panel-border);word-break:break-all}
.dim{opacity:.6}.bad{color:var(--vscode-errorForeground)}summary{cursor:pointer;font-weight:bold;text-transform:uppercase;margin-top:12px}code{font-size:11px;user-select:all}.track{height:4px;background:var(--vscode-panel-border);margin-top:2px}.track div{height:4px;background:var(--vscode-progressBar-background)}.ok{color:var(--vscode-testing-iconPassed)}.warn{color:var(--vscode-editorWarning-foreground)}
</style></head><body>${body}</body></html>`;
}

function activate(ctx) {
  const panel = new Panel();
  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider('viewMeClaude.panel', panel),
    vscode.commands.registerCommand('viewMeClaude.refresh', () => panel.refresh()),
    vscode.commands.registerCommand('viewMeClaude.toggle', async () => {
      if (panel.view && panel.view.visible) await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar').then(undefined, () => vscode.commands.executeCommand('workbench.action.closeSidebar'));
      else await vscode.commands.executeCommand('viewMeClaude.panel.focus');
    })
  );
  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  bar.text = '$(device-mobile) View';
  bar.tooltip = 'Toggle View Me Claude';
  bar.command = 'viewMeClaude.toggle';
  bar.show();
  ctx.subscriptions.push(bar);
}
module.exports = { activate, deactivate() {} };
