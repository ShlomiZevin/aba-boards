import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { SLIDES } from './index';
import { AUTHS, AUTH_PREFIX, ADMIN_KEY, getStoredAuth, SlidesAuthContext, type AuthKey } from './auth';

const LOGO_URL = '/therapy/doing-logo-transparent2.png';

interface Props {
  slideId: number;
  section: string;
  children: ReactNode;
  variant?: 'cover' | 'content' | 'closing';
}

export default function SlideLayout({ slideId, section, children, variant = 'content' }: Props) {
  const navigate = useNavigate();
  const total = SLIDES.length;
  const prev = slideId > 1 ? slideId - 1 : null;
  const next = slideId < total ? slideId + 1 : null;

  // Per-slide auth state (Michal | Demo). Stored in localStorage per slide.
  const [auth, setAuth] = useState<AuthKey>(() => getStoredAuth(slideId, 'michal'));

  // SlideEmbed registers its current URL here so the footer can show an
  // "open in new tab" link for the embedded page.
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  // Reset registered embed URL when navigating between slides
  useEffect(() => { setEmbedUrl(null); }, [slideId]);

  // Re-read pref when navigating between slides
  useEffect(() => {
    setAuth(getStoredAuth(slideId, 'michal'));
  }, [slideId]);

  // Keep global admin_key in sync with the current slide's auth so the iframe
  // (which shares localStorage same-origin) loads as the right account
  useEffect(() => {
    try {
      const wanted = AUTHS[auth].key;
      if (localStorage.getItem(ADMIN_KEY) !== wanted) {
        localStorage.setItem(ADMIN_KEY, wanted);
      }
    } catch {}
  }, [auth]);

  function changeAuth(k: AuthKey) {
    if (k === auth) return;
    try {
      localStorage.setItem(`${AUTH_PREFIX}${slideId}`, k);
      localStorage.setItem(ADMIN_KEY, AUTHS[k].key);
    } catch {}
    setAuth(k);
  }

  // Override host-page body styles (purple gradient, padding) while in slides
  useEffect(() => {
    document.body.classList.add('sl-active');
    return () => document.body.classList.remove('sl-active');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && prev) navigate(`/slides/${prev}`);
      if (e.key === 'ArrowLeft' && next) navigate(`/slides/${next}`);
      if (e.key === 'Escape') navigate('/slides');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, prev, next]);

  const showAuthToggle = variant === 'content';

  return (
    <SlidesAuthContext.Provider value={{ auth, setAuth: changeAuth, embedUrl, setEmbedUrl }}>
      <div className={`sl-root sl-v-${variant}`} dir="rtl">
        <header className="sl-topbar">
          <button className="sl-logo-btn" onClick={() => navigate('/slides')} aria-label="תפריט">
            <img src={LOGO_URL} alt="Doing" />
          </button>
          {section && <span className="sl-topbar-section">{section}</span>}
        </header>

        <main className="sl-stage">{children}</main>

        <footer className="sl-foot">
          <div className="sl-foot-side sl-foot-start">{/* visual right (RTL start) */}</div>
          <div className="sl-foot-center">
            <button
              className="sl-arrow"
              onClick={() => prev && navigate(`/slides/${prev}`)}
              disabled={!prev}
              aria-label="הקודם"
            >→</button>
            <span className="sl-pager">{String(slideId).padStart(2, '0')} <em>/</em> {String(total).padStart(2, '0')}</span>
            <button
              className="sl-arrow"
              onClick={() => next && navigate(`/slides/${next}`)}
              disabled={!next}
              aria-label="הבא"
            >←</button>
          </div>
          <div className="sl-foot-side sl-foot-end">
            {showAuthToggle && embedUrl && (
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="sl-external-btn"
                title="פתח בכרטיסייה חדשה"
              >
                פתח בכרטיסייה ↗
              </a>
            )}
            {showAuthToggle && (
              <div className="sl-auth-toggle" role="radiogroup" aria-label="חשבון">
                {(Object.keys(AUTHS) as AuthKey[]).map(k => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={auth === k}
                    onClick={() => changeAuth(k)}
                    className={`sl-auth-toggle-btn${auth === k ? ' sl-auth-toggle-on' : ''}`}
                  >
                    {AUTHS[k].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </footer>
      </div>
    </SlidesAuthContext.Provider>
  );
}
