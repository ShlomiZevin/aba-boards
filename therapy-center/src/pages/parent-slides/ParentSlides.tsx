import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SLIDES, type Slide, type Block } from './slides';
import './parent-slides.css';

// Render **bold** inline emphasis without dangerouslySetInnerHTML.
function rich(text: string) {
  return text.split('**').map((seg, i) =>
    i % 2 === 1 ? <b key={i}>{seg}</b> : <span key={i}>{seg}</span>
  );
}

const LOGO = import.meta.env.BASE_URL + 'doing-logo-transparent2.png';

// Pastels for the prompt ladder (most-intrusive → least), matching the source slide.
const LADDER_COLORS = ['#d8caf9', '#dde2e9', '#caddf9', '#cfead9', '#f6e5aa', '#f7d2bd', '#c4e9ef'];

function TargetIcon() {
  return (
    <svg viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="31" cy="41" r="24" />
      <circle cx="31" cy="41" r="15" />
      <circle cx="31" cy="41" r="6" fill="currentColor" stroke="none" />
      <path d="M31 41 61 11" />
      <path d="M49 11h12v12" />
    </svg>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'lead':
      return <p className="ps-lead rise">{rich(block.text)}</p>;
    case 'pull':
      return <p className="ps-pull rise">{rich(block.text)}</p>;
    case 'bullets':
      return (
        <ul className="ps-soft rise">
          {block.items.map((it, i) => <li key={i}><span className="t">{rich(it)}</span></li>)}
        </ul>
      );
    case 'steps':
      return (
        <ol className="ps-steps rise">
          {block.items.map((it, i) => (
            <li key={i}><span className="n">{i + 1}</span><span className="t">{rich(it)}</span></li>
          ))}
        </ol>
      );
    case 'chips': {
      const hasIcons = block.items.some(it => it.icon);
      return (
        <div className={`ps-chips${hasIcons ? ' icons' : ''} rise`}>
          {block.items.map((c, i) => (
            <span className="ps-chip" key={i}>
              {c.icon ? <span className="ps-chip-emoji" aria-hidden>{c.icon}</span> : <span className="dot" />}
              <b>{c.label}</b>
              {c.sub && <span className="sub">{c.sub}</span>}
            </span>
          ))}
        </div>
      );
    }
    case 'abc':
      return (
        <div className="ps-abc rise">
          {block.items.map((b, i) => (
            <div className="ps-abc-row" key={i}>
              <div className={`ps-box${i === 1 ? ' mid' : ''}`}>
                <div className="lab">{b.lab}</div>
                <div className="big">{b.big}</div>
                <div className="ex">{b.ex}</div>
              </div>
              {i < block.items.length - 1 && <div className="ps-arrow" aria-hidden>←</div>}
            </div>
          ))}
        </div>
      );
    case 'compare':
      return (
        <div className="ps-cols rise">
          {block.cards.map((c, i) => (
            <div className="ps-card" key={i}>
              <div className="tag">{c.tag}</div>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </div>
          ))}
        </div>
      );
    case 'matrix':
      return (
        <div className="ps-matrix rise">
          {block.groups.map((g, i) => (
            <div className={`ps-mgroup ${g.tone}`} key={i}>
              <div className="ps-mhead">
                <span className="ps-mdir" aria-hidden>{g.tone === 'up' ? '↑' : '↓'}</span>
                {g.head}
              </div>
              {g.note && <div className="ps-mnote">{g.note}</div>}
              <div className="ps-mrows">
                {g.rows.map((r, j) => (
                  <div className="ps-mrow" key={j}>
                    <b>{r.name}</b>
                    {r.kinds && <span>{r.kinds}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    case 'ladder':
      return (
        <div className="ps-ladder rise">
          {block.items.map((s, i) => (
            <div className={`ps-step${s.important ? ' important' : ''}`} key={i} style={{ background: LADDER_COLORS[i % LADDER_COLORS.length] }}>
              <span className="ps-step-n">{i + 1}</span>
              <b>{s.label}</b>
              {s.ex && <span className="ps-step-ex">{s.ex}</span>}
            </div>
          ))}
        </div>
      );
    case 'charts':
      return (
        <div className="ps-charts rise">
          <div className="ps-chart-card">
            <div className="ps-chart-title">התקדמות לאורך זמן</div>
            <svg className="ps-chart-svg" viewBox="0 0 220 110" aria-hidden>
              <line className="ps-grid" x1="12" y1="30" x2="208" y2="30" />
              <line className="ps-grid" x1="12" y1="62" x2="208" y2="62" />
              <line className="ps-grid" x1="12" y1="94" x2="208" y2="94" />
              <path className="ps-area" d="M206,88 L172,80 L138,66 L104,58 L70,42 L36,30 L14,18 L14,98 L206,98 Z" />
              <polyline className="ps-line" points="206,88 172,80 138,66 104,58 70,42 36,30 14,18" />
              <circle className="ps-dot" cx="14" cy="18" r="4.5" />
            </svg>
          </div>
          <div className="ps-chart-card">
            <div className="ps-chart-title">שיתוף פעולה לפי מפגש</div>
            <svg className="ps-chart-svg" viewBox="0 0 220 110" aria-hidden>
              {[34, 44, 52, 66, 78, 92].map((h, i) => (
                <rect key={i} className={`ps-bar${i === 5 ? ' tall' : ''}`} x={184 - i * 32} y={100 - h} width="24" height={h} rx="4" />
              ))}
            </svg>
          </div>
          <div className="ps-chart-card ps-chart-stat">
            <div className="ps-stat-num">82%</div>
            <div className="ps-chart-title">הצלחה בממוצע</div>
          </div>
        </div>
      );
    case 'table':
      return (
        <div className="ps-tablewrap rise">
          <table className="ps-table">
            <thead>
              <tr>{block.cols.map((c, i) => <th key={i} className={i === 0 ? 'lead' : ''}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>{row.map((cell, j) => <td key={j} className={j === 0 ? 'lead' : ''}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

function SlideView({ slide }: { slide: Slide }) {
  if (slide.variant === 'content') {
    const body = (
      <>
        {slide.kick && <div className="ps-kick rise">{slide.kick}</div>}
        <h1 className="ps-title rise">{slide.title}</h1>
        {slide.blocks.map((b, i) => <BlockView key={i} block={b} />)}
      </>
    );
    if (slide.art === 'target') {
      return (
        <div className="ps-inner ps-split">
          <div className="ps-split-text">{body}</div>
          <div className="ps-split-art rise"><TargetIcon /></div>
        </div>
      );
    }
    return <div className="ps-inner">{body}</div>;
  }
  if (slide.variant === 'section') {
    return (
      <div className="ps-inner">
        <h1 className="ps-divider-title rise">{slide.title}</h1>
        {slide.sub && <p className="ps-sub rise">{slide.sub}</p>}
      </div>
    );
  }
  return (
    <div className="ps-inner">
      <img className="ps-logo-lg" src={LOGO} alt="Doing" />
      {slide.eng && <div className="ps-eng">{slide.eng}</div>}
      <h1 className="ps-title">{slide.title}</h1>
      {slide.sub && <p className="ps-sub">{slide.sub}</p>}
    </div>
  );
}

export default function ParentSlides({ slides = SLIDES, backTo, backLabel }: {
  slides?: Slide[];
  backTo?: string;
  backLabel?: string;
}) {
  const navigate = useNavigate();
  const total = slides.length;
  const deckRef = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(() => {
    const h = parseInt((window.location.hash || '').replace('#', ''), 10);
    return h >= 1 && h <= total ? h - 1 : 0;
  });
  const [dark, setDark] = useState(false);

  const go = useCallback((n: number) => setI(Math.max(0, Math.min(total - 1, n))), [total]);
  const step = useCallback((d: number) => setI(p => Math.max(0, Math.min(total - 1, p + d))), [total]);

  useEffect(() => {
    const want = `#${i + 1}`;
    if (window.location.hash !== want) window.history.replaceState(null, '', want);
  }, [i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === ' ' || e.key === 'PageDown') { step(1); e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'PageUp') { step(-1); e.preventDefault(); }
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(total - 1);
      else if (e.key === 'f' || e.key === 'F') toggleFs();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, go, total]);

  const x0 = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { x0.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (x0.current === null) return;
    const dx = e.changedTouches[0].clientX - x0.current;
    if (Math.abs(dx) > 45) step(dx < 0 ? 1 : -1);
    x0.current = null;
  };

  function toggleFs() {
    const el = deckRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  const slide = slides[i];

  return (
    <div
      className={`pslides ${dark ? 'theme-dark' : 'theme-light'}`}
      ref={deckRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      dir="rtl"
    >
      <div className="ps-progress"><i style={{ width: `${total > 1 ? (i / (total - 1)) * 100 : 100}%` }} /></div>

      <div className="ps-topbar">
        <div className="ps-brand">
          <img className="ps-logo" src={LOGO} alt="Doing" />
        </div>
        <span className="ps-eyebrow">{slide.section}</span>
        <span className="ps-counter"><b>{i + 1}</b> / {total}</span>
      </div>

      <div className="ps-stage">
        {slides.map((s, idx) => (
          <section
            key={idx}
            className={
              'ps-slide' +
              (idx === i ? ' active' : '') +
              (s.variant === 'cover' || s.variant === 'closing' ? ' cover' : '') +
              (s.variant === 'section' ? ' divider center' : '') +
              (s.variant === 'content' && s.center ? ' center' : '')
            }
            aria-hidden={idx !== i}
          >
            {idx === i && <SlideView slide={s} />}
          </section>
        ))}
      </div>

      <div className="ps-corner">
        {backTo && (
          <button className="ps-back" onClick={() => navigate(backTo)} title={backLabel || 'חזרה'} aria-label={backLabel || 'חזרה'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            {backLabel && <span>{backLabel}</span>}
          </button>
        )}
        <button onClick={() => setDark(d => !d)} title="מצב תצוגה" aria-label="החלפת מצב בהיר/כהה">
          {dark ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z" /></svg>
          )}
        </button>
        <button onClick={toggleFs} title="מסך מלא" aria-label="מסך מלא">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></svg>
        </button>
      </div>

      <div className="ps-nav">
        <button className="wlabel" onClick={() => step(-1)} disabled={i === 0} aria-label="שקף קודם">→ <span>הקודם</span></button>
        <div className="ps-dots" role="tablist" aria-label="ניווט שקפים">
          {slides.map((_, idx) => (
            <button
              key={idx}
              className={`ps-dot${idx === i ? ' on' : ''}`}
              role="tab"
              aria-selected={idx === i}
              aria-label={`שקף ${idx + 1}`}
              onClick={() => go(idx)}
            />
          ))}
        </div>
        <button className="primary wlabel" onClick={() => step(1)} disabled={i === total - 1} aria-label="שקף הבא"><span>הבא</span> ←</button>
      </div>

      <div className="ps-hint"><kbd>←</kbd> <kbd>→</kbd> מעבר · <kbd>רווח</kbd> הבא · <kbd>F</kbd> מסך מלא</div>
    </div>
  );
}
