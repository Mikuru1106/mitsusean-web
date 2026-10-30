/**
 * 临时脚本：B 站扫码登录，二维码过期自动换新；成功后写入 Worker 的 BILI_COOKIE。
 * 关键点：所有网络请求都带超时，避免卡死导致不换码。
 */
import QRCode from 'qrcode';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const H = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' };

const renderPage = (key, stamp) =>
  `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>B站扫码登录</title>
<meta http-equiv="refresh" content="30">
<style>
body{margin:0;display:grid;place-items:center;min-height:100vh;background:#fdf6ef;font-family:'PingFang SC','Microsoft YaHei',sans-serif;color:#241322}
.card{background:#fff;border-radius:20px;padding:26px 32px;box-shadow:0 20px 60px rgba(120,90,100,.16);text-align:center}
h1{margin:0 0 6px;font-size:17px}p{margin:0 0 16px;font-size:12.5px;color:#7a5e52;line-height:1.7}
img{display:block;border-radius:8px}.k{margin-top:12px;font-size:11px;color:#9b5560;font-family:ui-monospace,monospace}
</style></head>
<body><div class="card">
<h1>用手机 B 站 App 扫码并确认</h1>
<p>确认后 Cookie 会自动写入 Worker，你不用再做别的<br>二维码约 3 分钟过期，本页每 30 秒自动刷新换新</p>
<img src="qr-login.png?r=${stamp}" width="300" height="300" alt="B站登录二维码">
<div class="k">key ${key.slice(0, 8)}…</div>
</div></body></html>`;

async function generateQr() {
  const res = await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
    headers: H,
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error('generate failed: ' + JSON.stringify(json));
  return json.data;
}

for (let round = 1; round <= 40; round++) {
  let qr;
  try {
    qr = await generateQr();
  } catch (err) {
    console.log(`[round ${round}] 生成失败: ${err.message}`);
    await new Promise((r) => setTimeout(r, 3000));
    continue;
  }

  const stamp = Date.now();
  await QRCode.toFile('qr-login.png', qr.url, { width: 300, margin: 2 });
  writeFileSync('qr-login.html', renderPage(qr.qrcode_key, stamp));
  console.log(`[round ${round}] 二维码已更新 ${new Date().toLocaleTimeString('zh-CN')} key=${qr.qrcode_key}`);

  const deadline = Date.now() + 170_000;
  let cookie = '';

  while (Date.now() < deadline) {
    let json = null;
    let res = null;
    try {
      res = await fetch(
        `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${qr.qrcode_key}&source=main-fe-header`,
        { headers: H, signal: AbortSignal.timeout(8000) },
      );
      json = await res.json();
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    const code = json?.data?.code;
    if (code === 0) {
      const setCookies = res.headers.getSetCookie?.() ?? [];
      cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
      console.log('SCAN_OK cookies=' + setCookies.length);
      break;
    }
    if (code === 86038) {
      console.log(`[round ${round}] 已过期，换新`);
      break;
    }
    await new Promise((r) => setTimeout(r, 2500));
  }

  if (cookie) {
    const written = spawnSync(
      'npx',
      ['wrangler', 'secret', 'put', 'BILI_COOKIE', '--config', 'workers/wrangler.toml'],
      { input: cookie + '\n', encoding: 'utf8', shell: true, env: { ...process.env, CI: '1' } },
    );
    console.log('SECRET_EXIT=' + written.status);
    console.log(String(written.stdout || '').split('\n').slice(-4).join('\n'));
    process.exit(0);
  }
}

console.log('轮次用尽，未拿到 cookie');
process.exit(2);
