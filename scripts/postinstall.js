// Re-applies the TanStack Start server-handler patch so that `server.handlers`
// on splat/catch-all routes (e.g. `src/routes/api/auth/$.ts`) are actually
// invoked. Upstream only invokes handlers on exact matches
// (`routeParams["**"] === void 0`), which means catch-all API routes never
// fire. This makes Better Auth's `/api/auth/*` endpoint reachable.
//
// The patch is idempotent: it no-ops if already applied.
require('./patch-react-router-asset.js');

const fs = require('fs');
const path = require('path');

// Remove nested Vite inside vitest to prevent type conflicts with root Vite v7
const nestedVite = path.resolve(__dirname, '..', 'node_modules/vitest/node_modules/vite');
if (fs.existsSync(nestedVite)) {
  fs.rmSync(nestedVite, { recursive: true, force: true });
  console.log('[postinstall] removed nested vitest/node_modules/vite');
}

const target = 'node_modules/@tanstack/start-server-core/dist/esm/createStartHandler.js';

const sentinel = 'const isSplat = foundRoute';
const oldLine = 'const isExactMatch = foundRoute && routeParams["**"] === void 0;';
const newLine =
  'const isSplat = foundRoute?.options.path?.endsWith("/$");\n' +
  '  const isExactMatch = foundRoute && (routeParams["**"] === void 0 || isSplat);';

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

if (!content.includes(oldLine)) {
  console.warn(`[postinstall] skip: ${target} already modified or unexpected`);
  process.exit(0);
}

const updated = content.replace(oldLine, newLine);
fs.writeFileSync(file, updated, 'utf8');
console.log(`[postinstall] patched ${target}`);
