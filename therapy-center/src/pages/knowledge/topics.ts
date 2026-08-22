// Knowledge Center catalog. `ready` items link to real content; the rest are
// placeholder boxes (stub deck) so the hub shows the full planned library.
export interface KnowledgeTopic {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  to: string;
  ready: boolean;
}

export const TOPICS: KnowledgeTopic[] = [
  {
    id: 'aba', ready: true, emoji: '🧠',
    title: 'מצגת היכרות — ניתוח התנהגות (ABA)',
    desc: 'מצגת שמסבירה מה זה ABA, איך התנהגות עובדת, חיזוק והפחתה, דרכי לימוד ועוד — מתאימה להצגה להורים חדשים ולצוות.',
    to: '/parent-guide',
  },
  {
    id: 'dsm5', ready: true, emoji: '🧩',
    title: 'אבחון אוטיזם לפי DSM-5',
    desc: 'סיכום קריטריוני האבחון של הפרעת הספקטרום האוטיסטי — תקשורת ואינטראקציה חברתית, דפוסים חזרתיים ודרגות חומרה.',
    to: '/autism-dsm5',
  },
  {
    id: 'staff-training', ready: false, emoji: '👩‍🏫',
    title: 'הדרכת צוות חינוכי',
    desc: 'עקרונות ABA לצוות החינוכי — ניהול כיתה, מתן הוראות אפקטיבי, חוקים ונהלים וחיזוקים.',
    to: '/knowledge/topic/staff-training',
  },
  {
    id: 'play', ready: false, emoji: '🧸',
    title: 'משחק',
    desc: 'המשחק ככלי טיפולי — יצירת עניין, אינטראקציה הדדית ולמידה דרך הנאה.',
    to: '/knowledge/topic/play',
  },
  {
    id: 'problem-solving', ready: false, emoji: '🧭',
    title: 'פתרון בעיות',
    desc: 'זיהוי מקור הקושי ובניית מענה מדורג, מבוסס-נתונים, לשינוי התנהגות.',
    to: '/knowledge/topic/problem-solving',
  },
  {
    id: 'learning', ready: false, emoji: '📖',
    title: 'למידה',
    desc: 'איך ילדים רוכשים מיומנויות — עקרונות למידה, פירוק משימה, הכללה ושימור.',
    to: '/knowledge/topic/learning',
  },
  {
    id: 'rapport', ready: false, emoji: '🤝',
    title: 'יצירת קשר',
    desc: 'בניית אמון וקשר ראשוני עם הילד — הבסיס לכל תהליך טיפולי.',
    to: '/knowledge/topic/rapport',
  },
];

export function findTopic(id: string | undefined) {
  return TOPICS.find(t => t.id === id);
}
