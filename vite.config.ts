import { defineConfig } from 'vite';
import { resolve } from 'path';
import { tsLibFilesPlugin } from './vite-plugin-ts-libs';

export default defineConfig({
  plugins: [tsLibFilesPlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'NodiusEditor',
      formats: ['es', 'umd'],
      fileName: 'nodius-code-editor',
    },
    rollupOptions: {
      external: ['typescript'],
      output: {
        globals: {
          typescript: 'ts',
        },
      },
    },
  },
});
