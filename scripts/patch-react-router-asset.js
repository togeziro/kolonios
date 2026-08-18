// Fixes React hydration mismatch #418 caused by asymmetric <script> rendering
// in TanStack Router's Asset component (packages/react-router/src/Asset.tsx).
//
// Root cause: when a route manifest script (e.g. the dev-client entry
// `virtual:tanstack-start-dev-client-entry`) has `preventScriptHoist: true`,
// the SERVER branch renders <script src> with `onLoad={noopScriptHandler}` so
// React Fizz emits it in-place (body) instead of hoisting to <head>. The
// CLIENT branch (`!hydrated`) renders the same script WITHOUT `onLoad`, so
// React (client) hoists it to <head> — a different position than the SSR
// output — and hydration fails with "Minified React error #418".
//
// Fix: render `onLoad={noopScriptHandler}` in the client branch too, so both
// sides emit the script in the same position. The script is then moved to
// <head> by Asset's useEffect after mount.
//
// The patch is idempotent: it no-ops if already applied. Re-applied on every
// `bun install` via scripts/postinstall.js. Upstream tracking:
// https://github.com/TanStack/router (Asset.tsx) — remove once fixed.
const fs = require('fs');
const path = require('path');

const target = 'node_modules/@tanstack/react-router/dist/esm/Asset.js';

const sentinel =
  'if (!hydrated) {\n\t\tif (attrs?.src) return /* @__PURE__ */ jsx("script", {\n\t\t\t...attrs,\n\t\t\tonLoad: noopScriptHandler,';

const oldBlock =
  'if (!hydrated) {\n' +
  '\t\tif (attrs?.src) return /* @__PURE__ */ jsx("script", {\n' +
  '\t\t\t...attrs,\n' +
  '\t\t\tsuppressHydrationWarning: true\n' +
  '\t\t});';

const newBlock =
  'if (!hydrated) {\n' +
  '\t\tif (attrs?.src) return /* @__PURE__ */ jsx("script", {\n' +
  '\t\t\t...attrs,\n' +
  '\t\t\tonLoad: noopScriptHandler,\n' +
  '\t\t\tsuppressHydrationWarning: true\n' +
  '\t\t});';

const file = path.resolve(__dirname, '..', target);

let content;
try {
  content = fs.readFileSync(file, 'utf8');
} catch {
  console.warn(`[postinstall] skip: ${target} not found`);
  process.exit(0);
}

if (content.includes(sentinel)) {
  process.exit(0);
}

if (!content.includes(oldBlock)) {
  console.warn(`[postinstall] skip: ${target} already modified or unexpected`);
  process.exit(0);
}

const updated = content.replace(oldBlock, newBlock);
fs.writeFileSync(file, updated, 'utf8');
console.log(`[postinstall] patched ${target}`);
