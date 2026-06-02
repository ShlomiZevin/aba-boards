import { useParams, Navigate } from 'react-router-dom';
import { useContext, useMemo, useState } from 'react';
import { getEffectiveSlides, type SlideData } from './index';
import {
  SlidesAuthContext,
  getStoredContent,
  saveStoredContent,
  getStoredUrl,
  saveStoredUrl,
  AUTH_PREFIX,
  type ContentOverride,
} from './auth';
import SlideLayout from './SlideLayout';
import SlideEmbed from './SlideEmbed';

const LOGO_URL = '/therapy/doing-logo-transparent2.png';

export default function SlideRoute() {
  const { slideId } = useParams<{ slideId: string }>();
  const id = Number(slideId);
  const slide = getEffectiveSlides().find(s => s.id === id);
  if (!slide) return <Navigate to="/slides" replace />;

  // Outer just sets up SlideLayout; inner components read context from inside it.
  if (slide.variant === 'cover' || slide.variant === 'closing') {
    return (
      <SlideLayout slideId={slide.id} section={slide.section} variant={slide.variant}>
        <CoverBody data={slide} />
      </SlideLayout>
    );
  }
  return (
    <SlideLayout slideId={slide.id} section={slide.section}>
      <ContentBody data={slide} />
    </SlideLayout>
  );
}

// ───────────────────────────── Cover / closing ─────────────────────────────
function CoverBody({ data }: { data: Extract<SlideData, { variant: 'cover' | 'closing' }> }) {
  const { editMode, contentVersion, bumpContentVersion } = useContext(SlidesAuthContext);

  const override = useMemo(() => getStoredContent(data.id), [data.id, contentVersion]);
  const title = override?.title ?? data.title;
  const sub = override?.sub ?? data.sub;

  function update(patch: Partial<ContentOverride>) {
    const next: ContentOverride = { ...(override ?? {}), ...patch };
    Object.keys(next).forEach(k => {
      const v = (next as Record<string, unknown>)[k];
      if (v === '' || (Array.isArray(v) && v.length === 0)) {
        delete (next as Record<string, unknown>)[k];
      }
    });
    saveStoredContent(data.id, Object.keys(next).length ? next : null);
    bumpContentVersion();
  }

  return (
    <div className="sl-cover">
      <img src={LOGO_URL} alt="Doing" className="sl-cover-logo" />
      {editMode ? (
        <input
          key={`title-${contentVersion}`}
          className="sl-cover-h1 sl-edit-input"
          defaultValue={title}
          onBlur={(e) => update({ title: e.target.value })}
          dir="rtl"
        />
      ) : (
        <h1 className="sl-cover-h1">{title}</h1>
      )}
      {editMode ? (
        <input
          key={`sub-${contentVersion}`}
          className="sl-cover-sub sl-edit-input"
          defaultValue={sub ?? ''}
          placeholder="כתובית..."
          onBlur={(e) => update({ sub: e.target.value })}
          dir="rtl"
        />
      ) : (
        sub && <p className="sl-cover-sub">{sub}</p>
      )}
    </div>
  );
}

// ───────────────────────────── Content slide ─────────────────────────────
function ContentBody({ data }: { data: Extract<SlideData, { variant: 'content' }> }) {
  const {
    editMode, contentVersion, bumpContentVersion,
    setEmbedUrl, bumpReloadVersion,
  } = useContext(SlidesAuthContext);

  const override = useMemo(() => getStoredContent(data.id), [data.id, contentVersion]);
  const title = override?.title ?? data.title;
  const lead  = override?.lead  ?? data.lead ?? '';
  const notes = override?.notes ?? data.notes ?? [];

  // URL override (separate localStorage key from content)
  const storedUrl = useMemo(() => getStoredUrl(data.id), [data.id, contentVersion]);
  const effectiveUrl = storedUrl ?? data.embedPath ?? '';
  const [urlDraft, setUrlDraft] = useState(effectiveUrl);
  // keep draft in sync if slide or override changes
  useMemo(() => { setUrlDraft(effectiveUrl); }, [effectiveUrl]);

  const hasEmbed = !!effectiveUrl;

  function update(patch: Partial<ContentOverride>) {
    const next: ContentOverride = { ...(override ?? {}), ...patch };
    Object.keys(next).forEach(k => {
      const v = (next as Record<string, unknown>)[k];
      if (v === '' || (Array.isArray(v) && v.length === 0)) {
        delete (next as Record<string, unknown>)[k];
      }
    });
    saveStoredContent(data.id, Object.keys(next).length ? next : null);
    bumpContentVersion();
  }
  function updateNote(i: number, value: string) {
    const next = [...notes];
    next[i] = value;
    update({ notes: next });
  }
  function addNote() { update({ notes: [...notes, ''] }); }
  function removeNote(i: number) { update({ notes: notes.filter((_, j) => j !== i) }); }

  function saveUrl(value: string) {
    const trimmed = value.trim();
    if (trimmed === (data.embedPath ?? '')) {
      // matches the default → drop the override
      saveStoredUrl(data.id, null);
    } else {
      saveStoredUrl(data.id, trimmed || null);
    }
    setEmbedUrl(trimmed || null);
    bumpReloadVersion();
    bumpContentVersion();
  }

  function resetSlide() {
    if (!confirm('לאפס את כל השינויים בשקף הזה לברירת המחדל?')) return;
    saveStoredContent(data.id, null);
    saveStoredUrl(data.id, null);
    try { localStorage.removeItem(`${AUTH_PREFIX}${data.id}`); } catch {}
    bumpContentVersion();
    bumpReloadVersion();
  }

  return (
    <div className={`sl-split${hasEmbed ? '' : ' sl-split-text-only'}`}>
      <div className="sl-split-text">
        {editMode ? (
          <input
            key={`title-${contentVersion}`}
            className="sl-h1 sl-edit-input"
            defaultValue={title}
            onBlur={(e) => update({ title: e.target.value })}
            dir="rtl"
          />
        ) : (
          <h1 className="sl-h1">{title}</h1>
        )}

        {editMode ? (
          <textarea
            key={`lead-${contentVersion}`}
            className="sl-lead sl-edit-input sl-edit-textarea"
            defaultValue={lead}
            placeholder="משפט הסבר אחד..."
            rows={2}
            onBlur={(e) => update({ lead: e.target.value })}
            dir="rtl"
          />
        ) : (
          lead && <p className="sl-lead">{lead}</p>
        )}

        {(editMode || notes.length > 0) && (
          <ol className="sl-num">
            {notes.map((note, i) => (
              <li key={i}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {editMode ? (
                  <>
                    <textarea
                      key={`note-${i}-${contentVersion}`}
                      className="sl-edit-input sl-edit-note"
                      defaultValue={note}
                      placeholder="טקסט הנקודה..."
                      rows={1}
                      onBlur={(e) => updateNote(i, e.target.value)}
                      dir="rtl"
                    />
                    <button
                      type="button"
                      onClick={() => removeNote(i)}
                      className="sl-edit-remove"
                      title="הסר נקודה"
                    >×</button>
                  </>
                ) : (
                  note
                )}
              </li>
            ))}
            {editMode && notes.length < 5 && (
              <li className="sl-edit-add-row">
                <button type="button" onClick={addNote} className="sl-edit-add">+ הוסף נקודה</button>
              </li>
            )}
          </ol>
        )}

        {editMode && (
          <>
            <div className="sl-edit-url-row">
              <label className="sl-edit-url-label">כתובת המסך (להשאיר ריק = אין מסך)</label>
              <input
                type="text"
                className="sl-edit-input sl-edit-url-input"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onBlur={(e) => saveUrl(e.target.value)}
                placeholder="/therapy/kid/... או https://..."
                dir="ltr"
              />
              {storedUrl !== null && (
                <button
                  type="button"
                  className="sl-mini-btn"
                  onClick={() => { saveStoredUrl(data.id, null); setUrlDraft(data.embedPath ?? ''); bumpReloadVersion(); bumpContentVersion(); }}
                  title="אפס לערך ברירת המחדל"
                >אפס כתובת</button>
              )}
            </div>
            <div className="sl-edit-reset-row">
              <button
                type="button"
                className="sl-mini-btn sl-mini-btn-danger"
                onClick={resetSlide}
                title="אפס את כל השינויים בשקף הזה (תוכן, כתובת, חשבון) חזרה לברירת המחדל"
              >↺ אפס את כל השינויים בשקף הזה</button>
            </div>
          </>
        )}
      </div>
      {hasEmbed && (
        <SlideEmbed slideId={data.id} defaultPath={effectiveUrl} />
      )}
    </div>
  );
}
