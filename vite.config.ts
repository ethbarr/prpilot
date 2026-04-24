import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/content.ts'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  plugins: [
    {
      // Copies manifest.json into dist/ at build time
      name: 'copy-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'),
        });
      },
    },
  ],
});
