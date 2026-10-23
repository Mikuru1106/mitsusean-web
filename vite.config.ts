import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 项目页部署在 /<repo>/ 子路径下，由 CI 通过 VITE_BASE 注入；
  // 本地开发与根域名部署保持 '/'，站内资源统一走 src/lib/asset.ts 拼接。
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    // dev 时经本地代理请求 B站公开接口，绕过浏览器 CORS。
    // 仅服务于「数据观测 / 视频列表」的实时刷新，音乐播放已不经过 B 站。
    proxy: {
      '/api/bili': {
        target: 'https://api.bilibili.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bili/, ''),
        headers: {
          'User-Agent': UA,
          Referer: 'https://space.bilibili.com/',
        },
      },
    },
  },
})
