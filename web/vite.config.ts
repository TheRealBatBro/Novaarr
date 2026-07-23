import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [TanStackRouterVite({ autoCodeSplitting: true }), react(), tailwindcss(), tsconfigPaths()],
  // Relative asset base — BASE_PATH is a runtime env var (server.js), not known at build time,
  // so built <script>/<link> references must resolve relative to wherever index.html is
  // actually served from (root, or a reverse-proxy sub-path) instead of an absolute "/...".
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
