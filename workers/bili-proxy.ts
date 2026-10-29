/**
 * B站接口代理 · Cloudflare Worker
 *
 * 用途：GitHub Pages 这类纯静态托管没法跑服务端，浏览器直接请求 B 站会被
 * Referer 校验（403）和 CORS 双重拦截。把请求放到 Worker 上转发即可。
 *
 * 部署：
 *   npx wrangler deploy --config workers/wrangler.toml
 * 可选：在 Cloudflare 控制台给 Worker 配置 Secret BILI_COOKIE（登录态 Cookie，
 *      不配也能跑，匿名请求靠随机 buvid3 规避 -412）。
 *
 * 前端：构建时设置 VITE_LIVE_API=https://<worker>.workers.dev
 */

interface Env {
  BILI_COOKIE?: string;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** 只放行前端真正用到的两个接口，避免变成公开的任意代理 */
const ALLOWED_PATHS = new Set(['x/relation/stat', 'x/web-interface/view']);

/** 允许跨域的站点；部署后按需增减 */
const ALLOWED_ORIGINS = [
  'https://mitsusean.live',
  'https://www.mitsusean.live',
  'https://mikuru1106.github.io',
  'http://localhost:5173',
  'http://localhost:5200',
  'http://localhost:5203',
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** B站会拦数据中心 IP 的匿名请求（-412），需要浏览器端才有的 buvid3 标识 */
function buvid3(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const block = (n: number) => Array.from({ length: n }, hex).join('').toUpperCase();
  return `${block(8)}-${block(4)}-${block(4)}-${block(4)}-${block(12)}infoc`;
}

function biliHeaders(env: Env): Headers {
  const headers = new Headers({
    'User-Agent': UA,
    Referer: 'https://space.bilibili.com/',
    Origin: 'https://space.bilibili.com',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
  });
  headers.set('Cookie', env.BILI_COOKIE || `buvid3=${buvid3()}`);
  return headers;
}

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cors },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ code: -1, message: 'Method not allowed' }, 405, cors);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, '');
    if (!ALLOWED_PATHS.has(path)) {
      return json({ code: -1, message: 'API path not allowed' }, 404, cors);
    }

    const upstream = new URL(`https://api.bilibili.com/${path}`);
    upstream.search = url.search;

    try {
      const res = await fetch(upstream.toString(), {
        method: request.method,
        headers: biliHeaders(env),
        signal: AbortSignal.timeout(10_000),
      });
      const body = request.method === 'HEAD' ? '' : await res.text();

      let status = res.status;
      let cacheControl = env.BILI_COOKIE ? 'private, no-store' : 'public, max-age=60';

      if (body) {
        try {
          const payload = JSON.parse(body) as { code?: number };
          if (payload.code === -412) {
            // 被风控：让浏览器也短暂缓存这个结果，别连续打
            status = 429;
            cacheControl = 'no-store';
          } else if (path === 'x/web-interface/view' && !env.BILI_COOKIE) {
            cacheControl = 'public, max-age=300';
          }
        } catch {
          /* 上游返回非 JSON，原样透传 */
        }
      }

      return new Response(body, {
        status,
        headers: {
          'content-type': res.headers.get('content-type') ?? 'application/json; charset=utf-8',
          'cache-control': cacheControl,
          ...cors,
        },
      });
    } catch {
      return json({ code: -1, message: 'B站接口暂时不可用' }, 502, cors);
    }
  },
};
