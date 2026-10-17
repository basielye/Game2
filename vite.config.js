import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative asset URLs: the build runs from any host or subfolder (itch.io, GitHub Pages, CDN)
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
