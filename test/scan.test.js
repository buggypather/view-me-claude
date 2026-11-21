const test = require('node:test');
const assert = require('node:assert');
const { parseAdb, classify } = require('../scan');

test('reads adb devices', () => {
  const l = parseAdb('List of devices attached\nR5CX123 device product:a56 model:SM_A566B device:a56 transport_id:1\nemulator-5554 unauthorized\n\n');
  assert.deepStrictEqual(l.map(p => [p.model, p.state]), [['SM A566B', 'device'], ['emulator-5554', 'unauthorized']]);
});

test('sorts agents and builds', () => {
  const { agents, builds } = classify([
    { pid: '1', cmd: 'node C:\\Users\\a\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js' },
    { pid: '2', cmd: 'claude.exe --output-format stream-json' },
    { pid: '3', cmd: 'java -cp gradle-8.7 org.gradle.launcher.daemon.bootstrap.GradleDaemon 8.7' },
    { pid: '4', cmd: 'node node_modules/vite/bin/vite.js build' },
    { pid: '5', cmd: 'node server.js' },
  ]);
  assert.deepStrictEqual(agents.map(a => a.pid), ['1', '2']);
  assert.deepStrictEqual(builds.map(b => b.kind), ['Gradle', 'Vite']);
});

test('finds servers started by an agent', () => {
  const { servers } = classify([
    { pid: '10', ppid: '1', cmd: 'claude.exe' },
    { pid: '11', ppid: '10', cmd: 'cmd.exe /c npm run dev', name: 'x' },
    { pid: '12', ppid: '11', cmd: 'node vite.js --port 5173', ports: ['5173'] },
    { pid: '20', ppid: '1', cmd: 'node other.js', ports: ['3000'] },
  ]);
  assert.deepStrictEqual(servers.map(s => [s.pid, s.agent]), [['12', '10']]);
});
