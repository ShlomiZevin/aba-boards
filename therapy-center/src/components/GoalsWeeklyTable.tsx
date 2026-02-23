import { Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { formsApi, sessionsApi } from '../api/client';
import { toDate } from '../utils/date';
import { GOAL_CATEGORIES } from '../types';
import type { Goal, Practitioner, SessionForm, Session } from '../types';

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
    .filter((f: SessionForm) => f.id !== currentFormId)
    // Filter out orphaned forms (session was deleted but form remained)
    .filter((f: SessionForm) => !f.sessionId || allSessionIds.has(f.sessionId))
    .filter((f: SessionForm) => {
      const fDate = toDate(f.sessionDate);
      return fDate <= formDate; // Only show forms from earlier or same day
    })
    .sort((a: SessionForm, b: SessionForm) =>
      toDate(a.sessionDate).getTime() - toDate(b.sessionDate).getTime()
    );
  const weekSessions = allSessions.filter((s: Session) => {
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

  const totalCols = 1 + (onToggleGoal ? 1 : 0) + weekForms.length + unfilledSessions.length;

  if (goalsByCategory.length === 0) {
    return (
      <div style={{ color: '#a0aec0', textAlign: 'center', padding: '20px' }}>
        אין מטרות פעילות
      </div>
    );
  }

  return (
    <div className="goals-weekly-table-container">
      <table className="goals-weekly-table">
        <thead>
          <tr>
            <th className="goal-col">מטרה</th>
            {onToggleGoal && <th className="check-col">עבדנו</th>}
            {weekForms.map((f: SessionForm) => {
              const therapist = practitioners.find(p => p.id === f.practitionerId);
              return (
                <th key={f.id} className="week-col">
                  <div className="week-col-therapist">{therapist?.name || '?'}</div>
                  <div className="week-col-date">{format(toDate(f.sessionDate), 'dd/MM')}</div>
                </th>
              );
            })}
            {unfilledSessions.map((s: Session) => {
              const therapist = practitioners.find(p => p.id === s.therapistId);
              return (
                <th key={s.id} className="week-col unfilled">
                  <div className="week-col-therapist">{therapist?.name || '?'}</div>
                  <div className="week-col-date">{format(toDate(s.scheduledDate), 'dd/MM')}</div>
                  <div className="week-col-status">לא מולא</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {goalsByCategory.map(cat => (
            <Fragment key={cat.id}>
              <tr className="category-row">
                <td
                  colSpan={totalCols}
                  style={{ color: cat.color, fontWeight: 700 }}
                >
                  {cat.nameHe}
                </td>
              </tr>
              {cat.goals.map(goal => (
                <tr key={goal.id}>
                  <td className="goal-title-cell">{goal.title}</td>
                  {onToggleGoal && (
                    <td className="check-cell">
                      <input
                        type="checkbox"
                        checked={selectedGoals.has(goal.id)}
                        onChange={() => onToggleGoal(goal.id)}
                      />
                    </td>
                  )}
                  {weekForms.map((f: SessionForm, idx: number) => (
                    <td key={f.id} className="week-cell">
                      {formGoalSets[idx].has(goal.id) ? (
                        <span className="goal-worked">✓</span>
                      ) : (
                        <span className="goal-not-worked">✕</span>
                      )}
                    </td>
                  ))}
                  {unfilledSessions.map((s: Session) => (
                    <td key={s.id} className="week-cell unfilled-cell">
                      <span className="goal-unknown">?</span>
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
