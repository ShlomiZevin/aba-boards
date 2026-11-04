import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { docsApi, kidsApi } from '../../api/client';
import { useTherapist } from '../../contexts/TherapistContext';
import type { Doc, DocType, DocVisibility } from '../../types';
import Icon from '../Icon';
import './docs.css';

// מחברת — documents per kid (meeting prep, guidance, notes), plus general ones.
// Michal writes them on the site or sends them from ChatGPT / Claude (MCP). Only admins write;
// therapists and parents read what its visibility allows.

export const DOC_TYPES: Record<DocType, { label: string; tone: string }> = {
  'meeting-prep': { label: 'הכנה לפגישה', tone: 'sky' },
  guidance: { label: 'הדרכה', tone: 'mint' },
  note: { label: 'הערה', tone: 'yellow' },
  summary: { label: 'סיכום', tone: 'lilac' },
  other: { label: 'מסמך', tone: 'peach' },
};
const VIS: Record<DocVisibility, { label: string; hint: string }> = {
  private: { label: 'פרטי', hint: 'רק את רואה' },
  team: { label: 'צוות', hint: 'גם המטפלות של הילד' },
  parents: { label: 'הורים', hint: 'גם הצוות וגם ההורים' },
};
const SOURCE_LABEL: Record<string, string> = { chatgpt: 'מ־ChatGPT', claude: 'מ־Claude', mcp: 'מעוזר AI', 'site-chat': 'מהצ׳אט באתר' };
const HE_MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];

function useRole() {
  const { isTherapistView, isParentView, practitionerId, parentKidId } = useTherapist();
  const prefix = isParentView ? `/p/${parentKidId}` : isTherapistView ? `/t/${practitionerId}` : '';
  return { isAdmin: !isTherapistView && !isParentView, isParentView, prefix };
}

function DateBlock({ iso }: { iso: string }) {
  const d = new Date(iso);
  return <span className="dc-date tabular"><b>{d.getDate()}</b><small>{HE_MONTHS[d.getMonth()]}</small></span>;
}

function DocRow({ doc, href, showVis }: { doc: Doc; href: string; showVis: boolean }) {
  const t = DOC_TYPES[doc.type] || DOC_TYPES.other;
  return (
    <li>
      <Link to={href} className="dc-row">
        <DateBlock iso={doc.updatedAt} />
        <span className="dc-row-txt">
          <b>{doc.title}</b>
          <span className="dc-row-meta">
            <span className={`nb-chip tone-${t.tone}`}>{t.label}</span>
            {SOURCE_LABEL[doc.source] && <span className="dc-source"><Icon name="sparkle" size={14} /> {SOURCE_LABEL[doc.source]}</span>}
          </span>
        </span>
        {showVis && <span className={`dc-vis vis-${doc.visibility}`}>{VIS[doc.visibility]?.label}</span>}
      </Link>
    </li>
  );
}

/** The kid page's "מחברת" tab. */
export function KidDocsTab({ kidId }: { kidId: string }) {
  const { isAdmin, prefix } = useRole();
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['docs', kidId], queryFn: () => docsApi.getForKid(kidId) });
  const docs = data?.data || [];

  return (
    <section className="dc">
      <div className="nb-sec-head">
        <h2 className="nb-h2">מחברת</h2>
        {isAdmin && <button type="button" className="nb-btn-ghost sm" onClick={() => setCreating(true)}><Icon name="plus" size={18} /> מסמך חדש</button>}
      </div>
      {isLoading ? <p className="hand nb-muted">טוען…</p> : docs.length === 0 ? (
        <div className="nb-card dc-empty">
          <p className="hand">{isAdmin ? 'עוד אין כאן מסמכים.' : 'עוד לא שותפו מסמכים.'}</p>
          {isAdmin && <p className="nb-muted">הכנה לפגישה, הנחיות לצוות או הערות. אפשר לכתוב כאן, או לשלוח מ־ChatGPT ומ־Claude.</p>}
        </div>
      ) : (
        <ul className="dc-list">{docs.map(d => <DocRow key={d.id} doc={d} href={`${prefix}/docs/${d.id}`} showVis={isAdmin} />)}</ul>
      )}
      {creating && <NewDocSheet kidId={kidId} onClose={() => setCreating(false)} />}
    </section>
  );
}

/** Whether a therapist/parent has anything to see — the tab only shows for them when they do. */
export function useHasKidDocs(kidId: string | undefined, enabled: boolean) {
  const { data } = useQuery({ queryKey: ['docs', kidId], queryFn: () => docsApi.getForKid(kidId!), enabled: enabled && !!kidId });
  return (data?.data || []).length > 0;
}

/** General documents (not tied to a kid). Admins and therapists. */
export function GeneralDocs() {
  const { isAdmin, prefix } = useRole();
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['docs', 'general'], queryFn: () => docsApi.getGeneral() });
  const docs = data?.data || [];
  return (
    <div className="dc dc-page-wrap">
      <header className="dc-head">
        <h1 className="nb-h1">מסמכים <mark className="hl-yellow">כלליים</mark></h1>
        {isAdmin && <button type="button" className="nb-btn" onClick={() => setCreating(true)}><Icon name="plus" /> מסמך חדש</button>}
      </header>
      {isLoading ? <p className="hand nb-muted">טוען…</p> : docs.length === 0 ? (
        <div className="nb-card dc-empty"><p className="hand">עוד אין מסמכים כלליים.</p></div>
      ) : (
        <ul className="dc-list">{docs.map(d => <DocRow key={d.id} doc={d} href={`${prefix}/docs/${d.id}`} showVis={isAdmin} />)}</ul>
      )}
      {creating && <NewDocSheet kidId={null} onClose={() => setCreating(false)} />}
    </div>
  );
}

/** One document as a notebook page. Admins can edit, change who sees it, and delete. */
export function DocPage() {
  const { docId } = useParams<{ docId: string }>();
  const { isAdmin, isParentView, prefix } = useRole();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<DocType>('note');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['doc', docId], queryFn: () => docsApi.get(docId!), enabled: !!docId });
  const doc = data?.data;
  const { data: kidRes } = useQuery({ queryKey: ['kid', doc?.kidId], queryFn: () => kidsApi.getById(doc!.kidId!), enabled: !!doc?.kidId });

  const refresh = (d?: Doc) => {
    if (d) qc.setQueryData(['doc', docId], { success: true, data: d });
    qc.invalidateQueries({ queryKey: ['docs'] });
  };
  const save = useMutation({
    mutationFn: (patch: Partial<Pick<Doc, 'title' | 'content' | 'type' | 'visibility'>>) => docsApi.update(docId!, patch),
    onSuccess: res => { if (res.success) { refresh(res.data); setEditing(false); } },
  });
  const remove = useMutation({
    mutationFn: () => docsApi.delete(docId!),
    onSuccess: res => { if (res.success) { refresh(); navigate(back, { replace: true }); } },
  });

  const back = doc?.kidId ? (isParentView ? prefix : `${prefix}/kid/${doc.kidId}`) : `${prefix}/docs`;
  const backLabel = doc?.kidId ? (kidRes?.data?.name ? `לדף של ${kidRes.data.name}` : 'לדף הילד') : 'למסמכים';

  if (isLoading) return <div className="dc-page-wrap"><p className="hand nb-muted">טוען…</p></div>;
  if (!doc) return <div className="dc-page-wrap"><div className="nb-card dc-empty"><p className="hand">המסמך לא נמצא, או שאין לך הרשאה לראות אותו.</p><Link to={prefix || '/'} className="nb-btn-ghost">לדף הבית</Link></div></div>;

  const t = DOC_TYPES[doc.type] || DOC_TYPES.other;

  function startEdit() {
    setTitle(doc!.title); setContent(doc!.content); setType(doc!.type); setEditing(true);
  }

  return (
    <div className="dc-page-wrap">
      <Link to={back} className="dc-back"><Icon name="back" size={18} /> {backLabel}</Link>

      <article className="nb-card nb-tape dc-sheet">
        <header className="dc-sheet-head">
          <div className="dc-sheet-tags">
            <span className={`nb-chip tone-${t.tone}`}>{t.label}</span>
            {SOURCE_LABEL[doc.source] && <span className="dc-source"><Icon name="sparkle" size={14} /> {SOURCE_LABEL[doc.source]}</span>}
            <span className="nb-muted dc-when tabular">{new Date(doc.updatedAt).toLocaleDateString('he-IL')}</span>
          </div>
          {editing ? (
            <input id="doc-title" className="dc-title-input" value={title} onChange={e => setTitle(e.target.value)} aria-label="כותרת" />
          ) : (
            <h1 className="dc-title">{doc.title}</h1>
          )}
        </header>

        {isAdmin && (
          <div className="dc-vis-switch" role="radiogroup" aria-label="מי רואה את המסמך">
            <span className="dc-vis-label"><Icon name="user" size={16} /> מי רואה</span>
            {(Object.keys(VIS) as DocVisibility[]).map(v => (
              <button key={v} type="button" role="radio" aria-checked={doc.visibility === v}
                className={`dc-vis-opt vis-${v}${doc.visibility === v ? ' is-on' : ''}`}
                disabled={save.isPending} onClick={() => doc.visibility !== v && save.mutate({ visibility: v })}>
                <b>{VIS[v].label}</b><small>{VIS[v].hint}</small>
              </button>
            ))}
          </div>
        )}

        {editing ? (
          <div className="dc-edit">
            <label className="dc-field" htmlFor="doc-type">סוג
              <select id="doc-type" value={type} onChange={e => setType(e.target.value as DocType)}>
                {(Object.keys(DOC_TYPES) as DocType[]).map(k => <option key={k} value={k}>{DOC_TYPES[k].label}</option>)}
              </select>
            </label>
            <textarea id="doc-content" className="dc-textarea" value={content} onChange={e => setContent(e.target.value)} aria-label="תוכן" />
            <p className="nb-muted dc-md-hint">אפשר לכתוב כותרות עם ## ורשימות עם -</p>
          </div>
        ) : (
          <div className="dc-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content || '_ריק_'}</ReactMarkdown></div>
        )}
      </article>

      {isAdmin && (
        <div className="dc-actions">
          {editing ? (
            <>
              <button type="button" className="nb-btn" disabled={save.isPending || !title.trim()} onClick={() => save.mutate({ title: title.trim(), content, type })}>
                <Icon name="check" /> {save.isPending ? 'שומרת…' : 'שמירה'}
              </button>
              <button type="button" className="nb-btn-ghost" onClick={() => setEditing(false)}>ביטול</button>
            </>
          ) : confirmDelete ? (
            <>
              <span className="dc-confirm">למחוק את המסמך?</span>
              <button type="button" className="btn-danger" disabled={remove.isPending} onClick={() => remove.mutate()}>מחיקה</button>
              <button type="button" className="nb-btn-ghost" onClick={() => setConfirmDelete(false)}>ביטול</button>
            </>
          ) : (
            <>
              <button type="button" className="nb-btn" onClick={startEdit}><Icon name="edit" /> עריכה</button>
              <button type="button" className="nb-btn-ghost" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={18} /> מחיקה</button>
            </>
          )}
        </div>
      )}
      {save.isError && <p className="dc-error">לא נשמר. נסי שוב.</p>}
    </div>
  );
}

function NewDocSheet({ kidId, onClose }: { kidId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DocType>(kidId ? 'meeting-prep' : 'guidance');
  const [visibility, setVisibility] = useState<DocVisibility>('private');
  const [content, setContent] = useState('');
  const create = useMutation({
    mutationFn: () => docsApi.create({ kidId, type, title: title.trim(), content, visibility }),
    onSuccess: res => {
      if (res.success && res.data) { qc.invalidateQueries({ queryKey: ['docs'] }); navigate(`/docs/${res.data.id}`); }
    },
  });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal dc-new" onClick={e => e.stopPropagation()}>
        <h3>מסמך חדש</h3>
        <form onSubmit={e => { e.preventDefault(); if (title.trim()) create.mutate(); }}>
          <div className="form-group">
            <label htmlFor="new-doc-title">כותרת</label>
            <input id="new-doc-title" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label>סוג</label>
            <div className="dc-type-pick">
              {(Object.keys(DOC_TYPES) as DocType[]).map(k => (
                <button type="button" key={k} className={`nb-chip tone-${DOC_TYPES[k].tone}${type === k ? ' is-on' : ''}`} onClick={() => setType(k)} aria-pressed={type === k}>{DOC_TYPES[k].label}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>מי רואה</label>
            <div className="dc-vis-switch compact" role="radiogroup">
              {(Object.keys(VIS) as DocVisibility[]).map(v => (
                <button key={v} type="button" role="radio" aria-checked={visibility === v} className={`dc-vis-opt vis-${v}${visibility === v ? ' is-on' : ''}`} onClick={() => setVisibility(v)}>
                  <b>{VIS[v].label}</b><small>{VIS[v].hint}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="new-doc-content">תוכן</label>
            <textarea id="new-doc-content" rows={6} value={content} onChange={e => setContent(e.target.value)} />
          </div>
          {create.isError && <p className="dc-error">לא נשמר. נסי שוב.</p>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
            <button type="submit" className="btn-primary" disabled={create.isPending || !title.trim()}>{create.isPending ? 'שומרת…' : 'שמירה'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
