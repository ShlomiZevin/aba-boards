// Shared bits for the form screens (area prefix `ff`): header, text-section checklist row,
// read-only field display, a few local line icons.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Kid } from '../../types';
import Icon from '../Icon';
import KidAvatar from '../KidAvatar';
import RichTextEditor from '../../components/RichTextEditor';
import './ff.css';

const LOCAL: Record<string, string> = {
  print: 'M7 9V3.5h10V9 M7 17H4.5V10h15v7H17 M7 14h10v6.5H7z',
  minus: 'M5 12h14',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  lock: 'M6 11h12v9.5H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  pencil: 'M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4',
};

export function FfIcon({ name, size = 20, strokeWidth = 1.9 }: { name: keyof typeof LOCAL; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={LOCAL[name]} />
    </svg>
  );
}

export const isFilledHtml = (v: unknown) =>
  typeof v === 'string' && v.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;

/** Page header: back link, kid avatar, title + kid name, optional actions and a meta slot under it. */
export function FfHeader({ backTo, backLabel, kid, title, actions, children }: {
  backTo: string;
  backLabel?: string;
  kid?: Pick<Kid, 'id' | 'name' | 'imageName'> | null;
  title: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="ff-head">
      <div className="ff-head-top">
        <Link to={backTo} className="ff-back"><Icon name="back" size={20} /> {backLabel || (kid ? kid.name : 'חזרה')}</Link>
        {actions && <div className="ff-actions">{actions}</div>}
      </div>
      <div className="ff-who">
        {kid ? <span className="ff-who-av"><KidAvatar kid={kid} size="lg" /></span> : <span className="nb-av lg ff-who-av" aria-hidden="true"><Icon name="form" size={30} /></span>}
        <div className="ff-who-txt">
          {typeof title === 'string' ? <h1 className="ff-title">{title}</h1> : title}
          {kid && <span className="ff-kidname"><mark className="hl-yellow">{kid.name}</mark></span>}
        </div>
      </div>
      {children}
    </header>
  );
}

/** One rich-text section as a notebook checklist row: tap to open, ticks itself once filled. */
export function FfTextSection({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const filled = isFilledHtml(value);
  const [open, setOpen] = useState(filled);
  useEffect(() => { if (filled) setOpen(true); }, [filled]);
  const shown = open || filled;
  return (
    <li className={`ff-check-row${filled ? ' is-filled' : ''}${shown ? ' is-open' : ''}`}>
      <button type="button" className="ff-check-head" onClick={() => { if (!filled) setOpen(o => !o); }} aria-expanded={shown}>
        <span className="ff-check-box" aria-hidden="true">{filled && <Icon name="check" size={16} strokeWidth={2.8} />}</span>
        <span className="ff-check-label">{label}</span>
        {!shown && <span className="ff-check-add"><Icon name="plus" size={18} /> כתיבה</span>}
        {shown && !filled && <span className="ff-check-add is-close"><FfIcon name="up" size={18} /></span>}
      </button>
      {shown && (
        <div className="ff-check-body">
          <RichTextEditor value={value} onChange={onChange} />
        </div>
      )}
    </li>
  );
}

/** Read-only label + rich-text value, for the view pages. */
export function FfField({ label, html }: { label: string; html?: string }) {
  const filled = isFilledHtml(html);
  return (
    <div className={`ff-field${filled ? '' : ' is-empty'}`}>
      <div className="ff-field-label">{label}</div>
      {filled
        ? <div className="ff-field-value" dangerouslySetInnerHTML={{ __html: html! }} />
        : <div className="ff-field-value nb-muted">—</div>}
    </div>
  );
}

export function FfAdditionalGoals({ goals, onRemove, newText, setNewText, onAdd }: {
  goals: string[];
  onRemove: (idx: number) => void;
  newText: string;
  setNewText: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="ff-extra">
      <div className="ff-extra-title">מטרות נוספות (לא ברשימה)</div>
      {goals.length > 0 && (
        <div className="ff-extra-tags">
          {goals.map((g, idx) => (
            <span key={idx} className="nb-chip tone-yellow ff-extra-tag">
              {g}
              <button type="button" onClick={() => onRemove(idx)} aria-label={`הסרת ${g}`}><Icon name="close" size={14} strokeWidth={2.4} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="ff-extra-add">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="הוסף מטרה נוספת..."
        />
        <button type="button" onClick={onAdd} className="ff-extra-btn" aria-label="הוספה"><Icon name="plus" size={20} /></button>
      </div>
    </div>
  );
}
