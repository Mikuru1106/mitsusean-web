import { useEffect, useState } from 'react';
import { featuredVideos } from '../data/videos';

export interface BiliVideo {
  bvid: string;
  title: string;
  plays: number;
  likes: number;
  coins: number;
}

/** 逐个 bvid 调用公开 view 接口,实时拉取真实播放/点赞/投币。
 *  经 /api/bili 代理(dev)或直连 api.bilibili.com;失败或 B 站返回非 0 时丢弃该条。 */
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
      plays: data.stat.view ?? 0,
      likes: data.stat.like ?? 0,
      coins: data.stat.coin ?? 0,
    };
  } catch {
    return null;
  }
}

/** 拉取代表视频的真实数据;名单为空或全失败时返回空数组。 */
export function useBiliVideos(bvids: string[] = featuredVideos): BiliVideo[] {
  const [videos, setVideos] = useState<BiliVideo[]>([]);

  useEffect(() => {
    if (bvids.length === 0) return;
    let cancelled = false;
    Promise.all(bvids.map((b) => fetchVideo(b))).then((results) => {
      if (cancelled) return;
      setVideos(results.filter((v): v is BiliVideo => v !== null));
    });
    return () => {
      cancelled = true;
    };
  }, [bvids]);

  return videos;
}