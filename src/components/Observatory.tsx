import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
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

/** 单日涨粉序列（热力与叙述共用） */
function dailyDeltas(snaps: BiliSnapshot[]) {
  const out: { date: string; delta: number }[] = [];
  for (let i = 1; i < snaps.length; i++) {
    out.push({ date: snaps[i].date, delta: snaps[i].followers - snaps[i - 1].followers });
  }
  return out;
}

/** 峰值日：单日涨粉最大的一天 */
function peakOf(deltas: { date: string; delta: number }[]) {
  return deltas.reduce(
    (best, cur) => (cur.delta > best.delta ? cur : best),
    { date: '', delta: 0 },
  );
}

/** 「今天多了 +N 个」/「最近 N 天多了 +N 个」——按快照间隔取说法，不把区间累计说成日均 */
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
   KPI 报表格
   ================================================== */
function KpiCell({
  sub,
  label,
  value,
  daily,
  week,
  flatNote,
}: {
  sub: string;
  label: string;
  value: number;
  daily: number | null;
  week?: number | null;
  flatNote?: string;
}) {
  const shown = useCountUp(value);
  const isFlat = daily == null || (flatNote != null && daily === 0);

  return (
    <div className="obs-kpi">
      <p className="k-label">
        <span>{label}</span>
        <span className="en">{sub}</span>
      </p>
      <p className="k-num">{fmt(shown)}</p>
      {isFlat ? (
        <p className="k-delta is-flat">{flatNote ?? '待采集'}</p>
      ) : (
        <p className="k-delta">
          {fmtSigned(daily)}
          <span>
            {' '}/ 日
            {week != null ? ` · 7日 ${fmtSigned(week)}` : ''}
          </span>
        </p>
      )}
    </div>
  );
}

/* ==================================================
   折线：粉丝增长
   ================================================== */
const CHART_W = 760;
const CHART_H = 250;
const PAD = { l: 44, r: 8, t: 26, b: 34 };

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

function GrowthChart({ stats }: { stats: BiliStats }) {
  const [range, setRange] = useState<30 | 90>(90);
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

  // 区间摘要：起点 / 最新 / 区间增幅 / 最大单日
  const summary = useMemo(() => {
    if (pts.length < 2) return null;
    const first = pts[0];
    const last = pts[pts.length - 1];
    let maxDaily = 0;
    let peakIdx = 1;
    for (let i = 1; i < pts.length; i++) {
      const dv = pts[i].followers - pts[i - 1].followers;
      if (dv > maxDaily) {
        maxDaily = dv;
        peakIdx = i;
      }
    }
    const avg = (last.followers - first.followers) / (pts.length - 1);
    return {
      first,
      last,
      gain: last.followers - first.followers,
      maxDaily,
      peakIdx,
      // 单日峰值明显高于平均才值得批注
      burst: maxDaily > Math.max(avg * 1.8, 60),
    };
  }, [pts]);

  // 折线描边动画
  useEffect(() => {
    const path = lineRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    const tl = gsap.timeline();
    tl.fromTo(
      path,
      { strokeDasharray: len, strokeDashoffset: len },
      { strokeDashoffset: 0, duration: 1.5, ease: 'power2.out' },
    );
    if (areaRef.current) {
      tl.fromTo(areaRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9 }, 0.35);
    }
    return () => {
      tl.kill();
    };
  }, [line]);

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

  // 坐标轴刻度值
  const ticks = useMemo(() => {
    if (!data.length) return [];
    const values = data.map((d) => d.followers);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const ih = CHART_H - PAD.t - PAD.b;
    return [0, 1, 2, 3].map((k) => {
      const v = Math.round(max - (k / 3) * span);
      return {
        y: PAD.t + (k / 3) * ih,
        text: v >= 10000 ? `${(v / 10000).toFixed(1)}万` : String(v),
      };
    });
  }, [data]);

  // 表格：区间末 8 天
  const rows = useMemo(() => {
    if (pts.length < 2) return [];
    return pts
      .slice(-8)
      .map((p, i, arr) => {
        const idx = pts.length - arr.length + i;
        return { date: p.date, followers: p.followers, delta: idx > 0 ? p.followers - pts[idx - 1].followers : null };
      })
      .reverse();
  }, [pts]);

  return (
    <section>
      <div className="obs-kicker">
        <span className="idx">01</span>
        <h3>粉丝增长</h3>
        <span className="ln" />
        <div className="obs-range" role="group" aria-label="时间区间">
          {([30, 90] as const).map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
              {r === 30 ? '30 日' : '全部'}
            </button>
          ))}
        </div>
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
              <stop offset="0%" stopColor="#ff8fab" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#ff8fab" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((t, k) => (
            <g key={t.y}>
              <line
                x1={PAD.l}
                y1={t.y}
                x2={CHART_W - PAD.r}
                y2={t.y}
                stroke="rgba(43,29,36,.09)"
                strokeDasharray={k === 3 ? '0' : '2 5'}
              />
              <text
                x={PAD.l - 8}
                y={t.y + 3.5}
                textAnchor="end"
                fill="#a08a80"
                fontSize="9.5"
                fontFamily="ui-monospace,Consolas,monospace"
                letterSpacing=".04em"
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
              stroke="#b76e79"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 爆发日批注 */}
          {summary?.burst && pts[summary.peakIdx] && (
            <g>
              <line
                x1={pts[summary.peakIdx].x}
                y1={pts[summary.peakIdx].y + 8}
                x2={pts[summary.peakIdx].x}
                y2={CHART_H - PAD.b}
                stroke="rgba(43,29,36,.34)"
                strokeDasharray="3 4"
              />
              <circle
                cx={pts[summary.peakIdx].x}
                cy={pts[summary.peakIdx].y}
                r="3"
                fill="#fdf6ef"
                stroke="#b76e79"
                strokeWidth="1.5"
              />
              <text
                x={Math.min(pts[summary.peakIdx].x + 8, CHART_W - 70)}
                y={pts[summary.peakIdx].y - 10}
                fill="#b76e79"
                fontSize="9.5"
                fontFamily="ui-monospace,Consolas,monospace"
                letterSpacing=".1em"
              >
                {mdShort(pts[summary.peakIdx].date)} 爆发日
              </text>
            </g>
          )}

          {/* 末端点 */}
          {pts.length > 1 && (
            <g>
              <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="8" fill="rgba(255,143,171,.22)" />
              <circle
                cx={pts[pts.length - 1].x}
                cy={pts[pts.length - 1].y}
                r="3.4"
                fill="#b76e79"
                stroke="#fdf6ef"
                strokeWidth="1.6"
              />
            </g>
          )}

          {/* 悬停十字线 */}
          {hp && (
            <g pointerEvents="none">
              <line
                x1={hp.x}
                y1={PAD.t - 12}
                x2={hp.x}
                y2={CHART_H - PAD.b}
                stroke="rgba(43,29,36,.3)"
                strokeDasharray="2 3"
              />
              <circle cx={hp.x} cy={hp.y} r="4" fill="#ff8fab" stroke="#fdf6ef" strokeWidth="2" />
            </g>
          )}

          {/* x 轴日期 */}
          {pts.length > 1 && (
            <>
              <text
                x={pts[0].x}
                y={CHART_H - 12}
                fill="#a08a80"
                fontSize="9.5"
                fontFamily="ui-monospace,Consolas,monospace"
                letterSpacing=".08em"
              >
                {mdShort(pts[0].date)}
              </text>
              <text
                x={pts[pts.length - 1].x}
                y={CHART_H - 12}
                textAnchor="end"
                fill="#a08a80"
                fontSize="9.5"
                fontFamily="ui-monospace,Consolas,monospace"
                letterSpacing=".08em"
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
              left: `${Math.min(92, Math.max(8, (hp.x / CHART_W) * 100))}%`,
              top: `${(hp.y / CHART_H) * 100}%`,
              marginTop: '-12px',
            }}
          >
            <span className="d">{mdShort(hp.date)}</span>
            <b>{fmt(hp.followers)}</b>
            {hpPrev ? <i>{fmtSigned(hp.followers - hpPrev.followers)}</i> : null}
          </div>
        )}
      </div>

      {summary && (
        <div className="obs-chart-foot">
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
            最大单日 <b>{fmtSigned(summary.maxDaily)}</b>
          </span>
        </div>
      )}

      {rows.length > 0 && (
        <details className="obs-details">
          <summary>以表格查看</summary>
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>粉丝</th>
                <th>日增</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date}>
                  <td>{mdShort(r.date)}</td>
                  <td>{fmt(r.followers)}</td>
                  <td className="is-up">{r.delta == null ? '—' : fmtSigned(r.delta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

/* ==================================================
   热力：每日净涨粉
   ================================================== */
const HEAT_COLORS = [
  'rgba(183,110,121,.08)',
  'rgba(183,110,121,.22)',
  'rgba(183,110,121,.40)',
  'rgba(183,110,121,.62)',
  'rgba(183,110,121,.86)',
];
const HEAT_CELLS = 13 * 7;

function Heatmap({ stats }: { stats: BiliStats }) {
  const { cells, recorded, rows } = useMemo(() => {
    const deltas = dailyDeltas(stats.snapshots).slice(-HEAT_CELLS);
    // 分档按当天涨粉在样本里的分位取，避免极值把整片格子压成同一个颜色
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

  return (
    <aside className="obs-col-r">
      <div className="obs-kicker">
        <span className="idx">02</span>
        <h3>涨粉热力</h3>
        <span className="ln" />
      </div>

      <div
        className="obs-heat"
        role="img"
        aria-label="每日净涨粉热力图"
        style={{ gridTemplateRows: `repeat(${rows}, 1fr)`, aspectRatio: `13 / ${rows}` }}
      >
        {cells.map((c, i) => (
          <i
            key={c?.date ?? `empty-${i}`}
            style={{ background: c ? HEAT_COLORS[c.level] : 'rgba(43,29,36,.045)' }}
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
        <span className="count">已记录 {recorded} 天</span>
      </div>
    </aside>
  );
}

/* ==================================================
   观测便签
   ================================================== */
function Note({ stats }: { stats: BiliStats }) {
  const text = useMemo(() => {
    const snaps = stats.snapshots;
    if (snaps.length < 2) return null;
    const first = snaps[0];
    const last = snaps[snaps.length - 1];
    const deltas = dailyDeltas(snaps);
    const peak = peakOf(deltas);
    const peakIdx = deltas.findIndex((d) => d.date === peak.date);
    const gain = last.followers - first.followers;

    // 峰值前 10 天 vs 峰值后到今天的日均
    const peakAt = peakIdx >= 0 ? snaps[peakIdx + 1] : last;
    const beforeN = Math.min(peakIdx + 1, 10);
    const beforeAvg =
      beforeN > 0
        ? (peakAt.followers - snaps[peakIdx + 1 - beforeN].followers) / beforeN
        : 0;
    const afterN = deltas.length - 1 - peakIdx;
    const afterAvg = afterN > 0 ? (last.followers - peakAt.followers) / afterN : 0;
    const ratio = beforeAvg > 0 ? afterAvg / beforeAvg : 0;

    return {
      first: first.date,
      gain,
      peakDate: peak.date,
      peakDelta: peak.delta,
      ratio,
      afterAvg: Math.round(afterAvg),
    };
  }, [stats]);

  if (!text) return null;

  return (
    <div className="obs-note">
      {mdCN(text.first)}到现在，
      <br />
      一共多了 <b>{fmtSigned(text.gain)}</b> 个粉丝。
      <br />
      {text.ratio >= 1.15 ? (
        <>{mdCN(text.peakDate)}那条之后，日均涨粉是之前的 <b>{text.ratio.toFixed(1)}</b> 倍。</>
      ) : text.ratio >= 0.95 ? (
        <>
          涨速稳住了，日均 <b>{fmtSigned(text.afterAvg)}</b>，慢慢涨潮。
        </>
      ) : (
        <>
          热度回落了一些，日均仍有 <b>{fmtSigned(text.afterAvg)}</b>。
        </>
      )}
      <span className="sign">—— 观测记录 · 小安</span>
    </div>
  );
}

/* ==================================================
   TOP 视频
   ================================================== */
interface TopItem {
  id: string;
  title: string;
  plays: number;
  likes: number;
  coins: number;
}

function TopClips() {
  const liveVideos = useBiliVideos();

  // 有真实视频时用真实数据；接口失败时回退静态曲库，保证板块不空白
  const top = useMemo<TopItem[]>(() => {
    const src: TopItem[] = liveVideos.length
      ? liveVideos.map((v) => ({ id: v.bvid, title: v.title, plays: v.plays, likes: v.likes, coins: v.coins }))
      : songs.map((s) => ({ id: s.id, title: s.title, plays: s.plays, likes: s.likes, coins: s.coins }));
    return [...src].sort((a, b) => b.plays - a.plays).slice(0, 5);
  }, [liveVideos]);

  const max = Math.max(1, ...top.map((t) => t.plays));
  // 采集器没有点赞/投币时，不摆一排「0 赞 · 0 投币」，改用整行比例条
  const hasReactions = top.some((t) => t.likes > 0 || t.coins > 0);
  if (!top.length) return null;

  return (
    <section className="mt-[clamp(2rem,4.4vw,3.25rem)]">
      <div className="obs-kicker">
        <span className="idx">03</span>
        <h3>播放最高的视频</h3>
        <span className="ln" />
        <span style={{ fontFamily: 'ui-monospace,Consolas,monospace', fontSize: '0.594rem', letterSpacing: '.14em', color: 'var(--muted)' }}>
          TOP 5 / 播放
        </span>
      </div>

      <ol className="obs-tops">
        {top.map((t, i) => (
          <li key={t.id} className="obs-top">
            <span className="i">{String(i + 1).padStart(2, '0')}</span>
            <p className="t" title={t.title}>
              {t.title}
            </p>
            <span className="bar">
              <i style={{ '--w': (t.plays / max).toFixed(3) } as React.CSSProperties} />
            </span>
            <span className="v">{fmt(t.plays)} 播放</span>
            {hasReactions && (
              <span className="m">
                {fmt(t.likes)} 赞 · {fmt(t.coins)} 投币
              </span>
            )}
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

  // 标题下方的叙述：用真实数据拼一句人话
  const intro = useMemo(() => {
    const snaps = stats.snapshots;
    if (snaps.length < 2) return null;
    const first = snaps[0];
    const last = snaps[snaps.length - 1];
    const day = spanDays(first.date, last.date);
    const recent = dailyDeltas(snaps.slice(-31));
    const peak = peakOf(recent);
    const prev = snaps[snaps.length - 2];

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // 实时接口覆盖过「今天」时，最新一点其实就是此刻；否则用快照日期
    const currentDate = stats.live ? todayIso : last.date;

    // 最新一点相对上一条：涨了多少、隔了几天
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
      firstDate: first.date,
    };
  }, [stats]);

  const metaRight = stats.live ? 'LIVE · 每小时同步' : `快照 · ${mdShort(stats.updated.slice(0, 10))}`;
  const snapshotCount = stats.snapshots.length;
  const firstDate = stats.snapshots[0]?.date ?? '';

  useGSAP(
    () => {
      const items = rootRef.current?.querySelectorAll<HTMLElement>('.obs-rv');
      if (!items?.length) return;
      gsap.from(Array.from(items), {
        y: 16,
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'power2.out',
        scrollTrigger: { trigger: rootRef.current, start: 'top 78%', once: true },
      });
    },
    { scope: rootRef },
  );

  return (
    <section id="observatory" ref={rootRef} className="obs-page">
      <div className="obs-wrap">
        {/* 页眉档案信息 */}
        <div className="obs-meta obs-rv">
          <div className="obs-meta-left">
            <span>Source Observatory</span>
            <span className="is-no">No.{String(snapshotCount).padStart(3, '0')}</span>
            <span className="is-since">
              · Snapshots since {firstDate.replace(/-/g, '.')}
            </span>
          </div>
          <span className="obs-live">
            <i />
            {metaRight}
          </span>
        </div>
        <div className="obs-rule" />

        {/* 标题区 */}
        <header className="obs-head obs-rv">
          <h2>
            B站数据
            <em>
              观测舱
              <svg viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 8.2C22 3.6 40 3.1 58 5.4c17 2.2 33 3.6 60 .6" pathLength="1" />
              </svg>
            </em>
          </h2>
          <p>
            {intro ? (
              <>
                第 <b>{intro.day}</b> 天。
                {intro.peakDelta >= 100 && intro.peakDate && !intro.peakIsLatest ? (
                  <>
                    {mdCN(intro.peakDate)}那一波之后，曲线还没落回去 —— 现在是{' '}
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
        </header>

        {/* KPI 报表条 */}
        <section className="obs-kpis obs-rv" aria-label="核心数据">
          <KpiCell
            sub="FANS"
            label="粉丝"
            value={stats.latest.followers}
            daily={stats.daily.followers}
            week={stats.rate7}
          />
          <KpiCell sub="VIEWS" label="播放" value={stats.latest.views} daily={stats.daily.views} />
          <KpiCell sub="LIKES" label="获赞" value={stats.latest.likes} daily={stats.daily.likes} />
          <KpiCell
            sub="WORKS"
            label="稿件"
            value={stats.latest.videos}
            daily={stats.daily.videos}
            flatNote="近期未更新"
          />
        </section>

        {/* 主体两栏 */}
        <div className="obs-main obs-rv">
          <GrowthChart stats={stats} />
          <div>
            <Heatmap stats={stats} />
            <Note stats={stats} />
          </div>
        </div>

        <div className="obs-rv">
          <TopClips />
        </div>

        {/* 脚注 */}
        <div className="obs-foot">
          <span>数据来自 B站公开接口的每日快照 · 仅供参考</span>
          <span>
            Last sync {stats.updated.slice(0, 10).replace(/-/g, '.')} {stats.updated.slice(11, 16)}
          </span>
        </div>
      </div>
    </section>
  );
}
