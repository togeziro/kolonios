import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { nitro } from 'nitro/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// Nitro is only needed for production builds (node/bun server output).
// In dev, the `nitro/vite` plugin conflicts with TanStack Start's SSR
// middleware, so we gate it on NODE_ENV === 'production' (set by `vite build`).
const isProduction = process.env.NODE_ENV === 'production';
const nitroPlugin = isProduction ? [nitro({ preset: 'bun' })] : [];

export default defineConfig({
  server: {
    host: true,
    port: 3000,
    allowedHosts: true
  },
  // The `postgres` driver (used by server functions) references `Buffer`,
  // which does not exist in the browser. Polyfill it so client bundles
  // that transitively include server code don't crash on hydration.
  define: {
    global: 'globalThis'
  },
  resolve: {
    alias: {
      Buffer: 'buffer'
    }
  },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      importProtection: {
        client: {
          specifiers: ['postgres', 'pg-native', 'pg']
        }
      }
    }),
    viteReact(),
    ...nitroPlugin
  ],
  test: {
    // Integration tests talk to a dedicated PostgreSQL test database
    // (see scripts/create-test-db.ts). Never point this at the dev DB.
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgres://tanstack:tanstack@localhost:5432/tanstack_dashboard_test'
    },
    globals: true,
    environment: 'node',
    // Run all test files in a single worker so they don't race against each
    // other on the shared test database (each file truncates/reseeds in
    // beforeEach). Tests within a file already run sequentially.
    maxWorkers: 1,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.output/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/features/**/schemas/**', 'src/features/**/api/**']
    }
  }
});
