import { useEffect, useState } from 'react';
import { featuredVideos } from '../data/videos';

export interface BiliVideo {
  bvid: string;
  title: string;
  thumbnail: string;
  plays: number;
  likes: number;
  coins: number;
  publishedAt?: string | null;
  url?: string;
}

interface VideoSnapshot {
  updatedAt?: string;
  total?: number;
  videos?: BiliVideo[];
}

export interface BiliVideoPool {
  videos: BiliVideo[];
  /** 全量快照的采集时间;回退到精选详情时为 null */
  updatedAt: string | null;
  source: 'snapshot' | 'featured' | 'empty';
}

let poolPromise: Promise<BiliVideoPool> | null = null;

async function fetchVideo(bvid: string): Promise<BiliVideo | null> {
  try {
    const res = await fetch(`/api/bili/x/web-interface/view?bvid=${bvid}`);
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data || !data.stat) return null;
    return {
      bvid,
      title: data.title ?? bvid,
      thumbnail: typeof data.pic === 'string' ? data.pic : '',
      plays: data.stat.view ?? 0,
      likes: data.stat.like ?? 0,
      coins: data.stat.coin ?? 0,
      url: `https://www.bilibili.com/video/${bvid}`,
    };
  } catch {
    return null;
  }
}

async function loadSnapshot(): Promise<BiliVideoPool> {
  try {
    const res = await fetch('/data/videos.json', { cache: 'no-cache' });
    if (!res.ok) return { videos: [], updatedAt: null, source: 'empty' };
    const json = (await res.json()) as VideoSnapshot;
    const videos = Array.isArray(json.videos) ? json.videos.filter((video) => video?.bvid) : [];
    if (videos.length === 0) return { videos: [], updatedAt: null, source: 'empty' };
    return { videos, updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : null, source: 'snapshot' };
  } catch {
    return { videos: [], updatedAt: null, source: 'empty' };
  }
}

function loadVideoPool(): Promise<BiliVideoPool> {
  if (!poolPromise) {
    poolPromise = loadSnapshot().then(async (snapshot) => {
      if (snapshot.videos.length > 0) return snapshot;
      const fallback = await Promise.all(featuredVideos.map((bvid) => fetchVideo(bvid)));
      const videos = fallback.filter((video): video is BiliVideo => video !== null);
      return { videos, updatedAt: null, source: videos.length ? 'featured' : 'empty' } as BiliVideoPool;
    });
  }
  return poolPromise;
}

/** 优先读取定时全量快照;快照不可用时回退到精选 BV 详情。 */
export function useBiliVideoPool(): BiliVideoPool {
  const [pool, setPool] = useState<BiliVideoPool>({ videos: [], updatedAt: null, source: 'empty' });

  useEffect(() => {
    let cancelled = false;
    void loadVideoPool().then((loaded) => {
      if (!cancelled) setPool(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return pool;
}

/** 只要视频列表的简化入口。 */
export function useBiliVideos(): BiliVideo[] {
  return useBiliVideoPool().videos;
}
