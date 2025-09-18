/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

const timeout = 1000 * 60 * 2; // 2 minutes
export default defineConfig({
  test: {
    environment: 'node', // backend runner
    globals: true,
    reporters: 'default',
    include: ['src/tests/e2e/**/*.spec.ts'],
    testTimeout: timeout, // 2 minutes
    hookTimeout: timeout, // 2 minutes
    // Ensure project is built before tests when run via IDE or vitest directly
    // We hook into a global setup function that compiles TS -> lib if needed
    globalSetup: ['./vitest.global-setup.ts'],
  },
  esbuild: { target: 'es2022' },
});
