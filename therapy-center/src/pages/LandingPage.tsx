import { useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

const WHATSAPP_URL = 'https://wa.me/972542801162';

/* ------------------------------------------------------------------ */
/*  Scroll-reveal wrapper — fades in when element enters viewport     */
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
      className="lp-reveal"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(36px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tiny animated counter                                             */
/* ------------------------------------------------------------------ */
function AnimatedCounter({ end, duration = 2000, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          setCount(Math.floor(progress * end));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* ------------------------------------------------------------------ */
/*  Particle background for hero                                      */
/* ------------------------------------------------------------------ */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = [];
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2.5 + 1,
        o: Math.random() * 0.3 + 0.05,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167, 139, 250, ${p.o})`;
        ctx.fill();
      }
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(167, 139, 250, ${0.06 * (1 - dist / 120)})`;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="lp-particle-canvas" />;
}

/* ------------------------------------------------------------------ */
/*  Feature mockup components — visual HTML "screenshots"             */
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
        <span>{'⭐ 2/5 הושלמו'}</span>
        <span style={{ color: '#10b981', fontWeight: 600 }}>{'+₪4'}</span>
      </div>
    </div>
  );
}

function MockupGoals() {
  const goals = [
    { name: 'משחק חברתי בתורות', progress: 78, color: '#667eea' },
    { name: 'העתקת דגם קוביות', progress: 45, color: '#f59e0b' },
    { name: 'מיון קטגוריות', progress: 92, color: '#10b981' },
    { name: 'למידה בספרים', progress: 60, color: '#ef4444' },
  ];
  return (
    <div className="lp-mockup-goals">
      <div className="lp-mockup-goals-header">
        <span style={{ fontSize: 18, fontWeight: 700 }}>{'📊 מעקב מטרות'}</span>
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
        {'📈 ממוצע התקדמות: 69% \u2014 עלייה של 12% מהשבוע שעבר'}
      </div>
    </div>
  );
}

function MockupChat() {
  const [typingIdx, setTypingIdx] = useState(0);
  const messages = [
    { role: 'user' as const, text: 'תכין לי טופס הערכה ליואב עם התמקדות במיומנויות קוגניטיביות' },
    { role: 'ai' as const, text: 'הכנתי טופס הערכה עם 4 סעיפים: משחק חברתי בתורות, העתקת דגם קוביות, מיון קטגוריות, ולמידה בספרים. רוצה שאוסיף משהו?' },
    { role: 'user' as const, text: 'תוסיף גם חלק על ויסות רגשי. מה המצב של המטרות שלו השבוע?' },
    { role: 'ai' as const, text: 'הוספתי! לגבי המטרות: משחק בתורות ב\u200E-78% (עלייה), העתקת דגם ב\u200E-45% (יציב), מיון קטגוריות ב\u200E-92% (מצוין!) 🎉' },
  ];

  useEffect(() => {
    if (typingIdx < messages.length) {
      const timer = setTimeout(() => setTypingIdx(prev => prev + 1), 1800);
      return () => clearTimeout(timer);
    }
  }, [typingIdx, messages.length]);

  return (
    <div className="lp-mockup-chat">
      <div className="lp-mockup-chat-header">
        <div className="lp-ai-avatar">🤖</div>
        <div>
          <div style={{ fontWeight: 700 }}>{'עוזר AI \u2014 Doing'}</div>
          <div style={{ fontSize: 11, color: '#10b981' }}>{'● מוכן לעזור'}</div>
        </div>
      </div>
      <div className="lp-mockup-chat-messages">
        {messages.slice(0, typingIdx).map((m, i) => (
          <div key={i} className={`lp-chat-msg lp-chat-${m.role}`}>
            {m.role === 'ai' && <span className="lp-chat-ai-icon">🤖</span>}
            <div className={`lp-chat-bubble lp-chat-bubble-${m.role}`}>{m.text}</div>
          </div>
        ))}
        {typingIdx < messages.length && (
          <div className="lp-chat-msg lp-chat-ai">
            <span className="lp-chat-ai-icon">🤖</span>
            <div className="lp-chat-bubble lp-chat-bubble-ai lp-typing">
              <span className="lp-dot" /><span className="lp-dot" /><span className="lp-dot" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MockupCalendar() {
  const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳'];
  const sessions = [
    { day: 0, hour: '09:00', name: 'רונית כ.', color: '#667eea', type: 'התנהגותי' },
    { day: 0, hour: '14:00', name: 'מיכל ש.', color: '#f59e0b', type: 'ריפוי בעיסוק' },
    { day: 1, hour: '10:00', name: 'רונית כ.', color: '#667eea', type: 'התנהגותי' },
    { day: 2, hour: '09:00', name: 'דנה ל.', color: '#10b981', type: 'שפה' },
    { day: 2, hour: '16:00', name: 'רונית כ.', color: '#667eea', type: 'רגשי' },
    { day: 3, hour: '10:00', name: 'מיכל ש.', color: '#f59e0b', type: 'ריפוי בעיסוק' },
    { day: 4, hour: '09:00', name: 'רונית כ.', color: '#667eea', type: 'התנהגותי' },
  ];
  return (
    <div className="lp-mockup-calendar">
      <div className="lp-mockup-cal-header">
        <span>◁</span>
        <span style={{ fontWeight: 700 }}>{'שבוע 10\u200E-14 מרץ 2026'}</span>
        <span>▷</span>
      </div>
      <div className="lp-mockup-cal-grid">
        {days.map((d, di) => (
          <div key={di} className="lp-mockup-cal-day">
            <div className="lp-mockup-cal-day-name">{d}</div>
            {sessions.filter(s => s.day === di).map((s, si) => (
              <div key={si} className="lp-mockup-cal-event" style={{ background: s.color + '22', borderRight: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{s.hour}</div>
                <div style={{ fontSize: 11 }}>{s.name}</div>
                <div style={{ fontSize: 9, opacity: .7 }}>{s.type}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupForm() {
  return (
    <div className="lp-mockup-form">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{'📋 טופס מעקב טיפולי'}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{'יואב כהן \u2014 סשן #34 \u2014 11.03.2026'}</div>
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
            <div style={{ fontSize: 20, fontWeight: 700, color: '#667eea' }}>75%</div>
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

function MockupTeam() {
  const team = [
    { name: 'רונית כהן', role: 'מטפלת התנהגותית', color: '#667eea', sessions: 12, emoji: '👩‍⚕️' },
    { name: 'מיכל שפירא', role: 'ריפוי בעיסוק', color: '#f59e0b', sessions: 8, emoji: '👩‍💼' },
    { name: 'דנה לוי', role: 'קלינאית תקשורת', color: '#10b981', sessions: 6, emoji: '👩‍🏫' },
    { name: 'ד"ר אבי מזרחי', role: 'פסיכולוג', color: '#8b5cf6', sessions: 3, emoji: '👨‍⚕️' },
  ];
  return (
    <div className="lp-mockup-team">
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>{'👥 צוות מטפלים \u2014 יואב'}</div>
      {team.map((t, i) => (
        <div key={i} className="lp-mockup-team-member">
          <div className="lp-mockup-team-avatar" style={{ background: t.color + '22', color: t.color }}>
            {t.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{t.name}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{t.role}</div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: t.color }}>{t.sessions}</div>
            <div style={{ fontSize: 10, color: '#888' }}>סשנים החודש</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MockupNotifications() {
  const notifs = [
    { icon: '🔔', text: 'רונית כהן מילאה טופס מעקב ליואב', time: 'לפני 5 דק׳', color: '#667eea' },
    { icon: '📊', text: 'המטרה "מיון קטגוריות" הגיעה ל\u200E-92% \u2014 שיא חדש!', time: 'לפני שעה', color: '#10b981' },
    { icon: '📋', text: 'תזכורת: טופס הערכה שבועי של נועם טרם מולא', time: 'לפני 3 שע׳', color: '#f59e0b' },
    { icon: '👥', text: 'ישיבת צוות מתוזמנת ליום ד׳ ב\u200E-14:00', time: 'מחר', color: '#8b5cf6' },
  ];
  return (
    <div className="lp-mockup-notifs">
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{'🔔 התראות ועדכונים'}</div>
      {notifs.map((n, i) => (
        <div key={i} className="lp-mockup-notif-item">
          <div className="lp-mockup-notif-icon" style={{ background: n.color + '18', color: n.color }}>{n.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13 }}>{n.text}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{n.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI capabilities showcase                                          */
/* ------------------------------------------------------------------ */
function AICapabilities() {
  const capabilities = [
    { icon: '📋', title: 'יצירת טפסים', desc: 'בקשו מהבינה המלאכותית ליצור טופס הערכה מותאם אישית לילד \u2014 היא תבנה אותו תוך שניות' },
    { icon: '🎯', title: 'הגדרת מטרות', desc: 'תארו את האתגר \u2014 הבינה המלאכותית תציע מטרות מדידות עם קריטריונים מדויקים' },
    { icon: '📊', title: 'ניתוח נתונים', desc: 'שאלו שאלות על ההתקדמות של ילד ותקבלו תובנות מעמיקות מבוססות נתונים' },
    { icon: '🛏️', title: 'לוחות משימות', desc: 'בקשו לוח משימות מותאם \u2014 הבינה המלאכותית תיצור אותו עם אמוג\'ים ומשימות מתאימות' },
    { icon: '💡', title: 'סיעור מוחות', desc: 'התייעצו על אסטרטגיות טיפול, רעיונות לפעילויות, ופתרונות יצירתיים' },
    { icon: '📝', title: 'סיכומים', desc: 'בקשו סיכום שבועי/חודשי \u2014 הבינה המלאכותית תרכז את כל הנתונים בצורה ברורה' },
  ];

  return (
    <div className="lp-ai-grid">
      {capabilities.map((c, i) => (
        <div key={i} className="lp-ai-card">
          <div className="lp-ai-card-icon">{c.icon}</div>
          <div className="lp-ai-card-title">{c.title}</div>
          <div className="lp-ai-card-desc">{c.desc}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Logo component using actual image                                 */
/* ------------------------------------------------------------------ */
function Logo({ size = 'normal' }: { size?: 'normal' | 'large' }) {
  const h = size === 'large' ? 64 : 44;
  return (
    <div className="lp-logo">
      <img src="/therapy/doing-logo-transparent2.png" alt="Doing" style={{ height: h, width: 'auto' }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating WhatsApp button                                          */
/* ------------------------------------------------------------------ */
const WA_ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="white"><path d="M16 0C7.2 0 0 7.2 0 16c0 2.8.7 5.5 2.1 7.9L.7 31.3l7.6-2a16 16 0 007.7 2C24.8 31.3 32 24.1 32 15.3 32 7.2 24.8 0 16 0zm8 22.6c-.4 1.1-2 2-3.2 2.3-.8.2-1.9.3-5.6-1.2-4.7-2-7.7-6.7-7.9-7-.2-.3-1.8-2.4-1.8-4.7 0-2.2 1.1-3.3 1.6-3.7.4-.5.9-.6 1.2-.6h.8c.3 0 .7-.1 1 .7.4.9 1.4 3.4 1.5 3.6.1.2.2.5 0 .8l-.4.8c-.2.3-.4.5-.1.9.2.3 1.1 1.8 2.4 2.9 1.6 1.4 3 1.9 3.4 2.1.5.2.7.2 1-.1.2-.3.9-1 1.2-1.4.2-.4.5-.3.8-.2.3.1 2 1 2.4 1.1.3.2.6.3.7.4.1.2.1.9-.3 1.7z"/></svg>');

const DINO_BASE = '/therapy/avatar/dinosaur';
const DINO_MOUTH = Array.from({ length: 6 }, (_, i) => `${DINO_BASE}/mouth_${i}.png`);
const DINO_THINK = Array.from({ length: 6 }, (_, i) => `${DINO_BASE}/thinking_${i}.png`);

function AnimatedDino() {
  const [frame, setFrame] = useState(0);
  const [mode, setMode] = useState<'talk' | 'think'>('talk');
  const frames = mode === 'talk' ? DINO_MOUTH : DINO_THINK;

  useEffect(() => {
    // Cycle through frames
    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, mode === 'talk' ? 180 : 350);
    return () => clearInterval(interval);
  }, [mode, frames.length]);

  useEffect(() => {
    // Switch between talking and thinking every few seconds
    const timeout = setTimeout(() => {
      setMode(prev => prev === 'talk' ? 'think' : 'talk');
    }, mode === 'talk' ? 4000 : 3000);
    return () => clearTimeout(timeout);
  }, [mode]);

  // Preload all frames
  useEffect(() => {
    [...DINO_MOUTH, ...DINO_THINK].forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  return (
    <div className="lp-dino-stage">
      <img
        src={frames[frame]}
        alt="דינו"
        className="lp-dino-img"
      />
      <div className="lp-dino-mode-label">
        {mode === 'talk' ? '🗣️ מדבר...' : '🤔 חושב...'}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero System Preview — professional app window mockup               */
/* ------------------------------------------------------------------ */
function HeroSystemPreview() {
  return (
    <div className="lp-hero-preview">
      {/* Browser chrome */}
      <div className="lp-preview-chrome">
        <div className="lp-preview-dots">
          <span /><span /><span />
        </div>
        <div className="lp-preview-url">app.startdoing.co.il</div>
      </div>

      {/* App sidebar + content */}
      <div className="lp-preview-body">
        {/* Sidebar */}
        <div className="lp-preview-sidebar">
          <div className="lp-preview-sidebar-logo">Doing</div>
          <div className="lp-preview-menu-item lp-preview-menu-active">דשבורד</div>
          <div className="lp-preview-menu-item">מטופלים</div>
          <div className="lp-preview-menu-item">מטרות</div>
          <div className="lp-preview-menu-item">טפסים</div>
          <div className="lp-preview-menu-item">לוח זמנים</div>
          <div className="lp-preview-menu-item">AI</div>
        </div>

        {/* Main content */}
        <div className="lp-preview-main">
          {/* Top metrics */}
          <div className="lp-preview-metrics">
            {[
              { label: 'מטופלים פעילים', value: '83', trend: '+12%' },
              { label: 'סשנים השבוע', value: '47', trend: '+8%' },
              { label: 'מטרות בהתקדמות', value: '156', trend: '+23%' },
            ].map((m, i) => (
              <div key={i} className="lp-preview-metric">
                <div className="lp-preview-metric-label">{m.label}</div>
                <div className="lp-preview-metric-row">
                  <span className="lp-preview-metric-value">{m.value}</span>
                  <span className="lp-preview-metric-trend">{m.trend}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div className="lp-preview-chart">
            <div className="lp-preview-chart-title">התקדמות מטרות — 4 שבועות אחרונים</div>
            <div className="lp-preview-chart-bars">
              {[45, 58, 62, 71, 68, 78, 82, 88].map((h, i) => (
                <div key={i} className="lp-preview-bar-col">
                  <div className="lp-preview-bar" style={{ height: `${h}%` }} />
                </div>
              ))}
            </div>
          </div>

          {/* Recent activity table */}
          <div className="lp-preview-table">
            <div className="lp-preview-table-header">
              <span>מטופל</span>
              <span>מטרה</span>
              <span>התקדמות</span>
              <span>סטטוס</span>
            </div>
            {[
              { name: 'ת.כ', goal: 'משחק חברתי בתורות', progress: 78, status: 'בטיפול' },
              { name: 'י.ל', goal: 'העתקת דגם קוביות', progress: 92, status: 'הושג' },
              { name: 'נ.ש', goal: 'מיון קטגוריות', progress: 45, status: 'בטיפול' },
            ].map((r, i) => (
              <div key={i} className="lp-preview-table-row">
                <span className="lp-preview-table-name">{r.name}</span>
                <span>{r.goal}</span>
                <span>
                  <div className="lp-preview-progress">
                    <div className="lp-preview-progress-fill" style={{ width: `${r.progress}%` }} />
                  </div>
                </span>
                <span className={`lp-preview-status ${r.status === 'הושג' ? 'lp-preview-status-done' : ''}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppFloat() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="lp-whatsapp-float"
      aria-label="WhatsApp"
    >
      <img src={WA_ICON} alt="" width="28" height="28" className="lp-wa-icon" />
      <span className="lp-whatsapp-label">דברו איתנו</span>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Landing Page                                                 */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  const onScroll = useCallback(() => setScrollY(window.scrollY), []);
  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Doing | פלטפורמת ניהול טיפול למרכזים מקצועיים';
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute('content') || '';
    if (meta) meta.setAttribute('content', 'פלטפורמת Doing מאפשרת למרכזי טיפול לנהל מטפלות, מפגשים, טפסים, יעדים ולוחות משימות — הכל במקום אחד, מופעל בינה מלאכותית.');
    return () => {
      document.title = prev;
      if (meta) meta.setAttribute('content', prevDesc);
    };
  }, []);

  return (
    <div className="lp-root" dir="rtl">
      {/* ---------- NAV ---------- */}
      <nav className={`lp-nav ${scrollY > 60 ? 'lp-nav-scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <Logo size="large" />
          <div className="lp-nav-links">
            <a href="#features">יכולות</a>
            <a href="#ai">בינה מלאכותית</a>
            <a href="#benefits">יתרונות</a>
            <a href="#contact">צור קשר</a>
          </div>
          <div className="lp-nav-actions">
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="lp-nav-link-secondary">
              יצירת קשר
            </a>
            <button className="lp-nav-cta" onClick={() => navigate('/login')}>
              כניסה למערכת
            </button>
          </div>
        </div>
      </nav>

      {/* ---------- HERO ---------- */}
      <div className="lp-hero-wrapper">
      <section className="lp-hero">
        <div className="lp-hero-content">
          <div className="lp-hero-label">פלטפורמת ניהול טיפול למרכזים מקצועיים</div>
          <h1 className="lp-hero-title">
            ניהול מטרות טיפול, איסוף נתונים
            <br />
            <span className="lp-hero-title-accent">ומעקב טיפולי במקום אחד</span>
          </h1>
          <p className="lp-hero-subtitle">
            Doing מאפשרת למרכזי טיפול לנהל מטרות, לתעד מפגשים ולאסוף נתונים קליניים בצורה מסודרת. מערכת אחת שמחליפה אקסלים, תיקיות ונייר — עם בינה מלאכותית שמבינה טיפול.
          </p>
          <div className="lp-hero-actions">
            <button className="lp-btn lp-btn-primary" onClick={() => navigate('/login')}>
              התחילו לעבוד עם Doing
              <span className="lp-btn-arrow">&larr;</span>
            </button>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn lp-btn-outline"
            >
              תיאום הדגמה
            </a>
          </div>
          <div className="lp-hero-trust">
            <div className="lp-trust-item">
              <span className="lp-trust-icon">&#10003;</span>
              <span>ללא התחייבות</span>
            </div>
            <div className="lp-trust-item">
              <span className="lp-trust-icon">&#10003;</span>
              <span>הקמה תוך דקות</span>
            </div>
            <div className="lp-trust-item">
              <span className="lp-trust-icon">&#10003;</span>
              <span>תמיכה מקצועית</span>
            </div>
          </div>
        </div>
        <div className="lp-hero-visual">
          <HeroSystemPreview />
        </div>
      </section>
      </div>

      {/* ---------- FEATURES ---------- */}
      <section id="features" className="lp-section">
        <div className="lp-container">
          <Reveal>
            <div className="lp-section-header">
              <div className="lp-section-badge">{'🎯 יכולות המערכת'}</div>
              <h2 className="lp-section-title">כל מה שצריך לניהול טיפול מקצועי</h2>
              <p className="lp-section-subtitle">מערכת אחת שמחליפה אקסלים, דפים, קבוצות וואטסאפ, ותיקיות</p>
            </div>
          </Reveal>

          {/* Feature 1: Kid Management + Board */}
          <div className="lp-feature-row">
            <Reveal>
              <div className="lp-feature-text">
                <div className="lp-feature-number">01</div>
                <h3 className="lp-feature-title">לוח משימות אישי לכל ילד</h3>
                <p className="lp-feature-desc">
                  {'כל ילד מקבל פרופיל מלא עם תמונה, גיל, ופרטים רלוונטיים. ליצור לוח משימות ויזואלי עם אמוג\'ים שהילד אוהב \u2014 תוך שניות. ההורים מקבלים קישור לצפייה בלוח ובהתקדמות.'}
                </p>
                <ul className="lp-feature-list">
                  <li>{'✅ פרופיל ילד מלא עם אווטר'}</li>
                  <li>{'✅ לוח משימות ויזואלי מותאם אישית'}</li>
                  <li>{'✅ קישור להורים לצפייה בזמן אמת'}</li>
                  <li>{'✅ מעקב ביצוע ותגמולים'}</li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="lp-feature-visual">
                <MockupBoard />
              </div>
            </Reveal>
          </div>

          {/* Feature 2: Goals */}
          <div className="lp-feature-row lp-feature-row-reverse">
            <Reveal>
              <div className="lp-feature-text">
                <div className="lp-feature-number">02</div>
                <h3 className="lp-feature-title">מטרות טיפוליות ומעקב התקדמות</h3>
                <p className="lp-feature-desc">
                  הגדירו מטרות מדידות לכל ילד, עקבו אחרי אחוזי הצלחה לאורך זמן, וצפו בגרפים שמראים את ההתקדמות האמיתית. כל סשן מזין נתונים שהופכים לתובנות מיידיות.
                </p>
                <ul className="lp-feature-list">
                  <li>{'📊 גרפי התקדמות שבועיים וחודשיים'}</li>
                  <li>{'🎯 מטרות עם קריטריונים מדידים'}</li>
                  <li>{'📈 ספריית מטרות משותפת למרכז'}</li>
                  <li>{'⚡ עדכון נתונים ישירות מהטופס'}</li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="lp-feature-visual">
                <MockupGoals />
              </div>
            </Reveal>
          </div>

          {/* Feature 3: Sessions + Calendar */}
          <div className="lp-feature-row">
            <Reveal>
              <div className="lp-feature-text">
                <div className="lp-feature-number">03</div>
                <h3 className="lp-feature-title">יומן סשנים ולוח שנה</h3>
                <p className="lp-feature-desc">
                  {'כל הסשנים של כל המטפלות \u2014 ביומן אחד ברור. צפו בלוח השבועי, סננו לפי מטפלת, ותראו מי עבד עם מי ומתי. כל סשן מקושר ישירות לטופס שמולא.'}
                </p>
                <ul className="lp-feature-list">
                  <li>{'📅 תצוגת יומן שבועית וחודשית'}</li>
                  <li>{'🎨 צבע ייחודי לכל מטפלת'}</li>
                  <li>{'🔗 קישור ישיר מסשן לטופס'}</li>
                  <li>{'📱 עובד מושלם גם בנייד'}</li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="lp-feature-visual">
                <MockupCalendar />
              </div>
            </Reveal>
          </div>

          {/* Feature 4: Forms */}
          <div className="lp-feature-row lp-feature-row-reverse">
            <Reveal>
              <div className="lp-feature-text">
                <div className="lp-feature-number">04</div>
                <h3 className="lp-feature-title">טפסים מקצועיים ואיסוף נתונים</h3>
                <p className="lp-feature-desc">
                  {'צרו טפסי מעקב טיפולי מותאמים \u2014 עם סעיפים לכל מטרה, מד מצב רוח, ספירת ניסיונות/הצלחות, והערות חופשיות. כל הנתונים נשמרים ומוזנים ישירות לגרפי ההתקדמות.'}
                </p>
                <ul className="lp-feature-list">
                  <li>{'📝 טפסי סשן מותאמים אישית'}</li>
                  <li>{'📋 טפסי ישיבות צוות'}</li>
                  <li>{'🔢 איסוף נתונים כמותי לכל מטרה'}</li>
                  <li>{'💾 שמירה אוטומטית ועריכה חוזרת'}</li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="lp-feature-visual">
                <MockupForm />
              </div>
            </Reveal>
          </div>

          {/* Feature 5: Team */}
          <div className="lp-feature-row">
            <Reveal>
              <div className="lp-feature-text">
                <div className="lp-feature-number">05</div>
                <h3 className="lp-feature-title">ניהול צוות מטפלות</h3>
                <p className="lp-feature-desc">
                  {'שייכו מטפלות לילדים, עקבו אחרי מספר הסשנים של כל מטפלת, ותנו לכל מטפלת גישה מותאמת \u2014 היא רואה רק את הילדים שלה, ממלאת טפסים, ומקבלת התראות רלוונטיות.'}
                </p>
                <ul className="lp-feature-list">
                  <li>{'👥 פרופיל מטפלת עם תפקיד ומומחיות'}</li>
                  <li>{'🔐 גישה מבוקרת לפי שיוך'}</li>
                  <li>{'📱 ממשק מטפלת נפרד ופשוט'}</li>
                  <li>{'📊 סטטיסטיקות פעילות למטפלת'}</li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="lp-feature-visual">
                <MockupTeam />
              </div>
            </Reveal>
          </div>

          {/* Feature 6: Notifications */}
          <div className="lp-feature-row lp-feature-row-reverse">
            <Reveal>
              <div className="lp-feature-text">
                <div className="lp-feature-number">06</div>
                <h3 className="lp-feature-title">התראות והודעות לצוות</h3>
                <p className="lp-feature-desc">
                  קבלו עדכונים על טפסים שמולאו, מטרות שהגיעו לשיא, תזכורות למילוי טפסים, וישיבות צוות מתקרבות. כל אחד בצוות מקבל רק מה שרלוונטי אליו.
                </p>
                <ul className="lp-feature-list">
                  <li>{'🔔 התראות בזמן אמת'}</li>
                  <li>{'📋 תזכורות למילוי טפסים'}</li>
                  <li>{'🎯 עדכוני שיא במטרות'}</li>
                  <li>{'👁️ כל מטפלת רואה רק את ההתראות שלה'}</li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="lp-feature-visual">
                <MockupNotifications />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- AI SECTION ---------- */}
      <section id="ai" className="lp-section lp-section-ai">
        <div className="lp-container">
          <Reveal>
            <div className="lp-section-header">
              <div className="lp-section-badge lp-badge-ai">{'🤖 בינה מלאכותית'}</div>
              <h2 className="lp-section-title lp-title-light">
                {'עוזר AI שמבין טיפול'}
              </h2>
              <p className="lp-section-subtitle lp-subtitle-light">
                {'לא צריך להיות טכנולוגי \u2014 פשוט כתבו מה שאתם צריכים בעברית רגילה'}
                <br />
                והבינה המלאכותית תעשה את השאר
              </p>
            </div>
          </Reveal>

          <div className="lp-ai-demo-row">
            <Reveal>
              <div className="lp-ai-demo-chat">
                <MockupChat />
              </div>
            </Reveal>
            <Reveal delay={200}>
              <div className="lp-ai-demo-capabilities">
                <AICapabilities />
              </div>
            </Reveal>
          </div>

          <Reveal>
            <div className="lp-ai-highlight">
              <div className="lp-ai-highlight-icon">💡</div>
              <div>
                <div className="lp-ai-highlight-title">הבינה המלאכותית מכירה את כל הנתונים שלכם</div>
                <div className="lp-ai-highlight-desc">
                  {'היא יכולה לגשת למידע על הילדים, לנתח התקדמות, ליצור טפסים ולוחות, להציע מטרות, ולעזור בסיעור מוחות \u2014 הכל בשיחה פשוטה. כמו עוזרת מנהלית שעובדת 24/7.'}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- DINO ---------- */}
      <section id="dino" className="lp-section lp-section-dino">
        <div className="lp-container">
          <div className="lp-dino-row">
            <Reveal>
              <div className="lp-dino-visual">
                <AnimatedDino />
                <div className="lp-dino-bubble">
                  היי! אני דינו! אני מדבר עם ילדים, מעודד אותם לסיים משימות, ועוזר להם להרגיש גיבורים!
                </div>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="lp-dino-text">
                <div className="lp-section-badge">{'🦕 הכירו את דינו'}</div>
                <h2 className="lp-feature-title">{'דינו \u2014 החבר של הילדים'}</h2>
                <p className="lp-feature-desc">
                  דינו הוא דמות מונפשת חכמה שמדברת עם הילדים בקול, מעודדת אותם להשלים משימות, ומגיבה בזמן אמת. הוא הופך את לוח המשימות לחוויה כיפית שהילדים פשוט אוהבים.
                </p>
                <ul className="lp-feature-list">
                  <li>🎤 מדבר ומגיב בקול אמיתי</li>
                  <li>🏆 מעודד ומחמיא על כל משימה שהושלמה</li>
                  <li>😊 אנימציות חושב ומדבר</li>
                  <li>🧠 מותאם אישית לכל ילד וילדה</li>
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- BENEFITS ---------- */}
      <section id="benefits" className="lp-section">
        <div className="lp-container">
          <Reveal>
            <div className="lp-section-header">
              <div className="lp-section-badge">{'💎 למה Doing?'}</div>
              <h2 className="lp-section-title">היתרונות שמשנים את הטיפול</h2>
            </div>
          </Reveal>

          <div className="lp-benefits-grid">
            {[
              { icon: '⏱️', title: 'חסכון בזמן', desc: 'במקום שעות של ניירת \u2014 דקות. טפסים אוטומטיים, נתונים שמתעדכנים לבד, ובינה מלאכותית שעושה בשבילכם.', stat: '70%', statLabel: 'פחות ניירת' },
              { icon: '📊', title: 'החלטות מבוססות נתונים', desc: 'כל סשן מייצר נתונים. כל נתון הופך לגרף. כל גרף מספר סיפור. תראו את ההתקדמות האמיתית.', stat: '100%', statLabel: 'שקיפות' },
              { icon: '👥', title: 'עבודת צוות מושלמת', desc: 'כולם רואים את אותו מידע. מטפלות יודעות מה קרה בסשן הקודם. מנהלות רואות את התמונה הגדולה.', stat: '∞', statLabel: 'סנכרון' },
              { icon: '📱', title: 'נגיש מכל מקום', desc: 'עובד בנייד, בטאבלט ובמחשב. מטפלות ממלאות טפסים תוך כדי הסשן. הורים צופים מהבית.', stat: '24/7', statLabel: 'זמינות' },
              { icon: '🔐', title: 'פרטיות ואבטחה', desc: 'כל מטפלת רואה רק את הילדים שמשויכים אליה. הורים רואים רק קריאה. הנתונים מוגנים.', stat: '🛡️', statLabel: 'מוגן' },
              { icon: '🤖', title: 'AI שעוזר באמת', desc: 'לא גימיק \u2014 בינה מלאכותית שמבינה טיפול, יוצרת טפסים, מנתחת נתונים, ומציעה מטרות. באמת עובד.', stat: '🧠', statLabel: 'חכם' },
            ].map((b, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="lp-benefit-card">
                  <div className="lp-benefit-stat">{b.stat}</div>
                  <div className="lp-benefit-stat-label">{b.statLabel}</div>
                  <div className="lp-benefit-icon">{b.icon}</div>
                  <h4 className="lp-benefit-title">{b.title}</h4>
                  <p className="lp-benefit-desc">{b.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- DEMO / SHOWCASE ---------- */}
      <section id="demo" className="lp-section lp-section-demo">
        <div className="lp-container">
          <Reveal>
            <div className="lp-section-header">
              <div className="lp-section-badge">{'🖥️ ראו בעצמכם'}</div>
              <h2 className="lp-section-title">כך נראה ניהול טיפול מקצועי</h2>
              <p className="lp-section-subtitle">{'ממשק נקי, פשוט ואינטואיטיבי \u2014 גם למי שלא טכנולוגי'}</p>
            </div>
          </Reveal>

          <div className="lp-demo-grid">
            <Reveal>
              <div className="lp-demo-card lp-demo-card-large">
                <div className="lp-demo-label">לוח שנה וסשנים</div>
                <MockupCalendar />
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="lp-demo-card">
                <div className="lp-demo-label">מטרות והתקדמות</div>
                <MockupGoals />
              </div>
            </Reveal>
            <Reveal delay={200}>
              <div className="lp-demo-card">
                <div className="lp-demo-label">טופס מעקב טיפולי</div>
                <MockupForm />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- WHO IS IT FOR ---------- */}
      <section className="lp-section">
        <div className="lp-container">
          <Reveal>
            <div className="lp-section-header">
              <div className="lp-section-badge">{'👩‍⚕️ בשבילכם'}</div>
              <h2 className="lp-section-title">למי המערכת מתאימה?</h2>
            </div>
          </Reveal>
          <div className="lp-personas-grid">
            {[
              { emoji: '🏥', title: 'מנהלי מרכזי טיפול', desc: 'ראו את כל הילדים, כל המטפלות, כל הסשנים \u2014 מסך אחד. קבלו החלטות מבוססות נתונים ושמרו על סטנדרט מקצועי.', features: ['ניהול מרכזי של צוותים', 'דוחות ותובנות', 'ספריית מטרות משותפת'] },
              { emoji: '👩‍⚕️', title: 'מטפלות ואנשי מקצוע', desc: 'מלאו טפסים בקלות, ראו את ההתקדמות של הילדים שלכם, ותקשרו עם הצוות \u2014 הכל מהנייד.', features: ['מילוי טפסים מהיר', 'גישה מהנייד', 'צפייה במטרות'] },
              { emoji: '👨‍👩‍👦', title: 'הורים', desc: 'קבלו קישור אישי לצפייה בלוח המשימות של ילדכם, ראו את ההתקדמות, ותהיו חלק מהתהליך.', features: ['לוח משימות ויזואלי', 'מעקב התקדמות', 'שקיפות מלאה'] },
              { emoji: '🧩', title: 'מטפלות עצמאיות', desc: 'גם בלי מרכז \u2014 נהלו את הילדים שלכם בצורה מקצועית. טפסים, מטרות, לוחות \u2014 הכל במקום אחד.', features: ['ניהול עצמאי', 'AI שעוזר', 'חינם להתחלה'] },
            ].map((p, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="lp-persona-card">
                  <div className="lp-persona-emoji">{p.emoji}</div>
                  <h4 className="lp-persona-title">{p.title}</h4>
                  <p className="lp-persona-desc">{p.desc}</p>
                  <ul className="lp-persona-features">
                    {p.features.map((f, fi) => <li key={fi}>{'✓ ' + f}</li>)}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="lp-cta-section">
        <div className="lp-cta-bg">
          <div className="lp-hero-shape lp-hero-shape-1" />
          <div className="lp-hero-shape lp-hero-shape-2" />
        </div>
        <Reveal>
          <div className="lp-container lp-cta-content">
            <h2 className="lp-cta-title">מוכנים לשדרג את הטיפול?</h2>
            <p className="lp-cta-subtitle">
              {'הצטרפו למאות מטפלות ומרכזי טיפול שכבר עובדים עם Doing'}
            </p>
            <div className="lp-cta-buttons">
              <button className="lp-btn lp-btn-primary lp-btn-large" onClick={() => navigate('/login')}>
                {'התחילו לעשות \u2014 חינם'}
                <span className="lp-btn-arrow">←</span>
              </button>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-btn lp-btn-whatsapp-light lp-btn-large"
              >
                <img src={WA_ICON} alt="" className="lp-wa-icon" style={{ width: 22, height: 22 }} />
                דברו איתנו בוואטסאפ
              </a>
            </div>
            <p className="lp-cta-note">{'ללא כרטיס אשראי \u2022 הקמה תוך דקות \u2022 תמיכה בעברית'}</p>
          </div>
        </Reveal>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-brand">
            <Logo />
            <p style={{ marginTop: 8, fontSize: 13, color: '#94a3b8' }}>ניהול טיפול חכם</p>
          </div>
          <div className="lp-footer-links">
            <a href="#features">יכולות</a>
            <a href="#ai">בינה מלאכותית</a>
            <a href="#benefits">יתרונות</a>
            <a href="#demo">הדגמה</a>
          </div>
          <div className="lp-footer-copy">
            {'© 2026 Doing \u2014 כל הזכויות שמורות'}
          </div>
        </div>
      </footer>

      {/* ---------- floating WhatsApp ---------- */}
      <WhatsAppFloat />
    </div>
  );
}
