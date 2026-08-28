// Smoke test for orca-browser extension. Not part of pi's runtime — just a
// way to confirm the extension loads, registers tools, and a sample execute()
// round-trip works without needing to launch pi itself.
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
void _require; // keep the createRequire pattern documented for future edits

const jiti = _require(
  '/home/linuxbrew/.linuxbrew/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti'
);
const EXT_PATH = '/home/kermit/.pi/agent/extensions/orca-browser.ts';
const loaded = jiti(EXT_PATH, {
  interopDefault: true
});

const tools = [];
const events = [];
const fakePi = {
  registerTool(def) {
    tools.push({
      name: def.name,
      label: def.label,
      hasExecute: typeof def.execute === 'function',
      paramKeys: Object.keys(def.parameters?.properties ?? {})
    });
  },
  on(event) {
    events.push(event);
  },
  exec(_cmd, _args) {
    return Promise.resolve({
      stdout: JSON.stringify({ ok: true, result: { browserPageId: 'page-abc' } }),
      stderr: '',
      code: 0,
      killed: false
    });
  }
};

loaded(fakePi);

console.log(`Tools registered: ${tools.length}`);
console.log(`Events subscribed: ${events.join(', ')}`);
console.log('Tool surface:');
for (const t of tools) {
  console.log(`  - ${t.name.padEnd(22)} params=[${t.paramKeys.join(', ')}]`);
}

// Smoke-test one tool end-to-end.
const goto = tools.find((t) => t.name === 'browser_goto');
if (goto) {
  const result = await goto.execute('call-1', { url: 'https://example.com' }, undefined);
  console.log('\nbrowser_goto round-trip:');
  console.log(JSON.stringify(result, null, 2));
}

// Smoke-test error path: pretend orca exited with non-zero code.
fakePi.exec = () =>
  Promise.resolve({
    stdout: '',
    stderr: 'browser_no_tab: no active tab',
    code: 1,
    killed: false
  });
const snapshot = tools.find((t) => t.name === 'browser_snapshot');
if (snapshot) {
  try {
    await snapshot.execute('call-2', {}, undefined);
    console.log('\nFAIL: expected error to throw');
  } catch (err) {
    console.log('\nbrowser_snapshot error path (expected):');
    console.log(`  ${err.message}`);
  }
}
