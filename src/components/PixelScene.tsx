import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

type GameState = 'walking' | 'dragging' | 'falling' | 'pickup';
type DogAnimation = 'run' | 'idle' | 'sleep' | 'drag';
type Point = { x: number; y: number };

const DOG_GIFS: Record<DogAnimation, string> = {
  run: '/images/dog-run.gif', idle: '/images/dog-idle.gif', sleep: '/images/dog-sleep.gif', drag: '/images/dog-drag.gif',
};

const HEROINE_GIFS = { run: '/images/heroine-run.gif', circle: '/images/heroine-circle.gif' } as const;

const WORLD = { width: 960, height: 540, groundY: 510 };
const DOG = { width: 168, height: 144, startX: 150, patrolMin: 0, patrolMax: WORLD.width - 168 };
const HEROINE = { x: 770, width: 500, height: 281, groundY: 513, contactX: 0, contactWidth: WORLD.width };
const CIRCLE_LOOP_MS = 51 * 30;   // circle.gif 单次循环时长
const PICKUP_MS = CIRCLE_LOOP_MS * 2; // 抱起动画循环两次
const PICKUP_COOLDOWN_MS = 15000;    // 抱起后冷却 15s

function centerRangesOverlap(aCenter: number, aRadius: number, bCenter: number, bRadius: number) {
  return Math.abs(aCenter - bCenter) <= aRadius + bRadius;
}

function isHeroineContact(dogX: number, dogY: number, heroineX: number) {
  const dogCenterX = dogX + DOG.width / 2;
  const heroineCenterX = heroineX;
  const dogCenterY = dogY + DOG.height / 2;
  const heroineCenterY = HEROINE.groundY - HEROINE.height / 2;
  return centerRangesOverlap(dogCenterX, DOG.width * 0.3, heroineCenterX, HEROINE.width * 0.25)
    && centerRangesOverlap(dogCenterY, DOG.height * 0.35, heroineCenterY, HEROINE.height * 0.25);
}

function clamp(value: number, min: number, max: number) { return Math.min(Math.max(value, min), max); }

function PixelDog({ facing, animation }: { facing: 'left' | 'right'; animation: DogAnimation }) {
  const src = DOG_GIFS[animation];
  const mirrored = animation === 'drag' ? facing === 'left' : facing === 'right';
  return <div className={`platform-dog dog-animation-${animation}`} aria-hidden="true">
    <img key={src} className={`dog-gif ${mirrored ? 'face-left' : 'face-right'}`} src={src} alt="" draggable={false} />
  </div>;
}

function PixelHeroine({ hugging }: { hugging: boolean }) {
  const src = hugging ? HEROINE_GIFS.circle : HEROINE_GIFS.run;
  return <img key={src} className="heroine-gif" src={src} alt="像素风女主" draggable={false} />;
}


export default function PixelScene() {
  const stageRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const directionRef = useRef(1);
  const heroineDirectionRef = useRef(-1);
  const heroineXRef = useRef(HEROINE.x);
  const lastXRef = useRef(DOG.startX);
  const activePointerRef = useRef<number | null>(null);
  const dogXRef = useRef(DOG.startX);
  const dogYRef = useRef(WORLD.groundY - DOG.height);
  const dogVisibleRef = useRef(true);
  const fallVelocityRef = useRef(0);
  const facingRef = useRef<'left' | 'right'>('right');
  const lastDragDirectionRef = useRef(1);
  const pickupTimerRef = useRef<number | null>(null);
  const pickupCooldownRef = useRef(false);
  const pickupCooldownTimerRef = useRef<number | null>(null);
  const triggerPickupRef = useRef<() => void>(() => {});
  const [dogX, setDogX] = useState(DOG.startX);
  const [dogY, setDogY] = useState(WORLD.groundY - DOG.height);
  const [dogVisible, setDogVisible] = useState(true);
  const [heroineX, setHeroineX] = useState(HEROINE.x);
  const [state, setState] = useState<GameState>('walking');
  const [ambientAnimation, setAmbientAnimation] = useState<DogAnimation>('run');
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const [heroineFacing, setHeroineFacing] = useState<'left' | 'right'>('left');
  const [, setNotice] = useState('');
  dogXRef.current = dogX;
  facingRef.current = facing;

  const triggerPickup = useCallback(() => {
    if (state === 'pickup' || !dogVisibleRef.current || pickupCooldownRef.current) return;
    setState('pickup');
    pickupCooldownRef.current = true;
    // 冷却从碰到的瞬间开始计算,避免叠加 circle 动画时长
    pickupCooldownTimerRef.current = window.setTimeout(() => { pickupCooldownRef.current = false; }, PICKUP_COOLDOWN_MS);
      setDogVisible(false);
      dogVisibleRef.current = false;
    pickupTimerRef.current = window.setTimeout(() => {
      // circle 循环两次后:女主回到 manrun,小狗重新出现并继续 run
      directionRef.current = heroineDirectionRef.current * -1;
      setFacing(directionRef.current === 1 ? 'right' : 'left');
      facingRef.current = directionRef.current === 1 ? 'right' : 'left';
      setAmbientAnimation('run');
      setDogY(WORLD.groundY - DOG.height);
      dogYRef.current = WORLD.groundY - DOG.height;
      setDogVisible(true);
      dogVisibleRef.current = true;
      setState('walking');
    }, PICKUP_MS);
  }, [state]);
  triggerPickupRef.current = triggerPickup;

  useEffect(() => () => {
    if (pickupTimerRef.current) window.clearTimeout(pickupTimerRef.current);
    if (pickupCooldownTimerRef.current) window.clearTimeout(pickupCooldownTimerRef.current);
  }, []);

  useEffect(() => {
    if (state !== 'walking') return;
    let timer: number | null = null;
    const schedulePause = () => {
      timer = window.setTimeout(() => {
        const pause: DogAnimation = Math.random() < 0.72 ? 'idle' : 'sleep';
        setAmbientAnimation(pause);
        timer = window.setTimeout(() => { setAmbientAnimation('run'); schedulePause(); }, 10000 + Math.random() * 10000);
      }, 15000 + Math.random() * 15000);
    };
    schedulePause();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [state]);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (time: number) => {
      const delta = Math.min(time - last, 40); last = time;
      if (state === 'falling' && delta > 0) {
        fallVelocityRef.current += delta * 0.0018;
        const nextY = Math.min(dogYRef.current + fallVelocityRef.current * delta, WORLD.groundY - DOG.height);
        dogYRef.current = nextY;
        setDogY(nextY);
        if (nextY >= WORLD.groundY - DOG.height) {
          fallVelocityRef.current = 0;
          setState('walking'); setAmbientAnimation('run'); setNotice('继续探索，边牧会自己散步');
        }
      }
      if (state === 'walking' && ambientAnimation === 'run' && delta > 0) {
        const next = dogXRef.current + directionRef.current * delta * 0.12;
        if (next >= DOG.patrolMax) { directionRef.current = -1; setFacing('left'); }
        else if (next <= DOG.patrolMin) { directionRef.current = 1; setFacing('right'); }
        dogXRef.current = clamp(next, DOG.patrolMin, DOG.patrolMax);
        setDogX(dogXRef.current);
      }
      // 女主始终左右行走,只有抱起动画(circle)期间暂停
      if (state !== 'pickup' && delta > 0) {
        const nextHeroineX = heroineXRef.current + heroineDirectionRef.current * delta * 0.12;
        if (nextHeroineX >= WORLD.width) { heroineDirectionRef.current = -1; setHeroineFacing('left'); }
        else if (nextHeroineX <= 0) { heroineDirectionRef.current = 1; setHeroineFacing('right'); }
        heroineXRef.current = clamp(nextHeroineX, 0, WORLD.width);
        setHeroineX(heroineXRef.current);
        // 拖拽/下落时由玩家控制小狗,只有自由活动时才检测接触
        if (state === 'walking' && isHeroineContact(dogXRef.current, dogYRef.current, heroineXRef.current)) {
          triggerPickupRef.current();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, ambientAnimation]);

  const pointFromEvent = (event: ReactPointerEvent) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: ((event.clientX - rect.left) / rect.width) * WORLD.width, y: ((event.clientY - rect.top) / rect.height) * WORLD.height };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (state === 'pickup') return;
    const point = pointFromEvent(event); if (!point) return;
    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    offsetRef.current = { x: point.x - dogXRef.current, y: point.y - dogYRef.current };
    lastXRef.current = dogXRef.current;
    lastDragDirectionRef.current = directionRef.current;
    setState('dragging'); setAmbientAnimation('drag'); setNotice('拖动中：带边牧去找她');
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (state !== 'dragging') return;
    if (activePointerRef.current !== null && activePointerRef.current !== event.pointerId) return;
    const point = pointFromEvent(event); if (!point) return;
    const nextX = clamp(point.x - offsetRef.current.x, 0, WORLD.width - DOG.width);
    const nextY = clamp(point.y - offsetRef.current.y, 0, WORLD.groundY - DOG.height);
    const deltaX = nextX - lastXRef.current;
    if (Math.abs(deltaX) > 0.5) {
      const nextFacing = deltaX > 0 ? 'right' : 'left';
      lastDragDirectionRef.current = deltaX > 0 ? 1 : -1;
      setFacing(nextFacing);
      facingRef.current = nextFacing;
    }
    lastXRef.current = nextX; dogXRef.current = nextX; dogYRef.current = nextY; setDogX(nextX); setDogY(nextY);
    if (isHeroineContact(nextX, nextY, heroineXRef.current)) triggerPickup();
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (state !== 'dragging') return;
    event.currentTarget.releasePointerCapture(event.pointerId); activePointerRef.current = null;
    directionRef.current = lastDragDirectionRef.current;
    fallVelocityRef.current = 0;
    setState('falling'); setAmbientAnimation('idle'); setNotice('边牧落回地板…');
  };

  return <div className="pixel-scene-shell">
    <div ref={stageRef} className="pixel-scene-stage platform-stage">
      <img className="pixel-reference-background" src="/images/pixel-scene.jpg" alt="像素风房间参考场景" draggable={false} />
      <div className="pixel-reference-tint" aria-hidden="true" />
      <div className={`platform-heroine-wrap ${state === 'pickup' ? 'is-hugging' : ''} ${heroineFacing === 'right' ? 'face-right' : 'face-left'}`} style={{ left: `${(heroineX / WORLD.width) * 100}%`, top: `${(HEROINE.groundY / WORLD.height) * 100}%`, width: `${(HEROINE.width / WORLD.width) * 100}%`, height: `${(HEROINE.height / WORLD.height) * 100}%` }}>
        <PixelHeroine hugging={state === 'pickup'} />
        {state === 'pickup' && <span className="platform-heroine-sparkles" aria-hidden="true">✦　♡　✦</span>}
      </div>
      {dogVisible && <button type="button" className="platform-dog-hitbox" style={{ left: `${(dogX / WORLD.width) * 100}%`, top: `${(dogY / WORLD.height) * 100}%`, width: `${(DOG.width / WORLD.width) * 100}%`, height: `${(DOG.height / WORLD.height) * 100}%` }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label="拖动边牧"><PixelDog facing={facing} animation={ambientAnimation} /></button>}
    </div>
  </div>;
}
