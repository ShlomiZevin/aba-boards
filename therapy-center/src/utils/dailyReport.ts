import type { AbcReport, BreakReport, LessonReport, ReportMark, ReportSection } from '../types';

/**
 * Everything the daily report knows about the paper form it replaces: field
 * labels, option lists and the paper's own instructions. Keep wording close to
 * the paper — the staff already know it.
 */

export const MARK_LABEL: Record<Exclude<ReportMark, ''>, string> = {
  '+': 'עשה מיד',
  '-': 'לא עשה',
  r: 'ר',
};

/** Paper: "+ במידה ועשה מיד, − אם לא עשה ולפרט את סוג הסיוע שניתן". */
export const HELP_CHIPS = ['תזכורת מילולית', 'הכוונה', 'הדגמה', 'סיוע פיזי', 'חיזוק'];

export const DURATIONS = ['5 דק׳', '10 דק׳', '15 דק׳', '20 דק׳', '30 דק׳', '45 דק׳', 'כל השיעור'];

export const MOODS = [
  { id: 'good', icon: '😄', label: 'טוב' },
  { id: 'ok', icon: '🙂', label: 'בסדר' },
  { id: 'hard', icon: '😕', label: 'קשה' },
] as const;

/** Paper: "תוכנית מוטיבציה — לסמן בעיגול באיזה מהם קיבל חיזוק". */
export const MOTIVATION = [
  { n: 1, label: 'התארגנות + תחילת עבודה' },
  { n: 2, label: 'שיתוף פעולה / שמיעת הוראות' },
  { n: 3, label: 'איפוק' },
  { n: 4, label: 'חברתי' },
  { n: 5, label: 'אקסטרה' },
];

export const LESSON_SUGGESTIONS = ['קבלת בוקר', 'חשבון', 'עברית', 'אנגלית', 'מדעים', 'אומנות', 'ספורט', 'מוזיקה', 'תורה', 'סיכום יום'];

// ---------- breaks ----------

export const BREAK_TYPES = [
  { id: 'food', icon: '🍽️', label: 'הפסקת אוכל' },
  { id: 'free', icon: '⚽', label: 'הפסקה חופשית' },
  { id: 'other', icon: '☕', label: 'אחר' },
];

export const BREAK_ACTIVITIES = ['משחק עם חברים', 'משחק לבד', 'מתקנים', 'שיחה', 'אכל', 'הסתובב', 'ישב בצד', 'אחר'];

export const SOCIAL_LEVELS = ['עם חברים', 'ליד חברים', 'לבד'];

export const FOOD_INDEPENDENT = ['עצמאי', 'חלקית', 'עם עזרה'];

export const BREAK_DURATIONS = ['5 דק׳', '10 דק׳', '15 דק׳', '20 דק׳', '30 דק׳'];

// ---------- ABC — the paper's circle-the-options lists ----------

export const ABC_CONTEXT = ['שיעור', 'הפסקה'];
export const ABC_ANTECEDENTS = ['דרישה', 'המתנה', 'סירוב', 'סכסוך חברי', 'מעבר', 'אחר'];
export const ABC_BEHAVIORS = ['צעקות', 'אלימות', 'קללות', 'בכי', 'עזיבת מקום', 'אחר'];
export const ABC_CONSEQUENCES = ['תשומת לב מהילדים', 'ויתור', 'הסבר', 'נזיפה', 'אחר', 'ללא תגובה'];
export const ABC_INTENSITY = ['נמוכה', 'בינונית', 'גבוהה'];
export const ABC_LOCATIONS = ['כיתה', 'חצר', 'מסדרון', 'חדר טיפול', 'אחר'];

// ---------- sections ----------

/** URL segment ↔ storage section. */
export const SECTION_OF: Record<string, ReportSection> = { lesson: 'lessons', break: 'breaks', abc: 'abc' };

export function newReportId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function moodIcon(mood?: string): string {
  return MOODS.find((m) => m.id === mood)?.icon || '';
}

export function breakType(id?: string) {
  return BREAK_TYPES.find((t) => t.id === id);
}

/** The one-liner shown in the day's list when the staff didn't write one. */
export function lessonLine(l: LessonReport): string {
  return l.summary || l.notes || '';
}

export function breakLine(b: BreakReport): string {
  return b.notes || [...(b.activities || []), b.activityNote].filter(Boolean).join(', ');
}

export function abcBehavior(e: AbcReport): string {
  return [...(e.behaviors || []), e.b].filter(Boolean).join(' · ');
}

export function abcAntecedent(e: AbcReport): string {
  return [...(e.antecedents || []), e.a].filter(Boolean).join(' · ');
}

export function abcConsequence(e: AbcReport): string {
  return [...(e.consequences || []), e.c].filter(Boolean).join(' · ');
}

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

/** "רביעי, 14 במאי" — the year only when it isn't this year. */
export function longDate(key: string): string {
  const d = new Date(`${key}T12:00:00`);
  const year = d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${HE_DAYS[d.getDay()]}, ${d.getDate()} ב${HE_MONTHS[d.getMonth()]}${year}`;
}

/** Current time as "HH:MM" — new breaks and ABC events are usually logged as they happen. */
export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "רביעי · 14.5" */
export function shortReportDate(key: string): { day: string; date: string } {
  const d = new Date(`${key}T12:00:00`);
  return { day: HE_DAYS[d.getDay()], date: `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}` };
}
