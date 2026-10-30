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

/** B站会拦数据中心 IP 的匿名请求（-412），随机 buvid3 不一定管用 */
function buvid3(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const block = (n: number) => Array.from({ length: n }, hex).join('').toUpperCase();
  return `${block(8)}-${block(4)}-${block(4)}-${block(4)}-${block(12)}infoc`;
}

/**
 * 无 Cookie 时向 B站指纹接口要一对真实 buvid3/buvid4。
 * 同一 isolate 内缓存 6 小时，避免每次请求都多打一次。
 */
let fingerprint: { cookie: string; at: number } | null = null;
const FP_TTL = 6 * 60 * 60 * 1000;

async function anonymousCookie(): Promise<string> {
  if (fingerprint && Date.now() - fingerprint.at < FP_TTL) return fingerprint.cookie;
  try {
    const res = await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
      signal: AbortSignal.timeout(8000),
    });
    const payload = (await res.json()) as { data?: { b_3?: string; b_4?: string } };
    const b3 = payload?.data?.b_3;
    const b4 = payload?.data?.b_4;
    if (typeof b3 === 'string' && typeof b4 === 'string') {
      const cookie = `buvid3=${b3}; buvid4=${b4}; b_nut=${Math.floor(Date.now() / 1000)}`;
      fingerprint = { cookie, at: Date.now() };
      return cookie;
    }
  } catch {
    /* 取不到指纹就退化为随机 buvid3 */
  }
  return `buvid3=${buvid3()}`;
}

async function biliHeaders(env: Env): Promise<Headers> {
  const headers = new Headers({
    'User-Agent': UA,
    Referer: 'https://space.bilibili.com/',
    Origin: 'https://space.bilibili.com',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
  });
  headers.set('Cookie', env.BILI_COOKIE || (await anonymousCookie()));
  return headers;
}

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cors },
  });

/**
 * 已知限制（2026-10 实测）：
 * Cloudflare 的出口 IP 被 B 站整段风控，即使带上有效的登录 Cookie，
 * x/relation/stat 与 x/web-interface/card 仍返回 -412 request was banned。
 * 因此本 Worker 在 CF 网络上无法直接取数，除非把出口换成未被封的节点（VPS 等）。
 */
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
        headers: await biliHeaders(env),
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
