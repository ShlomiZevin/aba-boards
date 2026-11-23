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

const VOLUME: Record<string, number> = { tap: 0.45, soft: 0.5, star: 0.7, note: 0.85, turn: 0.8, switch: 0.8, end: 0.85, start: 0.6 };

export function useChallengeSound(soundOn: boolean, voiceOn: boolean, gender: 'm' | 'f') {
  const ctxRef = useRef<AudioContext | null>(null);
  const buffers = useRef<Record<string, AudioBuffer>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastVariant = useRef<Record<string, string>>({});
  const safety = useRef<number>(0);
  const [caption, setCaption] = useState<string>('');

  const loadAll = useCallback((ctx: AudioContext) => {
    buffers.current = {};
    Object.entries(EFFECTS).forEach(([name, url]) => {
      fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b))
        .then((buf) => { if (ctxRef.current === ctx) buffers.current[name] = buf; }).catch(() => {});
    });
  }, []);

  /** Call from every tap / key: wakes or rebuilds WebAudio, blesses the voice element. */
  const unlock = useCallback(() => {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    let ctx = ctxRef.current;
    if (ctx && (ctx.state as string) === 'closed') ctx = null;
    if (!ctx) { ctx = new AC(); ctxRef.current = ctx; loadAll(ctx); }
    if (ctx.state !== 'running') {
      const c = ctx;
      c.resume().then(() => {
        if (c.state !== 'running') { void c.close(); ctxRef.current = new AC(); loadAll(ctxRef.current); }
      }).catch(() => {});
      try { // a 1-sample silent buffer inside the tap
        const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0);
      } catch { /* ignore */ }
    }
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'auto';
      audioRef.current = a;
      a.src = VOICES['praise1'] || '';
      a.volume = 0;
      a.play().then(() => { a.pause(); a.volume = 1; }).catch(() => { a.volume = 1; });
    }
  }, [loadAll]);

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

  const play = useCallback((name: string) => {
    if (!soundOn) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    // variants: good -> good1..3, never the same twice in a row
    let file = name;
    const variants = Object.keys(EFFECTS).filter((k) => k.replace(/\d+$/, '') === name && /\d+$/.test(k) && !k.startsWith('note'));
    if (!EFFECTS[name] && variants.length) {
      const opts = variants.filter((v) => v !== lastVariant.current[name]);
      file = opts[Math.floor(Math.random() * opts.length)] || variants[0];
      lastVariant.current[name] = file;
    }
    const buf = buffers.current[file];
    const base = file.replace(/\d+$/, '');
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
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
    const leave = () => { stopVoice(); void ctxRef.current?.suspend(); };
    window.addEventListener('pagehide', leave);
    return () => { window.removeEventListener('pagehide', leave); stopVoice(); void ctxRef.current?.close(); ctxRef.current = null; };
  }, [stopVoice]);

  return { unlock, say, play, stopVoice, caption };
}
