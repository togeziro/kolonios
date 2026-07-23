// Re-applies the TanStack Start server-handler patch so that `server.handlers`
// on splat/catch-all routes (e.g. `src/routes/api/auth/$.ts`) are actually
// invoked. Upstream only invokes handlers on exact matches
// (`routeParams["**"] === void 0`), which means catch-all API routes never
// fire. This makes Better Auth's `/api/auth/*` endpoint reachable.
//
// The patch is idempotent: it no-ops if already applied.
const fs = require('fs');
const path = require('path');

const target =
  'node_modules/@tanstack/start-server-core/dist/esm/createStartHandler.js';

const sentinel = 'const isSplat = foundRoute';
const oldLine = 'const isExactMatch = foundRoute && routeParams["**"] === void 0;';
const newLine =
  'const isSplat = foundRoute?.options.path?.endsWith("/$");\n' +
  '  const isExactMatch = foundRoute && (routeParams["**"] === void 0 || isSplat);';

const file = path.resolve(__dirname, '..', target);

if (!fs.existsSync(file)) {
  console.warn(`[postinstall] skip: ${target} not found`);
  process.exit(0);
}

const content = fs.readFileSync(file, 'utf8');

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
