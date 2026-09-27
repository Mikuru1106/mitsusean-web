import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { Link } from 'react-router-dom';
import Button from './Button';
import AnimatedTitle from './AnimatedTitle';
import { songs } from '../data/content';
import { formatNum } from '../hooks/useBiliStats';
import { useBiliVideoPool } from '../hooks/useBiliVideos';
import '../video-lottery.css';

interface LotteryItem {
  bvid: string;
  title: string;
  plays: number;
  thumbnail: string;
}

const SPIN_MS = 4200;
const REEL_STEP = 218;
const MAX_CARDS = 48;

function Cover({ item }: { item: LotteryItem }) {
  return (
    <div className="video-lottery-cover">
      {item.thumbnail ? <img src={item.thumbnail} alt="" referrerPolicy="no-referrer" /> : <div className="video-lottery-cover-fallback">💧</div>}
      <div className="video-lottery-cover-shade" aria-hidden="true" />
      <p>{item.title}</p>
    </div>
  );
}

function Player({ item, close }: { item: LotteryItem; close: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className="video-lottery-modal" role="dialog" aria-modal="true" aria-label={item.title} onClick={close}>
      <div className="video-lottery-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="video-lottery-modal-player">
          <iframe src={`https://player.bilibili.com/player.html?bvid=${item.bvid}&autoplay=1`} title={item.title} allow="autoplay; fullscreen" allowFullScreen scrolling="no" frameBorder="0" />
        </div>
        <div className="video-lottery-modal-info">
          <div><p>DRAW RESULT · ▶ {formatNum(item.plays)} PLAYS</p><h3>{item.title}</h3></div>
          <div className="video-lottery-modal-actions"><a href={`https://www.bilibili.com/video/${item.bvid}`} target="_blank" rel="noreferrer">去 B 站观看</a><button type="button" onClick={close}>关闭</button></div>
        </div>
      </div>
    </div>
  );
}

export default function Lottery() {
  const videoPool = useBiliVideoPool();
  const pool = useMemo<LotteryItem[]>(() => videoPool.videos.length
    ? videoPool.videos.map((video) => ({ bvid: video.bvid, title: video.title, plays: video.plays, thumbnail: video.thumbnail }))
    : songs.filter((song) => song.bvid).map((song) => ({ bvid: song.bvid, title: song.title, plays: song.plays, thumbnail: song.thumbnail })), [videoPool.videos]);

  const [spinning, setSpinning] = useState(false);
  const [selected, setSelected] = useState<LotteryItem | null>(null);
  const [active, setActive] = useState<LotteryItem | null>(null);
  const [items, setItems] = useState<LotteryItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [drawId, setDrawId] = useState(0);
  const scope = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);
  const runId = useRef(0);
  const timer = useRef<number | null>(null);
  const initialized = useRef(false);
  const poolRef = useRef(pool);
  poolRef.current = pool;

  useEffect(() => {
    if (!initialized.current && pool.length) {
      initialized.current = true;
      setItems(pool.slice(0, 3));
    }
  }, [pool]);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  useEffect(() => { if (scope.current) gsap.fromTo(scope.current.querySelector('.video-lottery-card'), { autoAlpha: 0, y: 32 }, { autoAlpha: 1, y: 0, duration: .8, ease: 'power2.out' }); }, []);

  const measureCard = () => {
    const card = scope.current?.querySelector<HTMLElement>('.video-lottery-cover');
    const track = scope.current?.querySelector<HTMLElement>('.video-lottery-track');
    const gap = track ? Number.parseFloat(getComputedStyle(track).gap) || 10 : 10;
    return (card?.getBoundingClientRect().height || REEL_STEP - 10) + gap;
  };
  const draw = () => {
    if (spinning || !poolRef.current.length) return;
    const all = poolRef.current;
    const rest = all.filter((video) => video.bvid !== last.current);
    const chosen = rest[Math.floor(Math.random() * rest.length)] ?? all[0];
    const shuffled = [...all].sort(() => Math.random() - .5);
    const target = Math.max(12, Math.min(MAX_CARDS - 1, shuffled.length * 3 + Math.floor(Math.random() * shuffled.length)));
    const reel = Array.from({ length: target + 1 }, (_, index) => shuffled[index % shuffled.length]);
    reel[target] = chosen;
    last.current = chosen.bvid;
    setItems(reel);
    setOffset(0);
    setSelected(null);
    setSpinning(true);
    setDrawId((value) => value + 1);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const step = measureCard();
      setOffset(-(target * step) + 18);
    }));
    const currentRun = ++runId.current;
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (currentRun !== runId.current) return;
      setSelected(chosen); setSpinning(false); setActive(chosen);
    }, SPIN_MS);
  };

  return (
    <section id="lottery" className="video-lottery" ref={scope}>
      <div className="video-lottery-intro"><p>VIDEO BLIND BOX · Mitsusean</p><AnimatedTitle title="PICK A <b>MEMORY</b>" containerClass="video-lottery-title" /><span>每一张封面，都是一份随机掉落的心动。</span></div>
      <div className="video-lottery-card">
        <div className="video-lottery-screen-wrap"><div className="video-lottery-screen-label"><span>LIVE REEL</span><span>{spinning ? 'SCANNING' : 'READY'}</span></div><div className="video-lottery-screen"><div key={drawId} className="video-lottery-track" style={{ transform: `translateY(${offset}px)`, transition: spinning ? `transform ${SPIN_MS / 1000}s cubic-bezier(.12,.82,.18,1)` : 'none' }}>{(items.length ? items : pool.slice(0, 1)).map((item, index) => <Cover key={`${item.bvid}-${index}`} item={item} />)}</div><div className="video-lottery-scanline" aria-hidden="true" /></div></div>
        <aside className="video-lottery-console"><div className="video-lottery-console-top"><span>RANDOM ACCESS</span><strong>{String(pool.length).padStart(3, '0')} VIDEOS</strong></div><div className="video-lottery-status"><i className={spinning ? 'is-live' : ''} />{spinning ? '正在扫描视频胶片…' : selected ? '抽取完成，可以播放' : '准备好抽取一段记忆'}</div><div className="video-lottery-lever"><button type="button" onClick={draw} disabled={spinning} aria-label="拉下摇杆，随机抽一个视频"><span className="video-lottery-lever-ball" /><span className="video-lottery-lever-stick" /></button><p>PULL</p></div><button type="button" className="video-lottery-draw" onClick={draw} disabled={spinning}>{spinning ? 'SCANNING' : 'DRAW VIDEO'}<span>↗</span></button>{selected ? <div className="video-lottery-result"><p>SELECTED VIDEO</p><h3>{selected.title}</h3><span>▶ {formatNum(selected.plays)} plays</span><button type="button" onClick={() => setActive(selected)}>播放这条视频 →</button></div> : <div className="video-lottery-hint" />}</aside>
      </div>
      <p className="video-lottery-source">POOL / {videoPool.source === 'snapshot' ? `ALL UPLOADS · UPDATED ${videoPool.updatedAt?.slice(0, 10) ?? 'RECENT'}` : 'FEATURED FALLBACK'}</p>
      <div className="video-lottery-letter"><div><p>№ 01 · A letter</p><span>Dear visitor,</span><h2>thank you<br />for stopping by.</h2><small>如果有任何建议或想说的话，欢迎通过社交平台联系。</small></div><div className="video-lottery-letter-sign"><Link to="/about"><Button title="关于" containerClass="!bg-[#fff4df] !text-[#6f4d45]" /></Link><a href="https://space.bilibili.com/17385659" target="_blank" rel="noreferrer"><Button title="前往 B 站 →" containerClass="!bg-[#fff4df] !text-[#6f4d45]" /></a></div></div>
      {active && <Player item={active} close={() => setActive(null)} />}
    </section>
  );
}
