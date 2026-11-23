/**
 * חדר האתגרים - executive-function challenges on four big fingerprint pads.
 * Screens: home (a card per challenge) -> intro (rule + demo) -> play -> end.
 * Adults (canEdit) get the panel behind the gear: levels, settings, history, CSV.
 * Every finished round is saved to kidGameRounds (gamesApi.saveRound).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gamesApi } from '../../api/client';
import type { GameComponentProps } from '../../types';
import { Runner, allOff, COLORS } from './engine';
import type { Overlay, PodId, PodView, RoundResult, ColorId, RuleChip, Challenge } from './engine';
import { CHALLENGES, challengeById, effectiveSettings, settingsKey } from './challenges';
import type { ChallengeDef } from './challenges';
import { readCr, writeCr } from './config';
import type { CrConfig } from './config';
import { useChallengeSound } from './sound';
import AdultPanel from './AdultPanel';
import { Banner, FitText, PaintButton, IconButton, Stars, Card, Panel, Chip, StarsBadge } from './ui';
import './challenge-room.css';

const ART = Object.fromEntries(
  Object.entries(import.meta.glob('./art/*.{webp,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
    .map(([p, u]) => [p.replace('./art/', '').replace(/\.(webp|png)$/, ''), u])
) as Record<string, string>;

const GAME_ID = 'challenge-room';
const EMPTY_OV: Overlay = { status: null, rules: null, banner: null, actions: [] };
type Screen = 'home' | 'intro' | 'play' | 'end' | 'panel';

interface EndInfo { def: ChallengeDef; level: number; result: RoundResult; summary: Record<string, unknown>; suggest: number | null; saved: boolean | null; record: boolean; stars: number }

export default function ChallengeRoom({ config, state, canEdit, onSaveState, onSaveConfig, onExit, kid }: GameComponentProps) {
  const qc = useQueryClient();
  const cr = useMemo(() => readCr(config), [config]);
  const soundOn = config.sound !== false;
  const voiceOn = config.voice !== false;
  const gender: 'm' | 'f' = kid?.gender === 'girl' ? 'f' : 'm';
  const firstName = (kid?.name || '').trim().split(/\s+/)[0] || '';
  const snd = useChallengeSound(soundOn, voiceOn, gender);

  const [screen, setScreen] = useState<Screen>('home');
  const [current, setCurrent] = useState<ChallengeDef>(CHALLENGES[0]);
  const [pods, setPods] = useState<PodView[]>(allOff());
  const [flash, setFlash] = useState<Record<number, ColorId | null>>({});
  const [ov, setOv] = useState<Overlay>(EMPTY_OV);
  const [stars, setStars] = useState(0);
  const [paused, setPaused] = useState<null | 'adult' | 'focus'>(null);
  const [demo, setDemo] = useState(false);
  const [hand, setHand] = useState<{ pod: number; kind: 'tap' | 'stop' } | null>(null);
  const [end, setEnd] = useState<EndInfo | null>(null);
  const [hintFlash, setHintFlash] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [ready, setReady] = useState(false);
  /** feedback ON the pads themselves: the fingerprint glows green (right) or red (wrong) */
  const [fb, setFb] = useState<{ id: number; pods: number[]; kind: 'yes' | 'no' } | null>(null);
  const fbId = useRef(0);
  const crCount = useRef(0);
  const [bursts, setBursts] = useState<{ id: number; pod: number; kind: 'good' | 'stop'; streak: number }[]>([]);
  const [winPod, setWinPod] = useState<number>(-1);
  const [starBump, setStarBump] = useState(0);
  const lastLit = useRef<{ pod: number; t: number }>({ pod: -1, t: 0 });
  const streakRef = useRef(0);
  const burstId = useRef(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const runnerRef = useRef<Runner | null>(null);
  const chRef = useRef<Challenge | null>(null);
  const rafRef = useRef(0);
  const keysDown = useRef<Set<string>>(new Set());
  const pointers = useRef<Set<number>>(new Set());
  const botRef = useRef<{ pod: number; at: number } | null>(null);
  const crRef = useRef(cr);
  crRef.current = cr;

  const roundsQuery = useQuery({
    queryKey: ['game-rounds', kid?.id, GAME_ID],
    queryFn: () => gamesApi.getRounds(kid!.id, GAME_ID),
    enabled: !!kid?.id && canEdit,
  });
  const rounds = roundsQuery.data?.data || [];

  // show the game only when its pictures are decoded - no flash of a half-drawn screen
  useEffect(() => {
    let done = false;
    const finish = () => { if (!done) { done = true; setReady(true); } };
    const t = window.setTimeout(finish, 2500);
    Promise.all(Object.values(ART).map((u) => new Promise<void>((res) => {
      const img = new Image();
      img.onload = () => { if (img.decode) img.decode().then(() => res(), () => res()); else res(); };
      img.onerror = () => res();
      img.src = u;
    }))).then(finish);
    return () => window.clearTimeout(t);
  }, []);

  // true full screen: portal into <body>, drop the app's padding
  useEffect(() => {
    document.body.classList.add('cr-open');
    return () => document.body.classList.remove('cr-open');
  }, []);
  useEffect(() => {
    const f = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);

  const levelOf = useCallback((id: string) => {
    const def = challengeById(id)!;
    return Math.max(1, Math.min(def.levels.length, crRef.current.levels[id] || 1));
  }, []);

  const saveCr = useCallback((next: CrConfig) => onSaveConfig(writeCr(config, next)), [config, onSaveConfig]);

  /** confetti bursts across the screen (end of a round) */
  const celebrate = useCallback(() => {
    [0, 1, 2, 3].forEach((pod, k) => window.setTimeout(() => {
      const id = ++burstId.current;
      setBursts((b) => [...b.slice(-6), { id, pod, kind: 'good', streak: 0 }]);
      window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1100);
    }, k * 180));
  }, []);

  // ---------------- the round loop ----------------
  const stopLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const finishRound = useCallback((def: ChallengeDef, level: number, settings: Record<string, unknown>, r: RoundResult, wasDemo: boolean) => {
    stopLoop();
    setOv(EMPTY_OV);
    setHand(null);
    if (wasDemo) {
      setDemo(false);
      if (!crRef.current.seenDemo.includes(def.id)) saveCr({ ...crRef.current, seenDemo: [...crRef.current.seenDemo, def.id] });
      setScreen('intro');
      return;
    }
    const s = settings as Record<string, string | number | boolean | null>;
    const summary = def.summarize(r.trials, s);
    const key = settingsKey(level, s);
    const valid = !r.focusLost;
    const roundStars = r.stoppedEarly ? 0 : def.score(summary, s);
    const info: EndInfo = { def, level, result: r, summary, suggest: null, saved: null, record: false, stars: roundStars };
    // a level-up suggestion: this round and the previous one with the same conditions passed
    const prev = rounds.find((x) => x.challenge === def.id && x.settingsKey === key && x.valid !== false && !x.stoppedEarly);
    if (canEdit && valid && !r.stoppedEarly && def.passed(summary) && prev && def.passed(prev.summary as typeof summary) && level < def.levels.length) {
      info.suggest = level + 1;
    }
    setEnd(info);
    setScreen('end');
    if (!r.stoppedEarly) window.setTimeout(() => celebrate(), 250);
    if (!r.stoppedEarly) { snd.play('end'); window.setTimeout(() => snd.say('end'), 900); }
    // lifetime stars + the best sequence, kept in play state
    const prevStats = (state as unknown as { stats?: { stars?: number; rounds?: number; bestSpan?: number; best?: Record<string, number> } }).stats || {};
    const bestMap = { ...(prevStats.best || {}), [def.id]: Math.max((prevStats.best || {})[def.id] || 0, roundStars) };
    const span = def.id === 'sequence' ? Number(summary.span) || 0 : 0;
    const bestSpan = Math.max(prevStats.bestSpan || 0, span);
    if (def.id === 'sequence' && span > (prevStats.bestSpan || 0) && (prevStats.bestSpan || 0) > 0) info.record = true;
    onSaveState({ stats: { stars: (prevStats.stars || 0) + roundStars, rounds: (prevStats.rounds || 0) + 1, bestSpan, best: bestMap } } as never);
    if (kid?.id && r.trials.length) {
      gamesApi.saveRound(kid.id, GAME_ID, {
        challenge: def.id,
        challengeName: def.name,
        level,
        levelName: def.levels[level - 1]?.name || '',
        settingsKey: key,
        startedAt: r.startedAt,
        durationMs: r.durationMs,
        stars: r.stars,
        hints: r.hints,
        pauses: r.pauses,
        focusLost: r.focusLost,
        stoppedEarly: r.stoppedEarly,
        valid,
        settings: s,
        summary,
        trials: r.trials,
      }).then((res) => {
        setEnd((e) => (e && e.result === r ? { ...e, saved: res.success } : e));
        qc.invalidateQueries({ queryKey: ['game-rounds', kid.id, GAME_ID] });
      });
    }
  }, [stopLoop, saveCr, rounds, canEdit, snd, state, onSaveState, kid?.id, qc, celebrate]);

  const startRound = useCallback((def: ChallengeDef, asDemo: boolean) => {
    stopLoop();
    snd.stopVoice();
    const level = levelOf(def.id);
    const best = ((state as unknown as { stats?: { bestSpan?: number } }).stats || {}).bestSpan || 0;
    const settings = asDemo ? { ...effectiveSettings(def, level, crRef.current.overrides[def.id]), ...def.demo } : { ...effectiveSettings(def, level, crRef.current.overrides[def.id]), best };
    const ch = def.make();
    chRef.current = ch;
    setPods(allOff()); setOv(EMPTY_OV); setStars(0); setPaused(null); setFlash({}); setHand(null); setFb(null);
    crCount.current = 0;
    setDemo(asDemo);
    setEnd(null);
    botRef.current = null;
    const runner = new Runner(ch, settings, {
      onPods: (p) => {
        const i = p.findIndex((x) => x.mode === 'lit');
        if (i >= 0) lastLit.current = { pod: i, t: performance.now() };
        setPods(p);
      },
      onOverlay: (o) => setOv({ ...o }),
      onSfx: (n) => {
        // each success in a row sounds a little higher - a streak you can hear
        if (n === 'good') snd.play(n, 1 + Math.min(8, Math.max(0, streakRef.current - 1)) * 0.045);
        else snd.play(n);
      },
      onSuccess: (kind, streak) => {
        streakRef.current = streak;
        const recent = performance.now() - lastLit.current.t < 2500;
        const pod = kind === 'good' && !recent ? -1 : lastLit.current.pod;
        const id = ++burstId.current;
        setBursts((b) => [...b.slice(-4), { id, pod, kind, streak }]);
        window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1100);
        if (pod >= 0) { setWinPod(pod); window.setTimeout(() => setWinPod((w) => (w === pod ? -1 : w)), 450); }
        // a whole sequence right = all four glow green; otherwise the pad that was right
        const glow = def.id === 'sequence' || pod < 0 ? [0, 1, 2, 3] : [pod];
        const fid = ++fbId.current;
        setFb({ id: fid, pods: glow, kind: 'yes' });
        window.setTimeout(() => setFb((f) => (f && f.id === fid ? null : f)), 650);
        if (kind === 'stop') {
          crCount.current++;
          if (crCount.current === 1 || crCount.current % 4 === 0) window.setTimeout(() => snd.say('great-wait'), 350);
        }
      },
      onMiss: (kind, pod, count) => {
        const fid = ++fbId.current;
        setFb({ id: fid, pods: pod === null ? [0, 1, 2, 3] : [pod], kind: 'no' });
        window.setTimeout(() => setFb((f) => (f && f.id === fid ? null : f)), 750);
        // the first misses of a round are said in words - then only seen and heard
        if (count <= 3) window.setTimeout(() => snd.say(kind === 'wait' ? 'oops-wait' : 'oops'), 250);
      },
      onSay: (id, cb) => snd.say(id, cb),
      onStar: (n) => { setStars(n); setStarBump((x) => x + 1); },
      onFlash: (i, c, ms) => {
        setFlash((f) => ({ ...f, [i]: c }));
        window.setTimeout(() => setFlash((f) => { const g = { ...f }; delete g[i]; return g; }), ms);
      },
      onFinish: (r) => finishRound(def, level, settings, r, asDemo),
    }, { demo: asDemo, starsEvery: crRef.current.starsEvery, voicePraise: crRef.current.voicePraise, errorSound: crRef.current.errorSound });
    runnerRef.current = runner;
    setScreen('play');
    const go = () => {
      runner.start();
      let last = performance.now();
      const loop = (ts: number) => {
        const dt = Math.min(100, Math.max(0, ts - last));
        last = ts;
        runner.advance(dt);
        if (runner.demo && !runner.isFinished && !runner.paused) runBot(runner);
        if (!runner.isFinished) rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    };
    if (asDemo) go();
    else { snd.play('start'); snd.say('ready', () => window.setTimeout(go, 300)); }
  }, [stopLoop, snd, levelOf, finishRound, state]);

  // the demo's hand: presses the right pod ~0.8s after it is due, shows a stop hand on no-go
  const runBot = (runner: Runner) => {
    const ch = chRef.current;
    if (!ch?.demoAnswer) return;
    const a = ch.demoAnswer();
    const now = runner.now();
    if (a === null || a === undefined) {
      botRef.current = null;
      const litIdx = podsRef.current.findIndex((p) => p.mode === 'lit');
      setHand((h) => (litIdx >= 0 ? { pod: litIdx, kind: 'stop' } : h && h.kind === 'stop' ? null : h));
      return;
    }
    if (!botRef.current || botRef.current.pod !== a) {
      botRef.current = { pod: a, at: now + 600 };
      setHand({ pod: a, kind: 'tap' });
    } else if (now >= botRef.current.at) {
      botRef.current = null;
      runner.press(a as PodId);
      window.setTimeout(() => setHand((h) => (h && h.kind === 'tap' && h.pod === a ? null : h)), 380);
    }
  };
  const podsRef = useRef(pods);
  podsRef.current = pods;

  useEffect(() => () => stopLoop(), [stopLoop]);

  // ---------------- input ----------------
  const press = useCallback((pod: PodId | null, ev?: { timeStamp: number }) => {
    snd.unlock();
    const r = runnerRef.current;
    if (!r || screen !== 'play' || r.demo) return;
    const lag = ev ? Math.max(0, performance.now() - ev.timeStamp) : 0;
    r.press(pod, lag > 1000 ? 0 : lag);
  }, [snd, screen]);

  const pause = useCallback((reason: 'adult' | 'focus') => {
    const r = runnerRef.current;
    if (!r || r.isFinished || r.paused) return;
    r.pause(reason);
    if (!r.paused) return; // not started yet (the "ready" line) - nothing to pause
    snd.stopVoice();
    setOv((o) => ({ ...o, status: null, banner: null, actions: [] }));
    setHand(null);
    setPaused(reason);
  }, [snd]);

  const resume = useCallback(() => {
    const r = runnerRef.current;
    snd.unlock();
    if (!r) return;
    setPaused(null);
    r.resume();
  }, [snd]);

  useEffect(() => {
    if (screen !== 'play') return;
    const down = (e: KeyboardEvent) => {
      const code = e.code;
      const map: Record<string, PodId> = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };
      if (code === 'Escape' || code === 'KeyP') { e.preventDefault(); if (runnerRef.current?.paused) resume(); else pause('adult'); return; }
      if (!(code in map) && code !== 'Space') return;
      e.preventDefault();
      if (e.repeat || keysDown.current.has(code)) return; // held keys never repeat
      keysDown.current.add(code);
      press(code === 'Space' ? null : map[code], e);
    };
    const up = (e: KeyboardEvent) => { keysDown.current.delete(e.code); };
    const blur = () => { keysDown.current.clear(); pointers.current.clear(); if (!runnerRef.current?.demo) pause('focus'); };
    const vis = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [screen, press, pause, resume]);

  const onPodDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    // a whole palm on a tablet: only the first finger counts until it lifts
    if (pointers.current.size > 0) return;
    pointers.current.add(e.pointerId);
    press(i as PodId, e);
  };
  const onPodUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); };

  // ---------------- navigation ----------------
  const openChallenge = (def: ChallengeDef) => {
    snd.unlock();
    setCurrent(def);
    setScreen('intro');
  };
  /** the explanation: say how it works, then the demo hand plays a short round */
  const explain = () => {
    snd.unlock();
    const lines = current.howto(effectiveSettings(current, levelOf(current.id), cr.overrides[current.id]));
    const step = (k: number) => { if (k < lines.length) snd.say(lines[k], () => step(k + 1)); else startRound(current, true); };
    step(0);
  };
  // intro: say how to play
  useEffect(() => {
    if (screen !== 'intro') return;
    const t = window.setTimeout(() => snd.say('explain-q'), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, current]);

  useEffect(() => {
    if (screen === 'home' && ready) {
      const t = window.setTimeout(() => snd.say('intro'), 400);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, ready]);

  // a soft whoosh when a new screen comes in
  useEffect(() => { if (ready && screen !== 'play') snd.play('whoosh'); }, [screen, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const goHome = () => { stopLoop(); snd.stopVoice(); runnerRef.current = null; setPaused(null); setScreen('home'); };
  const toggleFull = () => {
    snd.unlock();
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.().catch(() => {});
  };
  const toggleSound = () => onSaveConfig({ ...config, sound: !soundOn });

  // test hook
  useEffect(() => {
    (window as unknown as Record<string, unknown>).CHALLENGE_ROOM = {
      screen, current: current.id, pods, overlay: ov, stars, paused, demo, end: end ? { summary: end.summary, saved: end.saved, suggest: end.suggest, trials: end.result.trials } : null,
      runner: runnerRef.current,
      ff: (ms: number) => { const r = runnerRef.current; if (r) for (let k = 0; k < ms / 10; k++) r.advance(10); },
    };
  });

  const stats = ((state as unknown as { stats?: { stars?: number; best?: Record<string, number> } }).stats) || {};
  const bestStars = (id: string) => Math.min(3, (stats.best || {})[id] || 0);
  const totalStars = stats.stars || 0;

  // ---------------- render ----------------
  const ruleChip = (c: RuleChip, big = false) => (
    <span key={c.color} className={`cr-rule${big ? ' is-big' : ''}`}>
      <i className="cr-rule-dot" style={{ background: COLORS[c.color].hex }} />
      {ART[c.press ? 'hand' : 'stop-hand'] ? <img src={ART[c.press ? 'hand' : 'stop-hand']} alt="" /> : <b>{c.press ? '👆' : '✋'}</b>}
      {big && <span>{c.press ? 'לוחצים' : 'לא לוחצים'}</span>}
    </span>
  );

  const ruleRow = (c: RuleChip) => (
    <Chip key={c.color}>
      <span className="cr-mini-pad" style={{ '--c': COLORS[c.color].hex } as React.CSSProperties}>
        {ART.pad && <img src={ART.pad} alt="" />}
        <i className="cr-mini-fill" />
        {ART['pad-ridges'] && <i className="cr-mini-print" style={{ WebkitMaskImage: `url(${ART['pad-ridges']})`, maskImage: `url(${ART['pad-ridges']})` }} />}
      </span>
      {ART[c.press ? 'hand-up' : 'stop-hand'] && <img className="cr-mini-hand" src={ART[c.press ? 'hand-up' : 'stop-hand']} alt="" />}
      <span className="cr-chip-text"><FitText max={21} min={11}>{c.press ? 'לוחצים' : 'לא לוחצים'}</FitText></span>
    </Chip>
  );

  const topBar = (
    <div className="cr-top">
      {screen === 'play'
        ? <IconButton name="pause" label="עצירה" fallback="⏸" onClick={() => pause('adult')} />
        : <IconButton name="back" label={screen === 'home' ? 'יציאה' : 'חזרה'} fallback="→" onClick={() => (screen === 'home' ? onExit() : goHome())} />}
      <div className="cr-top-mid">
        {screen === 'home' && <StarsBadge n={totalStars} />}
        {screen === 'play' && ov.rules && ov.rules.map((c) => ruleChip(c))}
        {screen === 'play' && ov.progress && (
          <div className="cr-prog" aria-label={`${ov.progress.now} מתוך ${ov.progress.max}`}>
            {Array.from({ length: ov.progress.max }).map((_, k) => <i key={k} className={k < ov.progress!.now ? 'on' : ''} />)}
          </div>
        )}
      </div>
      <div className="cr-top-end">
        {screen === 'play' && !demo && <span key={starBump} className={`cr-stars${starBump ? ' is-bump' : ''}`} aria-label={`${stars} כוכבים`}>⭐ {stars}</span>}
        {screen === 'play' && !demo && (
          <button
            type="button"
            className={`cr-icon-btn cr-hint${hintFlash ? ' is-on' : ''}`}
            title="תיווך: לחיצה ארוכה מסמנת שהניסיון הנוכחי היה עם עזרה"
            onPointerDown={(e) => {
              const t = window.setTimeout(() => { runnerRef.current?.armHint(); setHintFlash(true); window.setTimeout(() => setHintFlash(false), 900); }, 600);
              const clear = () => { window.clearTimeout(t); e.currentTarget?.removeEventListener('pointerup', clear); };
              e.currentTarget.addEventListener('pointerup', clear, { once: true });
              e.currentTarget.addEventListener('pointerleave', clear, { once: true });
            }}
          >תיווך</button>
        )}
        {screen !== 'play' && <IconButton name="full" label={isFull ? 'יציאה ממסך מלא' : 'מסך מלא'} fallback="⛶" onClick={toggleFull} />}
        {screen !== 'play' && <IconButton name={soundOn ? 'sound' : 'mute'} label="צלילים" fallback={soundOn ? '🔊' : '🔇'} onClick={toggleSound} />}
        {screen === 'home' && canEdit && <IconButton name="settings" label="הגדרות" fallback="⚙️" onClick={() => setScreen('panel')} />}
      </div>
    </div>
  );

  const padGrid = (
    <div className="cr-grid">
      {[0, 1, 2, 3].map((i) => {
        const p = pods[i];
        const f = fb && fb.pods.includes(i) ? fb.kind : null;
        const lit = p.mode === 'lit' || flash[i] !== undefined || !!f;
        const c = (f === 'yes' ? 'green' : f === 'no' ? 'red' : flash[i] ?? p.color) as ColorId | null;
        return (
          <div key={i} className="cr-cell">
            <span className={`cr-num at-${i}`}>{i + 1}</span>
            <button
              type="button"
              className={`cr-pad${lit ? ' is-lit' : ''}${p.mode === 'base' ? ' is-base' : ''}${flash[i] !== undefined ? ' is-flash' : ''}${winPod === i ? ' is-win' : ''}${f ? ` is-fb-${f}` : ''}`}
              style={{ '--c': c ? COLORS[c].hex : 'transparent' } as React.CSSProperties}
              onPointerDown={onPodDown(i)}
              onPointerUp={onPodUp}
              onPointerCancel={onPodUp}
              aria-label={`פד ${i + 1}`}
            >
              {ART.pad ? <img className="cr-pad-img" src={ART.pad} alt="" draggable={false} /> : <span className="cr-pad-fallback" />}
              <span className="cr-pad-fill" />
              <span className="cr-pad-print" style={ART['pad-ridges'] ? { WebkitMaskImage: `url(${ART['pad-ridges']})`, maskImage: `url(${ART['pad-ridges']})` } : undefined} />
            </button>
            {hand && hand.pod === i && (
              <img className={`cr-hand is-${hand.kind}`} src={ART[hand.kind === 'tap' ? 'hand-up' : 'stop-hand']} alt="" />
            )}
          </div>
        );
      })}
      {ov.status && <div className="cr-status"><span>{ov.status.icon}</span>{ov.status.text}</div>}
      {ov.actions.length > 0 && (
        <div className="cr-actions">
          {ov.actions.map((a) => <button key={a.id} type="button" className="cr-btn cr-btn-soft" onClick={() => { snd.unlock(); runnerRef.current?.action(a.id); }}>{a.label}</button>)}
        </div>
      )}
      {ov.banner && (
        <div className="cr-banner">
          <Panel amber={ov.banner.title !== 'הכלל'}>
            <div className="cr-panel-head">
              {ov.banner.title !== 'הכלל' && <span className="cr-swap-icon" aria-hidden>🔄</span>}
              <Banner text={ov.banner.title} />
            </div>
            {ov.banner.rules && <div className="cr-banner-rules">{ov.banner.rules.map((c) => ruleRow(c))}</div>}
          </Panel>
        </div>
      )}
      {demo && <div className="cr-demo-tag">הדגמה</div>}
    </div>
  );

  let body: React.ReactNode = null;
  if (screen === 'home') {
    body = (
      <div className="cr-home">
        <div className="cr-title">
          {ART.title ? <img src={ART.title} alt="חדר האתגרים" /> : <h1>חדר האתגרים</h1>}
          {firstName && <div className="cr-title-name"><Banner text={`של ${firstName}`} max={26} /></div>}
        </div>
        <ul className="cr-cards">
          {CHALLENGES.map((def) => (
            <li key={def.id}>
              <Card color={def.color} icon={ART[def.icon]} name={def.name} stars={bestStars(def.id)} onClick={() => openChallenge(def)}
                sub={canEdit ? <span className="cr-card-level">רמה {levelOf(def.id)}</span> : undefined} />
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (screen === 'intro') {
    const s = effectiveSettings(current, levelOf(current.id), cr.overrides[current.id]);
    const goC = (s.goColor as ColorId) || 'green';
    const nogoC = (s.nogoColor as ColorId) || 'red';
    body = (
      <div className="cr-intro">
        <div className="cr-intro-card"><Card big color={current.color} icon={ART[current.icon]} name={current.name} stars={bestStars(current.id)} /></div>
        {current.id === 'gonogo' && <div className="cr-intro-rules">{ruleRow({ color: nogoC, press: false })}{ruleRow({ color: goC, press: true })}</div>}
        {current.id === 'switch' && <div className="cr-intro-rules">{ruleRow({ color: 'red', press: false })}{ruleRow({ color: 'green', press: true })}</div>}
        {canEdit && current.levels.length > 1 && (
          <div className="cr-levels" role="radiogroup" aria-label="רמה">
            {current.levels.map((lv, k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={levelOf(current.id) === k + 1}
                className={`cr-level${levelOf(current.id) === k + 1 ? ' is-on' : ''}`}
                title={lv.name}
                onClick={() => saveCr({ ...cr, levels: { ...cr.levels, [current.id]: k + 1 }, overrides: { ...cr.overrides, [current.id]: {} } })}
              >{k + 1}</button>
            ))}
            <span className="cr-level-name">{current.levels[levelOf(current.id) - 1].name}</span>
          </div>
        )}
        <p className="cr-ask"><span aria-hidden>✦</span> רוצה לראות הסבר? <span aria-hidden>✦</span></p>
        <div className="cr-choice">
          <PaintButton kind="green" className="is-play" onClick={() => { snd.unlock(); startRound(current, false); }}
            icon={<span className="cr-play-tri" aria-hidden />}>לא, לשחק!</PaintButton>
          <PaintButton kind="cream" className="is-explain" onClick={explain}
            icon={ART['q-explain'] ? <img src={ART['q-explain']} alt="" /> : <span>💡</span>}>כן, להסביר</PaintButton>
        </div>
      </div>
    );
  } else if (screen === 'play') {
    body = padGrid;
  } else if (screen === 'end' && end) {
    const sum = end.summary as Record<string, string | number | boolean | null>;
    const title = end.result.stoppedEarly ? 'עצרנו כאן' : end.record ? 'שיא חדש!' : end.stars >= 3 ? 'מושלם!' : 'כל הכבוד!';
    body = (
      <div className="cr-end">
        {!end.result.stoppedEarly && ART.trophy && <img className="cr-trophy" src={ART.trophy} alt="" />}
        {!end.result.stoppedEarly && <Stars n={end.stars} className="is-end" />}
        <div className="cr-end-banner"><Banner big text={title} /></div>
        {end.def.id === 'sequence' && !end.result.stoppedEarly && <p className="cr-end-span">זכרת רצף של <b>{String(sum.span)}</b> אורות</p>}
        <div className="cr-end-btns">
          <PaintButton kind="green" onClick={() => startRound(end.def, false)} icon={<span aria-hidden>↻</span>}>שוב</PaintButton>
          <PaintButton kind="cream" onClick={goHome}>לכל האתגרים</PaintButton>
        </div>
        {canEdit && (
          <Panel className="cr-end-adult">
            <div className="cr-end-head">
              <b>למבוגר · {end.def.name} · רמה {end.level}</b>
              {end.result.focusLost && <span className="cr-flag is-bad">סבב לא תקין (החלון איבד פוקוס)</span>}
              {end.result.stoppedEarly && <span className="cr-flag">נעצר מוקדם</span>}
              {end.result.hints > 0 && <span className="cr-flag">תיווך: {end.result.hints}</span>}
              <span className="cr-saved">{end.saved === null ? 'שומר…' : end.saved ? '✓ נשמר' : 'לא נשמר'}</span>
            </div>
            <dl className="cr-metrics">
              {end.def.metrics.map((m) => (
                <div key={m.key}><dt>{m.label}</dt><dd>{sum[m.key] === null || sum[m.key] === undefined ? '—' : `${sum[m.key]}${m.unit === '%' ? '%' : m.unit ? ` ${m.unit}` : ''}`}</dd></div>
              ))}
            </dl>
            {end.suggest && (
              <div className="cr-suggest">
                שני סבבים רצופים עברו את הרף באותם תנאים.
                <button type="button" className="cr-btn cr-btn-soft" onClick={() => { saveCr({ ...cr, levels: { ...cr.levels, [end.def.id]: end.suggest! }, overrides: { ...cr.overrides, [end.def.id]: {} } }); setEnd({ ...end, suggest: null }); }}>
                  להעלות לרמה {end.suggest}
                </button>
              </div>
            )}
          </Panel>
        )}
      </div>
    );
  } else if (screen === 'panel') {
    body = <AdultPanel cr={cr} rounds={rounds} kidName={kid?.name || ''} soundOn={soundOn} voiceOn={voiceOn}
      onSave={(next, extra) => onSaveConfig({ ...writeCr(config, next), ...(extra || {}) })}
      onClose={() => setScreen('home')} />;
  }

  const bg = ART.bg ? `url(${ART.bg})` : undefined;
  const bgTall = ART['bg-tall'] ? `url(${ART['bg-tall']})` : bg;
  const game = (
    <div ref={rootRef} className={`cr is-${screen}${ready ? ' is-ready' : ''}`} dir="rtl" style={{ '--bg': bg, '--bg-tall': bgTall, '--btn-main': ART['btn-main'] ? `url(${ART['btn-main']})` : undefined, '--btn-soft': ART['btn-soft'] ? `url(${ART['btn-soft']})` : undefined } as React.CSSProperties}
      onPointerDown={() => snd.unlock()}>
      <div className="cr-phone">
      {screen !== 'panel' && topBar}
      <div key={screen} className="cr-body cr-enter">{body}</div>
      {paused && (
        <div className="cr-pause">
          <Panel className="cr-pause-card">
            <div className="cr-panel-head"><Banner text="עצרנו" /></div>
            {paused === 'focus' && <p>המשחק נעצר כי החלון יצא מהמסך. הסבב יסומן כלא תקין למדידה.</p>}
            <PaintButton kind="green" onClick={resume}>ממשיכים</PaintButton>
            <PaintButton kind="cream" className="is-stop" onClick={() => { setPaused(null); runnerRef.current?.stopEarly(); }}>סיום הסבב</PaintButton>
          </Panel>
        </div>
      )}
      <div className={`cr-fx${screen === 'play' ? ' is-grid' : ''}`}>
      {bursts.map((b) => (
        <div key={b.id} className={`cr-burst is-${b.kind} at-${b.pod}`}>
          {screen !== 'play' && Array.from({ length: 16 }).map((_, k) => (
            <i key={k} className="cr-burst-bit" style={{ '--a': `${k * 22.5 + (b.id % 3) * 8}deg`, '--d': `${80 + (k % 4) * 26}px`, '--h': `${(k * 47 + b.id * 31) % 360}` } as React.CSSProperties} />
          ))}
          {b.streak >= 3 && <b className="cr-burst-streak">×{b.streak}</b>}
        </div>
      ))}
      </div>
      {snd.caption && screen !== 'panel' && screen !== 'intro' && <div className="cr-caption">{snd.caption}</div>}
      </div>
      <div className="cr-rotate" aria-live="polite"><span>📱</span>מחזיקים את הטלפון לגובה</div>
    </div>
  );
  return createPortal(game, document.body);
}
