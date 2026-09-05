import { FaEnvelope } from 'react-icons/fa';
import { SiBilibili } from 'react-icons/si';
import { profile } from '../data/content';
import { useBiliStats } from '../hooks/useBiliStats';

const socialIcons = [
  { href: profile.social.bilibili.url, icon: <SiBilibili />, label: 'B站' },
  { href: '#', icon: <FaEnvelope />, label: 'Email' },
];

export default function Footer() {
  const stats = useBiliStats();
  const updated = stats.live
    ? `${stats.updated.slice(5, 16).replace('T', ' ')} 实时`
    : stats.updated.slice(0, 10);

  return (
    <footer className="footer-shell">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row max-w-7xl">
        <p className="text-center text-sm font-light md:text-left text-[#5f4b52]">
          @{profile.nameJP}
        </p>

        <div className="flex justify-center gap-4 md:justify-start">
          {socialIcons.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex items-center gap-2 text-lg text-[#2B2B2B] hover:text-[#FF8FAB] transition-colors duration-300"
            >
              {link.icon}
              <span className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 border border-[#F2E6C9] bg-white/95 text-[#2B2B2B]">
                {link.label}
              </span>
            </a>
          ))}
        </div>

        <p className="text-center text-sm font-light md:text-right text-[#5f4b52]">
          非官方应援站 · 仅作学习使用
          <span className="block text-[10px] tracking-[0.2em] text-[#b76e79]/70 mt-0.5">
            数据{stats.live ? '实时获取' : '快照'}更新于 {updated}
          </span>
        </p>
      </div>
    </footer>
  );
}
