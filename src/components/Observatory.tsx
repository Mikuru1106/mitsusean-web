import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { asset } from '../lib/asset';
import { songs } from '../data/content';
import type { BiliSnapshot } from '../data/history';
import {
  formatNum,
  recentSnapshots,
  useBiliStats,
  useCountUp,
  type BiliStats,
} from '../hooks/useBiliStats';
import { useBiliVideos } from '../hooks/useBiliVideos';
import '../observatory.css';

gsap.registerPlugin(ScrollTrigger);

/* ==================================================
   工具
   ================================================== */
const fmt = (n: number) => n.toLocaleString('zh-CN');
const fmtSigned = (n: number) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}`;

/** 2026-10-17 → 10月17日 */
const mdCN = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${Number(m)}月${Number(d)}日`;
};
/** 2026-10-17 → 10/17 */
const mdShort = (iso: string) => iso.slice(5).replace('-', '/');
/** 两个日期间的自然日跨度（含首尾） */
const spanDays = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;

/** 单日涨粉序列 */
function dailyDeltas(snaps: BiliSnapshot[]) {
  const out: { date: string; delta: number }[] = [];
  for (let i = 1; i < snaps.length; i++) {
    out.push({ date: snaps[i].date, delta: snaps[i].followers - snaps[i - 1].followers });
  }
  return out;
}

/** 峰值日：单日涨粉最大的一天 */
function peakOf(deltas: { date: string; delta: number }[]) {
  return deltas.reduce((best, cur) => (cur.delta > best.delta ? cur : best), {
    date: '',
    delta: 0,
  });
}

/** 该指标最后一次真正采到的日期（采集断档时标注数据停在哪天） */
function lastCapturedDate(snaps: BiliSnapshot[], key: 'views' | 'likes' | 'videos') {
  for (let i = snaps.length - 1; i >= 0; i--) {
    if (Number.isFinite(snaps[i][key] as number)) return snaps[i].date;
  }
  return null;
}

/** 「今天多了 +N 个」/「最近 N 天多了 +N 个」 */
function deltaPhrase(delta: number, gapDays: number, isToday: boolean) {
  if (gapDays > 1) {
    return (
      <>
        ，最近 {gapDays} 天多了 <b>{fmt(Math.abs(delta))}</b> 个。
      </>
    );
  }
  if (delta === 0) return <>，今天没什么变化。</>;
  return (
    <>
      ，{isToday ? '今天' : '最近一天'}
      {delta > 0 ? '多了' : '少了'} <b>{fmt(Math.abs(delta))}</b> 个。
    </>
  );
}

/* ==================================================
   KPI 卡
   ================================================== */
function KpiCard({
  label,
  sub,
  unit,
  value,
  daily,
  week,
  note,
}: {
  label: string;
  sub: string;
  unit?: string;
  value: number;
  daily: number | null;
  week?: number | null;
  note?: string;
}) {
  const shown = useCountUp(value);
  const flat = daily == null;

  return (
    <article className="obs-card obs-kpi">
      <p className="k-lbl">
        {label}
        <span>{sub}</span>
      </p>
      <p className="k-big">
        {fmt(shown)}
        {unit ? <span className="k-unit">{unit}</span> : null}
      </p>
      {flat ? (
        <p className="k-delta is-flat">{note ?? '待采集'}</p>
      ) : (
        <p className="k-delta">
          {fmtSigned(daily)}
          <span>
            {' '}/ 日{week != null ? ` · 7日 ${fmtSigned(week)}` : ''}
          </span>
        </p>
      )}
    </article>
  );
}

/* ==================================================
   曲线：粉丝增长
   ================================================== */
const CHART_W = 760;
const CHART_H = 230;
const PAD = { l: 44, r: 10, t: 18, b: 28 };

interface Pt {
  x: number;
  y: number;
  date: string;
  followers: number;
}

function buildPoints(data: BiliSnapshot[]): Pt[] {
  if (!data.length) return [];
  const values = data.map((d) => d.followers);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const iw = CHART_W - PAD.l - PAD.r;
  const ih = CHART_H - PAD.t - PAD.b;
  return data.map((d, i) => ({
    x: +(PAD.l + (i / Math.max(1, data.length - 1)) * iw).toFixed(2),
    y: +(PAD.t + (1 - (d.followers - min) / span) * ih).toFixed(2),
    date: d.date,
    followers: d.followers,
  }));
}

function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${
      p2.y - (p3.y - p1.y) / 6
    } ${p2.x} ${p2.y}`;
  }
  return d;
}

function GrowthChart({
  stats,
  range,
}: {
  stats: BiliStats;
  range: 30 | 90;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);

  const data = useMemo(() => recentSnapshots(stats, range), [stats, range]);
  const pts = useMemo(() => buildPoints(data), [data]);
  const line = useMemo(() => smoothPath(pts), [pts]);
  const area = useMemo(
    () =>
      pts.length > 1
        ? `${line} L ${pts[pts.length - 1].x} ${CHART_H - PAD.b} L ${pts[0].x} ${CHART_H - PAD.b} Z`
        : '',
    [line, pts],
  );

  const summary = useMemo(() => {
    if (pts.length < 2) return null;
    const first = pts[0];
    const last = pts[pts.length - 1];
    let maxDaily = 0;
    for (let i = 1; i < pts.length; i++) {
      maxDaily = Math.max(maxDaily, pts[i].followers - pts[i - 1].followers);
    }
    return { first, last, gain: last.followers - first.followers, maxDaily };
  }, [pts]);

  useEffect(() => {
    const path = lineRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    const tl = gsap.timeline();
    tl.fromTo(
      path,
      { strokeDasharray: len, strokeDashoffset: len },
      { strokeDashoffset: 0, duration: 1.4, ease: 'power2.out' },
    );
    if (areaRef.current) {
      tl.fromTo(areaRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9 }, 0.3);
    }
    return () => {
      tl.kill();
    };
  }, [line]);

  const ticks = useMemo(() => {
    if (!data.length) return [];
    const values = data.map((d) => d.followers);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const ih = CHART_H - PAD.t - PAD.b;
    return [0, 1, 2, 3].map((k) => {
      const v = Math.round(max - (k / 3) * span);
      return { y: PAD.t + (k / 3) * ih, text: `${(v / 10000).toFixed(1)}万` };
    });
  }, [data]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pts.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CHART_W;
    let best = 0;
    let dist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover != null ? pts[hover] : null;
  const hpPrev = hover != null && hover > 0 ? pts[hover - 1] : null;

  return (
    <article className="obs-card obs-pad">
      <div className="obs-card-head">
        <h3>粉丝增长</h3>
        <span className="obs-hint">悬停看单日</span>
      </div>

      <div className="obs-chart">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          role="img"
          aria-label="粉丝增长折线图"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="obs-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b7a6ee" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#b7a6ee" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((t, k) => (
            <g key={t.y}>
              <line
                x1={PAD.l}
                y1={t.y}
                x2={CHART_W - PAD.r}
                y2={t.y}
                stroke="rgba(38,28,58,.07)"
                strokeDasharray={k === 3 ? '0' : '2 6'}
              />
              <text
                x={PAD.l - 10}
                y={t.y + 3.5}
                textAnchor="end"
                fill="#b6b2c4"
                fontSize="9.5"
                fontFamily="ui-monospace,Consolas,monospace"
              >
                {t.text}
              </text>
            </g>
          ))}

          {area && <path ref={areaRef} d={area} fill="url(#obs-area)" />}
          {line && (
            <path
              ref={lineRef}
              d={line}
              fill="none"
              stroke="#241f2e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 末端点：青柠 */}
          {pts.length > 1 && (
            <g>
              <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="9" fill="rgba(217,242,124,.55)" />
              <circle
                cx={pts[pts.length - 1].x}
                cy={pts[pts.length - 1].y}
                r="4.2"
                fill="#c8e85c"
                stroke="#fdfcff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* 悬停 */}
          {hp && (
            <g pointerEvents="none">
              <line
                x1={hp.x}
                y1={PAD.t - 6}
                x2={hp.x}
                y2={CHART_H - PAD.b}
                stroke="rgba(38,28,58,.22)"
                strokeDasharray="2 4"
              />
              <circle cx={hp.x} cy={hp.y} r="4" fill="#241f2e" stroke="#fdfcff" strokeWidth="2" />
            </g>
          )}

          {/* x 轴 */}
          {pts.length > 1 && (
            <>
              <text x={pts[0].x} y={CHART_H - 8} fill="#b6b2c4" fontSize="9.5" fontFamily="ui-monospace,Consolas,monospace">
                {mdShort(pts[0].date)}
              </text>
              <text
                x={pts[pts.length - 1].x}
                y={CHART_H - 8}
                textAnchor="end"
                fill="#b6b2c4"
                fontSize="9.5"
                fontFamily="ui-monospace,Consolas,monospace"
              >
                {mdShort(pts[pts.length - 1].date)}
              </text>
            </>
          )}
        </svg>

        {hp && (
          <div
            className="obs-tip"
            style={{
              left: `${Math.min(90, Math.max(10, (hp.x / CHART_W) * 100))}%`,
              top: `${(hp.y / CHART_H) * 100}%`,
              marginTop: '-14px',
            }}
          >
            <span className="d">{mdShort(hp.date)}</span>
            <b>{fmt(hp.followers)}</b>
            {hpPrev ? <i>{fmtSigned(hp.followers - hpPrev.followers)}</i> : null}
          </div>
        )}
      </div>

      {summary && (
        <div className="obs-foot">
          <span>
            起点 <b>{fmt(summary.first.followers)}</b>
          </span>
          <span>
            最新 <b>{fmt(summary.last.followers)}</b>
          </span>
          <span>
            区间增幅 <b className="is-up">{fmtSigned(summary.gain)}</b>
          </span>
          <span>
            最大单日 <b>+{fmt(summary.maxDaily)}</b>
          </span>
        </div>
      )}
    </article>
  );
}

/* ==================================================
   热力：每日净涨粉
   ================================================== */
const HEAT_COLORS = [
  'rgba(139,116,216,.08)',
  'rgba(139,116,216,.24)',
  'rgba(139,116,216,.42)',
  'rgba(139,116,216,.64)',
  'rgba(139,116,216,.9)',
];

function HeatCard({ stats }: { stats: BiliStats }) {
  const { cells, recorded, rows } = useMemo(() => {
    const deltas = dailyDeltas(stats.snapshots);
    const sorted = deltas.map((d) => Math.max(0, d.delta)).sort((a, b) => a - b);
    const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))] ?? 0;
    const [t1, t2, t3, t4] = [q(0.15), q(0.4), q(0.65), q(0.85)];
    const level = (v: number) => (v >= t4 ? 4 : v >= t3 ? 3 : v >= t2 ? 2 : v >= t1 ? 1 : 0);

    const pad = (13 - (deltas.length % 13)) % 13;
    const list: ({ date: string; delta: number; level: number } | null)[] = [
      ...Array.from({ length: pad }, () => null),
      ...deltas.map((d) => ({ ...d, delta: Math.max(0, d.delta), level: level(d.delta) })),
    ];
    return { cells: list, recorded: deltas.length, rows: Math.max(1, list.length / 13) };
  }, [stats]);

  // 一句话观察：峰值之后涨速是之前的几倍
  const observation = useMemo(() => {
    const snaps = stats.snapshots;
    if (snaps.length < 3) return null;
    const deltas = dailyDeltas(snaps);
    const peak = peakOf(deltas);
    const peakIdx = deltas.findIndex((d) => d.date === peak.date);
    if (peakIdx < 0) return null;
    const peakAt = snaps[peakIdx + 1];
    const beforeN = Math.min(peakIdx + 1, 10);
    const before = beforeN > 0 ? (peakAt.followers - snaps[peakIdx + 1 - beforeN].followers) / beforeN : 0;
    const afterN = deltas.length - 1 - peakIdx;
    const after = afterN > 0 ? (snaps[snaps.length - 1].followers - peakAt.followers) / afterN : 0;
    return {
      peakDate: peak.date,
      after: Math.round(after),
      ratio: before > 0 ? after / before : 0,
    };
  }, [stats]);

  return (
    <article className="obs-card obs-pad">
      <div className="obs-card-head">
        <h3>涨粉热力</h3>
        <span className="obs-hint">已记录 {recorded} 天</span>
      </div>

      <div
        className="obs-heat"
        role="img"
        aria-label="每日净涨粉热力图"
        style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {cells.map((c, i) => (
          <i
            key={c?.date ?? `empty-${i}`}
            style={{ background: c ? HEAT_COLORS[c.level] : 'rgba(38,28,58,.045)' }}
            title={c ? `${mdShort(c.date)} · ${fmtSigned(c.delta)}` : '尚未记录'}
          />
        ))}
      </div>

      <div className="obs-heat-legend">
        <span>少</span>
        {HEAT_COLORS.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
        <span>多</span>
      </div>

      {observation && (
        <p className="obs-note-line">
          <span className="bullet" />
          <span>
            {observation.ratio >= 1.15 ? (
              <>
                {mdCN(observation.peakDate)}之后，日均涨粉是之前的 <b>{observation.ratio.toFixed(1)}</b> 倍。
              </>
            ) : (
              <>
                最近日均 <b>{fmtSigned(observation.after)}</b>，慢慢涨潮。
              </>
            )}
          </span>
        </p>
      )}
    </article>
  );
}

/* ==================================================
   TOP 视频
   ================================================== */
interface TopItem {
  id: string;
  title: string;
  plays: number;
}

function TopClips() {
  const liveVideos = useBiliVideos();

  const top = useMemo<TopItem[]>(() => {
    const src: TopItem[] = liveVideos.length
      ? liveVideos.map((v) => ({ id: v.bvid, title: v.title, plays: v.plays }))
      : songs.map((s) => ({ id: s.id, title: s.title, plays: s.plays }));
    return [...src].sort((a, b) => b.plays - a.plays).slice(0, 5);
  }, [liveVideos]);

  if (!top.length) return null;
  const max = Math.max(1, ...top.map((t) => t.plays));

  return (
    <section>
      <div className="obs-section-head">
        <h3>播放最高的视频</h3>
        <span className="obs-hint">TOP 5 / 播放</span>
      </div>

      <ol className="obs-tops">
        {top.map((t, i) => (
          <li key={t.id} className="obs-card obs-clip">
            {i === 0 && <span className="badge">TOP 1</span>}
            <span className="rank">{String(i + 1).padStart(2, '0')}</span>
            <p className="t" title={t.title}>
              {t.title}
            </p>
            <p className="p">
              {fmt(t.plays)}
              <span className="u">播放</span>
            </p>
            <span className="bar">
              <i style={{ width: `${((t.plays / max) * 100).toFixed(1)}%` }} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ==================================================
   Observatory 板块
   ================================================== */
export default function Observatory() {
  const stats = useBiliStats();
  const rootRef = useRef<HTMLElement>(null);
  const [range, setRange] = useState<30 | 90>(90);

  const intro = useMemo(() => {
    const snaps = stats.snapshots;
    if (snaps.length < 2) return null;
    const first = snaps[0];
    const last = snaps[snaps.length - 1];
    const prev = snaps[snaps.length - 2];
    const day = spanDays(first.date, last.date);
    const peak = peakOf(dailyDeltas(snaps.slice(-31)));

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const currentDate = stats.live ? todayIso : last.date;

    const lastDelta = last.followers - prev.followers;
    const gapDays = Math.max(1, spanDays(prev.date, currentDate) - 1);

    return {
      day,
      peakDate: peak.date,
      peakDelta: peak.delta,
      peakIsLatest: peak.date === last.date,
      followers: last.followers,
      lastDelta,
      gapDays,
      isToday: currentDate === todayIso,
      gain: last.followers - first.followers,
    };
  }, [stats]);

  const viewsCaptured = lastCapturedDate(stats.snapshots, 'views');
  const likesCaptured = lastCapturedDate(stats.snapshots, 'likes');
  const no = String(stats.snapshots.length).padStart(3, '0');

  useGSAP(
    () => {
      const items = rootRef.current?.querySelectorAll<HTMLElement>('.obs-rv');
      if (!items?.length) return;
      gsap.from(Array.from(items), {
        y: 18,
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'power2.out',
        scrollTrigger: { trigger: rootRef.current, start: 'top 80%', once: true },
      });
    },
    { scope: rootRef },
  );

  return (
    <section id="observatory" ref={rootRef} className="obs-page">
      <div className="obs-wrap">
        {/* 舞台：标题 + 立绘 */}
        <div className="obs-stage obs-rv">
          <span className="obs-band" aria-hidden="true" />
          <span className="obs-band is-soft" aria-hidden="true" />

          <div className="obs-stage-copy">
            <p className="obs-eyebrow">Source Observatory · No.{no}</p>
            <h2 className="obs-title">
              B站数据<b>观测舱</b>
            </h2>
            <p className="obs-lede">
              {intro ? (
                <>
                  第 <b>{intro.day}</b> 天。
                  {intro.peakDelta >= 100 && intro.peakDate && !intro.peakIsLatest ? (
                    <>
                      {mdCN(intro.peakDate)}那一波之后曲线没再落回去 —— 现在是{' '}
                      <b>{formatNum(intro.followers)}</b>
                      {deltaPhrase(intro.lastDelta, intro.gapDays, intro.isToday)}
                    </>
                  ) : (
                    <>
                      从 {fmt(stats.snapshots[0]?.followers ?? 0)} 走到 {formatNum(intro.followers)}，一共多了{' '}
                      <b>{fmtSigned(intro.gain)}</b> 个。
                    </>
                  )}
                </>
              ) : (
                <>正在读取每日快照……</>
              )}
            </p>

            <div className="obs-pills">
              <span className={`obs-pill${stats.live ? ' is-lime' : ''}`}>
                <i className="dot" />
                {stats.live ? 'LIVE · 每小时同步' : `快照 · ${mdShort(stats.updated.slice(0, 10))}`}
              </span>
              <div className="obs-seg" role="group" aria-label="时间区间">
                {([30, 90] as const).map((r) => (
                  <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
                    {r === 30 ? '30 日' : '全部'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <img className="obs-figure" src={asset('/images/heroine-wave.png')} alt="水聖安 Q 版立绘" />
        </div>

        {/* KPI */}
        <section className="obs-kpis obs-rv" aria-label="核心数据">
          <KpiCard
            label="粉丝"
            sub="FANS"
            unit="人"
            value={stats.latest.followers}
            daily={stats.daily.followers}
            week={stats.rate7}
          />
          <KpiCard
            label="播放"
            sub="VIEWS"
            value={stats.latest.views}
            daily={stats.daily.views}
            note={viewsCaptured ? `${mdShort(viewsCaptured)} 采集` : '待采集'}
          />
          <KpiCard
            label="获赞"
            sub="LIKES"
            value={stats.latest.likes}
            daily={stats.daily.likes}
            note={likesCaptured ? `${mdShort(likesCaptured)} 采集` : '待采集'}
          />
          <KpiCard label="稿件" sub="WORKS" unit="条" value={stats.latest.videos} daily={stats.daily.videos} note="近期未更新" />
        </section>

        {/* 曲线 + 热力 */}
        <div className="obs-main obs-rv">
          <GrowthChart stats={stats} range={range} />
          <HeatCard stats={stats} />
        </div>

        {/* TOP 5 */}
        <div className="obs-rv">
          <TopClips />
        </div>
      </div>
    </section>
  );
}
