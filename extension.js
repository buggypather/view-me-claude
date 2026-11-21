// A panel with your phones, Claude agents and builds. It checks only while the panel is visible,
// so it costs nothing when closed (written for slow computers).
const vscode = require('vscode');
const { phones, processes, classify } = require('./scan');

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
      const { agents, builds } = classify(procs);
      if (this.view) this.view.webview.html = page(render(ph, agents, builds));
    } catch (e) {
      if (this.view) this.view.webview.html = page(`<p>Couldn't check: ${esc(String(e))}</p>`);
    } finally { this.busy = false; }
  }
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return isNaN(m) ? '' : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60}m`; };

function render(ph, agents, builds) {
  const phoneRows = !ph.ok ? '<li class="dim">adb not found: set viewMeClaude.adbPath</li>'
    : ph.list.length ? ph.list.map(p => `<li><b>${esc(p.model)}</b> <span class="${p.state === 'device' ? 'ok' : 'warn'}">${esc(p.state === 'device' ? 'ready' : p.state)}</span><br><span class="dim">${esc(p.serial)}</span></li>`).join('')
    : '<li class="dim">No phones connected</li>';
  const procRows = (list, none) => list.length ? list.map(p => `<li>${p.kind ? `<b>${esc(p.kind)}</b> ` : ''}${esc(p.label)}<br><span class="dim">pid ${esc(p.pid)} · ${ago(p.started)}</span></li>`).join('') : `<li class="dim">${none}</li>`;
  return `<h3>Phones (${ph.list.length})</h3><ul>${phoneRows}</ul>
<h3>Claude agents (${agents.length})</h3><ul>${procRows(agents, 'None running')}</ul>
<h3>Builds (${builds.length})</h3><ul>${procRows(builds, 'None running')}</ul>
<p class="dim">Updated ${new Date().toLocaleTimeString()}</p>`;
}

function page(body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><style>
*{font-family:var(--vscode-editor-font-family,monospace);transition:none!important;animation:none!important}
body{font-size:12px;color:var(--vscode-foreground);padding:4px 8px}
h3{font-size:12px;margin:12px 0 4px;text-transform:uppercase;opacity:.8}
ul{list-style:none;margin:0;padding:0}li{padding:4px 0;border-bottom:1px solid var(--vscode-panel-border);word-break:break-all}
.dim{opacity:.6}.ok{color:var(--vscode-testing-iconPassed)}.warn{color:var(--vscode-editorWarning-foreground)}
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
