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
    environment: 'node',
    // Run all test files in a single worker so they don't race against each
    // other on the shared test database (each file truncates/reseeds in
    // beforeEach). Tests within a file already run sequentially.
    maxWorkers: 1,
    setupFiles: ['./vitest.setup.ts'],
    // Vitest bundles its own Vite 7, which predates resolve.tsconfigPaths
    // (a Vite 8 feature used above), so mirror the app's `@` alias here for
    // the test pipeline only.
    alias: {
      '@': srcDir
    },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.output/**', 'e2e/**'],
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
