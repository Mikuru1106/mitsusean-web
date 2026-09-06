/**
 * zeroroku 式每日快照采集器
 *
 * 功能:
 *   1. 请求 B站公开接口获取当前粉丝数(免登录,稳定来源)
 *   2. 若配置了 BILI_COOKIE,用 WBI 签名请求 upstat 采集总播放/总获赞,
 *      用 navnum 采集稿件总数(纯 HTTP,无需浏览器)
 *   3. 读取 public/data/fans-history.json 历史快照
 *   4. 计算 rate1(较昨日涨粉) / rate7(较7日前涨粉)
 *   5. 当天已有快照则更新,否则追加
 *
 * 用法:
 *   npm run snapshot
 *   可选: 设置环境变量 BILI_COOKIE="SESSDATA=...; bili_jct=...; buvid3=..."
 *   以采集播放/获赞/稿件(总播放/总获赞接口需要登录态 + WBI 签名)
 *
 * 定时(GitHub Actions 或 cron):
 *   每天固定时间执行一次,例如每天 09:00(北京时间)。
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MID = 431115683; // 水聖安
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, '../public/data/fans-history.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const COOKIE = process.env.BILI_COOKIE || '';

async function fetchFollower() {
  const url = `https://api.bilibili.com/x/relation/stat?vmid=${MID}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://space.bilibili.com/' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json?.code !== 0 || typeof json?.data?.follower !== 'number') {
    throw new Error(`接口异常: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return json.data.follower;
}

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43,
  5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16,
  24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59,
  6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

function getMixinKey(original) {
  return MIXIN_KEY_ENC_TAB.map((index) => original[index]).join('').slice(0, 32);
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchWbiKeys() {
  const json = await fetchJson('https://api.bilibili.com/x/web-interface/nav', {
    'User-Agent': UA,
    Referer: 'https://space.bilibili.com/',
    ...(COOKIE ? { Cookie: COOKIE } : {}),
  });
  const images = json?.data?.wbi_img;
  if (!images?.img_url || !images?.sub_url) throw new Error('WBI key 缺失');
  const keyFromUrl = (url) => url.split('/').pop().split('.')[0];
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

/** 带登录 Cookie 调 WBI upstat 获取总播放/总获赞。 */
async function fetchUpstat() {
  if (!COOKIE) return null;
  const { imgKey, subKey } = await fetchWbiKeys();
  const query = signWbi({ mid: MID }, imgKey, subKey);
  const json = await fetchJson(`https://api.bilibili.com/x/space/upstat?${query}`, {
    'User-Agent': UA,
    Referer: 'https://space.bilibili.com/',
    Cookie: COOKIE,
  });
  const archive = json?.code === 0 ? json.data?.archive : null;
  if (!archive) return null;
  return {
    views: typeof archive.view === 'number' ? archive.view : null,
    likes: typeof json.data?.likes === 'number' ? json.data.likes : null,
  };
}

/** navnum 提供稿件总数,带 Cookie 时调用可避免页面 DOM 变化影响。 */
async function fetchNavnum() {
  const json = await fetchJson(`https://api.bilibili.com/x/space/navnum?mid=${MID}`, {
    'User-Agent': UA,
    Referer: 'https://space.bilibili.com/',
    ...(COOKIE ? { Cookie: COOKIE } : {}),
  });
  const video = json?.code === 0 ? json.data?.video : null;
  return typeof video === 'number' ? video : null;
}

/** 使用稳定的 WBI/HTTP 接口采集空间指标,失败时降级为 null,不影响粉丝采集。 */
async function fetchSpaceStats() {
  if (!COOKIE) return null;
  try {
    const [upstat, videos] = await Promise.all([
      fetchUpstat().catch((error) => {
        console.warn('WBI 播放/获赞采集失败:', error.message);
        return null;
      }),
      fetchNavnum().catch((error) => {
        console.warn('稿件数采集失败:', error.message);
        return null;
      }),
    ]);
    return {
      followers: null,
      views: upstat?.views ?? null,
      likes: upstat?.likes ?? null,
      videos,
    };
  } catch (error) {
    console.warn('空间指标采集异常(降级仅采粉丝):', error.message);
    return null;
  }
}

function todayCN() {
  // Asia/Shanghai 日期
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

/** 按日历日回退 n 天(不经时区转换) */
function dateOffsetCN(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - n));
  return t.toISOString().slice(0, 10);
}

async function main() {
  const follower = await fetchFollower();
  let space = null;
  try {
    space = await fetchSpaceStats(); // 无 Cookie 时为 null;异常时降级,不影响粉丝采集
  } catch (e) {
    console.warn('✗ 空间指标采集失败(降级仅采粉丝):', e.message);
  }
  const date = todayCN();

  let data = { updatedAt: '', snapshots: [] };
  try {
    data = JSON.parse(await readFile(DATA_FILE, 'utf-8'));
  } catch {
    /* 首次运行无文件 */
  }
  const snaps = Array.isArray(data.snapshots) ? data.snapshots : [];

  // rate1: 相比昨天; rate7: 相比7天前(日历日,不经时区换算)
  const byDate = new Map(snaps.map((s) => [s.date, s.followers]));
  const yest = dateOffsetCN(date, 1);
  const d7ago = dateOffsetCN(date, 7);
  const rate1 = byDate.has(yest) ? follower - byDate.get(yest) : null;
  const rate7 = byDate.has(d7ago) ? follower - byDate.get(d7ago) : null;

  const existingIndex = snaps.findIndex((snapshot) => snapshot.date === date);
  const existing = existingIndex >= 0 ? snaps[existingIndex] : null;
  const entry = {
    date,
    followers: space?.followers ?? follower,
    views: space?.views ?? existing?.views ?? null,
    likes: space?.likes ?? existing?.likes ?? null,
    videos: space?.videos ?? existing?.videos ?? null,
    rate1,
    rate7,
  };
  if (existingIndex >= 0) {
    snaps[existingIndex] = entry; // 当天已有则更新
  } else {
    snaps.push(entry); // 追加当天
  }

  snaps.sort((a, b) => a.date.localeCompare(b.date));
  data.updatedAt = new Date().toISOString();
  data.snapshots = snaps;

  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');

  const hasSpace = space && (space.views !== null || space.likes !== null || space.videos !== null);
  let spaceNote = '';
  if (space) spaceNote = hasSpace ? '' : ' (Cookie 已设置但未读到播放/获赞/稿件)';
  else spaceNote = ' (未设置 BILI_COOKIE)';
  console.log(
    `✓ ${date} 粉丝 ${entry.followers} | rate1=${rate1 ?? '-'} rate7=${rate7 ?? '-'} | ` +
      `播放 ${entry.views ?? '-'} 获赞 ${entry.likes ?? '-'} 稿件 ${entry.videos ?? '-'}${spaceNote} | ` +
      `快照总数 ${snaps.length}`,
  );
}

main().catch((e) => {
  console.error('✗ 采集失败:', e.message);
  process.exit(1);
});
