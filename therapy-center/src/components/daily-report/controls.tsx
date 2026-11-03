import type { CSSProperties, ReactNode } from 'react';
import { HELP_CHIPS, MARK_LABEL } from '../../utils/dailyReport';
import type { MarkValue, ReportMark } from '../../types';

/**
 * Small form controls for the daily report. Taps, not dropdowns: staff fill
 * this on a phone in a classroom, so every common answer is one touch away.
 * Read-only mode comes from a surrounding <fieldset disabled>.
 */

export function Group({
  tone,
  icon,
  title,
  sub,
  children,
}: {
  tone: 'green' | 'blue' | 'lavender' | 'peach' | 'yellow' | 'pink';
  icon: string;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section className={`dr-group dr-tone-${tone}`}>
      <header className="dr-group-head">
        <span className="dr-group-icon" aria-hidden>{icon}</span>
        <span>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </span>
      </header>
      <div className="dr-group-body">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`dr-field ${wide ? 'wide' : ''}`}>
      {label && (
        <div className="dr-label">
          {label}
          {hint && <span className="dr-hint">{hint}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

type Option = string | { id: string; label: string; icon?: string };

const optId = (o: Option) => (typeof o === 'string' ? o : o.id);
const optLabel = (o: Option) => (typeof o === 'string' ? o : `${o.icon ? `${o.icon} ` : ''}${o.label}`);

/** Single choice; tapping the chosen chip again clears it. */
export function Chips({ options, value, onChange }: { options: Option[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="dr-chips">
      {options.map((o) => {
        const id = optId(o);
        return (
          <button
            key={id}
            type="button"
            className={`dr-chip ${value === id ? 'on' : ''}`}
            aria-pressed={value === id}
            onClick={() => onChange(value === id ? '' : id)}
          >
            {optLabel(o)}
          </button>
        );
      })}
    </div>
  );
}

export function MultiChips({ options, value, onChange }: { options: string[]; value?: string[]; onChange: (v: string[]) => void }) {
  const set = new Set(value || []);
  return (
    <div className="dr-chips">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={`dr-chip ${set.has(o) ? 'on' : ''}`}
          aria-pressed={set.has(o)}
          onClick={() => onChange(set.has(o) ? [...set].filter((x) => x !== o) : [...set, o])}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/**
 * The paper's cell: + (did it right away) / − (didn't) / ר. Choosing − or ר
 * asks what help was given — the paper's "לפרט את סוג הסיוע שניתן".
 */
export function MarkField({
  label,
  value,
  onChange,
  marks = ['+', '-'],
  alwaysNote,
  notePlaceholder,
}: {
  label: string;
  value?: MarkValue;
  onChange: (v: MarkValue) => void;
  marks?: Exclude<ReportMark, ''>[];
  alwaysNote?: boolean;
  notePlaceholder?: string;
}) {
  const m = value?.m || '';
  const showNote = alwaysNote || m === '-' || m === 'r' || !!value?.note;
  return (
    <div className="dr-field">
      <div className="dr-label">{label}</div>
      <div className="dr-marks">
        {marks.map((k) => (
          <button
            key={k}
            type="button"
            className={`dr-mark dr-mark-${k === '+' ? 'plus' : k === '-' ? 'minus' : 'r'} ${m === k ? 'on' : ''}`}
            aria-pressed={m === k}
            onClick={() => onChange({ ...value, m: m === k ? '' : k })}
          >
            <b>{k === 'r' ? 'ר' : k === '-' ? '−' : '+'}</b>
            {k !== 'r' && <span>{MARK_LABEL[k]}</span>}
          </button>
        ))}
      </div>
      {showNote && (
        <>
          <input
            className="dr-input dr-note"
            value={value?.note || ''}
            maxLength={300}
            placeholder={notePlaceholder || 'איזה סיוע ניתן?'}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
          />
          {(m === '-' || m === 'r') && (
            <div className="dr-chips small">
              {HELP_CHIPS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className="dr-chip"
                  onClick={() => {
                    const cur = value?.note || '';
                    if (cur.includes(h)) return;
                    onChange({ ...value, note: cur ? `${cur}, ${h}` : h });
                  }}
                >
                  + {h}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 0–100% in steps of 5. Starts unset ("—") so an untouched slider is never
 * mistaken for a real 50%; the first touch sets it.
 */
export function PercentSlider({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  const isSet = typeof value === 'number';
  const shown = isSet ? value : 50;
  return (
    <div className={`dr-pct ${isSet ? '' : 'unset'}`}>
      <div className="dr-pct-row">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={shown}
          aria-label="אחוז שיתוף פעולה"
          style={{ '--pct': `${shown}%` } as CSSProperties}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={() => { if (!isSet) onChange(shown); }}
        />
        <output className="dr-pct-value">{isSet ? `${value}%` : '—'}</output>
      </div>
      <div className="dr-pct-scale">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
      {isSet && (
        <button type="button" className="dr-link dr-pct-clear" onClick={() => onChange(undefined)}>ניקוי</button>
      )}
    </div>
  );
}

export function YesNo({ value, onChange }: { value?: boolean; onChange: (v: boolean | undefined) => void }) {
  return (
    <div className="dr-yesno">
      <button
        type="button"
        className={`dr-yn no ${value === false ? 'on' : ''}`}
        aria-pressed={value === false}
        onClick={() => onChange(value === false ? undefined : false)}
      >
        ✓ לא
      </button>
      <button
        type="button"
        className={`dr-yn yes ${value === true ? 'on' : ''}`}
        aria-pressed={value === true}
        onClick={() => onChange(value === true ? undefined : true)}
      >
        ! כן
      </button>
    </div>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  max = 1000,
  rows = 3,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max?: number;
  rows?: number;
}) {
  return (
    <div className="dr-textarea-wrap">
      <textarea
        className="dr-input"
        rows={rows}
        value={value || ''}
        maxLength={max}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {max <= 300 && <span className="dr-count">{(value || '').length}/{max}</span>}
    </div>
  );
}
