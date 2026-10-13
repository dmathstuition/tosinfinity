import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 60_000, hookTimeout: 120_000 },
  resolve: {
    alias: {
      // 'server-only' throws outside a React Server Component; tests import server modules directly.
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
      '@': path.resolve(__dirname),
    },
  },
});
