// Fixes "Error reading query stream: TypeError: Cannot read properties of
// undefined (reading 'mutations')" caused by hydration of an empty/done
// ReadableStream in @tanstack/router-ssr-query-core.
//
// Root cause: router.options.hydrate does:
//
//   reader.read().then(async function handle({ done, value }) {
//     hydrate(queryClient, value, hydrateOptions); // <- called even when done
//     if (done) return;
//     return handle(await reader.read());
//   })
//
// Per ReadableStream spec, when done === true, value is undefined. Calling
// hydrate(queryClient, undefined) throws inside query-core (tries to read
// undefined.queries / undefined.mutations).
//
// Fix: check done before hydrating. The terminal read carries no value.
//
// The patch is idempotent: it no-ops if already applied. Re-applied on every
// `bun install` via scripts/postinstall.js. Upstream tracking:
// https://github.com/TanStack/router (router-ssr-query-core) — remove once fixed.
const fs = require('fs');
const path = require('path');

const target = 'node_modules/@tanstack/router-ssr-query-core/dist/esm/index.js';

const sentinel = 'if (done) return;\n\t\t\t\thydrate(queryClient, value, hydrateOptions);';

const oldBlock =
  '\t\t\treader.read().then(async function handle({ done, value }) {\n' +
  '\t\t\t\thydrate(queryClient, value, hydrateOptions);\n' +
  '\t\t\t\tif (done) return;';

const newBlock =
  '\t\t\treader.read().then(async function handle({ done, value }) {\n' +
  '\t\t\t\tif (done) return;\n' +
  '\t\t\t\thydrate(queryClient, value, hydrateOptions);';

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
