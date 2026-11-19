import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from 'react-router-dom';
import Button from './Button';
import { songs } from '../data/content';
import { formatNum } from '../hooks/useBiliStats';
import { useBiliVideoPool } from '../hooks/useBiliVideos';
import '../video-lottery.css';

gsap.registerPlugin(ScrollTrigger);

interface LotteryItem {
  bvid: string;
  title: string;
  plays: number;
  thumbnail: string;
}

/** 翻牌后停留多久再出结果 */
const REVEAL_MS = 900;

function Player({ item, close }: { item: LotteryItem; close: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className="lot-modal" role="dialog" aria-modal="true" aria-label={item.title} onClick={close}>
      <div className="lot-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="lot-modal-player">
          <iframe
            src={`https://player.bilibili.com/player.html?bvid=${item.bvid}&autoplay=1`}
            title={item.title}
            allow="autoplay; fullscreen"
            allowFullScreen
            scrolling="no"
          />
        </div>
        <div className="lot-modal-info">
          <div>
            <p className="k">Draw result · ▶ {formatNum(item.plays)} plays</p>
            <h3>{item.title}</h3>
          </div>
          <div className="lot-modal-actions">
            <a href={`https://www.bilibili.com/video/${item.bvid}`} target="_blank" rel="noreferrer">
              去 B 站观看
            </a>
            <button type="button" onClick={close}>
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Lottery() {
  const videoPool = useBiliVideoPool();
  const pool = useMemo<LotteryItem[]>(
    () =>
      videoPool.videos.length
        ? videoPool.videos.map((video) => ({
            bvid: video.bvid,
            title: video.title,
            plays: video.plays,
            thumbnail: video.thumbnail,
          }))
        : songs
            .filter((song) => song.bvid)
            .map((song) => ({
              bvid: song.bvid,
              title: song.title,
              plays: song.plays,
              thumbnail: song.thumbnail,
            })),
    [videoPool.videos],
  );

  const [busy, setBusy] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [spent, setSpent] = useState(false);
  /** 当前这张牌的牌面（还没翻之前先换好） */
  const [face, setFace] = useState<LotteryItem | null>(null);
  const [selected, setSelected] = useState<LotteryItem | null>(null);
  const [active, setActive] = useState<LotteryItem | null>(null);

  const scope = useRef<HTMLElement>(null);
  const last = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => {
      list.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    if (!scope.current) return;
    const ctx = gsap.context(() => {
      gsap.from(['.lot-table', '.lot-cta'], {
        y: 24,
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: scope.current, start: 'top 82%', once: true },
      });
    }, scope);
    return () => ctx.revert();
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const draw = () => {
    if (busy || !pool.length) return;
    setBusy(true);
    setSelected(null);
    setFlipped(false); // 先翻回牌背
    setSpent(true); // 牌堆让开

    const rest = pool.filter((item) => item.bvid !== last.current);
    const chosen = rest[Math.floor(Math.random() * rest.length)] ?? pool[0];
    last.current = chosen.bvid;

    later(() => {
      setFace(chosen);
      setSpent(false);
    }, 450);

    later(() => setFlipped(true), 720);

    later(() => {
      setSelected(chosen);
      setBusy(false);
    }, 720 + REVEAL_MS);
  };

  return (
    <section id="lottery" className="video-lottery" ref={scope}>
      <div className="lot-wrap">
        <header>
          <p className="lot-eyebrow">Video Blind Box · Mitsusean</p>
          <h2 className="lot-title">
            PICK A <b>MEMORY</b>
          </h2>
          <p className="lot-lede">
            每一张封面，都是一份随机掉落的心动。翻一张，看看今天抽到谁。
          </p>
        </header>

        <div className="lot-table">
          <div className={`lot-stack${spent ? ' is-spent' : ''}`} aria-hidden="true">
            <i style={{ '--x': '-4rem', '--y': '1.875rem', '--r': '-11deg', '--s': 0.9 } as React.CSSProperties} />
            <i style={{ '--x': '-2rem', '--y': '1rem', '--r': '-5.5deg', '--s': 0.95 } as React.CSSProperties} />
            <i style={{ '--x': '2rem', '--y': '1rem', '--r': '5.5deg', '--s': 0.95 } as React.CSSProperties} />
            <i style={{ '--x': '4rem', '--y': '1.875rem', '--r': '11deg', '--s': 0.9 } as React.CSSProperties} />
          </div>

          <div className="lot-deck">
            <div className={`lot-card${flipped ? ' is-flipped' : ''}`}>
              <div className="face back">
                <div className="mark">水</div>
                <small>MITSUsean · MEMORY</small>
              </div>
              <div className="face front">
                {face?.thumbnail ? <img src={face.thumbnail} alt="" referrerPolicy="no-referrer" /> : null}
                <div className="cap">{face?.title ?? ''}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="lot-cta">
          <button type="button" className="lot-draw" onClick={draw} disabled={busy || !pool.length}>
            {busy ? '翻牌中…' : selected ? '再抽一张' : '抽一张'}
            <span>✦</span>
          </button>
        </div>

        <article className={`lot-result${selected ? ' is-on' : ''}`} aria-live="polite">
          {selected ? (
            <>
              <img src={selected.thumbnail} alt="" referrerPolicy="no-referrer" />
              <div>
                <p className="k">Draw result</p>
                <h3>{selected.title}</h3>
                <p className="plays">
                  ▶ <b>{formatNum(selected.plays)}</b> 播放
                </p>
              </div>
              <div className="lot-actions">
                <a className="primary" href={`https://www.bilibili.com/video/${selected.bvid}`} target="_blank" rel="noreferrer">
                  去 B 站
                </a>
                <button className="ghost" type="button" onClick={() => setActive(selected)}>
                  在这里看
                </button>
              </div>
            </>
          ) : null}
        </article>

        <p className="lot-foot">
          <span>
            Pool /{' '}
            {videoPool.source === 'snapshot'
              ? `all uploads · updated ${videoPool.updatedAt?.slice(0, 10) ?? 'recent'}`
              : 'featured fallback'}
          </span>
          <span>Sequence 02 — One card, one memory</span>
        </p>

        <div className="lot-letter">
          <div>
            <p className="k">№ 01 · A letter</p>
            <span>Dear visitor,</span>
            <h2>
              thank you
              <br />
              for stopping by.
            </h2>
            <small>如果有任何建议或想说的话，欢迎通过社交平台联系。</small>
          </div>
          <div className="lot-letter-sign">
            <Link to="/about">
              <Button title="关于" containerClass="!bg-[#f1eefb] !text-[#3b3548]" />
            </Link>
            <a href="https://space.bilibili.com/17385659" target="_blank" rel="noreferrer">
              <Button title="前往 B 站 →" containerClass="!bg-[#f1eefb] !text-[#3b3548]" />
            </a>
          </div>
        </div>
      </div>

      {active ? <Player item={active} close={() => setActive(null)} /> : null}
    </section>
  );
}
