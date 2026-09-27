type PagesContext = {
  request: Request;
  params: { path?: string | string[] };
  env: { BILI_COOKIE?: string };
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const ALLOWED_PATHS = new Set(['x/relation/stat', 'x/web-interface/view']);

function jsonError(message: string, status: number): Response {
  return Response.json({ code: -1, message }, { status });
}

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

  const headers = new Headers({
    'User-Agent': UA,
    Referer: 'https://space.bilibili.com/',
    Accept: 'application/json',
  });
  if (context.env.BILI_COOKIE) headers.set('Cookie', context.env.BILI_COOKIE);

  try {
    const response = await fetch(upstream, {
      method: context.request.method,
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    const responseHeaders = new Headers({
      'content-type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'cache-control': path === 'x/relation/stat' ? 'public, max-age=60' : 'public, max-age=300',
    });
    return new Response(context.request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return jsonError('B站接口暂时不可用', 502);
  }
}
