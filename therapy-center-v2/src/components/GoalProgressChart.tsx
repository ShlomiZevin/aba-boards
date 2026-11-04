import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formsApi, goalsApi } from '../api/client';
import { GOAL_CATEGORIES } from '../types';
import type { GoalCategoryId, SessionForm, Goal } from '../types';
import { toDate } from '../utils/date';
import Icon from '../v2/Icon';
import { CATEGORY_TONE, CATEGORY_LABEL } from '../v2/kidColor';
import '../v2/pages/kp.css';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface GoalProgressChartProps {
  kidId: string;
}

type TimeRange = 'month' | '3months' | 'all';

const RANGE_LABELS: Record<TimeRange, string> = {
  month: 'חודש אחרון',
  '3months': '3 חודשים',
  all: 'הכל',
};

function formatDate(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const toneOf = (catId: GoalCategoryId | string) => CATEGORY_TONE[catId] || 'lilac';
const PEN = '#6B4FD8';
const MARKER = '#FFE58A';
const INK = '#2A2140';
const INK2 = '#4A4060';
const LINE = '#E8DDC8';


export default function GoalProgressChart({ kidId }: GoalProgressChartProps) {
  const [range, setRange] = useState<TimeRange>('3months');

  const { data: formsRes, isLoading: formsLoading } = useQuery({
    queryKey: ['forms', kidId],
    queryFn: () => formsApi.getForKid(kidId),
  });

  const { data: goalsRes, isLoading: goalsLoading } = useQuery({
    queryKey: ['goals', kidId],
    queryFn: () => goalsApi.getForKid(kidId),
  });

  const forms: SessionForm[] = formsRes?.data || [];
  const goals: Goal[] = goalsRes?.data || [];
  const isLoading = formsLoading || goalsLoading;

  // Filter forms by time range
  const filteredForms = useMemo(() => {
    const now = new Date();
    let cutoff: Date;
    if (range === 'month') {
      cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    } else if (range === '3months') {
      cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    } else {
      cutoff = new Date(0);
    }
    return forms
      .filter(f => toDate(f.sessionDate) >= cutoff)
      .sort((a, b) => toDate(a.sessionDate).getTime() - toDate(b.sessionDate).getTime());
  }, [forms, range]);

  // Cooperation trend data
  const cooperationData = useMemo(() => {
    return filteredForms.map(f => ({
      date: formatDate(toDate(f.sessionDate)),
      fullDate: toDate(f.sessionDate).toLocaleDateString('he-IL'),
      cooperation: f.cooperation || 0,
    }));
  }, [filteredForms]);

  // Goal frequency data — how many sessions each goal was worked on
  const goalFrequencyData = useMemo(() => {
    const counts: Record<string, { title: string; categoryId: GoalCategoryId; count: number }> = {};

    // Initialize with active goals at 0
    goals.filter(g => g.isActive).forEach(g => {
      counts[g.id] = { title: g.title, categoryId: g.categoryId, count: 0 };
    });

    // Count from forms
    filteredForms.forEach(f => {
      (f.goalsWorkedOn || []).forEach(gs => {
        if (counts[gs.goalId]) {
          counts[gs.goalId].count++;
        } else {
          counts[gs.goalId] = { title: gs.goalTitle, categoryId: gs.categoryId, count: 1 };
        }
      });
    });

    return Object.entries(counts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [filteredForms, goals]);

  // Category distribution — sessions per category
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredForms.forEach(f => {
      (f.goalsWorkedOn || []).forEach(gs => {
        counts[gs.categoryId] = (counts[gs.categoryId] || 0) + 1;
      });
    });

    return GOAL_CATEGORIES
      .map(cat => ({
        name: cat.nameHe,
        id: cat.id,
        value: counts[cat.id] || 0,
      }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [filteredForms]);

  // Goal heatmap data — grouped by week, with intensity
  const heatmapData = useMemo(() => {
    const activeGoals = goals.filter(g => g.isActive);

    // Group forms into weeks (Sunday-based)
    const weekMap = new Map<string, { label: string; goalCounts: Record<string, number>; totalSessions: number }>();

    filteredForms.forEach(f => {
      const d = toDate(f.sessionDate);
      // Get Sunday of this week
      const sunday = new Date(d);
      sunday.setDate(d.getDate() - d.getDay());
      const weekKey = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;

      if (!weekMap.has(weekKey)) {
        const saturdayDate = new Date(sunday);
        saturdayDate.setDate(sunday.getDate() + 6);
        const label = `${sunday.getDate()}/${sunday.getMonth() + 1}-${saturdayDate.getDate()}/${saturdayDate.getMonth() + 1}`;
        weekMap.set(weekKey, { label, goalCounts: {}, totalSessions: 0 });
      }

      const week = weekMap.get(weekKey)!;
      week.totalSessions++;
      (f.goalsWorkedOn || []).forEach(gs => {
        week.goalCounts[gs.goalId] = (week.goalCounts[gs.goalId] || 0) + 1;
      });
    });

    // Sort weeks chronologically
    const weeks = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => data);

    // Find max count for intensity scaling
    let maxCount = 1;
    weeks.forEach(w => {
      Object.values(w.goalCounts).forEach(c => { if (c > maxCount) maxCount = c; });
    });

    return { activeGoals, weeks, maxCount };
  }, [filteredForms, goals]);

  if (isLoading) {
    return <div className="kp-empty hand">טוען נתוני התקדמות...</div>;
  }

  if (forms.length === 0) {
    return (
      <div className="kp-empty">
        <Icon name="chart" size={34} />
        <p className="hand">אין עדיין טפסי טיפול — נתוני ההתקדמות יופיעו כאן לאחר מילוי טפסים</p>
      </div>
    );
  }

  const totalSessions = filteredForms.length;
  const avgCooperation = totalSessions > 0
    ? Math.round(filteredForms.reduce((sum, f) => sum + (f.cooperation || 0), 0) / totalSessions)
    : 0;
  const topGoal = goalFrequencyData[0];

  return (
    <div className="kp-progress">
      {/* Time Range Selector */}
      <div className="kp-seg" role="tablist">
        {(Object.keys(RANGE_LABELS) as TimeRange[]).map(r => (
          <button
            key={r}
            role="tab"
            aria-selected={range === r}
            className={`kp-seg-btn${range === r ? ' is-on' : ''}`}
            onClick={() => setRange(r)}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Summary stickers */}
      <div className="kp-stats">
        <span className="kh-stat tone-mint" style={{ ['--rot' as string]: '-2deg' }}>
          <b className="tabular">{totalSessions}</b> טיפולים
        </span>
        <span className="kh-stat tone-yellow" style={{ ['--rot' as string]: '1.5deg' }}>
          <b className="tabular">{avgCooperation}%</b> שיתוף פעולה ממוצע
        </span>
        {topGoal?.title && (
          <span className={`kh-stat tone-${toneOf(topGoal.categoryId)} kp-stat-goal`} style={{ ['--rot' as string]: '-1deg' }}>
            <b className="tabular">{topGoal.count}</b>
            <span className="kp-ell">{topGoal.title}</span>
          </span>
        )}
      </div>

      <div className="kp-progress-grid">
      {/* Cooperation Trend */}
      {cooperationData.length >= 2 && (
        <section className="kp-block kp-block-chart">
          <h3 className="kp-h3">שיתוף פעולה <mark className="hl-yellow">לאורך זמן</mark></h3>
          <div className="kp-chart" dir="ltr">
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={cooperationData} margin={{ top: 10, right: 12, left: -18, bottom: 4 }}>
                <CartesianGrid strokeDasharray="1 5" stroke="#CDBFA6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: INK2 }} axisLine={{ stroke: LINE }} tickLine={false} minTickGap={14} />
                <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 11, fill: INK2 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: number | undefined) => [`${value ?? 0}%`, 'שיתוף פעולה']}
                  labelFormatter={(label) => String(label)}
                  contentStyle={{ direction: 'rtl', fontSize: 13, borderRadius: 12, border: `1.5px solid ${LINE}`, background: '#FFFBF3', color: INK }}
                  cursor={{ stroke: PEN, strokeDasharray: '2 4' }}
                />
                {/* marker underline, then the pen line on top */}
                <Line type="monotone" dataKey="cooperation" stroke={MARKER} strokeOpacity={0.85} strokeWidth={11} strokeLinecap="round" dot={false} activeDot={false} isAnimationActive={false} legendType="none" tooltipType="none" />
                <Line
                  type="monotone"
                  dataKey="cooperation"
                  stroke={PEN}
                  strokeWidth={2.4}
                  dot={{ r: 3.5, fill: '#fff', stroke: PEN, strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: PEN, stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Goal Frequency Bars */}
      {goalFrequencyData.length > 0 && (() => {
        const maxCount = goalFrequencyData[0]?.count || 1;
        return (
          <section className="kp-block">
            <h3 className="kp-h3">תדירות עבודה על מטרות</h3>
            <ul className="kp-bars">
              {goalFrequencyData.map(entry => {
                const pct = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
                return (
                  <li key={entry.id} className={`kp-bar tone-${toneOf(entry.categoryId)}`}>
                    <div className="kp-bar-label">
                      <span className="nb-dot" />
                      <span className="kp-bar-name">{entry.title}</span>
                      <b className="kp-bar-count tabular">{entry.count}</b>
                    </div>
                    <div className="kp-bar-track">
                      <div className="kp-bar-fill" style={{ width: `${entry.count > 0 ? Math.max(pct, 4) : 0}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })()}

      {/* Category Distribution */}
      {categoryData.length > 0 && (
        <section className="kp-block">
          <h3 className="kp-h3">התפלגות לפי קטגוריה</h3>
          <ul className="kp-bars kp-bars-cat">
            {categoryData.map(cat => {
              const maxVal = categoryData[0].value;
              const pct = maxVal > 0 ? (cat.value / maxVal) * 100 : 0;
              return (
                <li key={cat.id} className={`kp-bar tone-${toneOf(cat.id)}`}>
                  <div className="kp-bar-label">
                    <span className="nb-chip">{CATEGORY_LABEL[cat.id] || cat.name}</span>
                    <b className="kp-bar-count tabular">{cat.value}</b>
                  </div>
                  <div className="kp-bar-track">
                    <div className="kp-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      </div>

      {/* Goal Heatmap — grouped by week */}
      {heatmapData.weeks.length > 0 && heatmapData.activeGoals.length > 0 && (
        <section className="kp-block">
          <h3 className="kp-h3">מפת עבודה על מטרות <span className="nb-muted kp-h3-sub">לפי שבוע</span></h3>
          <div className="kp-heat-wrap">
            <table className="kp-heat">
              <thead>
                <tr>
                  <th className="kp-heat-goal" />
                  {heatmapData.weeks.map((w, i) => (
                    <th key={i} className="kp-heat-date tabular" title={`${w.totalSessions} טיפולים`}>{w.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.activeGoals.map(goal => (
                  <tr key={goal.id} className={`tone-${toneOf(goal.categoryId)}`}>
                    <th className="kp-heat-goal" title={goal.title}>
                      <span className="nb-dot" />
                      <span className="kp-ell">{goal.title}</span>
                    </th>
                    {heatmapData.weeks.map((w, i) => {
                      const count = w.goalCounts[goal.id] || 0;
                      const t = heatmapData.maxCount > 1 ? (count - 1) / (heatmapData.maxCount - 1) : 0;
                      const size = count > 0 ? 22 + t * 12 : 0;
                      return (
                        <td key={i} title={count > 0 ? `${count} מתוך ${w.totalSessions} טיפולים` : ''}>
                          {count > 0 ? (
                            <span className="kp-heat-bub tabular" style={{ width: size, height: size }}>{count}</span>
                          ) : <span className="kp-heat-none" />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="kp-note">מספר = כמה טיפולים עבדו על המטרה באותו שבוע</p>
          <div className="kp-legend">
            {GOAL_CATEGORIES.filter(c => heatmapData.activeGoals.some(g => g.categoryId === c.id)).map(cat => (
              <span key={cat.id} className={`nb-chip tone-${toneOf(cat.id)}`}>{CATEGORY_LABEL[cat.id] || cat.nameHe}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
