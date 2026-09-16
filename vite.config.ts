import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { nitro } from 'nitro/vite';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

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
    },
    // Vite 8 built-in: resolve `paths` from tsconfig.json (replaces the
    // vite-tsconfig-paths plugin). Only applies to files matched by the
    // tsconfig's include patterns.
    tsconfigPaths: true
  },
  // maplibre-gl ships a web worker the dep optimizer cannot bundle; exclude it
  // so Vite serves the library and its worker as-is.
  optimizeDeps: {
    exclude: ['maplibre-gl']
  },
  build: {
    rollupOptions: {
      external: ['postgres']
    }
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      importProtection: {
        // Server: @vladmandic/human is browser-only (WebGL + camera). Its node
        // entry (human.node.js) pulls in @tensorflow/tfjs-node, which is not
        // installed. Mock the import in the server bundle — the face pipeline
        // only ever runs in browser event handlers, never during SSR.
        behavior: 'mock',
        server: {
          specifiers: ['@vladmandic/human']
        },
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
        process.env.DATABASE_URL || 'postgres://tanstack:tanstack@localhost:5432/kolonios_test'
    },
    globals: true,
    // Vitest bundles its own Vite 7, which predates resolve.tsconfigPaths
    // (a Vite 8 feature used above), so mirror the app's `@` alias here for
    // the test pipeline only.
    alias: {
      '@': srcDir
    },
    // Two projects split the suite by DB dependency:
    //   unit        - pure functions + components, no DB; 4 workers parallel,
    //                 isolate off (node env without side effects, docs-perf).
    //   integration - DB-bound (resets/resets per file); single worker to
    //                 avoid races against the shared test schema.
    // Run a single project with --project <name>, or both with `bun run test`.
    projects: [
      {
        // Inherit the root's alias (`@` -> srcDir) + globals. Without
        // `extends: true`, Vitest 4 inline projects have no test.env, no
        // globals, and no aliases -- that breaks `import { ... } from '@/...'`
        // and the rarely-used `process.env` setup globals.
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          // 185 of 207 test files; includes all *.test.ts(x) EXCEPT
          //   - src/lib/db/*.test.ts   (always reset/truncate against PG)
          //   - **/*.integration.test.* (5 explicit integration files)
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.output/**',
            'e2e/**',
            'src/lib/db/**/*.test.ts',
            '**/*.integration.test.ts',
            '**/*.integration.test.tsx',
            // Server-fn tests that drive a `?tss-serverfn-split` handler.
            // Even when DB modules are vi.mock'd, the import-time chain
            // transitively touches lib/db at module-evaluation time and
            // races with parallel workers on the shared test DB. They run
            // in the `integration` project under a single worker instead.
            'src/features/tickets/api/service.test.ts',
            'src/features/employees/api/career-events.test.ts',
            'src/features/employees/api/service.test.ts',
            'src/features/checklist/api/service.test.ts',
            'src/features/schedule-grid/api/export-service.test.ts',
            'src/features/schedule-grid/api/import-service.test.ts',
            'src/lib/auth/password-gate.test.ts'
          ],
          // Per Vitest `guide/improving-performance`, `isolate: false` only
          // helps when files don't leak module state. Several unit tests use
          // `vi.mock(...)` at module scope (i18n, BrandLogo, react-query
          // client providers) - sharing a worker lets one file's mock leak
          // into the next. Keep isolation ON; we still parallelize across
          // files via maxWorkers.
          isolate: true,
          fileParallelism: true,
          pool: 'threads',
          maxWorkers: 4
        }
      },
      {
        // Inherit root alias (`@` -> srcDir) + env (DATABASE_URL).
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          // DB seam; setupFiles kept on the project (was on the root before)
          setupFiles: ['./vitest.setup.ts'],
          include: [
            'src/lib/db/**/*.test.ts',
            'src/**/*.integration.test.ts',
            'src/**/*.integration.test.tsx',
            // DB-bound tests that don't follow the *.integration.test.ts
            // naming convention (they reset/seed the shared test schema
            // OR drive `?tss-serverfn-split` handlers that touch the DB).
            'src/features/tickets/api/service.test.ts',
            'src/features/employees/api/career-events.test.ts',
            'src/features/employees/api/service.test.ts',
            'src/features/checklist/api/service.test.ts',
            'src/features/schedule-grid/api/export-service.test.ts',
            'src/features/schedule-grid/api/import-service.test.ts',
            'src/lib/auth/password-gate.test.ts'
          ],
          exclude: ['**/node_modules/**', '**/dist/**', '**/.output/**', 'e2e/**'],
          // Shared postgres test DB -> one worker serializes file execution.
          pool: 'threads',
          maxWorkers: 1
        }
      }
    ],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/features/**/schemas/**', 'src/features/**/api/**'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.output/**',
        'e2e/**',
        'src/lib/db/migrations/**'
      ],
      thresholds: {
        lines: 69,
        branches: 55,
        functions: 57,
        statements: 68,
        'src/lib/db/*.ts': {
          functions: 60,
          statements: 50
        }
      }
    }
  }
} as Parameters<typeof defineConfig>[0]);
