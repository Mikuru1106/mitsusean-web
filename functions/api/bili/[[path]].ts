type PagesContext = {
  request: Request;
  params: { path?: string | string[] };
  env: { BILI_COOKIE?: string };
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const ALLOWED_PATHS = new Set(['x/relation/stat', 'x/web-interface/view']);

/**
 * B站会拦截数据中心 IP 的匿名请求(-412 request was banned),
 * 需要带上浏览器端才会有的 buvid3 标识;缺失时用随机 UUID 生成一份。
 */
function buvid3(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const block = (n: number) =>
    Array.from({ length: n }, hex).join('').toUpperCase();
  return `${block(8)}-${block(4)}-${block(4)}-${block(4)}-${block(12)}infoc`;
}

function biliHeaders(env: { BILI_COOKIE?: string }): Headers {
  const headers = new Headers({
    'User-Agent': UA,
    Referer: 'https://space.bilibili.com/',
    Origin: 'https://space.bilibili.com',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
  });
  // 登录态 Cookie 优先;未配置时至少提供 buvid3 以避免 -412
  headers.set('Cookie', env.BILI_COOKIE || `buvid3=${buvid3()}`);
  return headers;
}

const jsonError = (message: string, status: number): Response =>
  Response.json({ code: -1, message }, { status });

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return jsonError('Method not allowed', 405);
  }

  const rawPath = context.params.path;
  const path = Array.isArray(rawPath) ? rawPath.join('/') : rawPath ?? '';
  if (!ALLOWED_PATHS.has(path)) return jsonError('API path not allowed', 404);

  const incoming = new URL(context.request.url);
  const upstream = new URL(`https://api.bilibili.com/${path}`);
  upstream.search = incoming.search;

  try {
    const response = await fetch(upstream, {
      method: context.request.method,
      headers: biliHeaders(context.env),
      signal: AbortSignal.timeout(10_000),
    });
    const contentType = response.headers.get('content-type') ?? 'application/json; charset=utf-8';
    const body = context.request.method === 'HEAD' ? null : await response.text();
    let status = response.status;
    const headers = new Headers({
      'content-type': contentType,
      'cache-control': context.env.BILI_COOKIE ? 'private, no-store' : 'public, max-age=60',
    });

    if (body && contentType.includes('application/json')) {
      try {
        const payload = JSON.parse(body) as { code?: number };
        if (payload.code === -412) {
          status = 429;
          headers.set('retry-after', '60');
          headers.set('cache-control', 'no-store');
        } else if (path === 'x/web-interface/view') {
          headers.set('cache-control', context.env.BILI_COOKIE ? 'private, no-store' : 'public, max-age=300');
        }
      } catch {
        /* 保留上游非 JSON 响应 */
      }
    }

    return new Response(body, { status, headers });
  } catch {
    return jsonError('B站接口暂时不可用', 502);
  }
}
