import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { gamesApi, kidsApi } from '../api/client';
import type { GameComponentProps, GameConfigValues, GamePlayState } from '../types';
import { getGame } from './registry';
import GameSettingsSheet from './GameSettingsSheet';
import { useShowerSound } from './shower-steps/sound';
import type { Sfx } from './shower-steps/sound';
import scene0 from './shower-steps/scene-0.webp';
import scene1 from './shower-steps/scene-1.webp';
import scene2 from './shower-steps/scene-2.webp';
import scene3 from './shower-steps/scene-3.webp';
import scene4 from './shower-steps/scene-4.webp';
import scene5 from './shower-steps/scene-5.webp';
import scene6 from './shower-steps/scene-6.webp';
import scene7 from './shower-steps/scene-7.webp';
import itemBasket from './shower-steps/item-basket.webp';
import itemShower from './shower-steps/item-shower.webp';
import itemSoap from './shower-steps/item-soap.webp';
import itemShampoo from './shower-steps/item-shampoo.webp';
import itemTowel from './shower-steps/item-towel.webp';
import itemShirt from './shower-steps/item-shirt.webp';
import './lego-tower.css'; // the shared settings sheet's styles
import './shower-steps.css';

/**
 * המקלחת שלי — the child does the shower routine in order by dragging the
 * glowing item onto himself; the painted scene changes with every step.
 * Errorless: a wrong item floats home and the right one pulses. Ends with soap
 * bubbles to pop (a reinforcer), an announced finish and a calm end screen.
 */

const GAME_ID = 'shower-steps';
/** How long the bubble cloud takes to cover the picture before it changes. */
const SWAP_COVER_MS = 320;
/** 0 dressed, 1 undressed, 2 wet, 3 shampoo in hair, 4 soap on body, 5 rinsed, 6 towel, 7 dressed clean */
const GENERIC_SCENES = [scene0, scene1, scene2, scene3, scene4, scene5, scene6, scene7];

type ItemId = 'basket' | 'shower' | 'shampoo' | 'soap' | 'towel' | 'shirt';
const ITEM_ART: Record<ItemId, string> = {
  basket: itemBasket, shower: itemShower, shampoo: itemShampoo, soap: itemSoap, towel: itemTowel, shirt: itemShirt,
};

type Fx = 'drop' | 'foam' | 'fluff';
/** A step with `rub` is done in two moves: bring the item, then rub the picture with it. */
interface Step { item: ItemId; scene: number; voice: string; label: string; sfx: Sfx; rub?: { loop: Sfx; fx: Fx } }
const ALL_STEPS: Step[] = [
  { item: 'basket', scene: 1, voice: 's1', label: 'מורידים בגדים', sfx: 'cloth' },
  { item: 'shower', scene: 2, voice: 's2', label: 'מרטיבים את הגוף', sfx: 'water', rub: { loop: 'rinse', fx: 'drop' } },
  { item: 'shampoo', scene: 3, voice: 's-hair', label: 'חופפים את הראש בשמפו', sfx: 'foam', rub: { loop: 'scrub', fx: 'foam' } },
  { item: 'shower', scene: 2, voice: 's-hair-rinse', label: 'שוטפים את הראש', sfx: 'water', rub: { loop: 'rinse', fx: 'drop' } },
  { item: 'soap', scene: 4, voice: 's3', label: 'מסבנים את הגוף', sfx: 'foam', rub: { loop: 'scrub', fx: 'foam' } },
  { item: 'shower', scene: 5, voice: 's4', label: 'שוטפים את הסבון', sfx: 'water', rub: { loop: 'rinse', fx: 'drop' } },
  { item: 'towel', scene: 6, voice: 's5', label: 'מתנגבים במגבת', sfx: 'towel', rub: { loop: 'towel', fx: 'fluff' } },
  { item: 'shirt', scene: 7, voice: 's6', label: 'מתלבשים. איזה נקי!', sfx: 'cloth' },
];
const SHORT_STEPS = [1, 4, 5, 6]; // wet, soap, rinse, towel
const NO_HAIR_STEPS = [0, 1, 4, 5, 6, 7]; // the board's six steps

type Phase = 'start' | 'play' | 'bubbles' | 'end';

interface ShowerState {
  tutorialSeen?: boolean;
  stats?: { rounds?: number };
  updatedAt?: string;
}

interface Bubble { id: number; x: number; y: number; size: number; drift: number; delay: number }

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function ShowerSteps({
  config, state, canEdit, onSaveState, onSaveConfig, onExit,
}: GameComponentProps) {
  const def = getGame(GAME_ID)!;
  const { kidId } = useParams<{ kidId: string }>();

  /* ------------------------------ config ------------------------------ */
  const steps = useMemo(
    () => (config.steps === 'short' ? SHORT_STEPS.map((i) => ALL_STEPS[i])
      : config.steps === 'noHair' ? NO_HAIR_STEPS.map((i) => ALL_STEPS[i])
        : ALL_STEPS),
    [config.steps]
  );
  const freeOrder = config.hint === 'all';
  const bubbleGoal = Math.max(0, Math.min(12, Number(config.bubbles ?? 6)));
  const soundSetting = config.sound !== false;
  const voiceOn = config.voice !== false;
  const useKidPictures = config.kidPictures !== false;
  const saved = state as unknown as ShowerState;

  /* -------------------- the kid (gender) and pictures -------------------- */
  const kidQuery = useQuery({
    queryKey: ['kid', kidId],
    queryFn: () => kidsApi.getById(kidId!),
    enabled: !!kidId,
  });
  const girl = kidQuery.data?.data?.gender === 'girl';
  const g = (m: string, f: string) => (girl ? f : m);

  const assetsQuery = useQuery({
    queryKey: ['kid-game-assets', kidId, GAME_ID],
    queryFn: () => gamesApi.getAssets(kidId!, GAME_ID),
    enabled: !!kidId && useKidPictures,
    staleTime: 10 * 60 * 1000,
  });
  const scenes = useMemo(() => {
    const own = useKidPictures ? assetsQuery.data?.data || {} : {};
    // use the kid's own set only when it is complete, so the boy never changes mid-round
    const complete = GENERIC_SCENES.every((_, i) => typeof own[`scene-${i}`] === 'string');
    return complete ? GENERIC_SCENES.map((_, i) => own[`scene-${i}`]) : GENERIC_SCENES;
  }, [assetsQuery.data, useKidPictures]);
  const personal = scenes !== GENERIC_SCENES;

  /* ------------------------------ play state ------------------------------ */
  const [phase, setPhase] = useState<Phase>('start');
  const [done, setDone] = useState(0); // steps completed this round
  const [shownScene, setShownScene] = useState(steps[0].scene - 1);
  const [swap, setSwap] = useState(0); // bump = a soft bubble cloud covers the picture while it changes
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [, setPopped] = useState(0);
  const poppedRef = useRef(0);
  const [pulse, setPulse] = useState(0); // bump to re-run the "this one" pulse
  const [returning, setReturning] = useState<number | null>(null);
  const [rub, setRub] = useState<{ step: Step; from: number; key: number } | null>(null);
  const rubbedOnce = useRef(false);
  const [sparkle, setSparkle] = useState(0);
  const [tutorial, setTutorial] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(`showerMuted:${kidId}`) === '1'; } catch { return false; }
  });
  const [drag, setDrag] = useState<{ index: number; over: boolean } | null>(null);
  const [layout, setLayout] = useState({ landscape: false, card: 88, cols: 3, sceneW: 0 });

  const sound = useShowerSound(soundSetting && !muted, voiceOn && !muted);
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const busy = useRef(false); // true while a step animates — ignore other touches
  const activePointer = useRef<number | null>(null);
  const exitArmed = useRef(false);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const next = steps[done] as Step | undefined;

  /* ---------------- full screen, like the tower ---------------- */
  useEffect(() => {
    document.body.classList.add('lego-open', 'shw-open');
    return () => document.body.classList.remove('lego-open', 'shw-open');
  }, []);

  /* ---------------- sizing from the measured viewport ---------------- */
  const fit = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const landscape = w / h > 1.05;
    let card: number;
    let cols: number;
    if (landscape) {
      // tray is a side panel: 2 columns x 3 rows
      cols = 2;
      const panelH = h - 72 - 32;
      card = Math.floor(Math.min((panelH - 2 * 16) / 3, (w * 0.4 - 3 * 16) / 2, 170));
    } else {
      const oneRow = (w - 32 - 5 * 12) / 6;
      cols = oneRow >= 92 ? 6 : 3;
      card = cols === 6
        ? Math.floor(Math.min(oneRow, 132))
        : Math.floor(Math.min((w - 32 - 2 * 14) / 3, h * 0.13, 120));
    }
    card = Math.max(64, card);
    // landscape: the picture keeps its 2:3 shape at full height, beside the tray
    const sceneW = landscape ? Math.floor(Math.min((h - 64 - 22) * (2 / 3), w - (card * 2 + 3 * 16) - 32 - 24)) : 0;
    setLayout({ landscape, card, cols, sceneW });
  }, []);

  useEffect(() => {
    fit();
    let t: number | undefined;
    const refit = () => { window.clearTimeout(t); t = window.setTimeout(fit, 100); };
    window.addEventListener('resize', refit);
    window.addEventListener('orientationchange', refit);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', refit);
      window.removeEventListener('orientationchange', refit);
    };
  }, [fit]);

  /* ---------------- a round from the start ---------------- */
  const resetRound = useCallback(() => {
    setDone(0);
    setShownScene(steps[0].scene - 1);
    setBubbles([]);
    setPopped(0);
    poppedRef.current = 0;
    setRub(null);
    rubbedOnce.current = false;
    busy.current = false;
  }, [steps]);

  // a change of steps in settings starts the round over
  useEffect(() => { resetRound(); }, [resetRound]);

  const showTutorial = useCallback(() => {
    setTutorial(true);
    sound.say(g('drag-m', 'drag-f'));
    later(() => setTutorial(false), reducedMotion() ? 2500 : 4400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound, girl]);

  const begin = () => {
    sound.unlock();
    sound.play('tap');
    resetRound();
    setPhase('play');
    sound.say(g('intro-m', 'intro-f'));
    const first = steps[0];
    later(() => sound.say(first.voice), 1500);
    if (!saved.tutorialSeen) {
      later(() => showTutorial(), 3300);
      onSaveState({ ...(state || {}), tutorialSeen: true, updatedAt: new Date().toISOString() } as unknown as GamePlayState);
    }
  };

  /* ---------------- the right item arrived ---------------- */
  const completeStep = (step: Step) => {
    busy.current = true;
    setTutorial(false);
    sound.stopVoice();
    if (step.rub) {
      // second move: rub with the item - foam / drops / sparkles appear on the picture
      sound.play('tap');
      sound.play(step.sfx);
      setRub({ step, from: shownScene, key: Date.now() });
      if (!rubbedOnce.current) { rubbedOnce.current = true; later(() => sound.say(g('rub-m', 'rub-f')), 500); }
      return;
    }
    finishStep(step);
  };

  const finishRub = () => {
    sound.stopLoop();
    const step = rub?.step;
    if (step) finishStep(step);
  };

  /** Change the picture behind a soft bubble cloud, so two faces are never seen at once. */
  const changeScene = (to: number, after?: () => void) => {
    setSwap((n) => n + 1);
    later(() => { setShownScene(to); setRub(null); after?.(); }, SWAP_COVER_MS);
  };

  /* ---------------- a step is done ---------------- */
  const finishStep = (step: Step) => {
    busy.current = true;
    sound.stopVoice();
    sound.play('good');
    if (!step.rub) sound.play(step.sfx);
    changeScene(step.scene, () => setSparkle((s) => s + 1));
    const nextDone = done + 1;
    setDone(nextDone);
    const praise = ['good1', 'good2', 'good3'][nextDone % 3];
    later(() => sound.say(praise), 500);

    if (nextDone < steps.length) {
      later(() => { sound.say(steps[nextDone].voice); busy.current = false; }, 1700);
    } else {
      later(() => startBubbles(), 1900);
    }
  };

  const startBubbles = () => {
    const rounds = (saved.stats?.rounds || 0) + 1;
    onSaveState({
      ...(state || {}), tutorialSeen: true, stats: { ...(saved.stats || {}), rounds },
      updatedAt: new Date().toISOString(),
    } as unknown as GamePlayState);
    if (bubbleGoal === 0) { finish(); return; }
    sound.play('finale');
    sound.say(g('bubbles-m', 'bubbles-f'));
    const list: Bubble[] = Array.from({ length: bubbleGoal }, (_, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const size = 22 + Math.random() * 6;
      // keep the whole bubble on the picture: its centre stays half a bubble from each side
      const x = Math.max(size / 2 + 2, Math.min(100 - size / 2 - 2, 18 + col * 32 + (Math.random() * 8 - 4)));
      return {
        id: i,
        x,
        y: 16 + (row % 4) * 19 + (Math.random() * 6 - 3),
        size,
        drift: 3 + Math.random() * 3,
        delay: Math.random() * 2,
      };
    });
    setBubbles(list);
    setPopped(0);
    poppedRef.current = 0;
    setPhase('bubbles');
    busy.current = false;
  };

  const pop = (id: number) => {
    if (!bubbles.some((b) => b.id === id)) return;
    sound.unlock();
    setBubbles((list) => list.filter((b) => b.id !== id));
    sound.play('pop');
    poppedRef.current += 1;
    const nowPopped = poppedRef.current;
    setPopped(nowPopped);
    const left = bubbleGoal - nowPopped;
    if (left === 2 && bubbleGoal >= 4) sound.say('soon'); // announce the end before it comes
    if (left === 0) later(() => finish(), 700);
  };

  const finish = () => {
    sound.say('end');
    setPhase('end');
  };

  /* ---------------- wrong item: float home, point at the right one ---------------- */
  const gentleNo = (index: number) => {
    sound.play('back');
    setReturning(index);
    later(() => setReturning(null), 450);
    setPulse((p) => p + 1);
    sound.say('next');
  };

  /** The card positions in the tray (each step has its own card; used ones stay as faded slots). */
  const isNextCard = (index: number) => index === done;
  const canDragCard = (index: number) => index >= done && (freeOrder || isNextCard(index));

  /** In free order, any card with the same item as the next step counts (two shower cards). */
  const cardFits = (index: number) => !!next && steps[index].item === next.item && index >= done;

  const tryCard = (index: number) => {
    if (!next || busy.current) return;
    if (cardFits(index)) {
      // a matching card later in the row stands in for the next one
      completeStep(next);
    } else {
      gentleNo(index);
    }
  };

  /* ---------------- dragging ---------------- */
  const onCardPointerDown = (index: number) => (e: React.PointerEvent) => {
    if (phase !== 'play' || busy.current || !canDragCard(index)) {
      if (phase === 'play' && !busy.current && index > done) { setPulse((p) => p + 1); sound.play('back'); }
      return;
    }
    if (activePointer.current !== null) return; // a palm or second finger: ignore
    e.preventDefault();
    sound.unlock();
    activePointer.current = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    setDrag({ index, over: false });

    const place = (x: number, y: number) => {
      if (ghostRef.current) {
        ghostRef.current.style.left = `${x}px`;
        ghostRef.current.style.top = `${y}px`;
      }
    };
    requestAnimationFrame(() => place(startX, startY));

    const overScene = (x: number, y: number) => {
      const r = sceneRef.current?.getBoundingClientRect();
      if (!r) return false;
      // generous: anywhere on the picture except the very bottom edge strip by the tray
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom - 8;
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointer.current) return;
      ev.preventDefault();
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) moved = true;
      place(ev.clientX, ev.clientY);
      const over = overScene(ev.clientX, ev.clientY);
      setDrag((d) => (d && d.over !== over ? { ...d, over } : d));
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== activePointer.current) return;
      activePointer.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      const dropped = moved && overScene(ev.clientX, ev.clientY);
      setDrag(null);
      if (!moved) { tryCard(index); return; }   // a tap on a card works too
      if (dropped) tryCard(index);
      else { sound.play('back'); setReturning(index); later(() => setReturning(null), 450); }
    };

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };

  /* ---------------- tutorial hand path: from the next card to the boy ---------------- */
  const [handPath, setHandPath] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  useEffect(() => {
    if (!tutorial) { setHandPath(null); return; }
    const card = cardRefs.current[done]?.getBoundingClientRect();
    const sc = sceneRef.current?.getBoundingClientRect();
    if (!card || !sc) return;
    setHandPath({
      x0: card.left + card.width / 2, y0: card.top + card.height / 2,
      x1: sc.left + sc.width / 2, y1: sc.top + sc.height * 0.42,
    });
  }, [tutorial, done, layout]);

  /* ---------------- top bar actions ---------------- */
  const toggleSound = () => {
    const m = !muted;
    setMuted(m);
    try { localStorage.setItem(`showerMuted:${kidId}`, m ? '1' : '0'); } catch { /* private mode */ }
    if (m) sound.stopVoice();
  };

  const handleSaveSettings = (values: GameConfigValues) => {
    onSaveConfig(values);
    setShowSettings(false);
  };

  const again = () => {
    sound.unlock();
    resetRound();
    setPhase('play');
    later(() => sound.say(steps[0].voice), 300);
  };

  /* ---------------- test hook ---------------- */
  useEffect(() => {
    (window as unknown as Record<string, unknown>).SHOWER_STEPS = {
      phase, done, total: steps.length, next: next?.item ?? null, scene: shownScene, mode: rub ? 'rub' : 'pick',
      bubblesLeft: bubbles.length, personal, freeOrder, tutorial,
    };
  }, [phase, done, steps.length, next, shownScene, bubbles.length, personal, freeOrder, tutorial, rub]);

  /* -------------------------------- render -------------------------------- */
  const vars = {
    '--shw-card': `${layout.card}px`,
    '--shw-cols': layout.cols,
    '--shw-scene-w': `${layout.sceneW}px`,
  } as React.CSSProperties;

  const caption =
    phase === 'bubbles' ? g('בוא נפוצץ את הבועות!', 'בואי נפוצץ את הבועות!')
      : rub ? `${rub.step.label} 👆`
      : next ? next.label
        : '';

  const game = (
    <div
      ref={rootRef}
      className={`shw${layout.landscape ? ' landscape' : ''}${layout.cols === 6 ? ' one-row' : ''}`}
      style={vars}
      dir="rtl"
    >
      <div className="shw-topbar">
        <button
          className="shw-icon"
          aria-label="חזרה"
          onPointerDown={() => { exitArmed.current = true; }}
          onPointerUp={() => { if (exitArmed.current) { exitArmed.current = false; onExit(); } }}
          onPointerLeave={() => { exitArmed.current = false; }}
          onPointerCancel={() => { exitArmed.current = false; }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onExit(); }}
        >✕</button>

        <div className="shw-dots" aria-label={`${done} מתוך ${steps.length}`}>
          {steps.map((_, i) => <span key={i} className={`shw-dot${i < done ? ' on' : ''}${i === done && phase === 'play' ? ' now' : ''}`} />)}
        </div>

        {/* one quiet menu for the adult: sound, how to play, settings */}
        <button className={`shw-icon${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen((o) => !o)} aria-label="תפריט" aria-expanded={menuOpen}>
          <span className="shw-menu-dots" aria-hidden><i /><i /><i /></span>
        </button>
      </div>

      {menuOpen && (
        <div className="shw-menu-backdrop" onPointerDown={() => setMenuOpen(false)}>
          <div className="shw-menu" onPointerDown={(e) => e.stopPropagation()}>
            <button onClick={() => { toggleSound(); }}>
              <span aria-hidden>{muted ? '🔇' : '🔊'}</span>{muted ? 'הפעלת צלילים' : 'השתקה'}
            </button>
            <button
              disabled={phase !== 'play'}
              onClick={() => { setMenuOpen(false); sound.unlock(); showTutorial(); }}
            >
              <span aria-hidden>👆</span>איך משחקים
            </button>
            {canEdit && (
              <button onClick={() => { setMenuOpen(false); setShowSettings(true); }}>
                <span aria-hidden>⚙️</span>הגדרות
              </button>
            )}
          </div>
        </div>
      )}

      <div className="shw-main">
        <div className="shw-scene-wrap">
          <div ref={sceneRef} className={`shw-scene${drag?.over ? ' over' : ''}`}>
            <img className="shw-scene-img" src={scenes[shownScene]} alt="" draggable={false} />
            {/* every picture preloaded, so a change never waits on the network */}
            <div className="shw-preload" aria-hidden>{scenes.map((src, i) => <img key={i} src={src} alt="" />)}</div>
            {rub && (
              <RubLayer
                key={rub.key}
                tool={ITEM_ART[rub.step.item]}
                fx={rub.step.rub!.fx}
                onStart={() => { sound.unlock(); sound.startLoop(rub.step.rub!.loop); }}
                onStop={() => sound.stopLoop()}
                onHint={() => sound.say(g('rub-m', 'rub-f'))}
                onDone={finishRub}
              />
            )}
            {swap > 0 && <div key={`swap${swap}`} className="shw-swap" aria-hidden><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>}
            {sparkle > 0 && <div key={sparkle} className="shw-sparkle" aria-hidden><i /><i /><i /><i /><i /><i /></div>}

            {caption && phase !== 'start' && phase !== 'end' && (
              <div key={caption} className="shw-caption">{caption}</div>
            )}

            {phase === 'bubbles' && (
              <div className="shw-bubbles">
                {bubbles.map((b) => (
                  <button
                    key={b.id}
                    className="shw-bubble"
                    aria-label="בועה"
                    style={{
                      left: `${b.x}%`, top: `${b.y}%`, width: `${b.size}%`,
                      animationDuration: `${b.drift}s`, animationDelay: `${b.delay}s`,
                    }}
                    onPointerDown={(e) => { e.preventDefault(); pop(b.id); }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="shw-tray" aria-label="הדברים למקלחת">
          {steps.map((s, i) => {
            const used = i < done;
            const isNext = phase === 'play' && isNextCard(i);
            const active = phase === 'play' && canDragCard(i);
            return (
              <button
                key={`${i}-${s.item}`}
                ref={(el) => { cardRefs.current[i] = el; }}
                className={[
                  'shw-card',
                  used ? 'used' : '',
                  isNext ? 'next' : '',
                  active && !isNext ? 'open' : '',
                  !active && !used ? 'wait' : '',
                  drag?.index === i ? 'lifted' : '',
                  returning === i ? 'returning' : '',
                ].filter(Boolean).join(' ')}
                data-step={i}
                aria-label={s.label}
                onPointerDown={onCardPointerDown(i)}
                onContextMenu={(e) => e.preventDefault()}
              >
                {isNext && <span key={pulse} className="shw-card-glow" aria-hidden />}
                <img src={ITEM_ART[s.item]} alt="" draggable={false} />
                {used && <span className="shw-check" aria-hidden>✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {drag && (
        <div className="shw-drag-layer" aria-hidden>
          <div ref={ghostRef} className={`shw-ghost${drag.over ? ' over' : ''}`}>
            <img src={ITEM_ART[steps[drag.index].item]} alt="" draggable={false} />
          </div>
        </div>
      )}

      {tutorial && handPath && (
        <div
          className="shw-hand"
          aria-hidden
          style={{
            '--x0': `${handPath.x0}px`, '--y0': `${handPath.y0}px`,
            '--x1': `${handPath.x1}px`, '--y1': `${handPath.y1}px`,
          } as React.CSSProperties}
        >
          <div className="shw-hand-item"><img src={ITEM_ART[next?.item || 'basket']} alt="" /></div>
          <div className="shw-hand-finger">👆</div>
        </div>
      )}

      {phase === 'start' && (
        <div className="shw-overlay">
          <div className="shw-start-card">
            <img className="shw-start-pic" src={scenes[steps[0].scene - 1]} alt="" draggable={false} />
            <h1>המקלחת שלי</h1>
            <button className="shw-big-btn" onClick={begin}>{g('בוא נתקלח!', 'בואי נתקלח!')} 🚿</button>
          </div>
        </div>
      )}

      {phase === 'end' && (
        <div className="shw-overlay calm">
          <div className="shw-end-card">
            <img className="shw-start-pic" src={scenes[steps[steps.length - 1].scene]} alt="" draggable={false} />
            <h2>סיימנו את המקלחת!</h2>
            <div className="shw-end-stars" aria-hidden>⭐ ⭐ ⭐</div>
            <div className="shw-end-actions">
              <button className="shw-big-btn soft" onClick={again}>🔁 שוב</button>
              <button className="shw-big-btn" onClick={onExit}>✓ סיימתי</button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <GameSettingsSheet
          settings={def.settings}
          values={config}
          onCancel={() => setShowSettings(false)}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );

  return createPortal(game, document.body);
}

/* ============================================================================
 * The rub: the child rubs the picture with the item and its effect builds up on
 * top - foam where the soap or shampoo goes, droplets under the shower, sparkles
 * with the towel. The picture underneath never moves; when the meter is full the
 * game changes it behind a bubble cloud (changeScene). It can't fail: idle for a
 * while, the voice reminds; idle longer, it finishes by itself, slowly.
 * ========================================================================== */
const RUB_LENGTH = 3.6;   // how many picture-widths of rubbing finish the step
const HINT_MS = 5000;
const AUTO_MS = 9000;

function RubLayer({ tool, fx, onStart, onStop, onHint, onDone }: {
  tool: string; fx: Fx;
  onStart: () => void; onStop: () => void; onHint: () => void; onDone: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toolRef = useRef<HTMLDivElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const [touched, setTouched] = useState(false);
  const st = useRef({
    progress: 0, last: null as null | { x: number; y: number }, pointer: null as number | null,
    lastActive: 0, hinted: false, done: false, w: 0, h: 0, lastFx: 0, travel: 0,
  });
  const cb = useRef({ onStart, onStop, onHint, onDone });
  useEffect(() => { cb.current = { onStart, onStop, onHint, onDone }; });

  const setProgress = (p: number) => {
    const s = st.current;
    s.progress = Math.min(1, p);
    if (meterRef.current) meterRef.current.style.width = `${Math.round(s.progress * 100)}%`;
    const hook = (window as unknown as Record<string, Record<string, unknown> | undefined>).SHOWER_STEPS;
    if (hook) hook.rubProgress = s.progress;
    if (s.progress >= 1 && !s.done) {
      s.done = true;
      cb.current.onStop();
      cb.current.onDone();
    }
  };

  /** Paint the item's effect where the finger is: it stays, so the child sees the work build up. */
  const paint = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const r = Math.max(14, st.current.w * 0.05);
    if (fx === 'foam') {
      for (let i = 0; i < 3; i++) {
        const cx = x + (Math.random() - 0.5) * r * 2.2;
        const cy = y + (Math.random() - 0.5) * r * 1.6;
        const rr = r * (0.45 + Math.random() * 0.55);
        const g = ctx.createRadialGradient(cx - rr * 0.3, cy - rr * 0.3, rr * 0.1, cx, cy, rr);
        g.addColorStop(0, 'rgba(255,255,255,0.98)');
        g.addColorStop(0.7, 'rgba(246,250,255,0.95)');
        g.addColorStop(1, 'rgba(214,228,245,0.85)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (fx === 'drop') {
      // little shiny droplets that stay on the skin
      for (let i = 0; i < 2; i++) {
        const cx = x + (Math.random() - 0.5) * r * 3;
        const cy = y + (Math.random() - 0.5) * r * 2.4;
        const rr = r * (0.12 + Math.random() * 0.12);
        ctx.fillStyle = 'rgba(150, 205, 255, 0.55)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rr * 0.8, rr, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(cx - rr * 0.25, cy - rr * 0.35, rr * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // the towel leaves nothing behind - it dries; its sparkles are the floating fx
  };

  const spawnFx = (x: number, y: number) => {
    const wrap = wrapRef.current;
    const now = performance.now();
    if (!wrap || now - st.current.lastFx < 45 || reducedMotion()) return;
    st.current.lastFx = now;
    const count = fx === 'drop' ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = `shw-fx ${fx}`;
      el.style.left = `${x + (Math.random() * 50 - 25)}px`;
      el.style.top = `${y + (Math.random() * 30 - 10)}px`;
      el.addEventListener('animationend', () => el.remove());
      wrap.appendChild(el);
    }
  };

  const moveTool = (x: number, y: number) => {
    if (toolRef.current) { toolRef.current.style.left = `${x}px`; toolRef.current.style.top = `${y}px`; }
  };

  /* size the effect canvas to the picture */
  useEffect(() => {
    const wrap = wrapRef.current;
    const c = canvasRef.current;
    if (!wrap || !c) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    st.current.w = rect.width;
    st.current.h = rect.height;
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    moveTool(rect.width / 2, rect.height * 0.66);
  }, []);

  /* errorless: a reminder, then it finishes slowly by itself */
  useEffect(() => {
    st.current.lastActive = Date.now();
    const t = window.setInterval(() => {
      const s = st.current;
      if (s.done || s.pointer !== null) return;
      const idle = Date.now() - s.lastActive;
      if (idle > HINT_MS && !s.hinted) { s.hinted = true; cb.current.onHint(); }
      if (idle > AUTO_MS && s.w) {
        paint(s.w * (0.3 + Math.random() * 0.4), s.h * (0.25 + Math.random() * 0.35));
        setProgress(s.progress + 0.08);
      }
    }, 400);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent) => {
    const s = st.current;
    if (s.done || s.pointer !== null) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    s.pointer = e.pointerId;
    const p = local(e);
    s.last = p;
    s.lastActive = Date.now();
    setTouched(true);
    moveTool(p.x, p.y);
    paint(p.x, p.y);
    cb.current.onStart();
  };
  const onMove = (e: React.PointerEvent) => {
    const s = st.current;
    if (e.pointerId !== s.pointer || s.done) return;
    const p = local(e);
    const last = s.last || p;
    const d = Math.hypot(p.x - last.x, p.y - last.y);
    s.travel += d;
    // paint along the stroke, about every 18px, so fast strokes leave no gaps
    const step = 18;
    while (s.travel >= step) {
      s.travel -= step;
      const t = 1 - s.travel / Math.max(d, 1);
      paint(last.x + (p.x - last.x) * t, last.y + (p.y - last.y) * t);
    }
    moveTool(p.x, p.y);
    spawnFx(p.x, p.y);
    s.last = p;
    s.lastActive = Date.now();
    if (s.w) setProgress(s.progress + d / (s.w * RUB_LENGTH));
  };
  const onUp = (e: React.PointerEvent) => {
    const s = st.current;
    if (e.pointerId !== s.pointer) return;
    s.pointer = null;
    s.last = null;
    s.lastActive = Date.now();
    if (!s.done) cb.current.onStop();
  };

  return (
    <div ref={wrapRef} className="shw-rub">
      <canvas
        ref={canvasRef}
        className="shw-rub-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      <div ref={toolRef} className={`shw-rub-tool${touched ? '' : ' resting'}`} aria-hidden>
        <img src={tool} alt="" draggable={false} />
      </div>
      {!touched && <div className="shw-rub-hand" aria-hidden>👆</div>}
      <div className="shw-rub-meter" aria-hidden><div ref={meterRef} /></div>
    </div>
  );
}
