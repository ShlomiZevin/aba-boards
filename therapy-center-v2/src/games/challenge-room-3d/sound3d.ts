/**
 * The 3D game's own few effects (the button's thock, the robot's chirps) - everything
 * else (effects, voice, captions) is the 2D game's sound layer, reused as is.
 * Same iPhone rules: the context is woken on every tap and rebuilt if it won't run.
 */
import { useCallback, useEffect, useRef } from 'react';

const FILES = Object.fromEntries(
  Object.entries(import.meta.glob('./sfx/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
    .map(([p, u]) => [p.replace('./sfx/', '').replace('.mp3', ''), u])
) as Record<string, string>;

const VOLUME: Record<string, number> = { press: 0.55, 'chirp-happy': 0.5, 'chirp-hmm': 0.45, 'robot-cheer': 0.55 };

export function useExtraSfx(soundOn: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufs = useRef<Record<string, AudioBuffer>>({});
  const last = useRef<Record<string, string>>({});

  const loadAll = useCallback((ctx: AudioContext) => {
    bufs.current = {};
    Object.entries(FILES).forEach(([name, url]) => {
      fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b))
        .then((buf) => { if (ctxRef.current === ctx) bufs.current[name] = buf; }).catch(() => {});
    });
  }, []);

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
      try { const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch { /* ignore */ }
    }
  }, [loadAll]);

  /** play `press` -> press1..3 (never the same twice in a row) */
  const play = useCallback((name: string, rate = 1) => {
    if (!soundOn) return;
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== 'running') return;
    const variants = Object.keys(FILES).filter((k) => k.replace(/\d+$/, '') === name);
    if (!variants.length) return;
    const opts = variants.length > 1 ? variants.filter((v) => v !== last.current[name]) : variants;
    const file = opts[Math.floor(Math.random() * opts.length)];
    last.current[name] = file;
    const buf = bufs.current[file];
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = VOLUME[name] ?? 0.5;
    src.connect(g).connect(ctx.destination);
    src.start();
  }, [soundOn]);

  useEffect(() => {
    const leave = () => { void ctxRef.current?.suspend(); };
    window.addEventListener('pagehide', leave);
    return () => { window.removeEventListener('pagehide', leave); void ctxRef.current?.close(); ctxRef.current = null; };
  }, []);

  return { unlock, play };
}
