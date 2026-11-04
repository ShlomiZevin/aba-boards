import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

const WHATSAPP_URL = 'https://wa.me/972542801162';
const WA_ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="white"><path d="M16 0C7.2 0 0 7.2 0 16c0 2.8.7 5.5 2.1 7.9L.7 31.3l7.6-2a16 16 0 007.7 2C24.8 31.3 32 24.1 32 15.3 32 7.2 24.8 0 16 0zm8 22.6c-.4 1.1-2 2-3.2 2.3-.8.2-1.9.3-5.6-1.2-4.7-2-7.7-6.7-7.9-7-.2-.3-1.8-2.4-1.8-4.7 0-2.2 1.1-3.3 1.6-3.7.4-.5.9-.6 1.2-.6h.8c.3 0 .7-.1 1 .7.4.9 1.4 3.4 1.5 3.6.1.2.2.5 0 .8l-.4.8c-.2.3-.4.5-.1.9.2.3 1.1 1.8 2.4 2.9 1.6 1.4 3 1.9 3.4 2.1.5.2.7.2 1-.1.2-.3.9-1 1.2-1.4.2-.4.5-.3.8-.2.3.1 2 1 2.4 1.1.3.2.6.3.7.4.1.2.1.9-.3 1.7z"/></svg>');

/* ------------------------------------------------------------------ */
/*  SVG Icon components — replace all emojis                           */
/* ------------------------------------------------------------------ */
function IconTarget({ size = 20, color = '#6366f1' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconChart({ size = 20, color = '#6366f1' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconCalendar({ size = 20, color = '#6366f1' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconClipboard({ size = 20, color = '#6366f1' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  );
}

function IconUsers({ size = 20, color = '#6366f1' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconShield({ size = 20, color = '#6366f1' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconCpu({ size = 20, color = '#6366f1' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}

function IconClock({ size = 20, color = '#6366f1' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconSmartphone({ size = 20, color = '#6366f1' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function IconLightbulb({ size = 20, color = '#6366f1' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" /><path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14" />
    </svg>
  );
}

function IconFileText({ size = 20, color = '#6366f1' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconCheck({ size = 16, color = '#6366f1' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconArrowLeft({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Scroll-reveal wrapper                                              */
/* ------------------------------------------------------------------ */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="v2-reveal"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Icon wrapper — consistent icon circle                              */
/* ------------------------------------------------------------------ */
function IconCircle({ children, size = 48, bg = '#eef2ff' }: { children: ReactNode; size?: number; bg?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 12,
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero System Preview — cleaner, fewer elements, more readable       */
/* ------------------------------------------------------------------ */
function HeroPreview() {
  return (
    <div className="v2-preview">
      <div className="v2-preview-chrome">
        <div className="v2-preview-dots">
          <span /><span /><span />
        </div>
        <div className="v2-preview-url">app.startdoing.co.il</div>
      </div>
      <div className="v2-preview-body">
        <div className="v2-preview-sidebar">
          <div className="v2-preview-sidebar-logo">Doing</div>
          <div className="v2-preview-menu v2-preview-menu-active">דשבורד</div>
          <div className="v2-preview-menu">מטופלים</div>
          <div className="v2-preview-menu">מטרות</div>
          <div className="v2-preview-menu">טפסים</div>
          <div className="v2-preview-menu">לוח זמנים</div>
        </div>
        <div className="v2-preview-main">
          {/* Metrics row */}
          <div className="v2-preview-metrics">
            <div className="v2-preview-metric">
              <div className="v2-preview-metric-label">מטופלים פעילים</div>
              <div className="v2-preview-metric-value">83</div>
            </div>
            <div className="v2-preview-metric">
              <div className="v2-preview-metric-label">סשנים השבוע</div>
              <div className="v2-preview-metric-value">47</div>
            </div>
            <div className="v2-preview-metric">
              <div className="v2-preview-metric-label">מטרות בהתקדמות</div>
              <div className="v2-preview-metric-value">156</div>
            </div>
          </div>
          {/* Chart */}
          <div className="v2-preview-chart">
            <div className="v2-preview-chart-title">התקדמות מטרות — 4 שבועות אחרונים</div>
            <div className="v2-preview-chart-bars">
              {[45, 58, 72, 65, 80, 75, 88, 82].map((h, i) => (
                <div key={i} className="v2-preview-bar-col">
                  <div className="v2-preview-bar" style={{ height: `${h}%` }} />
                </div>
              ))}
            </div>
          </div>
          {/* Table */}
          <div className="v2-preview-table">
            <div className="v2-preview-table-row v2-preview-table-header">
              <span>מטופל</span><span>מטרה</span><span>התקדמות</span><span>סטטוס</span>
            </div>
            {[
              { name: 'י.כ', goal: 'משחק חברתי', progress: 78, status: 'בטיפול' },
              { name: 'נ.ל', goal: 'העתקת דגם', progress: 92, status: 'הושג' },
              { name: 'ר.ש', goal: 'חיוי הנגריות', progress: 45, status: 'בטיפול' },
            ].map((row, i) => (
              <div key={i} className="v2-preview-table-row">
                <span className="v2-preview-table-name">{row.name}</span>
                <span>{row.goal}</span>
                <span>
                  <div className="v2-preview-progress">
                    <div className="v2-preview-progress-fill" style={{ width: `${row.progress}%` }} />
                  </div>
                </span>
                <span className={row.status === 'הושג' ? 'v2-status-done' : 'v2-status-active'}>{row.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mockup: Goals — professional, no emojis                            */
/* ------------------------------------------------------------------ */
function MockupGoals() {
  const goals = [
    { name: 'משחק חברתי בתורות', progress: 78, color: '#6366f1' },
    { name: 'העתקת דגם קוביות', progress: 45, color: '#f59e0b' },
    { name: 'מיון קטגוריות', progress: 92, color: '#10b981' },
    { name: 'למידה בספרים', progress: 60, color: '#ef4444' },
  ];
  return (
    <div className="v2-mockup-card">
      <div className="v2-mockup-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconCircle size={36}><IconTarget size={18} /></IconCircle>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>מעקב מטרות</span>
        </div>
        <span className="v2-badge-green">שבועי</span>
      </div>
      {goals.map((g, i) => (
        <div key={i} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
            <span style={{ color: '#374151' }}>{g.name}</span>
            <span style={{ fontWeight: 700, color: g.color }}>{g.progress}%</span>
          </div>
          <div className="v2-progress-bar">
            <div className="v2-progress-fill" style={{ width: `${g.progress}%`, background: g.color }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
        ממוצע התקדמות: 69% — עלייה של 12% מהשבוע שעבר
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mockup: Calendar — professional                                    */
/* ------------------------------------------------------------------ */
function MockupCalendar() {
  const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳'];
  const sessions = [
    { day: 0, hour: '09:00', name: 'רונית כ.', color: '#6366f1', type: 'התנהגותי' },
    { day: 0, hour: '14:00', name: 'מיכל ש.', color: '#f59e0b', type: 'ריפוי בעיסוק' },
    { day: 1, hour: '10:00', name: 'רונית כ.', color: '#6366f1', type: 'התנהגותי' },
    { day: 2, hour: '09:00', name: 'דנה ל.', color: '#10b981', type: 'שפה' },
    { day: 2, hour: '16:00', name: 'רונית כ.', color: '#6366f1', type: 'רגשי' },
    { day: 3, hour: '10:00', name: 'מיכל ש.', color: '#f59e0b', type: 'ריפוי בעיסוק' },
    { day: 4, hour: '09:00', name: 'רונית כ.', color: '#6366f1', type: 'התנהגותי' },
  ];
  return (
    <div className="v2-mockup-card" style={{ maxWidth: 500 }}>
      <div className="v2-mockup-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconCircle size={36}><IconCalendar size={18} /></IconCircle>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>לוח סשנים שבועי</span>
        </div>
        <span style={{ fontSize: 13, color: '#6b7280' }}>מרץ 2026</span>
      </div>
      <div className="v2-cal-grid">
        {days.map((d, di) => (
          <div key={di} className="v2-cal-day">
            <div className="v2-cal-day-name">{d}</div>
            {sessions.filter(s => s.day === di).map((s, si) => (
              <div key={si} className="v2-cal-event" style={{ background: s.color + '14', borderRight: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{s.hour}</div>
                <div style={{ fontSize: 11, color: '#374151' }}>{s.name}</div>
                <div style={{ fontSize: 9, color: '#6b7280' }}>{s.type}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mockup: Form — professional, no emojis                             */
/* ------------------------------------------------------------------ */
function MockupForm() {
  return (
    <div className="v2-mockup-card" style={{ maxWidth: 400 }}>
      <div className="v2-mockup-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconCircle size={36}><IconClipboard size={18} /></IconCircle>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>טופס מעקב טיפולי</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{'יואב כהן — סשן #34 — 11.03.2026'}</div>
          </div>
        </div>
        <span className="v2-badge-indigo">טיפולי</span>
      </div>
      <div className="v2-form-section">
        <div className="v2-form-label">שיתוף פעולה</div>
        <div className="v2-cooperation-bar">
          <div className="v2-cooperation-fill" style={{ width: '75%' }} />
          <span className="v2-cooperation-text">75%</span>
        </div>
      </div>
      <div className="v2-form-section">
        <div className="v2-form-label">מטרה: משחק חברתי בתורות</div>
        <div className="v2-form-grid">
          <div className="v2-form-cell">
            <div className="v2-form-cell-label">ניסיונות</div>
            <div className="v2-form-cell-value">8</div>
          </div>
          <div className="v2-form-cell">
            <div className="v2-form-cell-label">הצלחות</div>
            <div className="v2-form-cell-value" style={{ color: '#10b981' }}>6</div>
          </div>
          <div className="v2-form-cell">
            <div className="v2-form-cell-label">אחוז</div>
            <div className="v2-form-cell-value" style={{ color: '#6366f1' }}>75%</div>
          </div>
        </div>
      </div>
      <div className="v2-form-section" style={{ borderBottom: 'none' }}>
        <div className="v2-form-label">הערות</div>
        <div className="v2-form-notes">
          התקדמות יפה במשחק בתורות. הגיב טוב למשחק עם בובות. יש לשים לב לזמן ההמתנה...
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mockup: Team — professional, no emojis                             */
/* ------------------------------------------------------------------ */
function MockupTeam() {
  const team = [
    { name: 'רונית כהן', role: 'מטפלת התנהגותית', color: '#6366f1', sessions: 12, initials: 'ר.כ' },
    { name: 'מיכל שפירא', role: 'ריפוי בעיסוק', color: '#f59e0b', sessions: 8, initials: 'מ.ש' },
    { name: 'דנה לוי', role: 'קלינאית תקשורת', color: '#10b981', sessions: 6, initials: 'ד.ל' },
    { name: 'ד"ר אבי מזרחי', role: 'פסיכולוג', color: '#8b5cf6', sessions: 3, initials: 'א.מ' },
  ];
  return (
    <div className="v2-mockup-card" style={{ width: 360 }}>
      <div className="v2-mockup-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconCircle size={36}><IconUsers size={18} /></IconCircle>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>{'צוות מטפלים — יואב'}</span>
        </div>
      </div>
      {team.map((t, i) => (
        <div key={i} className="v2-team-member">
          <div className="v2-team-avatar" style={{ background: t.color + '18', color: t.color }}>
            {t.initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>{t.name}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{t.role}</div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: t.color, fontSize: 16 }}>{t.sessions}</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>סשנים</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Chat mockup — professional, SVG icon instead of emoji           */
/* ------------------------------------------------------------------ */
function MockupChat() {
  const [typingIdx, setTypingIdx] = useState(0);
  const messages = [
    { role: 'user' as const, text: 'תכין לי טופס הערכה ליואב עם התמקדות במיומנויות קוגניטיביות' },
    { role: 'ai' as const, text: 'הכנתי טופס הערכה עם 4 סעיפים: משחק חברתי בתורות, העתקת דגם קוביות, מיון קטגוריות, ולמידה בספרים. רוצה שאוסיף משהו?' },
    { role: 'user' as const, text: 'תוסיף גם חלק על ויסות רגשי. מה המצב של המטרות שלו השבוע?' },
    { role: 'ai' as const, text: 'הוספתי! לגבי המטרות: משחק בתורות ב\u200E-78% (עלייה), העתקת דגם ב\u200E-45% (יציב), מיון קטגוריות ב\u200E-92% (מצוין!)' },
  ];

  useEffect(() => {
    if (typingIdx < messages.length) {
      const timer = setTimeout(() => setTypingIdx(prev => prev + 1), 1800);
      return () => clearTimeout(timer);
    }
  }, [typingIdx, messages.length]);

  return (
    <div className="v2-chat">
      <div className="v2-chat-header">
        <IconCircle size={40} bg="rgba(255,255,255,.15)"><IconCpu size={20} color="#a5b4fc" /></IconCircle>
        <div>
          <div style={{ fontWeight: 700 }}>{'עוזר AI — Doing'}</div>
          <div style={{ fontSize: 11, color: '#10b981' }}>מוכן לעזור</div>
        </div>
      </div>
      <div className="v2-chat-messages">
        {messages.slice(0, typingIdx).map((m, i) => (
          <div key={i} className={`v2-chat-msg v2-chat-${m.role}`}>
            {m.role === 'ai' && (
              <div className="v2-chat-ai-icon"><IconCpu size={14} color="#6366f1" /></div>
            )}
            <div className={`v2-chat-bubble v2-chat-bubble-${m.role}`}>{m.text}</div>
          </div>
        ))}
        {typingIdx < messages.length && (
          <div className="v2-chat-msg v2-chat-ai">
            <div className="v2-chat-ai-icon"><IconCpu size={14} color="#6366f1" /></div>
            <div className="v2-chat-bubble v2-chat-bubble-ai v2-typing">
              <span className="v2-dot" /><span className="v2-dot" /><span className="v2-dot" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Capabilities — professional icons                               */
/* ------------------------------------------------------------------ */
function AICapabilities() {
  const capabilities = [
    { icon: <IconClipboard size={20} color="#a5b4fc" />, title: 'יצירת טפסים', desc: 'בקשו מהבינה המלאכותית ליצור טופס הערכה מותאם אישית — היא תבנה אותו תוך שניות' },
    { icon: <IconTarget size={20} color="#a5b4fc" />, title: 'הגדרת מטרות', desc: 'תארו את האתגר — הבינה המלאכותית תציע מטרות מדידות עם קריטריונים מדויקים' },
    { icon: <IconChart size={20} color="#a5b4fc" />, title: 'ניתוח נתונים', desc: 'שאלו שאלות על ההתקדמות של ילד ותקבלו תובנות מעמיקות מבוססות נתונים' },
    { icon: <IconLightbulb size={20} color="#a5b4fc" />, title: 'סיעור מוחות', desc: 'התייעצו על אסטרטגיות טיפול, רעיונות לפעילויות, ופתרונות יצירתיים' },
    { icon: <IconFileText size={20} color="#a5b4fc" />, title: 'סיכומים', desc: 'בקשו סיכום שבועי/חודשי — הבינה המלאכותית תרכז את כל הנתונים בצורה ברורה' },
    { icon: <IconCalendar size={20} color="#a5b4fc" />, title: 'לוחות משימות', desc: 'בקשו לוח משימות מותאם — הבינה המלאכותית תיצור אותו עם משימות מתאימות' },
  ];

  return (
    <div className="v2-ai-grid">
      {capabilities.map((c, i) => (
        <div key={i} className="v2-ai-card">
          <IconCircle size={44} bg="rgba(99,102,241,.15)">{c.icon}</IconCircle>
          <div className="v2-ai-card-title">{c.title}</div>
          <div className="v2-ai-card-desc">{c.desc}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Logo                                                               */
/* ------------------------------------------------------------------ */
function Logo({ size = 'normal' }: { size?: 'normal' | 'large' }) {
  const h = size === 'large' ? 56 : 44;
  return (
    <div className="v2-logo">
      <img src="/therapy/doing-logo-transparent2.png" alt="Doing" style={{ height: h, width: 'auto' }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating WhatsApp                                                  */
/* ------------------------------------------------------------------ */
function WhatsAppFloat() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="v2-wa-float"
    >
      <img src={WA_ICON} alt="" style={{ width: 24, height: 24 }} />
      <span className="v2-wa-label">דברו איתנו</span>
    </a>
  );
}

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */
export default function LandingPageV2() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="v2-root" dir="rtl">
      {/* ---------- NAV ---------- */}
      <nav className={`v2-nav ${scrollY > 60 ? 'v2-nav-scrolled' : ''}`}>
        <div className="v2-nav-inner">
          <Logo size="large" />
          <div className="v2-nav-links">
            <a href="#features">יכולות</a>
            <a href="#ai">בינה מלאכותית</a>
            <a href="#benefits">יתרונות</a>
            <a href="#contact">צור קשר</a>
          </div>
          <div className="v2-nav-actions">
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="v2-nav-secondary">
              יצירת קשר
            </a>
            <button className="v2-nav-cta" onClick={() => navigate('/login')}>
              כניסה למערכת
            </button>
          </div>
        </div>
      </nav>

      {/* ---------- HERO ---------- */}
      <div className="v2-hero-wrapper">
        <section className="v2-hero">
          <div className="v2-hero-content">
            <div className="v2-hero-label">פלטפורמת ניהול טיפול למרכזים מקצועיים</div>
            <h1 className="v2-hero-title">
              ניהול מטרות טיפול, איסוף נתונים
              <br />
              <span className="v2-hero-accent">ומעקב טיפולי במקום אחד</span>
            </h1>
            <p className="v2-hero-subtitle">
              Doing מאפשרת למרכזי טיפול לנהל מטרות, לתעד מפגשים ולאסוף נתונים קליניים בצורה מסודרת. מערכת אחת שמחליפה אקסלים, תיקיות ונייר — עם בינה מלאכותית שמבינה טיפול.
            </p>
            <div className="v2-hero-actions">
              <button className="v2-btn v2-btn-primary v2-btn-large" onClick={() => navigate('/login')}>
                התחילו לעבוד עם Doing
                <IconArrowLeft size={18} />
              </button>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="v2-btn v2-btn-outline v2-btn-large">
                תיאום הדגמה
              </a>
            </div>
            <div className="v2-hero-trust">
              <div className="v2-trust-item"><IconCheck size={16} /><span>ללא התחייבות</span></div>
              <div className="v2-trust-item"><IconCheck size={16} /><span>הקמה תוך דקות</span></div>
              <div className="v2-trust-item"><IconCheck size={16} /><span>תמיכה מקצועית</span></div>
            </div>
          </div>
          <div className="v2-hero-visual">
            <HeroPreview />
          </div>
        </section>
      </div>

      {/* ---------- FEATURES ---------- */}
      <section id="features" className="v2-section">
        <div className="v2-container">
          <Reveal>
            <div className="v2-section-header">
              <div className="v2-section-badge">יכולות המערכת</div>
              <h2 className="v2-section-title">כל מה שצריך לניהול טיפול מקצועי</h2>
              <p className="v2-section-subtitle">מערכת אחת שמחליפה אקסלים, דפים, קבוצות וואטסאפ, ותיקיות</p>
            </div>
          </Reveal>

          {/* Feature 1: Goals */}
          <div className="v2-feature-row">
            <Reveal>
              <div className="v2-feature-text">
                <div className="v2-feature-number">01</div>
                <h3 className="v2-feature-title">מטרות טיפוליות ומעקב התקדמות</h3>
                <p className="v2-feature-desc">
                  הגדירו מטרות מדידות לכל ילד, עקבו אחרי אחוזי הצלחה לאורך זמן, וצפו בגרפים שמראים את ההתקדמות האמיתית. כל סשן מזין נתונים שהופכים לתובנות מיידיות.
                </p>
                <ul className="v2-feature-list">
                  <li><IconCheck size={14} /><span>גרפי התקדמות שבועיים וחודשיים</span></li>
                  <li><IconCheck size={14} /><span>מטרות עם קריטריונים מדידים</span></li>
                  <li><IconCheck size={14} /><span>ספריית מטרות משותפת למרכז</span></li>
                  <li><IconCheck size={14} /><span>עדכון נתונים ישירות מהטופס</span></li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="v2-feature-visual">
                <MockupGoals />
              </div>
            </Reveal>
          </div>

          {/* Feature 2: Calendar */}
          <div className="v2-feature-row v2-feature-row-reverse">
            <Reveal>
              <div className="v2-feature-text">
                <div className="v2-feature-number">02</div>
                <h3 className="v2-feature-title">יומן סשנים ולוח שנה</h3>
                <p className="v2-feature-desc">
                  {'כל הסשנים של כל המטפלות — ביומן אחד ברור. צפו בלוח השבועי, סננו לפי מטפלת, ותראו מי עבד עם מי ומתי. כל סשן מקושר ישירות לטופס שמולא.'}
                </p>
                <ul className="v2-feature-list">
                  <li><IconCheck size={14} /><span>תצוגת יומן שבועית וחודשית</span></li>
                  <li><IconCheck size={14} /><span>צבע ייחודי לכל מטפלת</span></li>
                  <li><IconCheck size={14} /><span>קישור ישיר מסשן לטופס</span></li>
                  <li><IconCheck size={14} /><span>עובד מושלם גם בנייד</span></li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="v2-feature-visual">
                <MockupCalendar />
              </div>
            </Reveal>
          </div>

          {/* Feature 3: Forms */}
          <div className="v2-feature-row">
            <Reveal>
              <div className="v2-feature-text">
                <div className="v2-feature-number">03</div>
                <h3 className="v2-feature-title">טפסים מקצועיים ואיסוף נתונים</h3>
                <p className="v2-feature-desc">
                  {'צרו טפסי מעקב טיפולי מותאמים — עם סעיפים לכל מטרה, מד שיתוף פעולה, ספירת ניסיונות/הצלחות, והערות חופשיות. כל הנתונים נשמרים ומוזנים ישירות לגרפי ההתקדמות.'}
                </p>
                <ul className="v2-feature-list">
                  <li><IconCheck size={14} /><span>טפסי סשן מותאמים אישית</span></li>
                  <li><IconCheck size={14} /><span>טפסי ישיבות צוות</span></li>
                  <li><IconCheck size={14} /><span>איסוף נתונים כמותי לכל מטרה</span></li>
                  <li><IconCheck size={14} /><span>שמירה אוטומטית ועריכה חוזרת</span></li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="v2-feature-visual">
                <MockupForm />
              </div>
            </Reveal>
          </div>

          {/* Feature 4: Team */}
          <div className="v2-feature-row v2-feature-row-reverse">
            <Reveal>
              <div className="v2-feature-text">
                <div className="v2-feature-number">04</div>
                <h3 className="v2-feature-title">ניהול צוות מטפלות</h3>
                <p className="v2-feature-desc">
                  {'שייכו מטפלות לילדים, עקבו אחרי מספר הסשנים של כל מטפלת, ותנו לכל מטפלת גישה מותאמת — היא רואה רק את הילדים שלה, ממלאה טפסים, ומקבלת התראות רלוונטיות.'}
                </p>
                <ul className="v2-feature-list">
                  <li><IconCheck size={14} /><span>פרופיל מטפלת עם תפקיד ומומחיות</span></li>
                  <li><IconCheck size={14} /><span>גישה מבוקרת לפי שיוך</span></li>
                  <li><IconCheck size={14} /><span>ממשק מטפלת נפרד ופשוט</span></li>
                  <li><IconCheck size={14} /><span>סטטיסטיקות פעילות למטפלת</span></li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="v2-feature-visual">
                <MockupTeam />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- AI SECTION ---------- */}
      <section id="ai" className="v2-section v2-section-ai">
        <div className="v2-container">
          <Reveal>
            <div className="v2-section-header">
              <div className="v2-section-badge v2-badge-ai">בינה מלאכותית</div>
              <h2 className="v2-section-title v2-title-light">
                עוזר AI שמבין טיפול
              </h2>
              <p className="v2-section-subtitle v2-subtitle-light">
                {'לא צריך להיות טכנולוגי — פשוט כתבו מה שאתם צריכים בעברית רגילה'}
                <br />
                והבינה המלאכותית תעשה את השאר
              </p>
            </div>
          </Reveal>

          <div className="v2-ai-demo-row">
            <Reveal>
              <div className="v2-ai-demo-chat">
                <MockupChat />
              </div>
            </Reveal>
            <Reveal delay={200}>
              <div className="v2-ai-demo-capabilities">
                <AICapabilities />
              </div>
            </Reveal>
          </div>

          <Reveal>
            <div className="v2-ai-highlight">
              <IconCircle size={48} bg="rgba(99,102,241,.2)"><IconLightbulb size={22} color="#a5b4fc" /></IconCircle>
              <div>
                <div className="v2-ai-highlight-title">הבינה המלאכותית מכירה את כל הנתונים שלכם</div>
                <div className="v2-ai-highlight-desc">
                  {'היא יכולה לגשת למידע על הילדים, לנתח התקדמות, ליצור טפסים ולוחות, להציע מטרות, ולעזור בסיעור מוחות — הכל בשיחה פשוטה. כמו עוזרת מנהלית שעובדת 24/7.'}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- BENEFITS ---------- */}
      <section id="benefits" className="v2-section">
        <div className="v2-container">
          <Reveal>
            <div className="v2-section-header">
              <div className="v2-section-badge">יתרונות</div>
              <h2 className="v2-section-title">למה מרכזי טיפול בוחרים ב-Doing</h2>
            </div>
          </Reveal>

          <div className="v2-benefits-grid">
            {[
              { icon: <IconClock size={24} />, title: 'חסכון בזמן', desc: 'במקום שעות של ניירת — דקות. טפסים אוטומטיים, נתונים שמתעדכנים לבד, ובינה מלאכותית שעושה בשבילכם.' },
              { icon: <IconChart size={24} />, title: 'החלטות מבוססות נתונים', desc: 'כל סשן מייצר נתונים. כל נתון הופך לגרף. כל גרף מספר סיפור. תראו את ההתקדמות האמיתית.' },
              { icon: <IconUsers size={24} />, title: 'עבודת צוות מושלמת', desc: 'כולם רואים את אותו מידע. מטפלות יודעות מה קרה בסשן הקודם. מנהלות רואות את התמונה הגדולה.' },
              { icon: <IconSmartphone size={24} />, title: 'נגיש מכל מקום', desc: 'עובד בנייד, בטאבלט ובמחשב. מטפלות ממלאות טפסים תוך כדי הסשן. הורים צופים מהבית.' },
              { icon: <IconShield size={24} />, title: 'פרטיות ואבטחה', desc: 'כל מטפלת רואה רק את הילדים שמשויכים אליה. הורים רואים רק קריאה. הנתונים מוגנים.' },
              { icon: <IconCpu size={24} />, title: 'AI שעוזר באמת', desc: 'לא גימיק — בינה מלאכותית שמבינה טיפול, יוצרת טפסים, מנתחת נתונים, ומציעה מטרות. באמת עובד.' },
            ].map((b, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="v2-benefit-card">
                  <IconCircle size={52} bg="#eef2ff">{b.icon}</IconCircle>
                  <h4 className="v2-benefit-title">{b.title}</h4>
                  <p className="v2-benefit-desc">{b.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- WHO IS IT FOR ---------- */}
      <section className="v2-section v2-section-alt">
        <div className="v2-container">
          <Reveal>
            <div className="v2-section-header">
              <div className="v2-section-badge">למי זה מתאים</div>
              <h2 className="v2-section-title">למי המערכת מתאימה?</h2>
            </div>
          </Reveal>
          <div className="v2-personas-grid">
            {[
              { icon: <IconUsers size={28} color="#6366f1" />, title: 'מנהלי מרכזי טיפול', desc: 'ראו את כל הילדים, כל המטפלות, כל הסשנים — מסך אחד. קבלו החלטות מבוססות נתונים.', features: ['ניהול מרכזי של צוותים', 'דוחות ותובנות', 'ספריית מטרות משותפת'] },
              { icon: <IconClipboard size={28} color="#6366f1" />, title: 'מטפלות ואנשי מקצוע', desc: 'מלאו טפסים בקלות, ראו את ההתקדמות של הילדים שלכם, ותקשרו עם הצוות — הכל מהנייד.', features: ['מילוי טפסים מהיר', 'גישה מהנייד', 'צפייה במטרות'] },
              { icon: <IconShield size={28} color="#6366f1" />, title: 'הורים', desc: 'קבלו קישור אישי לצפייה בלוח המשימות של ילדכם, ראו את ההתקדמות, ותהיו חלק מהתהליך.', features: ['לוח משימות ויזואלי', 'מעקב התקדמות', 'שקיפות מלאה'] },
              { icon: <IconTarget size={28} color="#6366f1" />, title: 'מטפלות עצמאיות', desc: 'גם בלי מרכז — נהלו את הילדים שלכם בצורה מקצועית. טפסים, מטרות, לוחות — הכל במקום אחד.', features: ['ניהול עצמאי', 'AI שעוזר', 'חינם להתחלה'] },
            ].map((p, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="v2-persona-card">
                  <IconCircle size={56} bg="#eef2ff">{p.icon}</IconCircle>
                  <h4 className="v2-persona-title">{p.title}</h4>
                  <p className="v2-persona-desc">{p.desc}</p>
                  <ul className="v2-persona-features">
                    {p.features.map((f, fi) => <li key={fi}><IconCheck size={13} color="#10b981" /><span>{f}</span></li>)}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section id="contact" className="v2-cta-section">
        <Reveal>
          <div className="v2-container v2-cta-content">
            <h2 className="v2-cta-title">מוכנים לשדרג את ניהול הטיפול?</h2>
            <p className="v2-cta-subtitle">
              הצטרפו למרכזי טיפול שכבר עובדים עם Doing
            </p>
            <div className="v2-cta-buttons">
              <button className="v2-btn v2-btn-primary v2-btn-large" onClick={() => navigate('/login')}>
                {'התחילו לעשות — חינם'}
                <IconArrowLeft size={18} />
              </button>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="v2-btn v2-btn-wa-light v2-btn-large"
              >
                <img src={WA_ICON} alt="" style={{ width: 22, height: 22 }} />
                דברו איתנו בוואטסאפ
              </a>
            </div>
            <p className="v2-cta-note">{'ללא כרטיס אשראי \u2022 הקמה תוך דקות \u2022 תמיכה בעברית'}</p>
          </div>
        </Reveal>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="v2-footer">
        <div className="v2-container v2-footer-inner">
          <div className="v2-footer-brand">
            <Logo />
            <p style={{ marginTop: 8, fontSize: 13, color: '#94a3b8' }}>ניהול טיפול חכם</p>
          </div>
          <div className="v2-footer-links">
            <a href="#features">יכולות</a>
            <a href="#ai">בינה מלאכותית</a>
            <a href="#benefits">יתרונות</a>
          </div>
          <div className="v2-footer-copy">
            {'© 2026 Doing — כל הזכויות שמורות'}
          </div>
        </div>
      </footer>

      <WhatsAppFloat />
    </div>
  );
}
