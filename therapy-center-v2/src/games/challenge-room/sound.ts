/**
 * Sounds for challenge-room.
 * - Effects (ElevenLabs, levelled) decode into WebAudio so they can overlap; variants
 *   (good1..3) rotate so the same one never plays twice in a row.
 * - Hebrew voice lines play through ONE <audio> element blessed inside a tap (iPhone).
 *   Gendered lines are files `<id>-m` / `<id>-f`; `say('intro')` picks the kid's.
 * - The AudioContext is woken on EVERY tap and rebuilt if it won't run (iPhone after
 *   leaving the page).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import LINES_JSON from './voice/lines.json';

function urls(files: Record<string, string>, dir: string) {
  const out: Record<string, string> = {};
  Object.entries(files).forEach(([p, url]) => { out[p.replace(`./${dir}/`, '').replace('.mp3', '')] = url; });
  return out;
}
const VOICES = urls(import.meta.glob('./voice/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>, 'voice');
const EFFECTS = urls(import.meta.glob('./sfx/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>, 'sfx');
const LINES = LINES_JSON as Record<string, string>;

const VOLUME: Record<string, number> = { good: 1, star: 1, tap: 0.45, soft: 0.5, note: 0.85, turn: 0.8, switch: 0.8, end: 0.85, start: 0.6 };

/*
 * ONE audio engine for the whole page, shared by every visit to the game and never closed.
 * (Closing and rebuilding it outside a tap - the old way - left a phone silent after the
 * child left the game and came back: a new context starts suspended until the next tap.)
 */
let CTX: AudioContext | null = null;
const BUF: Record<string, AudioBuffer> = {};
let loadedFor: AudioContext | null = null;
let VOICE_EL: HTMLAudioElement | null = null;

function ensureCtx(): AudioContext | null {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!CTX || (CTX.state as string) === 'closed') CTX = new AC();
  if (loadedFor !== CTX) {
    const ctx = CTX;
    loadedFor = ctx;
    Object.entries(EFFECTS).forEach(([name, url]) => {
      fetch(url).then((r) => r.arrayBuffer()).then((buf) => ctx.decodeAudioData(buf))
        .then((decoded) => { if (CTX === ctx) BUF[name] = decoded; }).catch(() => {});
    });
  }
  return CTX;
}

/** wake the engine; inside a tap this always works, outside (tab back in focus) it may */
function wake() {
  const ctx = ensureCtx();
  if (!ctx) return;
  // iPhone: let game sounds play even with the ring/silent switch on (Safari 17+)
  try { const nav = navigator as unknown as { audioSession?: { type: string } }; if (nav.audioSession && nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback'; } catch { /* ignore */ }
  if (ctx.state !== 'running') {
    ctx.resume().catch(() => {});
    try { // a 1-sample silent buffer inside the tap (iOS needs a sound started in the gesture)
      const b = ctx.createBuffer(1, 1, 22050); const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0);
    } catch { /* ignore */ }
  }
  if (!VOICE_EL) {
    const el = new Audio();
    el.preload = 'auto';
    VOICE_EL = el;
    el.src = VOICES['praise1'] || '';
    el.volume = 0;
    el.play().then(() => { el.pause(); el.volume = 1; }).catch(() => { el.volume = 1; });
  }
}
// test hook: the shared engine's state
(globalThis as unknown as Record<string, unknown>).__crAudio = () => ({ state: CTX ? CTX.state : 'none', buffers: Object.keys(BUF).length, voice: !!VOICE_EL });
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (!document.hidden && CTX && CTX.state !== 'running') CTX.resume().catch(() => {}); });
}

export function useChallengeSound(soundOn: boolean, voiceOn: boolean, gender: 'm' | 'f') {
  const lastVariant = useRef<Record<string, string>>({});
  const safety = useRef<number>(0);
  const [caption, setCaption] = useState<string>('');
  const audioRef = { get current() { return VOICE_EL; } };

  /** Call from every tap / key. */
  const unlock = useCallback(() => { wake(); }, []);

  const resolve = useCallback((id: string) => {
    if (VOICES[`${id}-${gender}`]) return `${id}-${gender}`;
    return VOICES[id] ? id : '';
  }, [gender]);

  const stopVoice = useCallback(() => {
    window.clearTimeout(safety.current);
    const a = audioRef.current;
    if (a) { a.onended = null; a.pause(); }
    setCaption('');
  }, []);

  /** Say a line now (cuts a line still talking). `onEnd` when finished, or soon if silent. */
  const say = useCallback((id: string, onEnd?: () => void) => {
    const key = resolve(id);
    const a = audioRef.current;
    const text = LINES[key] || '';
    window.clearTimeout(safety.current);
    let called = false;
    const done = () => { if (called) return; called = true; if (a) a.onended = null; setCaption(''); onEnd?.(); };
    if (text) setCaption(text);
    if (!voiceOn || !a || !key) {
      safety.current = window.setTimeout(done, text ? 1400 : 500);
      return;
    }
    a.onended = null;
    a.pause();
    a.src = VOICES[key];
    a.volume = 1;
    a.currentTime = 0;
    a.onended = done;
    safety.current = window.setTimeout(done, 5000);
    a.play().catch(() => { window.clearTimeout(safety.current); safety.current = window.setTimeout(done, 1200); });
  }, [voiceOn, resolve]);

  const play = useCallback((name: string, rate = 1) => {
    if (!soundOn) return;
    const ctx = CTX;
    if (!ctx) return;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    // variants: good -> good1..3, never the same twice in a row
    let file = name;
    const variants = Object.keys(EFFECTS).filter((k) => k.replace(/\d+$/, '') === name && /\d+$/.test(k) && !k.startsWith('note'));
    if (!EFFECTS[name] && variants.length) {
      const opts = variants.filter((v) => v !== lastVariant.current[name]);
      file = opts[Math.floor(Math.random() * opts.length)] || variants[0];
      lastVariant.current[name] = file;
    }
    const buf = BUF[file];
    const base = file.replace(/\d+$/, '');
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.value = VOLUME[base] ?? 0.75;
      src.connect(g).connect(ctx.destination);
      src.start();
      return;
    }
    // not loaded yet: a soft sine so nothing is silent
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const f: Record<string, number> = { note1: 523, note2: 659, note3: 784, note4: 1047, good: 880, soft: 300, turn: 990 };
    osc.frequency.value = f[file] || f[base] || 660;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(base === 'soft' ? 0.03 : 0.07, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }, [soundOn]);

  useEffect(() => {
    const leave = () => stopVoice();
    window.addEventListener('pagehide', leave);
    return () => { window.removeEventListener('pagehide', leave); stopVoice(); };
  }, [stopVoice]);

  return { unlock, say, play, stopVoice, caption };
}
