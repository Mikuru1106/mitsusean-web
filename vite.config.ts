import { defineConfig, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import react from '@vitejs/plugin-react'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const BILI_HEADERS = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' }

/**
 * dev 中间件:/api/bili-audio?bvid=...
 * 服务端解析B站 dash 音频轨(纯音频,不含画面)并转发给浏览器 <audio>。
 * B站 CDN 校验 Referer,浏览器直连会被 403,因此经 dev 服务器转发。
 * 仅 dev 可用;生产环境无此中间件时前端会回退为打开B站稿件页。
 */
function biliAudioProxy(): Plugin {
  return {
    name: 'bili-audio-proxy',
    configureServer(server) {
      server.middlewares.use('/api/bili-audio', (req: IncomingMessage, res: ServerResponse) => {
        ;(async () => {
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.statusCode = 405
            res.end()
            return
          }
          const bvid = new URL(req.url ?? '/', 'http://localhost').searchParams.get('bvid')
          if (!bvid) {
            res.statusCode = 400
            res.end()
            return
          }

          // 1) bvid → cid
          const view: any = await fetch(
            `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
            { headers: BILI_HEADERS },
          ).then((r) => r.json())
          const cid: string | undefined = view?.data?.cid
          if (!cid) {
            res.statusCode = 404
            res.end()
            return
          }

          // 2) cid → dash 音频直链(取最高码率)
          const pu: any = await fetch(
            `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=16&fnval=16`,
            { headers: BILI_HEADERS },
          ).then((r) => r.json())
          const audios: Array<{ id: number; baseUrl?: string; base_url?: string }> =
            pu?.data?.dash?.audio ?? []
          const best = [...audios].sort((a, b) => b.id - a.id)[0]
          const src = best?.baseUrl ?? best?.base_url
          if (!src) {
            res.statusCode = 404
            res.end()
            return
          }

          // 3) 转发音频流(透传 Range 以支持进度条/续播)
          const headers: Record<string, string> = { ...BILI_HEADERS }
          const range = req.headers.range
          if (range) headers.Range = range
          const upstream = await fetch(src, { headers })
          res.statusCode = upstream.status
          for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
            const v = upstream.headers.get(h)
            if (v) res.setHeader(h, v)
          }
          if (!res.getHeader('content-type')) res.setHeader('content-type', 'audio/mp4')
          if (!res.getHeader('accept-ranges')) res.setHeader('accept-ranges', 'bytes')
          if (!upstream.body || req.method === 'HEAD') {
            res.end()
            return
          }
          Readable.fromWeb(upstream.body as never).pipe(res)
        })().catch(() => {
          if (!res.headersSent) res.statusCode = 502
          res.end()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), biliAudioProxy()],
  server: {
    // 设计方案 B:dev 时经本地代理请求 B站公开接口,绕过浏览器 CORS
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
