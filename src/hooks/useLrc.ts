import { useEffect, useState } from 'react';
import type { Track } from '../data/content';

export interface LrcLine {
  time: number; // 秒
  text: string;
}

const CACHE_PREFIX = 'mizusean-lrc-v1:';

/** 解析 LRC 文本为 {time, text} 行(多时间标签取首个) */
export function parseLrc(raw: string): LrcLine[] {
  const lines: LrcLine[] = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (!m) continue;
    const time = Number(m[1]) * 60 + Number(m[2]);
    const text = m[3].trim();
    if (text) lines.push({ time, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

const cacheLrc = (key: string, lrc: string | null) => {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ lrc, ts: Date.now() }));
  } catch {
    /* 忽略存储失败 */
  }
};

const readCache = (key: string): string | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lrc: string | null; ts: number };
    return parsed.lrc;
  } catch {
    return null;
  }
}

/**
 * 从 LRCLIB(开放歌词库,与音乐软件同类方案)获取带时间轴歌词。
 * 返回 null = 暂无歌词(组件回退显示单句片段)。
 */
export function useLrc(track: Track): LrcLine[] | null {
  const [lines, setLines] = useState<LrcLine[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLines(null);

    const cached = readCache(track.title);
    if (cached !== null) {
      setLines(parseLrc(cached));
      return;
    }

    const fetchOne = async (): Promise<string | null> => {
      const q = `artist_name=${encodeURIComponent(track.artist)}&track_name=${encodeURIComponent(track.title)}`;
      // 先精确 get,再 search 兜底
      const get = await fetch(`https://lrclib.net/api/get?${q}`).catch(() => null);
      if (get?.ok) {
        const j = await get.json();
        if (j?.syncedLyrics) return j.syncedLyrics as string;
      }
      const search = await fetch(`https://lrclib.net/api/search?${q}`).catch(() => null);
      if (search?.ok) {
        const list = await search.json();
        const hit = (Array.isArray(list) ? list : []).find((r: { syncedLyrics?: string }) => r.syncedLyrics);
        if (hit) return hit.syncedLyrics as string;
      }
      return null;
    };

    fetchOne().then((lrc) => {
      if (cancelled) return;
      cacheLrc(track.title, lrc);
      setLines(lrc ? parseLrc(lrc) : null);
    });

    return () => {
      cancelled = true;
    };
  }, [track.title, track.artist]);

  return lines;
}

/** 根据当前播放进度计算活跃行下标 */
export function activeLrcIndex(lines: LrcLine[], currentTime: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime + 0.35) idx = i;
    else break;
  }
  return idx;
}
