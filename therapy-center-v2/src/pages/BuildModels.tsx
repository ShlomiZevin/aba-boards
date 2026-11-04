import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { modelsApi, MODELS_BASE } from '../api/client';
import type { BuildModel } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import Icon from '../v2/Icon';
import type { Tone } from '../v2/kidColor';
import '../v2/pages/tm.css';

type Filter = 'all' | 'lego' | 'magnet';

const TYPE_LABEL: Record<BuildModel['type'], string> = { lego: 'לגו', magnet: 'מגנטים' };
const TYPE_TONE: Record<BuildModel['type'], Tone> = { lego: 'pink', magnet: 'sky' };

export default function BuildModels() {
  const { isParentView, parentKidId } = useTherapist();
  const location = useLocation();
  const [filter, setFilter] = useState<Filter>('all');

  // A model page's 🏠 goes to the models folder index, which sends the viewer back here —
  // to whichever view (admin / therapist / parent) they opened it from.
  useEffect(() => {
    try { localStorage.setItem('models_home', `/therapy${location.pathname}`); } catch { /* storage blocked */ }
  }, [location.pathname]);

  const { data: models = [], isLoading, error } = useQuery({
    queryKey: ['build-models'],
    queryFn: modelsApi.getManifest,
  });

  const shown = models.filter(m => filter === 'all' || m.type === filter);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `הכל (${models.length})` },
    { key: 'lego', label: 'לגו' },
    { key: 'magnet', label: 'מגנטים' },
  ];

  return (
    <div className={`tm-models${isParentView ? ' is-bare' : ''}`} dir="rtl">
      <header className="tm-head">
        <div>
          {isParentView && (
            <Link to={`/p/${parentKidId}`} className="tm-back"><Icon name="back" size={20} /> חזרה</Link>
          )}
          <h1 className="nb-h1">מודלים <mark className="hl-yellow">לבנייה</mark></h1>
        </div>
      </header>
      <p className="tm-models-intro">
        מדריכי בנייה צעד-אחר-צעד בלגו ובמגנטים. לחיצה על מודל פותחת אותו במסך מלא — מתאים לטאבלט של הילד.
      </p>

      <div className="tm-chips" role="group" aria-label="סינון לפי סוג">
        {filters.map(f => (
          <button key={f.key} type="button" className={`tm-pick${filter === f.key ? ' is-on' : ''}`} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.key !== 'all' && <span className={`nb-dot tone-${TYPE_TONE[f.key]}`} />}{f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="hand nb-muted">טוען…</p>
      ) : error ? (
        <div className="nb-card tm-empty"><p className="hand">לא ניתן לטעון את רשימת המודלים</p></div>
      ) : shown.length === 0 ? (
        <div className="nb-card tm-empty"><p className="hand">אין מודלים להצגה</p></div>
      ) : (
        <div className="tm-mgrid">
          {shown.map(m => (
            <div key={m.id} className="nb-card tm-model">
              <a className="tm-model-img" href={`${MODELS_BASE}/${m.path}`} target="_blank" rel="noopener">
                <img
                  src={`${MODELS_BASE}/${m.thumb}`}
                  alt={m.title}
                  loading="lazy"
                  onError={e => { const img = e.currentTarget; if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = `${MODELS_BASE}/${m.concept}`; } }}
                />
                <span className={`nb-sticker tone-${TYPE_TONE[m.type] || 'yellow'}`}>{TYPE_LABEL[m.type] || m.type}</span>
              </a>
              <div className="tm-model-b">
                <b>{m.title}</b>
                <small className="tabular">{m.pieces} חלקים · {m.steps} שלבים · {m.minutes} דק׳</small>
                <a className="nb-btn-ghost sm" href={`${MODELS_BASE}/${m.path}`} target="_blank" rel="noopener">
                  <Icon name="play" size={18} /> פתח
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
