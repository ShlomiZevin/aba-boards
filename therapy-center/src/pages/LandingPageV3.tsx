import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

const WHATSAPP_URL = 'https://wa.me/972542801162';
const WA_ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="white"><path d="M16 0C7.2 0 0 7.2 0 16c0 2.8.7 5.5 2.1 7.9L.7 31.3l7.6-2a16 16 0 007.7 2C24.8 31.3 32 24.1 32 15.3 32 7.2 24.8 0 16 0zm8 22.6c-.4 1.1-2 2-3.2 2.3-.8.2-1.9.3-5.6-1.2-4.7-2-7.7-6.7-7.9-7-.2-.3-1.8-2.4-1.8-4.7 0-2.2 1.1-3.3 1.6-3.7.4-.5.9-.6 1.2-.6h.8c.3 0 .7-.1 1 .7.4.9 1.4 3.4 1.5 3.6.1.2.2.5 0 .8l-.4.8c-.2.3-.4.5-.1.9.2.3 1.1 1.8 2.4 2.9 1.6 1.4 3 1.9 3.4 2.1.5.2.7.2 1-.1.2-.3.9-1 1.2-1.4.2-.4.5-.3.8-.2.3.1 2 1 2.4 1.1.3.2.6.3.7.4.1.2.1.9-.3 1.7z"/></svg>');

/* ── Icons ── */
function Ico({ d, size = 20, color = 'currentColor', sw = 2 }: { d: string; size?: number; color?: string; sw?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />;
}

const ICONS = {
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  clipboard: '<path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/>',
  file: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  arrowL: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  sparkle: '<path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/>',
  chevDown: '<polyline points="6 9 12 15 18 9"/>',
};

/* ── Reveal ── */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className="v3-reveal" style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(20px)', transitionDelay: `${delay}ms` }}>{children}</div>;
}

/* ── Animated counter ── */
function Counter({ end }: { end: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        obs.disconnect();
        let start = 0;
        const step = Math.ceil(end / 40);
        const id = setInterval(() => {
          start += step;
          if (start >= end) { setVal(end); clearInterval(id); }
          else setVal(start);
        }, 25);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [end]);
  return <span ref={ref}>{val}</span>;
}

/* ── Feature tab contents ── */
const FEATURES = [
  {
    id: 'goals',
    icon: ICONS.target,
    tab: 'מטרות',
    title: 'מטרות טיפוליות ומעקב התקדמות',
    desc: 'הגדירו מטרות מדידות לכל ילד, עקבו אחרי אחוזי הצלחה לאורך זמן, וצפו בגרפים שמראים את ההתקדמות האמיתית. כל סשן מזין נתונים שהופכים לתובנות מיידיות.',
    bullets: ['גרפי התקדמות שבועיים וחודשיים', 'מטרות עם קריטריונים מדידים', 'ספריית מטרות משותפת למרכז', 'עדכון נתונים ישירות מהטופס'],
  },
  {
    id: 'calendar',
    icon: ICONS.calendar,
    tab: 'יומן',
    title: 'יומן סשנים ולוח שנה',
    desc: 'כל הסשנים של כל המטפלות — ביומן אחד ברור. צפו בלוח השבועי, סננו לפי מטפלת, ותראו מי עבד עם מי ומתי. כל סשן מקושר ישירות לטופס שמולא.',
    bullets: ['תצוגת יומן שבועית וחודשית', 'צבע ייחודי לכל מטפלת', 'קישור ישיר מסשן לטופס', 'עובד מושלם גם בנייד'],
  },
  {
    id: 'forms',
    icon: ICONS.clipboard,
    tab: 'טפסים',
    title: 'טפסים מקצועיים ואיסוף נתונים',
    desc: 'צרו טפסי מעקב טיפולי מותאמים — עם סעיפים לכל מטרה, מד שיתוף פעולה, ספירת ניסיונות/הצלחות, והערות חופשיות. כל הנתונים נשמרים ומוזנים ישירות לגרפי ההתקדמות.',
    bullets: ['טפסי סשן מותאמים אישית', 'טפסי ישיבות צוות', 'איסוף נתונים כמותי לכל מטרה', 'שמירה אוטומטית ועריכה חוזרת'],
  },
  {
    id: 'team',
    icon: ICONS.users,
    tab: 'צוות',
    title: 'ניהול צוות מטפלות',
    desc: 'שייכו מטפלות לילדים, עקבו אחרי מספר הסשנים של כל מטפלת, ותנו לכל מטפלת גישה מותאמת — היא רואה רק את הילדים שלה, ממלאה טפסים, ומקבלת התראות רלוונטיות.',
    bullets: ['פרופיל מטפלת עם תפקיד ומומחיות', 'גישה מבוקרת לפי שיוך', 'ממשק מטפלת נפרד ופשוט', 'סטטיסטיקות פעילות למטפלת'],
  },
];

/* ── Feature mockup panels (shown inside tabs) ── */
function GoalsMockup() {
  const data = [
    { name: 'משחק חברתי בתורות', pct: 78, c: '#7c5cfc' },
    { name: 'העתקת דגם קוביות', pct: 45, c: '#d97706' },
    { name: 'מיון קטגוריות', pct: 92, c: '#059669' },
    { name: 'למידה בספרים', pct: 60, c: '#dc2626' },
  ];
  return (
    <div className="v3-panel">
      <div className="v3-panel-head"><Ico d={ICONS.target} size={15} color="#7c5cfc" /><span>מעקב מטרות</span><em>שבועי</em></div>
      {data.map((g, i) => (
        <div key={i} className="v3-panel-row">
          <span className="v3-panel-row-name">{g.name}</span>
          <span className="v3-panel-row-pct" style={{ color: g.c }}>{g.pct}%</span>
          <div className="v3-bar"><div style={{ width: `${g.pct}%`, background: g.c }} /></div>
        </div>
      ))}
    </div>
  );
}

function CalendarMockup() {
  const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳'];
  const ev = [
    { d: 0, h: '09:00', n: 'רונית כ.', c: '#7c5cfc' },
    { d: 0, h: '14:00', n: 'מיכל ש.', c: '#d97706' },
    { d: 1, h: '10:00', n: 'רונית כ.', c: '#7c5cfc' },
    { d: 2, h: '09:00', n: 'דנה ל.', c: '#059669' },
    { d: 2, h: '16:00', n: 'רונית כ.', c: '#7c5cfc' },
    { d: 3, h: '10:00', n: 'מיכל ש.', c: '#d97706' },
    { d: 4, h: '09:00', n: 'רונית כ.', c: '#7c5cfc' },
  ];
  return (
    <div className="v3-panel">
      <div className="v3-panel-head"><Ico d={ICONS.calendar} size={15} color="#7c5cfc" /><span>לוח סשנים</span><em>מרץ 2026</em></div>
      <div className="v3-cal">
        {days.map((d, di) => (
          <div key={di}>
            <div className="v3-cal-hd">{d}</div>
            {ev.filter(e => e.d === di).map((e, ei) => (
              <div key={ei} className="v3-cal-ev" style={{ borderInlineStart: `3px solid ${e.c}` }}>
                <span style={{ color: e.c, fontWeight: 700, fontSize: 10 }}>{e.h}</span>
                <span style={{ fontSize: 11 }}>{e.n}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function FormMockup() {
  return (
    <div className="v3-panel">
      <div className="v3-panel-head"><Ico d={ICONS.clipboard} size={15} color="#7c5cfc" /><span>טופס מעקב</span><em>{'יואב כהן — #34'}</em></div>
      <div className="v3-form-mock">
        <label>שיתוף פעולה</label>
        <div className="v3-form-coop"><div style={{ width: '75%' }} /><span>75%</span></div>
        <label>מטרה: משחק חברתי בתורות</label>
        <div className="v3-form-trio">
          <div><strong>8</strong><small>ניסיונות</small></div>
          <div><strong style={{ color: '#059669' }}>6</strong><small>הצלחות</small></div>
          <div><strong style={{ color: '#7c5cfc' }}>75%</strong><small>אחוז</small></div>
        </div>
        <label>הערות</label>
        <div className="v3-form-note">התקדמות יפה במשחק בתורות. הגיב טוב למשחק עם בובות...</div>
      </div>
    </div>
  );
}

function TeamMockup() {
  const team = [
    { n: 'רונית כהן', r: 'מטפלת התנהגותית', c: '#7c5cfc', s: 12, i: 'ר.כ' },
    { n: 'מיכל שפירא', r: 'ריפוי בעיסוק', c: '#d97706', s: 8, i: 'מ.ש' },
    { n: 'דנה לוי', r: 'קלינאית תקשורת', c: '#059669', s: 6, i: 'ד.ל' },
    { n: 'ד"ר אבי מזרחי', r: 'פסיכולוג', c: '#7c3aed', s: 3, i: 'א.מ' },
  ];
  return (
    <div className="v3-panel">
      <div className="v3-panel-head"><Ico d={ICONS.users} size={15} color="#7c5cfc" /><span>{'צוות מטפלים'}</span></div>
      {team.map((t, i) => (
        <div key={i} className="v3-team-r">
          <div className="v3-team-av" style={{ background: t.c + '14', color: t.c }}>{t.i}</div>
          <div className="v3-team-meta"><div className="v3-team-n">{t.n}</div><div className="v3-team-rl">{t.r}</div></div>
          <div className="v3-team-ct" style={{ color: t.c }}>{t.s}<small>סשנים</small></div>
        </div>
      ))}
    </div>
  );
}

const MOCKUPS: Record<string, () => JSX.Element> = { goals: GoalsMockup, calendar: CalendarMockup, forms: FormMockup, team: TeamMockup };

/* ── Hero Dashboard Mockup ── */
function HeroDashboard() {
  return (
    <div className="v3-hdash">
      {/* Browser chrome */}
      <div className="v3-hdash-chrome">
        <div className="v3-hdash-dots"><span /><span /><span /></div>
        <div className="v3-hdash-url">doing.startdoing.co.il/therapy</div>
      </div>

      <div className="v3-hdash-body">
        {/* Sidebar */}
        <div className="v3-hdash-side">
          <div className="v3-hdash-side-logo">
            <div className="v3-hdash-side-icon"><Ico d={ICONS.target} size={14} color="#818cf8" /></div>
            <span>Doing</span>
          </div>
          {[
            { i: ICONS.users, t: 'ילדים', active: true },
            { i: ICONS.calendar, t: 'יומן', active: false },
            { i: ICONS.clipboard, t: 'טפסים', active: false },
            { i: ICONS.chart, t: 'מטרות', active: false },
            { i: ICONS.sparkle, t: 'AI', active: false },
          ].map((item, idx) => (
            <div key={idx} className={`v3-hdash-side-item ${item.active ? 'v3-hdash-side-active' : ''}`}>
              <Ico d={item.i} size={13} color={item.active ? '#818cf8' : '#475569'} />
              <span>{item.t}</span>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="v3-hdash-main">
          {/* Top bar */}
          <div className="v3-hdash-topbar">
            <span className="v3-hdash-title">הילדים שלי</span>
            <div className="v3-hdash-search">
              <Ico d='<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' size={12} color="#475569" />
              <span>חיפוש...</span>
            </div>
          </div>

          {/* Kid cards grid */}
          <div className="v3-hdash-kids">
            {[
              { name: 'יואב כהן', age: '4.5', avatar: 'י.כ', color: '#7c5cfc', goals: 6, pct: 78, sessions: 12, badge: 'פעיל' },
              { name: 'נועה לוי', age: '5', avatar: 'נ.ל', color: '#059669', goals: 4, pct: 92, sessions: 8, badge: 'מצטיינת' },
              { name: 'אדם מזרחי', age: '3.5', avatar: 'א.מ', color: '#d97706', goals: 5, pct: 45, sessions: 10, badge: 'חדש' },
            ].map((kid, i) => (
              <div key={i} className="v3-hdash-kid">
                <div className="v3-hdash-kid-top">
                  <div className="v3-hdash-kid-av" style={{ background: kid.color + '20', color: kid.color }}>{kid.avatar}</div>
                  <div>
                    <div className="v3-hdash-kid-name">{kid.name}</div>
                    <div className="v3-hdash-kid-age">גיל {kid.age}</div>
                  </div>
                  <span className="v3-hdash-kid-badge" style={{ color: kid.color, background: kid.color + '15' }}>{kid.badge}</span>
                </div>
                <div className="v3-hdash-kid-stats">
                  <div><strong>{kid.goals}</strong><small>מטרות</small></div>
                  <div><strong style={{ color: kid.color }}>{kid.pct}%</strong><small>התקדמות</small></div>
                  <div><strong>{kid.sessions}</strong><small>סשנים</small></div>
                </div>
                <div className="v3-hdash-kid-bar">
                  <div style={{ width: `${kid.pct}%`, background: kid.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Bottom panels row */}
          <div className="v3-hdash-bottom">
            {/* Mini calendar */}
            <div className="v3-hdash-cal-panel">
              <div className="v3-hdash-panel-hd"><Ico d={ICONS.calendar} size={12} color="#818cf8" /><span>סשנים היום</span></div>
              {[
                { time: '09:00', name: 'רונית כ. ← יואב', color: '#7c5cfc' },
                { time: '11:00', name: 'דנה ל. ← נועה', color: '#059669' },
                { time: '14:00', name: 'מיכל ש. ← אדם', color: '#d97706' },
              ].map((s, i) => (
                <div key={i} className="v3-hdash-cal-row">
                  <div className="v3-hdash-cal-dot" style={{ background: s.color }} />
                  <span className="v3-hdash-cal-time">{s.time}</span>
                  <span className="v3-hdash-cal-name">{s.name}</span>
                </div>
              ))}
            </div>

            {/* Mini goals progress */}
            <div className="v3-hdash-goals-panel">
              <div className="v3-hdash-panel-hd"><Ico d={ICONS.target} size={12} color="#818cf8" /><span>מטרות בהתקדמות</span></div>
              {[
                { name: 'משחק חברתי', pct: 78, color: '#7c5cfc' },
                { name: 'מיון קטגוריות', pct: 92, color: '#059669' },
                { name: 'העתקת דגם', pct: 45, color: '#d97706' },
              ].map((g, i) => (
                <div key={i} className="v3-hdash-goal-row">
                  <div className="v3-hdash-goal-info">
                    <span>{g.name}</span>
                    <span style={{ color: g.color }}>{g.pct}%</span>
                  </div>
                  <div className="v3-hdash-goal-bar"><div style={{ width: `${g.pct}%`, background: g.color }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── AI Chat ── */
function AiChat() {
  const [idx, setIdx] = useState(0);
  const msgs = [
    { r: 'user', t: 'תכין לי טופס הערכה ליואב עם התמקדות במיומנויות קוגניטיביות' },
    { r: 'ai', t: 'הכנתי טופס הערכה עם 4 סעיפים: משחק חברתי בתורות, העתקת דגם קוביות, מיון קטגוריות, ולמידה בספרים. רוצה שאוסיף משהו?' },
    { r: 'user', t: 'תוסיף גם חלק על ויסות רגשי. מה המצב של המטרות שלו השבוע?' },
    { r: 'ai', t: 'הוספתי! לגבי המטרות: משחק בתורות ב\u200E-78% (עלייה), העתקת דגם ב\u200E-45% (יציב), מיון קטגוריות ב\u200E-92% (מצוין!)' },
  ];
  useEffect(() => {
    if (idx < msgs.length) { const t = setTimeout(() => setIdx(p => p + 1), 2200); return () => clearTimeout(t); }
  }, [idx, msgs.length]);

  return (
    <div className="v3-aichat">
      <div className="v3-aichat-bar"><Ico d={ICONS.sparkle} size={16} color="#818cf8" /><span>{'עוזר AI — Doing'}</span><small>מוכן</small></div>
      <div className="v3-aichat-body">
        {msgs.slice(0, idx).map((m, i) => (
          <div key={i} className={`v3-msg v3-msg-${m.r}`}>
            {m.r === 'ai' && <div className="v3-msg-dot"><Ico d={ICONS.sparkle} size={11} color="#818cf8" /></div>}
            <div className={`v3-bub v3-bub-${m.r}`}>{m.t}</div>
          </div>
        ))}
        {idx < msgs.length && (
          <div className="v3-msg v3-msg-ai"><div className="v3-msg-dot"><Ico d={ICONS.sparkle} size={11} color="#818cf8" /></div>
            <div className="v3-bub v3-bub-ai v3-typing"><span /><span /><span /></div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Persona accordion ── */
function PersonaAccordion() {
  const [open, setOpen] = useState(0);
  const items = [
    { icon: ICONS.users, title: 'מנהלי מרכזי טיפול', desc: 'ראו את כל הילדים, כל המטפלות, כל הסשנים — מסך אחד. קבלו החלטות מבוססות נתונים.', tags: ['ניהול מרכזי של צוותים', 'דוחות ותובנות', 'ספריית מטרות משותפת'] },
    { icon: ICONS.clipboard, title: 'מטפלות ואנשי מקצוע', desc: 'מלאו טפסים בקלות, ראו את ההתקדמות של הילדים שלכם, ותקשרו עם הצוות — הכל מהנייד.', tags: ['מילוי טפסים מהיר', 'גישה מהנייד', 'צפייה במטרות'] },
    { icon: ICONS.shield, title: 'הורים', desc: 'קבלו קישור אישי לצפייה בלוח המשימות של ילדכם, ראו את ההתקדמות, ותהיו חלק מהתהליך.', tags: ['לוח משימות ויזואלי', 'מעקב התקדמות', 'שקיפות מלאה'] },
    { icon: ICONS.target, title: 'מטפלות עצמאיות', desc: 'גם בלי מרכז — נהלו את הילדים שלכם בצורה מקצועית. טפסים, מטרות, לוחות — הכל במקום אחד.', tags: ['ניהול עצמאי', 'AI שעוזר', 'חינם להתחלה'] },
  ];
  return (
    <div className="v3-acc">
      {items.map((it, i) => (
        <div key={i} className={`v3-acc-item ${open === i ? 'v3-acc-open' : ''}`} onClick={() => setOpen(i)}>
          <div className="v3-acc-head">
            <div className="v3-acc-icon"><Ico d={it.icon} size={20} color={open === i ? '#7c5cfc' : '#64748b'} /></div>
            <span className="v3-acc-title">{it.title}</span>
            <Ico d={ICONS.chevDown} size={16} color="#94a3b8" />
          </div>
          {open === i && (
            <div className="v3-acc-body">
              <p>{it.desc}</p>
              <div className="v3-acc-tags">{it.tags.map((t, ti) => <span key={ti}><Ico d={ICONS.check} size={12} color="#059669" sw={3} /> {t}</span>)}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  MAIN                                                               */
/* ================================================================== */
export default function LandingPageV3() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 32);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const ActiveMockup = MOCKUPS[FEATURES[activeTab].id];

  return (
    <div className="v3-root" dir="rtl">

      {/* ━━ NAV ━━ */}
      <nav className={`v3-nav ${scrolled ? 'v3-nav-s' : ''}`}>
        <div className="v3-w">
          <img src="/therapy/doing-logo-transparent2.png" alt="Doing" className="v3-nav-logo" />
          <div className="v3-nav-links">
            <a href="#features">יכולות</a>
            <a href="#ai">בינה מלאכותית</a>
            <a href="#benefits">יתרונות</a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">צור קשר</a>
          </div>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="v3-nav-demo">תיאום הדגמה</a>
          <button className="v3-nav-btn" onClick={() => navigate('/login')}>כניסה למערכת</button>
        </div>
      </nav>

      {/* ━━ HERO — Slack-style centered ━━ */}
      <section className="v3-hero">
        <Reveal>
          <div className="v3-hero-center">
            <h1 className="v3-hero-h1">
              {'ניהול מרכז טיפול.'}
              <br />
              {'נתונים. מטרות. צוות.'}
            </h1>
            <p className="v3-hero-sub">
              {'מערכת אחת שמחליפה אקסלים, תיקיות ונייר — עם בינה מלאכותית שמבינה טיפול.'}
            </p>
            <div className="v3-hero-btns">
              <button className="v3-btn v3-btn-fill" onClick={() => navigate('/signup')}>{'התחילו בחינם'}</button>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="v3-btn v3-btn-out">{'תיאום הדגמה \u2190'}</a>
            </div>
            <div className="v3-hero-trust">
              <span>ללא התחייבות</span>
              <span className="v3-hero-trust-dot" />
              <span>הקמה תוך דקות</span>
              <span className="v3-hero-trust-dot" />
              <span>תמיכה מקצועית בעברית</span>
            </div>
          </div>
        </Reveal>

        {/* Hero Dashboard Mockup */}
        <Reveal delay={200}>
          <HeroDashboard />
        </Reveal>
      </section>

      {/* ━━ FEATURES — tabbed showcase ━━ */}
      <section id="features" className="v3-sec">
        <div className="v3-w">
          <Reveal>
            <div className="v3-sec-hd">
              <span className="v3-tag">יכולות המערכת</span>
              <h2 className="v3-h2">כל מה שצריך לניהול טיפול מקצועי</h2>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="v3-tabs-wrap">
              {/* Tab bar */}
              <div className="v3-tabs">
                {FEATURES.map((f, i) => (
                  <button key={f.id} className={`v3-tab ${activeTab === i ? 'v3-tab-on' : ''}`} onClick={() => setActiveTab(i)}>
                    <Ico d={f.icon} size={18} color={activeTab === i ? '#7c5cfc' : '#94a3b8'} />
                    <span>{f.tab}</span>
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="v3-tabs-body">
                <div className="v3-tabs-text">
                  <h3 className="v3-h3">{FEATURES[activeTab].title}</h3>
                  <p className="v3-tabs-desc">{FEATURES[activeTab].desc}</p>
                  <ul className="v3-ul">
                    {FEATURES[activeTab].bullets.map((b, bi) => (
                      <li key={bi}><Ico d={ICONS.check} size={14} color="#7c5cfc" sw={3} /><span>{b}</span></li>
                    ))}
                  </ul>
                </div>
                <div className="v3-tabs-mock">
                  <ActiveMockup />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ━━ AI — full-bleed dark ━━ */}
      <section id="ai" className="v3-ai">
        <div className="v3-w">
          <Reveal>
            <div className="v3-sec-hd">
              <span className="v3-tag v3-tag-lt">בינה מלאכותית</span>
              <h2 className="v3-h2" style={{ color: '#f8fafc' }}>עוזר AI שמבין טיפול</h2>
              <p className="v3-ai-sub">
                {'לא צריך להיות טכנולוגי — פשוט כתבו מה שאתם צריכים בעברית רגילה והבינה המלאכותית תעשה את השאר'}
              </p>
            </div>
          </Reveal>

          <div className="v3-ai-grid">
            <Reveal><AiChat /></Reveal>
            <Reveal delay={150}>
              <div className="v3-ai-right">
                <div className="v3-ai-caps">
                  {[
                    { i: ICONS.clipboard, t: 'יצירת טפסים' },
                    { i: ICONS.target, t: 'הגדרת מטרות' },
                    { i: ICONS.chart, t: 'ניתוח נתונים' },
                    { i: ICONS.bulb, t: 'סיעור מוחות' },
                    { i: ICONS.file, t: 'סיכומים' },
                    { i: ICONS.calendar, t: 'לוחות משימות' },
                  ].map((c, ci) => (
                    <div key={ci} className="v3-ai-chip"><Ico d={c.i} size={16} color="#a5b4fc" /><span>{c.t}</span></div>
                  ))}
                </div>
                <div className="v3-ai-box">
                  <Ico d={ICONS.sparkle} size={18} color="#a5b4fc" />
                  <div>
                    <strong>הבינה המלאכותית מכירה את כל הנתונים שלכם</strong>
                    <p>{'היא יכולה לגשת למידע על הילדים, לנתח התקדמות, ליצור טפסים ולוחות, להציע מטרות, ולעזור בסיעור מוחות — הכל בשיחה פשוטה. כמו עוזרת מנהלית שעובדת 24/7.'}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ━━ BENEFITS — horizontal cards ━━ */}
      <section id="benefits" className="v3-sec">
        <div className="v3-w">
          <Reveal>
            <div className="v3-sec-hd">
              <span className="v3-tag">יתרונות</span>
              <h2 className="v3-h2">למה מרכזי טיפול בוחרים ב-Doing</h2>
            </div>
          </Reveal>
          <div className="v3-bento">
            {[
              { i: ICONS.clock, t: 'חסכון בזמן', d: 'במקום שעות של ניירת — דקות. טפסים אוטומטיים, נתונים שמתעדכנים לבד, ובינה מלאכותית שעושה בשבילכם.', big: true },
              { i: ICONS.chart, t: 'החלטות מבוססות נתונים', d: 'כל סשן מייצר נתונים. כל נתון הופך לגרף. כל גרף מספר סיפור.' },
              { i: ICONS.users, t: 'עבודת צוות מושלמת', d: 'כולם רואים את אותו מידע. מטפלות יודעות מה קרה בסשן הקודם.' },
              { i: ICONS.phone, t: 'נגיש מכל מקום', d: 'עובד בנייד, בטאבלט ובמחשב. מטפלות ממלאות טפסים תוך כדי הסשן.' },
              { i: ICONS.shield, t: 'פרטיות ואבטחה', d: 'כל מטפלת רואה רק את הילדים שמשויכים אליה. הנתונים מוגנים.' },
              { i: ICONS.cpu, t: 'AI שעוזר באמת', d: 'לא גימיק — בינה מלאכותית שמבינה טיפול, יוצרת טפסים, מנתחת נתונים, ומציעה מטרות.', big: true },
            ].map((b, i) => (
              <Reveal key={i} delay={i * 50}>
                <div className={`v3-bento-card ${(b as any).big ? 'v3-bento-big' : ''}`}>
                  <div className="v3-bento-ico"><Ico d={b.i} size={22} color="#7c5cfc" /></div>
                  <h4>{b.t}</h4>
                  <p>{b.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ WHO — accordion ━━ */}
      <section className="v3-sec" style={{ background: '#f5f0ff' }}>
        <div className="v3-w">
          <Reveal>
            <div className="v3-sec-hd">
              <span className="v3-tag">למי זה מתאים</span>
              <h2 className="v3-h2">למי המערכת מתאימה?</h2>
            </div>
          </Reveal>
          <Reveal delay={100}><PersonaAccordion /></Reveal>
        </div>
      </section>

      {/* ━━ CTA ━━ */}
      <section id="contact" className="v3-cta">
        <Reveal>
          <h2>מוכנים לשדרג את ניהול הטיפול?</h2>
          <p>הצטרפו למרכזי טיפול שכבר עובדים עם Doing</p>
          <div className="v3-cta-btns">
            <button className="v3-btn v3-btn-fill v3-btn-lg" onClick={() => navigate('/signup')}>{'התחילו לעשות — חינם'}<Ico d={ICONS.arrowL} size={15} /></button>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="v3-btn v3-btn-wa">
              <img src={WA_ICON} alt="" width={20} height={20} /> דברו איתנו בוואטסאפ
            </a>
          </div>
          <small>{'ללא כרטיס אשראי \u2022 הקמה תוך דקות \u2022 תמיכה בעברית'}</small>
        </Reveal>
      </section>

      {/* ━━ FOOTER ━━ */}
      <footer className="v3-foot">
        <div className="v3-w v3-foot-in">
          <div className="v3-foot-brand">
            <img src="/therapy/doing-logo-transparent2.png" alt="Doing" />
            <span>ניהול טיפול חכם</span>
          </div>
          <div className="v3-foot-links">
            <a href="#features">יכולות</a><a href="#ai">בינה מלאכותית</a><a href="#benefits">יתרונות</a>
          </div>
          <div className="v3-foot-copy">{'© 2026 Doing — כל הזכויות שמורות'}</div>
        </div>
      </footer>

      {/* ━━ FLOATING WA ━━ */}
      <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="v3-waf">
        <img src={WA_ICON} alt="" width={24} height={24} />
        <span className="v3-waf-txt">דברו איתנו</span>
      </a>
    </div>
  );
}
