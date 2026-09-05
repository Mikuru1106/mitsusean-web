/**
 * zeroroku 式每日快照采集器
 *
 * 功能:
 *   1. 请求 B站公开接口获取当前粉丝数
 *   2. 读取 public/data/fans-history.json 历史快照
 *   3. 计算 rate1(较昨日涨粉) / rate7(较7日前涨粉)
 *   4. 当天已有快照则更新,否则追加
 *
 * 用法:
 *   npm run snapshot
 *
 * 定时(Windows 任务计划程序 或 cron):
 *   每天固定时间执行一次,例如每天 09:00:
 *     0 9 * * * cd /path/to/mitsusean-web && node scripts/snapshot.mjs
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MID = 431115683; // 水聖安
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, '../public/data/fans-history.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function fetchFollower() {
  const url = `https://api.bilibili.com/x/relation/stat?vmid=${MID}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Referer: 'https://space.bilibili.com/' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json?.code !== 0 || typeof json?.data?.follower !== 'number') {
    throw new Error(`接口异常: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return json.data.follower;
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

  const entry = { date, followers: follower, rate1, rate7 };
  const existingIndex = snaps.findIndex((snapshot) => snapshot.date === date);
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

  console.log(`✓ ${date} 粉丝 ${follower} | rate1=${rate1 ?? '-'} rate7=${rate7 ?? '-'} | 快照总数 ${snaps.length}`);
}

main().catch((e) => {
  console.error('✗ 采集失败:', e.message);
  process.exit(1);
});
