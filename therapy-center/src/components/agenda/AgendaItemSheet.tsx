import { useEffect, useState } from 'react';
import { PERIODS, PERIOD_META, SUGGESTIONS, EMOJIS, newItemId } from '../../utils/agenda';
import type { AgendaItem, AgendaPeriod } from '../../types';

export interface SheetTarget {
  /** Column key: a "YYYY-MM-DD" date, or "r<weekday>" for the routine. */
  col: string;
  period: AgendaPeriod;
  /** null → adding a new item. */
  item: AgendaItem | null;
}

interface Props {
  target: SheetTarget;
  onSave: (item: AgendaItem, period: AgendaPeriod) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Add or edit one activity. A bottom sheet on phones, a centred dialog on
 * desktop (CSS decides). Suggestions fill the title and icon in one tap, which
 * is how most items get added — typing is the fallback.
 */
export default function AgendaItemSheet({ target, onSave, onDelete, onClose }: Props) {
  const existing = target.item;
  const [title, setTitle] = useState(existing?.title || '');
  const [icon, setIcon] = useState(existing?.icon || '⭐');
  const [time, setTime] = useState(existing?.time || '');
  const [period, setPeriod] = useState<AgendaPeriod>(target.period);
  const [showEmojis, setShowEmojis] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = (t = title, i = icon) => {
    const clean = t.trim();
    if (!clean) return;
    onSave({ id: existing?.id || newItemId(), title: clean, icon: i, time: time || undefined }, period);
  };

  return (
    <div className="ag-backdrop" onClick={onClose}>
      <div
        className="ag-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={existing ? 'עריכת פעילות' : 'הוספת פעילות'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ag-sheet-handle" />
        <h3>{existing ? 'עריכת פעילות' : `פעילות חדשה ל${PERIOD_META[period].label}`}</h3>

        {!existing && (
          <div className="ag-suggest">
            {SUGGESTIONS[period].map((s) => (
              <button
                key={s.title}
                type="button"
                className="ag-suggest-chip"
                onClick={() => save(s.title, s.icon)}
              >
                <span>{s.icon}</span> {s.title}
              </button>
            ))}
          </div>
        )}

        <div className="ag-field-row">
          <button
            type="button"
            className="ag-icon-pick"
            onClick={() => setShowEmojis((v) => !v)}
            aria-label="בחירת סמל"
            aria-expanded={showEmojis}
          >
            {icon}
          </button>
          <input
            className="ag-input"
            value={title}
            maxLength={60}
            placeholder={existing ? '' : 'או כתבו פעילות משלכם…'}
            autoFocus={!!existing}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          />
        </div>

        {showEmojis && (
          <div className="ag-emoji-grid">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className={e === icon ? 'active' : ''}
                onClick={() => { setIcon(e); setShowEmojis(false); }}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <div className="ag-field-row ag-meta-row">
          <label className="ag-label">
            שעה (לא חובה)
            <input
              type="time"
              className="ag-input ag-time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <div className="ag-label">
            חלק ביום
            <div className="ag-seg">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={p === period ? 'active' : ''}
                  onClick={() => setPeriod(p)}
                >
                  {PERIOD_META[p].icon} {PERIOD_META[p].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="ag-sheet-actions">
          <button type="button" className="ag-edit-btn primary" disabled={!title.trim()} onClick={() => save()}>
            {existing ? 'שמירה' : 'הוספה'}
          </button>
          {existing && (
            <button type="button" className="ag-edit-btn danger" onClick={onDelete}>
              מחיקה
            </button>
          )}
          <button type="button" className="ag-edit-btn ghost" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
