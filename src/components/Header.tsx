import { profile, navLinks } from '../data/content';
import { formatNum, useBiliStats } from '../hooks/useBiliStats';

export default function Header() {
  const stats = useBiliStats();

  const scrollTo = (hash: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.querySelector(hash);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 pt-4">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        {/* 站点名牌胶囊 */}
        <a
          href="#hero"
          onClick={scrollTo('#hero')}
          className="yaron-pill group flex items-center gap-2.5 py-1.5 pl-1.5 pr-4"
        >
          <img
            src={profile.avatar}
            alt={profile.name}
            referrerPolicy="no-referrer"
            className="size-9 rounded-full object-cover ring-2 ring-[#ff8fab]/50 transition-transform duration-300 group-hover:scale-105"
          />
          <span className="text-sm font-bold tracking-wide text-[#b76e79]">
            {profile.name}'s Fan Site
          </span>
        </a>

        {/* 锚点导航胶囊 */}
        <div className="yaron-pill hidden items-center gap-0.5 p-1.5 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.path}
              href={link.path}
              onClick={scrollTo(link.path)}
              className="rounded-full px-4 py-2 text-xs font-bold tracking-[0.15em] text-[#5f4b52] transition-all duration-300 hover:bg-[#ff8fab]/15 hover:text-[#b76e79]"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* 实时粉丝胶囊 */}
        <a
          href="#observatory"
          onClick={scrollTo('#observatory')}
          className="hero-live-badge !tracking-[0.12em]"
          title={stats.live ? 'B站实时粉丝数' : '快照粉丝数'}
        >
          <span className="hero-live-dot" aria-hidden="true" />
          <span>
            {stats.live ? 'LIVE' : 'SNAPSHOT'} · {formatNum(stats.latest.followers)}
          </span>
        </a>
      </nav>
    </header>
  );
}
