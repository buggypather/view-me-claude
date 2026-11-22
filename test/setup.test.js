// The "Turn on usage percentages" command, with a stand-in for VS Code and a temporary home folder.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const Module = require('node:module');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vmc-home-'));
os.homedir = () => home;
const answers = [];
const shown = [];
const commands = {};
const fakeVscode = {
  window: {
    showInformationMessage: async (msg, _o, button) => (shown.push(msg), button ? answers.shift() : undefined),
    showWarningMessage: async (msg, _o, button) => (shown.push(msg), answers.shift()),
    showErrorMessage: async msg => shown.push('ERROR ' + msg),
    registerWebviewViewProvider: () => ({ dispose() {} }),
    createStatusBarItem: () => ({ show() {}, dispose() {} }),
  },
  commands: { registerCommand: (id, fn) => ((commands[id] = fn), { dispose() {} }), executeCommand: async () => {} },
  workspace: { getConfiguration: () => ({ get: (_k, d) => d }) },
  StatusBarAlignment: { Right: 2 },
};
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return request === 'vscode' ? 'vscode' : resolve.call(this, request, ...rest);
};
require.cache.vscode = { id: 'vscode', filename: 'vscode', loaded: true, exports: fakeVscode };
const { activate } = require('../extension');
activate({ subscriptions: [], extensionPath: path.join(__dirname, '..') });

const settingsPath = path.join(home, '.claude', 'settings.json');
const helper = path.join(home, '.view-me-claude', 'statusline.js').replace(/\\/g, '/');

test('adds the status line to new settings, after asking', async () => {
  answers.push('Add it');
  await commands['viewMeClaude.setupUsage']();
  const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.deepStrictEqual(s.statusLine, { type: 'command', command: `node "${helper}"` });
  assert.ok(fs.existsSync(path.join(home, '.view-me-claude', 'statusline.js')));
});

test('says so when it is already on', async () => {
  await commands['viewMeClaude.setupUsage']();
  assert.match(shown[shown.length - 1], /already on/);
});

test('keeps an existing status line through VIEW_ME_CLAUDE_NEXT, and backs up settings', async () => {
  fs.writeFileSync(settingsPath, JSON.stringify({ model: 'opus', statusLine: { type: 'command', command: 'my-line' } }));
  answers.push('Do that');
  await commands['viewMeClaude.setupUsage']();
  const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.strictEqual(s.model, 'opus');
  assert.strictEqual(s.env.VIEW_ME_CLAUDE_NEXT, 'my-line');
  assert.strictEqual(s.statusLine.command, `node "${helper}"`);
  assert.ok(fs.existsSync(settingsPath + '.before-view-me-claude'));
});

test('changes nothing when the user says no', async () => {
  fs.writeFileSync(settingsPath, JSON.stringify({ statusLine: { type: 'command', command: 'mine' } }));
  answers.push(undefined);
  await commands['viewMeClaude.setupUsage']();
  assert.strictEqual(JSON.parse(fs.readFileSync(settingsPath, 'utf8')).statusLine.command, 'mine');
});
