import { defineConfig } from 'vitest/config';
import { tsLibFilesPlugin } from './vite-plugin-ts-libs';

export default defineConfig({
  plugins: [tsLibFilesPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
