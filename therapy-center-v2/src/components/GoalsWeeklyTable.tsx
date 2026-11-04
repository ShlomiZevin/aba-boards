import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { formsApi, sessionsApi } from '../api/client';
import { toDate } from '../utils/date';
import { GOAL_CATEGORIES } from '../types';
import type { Goal, Practitioner, SessionForm, Session } from '../types';
import Icon from '../v2/Icon';
import { CATEGORY_TONE } from '../v2/kidColor';
import '../v2/pages/ff.css';

interface GoalsWeeklyTableProps {
  kidId: string;
  goals: Goal[];
  selectedGoals: Set<string>;
  onToggleGoal?: (goalId: string) => void;
  currentFormDate: string;
  currentFormId?: string;
  practitioners: Practitioner[];
}

export default function GoalsWeeklyTable({
  kidId,
  goals,
  selectedGoals,
  onToggleGoal,
  currentFormDate,
  currentFormId,
  practitioners,
}: GoalsWeeklyTableProps) {
  // Calculate the week's Sunday-Saturday range
  const formDate = new Date(currentFormDate);
  const dayOfWeek = formDate.getDay();
  const sunday = new Date(formDate);
  sunday.setDate(formDate.getDate() - dayOfWeek);
  sunday.setHours(0, 0, 0, 0);
  const saturdayEnd = new Date(sunday);
  saturdayEnd.setDate(sunday.getDate() + 6);
  saturdayEnd.setHours(23, 59, 59, 999);

  const weekOfStr = format(sunday, 'yyyy-MM-dd');

  // Fetch forms for this kid for this week
  const { data: weekFormsRes } = useQuery({
    queryKey: ['forms', kidId, 'week', weekOfStr],
    queryFn: () => formsApi.getForKid(kidId, { weekOf: weekOfStr }),
    enabled: !!kidId && !!currentFormDate,
  });

  // Fetch sessions to detect unfilled ones
  const { data: sessionsRes } = useQuery({
    queryKey: ['sessions', kidId],
    queryFn: () => sessionsApi.getForKid(kidId),
    enabled: !!kidId,
  });

  // Find sessions in this week that don't have forms
  const allSessions = sessionsRes?.data || [];
  const allSessionIds = new Set(allSessions.map((s: Session) => s.id));

  const weekForms = (weekFormsRes?.data || [])
    .filter((f: SessionForm) => onToggleGoal ? f.id !== currentFormId : true)
    // Filter out orphaned forms (session was deleted but form remained)
    .filter((f: SessionForm) => !f.sessionId || allSessionIds.has(f.sessionId))
    .filter((f: SessionForm) => {
      const fDate = toDate(f.sessionDate);
      // Compare dates only (ignore time) so same-day forms aren't excluded
      const fDateOnly = new Date(fDate.getFullYear(), fDate.getMonth(), fDate.getDate());
      const formDateOnly = new Date(formDate.getFullYear(), formDate.getMonth(), formDate.getDate());
      return fDateOnly <= formDateOnly;
    })
    .sort((a: SessionForm, b: SessionForm) =>
      toDate(a.sessionDate).getTime() - toDate(b.sessionDate).getTime()
    );
  const weekSessions = allSessions.filter((s: Session) => {
    if (s.type === 'meeting') return false; // meetings don't have goals
    const sDate = toDate(s.scheduledDate);
    return sDate >= sunday && sDate <= saturdayEnd && sDate <= formDate;
  });
  const formsSessionIds = new Set(weekForms.map((f: SessionForm) => f.sessionId).filter(Boolean));
  const unfilledSessions = weekSessions.filter((s: Session) =>
    !s.formId && !formsSessionIds.has(s.id)
  );

  // Group goals by category
  const goalsByCategory = GOAL_CATEGORIES.map(cat => ({
    ...cat,
    goals: goals.filter(g => g.categoryId === cat.id),
  })).filter(cat => cat.goals.length > 0);

  // For each weekForm, create a Set of worked-on goal IDs
  const formGoalSets = weekForms.map((f: SessionForm) =>
    new Set(f.goalsWorkedOn?.map(g => g.goalId) || [])
  );

  if (goalsByCategory.length === 0) {
    return <div className="ff-gw-empty hand">אין מטרות פעילות</div>;
  }

  const hasPrevSessions = weekForms.length > 0 || unfilledSessions.length > 0;
  const firstName = (id?: string | null) => (practitioners.find(p => p.id === id)?.name || '?').split(' ')[0];

  // Week columns: filled forms (in date order), then sessions still waiting for a form.
  const cols = [
    ...weekForms.map((f: SessionForm, idx: number) => ({
      key: f.id,
      day: format(toDate(f.sessionDate), 'd.M'),
      who: firstName(f.practitionerId),
      isCurrent: !onToggleGoal && f.id === currentFormId,
      unfilled: false,
      has: (goalId: string) => formGoalSets[idx].has(goalId),
    })),
    ...unfilledSessions.map((s: Session) => ({
      key: s.id,
      day: format(toDate(s.scheduledDate), 'd.M'),
      who: firstName(s.therapistId),
      isCurrent: false,
      unfilled: true,
      has: () => false,
    })),
  ];

  return (
    <div className={`ff-gw${onToggleGoal ? ' is-pick' : ' is-read'}`}>
      {hasPrevSessions && (
        <div className="ff-gw-legend">
          <span className="ff-gw-legend-title">השבוע:</span>
          {cols.map(c => (
            <span key={c.key} className={`ff-gw-leg${c.unfilled ? ' is-unfilled' : ''}${c.isCurrent ? ' is-current' : ''}`}>
              <b className="tabular">{c.day}</b> {c.who}
              {c.unfilled && <em>לא מולא</em>}
              {c.isCurrent && <em>טופס זה</em>}
            </span>
          ))}
        </div>
      )}
      {goalsByCategory.map(cat => {
        const tone = CATEGORY_TONE[cat.id] || 'lilac';
        return (
          <div key={cat.id} className={`ff-gw-cat tone-${tone}`}>
            <div className="ff-gw-cat-head"><span className="nb-dot" /> {cat.nameHe}</div>
            <ul className="ff-gw-list">
              {cat.goals.map(goal => {
                const on = selectedGoals.has(goal.id);
                const marks = cols.length > 0 && (
                  <span className="ff-gw-marks" aria-label="השבוע">
                    {cols.map(c => (
                      <span
                        key={c.key}
                        className={`ff-gw-mark${c.unfilled ? ' is-unfilled' : c.has(goal.id) ? ' is-yes' : ' is-no'}${c.isCurrent ? ' is-current' : ''}`}
                        title={`${c.who} ${c.day}`}
                      >
                        {c.unfilled ? '?' : c.has(goal.id) ? <Icon name="check" size={12} strokeWidth={3} /> : ''}
                      </span>
                    ))}
                  </span>
                );
                const body = (
                  <>
                    <span className="ff-gw-box" aria-hidden="true">{on && <Icon name="check" size={18} strokeWidth={2.8} />}</span>
                    <span className="ff-gw-txt">
                      <span className="ff-gw-title">{goal.title}</span>
                      {marks}
                    </span>
                  </>
                );
                return (
                  <li key={goal.id} className={`ff-gw-row${on ? ' is-on' : ''}`}>
                    {onToggleGoal ? (
                      <button type="button" role="checkbox" aria-checked={on} className="ff-gw-hit" onClick={() => onToggleGoal(goal.id)}>
                        {body}
                      </button>
                    ) : (
                      <div className="ff-gw-hit">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
