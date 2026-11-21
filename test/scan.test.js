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
