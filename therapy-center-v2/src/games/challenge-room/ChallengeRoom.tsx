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
import { CHALLENGES, challengeById, effectiveSettings, settingsKey, levelStreak, ROUNDS_TO_LEVEL_UP, PASS_RULE } from './challenges';
import type { ChallengeDef } from './challenges';
import { readCr, writeCr } from './config';
import type { CrConfig } from './config';
import { useChallengeSound } from './sound';
import AdultPanel from './AdultPanel';
import { V2, L, MACHINES, Plate, Stage, Hit, Piece, TrayStars, RulesCard, boxStyle, useMenuFont } from './plate';
import './challenge-room.css';

/** the play screen's own pictures (the menus are the v2 plates - plate.tsx) */
const ART_ALL = Object.fromEntries(
  Object.entries(import.meta.glob(['./art/pad.webp', './art/pad-ridges.png', './art/hand-up.webp', './art/stop-hand.webp'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
    .map(([p, u]) => [p.replace('./art/', '').replace(/\.(webp|png)$/, ''), u])
) as Record<string, string>;
const ART = ART_ALL;
/** decoded before the game shows: the plates, the pieces and the pad */
const PRELOAD = [...Object.values(ART), ...Object.values(V2)];

const EMPTY_OV: Overlay = { status: null, rules: null, banner: null, actions: [] };
type Screen = 'home' | 'intro' | 'play' | 'end' | 'panel';

interface EndInfo { def: ChallengeDef; level: number; result: RoundResult; summary: Record<string, unknown>; suggest: number | null; saved: boolean | null; record: boolean; stars: number;
  /** this round passed the level's bar / passed rounds in a row at this level (with this one) / the level it just went up to */
  passed: boolean; streak: number; levelUp: number | null }

/**
 * The room (all four challenges, a home screen with their machines) - or, with `only`, a game of ONE
 * challenge (games 2 and 3): it opens on that challenge's intro, which then is its menu.
 */
export default function ChallengeRoom({ config, state, canEdit, onSaveState, onSaveConfig, onExit, kid, gameId = 'challenge-room', only }: GameComponentProps & { gameId?: string; only?: string[] }) {
  const GAME_ID = gameId;
  const defs = useMemo(() => (only ? only.map((id) => challengeById(id)!).filter(Boolean) : CHALLENGES), [only]);
  const single = defs.length === 1;
  const qc = useQueryClient();
  const cr = useMemo(() => readCr(config), [config]);
  const soundOn = config.sound !== false;
  const voiceOn = config.voice !== false;
  const gender: 'm' | 'f' = kid?.gender === 'girl' ? 'f' : 'm';
  const firstName = (kid?.name || '').trim().split(/\s+/)[0] || '';
  const snd = useChallengeSound(soundOn, voiceOn, gender);

  const [screen, setScreen] = useState<Screen>(single ? 'intro' : 'home');
  const [current, setCurrent] = useState<ChallengeDef>(defs[0]);
  const [pods, setPods] = useState<PodView[]>(allOff());
  const [flash, setFlash] = useState<Record<number, ColorId | null>>({});
  const [ov, setOv] = useState<Overlay>(EMPTY_OV);
  const [stars, setStars] = useState(0);
  const [paused, setPaused] = useState<null | 'adult' | 'focus'>(null);
  const [demo, setDemo] = useState(false);
  const [hand, setHand] = useState<{ pod: number; kind: 'tap' | 'stop' } | null>(null);
  const [end, setEnd] = useState<EndInfo | null>(null);
  const [details, setDetails] = useState(false);
  const [hintFlash, setHintFlash] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [ready, setReady] = useState(false);
  /** feedback ON the pads themselves: the fingerprint glows green (right) or red (wrong) */
  const [wins, setWins] = useState<{ id: number; pods: number[] }[]>([]);
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
    enabled: !!kid?.id,
  });
  const rounds = roundsQuery.data?.data || [];

  // show the game only when its pictures are decoded - no flash of a half-drawn screen
  useEffect(() => {
    let done = false;
    const finish = () => { if (!done) { done = true; setReady(true); } };
    const t = window.setTimeout(finish, 2500);
    Promise.all(PRELOAD.map((u) => new Promise<void>((res) => {
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
    const passed = valid && !r.stoppedEarly && def.passed(summary);
    const streak = levelStreak(def, level, [{ challenge: def.id, level, valid, stoppedEarly: r.stoppedEarly, summary }, ...rounds]);
    const info: EndInfo = { def, level, result: r, summary, suggest: null, saved: null, record: false, stars: roundStars, passed, streak, levelUp: null };
    // ROUNDS_TO_LEVEL_UP passed rounds in a row at this level -> the next level (by itself, or the adult approves)
    if (passed && streak >= ROUNDS_TO_LEVEL_UP && level < def.levels.length) {
      if (crRef.current.autoLevel) {
        info.levelUp = level + 1;
        saveCr({ ...crRef.current, levels: { ...crRef.current.levels, [def.id]: level + 1 }, overrides: { ...crRef.current.overrides, [def.id]: {} } });
      } else if (canEdit) info.suggest = level + 1;
    }
    setEnd(info);
    setScreen('end');
    setDetails(false);
    if (!r.stoppedEarly) { snd.play('end'); window.setTimeout(() => snd.say('end'), 900); }
    if (info.levelUp) window.setTimeout(() => snd.play('levelup'), 1500);
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
  }, [stopLoop, saveCr, rounds, canEdit, snd, state, onSaveState, kid?.id, qc]);

  const startRound = useCallback((def: ChallengeDef, asDemo: boolean) => {
    stopLoop();
    snd.stopVoice();
    const level = levelOf(def.id);
    const best = ((state as unknown as { stats?: { bestSpan?: number } }).stats || {}).bestSpan || 0;
    const settings = asDemo ? { ...effectiveSettings(def, level, crRef.current.overrides[def.id]), ...def.demo } : { ...effectiveSettings(def, level, crRef.current.overrides[def.id]), best };
    const ch = def.make();
    chRef.current = ch;
    setPods(allOff()); setOv(EMPTY_OV); setStars(0); setPaused(null); setFlash({}); setHand(null); setFb(null); setWins([]); setHintFlash(false);
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
      onSuccess: (kind, streak, at) => {
        streakRef.current = streak;
        const recent = performance.now() - lastLit.current.t < 2500;
        const pod = at !== undefined ? at : kind === 'good' && !recent ? -1 : lastLit.current.pod;
        const id = ++burstId.current;
        setBursts((b) => [...b.slice(-4), { id, pod, kind, streak }]);
        window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1100);
        if (pod >= 0) { setWinPod(pod); window.setTimeout(() => setWinPod((w) => (w === pod ? -1 : w)), 450); }
        // a whole sequence right = all four glow green; otherwise the pad that was right
        const glow = def.id === 'sequence' || pod < 0 ? [0, 1, 2, 3] : [pod];
        const fid = ++fbId.current;
        setFb({ id: fid, pods: glow, kind: 'yes' });
        if (kind === 'good' || kind === 'stop') setWins((w) => [...w.slice(-6), { id: fid, pods: glow }]);
        window.setTimeout(() => setWins((w) => w.filter((x) => x.id !== fid)), 900);
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
    else {
      // start when "ready?" has been said - or after 2.5s at most (another line may cut it off)
      let begun = false;
      const begin = () => { if (begun) return; begun = true; window.setTimeout(go, 300); };
      snd.play('start');
      snd.say('ready', begin);
      window.setTimeout(begin, 2500);
    }
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
    setHintFlash(false);
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
  const askTimer = useRef(0);
  const explain = () => {
    snd.unlock();
    window.clearTimeout(askTimer.current); // the "want to see?" line must not cut the explanation
    const lines = current.howto(effectiveSettings(current, levelOf(current.id), cr.overrides[current.id]));
    const step = (k: number) => { if (k < lines.length) snd.say(lines[k], () => step(k + 1)); else startRound(current, true); };
    step(0);
  };
  // intro: say how to play
  useEffect(() => {
    if (screen !== 'intro') return;
    askTimer.current = window.setTimeout(() => snd.say('explain-q'), 350);
    return () => window.clearTimeout(askTimer.current);
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

  const goHome = () => { stopLoop(); snd.stopVoice(); runnerRef.current = null; setPaused(null); setScreen(single ? 'intro' : 'home'); };
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
      answer: () => chRef.current?.demoAnswer?.() ?? null,
      ff: (ms: number) => { const r = runnerRef.current; if (r) for (let k = 0; k < ms / 10; k++) r.advance(10); },
    };
  });

  const stats = ((state as unknown as { stats?: { stars?: number; best?: Record<string, number> } }).stats) || {};
  const bestStars = (id: string) => Math.min(3, (stats.best || {})[id] || 0);

  // ---------------- render ----------------
  useMenuFont();
  const padOf = (c: ColorId) => V2[`pad-${c}`];

  /** a rule in the play bar: the colour's pad with the press / stop hand */
  const ruleChip = (c: RuleChip) => (
    <span key={c.color} className={`cr-rule2 ${c.press ? 'is-press' : 'is-nogo'}`} aria-label={`${COLORS[c.color].name} ${c.press ? 'לוחצים' : 'לא לוחצים'}`}>
      <img className="cr-rule2-pad" src={padOf(c.color)} alt="" />
      <img className="cr-rule2-hand" src={V2[c.press ? 'hand-press' : 'hand-stop']} alt="" />
    </span>
  );

  const topBar = (
    <div className="cr-top cr-top2">
      <button type="button" className="cr-cbtn" onClick={() => pause('adult')} aria-label="עצירה" title="עצירה"><img src={V2['btn-pause']} alt="" draggable={false} /></button>
      <div className="cr-top-mid">
        {ov.rules && ov.rules.map((c) => ruleChip(c))}
        {ov.progress && (
          <div className="cr-prog" aria-label={`${ov.progress.now} מתוך ${ov.progress.max}`}>
            {Array.from({ length: ov.progress.max }).map((_, k) => <i key={k} className={k < ov.progress!.now ? 'on' : ''} />)}
          </div>
        )}
      </div>
      <div className="cr-top-end">
        {!demo && <span key={starBump} className={`cr-stars cr-stars2${starBump ? ' is-bump' : ''}`} aria-label={`${stars} כוכבים`}><img src={V2['star-full']} alt="" />{stars}</span>}
        <button type="button" className="cr-cbtn" onClick={toggleFull} aria-label={isFull ? 'יציאה ממסך מלא' : 'מסך מלא'} title={isFull ? 'יציאה ממסך מלא' : 'מסך מלא'}><img src={V2['btn-full']} alt="" draggable={false} /></button>
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
              style={{ '--c': c ? COLORS[c].hex : 'transparent', '--base': COLORS[(p.color || 'yellow') as ColorId].hex } as React.CSSProperties}
              className={`cr-pad${lit ? ' is-lit' : ''}${p.mode === 'base' ? ' is-base' : ''}${p.icon === 'house' && lit ? ' is-home-lit' : ''}${flash[i] !== undefined ? ' is-flash' : ''}${winPod === i ? ' is-win' : ''}${f ? ` is-fb-${f}` : ''}`}
              onPointerDown={onPodDown(i)}
              onPointerUp={onPodUp}
              onPointerCancel={onPodUp}
              aria-label={`פד ${i + 1}`}
            >
              {ART.pad ? <img className="cr-pad-img" src={ART.pad} alt="" draggable={false} /> : <span className="cr-pad-fallback" />}
              <span className="cr-pad-fill" />
              <span className="cr-pad-print" style={ART['pad-ridges'] ? { WebkitMaskImage: `url(${ART['pad-ridges']})`, maskImage: `url(${ART['pad-ridges']})` } : undefined} />
              {p.icon === 'house' && <img className="cr-pad-icon" src={V2.house} alt="" draggable={false} />}
              {p.count ? <span key={p.count} className="cr-pad-count">{p.count}</span> : null}
            </button>
            {wins.filter((w) => w.pods.includes(i)).map((w) => (
              <span key={w.id} className="cr-win" aria-hidden>
                <i className="cr-win-glow" />
                <i className="cr-win-ring" />
                {Array.from({ length: 10 }).map((_, k) => (
                  <i key={k} className="cr-win-spark" style={{ '--a': `${k * 36 + (w.id % 5) * 7}deg`, '--d': `${30 + (k % 3) * 9}cqmin` } as React.CSSProperties} />
                ))}
                <i className="cr-win-star">★</i>
              </span>
            ))}
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
      {demo && <div className="cr-demo-tag">הדגמה</div>}
    </div>
  );

  /** the child-facing line under the stars: where the level stands */
  const levelLine = (e: EndInfo) => {
    const max = e.def.levels.length;
    if (e.levelUp) return <b className="cr-lvline">עלית לרמה {e.levelUp}!</b>;
    if (e.result.stoppedEarly) return <span className="cr-lvline">רמה {e.level} · הסבב נעצר באמצע</span>;
    if (e.level >= max) return <span className="cr-lvline">רמה {e.level} · הרמה הכי גבוהה{e.passed ? ' - הצלחת!' : ''}</span>;
    if (e.suggest) return <span className="cr-lvline">רמה {e.level} · מוכן לרמה {e.suggest}</span>;
    const need = ROUNDS_TO_LEVEL_UP - e.streak;
    return <span className="cr-lvline">רמה {e.level} · {e.passed ? (need === 1 ? `עוד סבב מוצלח אחד לרמה ${e.level + 1}` : `עוד ${need} סבבים מוצלחים לרמה ${e.level + 1}`) : `${ROUNDS_TO_LEVEL_UP} סבבים מוצלחים ברצף = רמה ${e.level + 1}`}</span>;
  };

  const detailsSheet = end && details && canEdit ? (() => {
    const sum = end.summary as Record<string, string | number | boolean | null>;
    const lvName = end.def.levels[end.level - 1]?.name || '';
    return (
      <div className="cr-dim cr-sheet-wrap" onClick={() => setDetails(false)}>
        <div className="cr-sheet" role="dialog" aria-label="תוצאות הסבב" onClick={(ev) => ev.stopPropagation()}>
          <div className="cr-sheet-head">
            <h2>{end.def.name}</h2>
            <button type="button" className="cr-sheet-x" onClick={() => setDetails(false)} aria-label="סגירה">✕</button>
          </div>
          <p className="cr-sheet-sub">רמה {end.level} מתוך {end.def.levels.length}: {lvName} · {Math.round(end.result.durationMs / 1000)} שנ׳ · {end.result.trials.length} ניסיונות</p>
          <div className={`cr-verdict ${end.passed ? 'is-pass' : 'is-fail'}`}>
            {end.result.focusLost ? 'הסבב לא תקין למדידה (החלון יצא מהמסך)' : end.result.stoppedEarly ? 'הסבב נעצר מוקדם - לא נספר לרמה' : end.passed ? 'עבר את הרף של הרמה' : 'לא עבר את הרף של הרמה הפעם'}
          </div>
          <dl className="cr-sheet-grid">
            {end.def.metrics.map((m) => (
              <div key={m.key}><dt>{m.label}</dt><dd>{sum[m.key] === null || sum[m.key] === undefined ? '—' : `${sum[m.key]}${m.unit === '%' ? '%' : m.unit ? ` ${m.unit}` : ''}`}</dd></div>
            ))}
            {end.result.hints > 0 && <div><dt>ניסיונות עם עזרה</dt><dd>{end.result.hints}</dd></div>}
          </dl>
          <div className="cr-sheet-rule">
            <b>איך עולים רמה:</b> {PASS_RULE[end.def.id]}, {ROUNDS_TO_LEVEL_UP} סבבים ברצף באותה רמה.
            {end.level < end.def.levels.length && <> כרגע: {Math.min(end.streak, ROUNDS_TO_LEVEL_UP)} מתוך {ROUNDS_TO_LEVEL_UP}.</>}
            {' '}{cr.autoLevel ? 'הרמה עולה לבד.' : 'העלאת רמה באישור המבוגר.'}
          </div>
          {end.levelUp && <div className="cr-verdict is-pass">הרמה עלתה ל-{end.levelUp}: {end.def.levels[end.levelUp - 1]?.name}</div>}
          {end.suggest && (
            <button type="button" className="cr-sheet-btn" onClick={() => { saveCr({ ...cr, levels: { ...cr.levels, [end.def.id]: end.suggest! }, overrides: { ...cr.overrides, [end.def.id]: {} } }); setEnd({ ...end, suggest: null, levelUp: end.suggest }); }}>
              להעלות לרמה {end.suggest}
            </button>
          )}
          <p className="cr-sheet-saved">{end.saved === null ? 'שומר…' : end.saved ? '✓ נשמר בהיסטוריה' : 'לא נשמר'}</p>
        </div>
      </div>
    );
  })() : null;

  let body: React.ReactNode = null;
  if (screen === 'home') {
    const nameText = firstName ? `של ${firstName}` : '';
    // one line, shrink to fit the box (~75px at 1024 wide, like the painted name)
    const nameSize = Math.min(7.6, (L.home.name.width * 0.96) / Math.max(1, nameText.length * 0.6));
    body = (
      <Plate src={V2[canEdit ? 'home-plate' : 'home-plate-nogear']} className="is-home">
        {nameText && <div className="cr-name" style={boxStyle(L.home.name)}><span data-text={nameText} style={{ fontSize: `${nameSize}cqw` }}>{nameText}</span></div>}
        {CHALLENGES.map((def) => <TrayStars key={def.id} n={bestStars(def.id)} box={L.home.stars[def.id]} />)}
        {CHALLENGES.map((def) => <Hit key={def.id} id={`card-${def.id}`} shape="card" box={L.home.cards[def.id]} label={def.name} onClick={() => openChallenge(def)} />)}
        {!soundOn && <Piece src={V2['btn-mute']} box={L.home.soundCircle} />}
        {canEdit && <Hit id="settings" shape="circle" box={L.home.settings} label="הגדרות" onClick={() => setScreen('panel')} />}
        <Hit id="sound" shape="circle" box={L.home.sound} label={soundOn ? 'השתקה' : 'צלילים'} onClick={toggleSound} />
        <Hit id="back" shape="circle" box={L.home.back} label="יציאה" onClick={onExit} />
      </Plate>
    );
  } else if (screen === 'intro') {
    const s = effectiveSettings(current, levelOf(current.id), cr.overrides[current.id]);
    const hasRule = current.id === 'gonogo' || current.id === 'switch' || current.id === 'wait';
    // the wait game's rule: green = press, yellow (still counting) = wait
    const pressC: ColorId = current.id === 'switch' || current.id === 'wait' ? 'green' : ((s.goColor as ColorId) || 'green');
    const nogoC: ColorId = current.id === 'switch' ? 'red' : current.id === 'wait' ? 'yellow' : ((s.nogoColor as ColorId) || 'red');
    // a one-challenge game: the intro is its menu, so the adults' gear sits here (painted in, like home)
    const gear = single && canEdit;
    const mach = MACHINES[current.id];
    const boxR = (L.intro.machine.width * 1024) / (L.intro.machine.height * 1536);
    const pr = mach.w / mach.h;
    const mw = pr < boxR ? (pr / boxR) * 100 : 100;
    const mh = pr < boxR ? 100 : (boxR / pr) * 100;
    const levels = canEdit && current.levels.length > 1 ? (
      <div className="cr-levels2" role="radiogroup" aria-label="רמה">
        <span className="cr-levels2-label">רמה</span>
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
        {levelOf(current.id) < current.levels.length && (
          <span className="cr-level-next">{Math.min(ROUNDS_TO_LEVEL_UP - 1, levelStreak(current, levelOf(current.id), rounds))}/{ROUNDS_TO_LEVEL_UP} לרמה {levelOf(current.id) + 1}</span>
        )}
      </div>
    ) : undefined;
    body = (
      <Plate src={V2[`intro${hasRule ? '' : '-norule'}${gear ? '-gear' : ''}-plate`]} className="is-intro" below={levels}>
        <div style={boxStyle(L.intro.machine)}>
          <div className="cr-machine" style={{ left: `${(100 - mw) / 2}%`, width: `${mw}%`, height: `${mh}%` }}>
            <img src={V2[`machine-${current.id}`]} alt={current.name} draggable={false} />
            <TrayStars n={bestStars(current.id)} box={mach.tray} />
          </div>
        </div>
        {hasRule && <>
          <span className="cr-socket" style={boxStyle(L.intro.socketPress)} />
          <span className="cr-socket" style={boxStyle(L.intro.socketNogo)} />
          <Piece src={padOf(pressC)} box={L.intro.padPress} />
          <Piece src={V2['hand-press']} box={L.intro.handPress} className="cr-intro-tap" />
          <Piece src={padOf(nogoC)} box={L.intro.padNogo} />
          <Piece src={V2['hand-stop']} box={L.intro.handNogo} />
        </>}
        {!soundOn && <Piece src={V2['btn-mute']} box={gear ? L.home.soundCircle : L.intro.soundCircle} />}
        {gear && <Hit id="settings" shape="circle" box={L.home.settings} label="הגדרות" onClick={() => setScreen('panel')} />}
        <Hit id="sound" shape="circle" box={gear ? L.home.sound : L.intro.sound} label={soundOn ? 'השתקה' : 'צלילים'} onClick={toggleSound} />
        <Hit id="back" shape="circle" box={L.intro.back} label={single ? 'יציאה' : 'חזרה'} onClick={single ? onExit : goHome} />
        <Hit id="play" shape="round" box={L.intro.play} label="לא, לשחק!" onClick={() => { snd.unlock(); window.clearTimeout(askTimer.current); startRound(current, false); }} />
        <Hit id="explain" shape="round" box={L.intro.explain} label="כן, להסביר" onClick={explain} />
      </Plate>
    );
  } else if (screen === 'play') {
    body = padGrid;
  } else if (screen === 'end' && end) {
    body = (
      <Plate src={V2[single ? 'end-menu-plate' : 'end-plate']} className="is-end">
        {L.end.stars.map((b, k) => (
          <img key={k} className={`cr-end-star${k < end.stars ? ' is-on' : ''}`} src={V2[k < end.stars ? 'star-full' : 'star-empty']} alt="" draggable={false}
            style={boxStyle(b, { animationDelay: `${0.35 + k * 0.3}s` })} />
        ))}
        <span className="cr-sr" aria-live="polite">{end.stars} כוכבים</span>
        <Hit id="again" shape="card" box={L.end.again} label="שוב" onClick={() => startRound(end.def, false)} />
        <Hit id="all" shape="card" box={L.end.all} label={single ? 'לתפריט' : 'לכל האתגרים'} onClick={goHome} />
        <div className={`cr-lvbox${end.levelUp ? ' is-up' : ''}`} style={boxStyle(L.end.stats)}>
          <div className="cr-lvbox-main">
            {levelLine(end)}
            {!end.levelUp && end.level < end.def.levels.length && !end.result.stoppedEarly && (
              <span className="cr-lvdots" aria-hidden>
                {Array.from({ length: ROUNDS_TO_LEVEL_UP }).map((_, k) => <i key={k} className={k < end.streak ? 'on' : ''} />)}
              </span>
            )}
          </div>
          {canEdit && <button type="button" className="cr-lvbox-more" onClick={() => setDetails(true)}>תוצאות הסבב</button>}
        </div>
      </Plate>
    );
  } else if (screen === 'panel') {
    body = <AdultPanel cr={cr} rounds={rounds} kidName={kid?.name || ''} soundOn={soundOn} voiceOn={voiceOn} defs={defs}
      onSave={(next, extra) => onSaveConfig({ ...writeCr(config, next), ...(extra || {}) })}
      onResetProgress={() => onSaveState({ stats: {} } as never)}
      onResetData={async () => {
        if (!kid?.id) return false;
        const res = await gamesApi.deleteRounds(kid.id, GAME_ID);
        if (!res.success) return false;
        onSaveState({ stats: {} } as never);
        saveCr({ ...cr, levels: {} });
        qc.invalidateQueries({ queryKey: ['game-rounds', kid.id, GAME_ID] });
        return true;
      }}
      onClose={() => setScreen(single ? 'intro' : 'home')} />;
  }

  const game = (
    <div ref={rootRef} className={`cr cr-v2 is-${screen}${ready ? ' is-ready' : ''}`} dir="rtl" style={{ '--bg-tall': V2['bg-play'] ? `url(${V2['bg-play']})` : undefined } as React.CSSProperties}
      onPointerDown={() => snd.unlock()}>
      <div className="cr-phone">
      {screen === 'play' && topBar}
      <div key={screen} className="cr-body cr-enter">{body}</div>
      {screen === 'play' && ov.banner && (
        <div className="cr-dim cr-rules-ov" key={ov.banner.title}>
          <RulesCard first={ov.banner.title === 'הכלל'} chips={ov.banner.rules || []} />
        </div>
      )}
      {paused && (
        <div className="cr-dim cr-pause">
          <Stage className="is-pause">
            <img className="cr-plate-img" src={V2['pause-card']} alt="" draggable={false} />
            <span className="cr-sr">עצרנו</span>
            <Hit id="continue" shape="round" box={L.pause.cont} label="ממשיכים" onClick={resume} />
            <Hit id="end-round" shape="round" box={L.pause.stop} label="סיום הסבב" onClick={() => { setPaused(null); runnerRef.current?.stopEarly(); }} />
            {(paused === 'focus' || (canEdit && !demo)) && (
              <div className="cr-pause-extra">
                {paused === 'focus' && <p>המשחק נעצר כי החלון יצא מהמסך. הסבב יסומן כלא תקין למדידה.</p>}
                {canEdit && !demo && (
                  <button type="button" className={`cr-hint-mark${hintFlash ? ' is-on' : ''}`} onClick={() => { runnerRef.current?.armHint(); setHintFlash(true); }}>
                    {hintFlash ? '✓ הניסיון הבא יסומן "עם עזרה"' : 'לסמן את הניסיון הבא "עם עזרה"'}
                  </button>
                )}
              </div>
            )}
          </Stage>
        </div>
      )}
      <div className={`cr-fx${screen === 'play' ? ' is-grid' : ''}`}>
      {bursts.map((b) => (
        <div key={b.id} className={`cr-burst is-${b.kind} at-${b.pod}`}>
          {b.streak >= 3 && <b className="cr-burst-streak">×{b.streak}</b>}
        </div>
      ))}
      </div>
      {detailsSheet}
      {snd.caption && screen !== 'panel' && screen !== 'intro' && screen !== 'end' && <div className="cr-caption">{snd.caption}</div>}
      </div>
      <div className="cr-rotate" aria-live="polite"><span>📱</span>מחזיקים את הטלפון לגובה</div>
    </div>
  );

  return createPortal(game, document.body);
}
