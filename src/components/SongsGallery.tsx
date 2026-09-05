import { useEffect, useMemo, useState } from 'react';
import { TiLocationArrow } from 'react-icons/ti';
import { profile, songs, songCategories, type Song } from '../data/content';
import { formatNum } from '../hooks/useBiliStats';

const COVER_GRADIENTS = [
  'from-[#b76e79] via-[#ff8fab] to-[#ffeef5]',
  'from-[#5f7f9f] via-[#8db5d4] to-[#dde8ff]',
  'from-[#c97d87] via-[#e8b4bc] to-[#fff8f1]',
  'from-[#8b6f63] via-[#c4a89e] to-[#ffe7ef]',
  'from-[#7f9eb5] via-[#b8d0e0] to-[#f6fbff]',
  'from-[#b76e79] via-[#dd9da5] to-[#fff0f3]',
  'from-[#9a7fb8] via-[#c4b5fd] to-[#ffe7ef]',
];

/* ==================================================
   Song card — cover + meta, click to open player
   ================================================== */
function SongCard({ song, index, onOpen }: { song: Song; index: number; onOpen: () => void }) {
  return (
    <article
      onClick={onOpen}
      className="card-hover group cursor-pointer overflow-hidden !rounded-[1.5rem]"
    >
      {/* Cover */}
      <div className={`relative aspect-[16/10] overflow-hidden bg-gradient-to-br ${COVER_GRADIENTS[index % COVER_GRADIENTS.length]}`}>
        {song.thumbnail ? (
          <img src={song.thumbnail} alt={song.title} className="size-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-5xl opacity-40 transition-transform duration-700 group-hover:scale-110">
            💧
          </div>
        )}
        {/* shine sweep */}
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-black/10 via-transparent to-[#160d14]/45" />
        <div className="pointer-events-none absolute -left-1/3 top-0 z-10 h-full w-1/3 skew-x-[-18deg] bg-white/15 blur-xl transition-all duration-700 group-hover:left-full" />

        {/* tags */}
        <span className="absolute left-3 top-3 z-20 rounded-full border border-white/25 bg-black/35 px-3 py-1 font-general text-[9px] uppercase tracking-[0.3em] text-pink-100/90 backdrop-blur-md">
          切片 {String(index + 1).padStart(2, '0')}
        </span>
        <span className="absolute right-3 top-3 z-20 rounded-full bg-white/85 px-3 py-1 text-[10px] font-bold text-[#241322] backdrop-blur-md">
          {song.category}
        </span>

        {/* play button */}
        <span className="absolute inset-0 z-20 grid place-items-center">
          <span className="grid size-14 place-items-center rounded-full border border-white/40 bg-white/20 text-xl text-white backdrop-blur-md transition-all duration-500 group-hover:scale-110 group-hover:bg-white/35">
            ▶
          </span>
        </span>

        <span className="absolute bottom-3 left-4 z-20 font-general text-[10px] uppercase tracking-[0.3em] text-white/85">
          {song.date}
        </span>
      </div>

      {/* Body */}
      <div className="p-5">
        <h3 className="text-lg font-black leading-snug text-[#241322]">{song.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#8b6f63]">{song.desc}</p>
        <p className="mt-3 flex items-center gap-3 text-[11px] font-bold text-[#b76e79]">
          <span>▶ {formatNum(song.plays)}</span>
          <span>❤ {formatNum(song.likes)}</span>
          <span className="ml-auto inline-flex items-center gap-1 uppercase tracking-[0.2em] opacity-70 transition-opacity group-hover:opacity-100">
            播放 <TiLocationArrow />
          </span>
        </p>
      </div>
    </article>
  );
}

/* ==================================================
   Player modal
   ================================================== */
function PlayerModal({ song, onClose }: { song: Song; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#160d14]/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={song.title}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-[1.5rem] border border-[#ead4bf]/70 bg-[#fff8f1] shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-video bg-gradient-to-br from-[#b76e79] via-[#ff8fab] to-[#dde8ff]">
          {song.bvid ? (
            <iframe
              src={`https://player.bilibili.com/player.html?bvid=${song.bvid}&autoplay=0`}
              title={song.title}
              className="size-full"
              allowFullScreen
              scrolling="no"
              frameBorder="0"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#fff8f1]">
              <span className="text-5xl animate-float">💧</span>
              <p className="text-sm tracking-[0.2em] opacity-90">该切片暂未收录视频源</p>
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-4 p-5 md:p-6">
          <div>
            <p className="font-general text-[10px] uppercase tracking-[0.35em] text-[#b76e79]">
              {song.category} · {song.date} · ▶ {formatNum(song.plays)}
            </p>
            <h3 className="mt-1.5 text-xl font-black text-[#241322]">{song.title}</h3>
            <p className="mt-1 text-sm text-[#8b6f63]">{song.desc}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <a
              href={song.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[#241322] px-4 py-2 text-xs font-bold text-[#ffe7ef] transition-colors hover:bg-[#3d2535]"
            >
              去B站观看
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#ead4bf] px-4 py-2 text-xs font-bold text-[#5f4b52] transition-colors hover:bg-white"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================================================
   Songs gallery section
   ================================================== */
export default function SongsGallery() {
  const [category, setCategory] = useState<(typeof songCategories)[number]>('全部');
  const [sort, setSort] = useState<'latest' | 'hot'>('latest');
  const [active, setActive] = useState<Song | null>(null);

  const list = useMemo(() => {
    const filtered = category === '全部' ? songs : songs.filter((s) => s.category === category);
    const sorted = [...filtered];
    if (sort === 'latest') sorted.sort((a, b) => b.date.localeCompare(a.date));
    else sorted.sort((a, b) => b.plays - a.plays);
    return sorted;
  }, [category, sort]);

  return (
    <section id="songs" className="bg-[linear-gradient(180deg,#fff8f1_0%,#ffeef5_46%,#f6fbff_100%)] pb-16 md:pb-40">
      <div className="container mx-auto px-5 md:px-10">
        {/* Header */}
        <div className="flex flex-col gap-10 px-5 py-28 text-[#241322] md:flex-row md:items-center md:justify-between">
          <div className="md:max-w-xl">
            <p className="font-general text-xs uppercase tracking-[0.45em] text-[#b76e79]">
              A collection of song covers
            </p>
            <p className="mt-5 text-lg leading-relaxed text-[#5f4b52]">
              {profile.name}的翻唱作品合集，每一首都是精心演绎的音乐礼物。
            </p>
          </div>

          <a
            href={profile.social.bilibili.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ai-plaza-card group"
            aria-label="前往B站主页"
          >
            <span className="ai-plaza-card-numeral" aria-hidden="true">B</span>
            <span className="ai-plaza-card-rule" aria-hidden="true" />
            <div className="ai-plaza-card-inner">
              <span className="ai-plaza-card-eyebrow">— Bilibili</span>
              <h3 className="ai-plaza-card-title">
                B站
                <em>主页</em>
              </h3>
              <p className="ai-plaza-card-sub">
                前往{profile.name}的B站频道，<br />观看更多精彩内容。
              </p>
            </div>
            <span className="ai-plaza-card-cta" aria-hidden="true">
              <span>Enter</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </span>
          </a>
        </div>

        {/* Toolbar */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex flex-wrap gap-2">
            {songCategories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full border px-4 py-2 text-xs font-bold transition-all duration-300 ${
                  category === c
                    ? 'border-[#ff8fab] bg-[#ff8fab] text-[#241322] shadow-[0_6px_18px_rgba(255,143,171,0.35)]'
                    : 'border-[#ead4bf] bg-white/70 text-[#5f4b52] hover:bg-white'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="glass-tag !px-2 !py-1.5">
            {(['latest', 'hot'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] transition-all ${
                  sort === s ? 'bg-[#ff8fab] text-[#241322]' : 'text-[#5f4b52] hover:text-[#b76e79]'
                }`}
              >
                {s === 'latest' ? '最新' : '最热'}
              </button>
            ))}
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((song, i) => (
            <SongCard key={song.id} song={song} index={i} onOpen={() => setActive(song)} />
          ))}
        </div>
      </div>

      {active && <PlayerModal song={active} onClose={() => setActive(null)} />}
    </section>
  );
}
