import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

export default defineConfig(({ mode }) => {
  return {
    root: 'src',
    base: './',
    envDir: '../',
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
      ViteImageOptimizer({/* pass your config */}),
      {
        name: 'html-version-inject',
        transformIndexHtml(html) {
          return html.replace(/(<[^>]*id=["']version["'][^>]*>)([\s\S]*?)(<\/[^>]+>)/i, `$1${pkg.version}$3`)
        },
      },
    ],
  }
})
