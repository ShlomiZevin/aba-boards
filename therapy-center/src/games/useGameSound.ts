import { useCallback, useEffect, useRef } from 'react';

export type GameSoundName = 'add' | 'snap' | 'nudge' | 'done';

/**
 * Short synthesised tones — no audio files to load, and gentle by design:
 * soft sine waves with quick fades, nothing percussive or startling.
 */
export function useGameSound(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const unlock = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) ctxRef.current = new AC();
    }
    if (ctxRef.current?.state === 'suspended') void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const play = useCallback(
    (name: GameSoundName) => {
      if (!enabled) return;
      const ctx = unlock();
      if (!ctx) return;

      const tone = (freq: number, start: number, dur: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + start;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      };

      if (name === 'add') { tone(523, 0, 0.16, 0.15); tone(784, 0.1, 0.22, 0.13); }
      else if (name === 'snap') { tone(392, 0, 0.09, 0.17); tone(587, 0.05, 0.16, 0.12); }
      else if (name === 'nudge') { tone(294, 0, 0.13, 0.08); }
      else if (name === 'done') {
        // little rising fanfare, then a held major chord
        [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.35, 0.12));
        [784, 1047, 1319].forEach((f) => tone(f, 0.62, 0.9, 0.09));
      }
    },
    [enabled, unlock]
  );

  useEffect(() => () => { void ctxRef.current?.close(); }, []);

  return { play, unlock };
}
