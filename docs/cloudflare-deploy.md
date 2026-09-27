# Cloudflare Pages 部署

本项目使用 **Cloudflare Pages + Pages Functions**：前端静态文件由 Pages 托管，`functions/` 中的 Worker 函数提供同域 B 站 API 代理。

## Git 集成部署（推荐）

1. 将仓库推送到 GitHub，并在 Cloudflare Dashboard 打开 **Workers & Pages → Create application → Pages → Connect to Git**。
2. 选择此仓库和 `main` 分支。
3. 构建设置填写：
   - Framework preset：`Vite`
   - Build command：`npm run build`
   - Build output directory：`dist`
   - Node.js version：`22`
4. 在 Pages 项目的 **Settings → Environment variables** 中，为 Preview 和 Production 分别添加 Secret：
   - 名称：`BILI_COOKIE`
   - 值：你的 B 站 Cookie（如未使用需要登录态的接口，可不配置）
5. 保存并部署。`functions/api/` 会随 Pages 一起部署，生产环境会提供：
   - `/api/bili/x/relation/stat?vmid=431115683`
   - `/api/bili/x/web-interface/view?bvid=...`
   - `/api/bili-audio?bvid=...`

GitHub Actions 会每天生成 `public/data/fans-history.json` 和 `public/data/videos.json`。如果 Pages 已连接 GitHub，快照提交会自动触发重新构建；也可以在 Pages 项目中手动重新部署。

## Wrangler 部署

首次使用需要登录：

```bash
npx wrangler login
```

然后构建并部署 Pages：

```bash
npm ci
npm run build
npx wrangler pages deploy dist --project-name mitsusean-web
```

首次部署时 Wrangler 会提示创建 Pages 项目。通过 Wrangler 部署时，Functions 会从仓库根目录的 `functions/` 一起识别；若使用 Dashboard Git 集成，Functions 会自动参与构建。

## 本地验证

```bash
npm run build
npx wrangler pages dev dist
```

然后检查：

- `http://localhost:8788/`
- `http://localhost:8788/about`
- `http://localhost:8788/api/bili/x/relation/stat?vmid=431115683`
- `http://localhost:8788/api/bili-audio?bvid=BV...`

不要把 `BILI_COOKIE` 写进代码、`.env`、GitHub 日志或公开 Pages 变量。音频代理仅接受合法 BV 号，并支持浏览器的 Range 请求。

## 自定义域名

部署成功后，在 Pages 项目的 **Custom domains** 中添加域名。若域名使用 Cloudflare DNS，按控制台提示添加记录并等待证书签发。

## 重要说明

- `/api/*` 由 Pages Functions 处理；其他页面和资源由 `dist/` 静态托管。
- 前端仍使用同域 `/api/...` 路径，开发环境由 Vite 代理，生产环境由 Pages Functions 处理。
- B 站接口、视频 CDN 和音频流可能受 B 站风控、Cookie 过期或 Referer 校验影响；接口失败时页面会回退到仓库中的静态快照。
