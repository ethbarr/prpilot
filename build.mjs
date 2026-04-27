/**
 * PRPilot build script
 *
 *  - Popup:          Vite ES module (loaded by popup.html via <script type="module">)
 *  - Content script: esbuild IIFE  (Chrome doesn't allow ES module imports in content scripts)
 *
 * We use esbuild directly for the content script because Rollup's IIFE output can
 * produce edge-cases that Chrome rejects; esbuild's native IIFE format is simpler
 * and is what most Chrome-extension toolchains rely on.
 */
import { build } from 'vite';
import * as esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const r = (...segments) => resolve(__dirname, ...segments);

// ── Pass 1: Popup (Vite ES module) ───────────────────────────────────────────
// public/ is copied to dist/ automatically (includes popup.html + icons).
console.log('Building popup…');
await build({
  configFile: false,
  publicDir: r('public'),
  build: {
    outDir: r('dist'),
    emptyOutDir: true,
    lib: {
      entry: r('src/popup/popup.ts'),
      formats: ['es'],
      fileName: () => 'popup.js',
    },
  },
  plugins: [{
    name: 'copy-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: readFileSync(r('manifest.json'), 'utf-8'),
      });
    },
  }],
});

// ── Pass 2: Background service worker (ES module) ────────────────────────────
// Service workers in MV3 support ES modules when manifest says "type":"module".
// Using esbuild bundle so we get a single self-contained file.
console.log('Building background service worker…');
await esbuild.build({
  entryPoints: [r('src/background/background.ts')],
  bundle: true,
  format: 'esm',
  outfile: r('dist/background.js'),
  platform: 'browser',
  target: ['chrome100'],
  tsconfig: r('tsconfig.json'),
  minify: true,
});

// ── Pass 3: Content script (esbuild IIFE) ────────────────────────────────────
// Named prpilot-content.js (not content.js) to avoid filename collisions with
// other extensions that also inject a file called content.js.
console.log('Building content script…');
await esbuild.build({
  entryPoints: [r('src/content/content.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'PRPilotContent',
  outfile: r('dist/prpilot-content.js'),
  platform: 'browser',
  target: ['chrome100'],
  tsconfig: r('tsconfig.json'),
  minify: true,
});

console.log('\n✅  PRPilot built to dist/');
