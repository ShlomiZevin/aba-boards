import type { AgendaDayPlan, AgendaItem, AgendaPeriod } from '../types';

export const PERIODS: AgendaPeriod[] = ['morning', 'noon', 'evening'];

export const PERIOD_META: Record<AgendaPeriod, { label: string; icon: string }> = {
  morning: { label: 'בוקר', icon: '☀️' },
  noon: { label: 'צהריים', icon: '🌤️' },
  evening: { label: 'ערב', icon: '🌙' },
};

/** Index = weekday, 0 = Sunday. */
export const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const DAY_COLORS = ['#ece6fb', '#dff3f6', '#e3f5e6', '#fdf1cf', '#fde4d3', '#fbe0ea', '#e9e3fb'];

const MONTHS_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];

export function emptyPlan(): AgendaDayPlan {
  return { morning: [], noon: [], evening: [] };
}

export function newItemId(): string {
  return `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Local-time "YYYY-MM-DD" — never toISOString, which shifts to UTC. */
export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - out.getDay());
  return out;
}

/** "20.4", or "20 באפר׳" with `withMonth`. */
export function shortDate(d: Date, withMonth = false): string {
  return withMonth ? `${d.getDate()} ב${MONTHS_SHORT[d.getMonth()]}` : `${d.getDate()}.${d.getMonth() + 1}`;
}

export function weekRangeLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  if (weekStart.getMonth() === end.getMonth()) {
    return `${weekStart.getDate()}–${end.getDate()} ב${MONTHS_SHORT[end.getMonth()]}`;
  }
  return `${shortDate(weekStart, true)} – ${shortDate(end, true)}`;
}

// ---------- suggestions ----------

type Suggestion = { title: string; icon: string };

export const SUGGESTIONS: Record<AgendaPeriod, Suggestion[]> = {
  morning: [
    { title: 'לקום', icon: '🛏️' },
    { title: 'להתלבש', icon: '👕' },
    { title: 'לצחצח שיניים', icon: '🪥' },
    { title: 'לשטוף פנים', icon: '🧼' },
    { title: 'ארוחת בוקר', icon: '🥣' },
    { title: 'להכין תיק', icon: '🎒' },
    { title: 'גן', icon: '🌳' },
    { title: 'בית ספר', icon: '🏫' },
  ],
  noon: [
    { title: 'טיפול', icon: '💗' },
    { title: 'ארוחת צהריים', icon: '🥪' },
    { title: 'החזרה הביתה', icon: '🏠' },
    { title: 'מנוחה', icon: '🛋️' },
    { title: 'שיעורי בית', icon: '📚' },
    { title: 'חוג', icon: '⚽' },
    { title: 'גינה', icon: '🛝' },
    { title: 'משחק', icon: '🧸' },
    { title: 'מפגש עם חברים', icon: '👫' },
  ],
  evening: [
    { title: 'ארוחת ערב', icon: '🍽️' },
    { title: 'משחק', icon: '🧩' },
    { title: 'לסדר את החדר', icon: '🧺' },
    { title: 'מקלחת', icon: '🚿' },
    { title: 'פיג׳מה', icon: '🩳' },
    { title: 'לצחצח שיניים', icon: '🪥' },
    { title: 'סיפור', icon: '📖' },
    { title: 'שינה', icon: '🌙' },
  ],
};

export const EMOJIS = [
  '🛏️', '👕', '🪥', '🧼', '🥣', '🍳', '🥪', '🍎', '🍌', '🥛', '🍽️', '🍕',
  '🎒', '🌳', '🏫', '🏠', '🚌', '🚗', '💗', '🫶', '🎨', '🧩', '🧸', '🎲',
  '📚', '✏️', '📖', '🎵', '⚽', '🏊', '🚲', '🛝', '👫', '👨‍👩‍👧', '👵', '🐶',
  '🛋️', '📺', '📱', '🧺', '🚿', '🛁', '🩳', '💊', '🌙', '⭐', '🎉', '🕍',
];

function items(list: Suggestion[]): AgendaItem[] {
  return list.map((s) => ({ id: newItemId(), title: s.title, icon: s.icon }));
}

/** A reasonable first week, so a family edits instead of starting blank. */
export function starterRoutine(): Record<number, AgendaDayPlan> {
  const routine: Record<number, AgendaDayPlan> = {};
  for (let d = 0; d < 7; d++) {
    const weekend = d === 6;
    routine[d] = {
      morning: items([
        { title: 'לקום', icon: '🛏️' },
        { title: 'להתלבש', icon: '👕' },
        { title: 'ארוחת בוקר', icon: '🥣' },
        weekend ? { title: 'זמן משפחה', icon: '👨‍👩‍👧' } : { title: 'גן / בית ספר', icon: '🎒' },
      ]),
      noon: items([
        { title: 'ארוחת צהריים', icon: '🥪' },
        weekend ? { title: 'גינה', icon: '🛝' } : { title: 'החזרה הביתה', icon: '🏠' },
        { title: 'משחק', icon: '🧸' },
      ]),
      evening: items([
        { title: 'ארוחת ערב', icon: '🍽️' },
        { title: 'מקלחת', icon: '🚿' },
        { title: 'סיפור', icon: '📖' },
        { title: 'שינה', icon: '🌙' },
      ]),
    };
  }
  return routine;
}
