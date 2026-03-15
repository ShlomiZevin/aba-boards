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

  const hasPrevSessions = weekForms.length > 0 || unfilledSessions.length > 0;

  // ---------- Desktop: full table ----------
  const desktopTable = (
    <div className="goals-weekly-table-container goals-weekly-desktop">
      <table className="goals-weekly-table">
        <thead>
          <tr>
            <th className="goal-col">מטרה</th>
            {onToggleGoal && <th className="check-col">עבדנו</th>}
            {weekForms.map((f: SessionForm) => {
              const therapist = practitioners.find(p => p.id === f.practitionerId);
              const isCurrent = !onToggleGoal && f.id === currentFormId;
              return (
                <th key={f.id} className="week-col" style={isCurrent ? { background: '#eef2ff', borderBottom: '2px solid #667eea' } : undefined}>
                  <div className="week-col-therapist">{therapist?.name || '?'}</div>
                  <div className="week-col-date">{format(toDate(f.sessionDate), 'dd/MM')}</div>
                  {isCurrent && <div style={{ fontSize: '0.7em', color: '#667eea', fontWeight: 600 }}>טופס זה</div>}
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
                    <td key={f.id} className="week-cell" style={!onToggleGoal && f.id === currentFormId ? { background: '#eef2ff' } : undefined}>
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

  // ---------- Mobile: compact list ----------
  // Build session date labels for header (just day number)
  const sessionLabels = [
    ...weekForms.map((f: SessionForm) => format(toDate(f.sessionDate), 'd')),
    ...unfilledSessions.map((s: Session) => format(toDate(s.scheduledDate), 'd')),
  ];
  const sessionCount = weekForms.length + unfilledSessions.length;

  // Grid columns: [checkbox?] [name 1fr] [session cells 24px each]
  const gridCols = `${onToggleGoal ? '24px ' : ''}1fr ${sessionCount > 0 ? `repeat(${sessionCount}, 24px)` : ''}`.trim();

  const mobileList = (
    <div className="goals-weekly-mobile" style={{ '--gwm-cols': gridCols } as React.CSSProperties}>
      {/* Date headers row */}
      {hasPrevSessions && (
        <div className="gwm-row gwm-header-row">
          {onToggleGoal && <span className="gwm-cell gwm-cb-cell" />}
          <span className="gwm-cell gwm-name-cell" style={{ fontSize: '0.68em', color: '#94a3b8' }}>מטרה</span>
          {sessionLabels.map((d, i) => (
            <span key={i} className="gwm-cell gwm-session-cell" style={{ fontSize: '0.6em', color: i >= weekForms.length ? '#d97706' : '#64748b' }}>{d}</span>
          ))}
        </div>
      )}
      {goalsByCategory.map(cat => (
        <Fragment key={cat.id}>
          <div className="gwm-row gwm-cat-row" style={{ color: cat.color }}>{cat.nameHe}</div>
          {cat.goals.map(goal => (
            <div key={goal.id} className="gwm-row gwm-goal-row" onClick={() => onToggleGoal?.(goal.id)}>
              {onToggleGoal && (
                <span className="gwm-cell gwm-cb-cell">
                  <input type="checkbox" checked={selectedGoals.has(goal.id)} readOnly />
                </span>
              )}
              <span className="gwm-cell gwm-name-cell">{goal.title}</span>
              {weekForms.map((f: SessionForm, idx: number) => (
                <span key={f.id} className="gwm-cell gwm-session-cell">
                  {formGoalSets[idx].has(goal.id)
                    ? <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span>
                    : <span style={{ color: '#e2e8f0' }}>✕</span>}
                </span>
              ))}
              {unfilledSessions.map((s: Session) => (
                <span key={s.id} className="gwm-cell gwm-session-cell">
                  <span style={{ color: '#fbbf24' }}>?</span>
                </span>
              ))}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );

  return (
    <>
      {desktopTable}
      {mobileList}
    </>
  );
}
