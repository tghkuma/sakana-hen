import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    root: 'src',
    base: './',
    build: {
      emptyOutDir: true,
      outDir: '../dist'
    },
    plugins: [
      ViteImageOptimizer({
        /* pass your config */
      }),
    ],
  };
});
