import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowUp, FaMoon, FaSun } from 'react-icons/fa';
import { profile } from '../data/content';

import '../about.css';

const favorites = [
  { icon: '/images/achievement-neri.jpg', kind: 'MALODY 4K NERI CUP #1', title: 'Champion', text: '2022年01月25日获得自己第一个冠军，也是唯一一个个人赛冠军。', meta: '01 / champion', href: null },
  { icon: '/images/achievement-gbc.png', kind: 'GBC 2023 AUTUMN', title: 'Champion', text: '2023年12月16日获得GBC秋季赛冠军。', meta: '02 / champion', href: 'https://www.bilibili.com/video/BV1gu4y1M7Ti' },
  { icon: '/images/achievement-4dm.jpg', kind: '4 DIGIT OSU!MANIA WORLD CUP 2024', title: '7th-8th', text: '作为中国队成员出征4DM，倒在了半决赛败者组，最意难平。人生仅有的机会没把握住，没拿到世界冠军的遗憾。', meta: '03 / world cup', href: 'https://www.bilibili.com/video/BV1au4m1P7gU' },
  { icon: '/images/achievement-rdc.png', kind: 'ROASTED DUCK CUP 2024', title: 'Champion', text: '2024年8月27日获得RDC冠军。', meta: '04 / champion', href: 'https://www.bilibili.com/video/BV19YsEe8ELb' },
  { icon: '/images/achievement-mcnc.png', kind: 'OSU!MANIA CHINESE NATIONAL CUP 4K 2026', title: '16th-24th', text: '在实力老年阶段第一次参加了中国国家杯，后悔前几年没参加，排名中规中矩。', meta: '05 / national cup', href: 'https://www.bilibili.com/video/BV1bhuc6VEUL' },
];

export default function About() {
  const [dark, setDark] = useState(() => localStorage.getItem('about-theme') === 'dark');
  const [showTop, setShowTop] = useState(false);
  const [loveOpen, setLoveOpen] = useState(false);
  const [achievementOpen, setAchievementOpen] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle('about-dark', dark); localStorage.setItem('about-theme', dark ? 'dark' : 'light'); return () => document.documentElement.classList.remove('about-dark'); }, [dark]);
  useEffect(() => { const onScroll = () => setShowTop(window.scrollY > 500); window.addEventListener('scroll', onScroll, { passive: true }); return () => window.removeEventListener('scroll', onScroll); }, []);

  return <main className="about-page">
    <header className="about-site-nav"><Link to="/" className="about-site-logo"><span>💧</span>{profile.name} life</Link><nav><Link to="/">首页</Link><a href="#favorites">兴趣手账</a><Link className="is-current" to="/about">Room</Link></nav><button type="button" className="about-mode" onClick={() => setDark((v) => !v)}>{dark ? <FaSun /> : <FaMoon />}</button></header>
    <section className="about-hero-card"><span className="about-tape about-tape-left" aria-hidden="true" /><span className="about-spark about-spark-one">✦</span><span className="about-spark about-spark-two">♡</span><div className="about-avatar-column"><div className="about-avatar-wrap"><img src="/images/about-avatar.jpg" alt="知辰" /></div><p>你好！</p></div><div className="about-hero-copy"><p className="about-eyebrow">ABOUT / 知辰</p><h1>大家好，这里是<em>知辰</em></h1><p className="about-lead">没有什么可以介绍的，是一名音游玩家。</p><div className="about-badges"><a href="https://osu.ppy.sh/users/8883576" target="_blank" rel="noreferrer">📍 OSU主页</a><a href="https://space.bilibili.com/17385659" target="_blank" rel="noreferrer">♫ B站主页</a><button type="button" onClick={() => setLoveOpen(true)}>♡ 永远喜欢小安</button></div></div></section>
    <section className="about-diary" id="favorites"><div className="about-section-title"><div><p>OSU / ACHIEVEMENTS</p><h2>我的音游成就</h2></div><span>有点累了，但还是不想放弃音游</span></div><div className="about-interest-grid">{favorites.map((item) => <article className={`about-interest-row ${item.href ? 'is-clickable' : 'is-clickable'}`} key={item.kind} onClick={() => item.href ? window.open(item.href, '_blank', 'noopener,noreferrer') : setAchievementOpen(true)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') item.href ? window.open(item.href, '_blank', 'noopener,noreferrer') : setAchievementOpen(true); }}><span className="about-interest-icon"><img src={item.icon} alt={item.kind} /></span><div><small>{item.kind}</small><h3>{item.title}</h3><p>{item.text}</p></div><b>{item.meta}</b></article>)}</div><div className="about-doodle">⌁ 记录完毕！</div></section>
    {loveOpen && <div className="about-love-modal" role="dialog" aria-modal="true" onClick={() => setLoveOpen(false)}><div onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => setLoveOpen(false)}>×</button><img src="/images/about-love.png" alt="永远喜欢小安" /></div></div>}
    {achievementOpen && <div className="about-love-modal" role="dialog" aria-modal="true" onClick={() => setAchievementOpen(false)}><div className="achievement-flip" onClick={(event) => event.stopPropagation()}><input id="achievement-flip-toggle" type="checkbox" /><div className="achievement-flip-page page-front"><img src="/images/achievement-1.jpg" alt="Malody 4K Neri Cup #1" /></div><div className="achievement-flip-page page-back"><img src="/images/achievement-2.jpg" alt="Malody achievement" /></div><label className="achievement-flip-next" htmlFor="achievement-flip-toggle">翻下一页 →</label><button type="button" className="achievement-flip-close" onClick={() => setAchievementOpen(false)}>×</button></div></div>}
    {showTop && <button type="button" className="about-back-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="返回顶部"><FaArrowUp /></button>}
  </main>;
}
