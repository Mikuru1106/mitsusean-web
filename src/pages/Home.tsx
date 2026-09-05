import { useEffect, useRef, useState } from 'react';
import { FaPlay, FaPause } from 'react-icons/fa';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import AnimatedTitle from '../components/AnimatedTitle';
import SocialLinks from '../components/SocialLinks';
import SongsGallery from '../components/SongsGallery';
import Observatory from '../components/Observatory';
import Milestones from '../components/Milestones';
import { profile, tracks } from '../data/content';
import { formatNum, useBiliStats } from '../hooks/useBiliStats';
import { useLrc, activeLrcIndex } from '../hooks/useLrc';

gsap.registerPlugin(ScrollTrigger);

/* ==================================================
   音乐播放核心 hook — Hero(唱片/可视化) 与 音乐卡片 共用
   ================================================== */
const AUDIO_VOLUME = 0.1; // 音量调低

function useMusicPlayer() {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedBvid = useRef<string | null>(null);
  const idxRef = useRef(0);
  idxRef.current = idx;
  const track = tracks[idx];
  const lrcLines = useLrc(track);
  // 音频可视化
  const analyserRef = useRef<AnalyserNode | null>(null);
  const srcNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  /** 播放指定曲目,返回是否真正开始播放 */
  const playTrack = async (bvid: string): Promise<boolean> => {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.addEventListener('ended', () => {
        // 播完自动切下一首
        const next = (idxRef.current + 1) % tracks.length;
        setIdx(next);
        void playTrackRef.current(tracks[next].bvid);
      });
      audioRef.current = audio;
    }
    // 每次播放前都强制应用音量,避免复用旧元素时音量未生效
    audio.volume = AUDIO_VOLUME;
    if (loadedBvid.current !== bvid) {
      // 先同步设置音频地址并启动加载,避免等待网络 HEAD 后错过自动播放时机
      audio.src = `/api/bili-audio?bvid=${bvid}`;
      loadedBvid.current = bvid;
    }
    // 首次播放时接入 Web Audio 分析器(驱动头像可视化)
    if (!srcNodeRef.current && audioRef.current) {
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = ctxRef.current ?? new Ctx();
        const src = ctx.createMediaElementSource(audioRef.current);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.75;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        ctxRef.current = ctx;
        analyserRef.current = analyser;
        srcNodeRef.current = src;
      } catch {
        /* 可视化接入失败不影响播放 */
      }
    }
    if (ctxRef.current?.state === 'suspended') void ctxRef.current.resume();
    try {
      await audio.play();
      setPlaying(true);
      return true;
    } catch {
      // 自动播放策略拦截等场景:停在暂停态,等待用户交互
      setPlaying(false);
      return false;
    }
  };

  // 供一次性事件监听(ended)调用最新闭包
  const playTrackRef = useRef<(bvid: string) => Promise<boolean>>(async () => false);
  playTrackRef.current = playTrack;

  // playTrack 需要读到最新歌词行,经 ref 中转
  const lrcLinesRef = useRef(lrcLines);
  lrcLinesRef.current = lrcLines;

  // 切歌时重置歌词进度
  useEffect(() => {
    setActiveIdx(-1);
  }, [idx]);

  // 播放中轮询进度,驱动歌词逐句同步
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const a = audioRef.current;
      // 切换延后 1 秒:每句多停留 1s 再进入下一句
      if (a) setActiveIdx(activeLrcIndex(lrcLinesRef.current ?? [], a.currentTime - 1));
    }, 300);
    return () => clearInterval(timer);
  }, [playing]);

  // 进入页面自动播放;被浏览器策略拦截时,等待用户首次交互后开始
  useEffect(() => {
    let released = false;
    const start = () => {
      if (released) return;
      released = true;
      void playTrackRef.current(tracks[0].bvid);
    };
    const timer = setTimeout(() => {
      void playTrackRef.current(tracks[0].bvid).then((ok) => {
        if (!ok) {
          window.addEventListener('pointerdown', start, { once: true });
          window.addEventListener('keydown', start, { once: true });
        }
      });
    }, 800);
    return () => {
      clearTimeout(timer);
      released = true;
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      void playTrack(track.bvid);
    }
  };

  const switchSong = () => {
    const next = (idx + 1) % tracks.length;
    setIdx(next);
    audioRef.current?.pause();
    void playTrack(tracks[next].bvid);
  };

  return { idx, playing, activeIdx, track, lrcLines, togglePlay, switchSong, analyserRef };
}

type MusicApi = ReturnType<typeof useMusicPlayer>;

/* ==================================================
   环形音频可视化(围绕头像的频谱条)
   ================================================== */
function AudioViz({ playing, analyserRef }: { playing: boolean; analyserRef: React.MutableRefObject<AnalyserNode | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.offsetWidth || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx2d.scale(dpr, dpr);

    // 参考图:80 根条形环
    const BARS = 80;
    const data = new Uint8Array(32);
    let raf = 0;
    let level = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx2d.clearRect(0, 0, size, size);
      const an = analyserRef.current;
      if (playing && an) an.getByteFrequencyData(data);
      const avg = playing && an ? data.reduce((s, v) => s + v, 0) / data.length / 255 : 0;
      level += (avg - level) * 0.12;

      const cx = size / 2;
      const cy = size / 2;
      const r0 = size / 2 - 30;
      const gapAngle = (5 / r0);
      for (let i = 0; i < BARS; i++) {
        const angle = (i / BARS) * Math.PI * 2 - Math.PI / 2;
        const v = playing && an ? data[Math.floor((i / BARS) * data.length)] / 255 : 0;
        const len = 5 + v * 34 + level * 10;
        // 每根独立矩形条:切线方向宽度比参考减 3px
        const angularWidth = Math.max(0.012, (Math.PI * 2 / BARS) - gapAngle - (3 / r0));
        const inner = r0;
        const outer = r0 + len;
        const left = angle - angularWidth / 2;
        const right = angle + angularWidth / 2;
        const points = [
          [cx + Math.cos(left) * inner, cy + Math.sin(left) * inner],
          [cx + Math.cos(right) * inner, cy + Math.sin(right) * inner],
          [cx + Math.cos(right) * outer, cy + Math.sin(right) * outer],
          [cx + Math.cos(left) * outer, cy + Math.sin(left) * outer],
        ];
        const grad = ctx2d.createLinearGradient(
          cx + Math.cos(angle) * inner,
          cy + Math.sin(angle) * inner,
          cx + Math.cos(angle) * outer,
          cy + Math.sin(angle) * outer,
        );
        // 按参考图浅色粉彩环轮换色相
        const hue = (i / BARS) * 360;
        grad.addColorStop(0, `hsla(${hue}, 42%, 82%, 0.98)`);
        grad.addColorStop(1, `hsla(${hue + 30}, 46%, 74%, 0.85)`);
        ctx2d.fillStyle = grad;
        ctx2d.shadowColor = 'rgba(205, 126, 214, 0.78)';
        ctx2d.shadowBlur = 8;
        ctx2d.beginPath();
        ctx2d.moveTo(points[0][0], points[0][1]);
        points.slice(1).forEach(([x, y]) => ctx2d.lineTo(x, y));
        ctx2d.closePath();
        ctx2d.fill();
      }
      ctx2d.shadowBlur = 0;
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [playing, analyserRef]);

  return <canvas ref={canvasRef} className="yaron-viz" aria-hidden="true" />;
}

/* ==================================================
   音乐卡片 — 纯音频 + 逐句同步歌词
   ================================================== */
function MusicCard({ music }: { music: MusicApi }) {
  const { playing, activeIdx, track, lrcLines, togglePlay, switchSong } = music;

  // 抵消根字号等比缩放:歌词卡片始终保持 1280 演示窗口时的原始大小
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const apply = () => {
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setZoom(16 / root);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  // 当前句:仅当逐句歌词可用时显示唱到的那句,否则不显示歌词
  const lineCount = lrcLines?.length ?? 0;
  const hasLine = lineCount > 0 && activeIdx >= 0;
  const currentLine = hasLine ? lrcLines![activeIdx].text : '';
  const currentKey = hasLine ? `lrc-${activeIdx}` : 'none';
  // 本句的显示时长(下一句开始时间 - 本句开始时间),供跑马灯在该时长内滚完
  const lineDur =
    hasLine && lineCount > 0
      ? Math.max(
          2.5,
          (activeIdx < lineCount - 1 ? lrcLines![activeIdx + 1].time : lrcLines![activeIdx].time + 6) -
            lrcLines![activeIdx].time,
        )
      : 6;

  // 长句跑马灯:测量溢出宽度,溢出则单向滚动(字号保持不变)
  const lyricBoxRef = useRef<HTMLSpanElement>(null);
  const lyricTrackRef = useRef<HTMLSpanElement>(null);
  const [marquee, setMarquee] = useState<{ shift: number; duration: number } | null>(null);
  useEffect(() => {
    setMarquee(null);
    const box = lyricBoxRef.current;
    const trackEl = lyricTrackRef.current;
    if (!box || !trackEl) return;
    const timer = setTimeout(() => {
      const overflow = trackEl.scrollWidth - box.clientWidth;
      if (overflow > 8) {
        // 滚完至少停 1 秒:滚动时长 = 本句时长 - 1s
        setMarquee({ shift: overflow + 8, duration: Math.max(2.5, lineDur - 1) });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [currentKey, lineDur]);

  return (
    <div className="yaron-quote-card w-full gap-3 py-1.5 pl-1.5 pr-5" style={{ zoom }}>
      {/* 播放/暂停 */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? `暂停《${track.title}》` : `播放《${track.title}》`}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#ff8fab] text-xs text-white shadow-[0_6px_16px_rgba(255,143,171,0.45)] transition-transform duration-300 hover:scale-110"
      >
        {playing ? <FaPause /> : <FaPlay className="ml-0.5" />}
      </button>

      {/* 歌词 + 歌名(点击切歌,切歌自动续播) */}
      <button
        type="button"
        onClick={switchSong}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        title="点击切换音乐"
      >
        {hasLine ? (
          <span
            key={currentKey}
            ref={lyricBoxRef}
            className={`yaron-lyric yaron-marquee-box flex-1 text-sm text-[#5f4b52] md:text-base ${marquee ? 'text-left' : 'text-center'}`}
          >
            <span
              ref={lyricTrackRef}
              className={`yaron-marquee-track ${marquee ? 'is-scrolling' : ''}`}
              style={
                marquee
                  ? ({
                      '--marquee-shift': `${marquee.shift}px`,
                      '--marquee-duration': `${marquee.duration}s`,
                    } as React.CSSProperties)
                  : undefined
              }
            >
              「{currentLine}」
            </span>
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <span className="hidden shrink-0 text-xs text-[#b76e79]/80 md:inline">
          —— 《{track.title}》 · {track.artist}
        </span>
        <span className="shrink-0 text-[10px] font-bold tracking-widest text-[#b76e79]/50">
          换一首 ♫
        </span>
      </button>
    </div>
  );
}

/* ==================================================
   HERO — 左侧内容区 + 右侧壁纸人物完整展示
   ================================================== */
function Hero() {
  const stats = useBiliStats();
  const music = useMusicPlayer();

  const scrollToAbout = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.querySelector('#about')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      id="hero"
      className="relative flex min-h-dvh w-screen flex-col overflow-hidden bg-[#dfe9f5]"
    >
      {/* 动态壁纸背景(Wallpaper Engine「K先生」实机录制循环) */}
      <div className="yaron-wallpaper" aria-hidden="true">
        <video
          src="/wallpaper.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="size-full object-cover"
        />
      </div>
      <div className="yaron-wallpaper-veil" aria-hidden="true" />

      {/* 漂浮小符号 */}
      <span className="yaron-sparkle left-[10%] top-[16%] text-4xl animate-float">♫</span>
      <span className="yaron-sparkle left-[46%] top-[12%] text-2xl" style={{ animationDelay: '0.8s' }}>✦</span>
      <span className="yaron-sparkle right-[8%] top-[22%] text-3xl animate-float">♡</span>
      <span className="yaron-sparkle bottom-[28%] left-[6%] text-2xl">♡</span>
      <span className="yaron-sparkle bottom-[24%] right-[5%] text-4xl animate-float" style={{ animationDelay: '1.2s' }}>✦</span>

      {/* 主体:左文右头像 */}
      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 pb-10 pt-32 md:grid-cols-[1.05fr_0.95fr] md:gap-28 md:px-10 md:pt-36 lg:gap-36">
        {/* 左侧文字区 */}
        <div className="text-center md:text-left">
          <span className="yaron-tag">♫ 水聖安的粉丝观测站 ♡</span>

          <h1 className="mt-6 text-[2.7rem] font-black leading-[1.08] text-[#241322] md:text-5xl">
            Hi everyone, I'm
            <span className="mt-1 block">
              <span className="gradient-text">{profile.name}</span>
            </span>
          </h1>

          <p className="font-round title-white-edge mt-4 text-base text-[#9b85e0] md:text-lg">「{profile.bio}」</p>

          {/* 标签胶囊 */}
          <div className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
              <span className="yaron-chip bg-[#ffb7cd] text-[#7c2745]">♡ 喜欢唱歌画画</span>
            <span className="yaron-chip bg-[#c9b6ec] text-[#4a3568]">♫ 翻唱与切片</span>
            <span className="yaron-chip bg-[#aecbf4] text-[#2d4a73]">✦ 每天开心</span>
          </div>

          {/* 实时粉丝徽章 */}
          <div className="mt-6 flex justify-center md:justify-start">
            <div className="hero-live-badge">
              <span className="hero-live-dot" aria-hidden="true" />
              <span>
                {stats.live ? 'LIVE' : 'SNAPSHOT'} · 粉丝 {formatNum(stats.latest.followers)}
                {stats.live ? ' · 实时' : ` · 更新于 ${stats.updated.slice(5, 10).replace('-', '/')}`}
              </span>
            </div>
          </div>

          {/* 社交按钮 */}
          <div className="mt-7 flex justify-center md:justify-start">
            <SocialLinks />
          </div>
        </div>

        {/* 右侧头像(缩小靠右,垂直居中) */}
        <div className={`relative mx-auto w-56 sm:w-64 md:w-full md:max-w-xs md:justify-self-end md:translate-x-10 ${music.playing ? 'is-playing' : ''}`}>
          <AudioViz playing={music.playing} analyserRef={music.analyserRef} />
          <a
            href={profile.social.bilibili.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`前往 ${profile.name} 的B站主页`}
            className="yaron-disc relative block aspect-square"
          >
            <img
              src={profile.avatar}
              alt={profile.name}
              referrerPolicy="no-referrer"
              className="yaron-disc-img size-full rounded-full object-cover"
            />
          </a>
          <span className="yaron-avatar-bubble">点我去B站串门 ♡</span>
          <span className="absolute -left-3 top-6 text-3xl text-[#ff8fab]/60 animate-float">✦</span>
          <span className="absolute -right-2 top-1/3 text-2xl text-[#ff8fab]/50 animate-float" style={{ animationDelay: '0.6s' }}>♡</span>
          <div className="absolute -bottom-1 right-4 rotate-3 rounded-full bg-white/90 px-4 py-1.5 text-xs font-bold text-[#b76e79] shadow-[0_8px_20px_rgba(183,110,121,0.25)]">
            谢谢泥喜欢小安！
          </div>
        </div>
      </div>

      {/* 底部音乐卡片 + 下滑箭头(宽度: 582px) */}
      <div className="relative z-10 mx-auto w-full max-w-[652px] pb-8">
        <div className="group">
          <MusicCard music={music} />
        </div>
        <div className="mt-4 flex justify-center">
          <a
            href="#about"
            onClick={scrollToAbout}
            aria-label="向下滚动"
            className="flex size-10 items-center justify-center rounded-full pb-2 text-3xl leading-none text-[#f4728f] animate-bounce transition-colors hover:text-[#b76e79]"
          >
            ⌄
          </a>
        </div>
      </div>

      {/* 底部渐隐 */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#fdf6ef] to-transparent" />
    </div>
  );
}

/* ==================================================
   ABOUT — Screen reveal animation
   ================================================== */
function About() {
  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add('(min-width: 768px)', () => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#taoyao-screen-reveal',
          start: 'center center',
          end: '+=900 center',
          scrub: 0.5,
          pin: true,
          pinSpacing: true,
        },
      });
      tl.to('.taoyao-screen-window', {
        width: '100vw',
        height: '100vh',
        borderRadius: 0,
        clipPath: 'inset(0 round 0px)',
        boxShadow: '0 0 0 rgba(0,0,0,0)',
      }).to('.taoyao-postcard-detail', { autoAlpha: 0, y: -18 }, 0)
        .to('.taoyao-screen-image', { scale: 1 }, 0);
    });

    mm.add('(max-width: 767px)', () => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#taoyao-screen-reveal',
          start: 'top 16%',
          end: '+=520 top',
          scrub: 0.45,
          pin: true,
          pinSpacing: true,
        },
      });
      tl.to('.taoyao-screen-window', {
        width: '100vw',
        height: '100dvh',
        borderRadius: 0,
        clipPath: 'inset(0 round 0px)',
        boxShadow: '0 0 0 rgba(0,0,0,0)',
      }).to('.taoyao-postcard-detail', { autoAlpha: 0, y: -12 }, 0)
        .to('.taoyao-screen-image', { scale: 1.04 }, 0);
    });

    return () => mm.revert();
  });

  return (
    <section id="about" className="min-h-screen w-screen bg-[#fff8f1]">
      <div className="relative mb-8 mt-36 flex flex-col items-center gap-5 px-5">
        <p className="font-general text-sm uppercase tracking-[0.35em] text-[#b76e79] md:text-[10px]">
          Welcome to {profile.nameJP}'s Fan Site
        </p>

        <AnimatedTitle
          title="FEEL FRE<b>E</b> TO KEEP <br /> SCROLLING D<b>O</b>WN"
          containerClass="mt-5 !text-black text-center"
        />

        <div className="about-subtext">
          <p>这里收录了{profile.name}的歌曲切片、数据档案与社交链接，希望能让更多人认识这位闪闪发光的歌者。</p>
        </div>
      </div>

      {/* Screen reveal */}
      <div className="taoyao-screen-reveal w-screen" id="taoyao-screen-reveal">
        <div className="taoyao-screen-window">
          <div className="taoyao-postcard-detail absolute left-5 right-5 top-5 z-30 flex items-center justify-between text-blue-50">
            <span className="rounded-full border border-white/35 bg-white/20 px-4 py-2 font-general text-[10px] uppercase tracking-[0.35em] backdrop-blur-md">
              Welcome to {profile.nameJP}
            </span>
            <span className="font-general text-[10px] uppercase tracking-[0.35em] text-white/75">
              No. 2026
            </span>
          </div>

          {/* Background image (gradient placeholder) */}
          <div className="taoyao-screen-image absolute left-0 top-0 size-full scale-100 md:scale-[1.08] object-cover
            bg-gradient-to-br from-[#b76e79] via-[#ff8fab] to-[#dde8ff]" />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#160d14]/60 via-transparent to-white/10" />
          <div className="taoyao-postcard-detail pointer-events-none absolute inset-5 z-30 border border-white/30" />
          <div className="taoyao-postcard-detail pointer-events-none absolute bottom-8 left-6 right-6 text-blue-50 md:left-10 md:right-auto md:max-w-xl">
            <p className="font-general text-xs uppercase tracking-[0.35em] text-pink-100/80">
              Scroll to immerse
            </p>
            <p className="mt-3 font-circular-web text-lg leading-relaxed md:text-2xl">
              她的声音像清泉流过心间，既有水的温柔，也有圣洁的力量。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==================================================
   EXPORT
   ================================================== */
export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <SongsGallery />
      <Observatory />
      <Milestones />
    </>
  );
}
