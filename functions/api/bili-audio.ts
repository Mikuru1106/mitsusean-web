type PagesContext = {
  request: Request;
  env: { BILI_COOKIE?: string };
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const BILI_HEADERS = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' };

const jsonError = (message: string, status: number): Response =>
  Response.json({ code: -1, message }, { status });

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return jsonError('Method not allowed', 405);
  }

  const bvid = new URL(request.url).searchParams.get('bvid');
  if (!bvid || !/^BV[0-9A-Za-z]{10}$/.test(bvid)) {
    return jsonError('无效的 bvid', 400);
  }

  const headers = new Headers(BILI_HEADERS);
  if (context.env.BILI_COOKIE) headers.set('Cookie', context.env.BILI_COOKIE);

  try {
    // 1) bvid → cid
    const viewJson: any = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    }).then((r) => r.json());
    const cid: number | undefined = viewJson?.data?.cid;
    if (!cid) return jsonError('未找到该稿件', 404);

    // 2) cid → DASH 音频直链(取最高码率)
    const playUrl: any = await fetch(
      `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=16&fnval=16`,
      { headers, signal: AbortSignal.timeout(10_000) },
    ).then((r) => r.json());
    const audios: Array<{ id: number; baseUrl?: string; base_url?: string }> =
      playUrl?.data?.dash?.audio ?? [];
    const best = [...audios].sort((a, b) => b.id - a.id)[0];
    const src = best?.baseUrl ?? best?.base_url;
    if (!src) return jsonError('未找到音频流', 404);

    // 3) 转发音频流(透传 Range 以支持进度条/续播)
    const upstreamHeaders = new Headers(BILI_HEADERS);
    const range = request.headers.get('range');
    if (range) upstreamHeaders.set('Range', range);
    const upstream = await fetch(src, { headers: upstreamHeaders, signal: AbortSignal.timeout(30_000) });

    const responseHeaders = new Headers({
      'content-type': upstream.headers.get('content-type') ?? 'audio/mp4',
      'accept-ranges': 'bytes',
      'cache-control': 'public, max-age=3600',
    });
    for (const h of ['content-length', 'content-range']) {
      const v = upstream.headers.get(h);
      if (v) responseHeaders.set(h, v);
    }

    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return jsonError('音频代理暂时不可用', 502);
  }
}
