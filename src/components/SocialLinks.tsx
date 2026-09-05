import { SiBilibili, SiTiktok, SiQq } from 'react-icons/si';
import { profile } from '../data/content';

type SocialConfig = {
  icon?: React.ReactNode;
  /** 官方位图图标(react-icons 未收录时用) */
  imgSrc?: string;
  /** 图标底色;位图图标默认白底以衬托彩色 logo */
  bg: string;
};

const configs: Record<string, SocialConfig> = {
  bilibili: { icon: <SiBilibili />, bg: '#FB7299' },
  douyin: { icon: <SiTiktok />, bg: '#2b2b2b' },
  qq: { icon: <SiQq />, bg: '#12B7F5' },
  mihuashi: { imgSrc: '/mihuashi.ico', bg: '#ffffff' },
};

export default function SocialLinks() {
  return (
    <div className="flex flex-wrap gap-3">
      {Object.entries(profile.social).map(([key, { url, label }]) => {
        const cfg = configs[key] ?? { icon: null, bg: '#b76e79' };
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={label}
            aria-label={label}
            className="group relative flex size-11 items-center justify-center rounded-full text-xl text-white shadow-[0_6px_18px_rgba(183,110,121,0.2)] transition-transform duration-300 hover:-translate-y-1 hover:scale-105"
            style={{ background: cfg.bg }}
          >
            <span className="yaron-social-icon flex items-center justify-center" aria-hidden="true">
              {cfg.imgSrc ? (
                <img src={cfg.imgSrc} alt="" className="size-6" />
              ) : (
                cfg.icon
              )}
            </span>
            <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#ff8fab]/30 bg-white/95 px-2.5 py-1 text-[10px] font-bold text-[#5f4b52] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              {label}
            </span>
          </a>
        );
      })}
    </div>
  );
}
