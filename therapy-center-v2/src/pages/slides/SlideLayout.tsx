import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getEffectiveSlides, getCustomSlides, hideSlide, removeCustomSlideById, addCustomSlide, DEFAULT_SLIDES, type ContentSlide } from './index';
import {
  AUTHS, AUTH_PREFIX, ADMIN_KEY,
  getStoredAuth, getStoredContent, saveStoredContent,
  SlidesAuthContext, type AuthKey,
} from './auth';

const LOGO_URL = '/therapy/doing-logo-transparent2.png';

interface Props {
  slideId: number;
  section: string;
  children: ReactNode;
  variant?: 'cover' | 'content' | 'closing';
}

export default function SlideLayout({ slideId, section, children, variant = 'content' }: Props) {
  const navigate = useNavigate();

  // Look up current slide so we can read its defaultAuth as the fallback
  const currentSlide = useMemo(
    () => getEffectiveSlides().find(s => s.id === slideId),
    [slideId],
  );
  const slideDefaultAuth: AuthKey =
    (currentSlide?.variant === 'content' && currentSlide.defaultAuth) || 'michal';

  // Per-slide auth state (Michal | Demo). Stored in localStorage per slide.
  const [auth, setAuth] = useState<AuthKey>(() => getStoredAuth(slideId, slideDefaultAuth));

  // SlideEmbed registers its current URL (used for "open in new tab" link)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const bumpReloadVersion = () => setReloadVersion(v => v + 1);

  // Edit mode + content/slides versions
  const [editMode, setEditMode] = useState(false);
  const [contentVersion, setContentVersion] = useState(0);
  const bumpContentVersion = () => setContentVersion(v => v + 1);
  const [slidesVersion, setSlidesVersion] = useState(0);
  const bumpSlidesVersion = () => setSlidesVersion(v => v + 1);
  // Force iframe remount (for content URL editor save)
  const [forceReloadCount, setForceReloadCount] = useState(0);
  const forceReload = () => setForceReloadCount(c => c + 1);

  // Iframe-only navigation (for "back to kid screen" button — does NOT change slide)
  const [iframeNavCount, setIframeNavCount] = useState(0);
  const [iframeNavTarget, setIframeNavTarget] = useState<string | null>(null);
  function navigateIframe(url: string) {
    setIframeNavTarget(url);
    setIframeNavCount(c => c + 1);
  }

  // Effective slides (defaults + customs - hidden) — re-computed when slidesVersion bumps
  const effectiveSlides = useMemo(() => getEffectiveSlides(), [slidesVersion]);
  const index = useMemo(
    () => effectiveSlides.findIndex(s => s.id === slideId),
    [effectiveSlides, slideId],
  );
  const total = effectiveSlides.length;
  const slideNumber = index >= 0 ? index + 1 : 0;
  const prevSlide = index > 0 ? effectiveSlides[index - 1] : null;
  const nextSlide = index >= 0 && index < total - 1 ? effectiveSlides[index + 1] : null;

  // Section override per-slide (override > prop default)
  const sectionOverride = useMemo(() => {
    const c = getStoredContent(slideId);
    return c?.section;
  }, [slideId, contentVersion]);
  const effectiveSectionLabel = sectionOverride ?? section;

  function setSectionOverride(value: string) {
    const c = getStoredContent(slideId) ?? {};
    const v = value.trim();
    if (v) c.section = v; else delete c.section;
    saveStoredContent(slideId, Object.keys(c).length ? c : null);
    bumpContentVersion();
  }

  // Re-read auth pref when navigating between slides
  useEffect(() => {
    setAuth(getStoredAuth(slideId, slideDefaultAuth));
  }, [slideId, slideDefaultAuth]);

  // Keep global admin_key in sync with the current slide's auth
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

  // Override host-page body styles
  useEffect(() => {
    document.body.classList.add('sl-active');
    return () => document.body.classList.remove('sl-active');
  }, []);

  // Keyboard nav — don't intercept while typing in inputs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        if (e.key !== 'Escape') return;
      }
      if (e.key === 'ArrowRight' && prevSlide) navigate(`/slides/${prevSlide.id}`);
      if (e.key === 'ArrowLeft' && nextSlide) navigate(`/slides/${nextSlide.id}`);
      if (e.key === 'Escape') navigate('/slides');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, prevSlide, nextSlide]);

  const isContent = variant === 'content';

  // ── Add/remove slide actions ──
  function addSlideAfter() {
    const newId = Date.now();
    const newSlide: ContentSlide = {
      id: newId,
      variant: 'content',
      section: effectiveSectionLabel || '',
      title: 'שקף חדש',
      lead: '',
      notes: [],
      afterId: slideId,
    };
    addCustomSlide(newSlide);
    bumpSlidesVersion();
    setTimeout(() => navigate(`/slides/${newId}`), 0);
  }

  function deleteSlide() {
    if (!confirm('למחוק את השקף?')) return;
    const isCustom = getCustomSlides().some(s => s.id === slideId);
    if (isCustom) {
      removeCustomSlideById(slideId);
    } else if (DEFAULT_SLIDES.some(s => s.id === slideId)) {
      hideSlide(slideId);
    }
    bumpSlidesVersion();
    // navigate to next (or prev) slide
    const target = nextSlide || prevSlide;
    setTimeout(() => navigate(target ? `/slides/${target.id}` : '/slides'), 0);
  }

  return (
    <SlidesAuthContext.Provider value={{
      auth, setAuth: changeAuth,
      embedUrl, setEmbedUrl, reloadVersion,
      editMode, setEditMode,
      contentVersion, bumpContentVersion,
      bumpReloadVersion,
      slidesVersion, bumpSlidesVersion,
      forceReloadCount, forceReload,
      iframeNavCount, iframeNavTarget, navigateIframe,
    }}>
      <div className={`sl-root sl-v-${variant}${editMode ? ' sl-edit-on' : ''}`} dir="rtl">
        <header className="sl-topbar">
          <button className="sl-logo-btn" onClick={() => navigate('/slides')} aria-label="תפריט">
            <img src={LOGO_URL} alt="Doing" />
          </button>
          {editMode ? (
            <input
              key={`section-${slideId}-${contentVersion}`}
              className="sl-topbar-section sl-edit-input sl-edit-section"
              defaultValue={effectiveSectionLabel}
              placeholder="קטגוריה (אופציונלי)"
              onBlur={(e) => setSectionOverride(e.target.value)}
              dir="rtl"
            />
          ) : (
            effectiveSectionLabel && <span className="sl-topbar-section">{effectiveSectionLabel}</span>
          )}
        </header>

        <main className="sl-stage">{children}</main>

        <footer className="sl-foot">
          <div className="sl-foot-side sl-foot-start">
            {editMode && (
              <>
                <button
                  type="button"
                  onClick={addSlideAfter}
                  className="sl-mini-btn"
                  title="הוסף שקף חדש אחרי השקף הנוכחי"
                >+ הוסף שקף</button>
                <button
                  type="button"
                  onClick={deleteSlide}
                  className="sl-mini-btn sl-mini-btn-danger"
                  title="מחק את השקף"
                >× מחק שקף</button>
              </>
            )}
          </div>
          <div className="sl-foot-center">
            <button
              className="sl-arrow"
              onClick={() => prevSlide && navigate(`/slides/${prevSlide.id}`)}
              disabled={!prevSlide}
              aria-label="הקודם"
            >→</button>
            <span className="sl-pager" dir="ltr">{String(slideNumber).padStart(2, '0')} <em>/</em> {String(total).padStart(2, '0')}</span>
            <button
              className="sl-arrow"
              onClick={() => nextSlide && navigate(`/slides/${nextSlide.id}`)}
              disabled={!nextSlide}
              aria-label="הבא"
            >←</button>
          </div>
          <div className="sl-foot-side sl-foot-end">
            {embedUrl && (
              <button
                type="button"
                onClick={() => navigateIframe('/therapy/kid/%D7%94%D7%A8%D7%90%D7%9C')}
                className="sl-external-btn"
                title="טען את כרטיס הילד הראל ב-iframe (ללא שינוי שקף)"
              >↩ למסך הילד</button>
            )}

            {embedUrl && (
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="sl-external-btn"
                title="פתח בכרטיסייה חדשה"
              >פתח ↗</a>
            )}
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              className={`sl-external-btn${editMode ? ' sl-external-btn-active' : ''}`}
              title={editMode ? 'סיים עריכה' : 'ערוך תוכן השקף'}
            >{editMode ? '✓ סיים עריכה' : '✎ ערוך תוכן'}</button>
            {isContent && (
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
