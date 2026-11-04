import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameComponentProps, GameConfigValues } from '../types';
import { getGame, sceneClass } from './registry';
import { useGameSound } from './useGameSound';
import GameSettingsSheet from './GameSettingsSheet';
import './lego-tower.css';

const PALETTE = [
  { c: '#E3262B', light: '#FF5E5E', dark: '#A81419' },
  { c: '#F58220', light: '#FFA855', dark: '#B45A09' },
  { c: '#F6C21B', light: '#FFDC63', dark: '#BE8E02' },
  { c: '#7AB929', light: '#A7E055', dark: '#528A12' },
  { c: '#1F9A4D', light: '#4FC77B', dark: '#106631' },
  { c: '#1A5FBF', light: '#5090E8', dark: '#0E3C82' },
  { c: '#29A8E0', light: '#67CDF6', dark: '#16749E' },
  { c: '#6B2FA0', light: '#9E64D3', dark: '#48146F' },
  { c: '#E0248A', light: '#FF64B6', dark: '#A00F5F' },
  { c: '#8B5A2B', light: '#B98249', dark: '#5E3A18' },
  { c: '#0E9C93', light: '#48CCC3', dark: '#056B64' },
  { c: '#24357A', light: '#5468A6', dark: '#131F4F' },
];

const HOLD_MS = 700;

function colorVars(i: number): React.CSSProperties {
  const p = PALETTE[(i - 1) % PALETTE.length];
  return { '--c': p.c, '--c-light': p.light, '--c-dark': p.dark } as React.CSSProperties;
}

/**
 * A plain 4-stud LEGO brick. `studs` is false when another brick sits on top —
 * in a real stack the brick above covers the studs below.
 */
function Brick({ studs = true }: { studs?: boolean }) {
  return (
    <div className={`brick${studs ? '' : ' no-studs'}`}>
      <div className="studs">
        <div className="stud" /><div className="stud" /><div className="stud" /><div className="stud" />
      </div>
      <div className="body" />
    </div>
  );
}

export default function LegoTower({
  config, state, onSaveState, onSaveConfig, canEdit, onExit,
}: GameComponentProps) {
  const def = getGame('lego-tower')!;

  const goal = Math.max(3, Math.min(12, Number(config.goal) || 10));
  const title = String(config.title || 'מגדל הלגו');
  const prize = String(config.prize || '');
  const soundOn = config.sound !== false;
  const adultOnly = config.adultOnly === true;

  /* `placed` is always the contiguous run [1..n] — enforced on the way in. */
  const placed = useMemo(() => {
    const sorted = (state.placed || []).filter((n) => n >= 1 && n <= goal).sort((a, b) => a - b);
    const run: number[] = [];
    for (let i = 0; i < sorted.length && sorted[i] === i + 1; i++) run.push(sorted[i]);
    return run;
  }, [state.placed, goal]);

  const tray = useMemo(
    () => (state.tray || [])
      .filter((n) => n >= 1 && n <= goal && !placed.includes(n))
      .sort((a, b) => a - b),
    [state.tray, placed, goal]
  );

  const towersBuilt = state.towersBuilt || 0;
  const complete = placed.length >= goal;
  /** The only storey that may be filled next. */
  const next = placed.length + 1;
  /** The one loose brick in play — the rest just wait as a count. */
  const inHand = tray.includes(next) ? next : null;

  const [showSettings, setShowSettings] = useState(false);
  const [showFinale, setShowFinale] = useState(false);
  const [muted, setMuted] = useState(() => localStorage.getItem('legoTowerMuted') === '1');
  const [dragging, setDragging] = useState(false);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [holding, setHolding] = useState(false);

  const sound = useGameSound(soundOn && !muted);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const exitArmed = useRef(false);
  const wasComplete = useRef(complete);

  /* The app's body has page padding and a gradient; the game owns the screen. */
  useEffect(() => {
    document.body.classList.add('lego-open');
    return () => document.body.classList.remove('lego-open');
  }, []);

  /* ---- sizing: everything derives from the space actually available ---- */
  const fit = useCallback(() => {
    const stage = stageRef.current;
    const root = rootRef.current;
    if (!stage || !root) return;
    // clientHeight includes the padding that keeps the building off the floor
    // and clear of the + button; +2 storeys of headroom for roof and loose brick
    const available = stage.clientHeight - 96;
    const h = Math.max(18, Math.min(56, Math.floor(available / (goal + 2))));
    const towerW = Math.min(320, Math.max(160, window.innerWidth - 24));
    const numW = h < 30 ? 19 : 25;
    root.style.setProperty('--brick-h', `${h}px`);
    root.style.setProperty('--tower-w', `${towerW}px`);
    root.style.setProperty('--num-w', `${numW}px`);
    root.style.setProperty('--slot-w', `${towerW - numW - 6}px`);
  }, [goal]);

  useEffect(() => {
    fit();
    let t: number | undefined;
    const refit = () => { window.clearTimeout(t); t = window.setTimeout(fit, 120); };
    window.addEventListener('resize', refit);
    window.addEventListener('orientationchange', refit);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', refit);
      window.removeEventListener('orientationchange', refit);
    };
  }, [fit]);

  useEffect(() => {
    if (complete && !wasComplete.current) {
      sound.play('done');
      setTimeout(() => setShowFinale(true), 450);
    }
    wasComplete.current = complete;
  }, [complete, sound]);

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  /* -------------------------------- actions -------------------------------- */

  const addBrick = () => {
    const brick = placed.length + tray.length + 1;
    if (brick > goal) return;
    sound.play('add');
    onSaveState({ placed, tray: [...tray, brick].sort((a, b) => a - b), towersBuilt });
  };

  const undo = () => {
    if (tray.length) onSaveState({ placed, tray: tray.slice(0, -1), towersBuilt });
    else if (placed.length) onSaveState({ placed: placed.slice(0, -1), tray, towersBuilt });
  };

  const place = (i: number) => {
    if (i !== next || !tray.includes(i)) return;
    sound.play('snap');
    onSaveState({ placed: [...placed, i], tray: tray.filter((n) => n !== i), towersBuilt });
  };

  const newTower = () => {
    setShowFinale(false);
    onSaveState({ placed: [], tray: [], towersBuilt: towersBuilt + 1 });
  };

  const wobble = (el: Element) => {
    sound.play('nudge');
    el.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' },
       { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }],
      { duration: 240, easing: 'ease-in-out' }
    );
  };

  /* -- the + button. Optionally adult-only: a hold, which a child's tap won't
        trigger, and which needs no PIN or extra screen. -------------------- */
  const addPointerDown = () => {
    sound.unlock();
    if (!adultOnly) return;
    setHolding(true);
    holdTimer.current = window.setTimeout(() => {
      setHolding(false);
      addBrick();
    }, HOLD_MS);
  };
  const addPointerUp = () => {
    if (!adultOnly) return;
    window.clearTimeout(holdTimer.current);
    setHolding(false);
  };
  const addClick = () => { if (!adultOnly) addBrick(); };

  /* ---------------------------------- drag --------------------------------- */

  const onPointerDown = (e: React.PointerEvent) => {
    if (inHand === null) return;
    e.preventDefault();
    sound.unlock();
    setDragging(true);

    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    const moveGhost = (x: number, y: number) => {
      if (ghostRef.current) {
        ghostRef.current.style.left = `${x}px`;
        ghostRef.current.style.top = `${y}px`;
      }
    };
    moveGhost(startX, startY);

    const slotUnder = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      const slot = el ? (el.closest('.lego-slot') as HTMLElement | null) : null;
      return slot && !slot.classList.contains('filled') ? slot : null;
    };

    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) moved = true;
      moveGhost(ev.clientX, ev.clientY);
      const slot = slotUnder(ev.clientX, ev.clientY);
      setOverSlot(slot && Number(slot.dataset.slot) === inHand ? inHand : null);
    };

    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      const slot = slotUnder(ev.clientX, ev.clientY);
      setDragging(false);
      setOverSlot(null);
      if (!moved) { place(inHand); return; }
      if (slot && Number(slot.dataset.slot) === inHand) place(inHand);
      else if (slot) wobble(slot);
    };

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };

  const toggleSound = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    localStorage.setItem('legoTowerMuted', nextMuted ? '1' : '0');
  };

  const handleSaveSettings = (values: GameConfigValues) => {
    const goalChanged = Number(values.goal) !== goal;
    onSaveConfig(values);
    if (goalChanged) {
      const cap = Math.max(3, Math.min(12, Number(values.goal) || 10));
      onSaveState({
        placed: placed.filter((n) => n <= cap),
        tray: tray.filter((n) => n <= cap),
        towersBuilt,
      });
    }
    setShowSettings(false);
  };

  /* --------------------------------- render -------------------------------- */

  const storeys = [];
  for (let i = goal; i >= 1; i--) {
    const isPlaced = placed.includes(i);
    const offer = !isPlaced && i === next && inHand !== null;
    // A brick's studs are covered as soon as the next storey goes on
    const showStuds = !placed.includes(i + 1);
    storeys.push(
      <div key={i} className={`lego-row${isPlaced ? ' filled' : ''}${offer ? ' next' : ''}`}>
        <div className="lego-num">{i}</div>
        <div
          className={`lego-slot ${isPlaced ? 'filled' : 'empty'}${offer ? ' next' : ''}${overSlot === i ? ' over' : ''}`}
          data-slot={i}
          style={colorVars(i)}
          onClick={() => {
            if (isPlaced) return;
            if (i === next && inHand !== null) place(i);
            else if (inHand !== null) {
              const el = document.querySelector(`.lego-slot[data-slot="${i}"]`);
              if (el) wobble(el);
            }
          }}
        >
          <Brick studs={showStuds} />
        </div>
      </div>
    );
  }

  const game = (
    <div ref={rootRef} className={`lego${sceneClass(config.scene)}`}>
      <div className="lego-topbar">
        <button
          className="lego-icon-btn"
          onPointerDown={() => { exitArmed.current = true; }}
          onPointerUp={() => {
            if (!exitArmed.current) return;
            exitArmed.current = false;
            onExit();
          }}
          onPointerLeave={() => { exitArmed.current = false; }}
          onPointerCancel={() => { exitArmed.current = false; }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onExit(); }}
          aria-label="חזרה"
        >
          ✕
        </button>
        <div className="lego-title">{title}</div>
        <div className="lego-counter">
          <span>{placed.length}</span><span className="of">/</span><span className="of">{goal}</span>
        </div>
        <button
          className={`lego-icon-btn${soundOn && !muted ? '' : ' off'}`}
          onClick={toggleSound}
          aria-label="צלילים"
        >
          {soundOn && !muted ? '🔊' : '🔇'}
        </button>
        {canEdit && (
          <button className="lego-icon-btn" onClick={() => setShowSettings(true)} aria-label="הגדרות">
            ⚙️
          </button>
        )}
      </div>

      {/* The whole screen is the building. Everything else hovers over it. */}
      <div className="lego-stage" ref={stageRef}>
        <div className="lego-tower">
          <div className="lego-row lego-roof-row">
            <div className="lego-num" style={{ visibility: 'hidden' }} />
            <div className={`lego-roof${complete ? ' on' : ''}`}>
              <div className="lego-flag">🚩</div>
              <div className="lego-roof-shape" />
            </div>
          </div>
          {storeys}
          <div className="lego-row lego-baseplate-row">
            <div className="lego-num" style={{ visibility: 'hidden' }} />
            <div className="lego-baseplate" />
          </div>
        </div>

        {/* The loose brick, hovering above the building until it's fitted */}
        {inHand !== null && (
          <div
            className={`lego-float${dragging ? ' dragging' : ''}`}
            style={colorVars(inHand)}
            onPointerDown={onPointerDown}
          >
            <Brick />
            <span className="lego-float-hint">גרור אותי</span>
            {tray.length > 1 && <span className="lego-float-count">{tray.length}</span>}
          </div>
        )}

        {prize && (
          <div className="lego-prize-chip">🏆 {prize}</div>
        )}

        <div className="lego-controls">
          <button
            className="lego-undo-fab"
            onClick={undo}
            disabled={!tray.length && !placed.length}
            aria-label="בטל"
          >
            ↶
          </button>
          <button
            className={`lego-add-fab${holding ? ' holding' : ''}`}
            onClick={addClick}
            onPointerDown={addPointerDown}
            onPointerUp={addPointerUp}
            onPointerLeave={addPointerUp}
            onPointerCancel={addPointerUp}
            onContextMenu={(e) => e.preventDefault()}
            disabled={placed.length + tray.length >= goal}
            aria-label="הוסף חתיכה"
          >
            +
          </button>
        </div>
      </div>

      {dragging && inHand !== null && (
        <div className="lego-drag-layer">
          <div ref={ghostRef} className="lego-drag-ghost" style={colorVars(inHand)}>
            <Brick />
          </div>
        </div>
      )}

      {showFinale && (
        <div className="lego-finale">
          <Confetti />
          <div className="lego-finale-card">
            <div className="trophy">🏆</div>
            <div className="lego-finale-stars">⭐️ ⭐️ ⭐️</div>
            <h2>כל הכבוד!</h2>
            <p>בנית את כל הבניין 🎉</p>
            {prize && <div className="lego-finale-prize">🎁 {prize}</div>}
            <button className="lego-finale-btn" onClick={newTower}>מגדל חדש 🧱</button>
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

  // Into <body> so no padded or transformed ancestor can shrink a fixed layout
  return createPortal(game, document.body);
}

const CONFETTI_SHAPES = ['', 'round', 'tall'];

function Confetti() {
  const bits = useMemo(
    () => Array.from({ length: 90 }, (_, i) => ({
      color: PALETTE[i % PALETTE.length].c,
      shape: CONFETTI_SHAPES[i % CONFETTI_SHAPES.length],
      left: Math.random() * 100,
      duration: 2 + Math.random() * 1.8,
      delay: Math.random() * 1.1,
    })),
    []
  );
  return (
    <div className="lego-confetti-layer">
      {bits.map((b, i) => (
        <div
          key={i}
          className={`lego-confetti ${b.shape}`}
          style={{
            background: b.color,
            left: `${b.left}%`,
            top: -20,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
