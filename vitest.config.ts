import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': '/src' },
  },
  // Automatic JSX runtime for component tests (*.test.tsx, jsdom per file).
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
  },
});
