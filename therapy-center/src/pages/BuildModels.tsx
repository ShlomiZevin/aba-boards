import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { modelsApi, MODELS_BASE } from '../api/client';
import type { BuildModel } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

type Filter = 'all' | 'lego' | 'magnet';

const TYPE_LABEL: Record<BuildModel['type'], string> = { lego: 'לגו', magnet: 'מגנטים' };
const TYPE_COLOR: Record<BuildModel['type'], string> = { lego: '#e53e3e', magnet: '#3182ce' };

export default function BuildModels() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');

  const { data: models = [], isLoading, error } = useQuery({
    queryKey: ['build-models'],
    queryFn: modelsApi.getManifest,
    enabled: !!user?.isSuperAdmin,
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

  const shown = models.filter(m => filter === 'all' || m.type === filter);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `הכל (${models.length})` },
    { key: 'lego', label: 'לגו' },
    { key: 'magnet', label: 'מגנטים' },
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
            {shown.map(m => (
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
                </a>
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#2d3748' }}>{m.title}</div>
                  <div style={{ fontSize: '0.78em', color: '#718096' }}>
                    {m.pieces} חלקים · {m.steps} שלבים · {m.minutes} דק׳
                  </div>
                  <a className="btn-primary" href={`${MODELS_BASE}/${m.path}`} target="_blank" rel="noopener"
                    style={{ marginTop: 'auto', textAlign: 'center', fontSize: '0.8em', padding: '6px 8px', textDecoration: 'none' }}>
                    פתח
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
