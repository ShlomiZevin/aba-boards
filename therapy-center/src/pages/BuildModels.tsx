import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modelsApi, MODELS_BASE } from '../api/client';
import type { BuildModel, ModelBuild } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

type Filter = 'all' | 'lego' | 'magnet' | 'todo' | 'built';

const TYPE_LABEL: Record<BuildModel['type'], string> = { lego: 'לגו', magnet: 'מגנטים' };
const TYPE_COLOR: Record<BuildModel['type'], string> = { lego: '#e53e3e', magnet: '#3182ce' };

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('he-IL'); } catch { return s; }
};

export default function BuildModels() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<BuildModel | null>(null);
  const [builtAt, setBuiltAt] = useState(today());
  const [note, setNote] = useState('');

  const { data: models = [], isLoading, error } = useQuery({
    queryKey: ['build-models'],
    queryFn: modelsApi.getManifest,
    enabled: !!user?.isSuperAdmin,
  });
  const { data: buildsRes } = useQuery({
    queryKey: ['model-builds'],
    queryFn: () => modelsApi.getBuilds(),
    enabled: !!user?.isSuperAdmin,
  });
  const builds: Record<string, ModelBuild> = buildsRes?.data || {};

  const save = useMutation({
    mutationFn: (m: BuildModel) => modelsApi.markBuilt(m.id, { builtAt, note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['model-builds'] }); setEditing(null); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => modelsApi.unmarkBuilt(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['model-builds'] }); setEditing(null); },
  });

  if (!user?.isSuperAdmin) {
    return (
      <div className="container">
        <div className="content-card">
          <div className="empty-state"><p>אין הרשאה לצפות בדף זה</p></div>
        </div>
      </div>
    );
  }

  const shown = models.filter(m =>
    filter === 'all' ? true
      : filter === 'built' ? !!builds[m.id]
      : filter === 'todo' ? !builds[m.id]
      : m.type === filter);

  const openEditor = (m: BuildModel) => {
    const b = builds[m.id];
    setBuiltAt(b?.builtAt || today());
    setNote(b?.note || '');
    setEditing(m);
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `הכל (${models.length})` },
    { key: 'lego', label: 'לגו' },
    { key: 'magnet', label: 'מגנטים' },
    { key: 'todo', label: 'עוד לא נבנו' },
    { key: 'built', label: 'נבנו' },
  ];

  return (
    <div className="container">
      <div className="content-card">
        <div className="content-card-header">
          <h2>מודלים לבנייה</h2>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.9em', marginTop: 0 }}>
          מדריכי בנייה צעד-אחר-צעד בלגו ובמגנטים. לחיצה על מודל פותחת אותו במסך מלא — מתאים לטאבלט של הילד.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 14px', borderRadius: 999, border: '1px solid #cbd5e0', cursor: 'pointer',
                background: filter === f.key ? '#4a5568' : '#fff', color: filter === f.key ? '#fff' : '#4a5568',
                fontSize: '0.85em',
              }}
            >{f.label}</button>
          ))}
        </div>

        {isLoading ? (
          <div className="loading">טוען...</div>
        ) : error ? (
          <p className="empty-text">לא ניתן לטעון את רשימת המודלים</p>
        ) : shown.length === 0 ? (
          <p className="empty-text">אין מודלים להצגה</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 }}>
            {shown.map(m => {
              const b = builds[m.id];
              return (
                <div key={m.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
                  <a href={`${MODELS_BASE}/${m.path}`} target="_blank" rel="noopener" style={{ position: 'relative', display: 'block', aspectRatio: '1', background: '#f7fafc' }}>
                    <img
                      src={`${MODELS_BASE}/${m.thumb}`}
                      alt={m.title}
                      loading="lazy"
                      onError={e => { const img = e.currentTarget; if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = `${MODELS_BASE}/${m.concept}`; } }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <span style={{ position: 'absolute', top: 8, right: 8, background: TYPE_COLOR[m.type], color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: '0.75em', fontWeight: 600 }}>
                      {TYPE_LABEL[m.type] || m.type}
                    </span>
                    {b && (
                      <span style={{ position: 'absolute', top: 8, left: 8, background: '#38a169', color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: '0.75em', fontWeight: 600 }}>
                        ✓ נבנה
                      </span>
                    )}
                  </a>
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#2d3748' }}>{m.title}</div>
                    <div style={{ fontSize: '0.78em', color: '#718096' }}>
                      {m.pieces} חלקים · {m.steps} שלבים · {m.minutes} דק׳
                    </div>
                    {b && (
                      <div style={{ fontSize: '0.78em', color: '#38a169' }}>
                        נבנה ב-{fmtDate(b.builtAt)}{b.note ? ` · ${b.note}` : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 6 }}>
                      <a className="btn-primary" href={`${MODELS_BASE}/${m.path}`} target="_blank" rel="noopener"
                        style={{ flex: 1, textAlign: 'center', fontSize: '0.8em', padding: '6px 8px', textDecoration: 'none' }}>
                        פתח
                      </a>
                      <button onClick={() => openEditor(m)}
                        style={{ fontSize: '0.8em', padding: '6px 8px', borderRadius: 8, border: '1px solid #cbd5e0', background: '#fff', cursor: 'pointer' }}>
                        {b ? 'עריכה' : 'סמן שנבנה'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <div onClick={() => setEditing(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} dir="rtl"
            style={{ background: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 380 }}>
            <h3 style={{ marginTop: 0 }}>{editing.title} — נבנה</h3>
            <label style={{ display: 'block', fontSize: '0.85em', color: '#4a5568', marginBottom: 4 }}>תאריך</label>
            <input type="date" value={builtAt} onChange={e => setBuiltAt(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #cbd5e0', marginBottom: 12, boxSizing: 'border-box' }} />
            <label style={{ display: 'block', fontSize: '0.85em', color: '#4a5568', marginBottom: 4 }}>הערה</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="איך הלך? עזרה שנדרשה, זמן בנייה…"
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #cbd5e0', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate(editing)} style={{ flex: 1 }}>
                {save.isPending ? 'שומר…' : 'שמירה'}
              </button>
              {builds[editing.id] && (
                <button onClick={() => remove.mutate(editing.id)} disabled={remove.isPending}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #feb2b2', background: '#fff', color: '#c53030', cursor: 'pointer' }}>
                  בטל סימון
                </button>
              )}
              <button onClick={() => setEditing(null)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e0', background: '#fff', cursor: 'pointer' }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
