import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const shim = (name) => fileURLToPath(new URL(`./web/src/demo/shims/${name}.js`, import.meta.url));

// `vite build --mode pages` produces the static demo served by GitHub Pages at picsbeautypros.com: the server code is bundled
// into the page and runs on SQLite/WebAssembly, with Node-only modules swapped for shims.
export default defineConfig(({ mode }) => {
  const pages = mode === 'pages';
  return {
    root: 'web',
    base: pages ? process.env.PAGES_BASE || '/' : '/',
    plugins: [react()],
    build: { outDir: pages ? 'dist-pages' : 'dist', emptyOutDir: true, target: 'es2022' },
    define: pages
      ? {
          'process.env.PBP_DATA_DIR': 'undefined',
          'process.env.PBP_DB': 'undefined',
          'process.env.PBP_JWT_SECRET': 'undefined',
          'process.env.PBP_DEMO': '"1"',
          'process.env.PBP_PHOTO_BASE': JSON.stringify((process.env.PAGES_BASE || '/') + 'photos')
        }
      : { 'process.env.PBP_PHOTO_BASE': 'undefined' },
    resolve: {
      alias: pages
        ? {
            'pbp-demo-backend': fileURLToPath(new URL('./web/src/demo/backend.js', import.meta.url)),
            'better-sqlite3': shim('better-sqlite3'),
            express: shim('express'),
            multer: shim('multer'),
            jsonwebtoken: shim('jsonwebtoken'),
            'cookie-parser': shim('cookie-parser'),
            'node:fs': shim('fs'),
            'node:path': shim('path'),
            'node:crypto': shim('crypto')
          }
        : { 'pbp-demo-backend': fileURLToPath(new URL('./web/src/demo/none.js', import.meta.url)) }
    },
    server: {
      port: 5173,
      proxy: { '/api': 'http://localhost:3000', '/uploads': 'http://localhost:3000' }
    }
  };
});
