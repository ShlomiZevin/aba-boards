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
function Reveal({ children, delay = 0, className = '', scale = false }: { children: ReactNode; delay?: number; className?: string; scale?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const hiddenTransform = scale ? 'translateY(40px) scale(.92)' : 'translateY(24px)';
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

  return (
    <div className="ln-root" dir="rtl">
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
                    <CountUp target={150} suffix="+" startDelay={600} />
                    <div className="ln-stat-label">ילדים במערכת</div>
                  </div>
                </Reveal>
                <Reveal delay={250}>
                  <div className="ln-stat-item">
                    <CountUp target={30} suffix="+" duration={1200} startDelay={600} />
                    <div className="ln-stat-label">מטפלות פעילות</div>
                  </div>
                </Reveal>
                <Reveal delay={400}>
                  <div className="ln-stat-item">
                    <CountUp target={1000} suffix="+" duration={2200} startDelay={600} />
                    <div className="ln-stat-label">מפגשים מתועדים</div>
                  </div>
                </Reveal>
              </div>
            </div>
          </Reveal>

          <Reveal delay={200} scale>
            <div className="ln-hero-mockup-wrapper">
              <AppMockup />
            </div>
          </Reveal>
        </div>
      </section>

      <WhatsAppFloat />
    </div>
  );
}
