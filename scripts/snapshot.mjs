/**
 * zeroroku 式每日快照采集器
 *
 * 功能:
 *   1. 请求 B站公开接口获取当前粉丝数(免登录)
 *   2. 若配置了 BILI_COOKIE,再经 WBI 签名请求空间接口获取总播放/总获赞/稿件数
 *   3. 读取 public/data/fans-history.json 历史快照
 *   4. 计算 rate1(较昨日涨粉) / rate7(较7日前涨粉)
 *   5. 当天已有快照则更新,否则追加
 *
 * 用法:
 *   npm run snapshot
 *   可选: 设置环境变量 BILI_COOKIE="SESSDATA=...; buvid3=..." 以采集播放/获赞/稿件
 *
 * 定时(Windows 任务计划程序 或 cron):
 *   每天固定时间执行一次,例如每天 09:00:
 *     0 9 * * * cd /path/to/mitsusean-web && node scripts/snapshot.mjs
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const MID = 431115683; // 水聖安
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, '../public/data/fans-history.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const API_HEADERS = { 'User-Agent': UA, Referer: 'https://space.bilibili.com/' };
const COOKIE = process.env.BILI_COOKIE || '';

/** WBI 签名固定混淆表 */
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28,
  14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21,
  56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];
const md5 = (s) => createHash('md5').update(s).digest('hex');

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

/** 从 nav 接口获取 WBI 的 mixin key(未登录也可返回 wbi_img) */
async function getMixinKey(headers) {
  const nav = await fetch('https://api.bilibili.com/x/web-interface/nav', { headers }).then((r) => r.json());
  const { img_url, sub_url } = nav?.data?.wbi_img ?? {};
  if (!img_url || !sub_url) throw new Error('未获取到 wbi_img');
  const key = img_url.split('/').pop().split('.')[0] + sub_url.split('/').pop().split('.')[0];
  let mixin = '';
  for (const i of MIXIN_KEY_ENC_TAB) mixin += key[i];
  return mixin.slice(0, 32);
}

/**
 * 带登录 Cookie 请求空间信息接口,返回总播放/总获赞/稿件数/粉丝数。
 * 未配置 BILI_COOKIE 时返回 null(仅采粉丝)。播放/获赞/稿件需登录态,免登录会被风控拦截。
 */
async function fetchSpaceStats() {
  if (!COOKIE) return null;
  const headers = { ...API_HEADERS, Cookie: COOKIE };
  const mixin = await getMixinKey(headers);
  const params = { mid: String(MID), wts: Math.round(Date.now() / 1000) };
  const query = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  const url = `https://api.bilibili.com/x/space/wbi/acc/info?${query}&w_rid=${md5(query + mixin)}`;
  const res = await fetch(url, { headers }).then((r) => r.json());
  if (res?.code !== 0 || !res?.data) {
    throw new Error(`空间接口异常: ${JSON.stringify(res).slice(0, 200)}`);
  }
  const d = res.data;
  return {
    followers: typeof d.fans === 'number' ? d.fans : null,
    views: typeof d.view === 'number' ? d.view : null,
    likes: typeof d.like === 'number' ? d.like : null,
    videos: typeof d.video === 'number' ? d.video : null,
  };
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
  const space = await fetchSpaceStats(); // 无 Cookie 时为 null
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
  console.log(
    `✓ ${date} 粉丝 ${entry.followers} | rate1=${rate1 ?? '-'} rate7=${rate7 ?? '-'} | ` +
      `播放 ${entry.views ?? '-'} 获赞 ${entry.likes ?? '-'} 稿件 ${entry.videos ?? '-'}${hasSpace ? '' : ' (未配置 Cookie,播放/获赞/稿件未采集)'} | ` +
      `快照总数 ${snaps.length}`,
  );
}

main().catch((e) => {
  console.error('✗ 采集失败:', e.message);
  process.exit(1);
});
