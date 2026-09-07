// Re-applies the TanStack Asset.tsx hydration patch (`scripts/patch-react-router-asset.js`)
// on every `bun install`. `@tanstack/react-router` still ships the unpatched
// `Asset.js`, so React hydration mismatch #418 remains broken upstream; see
// docs/HYDRATION_FIX.md.
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
