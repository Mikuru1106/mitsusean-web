/**
 * 站内静态资源路径助手。
 *
 * 站点可能部署在子路径下（例如 GitHub Pages 项目页 /mitsusean-web/），
 * 直接写 `/images/x.jpg` 这类根绝对路径会指到域名根目录从而 404。
 * 统一经 asset() 拼接 Vite 注入的 BASE_URL，本地开发（'/'）与线上（子路径）都能用。
 */
export const BASE_URL = import.meta.env.BASE_URL;

/** 给站内资源路径补上部署前缀；外链、data URI、锚点原样返回 */
export function asset(path: string): string {
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('#')) {
    return path;
  }
  return `${BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** react-router 的 basename，子路径部署时不带结尾斜杠 */
export const routerBasename = BASE_URL.replace(/\/+$/, '') || '/';
