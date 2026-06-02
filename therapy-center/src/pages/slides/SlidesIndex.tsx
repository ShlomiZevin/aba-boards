import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { SECTIONS, getEffectiveSlides, slidesInSection } from './index';

const LOGO_URL = '/therapy/doing-logo-transparent2.png';

export default function SlidesIndex() {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('sl-active');
    return () => document.body.classList.remove('sl-active');
  }, []);

  const effective = useMemo(() => getEffectiveSlides(), []);

  return (
    <div className="sl-root sl-index" dir="rtl">
      <button className="sl-logo-btn" onClick={() => navigate('/slides')} aria-label="Doing">
        <img src={LOGO_URL} alt="Doing" />
      </button>

      <main className="sl-stage">
        <div className="sl-toc">
          <header className="sl-toc-head">
            <h1 className="sl-toc-h1">מצגת היכרות</h1>
            <p className="sl-toc-sub">סיור במערכת — {SECTIONS.length} פרקים · {effective.length} שקפים</p>
          </header>

          <nav className="sl-toc-nav">
            {SECTIONS.map((sec, i) => {
              const slides = slidesInSection(sec, effective);
              const hasSlides = slides.length > 0;
              const firstId = hasSlides ? slides[0].id : null;
              const summary = hasSlides
                ? slides.map(s => s.title).join(' · ')
                : sec.brief ? 'מעבר קצר — אפשר לבנות לבד או שנעזור' : 'אין שקפים בקטגוריה';

              const inner = (
                <>
                  <div className="sl-toc-sec-num">{String(i + 1).padStart(2, '0')}</div>
                  <div className="sl-toc-sec-body">
                    <h2 className="sl-toc-sec-name">
                      {sec.name}
                      {sec.brief && <span className="sl-toc-brief">מעבר קצר</span>}
                    </h2>
                    <p className="sl-toc-sec-sum">{summary}</p>
                  </div>
                  {hasSlides && <div className="sl-toc-sec-arrow">←</div>}
                </>
              );

              return hasSlides && firstId !== null ? (
                <Link key={i} to={`/slides/${firstId}`} className="sl-toc-sec-only sl-toc-sec-link">
                  {inner}
                </Link>
              ) : (
                <div key={i} className="sl-toc-sec-only sl-toc-sec-dim">{inner}</div>
              );
            })}
          </nav>
        </div>
      </main>
    </div>
  );
}
