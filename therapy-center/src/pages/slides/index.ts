// ─────────────────────────────────────────────────────────────
// SLIDE DATA — built-in defaults.
//
// Two ways to author slides:
//   1. Edit DEFAULT_SLIDES below (for permanent changes, requires code update)
//   2. Use the in-app edit mode (✎) to add/remove/edit slides at runtime —
//      these live in localStorage and are merged with the defaults at render
//      time (see `getEffectiveSlides`).
//
// Slide shape (TypeScript discriminated union):
//   - CoverSlide:   { id, variant: 'cover'|'closing', title, sub? }
//   - ContentSlide: { id, variant: 'content', section, title, lead?, notes?, embedPath?, afterId? }
//
//   - title     → the big headline (h1 for content; cover headline for cover/closing)
//   - lead      → one sentence under the headline (optional)
//   - notes     → 1–5 numbered bullet points (optional)
//   - embedPath → URL to embed in the left panel; omit to hide iframe
//   - section   → topbar label; '' to hide
//   - afterId   → custom-slide-only: insert after the slide with this id (0 = at start)
// ─────────────────────────────────────────────────────────────

import { CUSTOM_SLIDES_KEY, HIDDEN_SLIDES_KEY, readJsonArray, writeJsonArray, getStoredContent } from './auth';

export interface BaseSlide {
  id: number;
  section: string;
  title: string;
}

export interface CoverSlide extends BaseSlide {
  variant: 'cover' | 'closing';
  sub?: string;
}

export interface ContentSlide extends BaseSlide {
  variant: 'content';
  lead?: string;
  notes?: string[];
  embedPath?: string;
  /** which account this slide starts on by default ('michal' if omitted) */
  defaultAuth?: 'michal' | 'demo';
  /** custom slides only — id of the slide it appears AFTER (0 = at start) */
  afterId?: number;
}

export type SlideData = CoverSlide | ContentSlide;

export interface SectionMeta {
  name: string;
  brief?: boolean;
}

// Section order — slides are grouped by their `section` field matching one of these names
export const SECTIONS: SectionMeta[] = [
  { name: 'מרכז הטיפול' },
  { name: 'צאט AI' },
  { name: 'לוחות + דינו', brief: true },
  { name: 'סיום' },
];

export const DEFAULT_SLIDES: SlideData[] = [
  {
    id: 1, variant: 'cover', section: '',
    title: 'סיור במערכת',
    sub: 'ניהול טיפול ABA + לוחות לילדים',
  },

  // ── Section 1: מרכז הטיפול ───────────────────────────────
  {
    id: 2, variant: 'content', section: 'מרכז הטיפול',
    title: 'הרשמה וכניסה',
    lead: 'בחרנו בדרך הכי פשוטה: מפתח גישה שאתם קובעים בעצמכם. נכנסים איתו פעם אחת — והמערכת זוכרת אתכם. אם יסתבך, נעבור להרשמה רגילה עם אימייל / גוגל.',
    notes: [
      'אתם קובעים מפתח גישה — מילה או מספר שתזכרו',
      'כניסה פעם אחת — המערכת זוכרת אתכם בדפדפן',
      'בודקים אם זה ברור — אם לא, נעבור לאימייל / גוגל',
    ],
    embedPath: '/therapy/signup',
  },
  {
    id: 3, variant: 'content', section: 'מרכז הטיפול',
    title: 'אפליקציה על הנייד',
    lead: 'אפשר להפוך את המערכת לאפליקציה על מסך הבית — בלי להוריד מחנות. רק כפתור בדפדפן.',
    notes: [
      'נכנסים לעמוד "התקנת אפליקציה" בתפריט',
      'בוחרים "הוסף למסך הבית" (Safari / Chrome)',
      'נפתח כמו אפליקציה רגילה, עם אייקון Doing',
    ],
    embedPath: '/therapy/install-app',
  },
  {
    id: 4, variant: 'content', section: 'מרכז הטיפול',
    title: 'דשבורד הילדים',
    lead: 'המסך הראשי. רשימת כל הילדים שלך וגישה מהירה לכל מסך.',
    notes: [
      'כרטיסי ילדים — תמונה, שם, סטטוס',
      'התראות על סשנים וטפסים שמחכים',
      'כניסה לכרטיס ילד בקליק אחד',
    ],
    embedPath: '/therapy/',
    defaultAuth: 'demo',
  },
  {
    id: 5, variant: 'content', section: 'מרכז הטיפול',
    title: 'הוספת ילד חדש',
    lead: 'ילד חדש מתחיל בכפתור "+ הוסף ילד" בדשבורד. פרטים בסיסיים — ויש כרטיס מוכן כמו זה שמוצג.',
    notes: [
      'שם, גיל, מין, תמונה',
      'שיוך הורים ומטפלות',
      'כרטיס הילד נפתח אוטומטית',
    ],
    embedPath: '/therapy/kid/%D7%94%D7%A8%D7%90%D7%9C',
  },
  {
    id: 6, variant: 'content', section: 'מרכז הטיפול',
    title: 'כרטיס הילד',
    lead: 'כל המידע על ילד אחד — מקום אחד. נקודת המוצא לכל מה שעושים איתו.',
    notes: [
      'צוות, הורים, מטרות',
      'סשנים, טפסים, גרפים',
      'גישה מהירה לכל פעולה — מילוי, תזמון, עריכה',
    ],
    embedPath: '/therapy/kid/%D7%94%D7%A8%D7%90%D7%9C',
  },
  {
    id: 7, variant: 'content', section: 'מרכז הטיפול',
    title: 'הורים — פרטים וגישה',
    lead: 'כל ילד יכול לקבל הורה אחד או שניים, וגישת קריאה אישית.',
    notes: [
      'שם, טלפון, אימייל',
      'קישור אישי — בלי הרשמה, בלי סיסמה',
      'הורה רואה התקדמות וטפסים, בקריאה בלבד',
    ],
    embedPath: '/therapy/kid/%D7%94%D7%A8%D7%90%D7%9C',
  },
  {
    id: 8, variant: 'content', section: 'מרכז הטיפול',
    title: 'אנשי צוות',
    lead: 'לכל ילד רואים את הצוות שמטפל בו. בנפרד, יש דף ניהול כללי לכל המטפלות ומעקב שעות.',
    notes: [
      'ברמת ילד — שיוך מטפלות, תפקידים, פרטי קשר',
      'גישה אישית — כל מטפלת רואה רק את שלה',
      'בתפריט הצד: ניהול צוות + שעות צוות (שעות עבודה, סשנים, נוכחות)',
    ],
    embedPath: '/therapy/kid/%D7%94%D7%A8%D7%90%D7%9C',
  },
  {
    id: 9, variant: 'content', section: 'מרכז הטיפול',
    title: 'סשנים ולוח פגישות',
    lead: 'לכל ילד רואים את הסשנים שלו. בנפרד, יש גם יומן כללי של כל המרכז.',
    notes: [
      'ברמת ילד — תזמון, סשן בודד או חוזר, קישור לטפסים',
      'יומן כללי בתפריט הצד — כל המטפלות וכל הילדים ביומן אחד',
      'צבע לכל מטפלת, תצוגות שבועי / חודשי, סינון',
    ],
    embedPath: '/therapy/kid/%D7%94%D7%A8%D7%90%D7%9C',
  },
  {
    id: 10, variant: 'content', section: 'מרכז הטיפול',
    title: 'מילוי טופס סשן',
    lead: 'אחרי הסשן ממלאים. שיתוף פעולה, מצב רוח, מה עבדנו עליו, הערות.',
    notes: [
      'סעיפים מותאמים אישית לכל ילד',
      'סימון מטרות שעבדנו עליהן בסשן',
      'שמירה אוטומטית — אפשר לחזור ולערוך',
    ],
    embedPath: '/therapy/kid/%D7%94%D7%A8%D7%90%D7%9C',
  },
  {
    id: 11, variant: 'content', section: 'מרכז הטיפול',
    title: 'תוכניות מעקב ולמידה',
    lead: 'לכל ילד בונים תוכניות — מה עוקבים, מה לומדים, ואיך.',
    notes: [
      'תוכניות מעקב — איזה מטרות, ואיזה התקדמות צופים',
      'תוכניות למידה — שלבים, צעדים, פירוק משימה',
      'הכל מתחבר לטופס הסשן ולגרפים',
    ],
    embedPath: '/therapy/kid/%D7%94%D7%A8%D7%90%D7%9C',
  },
  {
    id: 12, variant: 'content', section: 'מרכז הטיפול',
    title: 'טופס איסוף נתונים',
    lead: 'לכל מטרה בוחרים איך אוספים נתונים — ניסיונות, הצלחות, אחוזים, סקאלה.',
    notes: [
      'מגדירים פעם אחת — שדות, סוג נתון, יחידה',
      'המטפלת מזינה את הנתונים תוך כדי הסשן',
      'הופך אוטומטית לגרף ולמדד התקדמות',
    ],
    embedPath: '/therapy/kid/%D7%94%D7%A8%D7%90%D7%9C',
  },
  {
    id: 13, variant: 'content', section: 'מרכז הטיפול',
    title: 'דשבורד התקדמות',
    lead: 'התמונה הוויזואלית של הילד. מה עבדנו, מה השתפר, מה עוד צריך עבודה — הכל בגרפים.',
    notes: [
      'גרפים פר מטרה לאורך זמן',
      'כל המטרות במבט אחד — מי עולה, מי תקועה',
      'מבוסס על הנתונים שמולאו בטפסים',
    ],
    embedPath: '/therapy/kid/%D7%94%D7%A8%D7%90%D7%9C',
  },
  {
    id: 14, variant: 'content', section: 'מרכז הטיפול',
    title: 'הגדרת טפסים למטרות',
    lead: 'לכל מטרה בונים את טופס איסוף הנתונים שלה — פעם אחת, ומשתמשים בכל סשן.',
    notes: [
      'בוחרים את סוג הנתון ואת השדות',
      'מסדרים בסדר שנוח — נשמר לכל מטפלת',
      'הטופס מופיע אוטומטית בכל סשן עם הילד',
    ],
    embedPath: '/therapy/kid/%D7%94%D7%A8%D7%90%D7%9C',
  },
  {
    id: 15, variant: 'content', section: 'מרכז הטיפול',
    title: 'נוטיפיקציות',
    lead: 'המערכת מזכירה. סשנים בלי טפסים, ילדים שלא קיבלו טיפול, עדכוני צוות.',
    notes: [
      'תזכורות אוטומטיות — לא צריך לזכור לבד',
      'באדג׳ים על הדשבורד, בכל מסך',
      'הכל מרוכז במקום אחד — לא מפספסים',
    ],
    embedPath: '/therapy/kid/%D7%94%D7%A8%D7%90%D7%9C',
  },
  {
    id: 16, variant: 'content', section: 'מרכז הטיפול',
    title: 'מרכז הודעות',
    lead: 'תקשורת פנים-מרכזית. בין המטפלות, להורים, וכל מה שצריך לדעת — במקום אחד.',
    notes: [
      'הודעות בין הצוות',
      'עדכונים להורים',
      'תיעוד אינטראקציות חשובות',
    ],
    embedPath: '/therapy/kid/%D7%94%D7%A8%D7%90%D7%9C',
  },

  // ── Section 2: צאט AI ────────────────────────────────────
  {
    id: 17, variant: 'content', section: 'צאט AI',
    title: 'צאט AI שמכיר את הילד',
    lead: 'לא צ׳אט גנרי. מחובר לכל הנתונים שלכם — סשנים, טפסים, מטרות, צוות.',
    notes: [
      'קורא כל סשן וכל טופס — של כל ילד',
      'יודע מי המטפלות, מי ההורים, ומה התוכניות',
      'עונה בעברית טבעית — צ׳אט שעובד 24/7',
    ],
    embedPath: '/therapy/chat',
  },
  {
    id: 18, variant: 'content', section: 'צאט AI',
    title: 'מה אפשר לעשות איתו',
    lead: 'שיחה רגילה בעברית. הוא מפעיל את הכלים הנכונים מאחורי הקלעים.',
    notes: [
      'סיכומים תקופתיים — שבוע, חודש, או טווח שתבחרו',
      'יצירת טפסים, מטרות ולוחות — בבקשה אחת',
      'ניתוח נתונים וייעוץ מקצועי ב-ABA',
    ],
    embedPath: '/therapy/chat',
  },
  {
    id: 19, variant: 'content', section: 'צאט AI',
    title: 'דוגמה — סיכום בלחיצה',
    lead: '״סכם לי את 3 השבועות האחרונים של יואב.״ זהו — הוא קורא את כל הסשנים, הנתונים והמטרות, ומחזיר סיכום מקצועי מוכן לשליחה.',
    notes: [
      'בוחרים ילד וטווח תאריכים',
      'הוא קורא את כל הסשנים והנתונים בטווח',
      'סיכום מוכן — אפשר לערוך, לשמור, או לשלוח',
    ],
    embedPath: '/therapy/chat',
  },

  // ── Section 3: לוחות + דינו ──────────────────────────────
  {
    id: 20, variant: 'content', section: 'לוחות + דינו',
    title: 'לוחות לילדים',
    lead: 'לוח משימות יומי לילד — תגמולים, אמוג׳ים, שגרה. מתחבר ישירות למרכז הטיפול.',
    notes: [
      'בונים לבד בקליקים — או ה-AI בונה',
      'או שאנחנו עוזרים לכם להתחיל',
    ],
    embedPath: '/therapy/board-builder',
  },
  {
    id: 21, variant: 'content', section: 'לוחות + דינו',
    title: 'דינו — חבר AI שמדבר עם הילד',
    lead: 'דינוזאור שעונה בקול, מכיר את המשימות של הילד, ומעודד אותו ברגעים הנכונים.',
    notes: [
      'הילד מדבר — דינו מקשיב ועונה',
      'חוויה לילד, נתונים למרכז',
    ],
    embedPath: 'https://startdoing.co.il/board.html?kid=%D7%A2%D7%95%D7%9E%D7%A8',
  },

  // ── Section 4: סיום ──────────────────────────────────────
  {
    id: 22, variant: 'content', section: 'סיום',
    title: 'עלות ושקיפות',
    lead: 'יש שני סוגי עלויות — תשתית ו-AI. גם למערכת כזו יש עלות תפעול, ואנחנו רוצים שתבינו על מה. הנה הפירוט והחשיבה שלנו.',
    notes: [
      'תשתית — שרתים ומסד נתונים. כ-20 ש״ח לחודש / 200 ש״ח לשנה. קטן, אבל לא אפסי',
      'AI — הצ׳אט החכם. כל שאלה ל-OpenAI/Anthropic עולה לנו כסף. זה החלק היקר',
      'מודל ה-AI עדיין בבחינה — אולי פר שימוש (פר שאלה), אולי חבילה חודשית, אולי פר ילד',
      'שקיפות מלאה — אנחנו עוד מגלים, ונשתף אתכם לפני כל החלטה',
    ],
    // no embedPath
  },
  {
    id: 23, variant: 'content', section: 'סיום',
    title: 'שותפים בתהליך',
    lead: 'זה הכלי שלנו — נשמח לשמוע. משוב, פיצ׳רים חסרים, שיפורים. אנחנו זריזים ומגיבים.',
    notes: [
      'ספרו לנו מה עובד ומה חסר',
      'שינויים והתאמות — לא חודשים, ימים',
      'הולכים יחד, בונים יחד',
    ],
    // no embedPath
  },
  {
    id: 24, variant: 'closing', section: '',
    title: 'תודה',
    sub: 'שאלות? בואו נדבר.',
  },
];

// Backwards-compat re-export — some code still imports SLIDES; treat it as the defaults.
// Live effective slides (defaults + customs - hidden) come from `getEffectiveSlides()`.
export const SLIDES = DEFAULT_SLIDES;

// ── Custom slides (added at runtime via edit mode) ──
export function getCustomSlides(): ContentSlide[] {
  return readJsonArray<ContentSlide>(CUSTOM_SLIDES_KEY).filter(s => s && typeof s.id === 'number');
}
export function setCustomSlides(slides: ContentSlide[]) {
  writeJsonArray(CUSTOM_SLIDES_KEY, slides);
}
export function addCustomSlide(slide: ContentSlide) {
  setCustomSlides([...getCustomSlides(), slide]);
}
export function removeCustomSlideById(id: number) {
  setCustomSlides(getCustomSlides().filter(s => s.id !== id));
}

// ── Hidden default slides (removed via edit mode) ──
export function getHiddenIds(): number[] {
  return readJsonArray<number>(HIDDEN_SLIDES_KEY).filter(n => typeof n === 'number');
}
export function setHiddenIds(ids: number[]) {
  writeJsonArray(HIDDEN_SLIDES_KEY, ids);
}
export function hideSlide(id: number) {
  const cur = new Set(getHiddenIds());
  cur.add(id);
  setHiddenIds(Array.from(cur));
}
export function unhideSlide(id: number) {
  setHiddenIds(getHiddenIds().filter(n => n !== id));
}

// ── Effective slide list (defaults - hidden + customs at their afterId positions) ──
export function getEffectiveSlides(): SlideData[] {
  const hidden = new Set(getHiddenIds());
  const customs = getCustomSlides();
  const customsByAfter = new Map<number, ContentSlide[]>();
  for (const c of customs) {
    const key = c.afterId ?? 0;
    if (!customsByAfter.has(key)) customsByAfter.set(key, []);
    customsByAfter.get(key)!.push(c);
  }

  const out: SlideData[] = [];
  // Customs inserted before any default (afterId = 0)
  if (customsByAfter.has(0)) out.push(...customsByAfter.get(0)!);
  for (const slide of DEFAULT_SLIDES) {
    if (hidden.has(slide.id)) continue;
    out.push(slide);
    if (customsByAfter.has(slide.id)) out.push(...customsByAfter.get(slide.id)!);
  }
  return out;
}

// Resolves the section label actually shown for a slide (override > data.section)
export function effectiveSection(s: SlideData): string {
  const override = getStoredContent(s.id);
  return override?.section ?? s.section;
}

export function slidesInSection(sec: SectionMeta, effective?: SlideData[]) {
  const all = effective ?? getEffectiveSlides();
  return all.filter(s => effectiveSection(s) === sec.name);
}
