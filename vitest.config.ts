import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/tests/**',
        'src/test-*.ts',
      ],
    },
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist', 'src/tests/memory-test.ts'],
  },
  resolve: {
    alias: {
      '#': path.resolve(__dirname, './src'),
    },
  },
});
