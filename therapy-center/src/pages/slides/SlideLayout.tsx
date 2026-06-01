import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { SLIDES } from './index';

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

  return (
    <div className={`sl-root sl-v-${variant}`} dir="rtl">
      <header className="sl-topbar">
        <button className="sl-logo-btn" onClick={() => navigate('/slides')} aria-label="תפריט">
          <img src={LOGO_URL} alt="Doing" />
        </button>
        {section && <span className="sl-topbar-section">{section}</span>}
      </header>

      <main className="sl-stage">{children}</main>

      <footer className="sl-foot">
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
      </footer>
    </div>
  );
}
