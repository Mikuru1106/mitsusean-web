/**
 * 用 LyricSense 的开放歌词接口（api.lrc.cx）抓取首页曲目的歌词与封面。
 * Usage: npm run lyrics-snapshot
 *
 * 接口本身不返回 CORS 头，浏览器直连会被拦截，所以在构建期抓成站内静态文件：
 *   - 同步歌词 → public/lyrics/{bvid}.lrc
 *   - 封面地址 → public/data/lyricsense.json（缩小到 300px，避免线上拉几 MB 大图）
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TRACKS = [
  { bvid: 'BV1CW411K7Rn', title: 'ヒッチコック', artist: 'ヨルシカ' },
  { bvid: 'BV19x41167us', title: '言って。', artist: 'ヨルシカ' },
  { bvid: 'BV1dW41137on', title: 'ただ君に晴れ', artist: 'ヨルシカ' },
  { bvid: 'BV1cm411U7vi', title: '溶けた声で', artist: 'culicc_' },
  { bvid: 'BV1cL411W7Kz', title: '好きだから。', artist: '『ユイカ』' },
];

const API = 'https://api.lrc.cx';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LYRICS_DIR = resolve(ROOT, 'public/lyrics');
const MANIFEST = resolve(ROOT, 'public/data/lyricsense.json');
const TIMEOUT = 15_000;

/** 只接受带时间轴的 LRC；纯文本结果（[!text]）无法用来同步，直接跳过 */
const isSyncedLrc = (text) => /^\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/m.test(text);

const q = (params) => new URLSearchParams(params).toString();

async function fetchLyrics(track) {
  const url = `${API}/lyrics?${q({ artist: track.artist, title: track.title })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = (await res.text()).trim();
  if (!isSyncedLrc(text)) throw new Error('接口只返回了无时间轴的纯文本');
  return text;
}

/** 封面接口是 302 到网易云 / Apple Music 的 CDN，顺手把尺寸改成 300px */
function resizeCover(url) {
  try {
    const u = new URL(url.replace(/^http:/, 'https:'));
    if (/music\.126\.net$/.test(u.hostname)) {
      u.searchParams.set('param', '300y300');
      return u.toString();
    }
    if (/mzstatic\.com$/.test(u.hostname)) {
      return u.toString().replace(/\/\d+x\d+bb\.(jpg|png)$/i, '/300x300bb.$1');
    }
    return u.toString();
  } catch {
    return url;
  }
}

async function fetchCover(track) {
  const url = `${API}/cover?${q({ artist: track.artist, title: track.title })}`;
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT) });
  const location = res.headers.get('location');
  if (!location) throw new Error('封面接口没有返回跳转地址');
  return resizeCover(location);
}

async function readPrevious() {
  try {
    return JSON.parse(await readFile(MANIFEST, 'utf8'))?.tracks ?? {};
  } catch {
    return {};
  }
}

async function main() {
  await mkdir(LYRICS_DIR, { recursive: true });
  await mkdir(dirname(MANIFEST), { recursive: true });
  const previous = await readPrevious();
  const tracks = {};
  let ok = 0;
  let kept = 0;

  for (const track of TRACKS) {
    const entry = { title: track.title, artist: track.artist };
    try {
      const lrc = await fetchLyrics(track);
      const file = resolve(LYRICS_DIR, `${track.bvid}.lrc`);
      await writeFile(file, lrc.endsWith('\n') ? lrc : `${lrc}\n`, 'utf8');
      entry.lyrics = `/lyrics/${track.bvid}.lrc`;
      entry.lines = lrc.split('\n').filter(Boolean).length;
      ok += 1;
      console.log(`✓ ${track.title} 歌词已更新 (${entry.lines} 行)`);
    } catch (error) {
      const prev = previous[track.bvid];
      if (prev?.lyrics) {
        entry.lyrics = prev.lyrics;
        entry.lines = prev.lines;
        kept += 1;
        console.warn(`⚠ ${track.title} 抓取失败，保留旧文件：${error.message}`);
      } else {
        console.warn(`⚠ ${track.title} 无可用歌词：${error.message}`);
      }
    }

    try {
      entry.cover = await fetchCover(track);
    } catch (error) {
      entry.cover = previous[track.bvid]?.cover ?? null;
      console.warn(`⚠ ${track.title} 封面获取失败：${error.message}`);
    }
    tracks[track.bvid] = entry;
  }

  const output = { source: 'api.lrc.cx (LyricSense)', updatedAt: new Date().toISOString(), tracks };
  await writeFile(MANIFEST, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`歌词结果：新抓取 ${ok} 首，保留 ${kept} 首，共 ${Object.keys(tracks).length} 首`);
  if (ok === 0 && kept === 0) throw new Error('所有曲目都没有拿到歌词');
}

main().catch((error) => {
  console.error(`✗ 歌词快照失败：${error.message}`);
  process.exit(1);
});
