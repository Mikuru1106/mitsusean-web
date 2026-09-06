import { useEffect, useMemo, useState } from 'react';
import { profile } from '../data/content';
import { snapshots as staticSnaps, snapshotUpdated, type BiliSnapshot } from '../data/history';

/** 大数缩写:98.7万 / 1.2亿 */
export function formatNum(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString('zh-CN');
}

export function formatDateCN(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}月${Number(d)}日`;
}

export interface BiliStats {
  latest: BiliSnapshot;
  prev: BiliSnapshot;
  updated: string;
  /** true = 已用 B站实时接口覆盖「今日」快照;false = 仅历史快照 */
  live: boolean;
  /** 最新一天的日涨粉(较昨日;存在缺口时为日均) */
  rate1: number | null;
  /** 近7日涨粉 */
  rate7: number | null;
  /** 各项指标的每日增长(按日历日缺口分摊的日均;无有效对比时为 null) */
  daily: { followers: number | null; views: number | null; likes: number | null; videos: number | null };
  snapshots: BiliSnapshot[];
}

/* ==================================================
   采集器数据(public/data/fans-history.json)
   由 scripts/snapshot.mjs 每日写入:日期/粉丝/rate1/rate7
   ================================================== */
interface FansHistoryFile {
  updatedAt: string;
  snapshots: Array<{
    date: string;
    followers: number;
    views?: number | null;
    likes?: number | null;
    videos?: number | null;
    rate1?: number | null;
    rate7?: number | null;
  }>;
}

/** 历史记录起点:2026-09-01(真实采集开始日,zeroroku 式) */
const HISTORY_START = '2026-09-01';

/** 把采集器 JSON 构建为快照序列(只含 HISTORY_START 起的真实记录)。
 *  播放/获赞/稿件由采集器写入(需 Cookie),缺失时保留 null——「每日增长」只基于真实数据计算,
 *  总量展示时的静态表兜底由 applyStaticFallback 单独负责,避免把兜底恒值误算成 +0。 */
function buildSnapshots(json: FansHistoryFile): BiliSnapshot[] {
  return json.snapshots
    .filter((s) => s.date >= HISTORY_START)
    .map((j) => ({
      date: j.date,
      followers: j.followers,
      views: j.views ?? Number.NaN,
      likes: j.likes ?? Number.NaN,
      videos: j.videos ?? Number.NaN,
      rate1: j.rate1 ?? null,
      rate7: j.rate7 ?? null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 总量展示兜底:某日播放/获赞/稿件缺失(采集器未读到,记为 NaN)时,沿用静态表同日值(同日缺失则取最后一条) */
function applyStaticFallback(s: BiliSnapshot): BiliSnapshot {
  const statByDate = new Map(staticSnaps.map((x) => [x.date, x]));
  const stat = statByDate.get(s.date) ?? staticSnaps[staticSnaps.length - 1];
  return {
    ...s,
    views: Number.isNaN(s.views) ? stat.views : s.views,
    likes: Number.isNaN(s.likes) ? stat.likes : s.likes,
    videos: Number.isNaN(s.videos) ? stat.videos : s.videos,
  };
}

/** 两个 YYYY-MM-DD 日期的自然日差(按 UTC 求,避免时区换算) */
function calendarDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000,
  );
}

type MetricKey = 'followers' | 'views' | 'likes' | 'videos';

/**
 * 某指标最新快照相对最近一条「有效」快照的每日增长(日均)。
 * 数据有缺口时按日历日数分摊,使「每日增长」反映真实日均水平,而非把 N 天累计标成「每日」。
 * 最新值缺失、或该指标从未出现过两次有效记录时返回 null。
 */
function dailyDelta(snaps: BiliSnapshot[], key: MetricKey): number | null {
  if (snaps.length < 2) return null;
  const last = snaps[snaps.length - 1];
  const lastV = last[key] as number;
  if (Number.isNaN(lastV)) return null;
  for (let i = snaps.length - 2; i >= 0; i--) {
    const s = snaps[i];
    const sv = s[key] as number;
    if (Number.isNaN(sv)) continue;
    const gap = calendarDays(s.date, last.date);
    if (gap <= 0) return null;
    return Math.round((lastV - sv) / gap);
  }
  return null;
}

/** 粉丝「近7日」累计增长:最新 - 距今≥7天的最近一条快照;不足7天时返回 null */
function weekDelta(snaps: BiliSnapshot[]): number | null {
  if (snaps.length < 2) return null;
  const last = snaps[snaps.length - 1];
  for (let i = snaps.length - 2; i >= 0; i--) {
    const gap = calendarDays(snaps[i].date, last.date);
    if (gap >= 7) return last.followers - snaps[i].followers;
  }
  return null;
}

/* ==================================================
   实时兜底(设计方案 B)
   dev 下经 Vite 代理 /api/bili 请求公开接口,取实时粉丝数
   覆盖「今日」快照;失败或生产 CORS 受限时静默回退快照。
   结果写入 localStorage,30 分钟内不重复请求。
   ================================================== */
const LIVE_CACHE_KEY = 'mizusean-bili-live';
const LIVE_TTL = 30 * 60 * 1000;

interface LiveInfo {
  follower: number;
  ts: number;
}

function readLiveCache(): LiveInfo | null {
  try {
    const raw = localStorage.getItem(LIVE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveInfo;
    if (typeof parsed.follower !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLiveCache(info: LiveInfo) {
  try {
    localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(info));
  } catch {
    /* 隐私模式等场景下忽略 */
  }
}

async function fetchLiveFollower(): Promise<number | null> {
  try {
    const res = await fetch(`/api/bili/x/relation/stat?vmid=${profile.mid}`);
    if (!res.ok) return null;
    const json = await res.json();
    const follower = json?.data?.follower;
    return typeof follower === 'number' && json?.code === 0 ? follower : null;
  } catch {
    return null;
  }
}

export function useBiliStats(): BiliStats {
  const [snaps, setSnaps] = useState<BiliSnapshot[]>(() =>
    staticSnaps.filter((s) => s.date >= HISTORY_START).map((s) => ({ ...s, rate1: null, rate7: null })),
  );
  const [live, setLive] = useState<LiveInfo | null>(() => {
    const cached = readLiveCache();
    return cached && Date.now() - cached.ts < LIVE_TTL ? cached : null;
  });

  // 加载采集器写入的每日快照(含 rate1/rate7),失败回退静态表
  useEffect(() => {
    let cancelled = false;
    fetch('/data/fans-history.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: FansHistoryFile) => {
        if (cancelled || !Array.isArray(json?.snapshots)) return;
        const built = buildSnapshots(json);
        if (built.length) setSnaps(built);
      })
      .catch(() => {
        /* 回退静态表 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (live && Date.now() - live.ts < LIVE_TTL) return;
    let cancelled = false;
    fetchLiveFollower().then((follower) => {
      if (cancelled || follower === null) return;
      const info: LiveInfo = { follower, ts: Date.now() };
      setLive(info);
      writeLiveCache(info);
    });
    return () => {
      cancelled = true;
    };
  }, [live]);

  return useMemo(() => {
    const snapshots = snaps.slice();
    let latest = snapshots[snapshots.length - 1];
    const prev = snapshots[snapshots.length - 2] ?? latest;

    let updated = snapshotUpdated;
    let isLive = false;

    if (live) {
      // 实时粉丝数覆盖「今日」快照(views/likes/videos 无免登录实时接口,沿用快照值)
      const liveLatest: BiliSnapshot = { ...latest, followers: live.follower };
      snapshots[snapshots.length - 1] = liveLatest;
      latest = liveLatest;
      const fetchedAt = new Date(live.ts);
      const pad = (n: number) => String(n).padStart(2, '0');
      const offset = -fetchedAt.getTimezoneOffset();
      const sign = offset >= 0 ? '+' : '-';
      updated = `${fetchedAt.getFullYear()}-${pad(fetchedAt.getMonth() + 1)}-${pad(fetchedAt.getDate())}T${pad(fetchedAt.getHours())}:${pad(fetchedAt.getMinutes())}:${pad(fetchedAt.getSeconds())}${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
      isLive = true;
    }

    // 每日增长只基于真实快照计算;总量展示时给播放/获赞/稿件补静态值兜底
    return {
      latest: applyStaticFallback(latest),
      prev,
      updated,
      live: isLive,
      rate1: dailyDelta(snapshots, 'followers'),
      rate7: weekDelta(snapshots),
      daily: {
        followers: dailyDelta(snapshots, 'followers'),
        views: dailyDelta(snapshots, 'views'),
        likes: dailyDelta(snapshots, 'likes'),
        videos: dailyDelta(snapshots, 'videos'),
      },
      snapshots,
    };
  }, [snaps, live]);
}

/** 取最近 n 天快照 */
export function recentSnapshots(stats: BiliStats, days: number): BiliSnapshot[] {
  return stats.snapshots.slice(Math.max(0, stats.snapshots.length - days));
}

/** 数字滚动动画(1.2s ease-out) */
export function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
