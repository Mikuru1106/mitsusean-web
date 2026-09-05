/**
 * zeroroku 式每日快照采集器(浏览器版)
 *
 * 功能:
 *   1. 请求 B站公开接口获取当前粉丝数(免登录,稳定来源)
 *   2. 若配置了 BILI_COOKIE,启动 Chromium 带登录态打开个人主页,
 *      从主页请求的统计接口(优先)与页面统计卡(DOM 兜底)读取
 *      总播放 / 总获赞 / 稿件数
 *   3. 读取 public/data/fans-history.json 历史快照
 *   4. 计算 rate1(较昨日涨粉) / rate7(较7日前涨粉)
 *   5. 当天已有快照则更新,否则追加
 *
 * 用法:
 *   npm run snapshot
 *   可选: 设置环境变量 BILI_COOKIE="SESSDATA=...; buvid3=..." 以采集播放/获赞/稿件
 *   需要 Playwright 浏览器: 首次运行前执行 npx playwright install chromium
 *
 * 定时(GitHub Actions 或 cron):
 *   每天固定时间执行一次,例如每天 09:00(北京时间)。
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

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

/** 解析 B 站统计文案:"118" -> 118, "1.2万" -> 12000, "3.4亿" -> 340000000 */
function parseBiliNum(s) {
  if (s === null || s === undefined) return null;
  const text = String(s).trim().toLowerCase().replace(/,/g, '');
  const m = text.match(/^([\d.]+)\s*(万|亿)?$/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  if (m[2] === '万') n *= 1e4;
  if (m[2] === '亿') n *= 1e8;
  return Math.round(n);
}

/** 从个人主页统计卡和可见文本读取 视频/阅读/获赞 */
async function readDomStats(page) {
  const out = { videos: null, views: null, likes: null };
  const items = await page.$$('.n-stat__item');
  for (const it of items) {
    let title = null;
    try {
      title = (await it.$eval('.n-stat__title', (e) => e.textContent)).trim();
    } catch {
      title = null;
    }
    let numText = null;
    try {
      numText = (await it.$eval('.n-stat__num', (e) => e.textContent)).trim();
    } catch {
      numText = (await it.innerText()).replace(/\s+/g, ' ').trim().split(' ').pop();
    }
    const n = parseBiliNum(numText);
    if (title && title.includes('视频')) out.videos = n;
    else if (title && title.includes('阅读')) out.views = n;
    else if (title && title.includes('获赞')) out.likes = n;
  }

  // 页面版本变更时统计卡类名可能变化,用标签附近的文本作兜底。
  const bodyText = await page.locator('body').innerText().catch(() => '');
  for (const [label, key] of [['视频', 'videos'], ['阅读', 'views'], ['获赞', 'likes']]) {
    if (out[key] !== null) continue;
    const match = bodyText.match(new RegExp(`${label}\\s*([\\d,.]+\\s*(?:万|亿)?)`));
    if (match) out[key] = parseBiliNum(match[1]);
  }
  return out;
}

/**
 * 带登录 Cookie 启动 Chromium 打开个人主页,采集总播放/总获赞/稿件数。
 * 未配置 BILI_COOKIE 时返回 null(仅采粉丝);异常或未读到数据时降级为 null,不影响粉丝采集。
 */
async function fetchSpaceStats() {
  if (!COOKIE) return null;
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    });
    const context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1440, height: 900 },
      screen: { width: 1440, height: 900 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      extraHTTPHeaders: { Cookie: COOKIE, Referer: 'https://www.bilibili.com/' },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await context.newPage();

    // 拦截所有空间类接口,广度解析总播放/获赞/稿件/粉丝,并记录各接口字段供诊断
    let resp = { followers: null, views: null, likes: null, videos: null };
    const apiUrls = new Set();
    const apiKeys = new Map();
    page.on('response', async (res) => {
      const url = res.url();
      if (!/\/x\/(space|relation|wbi|web-interface)/.test(url)) return;
      const base = url.split('?')[0];
      apiUrls.add(base);
      try {
        const j = await res.json();
        const d = j?.data;
        if (!d) return;
        if (!apiKeys.has(base)) apiKeys.set(base, Object.keys(d).slice(0, 24).join(','));
        if (typeof d.fans === 'number' && resp.followers === null) resp.followers = d.fans;
        if (typeof d.view === 'number' && resp.views === null) resp.views = d.view;
        if (d.archive && typeof d.archive.view === 'number' && resp.views === null)
          resp.views = d.archive.view;
        if (typeof d.like === 'number' && resp.likes === null) resp.likes = d.like;
        if (typeof d.video === 'number' && resp.videos === null) resp.videos = d.video;
      } catch {
        /* 忽略非 JSON 响应 */
      }
    });

    await page.goto(`https://space.bilibili.com/${MID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // 空间页是重型 SPA,给足渲染时间
    await page.waitForTimeout(8000);
    // 等统计卡渲染
    try {
      await page.waitForSelector('.n-stat__item', { timeout: 8000 });
    } catch {
      /* 允许超时,DOM 为 null */
    }
    await page.waitForTimeout(1500);
    const dom = await readDomStats(page).catch(() => null);

    // 非敏感诊断: 只输出结构信息,不含 Cookie
    try {
      const diag = await page.evaluate(() => {
        const body = document.body ? document.body.innerText : '';
        return {
          url: location.href,
          hasLogin: /登录|请登录/.test(body),
          hasVerify: /验证|风控|安全校验/.test(body),
          hasNstat: !!document.querySelector('.n-stat'),
          labels: ['视频', '阅读', '获赞', '总播放', '稿件'].filter((k) => body.includes(k)),
        };
      });
      console.warn(
        `[diag] url=${diag.url} login=${diag.hasLogin} verify=${diag.hasVerify} nstat=${diag.hasNstat} ` +
          `labels=${diag.labels.join(',')} apis=${[...apiUrls].slice(0, 6).join(',')}`,
      );
      console.warn(
        `[diag] keys=${[...apiKeys.entries()]
          .map(([u, k]) => u.split('/').pop() + ':' + k)
          .join(' | ')}`,
      );
    } catch {
      /* 诊断失败不影响采集 */
    }

    return {
      followers: resp?.followers ?? null,
      views: resp?.views ?? dom?.views ?? null,
      likes: resp?.likes ?? dom?.likes ?? null,
      videos: resp?.videos ?? dom?.videos ?? null,
    };
  } catch (e) {
    console.warn('浏览器采集异常(降级仅采粉丝):', e.message);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
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
