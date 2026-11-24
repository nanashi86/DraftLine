import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import draftlinePwa from './src/pwa/vitePlugin.js';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `npm run dev` only: serve public/<page>/index.html for /<page>/ (features, compare, welcome,
 * philosophy), as GitHub Pages and `npm run preview` already do. Vite's dev server otherwise sends
 * every unknown address to the app (index.html), so /features/ opened the editor. /features (no slash)
 * goes to /features/, as on the live site. Production builds are untouched: the pages are copied from
 * public/ as they are.
 */
function publicPages() {
  return {
    name: 'draftline-public-pages',
    apply: 'serve',
    configureServer(server) {
      const dir = server.config.publicDir;
      server.middlewares.use((req, res, next) => {
        const [path, query = ''] = (req.url || '').split('?');
        if (!dir || path === '/' || /\.[a-z0-9]+$/i.test(path) || path.includes('..')) return next();
        const page = join(dir, decodeURIComponent(path), 'index.html');
        if (!existsSync(page) || !statSync(page).isFile()) return next();
        if (!path.endsWith('/')) {
          res.statusCode = 301;
          res.setHeader('Location', `${path}/${query ? `?${query}` : ''}`);
          return res.end();
        }
        req.url = `${path}index.html${query ? `?${query}` : ''}`;
        next();
      });
    },
  };
}

export default defineConfig({
  // Served at the root of draftlineapp.com (GitHub Pages custom domain; public/CNAME keeps it set on every deploy).
  base: '/',
  // draftlinePwa writes dist/sw.js (offline app shell + fonts) — see src/pwa/.
  plugins: [react(), draftlinePwa(), publicPages()],
  build: {
    rolldownOptions: {
      output: {
        // React + ReactDOM in their own chunk: it changes only when React is upgraded, so it stays
        // cached across DraftLine updates, and keeps the app chunk under Vite's 500 kB warning.
        codeSplitting: {
          groups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
