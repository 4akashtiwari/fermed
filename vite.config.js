import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The spec is fetched at runtime (`?spec=/specs/<slug>.json`), so the built site
 * has to ship the specs alongside it. In dev they are served from the repo root.
 */
function fermedSpecs() {
  return {
    name: 'fermed-specs',
    apply: 'build',
    closeBundle() {
      const src = path.resolve(__dirname, 'specs');
      const dest = path.resolve(__dirname, 'dist/specs');
      fs.mkdirSync(dest, { recursive: true });
      for (const file of fs.readdirSync(src)) {
        if (file.endsWith('.json')) fs.copyFileSync(path.join(src, file), path.join(dest, file));
      }
    },
  };
}

export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  plugins: [fermedSpecs()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // The Arena preview iframe proxies through a host that is not localhost,
    // so never allowlist origins and always allow any host header.
    allowedHosts: true,
    cors: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          gsap: ['gsap'],
        },
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4321,
    cors: true,
  },
});
