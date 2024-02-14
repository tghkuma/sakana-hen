import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    root: 'src',
    base: './',
    build: {
      emptyOutDir: true,
      outDir: '../dist',
/*
      assetsInlineLimit: 0, // asset が自動的に埋め込まれてしまうのを防ぐ
      // viteのbuild時のファイル名ハッシュを辞める
      rollupOptions: {
        output: { // entry chunk assets それぞれの書き出し名の指定
          entryFileNames: `assets/[name].js`,
          chunkFileNames: `assets/[name].js`,
          assetFileNames: `assets/[name].[ext]`,
        },
      },
*/
    },
    plugins: [
      ViteImageOptimizer({
        /* pass your config */
      }),
    ],
  };
});
