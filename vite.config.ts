import { defineConfig } from 'vite'

// 相対パス出力にすることで、GitHub Pages（サブパス配信）と
// Cloudflare Pages（ルート配信）の両方でそのまま動作する
export default defineConfig({
  base: './',
})
