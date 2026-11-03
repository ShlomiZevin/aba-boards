import { Chips, Field, Group, MarkField, MultiChips, PercentSlider, TextArea, YesNo } from './controls';
import {
  ABC_ANTECEDENTS,
  ABC_BEHAVIORS,
  ABC_CONSEQUENCES,
  ABC_CONTEXT,
  ABC_INTENSITY,
  ABC_LOCATIONS,
  BREAK_ACTIVITIES,
  BREAK_DURATIONS,
  BREAK_TYPES,
  DURATIONS,
  FOOD_INDEPENDENT,
  LESSON_SUGGESTIONS,
  MOODS,
  MOTIVATION,
  SOCIAL_LEVELS,
} from '../../utils/dailyReport';
import type { AbcReport, BreakReport, LessonReport } from '../../types';

type FormProps<T> = { value: T; onChange: (next: T) => void; onAddAbc?: () => void };

/** Same order as the paper's columns, right to left. */
export function LessonForm({ value: v, onChange, onAddAbc }: FormProps<LessonReport>) {
  const set = (patch: Partial<LessonReport>) => onChange({ ...v, ...patch });
  const ind = v.independent || {};
  const fr = v.frontal || {};
  const aide = v.aide || {};
  const got = new Set(v.motivation?.got || []);

  return (
    <>
      <div className="dr-card dr-form-head">
        <Field label="שם השיעור *" wide>
          <input
            className="dr-input"
            value={v.title}
            maxLength={60}
            placeholder="לדוגמה: חשבון, עברית, קבלת בוקר…"
            onChange={(e) => set({ title: e.target.value })}
          />
          {!v.title && (
            <div className="dr-chips small">
              {LESSON_SUGGESTIONS.map((t) => (
                <button key={t} type="button" className="dr-chip" onClick={() => set({ title: t })}>{t}</button>
              ))}
            </div>
          )}
        </Field>
        <Field label="איך היה השיעור?">
          <div className="dr-moods">
            {MOODS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`dr-mood dr-mood-${m.id} ${v.mood === m.id ? 'on' : ''}`}
                aria-pressed={v.mood === m.id}
                onClick={() => set({ mood: v.mood === m.id ? '' : m.id })}
              >
                <span>{m.icon}</span>{m.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="שיתוף פעולה" hint="באחוזים">
          <PercentSlider value={v.cooperationPct} onChange={(cooperationPct) => set({ cooperationPct })} />
        </Field>
        <Field label="תקציר במשפט" hint="מה שיופיע ברשימת השיעורים" wide>
          <input
            className="dr-input"
            value={v.summary || ''}
            maxLength={120}
            placeholder="לדוגמה: עבד בריכוז, פתר תרגילים בהצלחה"
            onChange={(e) => set({ summary: e.target.value })}
          />
        </Field>
      </div>

      <Group tone="yellow" icon="🎒" title="התארגנות לשיעור + תחילת עבודה" sub="+ אם עשה מיד · − אם לא עשה, ולפרט איזה סיוע ניתן">
        <MarkField label="התארגנות ותחילת עבודה" marks={['+', '-', 'r']} value={v.start} onChange={(start) => set({ start })} />
      </Group>

      <Group tone="green" icon="🧑‍🎓" title="עבודה עצמית" sub="תפקוד התלמיד בעבודה עצמית">
        <MarkField label="קצב" value={ind.pace} onChange={(pace) => set({ independent: { ...ind, pace } })} />
        <MarkField label="איכות" value={ind.quality} onChange={(quality) => set({ independent: { ...ind, quality } })} />
        <Field label="משך זמן" wide>
          <Chips options={DURATIONS} value={ind.duration} onChange={(duration) => set({ independent: { ...ind, duration } })} />
        </Field>
        <MarkField label="הוראות כלל" alwaysNote notePlaceholder="אילו הוראות כלליות ניתנו? איזה סיוע?" value={ind.general} onChange={(general) => set({ independent: { ...ind, general } })} />
        <MarkField label="הוראות פרט" alwaysNote notePlaceholder="הוראות פרטניות, דגשים והתאמות…" value={ind.specific} onChange={(specific) => set({ independent: { ...ind, specific } })} />
      </Group>

      <Group tone="blue" icon="👩‍🏫" title="עבודה פרונטלית" sub="תפקוד התלמיד בשיעור פרונטלי">
        <MarkField label="קשב" value={fr.attention} onChange={(attention) => set({ frontal: { ...fr, attention } })} />
        <Field label="משך זמן">
          <Chips options={DURATIONS} value={fr.duration} onChange={(duration) => set({ frontal: { ...fr, duration } })} />
        </Field>
        <MarkField label="הוראות כלל" alwaysNote notePlaceholder="אילו הוראות כלליות ניתנו? איזה סיוע?" value={fr.general} onChange={(general) => set({ frontal: { ...fr, general } })} />
        <MarkField label="הוראות פרט" alwaysNote notePlaceholder="הוראות פרטניות, דגשים והתאמות…" value={fr.specific} onChange={(specific) => set({ frontal: { ...fr, specific } })} />
      </Group>

      <Group tone="lavender" icon="🤝" title="עבודה עם משלבת" sub="שיתוף פעולה ותפקוד עם המשלבת">
        <MarkField label="שיתוף פעולה" value={aide.cooperation} onChange={(cooperation) => set({ aide: { ...aide, cooperation } })} />
        <Field label="משך זמן">
          <Chips options={DURATIONS} value={aide.duration} onChange={(duration) => set({ aide: { ...aide, duration } })} />
        </Field>
        <MarkField label="הוראות" alwaysNote notePlaceholder="הוראות שניתנו במסגרת העבודה עם המשלבת…" value={aide.instructions} onChange={(instructions) => set({ aide: { ...aide, instructions } })} />
      </Group>

      <Group tone="peach" icon="📝" title="תכנים, קשב והערות">
        <Field label="תכנים אקדמיים קשים" wide>
          <TextArea value={v.academic} onChange={(academic) => set({ academic })} placeholder="תכנים שנלמדו, קשיים שהתעוררו…" />
        </Field>
        <MarkField label="קשב" value={v.attention} onChange={(attention) => set({ attention })} />
        <MarkField label="היענות" value={v.compliance} onChange={(compliance) => set({ compliance })} />
        <Field label="הערות" wide>
          <TextArea value={v.notes} onChange={(notes) => set({ notes })} placeholder="הערות נוספות…" />
          <div className="dr-paper-note">
            ⚠️ בעיות התנהגות — לסמן בהערות ולפרט באירוע ABC
            {onAddAbc && (
              <button type="button" className="dr-link" onClick={onAddAbc}>+ אירוע ABC</button>
            )}
          </div>
        </Field>
      </Group>

      <Group tone="pink" icon="⭐" title="תוכנית מוטיבציה" sub="סמנו על אילו מהרכיבים קיבל חיזוק">
        <div className="dr-field wide">
          <div className="dr-motivation">
            {MOTIVATION.map((m) => (
              <button
                key={m.n}
                type="button"
                className={`dr-motive ${got.has(m.n) ? 'on' : ''}`}
                aria-pressed={got.has(m.n)}
                onClick={() => {
                  const next = new Set(got);
                  if (next.has(m.n)) next.delete(m.n);
                  else next.add(m.n);
                  set({ motivation: { ...v.motivation, got: [...next].sort() } });
                }}
              >
                <b>{m.n}</b>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
        <Field label="הערות לתוכנית המוטיבציה" wide>
          <TextArea
            value={v.motivation?.notes}
            onChange={(notes) => set({ motivation: { ...v.motivation, notes } })}
            placeholder="מה חיזק את התלמיד? איזו תוכנית הופעלה?"
            rows={2}
          />
        </Field>
      </Group>
    </>
  );
}

function Stepper({ value, onChange }: { value?: number; onChange: (n: number) => void }) {
  const n = value || 0;
  return (
    <div className="dr-stepper">
      <button type="button" onClick={() => onChange(n + 1)} aria-label="הוספה">+</button>
      <b>{n}</b>
      <button type="button" onClick={() => onChange(Math.max(0, n - 1))} disabled={n === 0} aria-label="הפחתה">−</button>
    </div>
  );
}

export function BreakForm({ value: v, onChange, onAddAbc }: FormProps<BreakReport>) {
  const set = (patch: Partial<BreakReport>) => onChange({ ...v, ...patch });
  return (
    <>
      <Group tone="green" icon="☕" title="פרטי ההפסקה">
        <Field label="שעה">
          <input type="time" className="dr-input dr-time" value={v.time || ''} onChange={(e) => set({ time: e.target.value })} />
        </Field>
        <Field label="משך">
          <Chips options={BREAK_DURATIONS} value={v.duration} onChange={(duration) => set({ duration })} />
        </Field>
        <Field label="סוג ההפסקה" wide>
          <Chips options={BREAK_TYPES} value={v.type} onChange={(type) => set({ type })} />
        </Field>
        <Field label="שם ההפסקה" wide>
          <input className="dr-input" value={v.name || ''} maxLength={60} placeholder="לדוגמה: הפסקת אוכל, הפסקה גדולה" onChange={(e) => set({ name: e.target.value })} />
        </Field>
        {v.type === 'food' && (
          <>
            <Field label="מה אכל ומתי?" wide>
              <input className="dr-input" value={v.foodWhat || ''} maxLength={200} placeholder="לדוגמה: כריך וירקות, אכל בתחילת ההפסקה" onChange={(e) => set({ foodWhat: e.target.value })} />
            </Field>
            <Field label="אכל עצמאית?" wide>
              <Chips options={FOOD_INDEPENDENT} value={v.foodIndependent} onChange={(foodIndependent) => set({ foodIndependent })} />
            </Field>
          </>
        )}
      </Group>

      <Group tone="blue" icon="🧩" title="מה הילד עשה בהפסקה?">
        <Field label="פעילות" wide>
          <MultiChips options={BREAK_ACTIVITIES} value={v.activities} onChange={(activities) => set({ activities })} />
          <input className="dr-input dr-note" value={v.activityNote || ''} maxLength={200} placeholder="פירוט נוסף (לא חובה)" onChange={(e) => set({ activityNote: e.target.value })} />
        </Field>
        <Field label="השתלבות חברתית" wide>
          <Chips options={SOCIAL_LEVELS} value={v.social} onChange={(social) => set({ social })} />
        </Field>
      </Group>

      <Group tone="lavender" icon="🌟" title="התנהגות חברתית">
        <MarkField
          label="צ׳ופר על התנהגות חברתית חיובית"
          value={v.treat}
          onChange={(treat) => set({ treat })}
          alwaysNote
          notePlaceholder="על איזו התנהגות?"
        />
        <Field label="התנהגות לא חברתית" hint="מספר פעמים">
          <Stepper value={v.nonSocialCount} onChange={(nonSocialCount) => set({ nonSocialCount })} />
        </Field>
        <Field label="האם הייתה התנהגות לא צפויה?">
          <YesNo value={v.unexpected} onChange={(unexpected) => set({ unexpected })} />
          {v.unexpected && onAddAbc && (
            <button type="button" className="dr-link" onClick={onAddAbc}>פרטו באירוע ABC ←</button>
          )}
        </Field>
        <Field label="האם נדרש ליווי / התערבות?">
          <YesNo value={v.support} onChange={(support) => set({ support })} />
          {v.support && (
            <input className="dr-input dr-note" value={v.supportNote || ''} maxLength={200} placeholder="איזה ליווי?" onChange={(e) => set({ supportNote: e.target.value })} />
          )}
        </Field>
      </Group>

      <div className="dr-card">
        <Field label="הערות" wide>
          <TextArea value={v.notes} onChange={(notes) => set({ notes })} placeholder="הוסיפו הערות במידת הצורך…" max={250} />
        </Field>
      </div>
    </>
  );
}

export function AbcForm({ value: v, onChange }: FormProps<AbcReport>) {
  const set = (patch: Partial<AbcReport>) => onChange({ ...v, ...patch });
  return (
    <>
      <div className="dr-card dr-grid">
        <Field label="שעה">
          <input type="time" className="dr-input dr-time" value={v.time || ''} onChange={(e) => set({ time: e.target.value })} />
        </Field>
        <Field label="מתי?">
          <Chips options={ABC_CONTEXT} value={v.context} onChange={(context) => set({ context })} />
        </Field>
        <Field label="מיקום" wide>
          <Chips options={ABC_LOCATIONS} value={v.location} onChange={(location) => set({ location })} />
        </Field>
      </div>

      <Group tone="green" icon="A" title="מה קרה לפני?" sub="כל מה שרלוונטי להתנהגות לפני, כולל מול מי">
        <Field label="" wide>
          <MultiChips options={ABC_ANTECEDENTS} value={v.antecedents} onChange={(antecedents) => set({ antecedents })} />
          <TextArea value={v.a} onChange={(a) => set({ a })} placeholder="כתבו כאן…" />
        </Field>
        <Field label="מול מי?" wide>
          <input className="dr-input" value={v.withWhom || ''} maxLength={100} onChange={(e) => set({ withWhom: e.target.value })} />
        </Field>
      </Group>

      <Group tone="blue" icon="B" title="מה הייתה ההתנהגות?" sub="יש לציין עוצמות ומשכי זמן, כלפי מי נעשה">
        <Field label="" wide>
          <MultiChips options={ABC_BEHAVIORS} value={v.behaviors} onChange={(behaviors) => set({ behaviors })} />
          <TextArea value={v.b} onChange={(b) => set({ b })} placeholder="כתבו כאן…" />
        </Field>
        <Field label="עוצמה">
          <Chips options={ABC_INTENSITY} value={v.intensity} onChange={(intensity) => set({ intensity })} />
        </Field>
        <Field label="משך">
          <input className="dr-input" value={v.duration || ''} maxLength={40} placeholder="לדוגמה: 3 דקות" onChange={(e) => set({ duration: e.target.value })} />
        </Field>
        <Field label="כלפי מי?" wide>
          <input className="dr-input" value={v.toward || ''} maxLength={100} onChange={(e) => set({ toward: e.target.value })} />
        </Field>
      </Group>

      <Group tone="peach" icon="C" title="מה קרה אחרי?" sub="כל תוצאה שהתרחשה ועל ידי מי">
        <Field label="" wide>
          <MultiChips options={ABC_CONSEQUENCES} value={v.consequences} onChange={(consequences) => set({ consequences })} />
          <TextArea value={v.c} onChange={(c) => set({ c })} placeholder="כתבו כאן…" />
        </Field>
        <Field label="על ידי מי?" wide>
          <input className="dr-input" value={v.byWhom || ''} maxLength={100} onChange={(e) => set({ byWhom: e.target.value })} />
        </Field>
      </Group>

      <div className="dr-card">
        <Field label="הערות נוספות" wide>
          <TextArea value={v.notes} onChange={(notes) => set({ notes })} placeholder="כתבו כאן…" />
        </Field>
      </div>
    </>
  );
}
