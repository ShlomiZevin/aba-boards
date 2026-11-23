/**
 * challenge-room keeps its own settings as one JSON string in the kid's game config
 * (`kids/{kidId}.games[].config.cr`), so the generic settings sheet stays untouched.
 */
import type { GameConfigValues } from '../../types';
import type { Settings, Val } from './engine';

export interface CrConfig {
  levels: Record<string, number>;
  overrides: Record<string, Settings>;
  starsEvery: number;
  voicePraise: boolean;
  errorSound: boolean;
  /** challenges whose demo already ran once (it runs by itself the first time) */
  seenDemo: string[];
  /** the level goes up by itself after ROUNDS_TO_LEVEL_UP passed rounds (else the adult approves) */
  autoLevel: boolean;
}

export const DEFAULT_CR: CrConfig = { levels: {}, overrides: {}, starsEvery: 3, voicePraise: true, errorSound: true, seenDemo: [], autoLevel: true };

export function readCr(config: GameConfigValues): CrConfig {
  try {
    const raw = typeof config.cr === 'string' && config.cr ? JSON.parse(config.cr) : {};
    return {
      ...DEFAULT_CR,
      ...raw,
      levels: { ...(raw.levels || {}) },
      overrides: { ...(raw.overrides || {}) },
      seenDemo: Array.isArray(raw.seenDemo) ? raw.seenDemo : [],
    };
  } catch {
    return { ...DEFAULT_CR };
  }
}

export function writeCr(config: GameConfigValues, cr: CrConfig): GameConfigValues {
  return { ...config, cr: JSON.stringify(cr) };
}

/** Download rows as a CSV that Excel opens in Hebrew (BOM + CRLF). */
export function downloadCsv(name: string, rows: Record<string, Val | undefined>[]) {
  const cols: string[] = [];
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (!cols.includes(k)) cols.push(k); }));
  const esc = (v: Val | undefined) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
