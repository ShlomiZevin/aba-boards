import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import AppMockup from '../components/AppMockup';

const WHATSAPP_URL = 'https://wa.me/972542801162';
const WA_ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="white"><path d="M16 0C7.2 0 0 7.2 0 16c0 2.8.7 5.5 2.1 7.9L.7 31.3l7.6-2a16 16 0 007.7 2C24.8 31.3 32 24.1 32 15.3 32 7.2 24.8 0 16 0zm8 22.6c-.4 1.1-2 2-3.2 2.3-.8.2-1.9.3-5.6-1.2-4.7-2-7.7-6.7-7.9-7-.2-.3-1.8-2.4-1.8-4.7 0-2.2 1.1-3.3 1.6-3.7.4-.5.9-.6 1.2-.6h.8c.3 0 .7-.1 1 .7.4.9 1.4 3.4 1.5 3.6.1.2.2.5 0 .8l-.4.8c-.2.3-.4.5-.1.9.2.3 1.1 1.8 2.4 2.9 1.6 1.4 3 1.9 3.4 2.1.5.2.7.2 1-.1.2-.3.9-1 1.2-1.4.2-.4.5-.3.8-.2.3.1 2 1 2.4 1.1.3.2.6.3.7.4.1.2.1.9-.3 1.7z"/></svg>');

/* ------------------------------------------------------------------ */
/*  Logo                                                               */
/* ------------------------------------------------------------------ */
function Logo() {
  return (
    <div className="ln-logo">
      <img src="/therapy/doing-logo-transparent2.png" alt="Doing" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scroll-reveal                                                      */
/* ------------------------------------------------------------------ */
type RevealFrom = 'up' | 'right' | 'left' | 'scale';
function Reveal({ children, delay = 0, className = '', scale = false, from = 'up' }: { children: ReactNode; delay?: number; className?: string; scale?: boolean; from?: RevealFrom }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  let hiddenTransform = 'translateY(24px)';
  if (scale || from === 'scale') hiddenTransform = 'translateY(40px) scale(.92)';
  else if (from === 'right') hiddenTransform = 'translateX(40px)';
  else if (from === 'left') hiddenTransform = 'translateX(-40px)';
  return (
    <div ref={ref} className={`ln-reveal ${className}`} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : hiddenTransform, transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated counter                                                    */
/* ------------------------------------------------------------------ */
function CountUp({ target, suffix = '', duration = 1800, startDelay = 0 }: { target: number; suffix?: string; duration?: number; startDelay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          obs.disconnect();
          setTimeout(() => {
            const start = performance.now();
            const step = (now: number) => {
              const t = Math.min((now - start) / duration, 1);
              const ease = 1 - Math.pow(1 - t, 3);
              setValue(Math.round(ease * target));
              if (t < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          }, startDelay);
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration, startDelay]);

  const formatted = value >= 1000 ? value.toLocaleString() : String(value);
  return <div ref={ref} className="ln-stat-number">{formatted}{suffix}</div>;
}

/* ------------------------------------------------------------------ */
/*  Mockup visuals (from old welcome page)                             */
/* ------------------------------------------------------------------ */
function MockupBoard() {
  const tasks = [
    { emoji: '🛏️', label: 'לסדר את המיטה', done: true },
    { emoji: '👕', label: 'להתלבש', done: true },
    { emoji: '🧼', label: 'לשטוף ידיים', done: false },
    { emoji: '🦷', label: 'לצחצח שיניים', done: false },
    { emoji: '🍽️', label: 'לאכול ארוחת בוקר', done: false },
  ];
  return (
    <div className="lp-mockup-board">
      <div className="lp-mockup-header">
        <img src="/therapy/tamar.jpg" alt="תמר" className="lp-mockup-avatar-img" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>הלוח של תמר</div>
          <div style={{ fontSize: 12, opacity: .6 }}>5 משימות להיום</div>
        </div>
      </div>
      <div className="lp-mockup-tasks">
        {tasks.map((t, i) => (
          <div key={i} className={`lp-mockup-task ${t.done ? 'done' : ''}`}>
            <span className="lp-mockup-task-emoji">{t.emoji}</span>
            <span className="lp-mockup-task-label">{t.label}</span>
            <span className="lp-mockup-task-check">{t.done ? '✅' : '⬜'}</span>
          </div>
        ))}
      </div>
      <div className="lp-mockup-footer">
        <span>⭐ 2/5 הושלמו</span>
        <span style={{ color: '#10b981', fontWeight: 600 }}>+₪4</span>
      </div>
    </div>
  );
}

function MockupGoals() {
  const goals = [
    { name: 'משחק חברתי בתורות', progress: 78, color: '#7c3aed' },
    { name: 'העתקת דגם קוביות', progress: 45, color: '#7c3aed' },
    { name: 'מיון קטגוריות', progress: 92, color: '#7c3aed' },
    { name: 'למידה בספרים', progress: 60, color: '#7c3aed' },
  ];
  return (
    <div className="lp-mockup-goals">
      <div className="lp-mockup-goals-header">
        <span style={{ fontSize: 18, fontWeight: 700 }}>📊 מעקב מטרות</span>
        <span className="lp-badge-green">שבועי</span>
      </div>
      {goals.map((g, i) => (
        <div key={i} className="lp-mockup-goal-row">
          <div className="lp-mockup-goal-info">
            <span>{g.name}</span>
            <span style={{ fontWeight: 700, color: g.color }}>{g.progress}%</span>
          </div>
          <div className="lp-mockup-progress-bar">
            <div className="lp-mockup-progress-fill" style={{ width: `${g.progress}%`, background: g.color }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 12, fontSize: 12, color: '#888', textAlign: 'center' }}>
        📈 ממוצע התקדמות: 69% — עלייה של 12% מהשבוע שעבר
      </div>
    </div>
  );
}

function MockupForm() {
  return (
    <div className="lp-mockup-form">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>📋 טופס מעקב טיפולי</div>
          <div style={{ fontSize: 12, color: '#888' }}>יואב כהן — סשן #34 — 11.03.2026</div>
        </div>
        <span className="lp-badge-purple">טיפולי</span>
      </div>
      <div className="lp-mockup-form-section">
        <div className="lp-mockup-form-label">מצב רוח בתחילת הטיפול</div>
        <div className="lp-mockup-form-mood">
          {['😊', '🙂', '😐', '😟', '😢'].map((e, i) => (
            <span key={i} className={`lp-mood-item ${i === 1 ? 'active' : ''}`}>{e}</span>
          ))}
        </div>
      </div>
      <div className="lp-mockup-form-section">
        <div className="lp-mockup-form-label">מטרה: משחק חברתי בתורות</div>
        <div className="lp-mockup-form-grid">
          <div className="lp-mockup-form-cell">
            <div style={{ fontSize: 11, color: '#888' }}>ניסיונות</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>8</div>
          </div>
          <div className="lp-mockup-form-cell">
            <div style={{ fontSize: 11, color: '#888' }}>הצלחות</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>6</div>
          </div>
          <div className="lp-mockup-form-cell">
            <div style={{ fontSize: 11, color: '#888' }}>אחוז</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#7c3aed' }}>75%</div>
          </div>
        </div>
      </div>
      <div className="lp-mockup-form-section">
        <div className="lp-mockup-form-label">הערות</div>
        <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#555', minHeight: 40 }}>
          התקדמות יפה במשחק בתורות. הגיב טוב למשחק עם בובות...
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Chat mockup                                                     */
/* ------------------------------------------------------------------ */
function MockupChat() {
  const [typingIdx, setTypingIdx] = useState(0);
  const messages = [
    { role: 'user' as const, text: 'תכין סיכום תקופתי מקצועי עבור תמר לחודש מאי 2026.\nלכלול: מטרות טיפול פעילות, סיכום טיפולים (שת״פ, מצב רוח, ריכוז), הצלחות, קשיים, נתונים שנאספו והמלצות להמשך.' },
    { role: 'ai' as const, text: 'בכיף! 📄 הכנתי סיכום מקצועי: 8 טיפולים, שת״פ ממוצע 85%, 3 מטרות בהתקדמות ו-2 המלצות להמשך. לשלוח להורים?' },
    { role: 'user' as const, text: 'כן, תשלח' },
    { role: 'ai' as const, text: 'נשלח בהצלחה ✅ ההורים קיבלו את הסיכום במייל ובוואטסאפ' },
  ];

  useEffect(() => {
    if (typingIdx < messages.length) {
      const timer = setTimeout(() => setTypingIdx(prev => prev + 1), 1800);
      return () => clearTimeout(timer);
    }
  }, [typingIdx, messages.length]);

  return (
    <div className="ln-mockup-chat">
      <div className="ln-mockup-chat-header">
        <div className="ln-mockup-chat-avatar">AI</div>
        <div>
          <div className="ln-mockup-chat-name">עוזר Doing</div>
          <div className="ln-mockup-chat-status">● מוכן לעזור</div>
        </div>
      </div>
      <div className="ln-mockup-chat-body">
        {messages.slice(0, typingIdx).map((m, i) => (
          <div key={i} className={`ln-chat-msg ln-chat-${m.role}`}>
            <div className={`ln-chat-bubble ln-chat-bubble-${m.role}`}>{m.text}</div>
          </div>
        ))}
        {typingIdx < messages.length && (
          <div className="ln-chat-msg ln-chat-ai">
            <div className="ln-chat-bubble ln-chat-bubble-ai ln-chat-typing">
              <span className="ln-chat-dot" /><span className="ln-chat-dot" /><span className="ln-chat-dot" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated Dino                                                      */
/* ------------------------------------------------------------------ */
const DINO_BASE = '/therapy/avatar/dinosaur';
const DINO_MOUTH = Array.from({ length: 6 }, (_, i) => `${DINO_BASE}/mouth_${i}.png`);
const DINO_THINK = Array.from({ length: 6 }, (_, i) => `${DINO_BASE}/thinking_${i}.png`);

function AnimatedDino() {
  const [frame, setFrame] = useState(0);
  const [mode, setMode] = useState<'talk' | 'think'>('talk');
  const frames = mode === 'talk' ? DINO_MOUTH : DINO_THINK;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, mode === 'talk' ? 180 : 350);
    return () => clearInterval(interval);
  }, [mode, frames.length]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setMode(prev => prev === 'talk' ? 'think' : 'talk');
    }, mode === 'talk' ? 4000 : 3000);
    return () => clearTimeout(timeout);
  }, [mode]);

  useEffect(() => {
    [...DINO_MOUTH, ...DINO_THINK].forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  return (
    <div className="ln-dino-stage">
      <img src={frames[frame]} alt="דינו" className="ln-dino-img" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero Carousel                                                      */
/* ------------------------------------------------------------------ */
function HeroCarousel() {
  const slides = [
    { label: 'לוח טיפולים ויומן', render: () => <AppMockup /> },
    { label: 'עוזר Doing — AI', render: () => <MockupChat /> },
    { label: 'לוח משימות לילד', render: () => <MockupBoard /> },
    { label: 'מטרות והתקדמות', render: () => <MockupGoals /> },
    { label: 'טופס מעקב טיפולי', render: () => <MockupForm /> },
    { label: 'דינו - העוזר החכם של הילדים', render: () => (
      <div className="ln-carousel-dino-wrap">
        <AnimatedDino />
        <div className="ln-carousel-dino-bubble">היי! אני דינו — מעודד את הילדים ומדבר איתם!</div>
      </div>
    ) },
  ];

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setIdx(i => (i + 1) % slides.length), 2500);
    return () => clearTimeout(t);
  }, [idx, paused, slides.length]);

  return (
    <div
      className="ln-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="ln-carousel-stage">
        {slides.map((s, i) => (
          <div key={i} className={`ln-carousel-slide ${i === idx ? 'active' : ''}`}>
            <div className="ln-carousel-slide-inner">
              <div className="ln-carousel-label">{s.label}</div>
              <div className="ln-carousel-content">{s.render()}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="ln-carousel-dots">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`ln-carousel-dot ${i === idx ? 'active' : ''}`}
            onClick={() => setIdx(i)}
            aria-label={`slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating WhatsApp                                                  */
/* ------------------------------------------------------------------ */
function WhatsAppFloat() {
  return (
    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="ln-wa-float">
      <img src={WA_ICON} alt="" style={{ width: 24, height: 24 }} />
      <span className="ln-wa-label">דברו איתנו</span>
    </a>
  );
}

/* ================================================================== */
/*  MAIN                                                               */
/* ================================================================== */
export default function LandingNew() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const docHeight = typeof window !== 'undefined' ? document.documentElement.scrollHeight - window.innerHeight : 1;
  const scrollPct = Math.min((scrollY / Math.max(docHeight, 1)) * 100, 100);

  return (
    <div className="ln-root" dir="rtl">
      <div className="ln-scroll-progress" style={{ width: `${scrollPct}%` }} />
      {/* ---------- NAV ---------- */}
      <nav className={`ln-nav ${scrollY > 40 ? 'ln-nav-scrolled' : ''}`}>
        <div className="ln-nav-inner">
          <Logo />
          <div className="ln-nav-links">
            <a href="#features">יכולות</a>
            <a href="#ai">בינה מלאכותית</a>
            <a href="#benefits">יתרונות</a>
          </div>
          <div className="ln-nav-actions">
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="ln-nav-contact">
              יצירת קשר
            </a>
            <button className="ln-nav-cta" onClick={() => navigate('/login')}>
              כניסה למערכת
            </button>
          </div>
        </div>
      </nav>

      {/* ---------- HERO ---------- */}
      <section className="ln-hero">
        {/* Side by side: text right, mockup left */}
        <div className="ln-hero-split">
          <Reveal delay={50}>
            <div className="ln-hero-text">
              <div className="ln-hero-logo">
                <img src="/therapy/doing-logo-transparent2.png" alt="Doing" />
              </div>
              <div className="ln-pills">
                <span className="ln-pill ln-pill-purple">AI מובנה</span>
                <span className="ln-pill ln-pill-orange">לוחות משימות</span>
                <span className="ln-pill ln-pill-pink">מעקב מטרות</span>
                <span className="ln-pill ln-pill-green">טפסי טיפול</span>
                <span className="ln-pill ln-pill-blue">ניהול צוות</span>
              </div>
              <h1 className="ln-hero-title">
                מערכת חכמה ומקצועית לניהול מטרות טיפול, איסוף נתונים מעקב טיפולי וניהול משימות יומי.
              </h1>
              <p className="ln-hero-subtitle">
                נהלו מטרות טיפול, תעדו מפגשים ואספו נתונים בצורה מסודרת וברורה הכל במקום אחד.
                המערכת מאפשרת עבודה דיגיטלית נוחה למטפלים, למנחים ולהורים, עם גישה למידע בזמן אמת.
              </p>
              <div className="ln-hero-buttons">
                <button className="ln-btn ln-btn-primary" onClick={() => navigate('/login')}>
                  התחילו לעבוד עם Doing
                </button>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="ln-btn ln-btn-outline">
                  תיאום הדגמה
                </a>
              </div>
              <div className="ln-stats-row">
                <Reveal delay={100}>
                  <div className="ln-stat-item">
                    <CountUp target={147} suffix="+" startDelay={600} />
                    <div className="ln-stat-label">ילדים במערכת</div>
                  </div>
                </Reveal>
                <Reveal delay={250}>
                  <div className="ln-stat-item">
                    <CountUp target={32} suffix="+" duration={1200} startDelay={600} />
                    <div className="ln-stat-label">מטפלות פעילות</div>
                  </div>
                </Reveal>
                <Reveal delay={400}>
                  <div className="ln-stat-item">
                    <CountUp target={1243} suffix="+" duration={2200} startDelay={600} />
                    <div className="ln-stat-label">מפגשים מתועדים</div>
                  </div>
                </Reveal>
              </div>
            </div>
          </Reveal>

          <Reveal delay={200} scale>
            <div
              className="ln-hero-mockup-wrapper"
              style={{ transform: `translateY(${Math.min(scrollY * 0.08, 40)}px)` }}
            >
              <div className="ln-hero-mockup-float">
                <HeroCarousel />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- FEATURES ---------- */}
      <section id="features" className="ln-section">
        <div className="ln-container">
          <Reveal>
            <div className="ln-section-header">
              <div className="ln-section-badge">יכולות המערכת</div>
              <h2 className="ln-section-title">כל מה שצריך לניהול טיפול מקצועי</h2>
              <p className="ln-section-subtitle">מערכת אחת שמחליפה אקסלים, דפים, קבוצות וואטסאפ, ותיקיות</p>
            </div>
          </Reveal>

          <div className="ln-features-grid">
            {[
              {
                num: '01',
                title: 'לוח משימות אישי לכל ילד',
                desc: 'פרופיל מלא עם תמונה ופרטים, ולוח משימות ויזואלי מותאם אישית לילד. ההורים מקבלים קישור לצפייה בלוח ובהתקדמות בזמן אמת.',
                bullets: ['פרופיל ילד מלא עם אווטר', 'לוח משימות ויזואלי מותאם', 'קישור להורים לצפייה חיה', 'מעקב ביצוע ותגמולים'],
              },
              {
                num: '02',
                title: 'מטרות טיפוליות ומעקב התקדמות',
                desc: 'הגדירו מטרות מדידות, עקבו אחרי אחוזי הצלחה לאורך זמן, וצפו בגרפים שמראים את ההתקדמות האמיתית.',
                bullets: ['גרפי התקדמות שבועיים וחודשיים', 'מטרות עם קריטריונים מדידים', 'ספריית מטרות משותפת למרכז', 'עדכון נתונים ישירות מהטופס'],
              },
              {
                num: '03',
                title: 'יומן סשנים ולוח שנה',
                desc: 'כל הסשנים של כל המטפלות ביומן אחד ברור. תצוגה שבועית/חודשית, סינון לפי מטפלת וקישור לטפסים.',
                bullets: ['תצוגת יומן שבועית וחודשית', 'צבע ייחודי לכל מטפלת', 'קישור ישיר מסשן לטופס', 'עובד מצוין גם בנייד'],
              },
              {
                num: '04',
                title: 'טפסים מקצועיים ואיסוף נתונים',
                desc: 'צרו טפסי מעקב מותאמים עם סעיפים לכל מטרה, מד מצב רוח, ספירת ניסיונות/הצלחות. כל הנתונים מוזנים לגרפי ההתקדמות.',
                bullets: ['טפסי סשן מותאמים אישית', 'טפסי ישיבות צוות', 'איסוף נתונים כמותי למטרה', 'שמירה אוטומטית ועריכה חוזרת'],
              },
              {
                num: '05',
                title: 'ניהול צוות מטפלות',
                desc: 'שייכו מטפלות לילדים, עקבו אחרי מספר הסשנים, ותנו לכל מטפלת גישה מותאמת רק לילדים שלה עם טפסים והתראות.',
                bullets: ['פרופיל מטפלת עם תפקיד ומומחיות', 'גישה מבוקרת לפי שיוך', 'ממשק מטפלת נפרד ופשוט', 'סטטיסטיקות פעילות למטפלת'],
              },
              {
                num: '06',
                title: 'התראות והודעות לצוות',
                desc: 'עדכונים על טפסים שמולאו, מטרות שהגיעו לשיא, תזכורות למילוי טפסים, וישיבות צוות מתקרבות — כל אחד מקבל רק את הרלוונטי.',
                bullets: ['התראות בזמן אמת', 'תזכורות למילוי טפסים', 'עדכוני שיא במטרות', 'התראות אישיות לכל מטפלת'],
              },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="ln-feature-card">
                  <div className="ln-feature-num">{f.num}</div>
                  <h3 className="ln-feature-title">{f.title}</h3>
                  <p className="ln-feature-desc">{f.desc}</p>
                  <ul className="ln-feature-list">
                    {f.bullets.map((b, bi) => <li key={bi}>{b}</li>)}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- AI SECTION ---------- */}
      <section id="ai" className="ln-section ln-section-alt">
        <div className="ln-container">
          <Reveal>
            <div className="ln-section-header">
              <div className="ln-section-badge">בינה מלאכותית</div>
              <h2 className="ln-section-title">עוזר AI שמבין טיפול</h2>
              <p className="ln-section-subtitle">לא צריך להיות טכנולוגי — פשוט כתבו מה שאתם צריכים בעברית, והבינה המלאכותית תעשה את השאר</p>
            </div>
          </Reveal>

          <div className="ln-ai-split">
            <Reveal from="right">
              <div className="ln-ai-chat-wrap">
                <MockupChat />
              </div>
            </Reveal>
            <div className="ln-ai-grid-narrow">
              {[
                { title: 'יצירת טפסים', desc: 'בקשו מה-AI ליצור טופס הערכה מותאם אישית — והוא יבנה אותו תוך שניות.' },
                { title: 'הגדרת מטרות', desc: 'תארו את האתגר — ה-AI יציע מטרות מדידות עם קריטריונים מדויקים.' },
                { title: 'ניתוח נתונים', desc: 'שאלו שאלות על ההתקדמות של ילד וקבלו תובנות מעמיקות מבוססות נתונים.' },
                { title: 'לוחות משימות', desc: 'בקשו לוח משימות מותאם — ה-AI ייצור אותו עם משימות מתאימות לילד.' },
                { title: 'סיעור מוחות', desc: 'התייעצו על אסטרטגיות, רעיונות לפעילויות, ופתרונות יצירתיים.' },
                { title: 'סיכומים חכמים', desc: 'בקשו סיכום שבועי או חודשי — ה-AI ירכז את כל הנתונים בצורה ברורה.' },
              ].map((c, i) => (
                <Reveal key={i} delay={i * 60} from="left">
                  <div className="ln-ai-card">
                    <h4 className="ln-ai-card-title">{c.title}</h4>
                    <p className="ln-ai-card-desc">{c.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal>
            <div className="ln-ai-highlight">
              <div className="ln-ai-highlight-title">ה-AI מכיר את כל הנתונים שלכם</div>
              <div className="ln-ai-highlight-desc">
                גישה למידע על הילדים, ניתוח התקדמות, יצירת טפסים ולוחות, הצעת מטרות, וסיעור מוחות — הכל בשיחה פשוטה. כמו עוזרת מנהלית שעובדת 24/7.
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- DINO ---------- */}
      <section id="dino" className="ln-section">
        <div className="ln-container">
          <div className="ln-dino-row">
            <Reveal delay={150} from="left">
              <div className="ln-dino-text">
                <div className="ln-section-badge">הכירו את דינו</div>
                <h2 className="ln-section-title ln-text-right">דינו — החבר של הילדים</h2>
                <p className="ln-feature-desc ln-text-right">
                  דינו הוא דמות מונפשת חכמה שמדברת עם הילדים בקול, מעודדת אותם להשלים משימות, ומגיבה בזמן אמת. הוא הופך את לוח המשימות לחוויה שהילדים אוהבים.
                </p>
                <ul className="ln-feature-list">
                  <li>מדבר ומגיב בקול אמיתי</li>
                  <li>מעודד ומחמיא על כל משימה שהושלמה</li>
                  <li>אנימציות חושב ומדבר</li>
                  <li>מותאם אישית לכל ילד וילדה</li>
                </ul>
              </div>
            </Reveal>
            <Reveal from="right">
              <div className="ln-dino-visual">
                <AnimatedDino />
                <div className="ln-dino-bubble">
                  היי! אני דינו! אני מדבר עם ילדים, מעודד אותם לסיים משימות, ועוזר להם להרגיש גיבורים!
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- BENEFITS ---------- */}
      <section id="benefits" className="ln-section ln-section-alt">
        <div className="ln-container">
          <Reveal>
            <div className="ln-section-header">
              <div className="ln-section-badge">למה Doing?</div>
              <h2 className="ln-section-title">היתרונות שמשנים את הטיפול</h2>
            </div>
          </Reveal>

          <div className="ln-benefits-grid">
            {[
              { title: 'חסכון בזמן', desc: 'במקום שעות של ניירת — דקות. טפסים אוטומטיים, נתונים שמתעדכנים לבד, ובינה מלאכותית שעובדת בשבילכם.', stat: '100%', statLabel: 'פחות ניירת' },
              { title: 'החלטות מבוססות נתונים', desc: 'כל סשן מייצר נתונים. כל נתון הופך לגרף. כל גרף מספר סיפור. תראו את ההתקדמות האמיתית.', stat: '100%', statLabel: 'שקיפות' },
              { title: 'עבודת צוות מושלמת', desc: 'כולם רואים את אותו מידע. מטפלות יודעות מה קרה בסשן הקודם. מנהלות רואות את התמונה הגדולה.', stat: '∞', statLabel: 'סנכרון' },
              { title: 'נגיש מכל מקום', desc: 'עובד בנייד, בטאבלט ובמחשב. מטפלות ממלאות טפסים תוך כדי הסשן. הורים צופים מהבית.', stat: '24/7', statLabel: 'זמינות' },
              { title: 'פרטיות ואבטחה', desc: 'כל מטפלת רואה רק את הילדים שמשויכים אליה. הורים רואים רק קריאה. הנתונים מוגנים.', stat: '★', statLabel: 'מוגן' },
              { title: 'AI שעוזר באמת', desc: 'לא גימיק — בינה מלאכותית שמבינה טיפול, יוצרת טפסים, מנתחת נתונים, ומציעה מטרות. באמת עובד.', stat: 'AI', statLabel: 'חכם' },
            ].map((b, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="ln-benefit-card">
                  <div className="ln-benefit-stat">{b.stat}</div>
                  <div className="ln-benefit-stat-label">{b.statLabel}</div>
                  <h4 className="ln-benefit-title">{b.title}</h4>
                  <p className="ln-benefit-desc">{b.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- SHOWCASE ---------- */}
      <section id="demo" className="ln-section">
        <div className="ln-container">
          <Reveal>
            <div className="ln-section-header">
              <div className="ln-section-badge">ראו בעצמכם</div>
              <h2 className="ln-section-title">כך נראה ניהול טיפול מקצועי</h2>
              <p className="ln-section-subtitle">ממשק נקי, פשוט ואינטואיטיבי — גם למי שלא טכנולוגי</p>
            </div>
          </Reveal>

          <div className="ln-showcase-grid">
            <Reveal>
              <div className="ln-showcase-card">
                <div className="ln-showcase-label">לוח משימות לילד</div>
                <div className="ln-showcase-visual"><MockupBoard /></div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="ln-showcase-card">
                <div className="ln-showcase-label">מטרות והתקדמות</div>
                <div className="ln-showcase-visual"><MockupGoals /></div>
              </div>
            </Reveal>
            <Reveal delay={240}>
              <div className="ln-showcase-card">
                <div className="ln-showcase-label">טופס מעקב טיפולי</div>
                <div className="ln-showcase-visual"><MockupForm /></div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- WHO IS IT FOR ---------- */}
      <section className="ln-section">
        <div className="ln-container">
          <Reveal>
            <div className="ln-section-header">
              <div className="ln-section-badge">בשבילכם</div>
              <h2 className="ln-section-title">למי המערכת מתאימה?</h2>
            </div>
          </Reveal>
          <div className="ln-personas-grid">
            {[
              { title: 'מנהלי מרכזי טיפול', desc: 'ראו את כל הילדים, כל המטפלות, כל הסשנים במסך אחד. קבלו החלטות מבוססות נתונים ושמרו על סטנדרט מקצועי.', features: ['ניהול מרכזי של צוותים', 'דוחות ותובנות', 'ספריית מטרות משותפת'] },
              { title: 'מטפלות ואנשי מקצוע', desc: 'מלאו טפסים בקלות, ראו את ההתקדמות של הילדים שלכם, ותקשרו עם הצוות — הכל מהנייד.', features: ['מילוי טפסים מהיר', 'גישה מהנייד', 'צפייה במטרות'] },
              { title: 'הורים', desc: 'קבלו קישור אישי לצפייה בלוח המשימות של ילדכם, ראו את ההתקדמות, ותהיו חלק מהתהליך.', features: ['לוח משימות ויזואלי', 'מעקב התקדמות', 'שקיפות מלאה'] },
              { title: 'מטפלות עצמאיות', desc: 'גם בלי מרכז — נהלו את הילדים שלכם בצורה מקצועית. טפסים, מטרות, לוחות — הכל במקום אחד.', features: ['ניהול עצמאי', 'AI שעוזר', 'חינם להתחלה'] },
            ].map((p, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="ln-persona-card">
                  <h4 className="ln-persona-title">{p.title}</h4>
                  <p className="ln-persona-desc">{p.desc}</p>
                  <ul className="ln-persona-features">
                    {p.features.map((f, fi) => <li key={fi}>{f}</li>)}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="ln-cta-section">
        <Reveal>
          <div className="ln-container ln-cta-content">
            <h2 className="ln-cta-title">מוכנים לשדרג את הטיפול?</h2>
            <p className="ln-cta-subtitle">הצטרפו למאות מטפלות ומרכזי טיפול שכבר עובדים עם Doing</p>
            <div className="ln-cta-buttons">
              <button className="ln-btn ln-btn-cta-primary" onClick={() => navigate('/login')}>
                התחילו לעבוד עם Doing
              </button>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="ln-btn ln-btn-cta-outline">
                דברו איתנו בוואטסאפ
              </a>
            </div>
            <p className="ln-cta-note">ללא כרטיס אשראי · הקמה תוך דקות · תמיכה בעברית</p>
          </div>
        </Reveal>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="ln-footer">
        <div className="ln-container ln-footer-inner">
          <div className="ln-footer-brand">
            <img src="/therapy/doing-logo-transparent2.png" alt="Doing" className="ln-footer-logo" />
            <p className="ln-footer-tag">ניהול טיפול חכם</p>
          </div>
          <div className="ln-footer-links">
            <a href="#features">יכולות</a>
            <a href="#ai">בינה מלאכותית</a>
            <a href="#benefits">יתרונות</a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">יצירת קשר</a>
          </div>
          <div className="ln-footer-copy">© 2026 Doing — כל הזכויות שמורות</div>
        </div>
      </footer>

      <WhatsAppFloat />
    </div>
  );
}
