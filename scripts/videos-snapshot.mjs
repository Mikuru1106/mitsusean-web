/**
 * Fetch every public video from Mizusean's Bilibili space into a static lottery pool.
 *
 * Usage: npm run videos-snapshot
 * Optional: BILI_COOKIE for endpoints that require a logged-in session.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MID = 431115683;
const PAGE_SIZE = 50;
const MAX_PAGES = 200;
const REQUEST_GAP_MS = 350;
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, '../public/data/videos.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const COOKIE = process.env.BILI_COOKIE || '';
const HEADERS = {
  'User-Agent': UA,
  Referer: `https://space.bilibili.com/${MID}/video`,
  ...(COOKIE ? { Cookie: COOKIE } : {}),
};
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43,
  5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16,
  24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59,
  6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
const keyFromUrl = (url) => url.split('/').pop().split('.')[0];
const getMixinKey = (original) => MIXIN_KEY_ENC_TAB.map((index) => original[index]).join('').slice(0, 32);

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...HEADERS, ...(options.headers ?? {}) } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (json?.code !== 0) throw new Error(json?.message || `B站接口 code=${json?.code}`);
  return json;
}

async function fetchWbiKeys() {
  const json = await fetchJson('https://api.bilibili.com/x/web-interface/nav');
  const images = json?.data?.wbi_img;
  if (!images?.img_url || !images?.sub_url) throw new Error('WBI key 缺失');
  return { imgKey: keyFromUrl(images.img_url), subKey: keyFromUrl(images.sub_url) };
}

function signWbi(params, imgKey, subKey) {
  const queryParams = { ...params, wts: Math.round(Date.now() / 1000) };
  const query = Object.keys(queryParams)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(queryParams[key])}`)
    .join('&');
  const wRid = createHash('md5').update(query + getMixinKey(imgKey + subKey)).digest('hex');
  return `${query}&w_rid=${wRid}`;
}

function normalizeVideo(video) {
  if (!video?.bvid) return null;
  return {
    bvid: video.bvid,
    title: String(video.title ?? video.bvid).replaceAll('&amp;', '&'),
    thumbnail: typeof video.pic === 'string' ? video.pic : '',
    plays: Number(video.play) || 0,
    likes: Number(video.like) || 0,
    coins: Number(video.coin) || 0,
    publishedAt: typeof video.created === 'number' ? new Date(video.created * 1000).toISOString() : null,
    url: `https://www.bilibili.com/video/${video.bvid}`,
  };
}

async function fetchAllVideos() {
  const { imgKey, subKey } = await fetchWbiKeys();
  const videos = new Map();
  let total = null;

  for (let pn = 1; pn <= MAX_PAGES; pn += 1) {
    const query = signWbi(
      {
        mid: MID,
        ps: PAGE_SIZE,
        pn,
        order: 'pubdate',
        tid: 0,
        keyword: '',
        platform: 'web',
        web_location: 1550101,
      },
      imgKey,
      subKey,
    );
    const json = await fetchJson(`https://api.bilibili.com/x/space/wbi/arc/search?${query}`);
    const page = json?.data?.page;
    const list = Array.isArray(json?.data?.list?.vlist) ? json.data.list.vlist : [];
    total = Number(page?.count) || total;

    for (const video of list) {
      const normalized = normalizeVideo(video);
      if (normalized) videos.set(normalized.bvid, normalized);
    }

    console.log(`页 ${pn}: ${list.length} 条，已收集 ${videos.size}${total ? ` / ${total}` : ''}`);
    if (list.length === 0 || (total != null && videos.size >= total) || list.length < PAGE_SIZE) break;
    await sleep(REQUEST_GAP_MS);
  }

  if (videos.size === 0) throw new Error('没有采集到任何视频，保留旧快照');
  return { total: total ?? videos.size, videos: [...videos.values()] };
}

async function main() {
  let existing = null;
  try {
    existing = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  } catch {
    // First run has no existing snapshot.
  }

  try {
    const { total, videos } = await fetchAllVideos();
    const output = {
      updatedAt: new Date().toISOString(),
      mid: MID,
      total,
      videos,
    };
    await mkdir(dirname(DATA_FILE), { recursive: true });
    await writeFile(DATA_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    console.log(`✓ 已写入 ${videos.length} 条视频: ${DATA_FILE}`);
  } catch (error) {
    if (existing?.videos?.length) {
      console.warn(`⚠ 全量采集失败，保留旧快照 (${existing.videos.length} 条): ${error.message}`);
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(`✗ 视频快照失败: ${error.message}`);
  process.exit(1);
});
