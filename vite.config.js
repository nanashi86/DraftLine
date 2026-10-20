import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import draftlinePwa from './src/pwa/vitePlugin.js';

export default defineConfig({
  base: '/DraftLine/',
  // draftlinePwa writes dist/sw.js (offline app shell + fonts) — see src/pwa/.
  plugins: [react(), draftlinePwa()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
