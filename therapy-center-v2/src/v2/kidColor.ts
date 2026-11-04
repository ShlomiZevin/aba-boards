// Each kid owns one marker colour everywhere they appear (avatar, chips, calendar).
export const KID_TONES = ['pink', 'sky', 'yellow', 'mint', 'peach', 'lilac'] as const;
export type Tone = typeof KID_TONES[number];

export function kidColor(id: string | null | undefined): Tone {
  if (!id) return 'lilac';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return KID_TONES[h % KID_TONES.length];
}

// Goal categories → marker colours (consistent in every chart, chip and bar).
export const CATEGORY_TONE: Record<string, Tone> = {
  language: 'sky',
  'motor-fine': 'yellow',
  'play-social': 'pink',
  adl: 'mint',
  'motor-gross': 'peach',
  cognitive: 'lilac',
  general: 'lilac',
};

export const CATEGORY_LABEL: Record<string, string> = {
  language: 'שפה ותקשורת',
  'motor-fine': 'מוטוריקה עדינה',
  'play-social': 'משחק וחברה',
  adl: 'ADL',
  'motor-gross': 'מוטוריקה גסה',
  cognitive: 'קוגניטיבי',
  general: 'כללי',
};
