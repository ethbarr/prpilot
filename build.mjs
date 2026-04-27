/**
 * PRPilot build script
 *
 *  - Popup:          Vite ES module (loaded by popup.html via <script type="module">)
 *  - Background SW:  esbuild ESM   (single self-contained bundle)
 *  - Content script: esbuild IIFE  (Chrome doesn't allow ES module imports in content scripts)
 *
 * Usage:
 *   node build.mjs          # one-shot production build
 *   node build.mjs --watch  # incremental watch build for development
 *
 * Watch mode rebuilds the background SW and content script on every file change.
 * The popup (Vite) is rebuilt once at startup — Vite watch for the popup can be
 * added later if popup-only iteration becomes a bottleneck.
 */
import { build } from 'vite';
import * as esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const r = (...segments) => resolve(__dirname, ...segments);

const WATCH = process.argv.includes('--watch');

const sharedEsbuild = {
  bundle: true,
  platform: 'browser',
  target: ['chrome100'],
  tsconfig: r('tsconfig.json'),
  // Minify only in production so watch-mode rebuilds are faster to inspect.
  minify: !WATCH,
};

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
console.log('Building background service worker…');

// ── Pass 3: Content script (esbuild IIFE) ────────────────────────────────────
// Named prpilot-content.js (not content.js) to avoid filename collisions with
// other extensions that also inject a file called content.js.
console.log('Building content script…');

if (WATCH) {
  // In watch mode we use esbuild contexts so incremental rebuilds are fast.
  const bgCtx = await esbuild.context({
    ...sharedEsbuild,
    entryPoints: [r('src/background/background.ts')],
    format: 'esm',
    outfile: r('dist/background.js'),
  });

  const contentCtx = await esbuild.context({
    ...sharedEsbuild,
    entryPoints: [r('src/content/content.ts')],
    format: 'iife',
    globalName: 'PRPilotContent',
    outfile: r('dist/prpilot-content.js'),
  });

  await bgCtx.watch();
  await contentCtx.watch();

  console.log('\n👀  Watching for changes — reload the extension in Chrome after each rebuild.');
  // Keep the process alive; Ctrl-C to stop.
} else {
  await esbuild.build({
    ...sharedEsbuild,
    entryPoints: [r('src/background/background.ts')],
    format: 'esm',
    outfile: r('dist/background.js'),
  });

  await esbuild.build({
    ...sharedEsbuild,
    entryPoints: [r('src/content/content.ts')],
    format: 'iife',
    globalName: 'PRPilotContent',
    outfile: r('dist/prpilot-content.js'),
  });

  console.log('\n✅  PRPilot built to dist/');
}
