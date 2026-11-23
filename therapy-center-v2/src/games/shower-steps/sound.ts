/**
 * Sounds for the shower game.
 * - Effects are recorded (ElevenLabs), levelled soft, decoded into WebAudio on the
 *   first tap so they can overlap and loop (water / foam while the child rubs).
 * - Hebrew voice lines play through ONE <audio> element that is first played
 *   inside a tap, so iPhone keeps letting it speak.
 */
import { useCallback, useEffect, useRef } from 'react';

function urls(files: Record<string, string>, dir: string) {
  const out: Record<string, string> = {};
  Object.entries(files).forEach(([p, url]) => { out[p.replace(`./${dir}/`, '').replace('.mp3', '')] = url; });
  return out;
}
const VOICES = urls(import.meta.glob('./voice/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>, 'voice');
const EFFECTS = urls(import.meta.glob('./sfx/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>, 'sfx');

export type Sfx = 'good' | 'back' | 'pop' | 'water' | 'foam' | 'towel' | 'cloth' | 'finale' | 'tap' | 'scrub' | 'rinse' | 'blower' | 'blower2' | 'blower3';

const VOLUME: Partial<Record<Sfx, number>> = { pop: 0.8, back: 0.6, tap: 0.4, good: 0.8, finale: 0.8, blower: 0.75, blower2: 0.75, blower3: 0.75 };

export function useShowerSound(soundOn: boolean, voiceOn: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const buffers = useRef<Record<string, AudioBuffer>>({});
  const loading = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<number[]>([]);
  const loopRef = useRef<{ src: AudioBufferSourceNode; gain: GainNode; name: string } | null>(null);

  /** Must be called from a tap: wakes WebAudio, loads the effects, blesses the voice element. */
  const unlock = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) ctxRef.current = new AC();
    }
    const ctx = ctxRef.current;
    if (ctx?.state === 'suspended') void ctx.resume();
    if (ctx && !loading.current) {
      loading.current = true;
      Object.entries(EFFECTS).forEach(([name, url]) => {
        fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b))
          .then((buf) => { buffers.current[name] = buf; }).catch(() => {});
      });
    }
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'auto';
      audioRef.current = a;
      a.src = VOICES['good2'] || '';
      a.volume = 0;
      a.play().then(() => { a.pause(); a.volume = 1; }).catch(() => { a.volume = 1; });
    }
    return ctx;
  }, []);

  const stopVoice = useCallback(() => {
    queueRef.current.forEach((t) => window.clearTimeout(t));
    queueRef.current = [];
    const a = audioRef.current;
    if (a) { a.onended = null; a.pause(); }
  }, []);

  /**
   * Say a line now (cuts any line that is still talking). `onEnd` runs when it has
   * finished - so the next line never talks over it - or soon, if there is no voice.
   */
  const say = useCallback((name: string, onEnd?: () => void) => {
    const a = audioRef.current;
    const url = VOICES[name];
    const done = () => { if (a) a.onended = null; onEnd?.(); };
    if (!voiceOn || !a || !url) { if (onEnd) queueRef.current.push(window.setTimeout(onEnd, 700)); return; }
    a.onended = null;
    a.pause();
    a.src = url;
    a.volume = 1;
    a.currentTime = 0;
    if (onEnd) {
      a.onended = done;
      // safety net: a line that never reports its end (blocked autoplay) still moves the game on
      queueRef.current.push(window.setTimeout(() => { if (a.onended === done) done(); }, 4000));
    }
    a.play().catch(() => { if (onEnd && a.onended === done) done(); });
  }, [voiceOn]);

  /** Say a line after a pause (cancelled by the next stopVoice). */
  const sayLater = useCallback((name: string, ms: number) => {
    queueRef.current.push(window.setTimeout(() => say(name), ms));
  }, [say]);

  const play = useCallback((name: Sfx) => {
    if (!soundOn) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const buf = buffers.current[name];
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      if (name === 'pop') src.playbackRate.value = 0.9 + Math.random() * 0.25;
      const g = ctx.createGain();
      g.gain.value = VOLUME[name] ?? 0.7;
      src.connect(g).connect(ctx.destination);
      src.start();
      return;
    }
    // not loaded yet (or a tiny UI tick): a soft sine
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    osc.frequency.value = name === 'good' ? 880 : name === 'back' ? 330 : 660;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }, [soundOn]);

  /** A soft loop while the child rubs (fades in; stopLoop fades it out). */
  const startLoop = useCallback((name: Sfx) => {
    if (!soundOn) return;
    const ctx = ctxRef.current;
    const buf = buffers.current[name];
    if (!ctx || !buf) return;
    if (loopRef.current?.name === name) return;
    if (loopRef.current) {
      const old = loopRef.current;
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      old.src.stop(ctx.currentTime + 0.4);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.75, ctx.currentTime, 0.12);
    src.connect(gain).connect(ctx.destination);
    src.start();
    loopRef.current = { src, gain, name };
  }, [soundOn]);

  const stopLoop = useCallback(() => {
    const ctx = ctxRef.current;
    const l = loopRef.current;
    if (!ctx || !l) return;
    l.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    l.src.stop(ctx.currentTime + 0.5);
    loopRef.current = null;
  }, []);

  useEffect(() => () => {
    queueRef.current.forEach((t) => window.clearTimeout(t));
    audioRef.current?.pause();
    void ctxRef.current?.close();
  }, []);

  return { unlock, play, say, sayLater, stopVoice, startLoop, stopLoop };
}
