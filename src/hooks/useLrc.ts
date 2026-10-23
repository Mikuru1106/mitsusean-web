import { useEffect, useState } from 'react';
import type { Track } from '../data/content';

export interface LrcLine {
  time: number; // 秒
  text: string;
}

const CACHE_PREFIX = 'mizusean-lrc-v1:';

/** 歌词里的制作人员信息行（作词/作曲/编曲…），不适合当作歌词滚动 */
const CREDIT_LINE = /^(作词|作詞|作曲|编曲|編曲|混音|母带|母帶|吉他|贝斯|貝斯|鼓|制作人|製作人|出品|监制|監製|录音|錄音|和声|和聲|统筹|企划|策劃)\s*[:：]/;

/** 解析 LRC 文本为 {time, text} 行(多时间标签取首个) */
export function parseLrc(raw: string): LrcLine[] {
  const lines: LrcLine[] = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (!m) continue;
    const time = Number(m[1]) * 60 + Number(m[2]);
    const text = m[3].trim();
    if (!text || CREDIT_LINE.test(text)) continue;
    // 同一时间戳的多行通常是原文与译文,合并成一句展示
    const prev = lines[lines.length - 1];
    if (prev && Math.abs(prev.time - time) < 0.001) prev.text += ` / ${text}`;
    else lines.push({ time, text });
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
 * 获取带时间轴歌词:
 * 1) 站内 LRC 优先——由 scripts/lyrics-snapshot.mjs 从 LyricSense(api.lrc.cx)抓取，
 *    随站点一起部署，不受接口跨域与收录情况影响；
 * 2) 站内文件缺失或为空时，回退 LRCLIB 开放歌词库兜底。
 * 返回 null = 暂无歌词。
 */
export function useLrc(track: Track): LrcLine[] | null {
  const [lines, setLines] = useState<LrcLine[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLines(null);

    // 站内 LRC 优先:LyricSense 抓取的歌词随站点部署,不依赖任何在线接口
    if (track.lyrics) {
      fetch(track.lyrics)
        .then((res) => (res.ok ? res.text() : ''))
        .then((raw) => {
          if (cancelled) return;
          setLines(raw ? parseLrc(raw) : null);
        })
        .catch(() => {
          if (!cancelled) setLines(null);
        });
      return () => {
        cancelled = true;
      };
    }

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
      // LRCLIB 的搜索接口使用 q 参数；artist_name/track_name 仅适用于 /get
      const searchQueries = [
        `${track.title} ${track.artist}`,
        track.title,
      ];
      for (const searchQuery of searchQueries) {
        const search = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`).catch(() => null);
        if (!search?.ok) continue;
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
