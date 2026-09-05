import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { songs } from '../data/content';
import {
  formatNum,
  useBiliStats,
  useCountUp,
  recentSnapshots,
  type BiliStats,
} from '../hooks/useBiliStats';

gsap.registerPlugin(ScrollTrigger);

/* ==================================================
   Stat card — count-up number + daily delta
   ================================================== */
function StatCard({
  icon,
  label,
  sub,
  value,
  daily,
  rate1,
  rate7,
}: {
  icon: string;
  label: string;
  sub: string;
  value: number;
  daily: number;
  rate1?: number | null;
  rate7?: number | null;
}) {
  const shown = useCountUp(value);
  const fmtDelta = (n: number) => `${n >= 0 ? '+' : ''}${formatNum(n)}`;

  return (
    <div className="obs-card group">
      <div className="flex items-center justify-between">
        <span className="text-lg">{icon}</span>
        <span className="obs-eyebrow !tracking-[0.25em]">{sub}</span>
      </div>
      <p className="obs-num mt-3 text-2xl md:text-[1.7rem] text-[#ffe7ef] leading-none">
        {formatNum(shown)}
      </p>
      <p className="mt-2 text-[11px] text-white/50">
        {label}
        {rate1 != null ? (
          <span className="ml-2 font-bold text-[#8be9b8]">
            {fmtDelta(rate1)}
            {rate7 != null ? (
              <span className="text-white/40"> · 7日 {fmtDelta(rate7)}</span>
            ) : null}
          </span>
        ) : (
          <span className="ml-2 font-bold text-[#8be9b8]">
            {fmtDelta(daily)} / 日
          </span>
        )}
      </p>
    </div>
  );
}

/* ==================================================
   Growth area chart — smooth SVG curve with hover
   ================================================== */
const CHART_W = 640;
const CHART_H = 240;
const PAD = { l: 14, r: 14, t: 22, b: 26 };

function buildPoints(data: { date: string; followers: number }[]) {
  const values = data.map((d) => d.followers);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = CHART_W - PAD.l - PAD.r;
  const innerH = CHART_H - PAD.t - PAD.b;
  return data.map((d, i) => ({
    x: PAD.l + (i / Math.max(1, data.length - 1)) * innerW,
    y: PAD.t + (1 - (d.followers - min) / span) * innerH,
    ...d,
  }));
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function GrowthChart({ stats }: { stats: BiliStats }) {
  const [range, setRange] = useState<30 | 90>(90);
  const pathRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const data = useMemo(() => recentSnapshots(stats, range), [stats, range]);
  const pts = useMemo(() => buildPoints(data), [data]);
  const linePath = useMemo(() => smoothPath(pts), [pts]);
  const areaPath = useMemo(
    () =>
      pts.length > 1
        ? `${linePath} L ${pts[pts.length - 1].x} ${CHART_H - PAD.b} L ${pts[0].x} ${CHART_H - PAD.b} Z`
        : '',
    [linePath, pts],
  );

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    const tl = gsap.timeline();
    tl.fromTo(
      path,
      { strokeDasharray: len, strokeDashoffset: len },
      { strokeDashoffset: 0, duration: 1.8, ease: 'power2.out' },
    );
    if (areaRef.current) {
      tl.fromTo(areaRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, delay: 0.4 }, 0);
    }
    return () => {
      tl.kill();
    };
  }, [range, linePath]);

  const onMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg || pts.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CHART_W;
    let best = 0;
    let bestDist = Infinity;
    pts.forEach((p, i) => {
      const dist = Math.abs(p.x - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover !== null ? pts[hover] : null;
  const hpPrev = hover !== null && hover > 0 ? pts[hover - 1] : null;

  return (
    <div className="obs-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="obs-eyebrow">GROWTH · 粉丝增长</p>
          <p className="mt-1 text-xs text-white/45">曲线如水，慢慢涨潮。</p>
        </div>
        <div className="flex gap-1.5">
          {([30, 90] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`obs-pill ${range === r ? 'is-active' : ''}`}
            >
              {r}天
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="growth-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff8fab" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ff8fab" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="growth-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#c97d87" />
              <stop offset="100%" stopColor="#ff8fab" />
            </linearGradient>
          </defs>

          {areaPath && (
            <path ref={areaRef} d={areaPath} fill="url(#growth-area)" />
          )}
          {linePath && (
            <path
              ref={pathRef}
              d={linePath}
              fill="none"
              stroke="url(#growth-line)"
              strokeWidth="2.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {hp && (
            <g>
              <line
                x1={hp.x}
                y1={PAD.t - 8}
                x2={hp.x}
                y2={CHART_H - PAD.b}
                stroke="rgba(255,231,239,0.35)"
                strokeDasharray="3 4"
              />
              <circle cx={hp.x} cy={hp.y} r="5" fill="#ff8fab" stroke="#ffe7ef" strokeWidth="2" />
            </g>
          )}

          <text x={PAD.l} y={CHART_H - 8} fontSize="10" fill="rgba(255,231,239,0.4)">
            {data[0]?.date}
          </text>
          <text x={CHART_W - PAD.r} y={CHART_H - 8} fontSize="10" fill="rgba(255,231,239,0.4)" textAnchor="end">
            {data[data.length - 1]?.date}
          </text>
        </svg>

        {hp && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-[#ff8fab]/40 bg-[#1a1018]/95 px-3 py-2 text-center shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
            style={{ left: `${(hp.x / CHART_W) * 100}%`, top: 0 }}
          >
            <p className="text-[10px] tracking-widest text-white/50">{hp.date}</p>
            <p className="obs-num text-sm text-[#ffe7ef]">{hp.followers.toLocaleString('zh-CN')}</p>
            {hpPrev && (
              <p className="text-[10px] font-bold text-[#8be9b8]">
                +{hp.followers - hpPrev.followers}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================================================
   Follower heatmap — last 90 days, GitHub style
   ================================================== */
function Heatmap({ stats }: { stats: BiliStats }) {
  const cells = useMemo(() => {
    const data = recentSnapshots(stats, 91);
    const out: { date: string; delta: number }[] = [];
    for (let i = 1; i < data.length; i++) {
      out.push({ date: data[i].date, delta: data[i].followers - data[i - 1].followers });
    }
    // 补齐到周对齐(周一开始)
    const firstDate = new Date(`${out[0]?.date ?? stats.latest.date}T00:00:00`);
    const pad = (firstDate.getDay() + 6) % 7;
    return [...Array.from({ length: pad }, () => null), ...out];
  }, [stats]);

  const level = (delta: number) => {
    if (delta >= 70) return 4;
    if (delta >= 40) return 3;
    if (delta >= 20) return 2;
    if (delta >= 8) return 1;
    return 0;
  };
  const colors = [
    'rgba(255,143,171,0.10)',
    'rgba(255,143,171,0.28)',
    'rgba(255,143,171,0.52)',
    'rgba(255,143,171,0.78)',
    '#ff8fab',
  ];

  const columns: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));

  return (
    <div className="obs-card obs-heatmap-card flex flex-col">
      <div>
        <p className="obs-eyebrow">TIDES · 涨粉热力</p>
        <p className="mt-1 text-xs text-white/45">近 90 天，每日净涨粉。</p>
      </div>
      <div className="mt-4 grid aspect-[13/7] grid-flow-col grid-cols-[repeat(13,minmax(0,1fr))] grid-rows-7 gap-[3px] overflow-hidden">
        {Array.from({ length: 91 }).map((_, i) => {
          const ci = Math.floor(i / 7);
          const ri = i % 7;
          const cell = columns[ci]?.[ri];
          return (
            <div
              key={i}
              className="min-h-0 min-w-0 aspect-square rounded-[3px]"
              style={{ background: cell ? colors[level(cell.delta)] : 'rgba(255,143,171,0.07)' }}
              title={cell ? `${cell.date} · +${cell.delta}` : '尚未记录'}
            />
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[9px] text-white/40">
        <span>少</span>
        {colors.map((c) => (
          <span key={c} className="size-2.5 rounded-[3px]" style={{ background: c }} />
        ))}
        <span>多</span>
        <span className="ml-2 text-[#ff8fab]/70">· 已记录 {Math.max(0, cells.filter(Boolean).length)} 天</span>
      </div>
    </div>
  );
}

/* ==================================================
   Recent clips performance — animated bars
   ================================================== */
function ClipBars() {
  const containerRef = useRef<HTMLDivElement>(null);
  const top = useMemo(() => [...songs].sort((a, b) => b.plays - a.plays).slice(0, 5), []);
  const maxPlays = Math.max(...top.map((s) => s.plays));
  const maxLikes = Math.max(...top.map((s) => s.likes));
  const maxCoins = Math.max(...top.map((s) => s.coins));

  useGSAP(
    () => {
      gsap.fromTo(
        '.clip-bar-fill',
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: 'left center',
          duration: 1.2,
          ease: 'power2.out',
          stagger: 0.06,
          scrollTrigger: { trigger: containerRef.current, start: 'top 82%' },
        },
      );
    },
    { scope: containerRef },
  );

  const metrics = [
    { key: 'plays', label: '播放', max: maxPlays, color: '#ff8fab' },
    { key: 'likes', label: '点赞', max: maxLikes, color: '#c97d87' },
    { key: 'coins', label: '投币', max: maxCoins, color: '#8db5d4' },
  ] as const;

  return (
    <div ref={containerRef} className="obs-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="obs-eyebrow">WAVES · 近期切片表现</p>
          <p className="mt-1 text-xs text-white/45">播放最多的五条切片。</p>
        </div>
        <div className="flex gap-3">
          {metrics.map((m) => (
            <span key={m.key} className="flex items-center gap-1.5 text-[10px] text-white/50">
              <span className="size-2 rounded-full" style={{ background: m.color }} />
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {top.map((song) => (
          <div key={song.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-xs font-bold text-[#ffe7ef]/85">{song.title}</p>
              <p className="obs-num shrink-0 text-[11px] text-white/45">
                {formatNum(song.plays)} 播放
              </p>
            </div>
            <div className="mt-1.5 space-y-1">
              {metrics.map((m) => (
                <div key={m.key} className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="clip-bar-fill h-full rounded-full"
                      style={{
                        width: `${Math.max(4, (song[m.key] / m.max) * 100)}%`,
                        background: `linear-gradient(90deg, ${m.color}88, ${m.color})`,
                      }}
                    />
                  </div>
                  <span className="obs-num w-12 text-right text-[10px] text-white/40">
                    {formatNum(song[m.key])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================================================
   Observatory section
   ================================================== */
export default function Observatory() {
  const stats = useBiliStats();
  const updatedShort = stats.live
    ? `${stats.updated.slice(11, 16)} 实时`
    : stats.updated.slice(5, 10).replace('-', '/');

  return (
    <section id="observatory" className="relative w-full px-4 py-20 md:px-10 md:py-28">
      <div className="obs-shell mx-auto max-w-6xl">
        <div className="obs-grid-bg" aria-hidden="true" />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="obs-eyebrow">SOURCE OBSERVATORY</p>
              <h2 className="mt-2 text-3xl font-black leading-none text-[#ffe7ef] md:text-5xl">
                B站数据<b className="text-[#ff8fab]">观测舱</b>
              </h2>
            </div>
            <span className={`obs-pill ${stats.live ? 'is-active' : ''}`}>
              ● {stats.live ? `LIVE · 实时获取于 ${updatedShort}` : `快照更新于 ${updatedShort}`}
            </span>
          </div>

          {/* Stat cards */}
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <StatCard icon="💧" label="粉丝数" sub="FANS" value={stats.latest.followers} daily={stats.daily.followers} rate1={stats.rate1} rate7={stats.rate7} />
            <StatCard icon="▶" label="总播放量" sub="VIEWS" value={stats.latest.views} daily={stats.daily.views} />
            <StatCard icon="❤" label="总获赞" sub="LIKES" value={stats.latest.likes} daily={stats.daily.likes} />
            <StatCard icon="📼" label="稿件数" sub="WORKS" value={stats.latest.videos} daily={stats.daily.videos} />
          </div>

          {/* Charts */}
          <div className="mx-auto mt-4 grid max-w-4xl items-stretch gap-3 md:grid-cols-2 md:gap-4">
            <GrowthChart stats={stats} />
            <Heatmap stats={stats} />
          </div>

          {/* Clips performance */}
          <div className="mt-4">
            <ClipBars />
          </div>

          {/* Footnote */}
          <p className="mt-6 text-center text-[10px] tracking-[0.2em] text-white/30">
            数据来自 B站公开接口的每日快照，仅供参考 · 每一滴水都被记录
          </p>
        </div>
      </div>
    </section>
  );
}
