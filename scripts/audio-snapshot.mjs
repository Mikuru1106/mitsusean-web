/**
 * Download authorized homepage tracks into static audio files.
 * Usage: BILI_COOKIE='...' npm run audio-snapshot
 */
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TRACKS = [
  { title: 'ヒッチコック', bvid: 'BV1CW411K7Rn' },
  { title: '言って。', bvid: 'BV19x41167us' },
  { title: 'ただ君に晴れ', bvid: 'BV1dW41137on' },
  { title: '溶けた声で', bvid: 'BV1cm411U7vi' },
  { title: '好きだから。', bvid: 'BV1cL411W7Kz' },
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
const COOKIE = process.env.BILI_COOKIE || '';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_DIR = resolve(ROOT, 'public/audio');
const MANIFEST_FILE = resolve(ROOT, 'public/data/audio-manifest.json');
const REQUEST_GAP_MS = 1200;
const MAX_RETRIES = 2;
const MAX_AUDIO_BYTES = 80 * 1024 * 1024;
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function headers(referer = 'https://www.bilibili.com/') {
  return {
    'User-Agent': UA,
    Referer: referer,
    Origin: 'https://www.bilibili.com',
    Accept: 'application/json, text/plain, */*',
    ...(COOKIE ? { Cookie: COOKIE } : {}),
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (json?.code !== 0) throw new Error(`B站接口 code=${json?.code ?? 'unknown'}`);
  return json;
}

async function withRetries(task, label) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await sleep(2000 * (attempt + 1));
    }
  }
  throw new Error(`${label}: ${lastError?.message || 'failed'}`);
}

async function downloadTrack(track) {
  const view = await fetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${track.bvid}`);
  const cid = view?.data?.cid;
  if (!cid) throw new Error('未找到 cid');

  const playUrl = await fetchJson(
    `https://api.bilibili.com/x/player/playurl?bvid=${track.bvid}&cid=${cid}&qn=16&fnval=16`,
  );
  const audio = [...(playUrl?.data?.dash?.audio || [])].sort((a, b) => Number(b.id) - Number(a.id))[0];
  const source = audio?.baseUrl || audio?.base_url;
  if (!source) throw new Error('未找到音频流');

  const response = await fetch(source, {
    headers: {
      ...headers(`https://www.bilibili.com/video/${track.bvid}`),
      Accept: 'audio/*,*/*;q=0.8',
    },
  });
  if (!response.ok || !response.body) throw new Error(`音频下载 HTTP ${response.status}`);
  const declaredLength = Number(response.headers.get('content-length'));
  if (declaredLength > MAX_AUDIO_BYTES) throw new Error('音频文件过大');

  const target = resolve(AUDIO_DIR, `${track.bvid}.m4a`);
  const temporary = `${target}.tmp`;
  await rm(temporary, { force: true });
  await mkdir(AUDIO_DIR, { recursive: true });
  const file = await import('node:fs').then(({ createWriteStream }) => createWriteStream(temporary));
  let bytes = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > MAX_AUDIO_BYTES) throw new Error('音频文件过大');
      if (!file.write(chunk)) await new Promise((resolvePromise, reject) => {
        file.once('drain', resolvePromise);
        file.once('error', reject);
      });
    }
    await new Promise((resolvePromise, reject) => {
      file.once('error', reject);
      file.end(resolvePromise);
    });
    if (bytes === 0) throw new Error('音频文件为空');
    await rename(temporary, target);
  } catch (error) {
    file.destroy();
    await rm(temporary, { force: true });
    throw error;
  }
  return { path: `/audio/${track.bvid}.m4a`, bytes };
}

async function main() {
  await mkdir(dirname(MANIFEST_FILE), { recursive: true });
  let previous = {};
  try {
    const old = JSON.parse(await readFile(MANIFEST_FILE, 'utf8'));
    previous = old?.files || {};
  } catch {
    // First run.
  }

  const files = {};
  for (const track of TRACKS) {
    try {
      const result = await withRetries(() => downloadTrack(track), track.bvid);
      files[track.bvid] = { ...result, title: track.title, updatedAt: new Date().toISOString() };
      console.log(`✓ ${track.bvid} 音频已更新 (${Math.round(result.bytes / 1024)} KiB)`);
    } catch (error) {
      if (previous[track.bvid]) {
        files[track.bvid] = previous[track.bvid];
        console.warn(`⚠ ${track.bvid} 下载失败，保留旧文件: ${error.message}`);
      } else {
        console.warn(`⚠ ${track.bvid} 下载失败，暂不生成文件: ${error.message}`);
      }
    }
    await sleep(REQUEST_GAP_MS);
  }

  const output = { updatedAt: new Date().toISOString(), files };
  await writeFile(MANIFEST_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  try {
    const size = await stat(MANIFEST_FILE);
    console.log(`✓ 音频清单已写入 (${size.size} bytes)`);
  } catch {
    // Manifest was already written; no further action needed.
  }
}

main().catch((error) => {
  console.error(`✗ 音频快照失败: ${error.message}`);
  process.exit(1);
});
