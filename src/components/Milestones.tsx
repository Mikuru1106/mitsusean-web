import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Button from './Button';
import AnimatedTitle from './AnimatedTitle';
import { profile, milestones } from '../data/content';

gsap.registerPlugin(ScrollTrigger);

const TYPE_COLORS: Record<string, string> = {
  首播: 'bg-[#8db5d4]',
  爆款: 'bg-[#ff8fab]',
  万粉: 'bg-[#c97d87]',
  周年: 'bg-[#9a7fb8]',
  纪念: 'bg-[#7f9eb5]',
};

function MilestoneItem({ m, index }: { m: (typeof milestones)[number]; index: number }) {
  const isLeft = index % 2 === 0;

  return (
    <div
      className={`milestone-item relative flex md:w-1/2 ${
        isLeft ? 'md:justify-end md:pr-12' : 'md:ml-auto md:pl-12'
      } pl-10 md:pl-0 ${isLeft ? '' : 'md:pl-12'}`}
    >
      {/* Dot */}
      <span
        className={`absolute left-[11px] top-7 z-10 grid size-[18px] place-items-center rounded-full border-4 border-[#fff8f1] shadow-[0_2px_10px_rgba(183,110,121,0.35)] md:left-auto ${
          isLeft ? 'md:-right-[9px]' : 'md:-left-[9px]'
        } ${TYPE_COLORS[m.type] ?? 'bg-[#ff8fab]'}`}
      />

      <div className="card-hover w-full max-w-md p-6">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold text-white ${TYPE_COLORS[m.type] ?? 'bg-[#ff8fab]'}`}>
            {m.type}
          </span>
          <span className="font-general text-[10px] uppercase tracking-[0.3em] text-[#b76e79]">
            {m.date}
          </span>
        </div>
        <h3 className="mt-3 text-xl font-black text-[#241322]">
          <span className="mr-2">{m.emoji}</span>
          {m.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#8b6f63]">{m.desc}</p>
      </div>
    </div>
  );
}

export default function Milestones() {
  const listRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.utils.toArray<HTMLElement>('.milestone-item').forEach((el) => {
        gsap.from(el, {
          autoAlpha: 0,
          y: 48,
          duration: 0.9,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%' },
        });
      });
      gsap.from('.milestone-line', {
        scaleY: 0,
        transformOrigin: 'top center',
        duration: 1.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: listRef.current, start: 'top 75%' },
      });
    },
    { scope: listRef },
  );

  return (
    <section id="milestones" className="min-h-dvh w-screen bg-[linear-gradient(180deg,#f6fbff_0%,#fff8f1_48%,#ffeef5_100%)] pb-24 text-[#241322]">
      <div className="flex flex-col items-center pt-28">
        <p className="font-general text-sm uppercase tracking-[0.35em] text-[#b76e79] md:text-[10px]">
          MILESTONES
        </p>
        <AnimatedTitle
          title="EVERY DROP MA<b>K</b>ES <br /> AN OC<b>E</b>AN"
          containerClass="mt-5 pointer-events-none relative z-10 !text-[#241322] text-center"
        />
        <p className="about-subtext mt-6">
          从第一滴水的回响，到一片温柔的海。记录{profile.name}一路走来的闪光时刻。
        </p>
      </div>

      {/* Timeline */}
      <div ref={listRef} className="relative mx-auto mt-16 max-w-5xl px-5 md:px-10">
        {/* Center / left line */}
        <span className="milestone-line absolute bottom-4 left-[19px] top-2 w-px bg-gradient-to-b from-[#ff8fab]/10 via-[#ff8fab]/60 to-[#ff8fab]/10 md:left-1/2" />

        <div className="flex flex-col gap-10 md:gap-14">
          {milestones.map((m, i) => (
            <MilestoneItem key={m.date} m={m} index={i} />
          ))}
        </div>
      </div>

      {/* Envelope letter */}
      <div className="relative z-30 mt-24 flex w-full justify-center px-6">
        <section aria-labelledby="story-envelope-heading" className="w-full max-w-md md:max-w-lg">
          <article className="story-envelope-cta story-envelope-cta--open">
            <div className="story-envelope-body">
              <p className="story-envelope-meta">№ 01 · A letter</p>
              <p className="story-envelope-salutation">Dear visitor,</p>
              <h2 id="story-envelope-heading" className="story-envelope-title">
                thank you<br />
                for stopping by.
              </h2>
              <p className="story-envelope-desc">
                如果有任何建议或想说的话，欢迎通过社交平台联系。
              </p>
              <p className="story-envelope-signoff">
                <span className="story-envelope-signoff-line">Yours,</span>
                <span className="story-envelope-signoff-name">{profile.nameJP}</span>
              </p>
              <a href={profile.social.bilibili.url} target="_blank" rel="noopener noreferrer">
                <Button
                  id="realm-btn"
                  title="前往B站主页 →"
                  containerClass="story-envelope-btn mt-5 !bg-[#241322] !text-[#ffe7ef]"
                />
              </a>
            </div>
          </article>
        </section>
      </div>
    </section>
  );
}
