import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import draftlinePwa from './src/pwa/vitePlugin.js';

export default defineConfig({
  base: '/DraftLine/',
  // draftlinePwa writes dist/sw.js (offline app shell + fonts) — see src/pwa/.
  plugins: [react(), draftlinePwa()],
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
