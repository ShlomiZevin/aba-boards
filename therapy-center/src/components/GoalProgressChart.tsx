import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formsApi, goalsApi } from '../api/client';
import { GOAL_CATEGORIES } from '../types';
import type { GoalCategoryId, SessionForm, Goal } from '../types';
import { toDate } from '../utils/date';
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

const getCategoryColor = (catId: GoalCategoryId) =>
  GOAL_CATEGORIES.find(c => c.id === catId)?.color || '#607D8B';


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
        color: cat.color,
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
    return (
      <div className="progress-chart-loading">
        <div className="loading">טוען נתוני התקדמות...</div>
      </div>
    );
  }

  if (forms.length === 0) {
    return (
      <div className="progress-chart-empty">
        <p>אין עדיין טפסי טיפול — נתוני ההתקדמות יופיעו כאן לאחר מילוי טפסים</p>
      </div>
    );
  }

  const totalSessions = filteredForms.length;
  const avgCooperation = totalSessions > 0
    ? Math.round(filteredForms.reduce((sum, f) => sum + (f.cooperation || 0), 0) / totalSessions)
    : 0;
  const topGoal = goalFrequencyData[0];

  return (
    <div className="progress-chart">
      {/* Time Range Selector */}
      <div className="progress-range-selector">
        {(Object.keys(RANGE_LABELS) as TimeRange[]).map(r => (
          <button
            key={r}
            className={`tab-btn${range === r ? ' active' : ''}`}
            onClick={() => setRange(r)}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="progress-summary">
        <div className="progress-stat">
          <span className="progress-stat-value">{totalSessions}</span>
          <span className="progress-stat-label">טיפולים</span>
        </div>
        <div className="progress-stat">
          <span className="progress-stat-value">{avgCooperation}%</span>
          <span className="progress-stat-label">שיתוף פעולה ממוצע</span>
        </div>
        {topGoal?.title && (
          <div className="progress-stat">
            <span className="progress-stat-value">{topGoal.count}</span>
            <span className="progress-stat-label">
              {topGoal.title.length > 18 ? topGoal.title.slice(0, 18) + '…' : topGoal.title}
            </span>
          </div>
        )}
      </div>

      {/* Cooperation Trend */}
      {cooperationData.length >= 2 && (
        <div className="progress-section">
          <h4>שיתוף פעולה לאורך זמן</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cooperationData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number | undefined) => [`${value ?? 0}%`, 'שיתוף פעולה']}
                labelFormatter={(label) => String(label)}
                contentStyle={{ direction: 'rtl', fontSize: 13 }}
              />
              <Line
                type="monotone"
                dataKey="cooperation"
                stroke="#667eea"
                strokeWidth={2}
                dot={{ r: 4, fill: '#667eea' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Goal Frequency Bars */}
      {goalFrequencyData.length > 0 && (() => {
        const maxCount = goalFrequencyData[0]?.count || 1;
        return (
          <div className="progress-section">
            <h4>תדירות עבודה על מטרות</h4>
            <div className="goal-freq-list">
              {goalFrequencyData.map(entry => {
                const pct = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
                const color = getCategoryColor(entry.categoryId);
                return (
                  <div key={entry.id} className="goal-freq-item">
                    <div className="goal-freq-label">
                      <span className="goal-freq-name">{entry.title}</span>
                      <span className="goal-freq-count" style={{ color }}>{entry.count}</span>
                    </div>
                    <div className="goal-freq-track">
                      <div
                        className="goal-freq-fill"
                        style={{ width: `${Math.max(pct, 2)}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Category Distribution */}
      {categoryData.length > 0 && (
        <div className="progress-section">
          <h4>התפלגות לפי קטגוריה</h4>
          <div className="category-dist-bars">
            {categoryData.map(cat => {
              const maxVal = categoryData[0].value;
              const pct = maxVal > 0 ? (cat.value / maxVal) * 100 : 0;
              return (
                <div key={cat.id} className="category-dist-row">
                  <span className="category-dist-name">{cat.name}</span>
                  <div className="category-dist-track">
                    <div
                      className="category-dist-fill"
                      style={{ width: `${pct}%`, background: cat.color }}
                    />
                  </div>
                  <span className="category-dist-count">{cat.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Goal Heatmap — grouped by week */}
      {heatmapData.weeks.length > 0 && heatmapData.activeGoals.length > 0 && (
        <div className="progress-section">
          <h4>מפת עבודה על מטרות (לפי שבוע)</h4>
          <div className="goal-heatmap-wrapper">
            <div className="goal-heatmap">
              {/* Header row — week ranges */}
              <div className="heatmap-row heatmap-header">
                <div className="heatmap-goal-label" />
                {heatmapData.weeks.map((w, i) => (
                  <div key={i} className="heatmap-cell heatmap-date" title={`${w.totalSessions} טיפולים`}>
                    {w.label}
                  </div>
                ))}
              </div>
              {/* Goal rows */}
              {heatmapData.activeGoals.map(goal => {
                const color = getCategoryColor(goal.categoryId);
                return (
                  <div key={goal.id} className="heatmap-row">
                    <div
                      className="heatmap-goal-label"
                      title={goal.title}
                      style={{ borderRightColor: color }}
                    >
                      {goal.title.length > 20 ? goal.title.slice(0, 20) + '…' : goal.title}
                    </div>
                    {heatmapData.weeks.map((w, i) => {
                      const count = w.goalCounts[goal.id] || 0;
                      // Size: 18px min → 34px max, opacity: 0.25 → 1.0
                      const t = heatmapData.maxCount > 1 ? (count - 1) / (heatmapData.maxCount - 1) : 0;
                      const size = count > 0 ? 18 + t * 16 : 0;
                      const opacity = count > 0 ? 0.3 + t * 0.7 : 0;
                      return (
                        <div
                          key={i}
                          className="heatmap-cell"
                          title={count > 0 ? `${count} מתוך ${w.totalSessions} טיפולים` : ''}
                        >
                          {count > 0 && (
                            <span
                              className="heatmap-bubble"
                              style={{ width: size, height: size, background: color, opacity }}
                            >
                              {count}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="heatmap-legend">
            <span className="heatmap-legend-item" style={{ color: '#94a3b8', fontSize: '0.8em' }}>
              מספר = כמה טיפולים עבדו על המטרה באותו שבוע
            </span>
          </div>
          <div className="heatmap-legend">
            {GOAL_CATEGORIES.filter(c => heatmapData.activeGoals.some(g => g.categoryId === c.id)).map(cat => (
              <span key={cat.id} className="heatmap-legend-item">
                <span className="heatmap-legend-dot" style={{ background: cat.color }} />
                {cat.nameHe}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
