import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kidsApi, agendaApi } from '../api/client';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import {
  PERIODS,
  PERIOD_META,
  DAY_LETTERS,
  DAY_NAMES,
  DAY_COLORS,
  addDays,
  dateKey,
  emptyPlan,
  newItemId,
  shortDate,
  startOfWeek,
  starterRoutine,
  weekRangeLabel,
} from '../utils/agenda';
import AgendaItemSheet from '../components/agenda/AgendaItemSheet';
import type { SheetTarget } from '../components/agenda/AgendaItemSheet';
import type {
  AgendaDay,
  AgendaDayPlan,
  AgendaItem,
  AgendaPeriod,
  ApiResponse,
  KidAgenda,
} from '../types';
import '../components/agenda/agenda.css';

const BASE = import.meta.env.BASE_URL;
const DEFAULT_AVATAR = `${BASE}me-default-small.jpg`;
const DESKTOP_MIN = 900;

type Mode = 'week' | 'routine';

/** Where an edit lands: a specific date, or the routine for a weekday. */
type Column = { key: string; weekday: number; date: Date | null };

/**
 * סדר יום — a per-kid day plan. Families (and the centre) lay out what
 * happens in the morning, afternoon and evening, usually the evening before.
 *
 * Deliberately not the board: ticking an item off is a convenience for
 * following the day, never an event that earns coins or rewards.
 *
 * Desktop shows the whole week as a grid; phones show one day at a time.
 */
export default function AgendaPage() {
  const { kidId } = useParams<{ kidId: string }>();
  const links = useTherapistLinks();
  const queryClient = useQueryClient();

  const today = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [selected, setSelected] = useState(() => dateKey(today));
  const [mode, setMode] = useState<Mode>('week');
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [dayMenu, setDayMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ text: string; action: string; run: () => void } | null>(null);
  const [desktop, setDesktop] = useState(() => window.innerWidth >= DESKTOP_MIN);
  const [drag, setDrag] = useState<{ col: string; period: AgendaPeriod; id: string } | null>(null);

  // The app's body padding and gradient belong to the other screens
  useEffect(() => {
    document.body.classList.add('agenda-open');
    const onResize = () => setDesktop(window.innerWidth >= DESKTOP_MIN);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.classList.remove('agenda-open');
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const from = dateKey(weekStart);
  const to = dateKey(addDays(weekStart, 6));
  const agendaKey = ['kid-agenda', kidId, from, to];

  const kidQuery = useQuery({
    queryKey: ['kid', kidId],
    queryFn: () => kidsApi.getById(kidId!),
    enabled: !!kidId,
  });

  const agendaQuery = useQuery({
    queryKey: agendaKey,
    queryFn: () => agendaApi.get(kidId!, from, to),
    enabled: !!kidId,
    placeholderData: (prev) => prev,
  });

  const agenda: KidAgenda = agendaQuery.data?.data || { routine: {}, days: {} };

  // ---------- mutations (optimistic — the plan must never lag a tap) ----------

  const patchCache = (fn: (a: KidAgenda) => KidAgenda) => {
    const previous = queryClient.getQueryData<ApiResponse<KidAgenda>>(agendaKey);
    const base = previous?.data || { routine: {}, days: {} };
    queryClient.setQueryData<ApiResponse<KidAgenda>>(agendaKey, { success: true, data: fn(base) });
    return { previous };
  };
  const rollback = (_e: unknown, _v: unknown, ctx?: { previous?: ApiResponse<KidAgenda> }) => {
    if (ctx?.previous) queryClient.setQueryData(agendaKey, ctx.previous);
  };
  const settle = () => queryClient.invalidateQueries({ queryKey: ['kid-agenda', kidId] });

  const saveDay = useMutation({
    mutationFn: ({ date, items }: { date: string; items: AgendaDayPlan | null }) =>
      agendaApi.saveDay(kidId!, date, items),
    onMutate: async ({ date, items }) => {
      await queryClient.cancelQueries({ queryKey: agendaKey });
      return patchCache((a) => ({
        ...a,
        days: { ...a.days, [date]: { items, done: a.days[date]?.done || [] } },
      }));
    },
    onError: rollback,
    onSettled: settle,
  });

  const saveRoutine = useMutation({
    mutationFn: (routine: Record<number, AgendaDayPlan>) => agendaApi.saveRoutine(kidId!, routine),
    onMutate: async (routine) => {
      await queryClient.cancelQueries({ queryKey: agendaKey });
      return patchCache((a) => ({ ...a, routine }));
    },
    onError: rollback,
    onSettled: settle,
  });

  const setDone = useMutation({
    mutationFn: ({ date, itemId, done }: { date: string; itemId: string; done: boolean }) =>
      agendaApi.setDone(kidId!, date, itemId, done),
    onMutate: async ({ date, itemId, done }) => {
      await queryClient.cancelQueries({ queryKey: agendaKey });
      return patchCache((a) => {
        const day: AgendaDay = a.days[date] || { items: null, done: [] };
        const list = day.done.filter((id) => id !== itemId);
        return { ...a, days: { ...a.days, [date]: { ...day, done: done ? [...list, itemId] : list } } };
      });
    },
    onError: rollback,
  });

  // ---------- reading the plan ----------

  const routineFor = (weekday: number): AgendaDayPlan => agenda.routine[weekday] || emptyPlan();
  const isCustom = (key: string) => !!agenda.days[key]?.items;
  const planFor = (col: Column): AgendaDayPlan =>
    col.date ? agenda.days[col.key]?.items || routineFor(col.weekday) : routineFor(col.weekday);
  const doneFor = (col: Column) => new Set(col.date ? agenda.days[col.key]?.done || [] : []);

  const columns: Column[] = useMemo(
    () =>
      mode === 'routine'
        ? DAY_NAMES.map((_, d) => ({ key: `r${d}`, weekday: d, date: null }))
        : Array.from({ length: 7 }, (_, d) => {
            const date = addDays(weekStart, d);
            return { key: dateKey(date), weekday: d, date };
          }),
    [mode, weekStart]
  );

  /** Routine changes go out as one write, so two edits can't overwrite each other. */
  const writePlans = (changes: [Column, AgendaDayPlan][]) => {
    const routine = { ...agenda.routine };
    let routineChanged = false;
    for (const [col, plan] of changes) {
      if (col.date) {
        saveDay.mutate({ date: col.key, items: plan });
      } else {
        routine[col.weekday] = plan;
        routineChanged = true;
      }
    }
    if (routineChanged) saveRoutine.mutate(routine);
  };
  const writePlan = (col: Column, plan: AgendaDayPlan) => writePlans([[col, plan]]);

  const colByKey = (key: string) => columns.find((c) => c.key === key);

  // ---------- edits ----------

  const handleSheetSave = (item: AgendaItem, period: AgendaPeriod) => {
    if (!sheet) return;
    const col = colByKey(sheet.col);
    if (!col) return;
    const plan = clonePlan(planFor(col));
    if (sheet.item) {
      // Remove from where it was; re-insert in place, or at the end of a new period
      const oldList = plan[sheet.period];
      const idx = oldList.findIndex((i) => i.id === sheet.item!.id);
      if (idx >= 0) oldList.splice(idx, 1);
      if (period === sheet.period && idx >= 0) oldList.splice(idx, 0, item);
      else plan[period].push(item);
    } else {
      plan[period].push(item);
    }
    writePlan(col, plan);
    setSheet(null);
  };

  const handleSheetDelete = () => {
    if (!sheet?.item) return;
    const col = colByKey(sheet.col);
    if (!col) return;
    const plan = clonePlan(planFor(col));
    plan[sheet.period] = plan[sheet.period].filter((i) => i.id !== sheet.item!.id);
    writePlan(col, plan);
    setSheet(null);
  };

  const moveItem = (col: Column, period: AgendaPeriod, id: string, delta: number) => {
    const plan = clonePlan(planFor(col));
    const list = plan[period];
    const i = list.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    writePlan(col, plan);
  };

  const removeItem = (col: Column, period: AgendaPeriod, id: string) => {
    const plan = clonePlan(planFor(col));
    plan[period] = plan[period].filter((x) => x.id !== id);
    writePlan(col, plan);
  };

  /** Desktop drag: move a card within a day, or to another day or period. */
  const dropOn = (target: Column, period: AgendaPeriod, beforeId: string | null) => {
    if (!drag) return;
    const source = colByKey(drag.col);
    setDrag(null);
    if (!source) return;
    const item = planFor(source)[drag.period].find((i) => i.id === drag.id);
    if (!item) return;

    if (source.key === target.key) {
      const plan = clonePlan(planFor(source));
      plan[drag.period] = plan[drag.period].filter((i) => i.id !== item.id);
      insertBefore(plan[period], item, beforeId);
      writePlan(source, plan);
      return;
    }
    const from = clonePlan(planFor(source));
    from[drag.period] = from[drag.period].filter((i) => i.id !== item.id);
    const to = clonePlan(planFor(target));
    // A fresh id, so the item doesn't carry a ✓ from the day it came from
    insertBefore(to[period], { ...item, id: newItemId() }, beforeId);
    writePlans([[source, from], [target, to]]);
  };

  const toggleDone = (col: Column, id: string) => {
    if (!col.date || editing) return;
    setDone.mutate({ date: col.key, itemId: id, done: !doneFor(col).has(id) });
  };

  // ---------- day-level actions ----------

  const dayActions = (col: Column) => {
    if (!col.date) return [];
    const prev = addDays(col.date, -1);
    const prevKey = dateKey(prev);
    const prevPlan = agenda.days[prevKey]?.items || routineFor(prev.getDay());
    const actions: { label: string; icon: string; run: () => void; danger?: boolean }[] = [];
    if (isCustom(col.key)) {
      actions.push({
        icon: '↺',
        label: 'ביטול השינויים — חזרה לשגרה הקבועה',
        run: () => saveDay.mutate({ date: col.key, items: null }),
      });
    }
    actions.push({
      icon: '📋',
      label: `העתקת התוכנית של יום ${DAY_NAMES[prev.getDay()]} ליום הזה`,
      run: () => saveDay.mutate({ date: col.key, items: withFreshIds(prevPlan) }),
    });
    actions.push({
      icon: '⭐',
      label: `שמירה כשגרה קבועה לכל יום ${DAY_NAMES[col.weekday]}`,
      run: () => saveRoutine.mutate({ ...agenda.routine, [col.weekday]: clonePlan(planFor(col)) }),
    });
    actions.push({
      icon: '🧹',
      label: 'מחיקת כל הפעילויות של היום',
      danger: true,
      run: () =>
        setConfirm({
          text: `לנקות את כל הפעילויות של יום ${DAY_NAMES[col.weekday]}?`,
          action: 'ניקוי היום',
          run: () => saveDay.mutate({ date: col.key, items: emptyPlan() }),
        }),
    });
    return actions;
  };

  // ---------- navigation ----------

  const goWeek = (delta: number) => {
    const next = addDays(weekStart, delta * 7);
    setWeekStart(next);
    // Keep the same weekday selected on phones
    const sel = new Date(`${selected}T12:00:00`);
    setSelected(dateKey(addDays(next, sel.getDay())));
  };

  const goToday = () => {
    setWeekStart(startOfWeek(today));
    setSelected(dateKey(today));
  };

  const planTomorrow = () => {
    const tomorrow = addDays(today, 1);
    setMode('week');
    setWeekStart(startOfWeek(tomorrow));
    setSelected(dateKey(tomorrow));
    setEditing(true);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setDayMenu(null);
  };

  const startEditing = () => {
    setEditing(true);
    setDayMenu(null);
  };

  /** Back to the plain view — the default, and what a child should see. */
  const finishEditing = () => {
    setEditing(false);
    setMode('week');
    setDayMenu(null);
  };

  // ---------- render ----------

  const kid = kidQuery.data?.data;
  if (kidQuery.isLoading || (agendaQuery.isLoading && !agendaQuery.data)) {
    return <div className="ag-page"><div className="ag-loading">טוען את סדר היום…</div></div>;
  }
  if (!kid) {
    return <div className="ag-page"><div className="ag-loading">הילד לא נמצא.</div></div>;
  }

  const avatarUrl = kid.imageName
    ? (kid.imageName.startsWith('data:') ? kid.imageName : `${BASE}${kid.imageName}`)
    : DEFAULT_AVATAR;

  const routineEmpty = Object.values(agenda.routine).every(
    (plan) => !plan || PERIODS.every((p) => !plan[p]?.length)
  );
  const nothingPlanned =
    routineEmpty && Object.values(agenda.days).every((d) => !d.items || PERIODS.every((p) => !d.items![p].length));

  const isRoutine = mode === 'routine';
  const canEdit = editing || isRoutine;
  const thisWeek = dateKey(weekStart) === dateKey(startOfWeek(today));

  // SVG chevrons, not ‹ › characters: those are bidi-mirrored and flip in RTL text
  const weekNav = (
    <div className="ag-weeknav">
      <button type="button" className="ag-weekbtn" onClick={() => goWeek(-1)}>
        <Chevron dir="right" /> שבוע קודם
      </button>
      <button type="button" className="ag-week-label" onClick={goToday} disabled={thisWeek}>
        {thisWeek ? 'השבוע' : weekRangeLabel(weekStart)}
        {!thisWeek && <span className="ag-today-link">חזרה להיום</span>}
      </button>
      <button type="button" className="ag-weekbtn" onClick={() => goWeek(1)}>
        שבוע הבא <Chevron dir="left" />
      </button>
    </div>
  );
  const todayKey = dateKey(today);
  const tomorrowKey = dateKey(addDays(today, 1));
  const eveningNow = today.getHours() >= 16;
  const selectedCol = columns.find((c) => c.key === selected) || columns[0];
  const menuCol = dayMenu ? colByKey(dayMenu) : undefined;

  const cardProps = {
    canEdit,
    desktop,
    onToggle: toggleDone,
    onEdit: (col: Column, period: AgendaPeriod, item: AgendaItem) =>
      setSheet({ col: col.key, period, item }),
    onMove: moveItem,
    onRemove: removeItem,
  };

  return (
    <div className="ag-page" dir="rtl">
      {/* Rail — desktop only; the phone gets a compact top bar instead */}
      <aside className="ag-rail">
        <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="ag-rail-logo" />
        <Link to={links.kidDetail(kidId!)} className="ag-rail-item">
          <span className="ag-rail-icon">🏠</span>
          <span>{kid.name}</span>
        </Link>
        <button
          type="button"
          className={`ag-rail-item ${!isRoutine ? 'active' : ''}`}
          onClick={finishEditing}
        >
          <span className="ag-rail-icon">📅</span>
          <span>סדר יום</span>
        </button>
        <button
          type="button"
          className={`ag-rail-item ${isRoutine ? 'active' : ''}`}
          onClick={() => { setEditing(true); switchMode('routine'); }}
        >
          <span className="ag-rail-icon">🔁</span>
          <span>שגרה קבועה</span>
        </button>
      </aside>

      <main className="ag-main">
        {/* Phone top bar */}
        <div className="ag-topbar">
          <Link to={links.kidDetail(kidId!)} className="ag-icon-btn" aria-label="חזרה">→</Link>
          <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="ag-topbar-logo" />
          {canEdit ? (
            <button type="button" className="ag-finish-pill" onClick={finishEditing}>✓ סיום</button>
          ) : (
            <button type="button" className="ag-icon-btn" aria-label="עריכת סדר היום" onClick={startEditing}>
              <PencilIcon />
            </button>
          )}
        </div>

        <header className="ag-header">
          <div className="ag-title">
            <img
              src={avatarUrl}
              alt=""
              className="ag-avatar"
              onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
            />
            <h1>{isRoutine ? `השגרה הקבועה של ${kid.name}` : `סדר היום של ${kid.name}`}</h1>
          </div>

          <div className="ag-actions">
            {!isRoutine && weekNav}
            {canEdit ? (
              <button type="button" className="ag-edit-btn primary" onClick={finishEditing}>
                ✓ סיום עריכה
              </button>
            ) : (
              <button type="button" className="ag-edit-btn" onClick={startEditing}>
                <PencilIcon /> עריכה
              </button>
            )}
          </div>
        </header>

        {/* Phones: which plan is being edited. Only exists while editing. */}
        {canEdit && (
          <div className="ag-modebar" role="tablist">
            <button type="button" role="tab" aria-selected={!isRoutine} className={!isRoutine ? 'active' : ''} onClick={() => switchMode('week')}>
              📅 ימים בשבוע
            </button>
            <button type="button" role="tab" aria-selected={isRoutine} className={isRoutine ? 'active' : ''} onClick={() => switchMode('routine')}>
              🔁 שגרה קבועה
            </button>
          </div>
        )}

        {isRoutine && (
          <div className="ag-note">
            <span>🔁 השבוע הרגיל — כל יום שלא שיניתם יוצג לפיו</span>
            <span className="ag-note-actions">
              {routineEmpty ? (
                <button type="button" className="ag-empty-btn" onClick={() => saveRoutine.mutate(starterRoutine())}>
                  ✨ שבוע לדוגמה
                </button>
              ) : (
                <button
                  type="button"
                  className="ag-empty-btn danger"
                  onClick={() =>
                    setConfirm({
                      text: 'למחוק את כל השגרה הקבועה? ימים ששיניתם בנפרד יישארו כמו שהם.',
                      action: 'מחיקת השגרה',
                      run: () => saveRoutine.mutate(Object.fromEntries(DAY_NAMES.map((_, d) => [d, emptyPlan()]))),
                    })
                  }
                >
                  🧹 ניקוי השגרה
                </button>
              )}
            </span>
          </div>
        )}

        {!isRoutine && !editing && eveningNow && selected === todayKey && !desktop && (
          <button type="button" className="ag-plan-tomorrow" onClick={planTomorrow}>
            🌙 בואו נתכנן יחד את מחר
          </button>
        )}


        {desktop ? (
          /* ---------------- desktop: week grid ---------------- */
          <div className="ag-grid" style={{ opacity: agendaQuery.isFetching && !agendaQuery.isFetched ? 0.6 : 1 }}>
            <div className="ag-grid-corner" />
            {columns.map((col) => {
              const isToday = col.key === todayKey;
              return (
                <div key={col.key} className={`ag-dayhead ${isToday ? 'today' : ''}`}>
                  <button
                    type="button"
                    className="ag-dayhead-btn"
                    disabled={!editing || !col.date}
                    onClick={() => setDayMenu(dayMenu === col.key ? null : col.key)}
                    title={editing && col.date ? 'העתקה וניקוי' : DAY_NAMES[col.weekday]}
                  >
                    <span className="ag-dayletter" style={{ background: DAY_COLORS[col.weekday] }}>
                      {DAY_LETTERS[col.weekday]}
                    </span>
                    <span className="ag-daydate">
                      {col.date ? (isToday ? 'היום' : col.key === tomorrowKey ? 'מחר' : shortDate(col.date)) : DAY_NAMES[col.weekday]}
                      {col.date && isCustom(col.key) && <span className="ag-custom-dot" title="שונה מהשגרה" />}
                    </span>
                  </button>
                </div>
              );
            })}

            {PERIODS.map((period) => (
              <div key={period} className={`ag-band ag-${period}`}>
                <div className="ag-band-label">
                  <span className="ag-band-name">{PERIOD_META[period].label}</span>
                  <span className="ag-band-icon">{PERIOD_META[period].icon}</span>
                </div>
                {columns.map((col) => {
                  const items = planFor(col)[period];
                  const done = doneFor(col);
                  return (
                    <div
                      key={col.key}
                      className={`ag-cell ${col.key === todayKey ? 'today' : ''} ${drag ? 'droppable' : ''}`}
                      onDragOver={(e) => { if (drag) e.preventDefault(); }}
                      onDrop={(e) => { e.preventDefault(); dropOn(col, period, null); }}
                    >
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={`ag-card ${done.has(item.id) ? 'done' : ''} ${canEdit ? 'editable' : ''}`}
                          draggable={canEdit}
                          onDragStart={() => setDrag({ col: col.key, period, id: item.id })}
                          onDragEnd={() => setDrag(null)}
                          onDragOver={(e) => { if (drag) e.preventDefault(); }}
                          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropOn(col, period, item.id); }}
                          onClick={() =>
                            canEdit ? setSheet({ col: col.key, period, item }) : toggleDone(col, item.id)
                          }
                          role="button"
                          tabIndex={0}
                          aria-pressed={!canEdit ? done.has(item.id) : undefined}
                        >
                          <span className="ag-card-title">{item.title}</span>
                          <span className="ag-card-icon">{item.icon}</span>
                          {item.time && <span className="ag-card-time">{item.time}</span>}
                          {done.has(item.id) && !canEdit && <span className="ag-check">✓</span>}
                          {canEdit && (
                            <button
                              type="button"
                              className="ag-card-x"
                              aria-label="הסרה"
                              onClick={(e) => { e.stopPropagation(); removeItem(col, period, item.id); }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      {canEdit && (
                        <button
                          type="button"
                          className="ag-add"
                          onClick={() => setSheet({ col: col.key, period, item: null })}
                        >
                          + הוספה
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          /* ---------------- phone: one day ---------------- */
          <>
            {!isRoutine && <div className="ag-weeknav-row">{weekNav}</div>}
            <div className="ag-strip">
              <div className="ag-strip-days">
                {columns.map((col) => {
                  const active = col.key === selectedCol.key;
                  return (
                    <button
                      key={col.key}
                      type="button"
                      className={`ag-chip ${active ? 'active' : ''} ${col.key === todayKey ? 'today' : ''}`}
                      onClick={() => setSelected(col.key)}
                    >
                      <span className="ag-chip-letter">{DAY_LETTERS[col.weekday]}</span>
                      <span className="ag-chip-date">
                        {col.date ? (active ? shortDate(col.date, true) : col.date.getDate()) : ''}
                      </span>
                      {col.date && isCustom(col.key) && <span className="ag-custom-dot" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="ag-day-caption">
              <span className="ag-day-caption-text">
                {selectedCol.date ? (
                  <>
                    {selectedCol.key === todayKey && <span className="ag-day-rel">היום ·</span>}
                    {selectedCol.key === tomorrowKey && <span className="ag-day-rel">מחר ·</span>}
                    {`${DAY_NAMES[selectedCol.weekday]}, ${shortDate(selectedCol.date, true)}`}
                  </>
                ) : (
                  `שגרה של יום ${DAY_NAMES[selectedCol.weekday]}`
                )}
              </span>
              {/* Viewing: whether the day follows the routine. Editing: what you can do to it. */}
              {!editing && selectedCol.date && !isCustom(selectedCol.key) && !routineEmpty && (
                <span className="ag-follows">לפי השגרה</span>
              )}
              {editing && selectedCol.date && (
                <button type="button" className="ag-weekbtn ag-day-menu-btn" onClick={() => setDayMenu(selectedCol.key)}>
                  העתקה וניקוי <ChevronDown />
                </button>
              )}
            </div>

            <div className="ag-sections">
              {PERIODS.map((period) => {
                const items = planFor(selectedCol)[period];
                const done = doneFor(selectedCol);
                return (
                  <section key={period} className={`ag-section ag-${period}`}>
                    <div className="ag-section-label">
                      <span className="ag-band-icon">{PERIOD_META[period].icon}</span>
                      <span className="ag-band-name">{PERIOD_META[period].label}</span>
                    </div>
                    <div className="ag-rows">
                      {items.length === 0 && !canEdit && <div className="ag-row-empty">אין פעילויות</div>}
                      {items.map((item, i) => (
                        <AgendaRow
                          key={item.id}
                          item={item}
                          done={done.has(item.id)}
                          first={i === 0}
                          last={i === items.length - 1}
                          col={selectedCol}
                          period={period}
                          {...cardProps}
                        />
                      ))}
                      {canEdit && (
                        <button
                          type="button"
                          className="ag-add"
                          onClick={() => setSheet({ col: selectedCol.key, period, item: null })}
                        >
                          + הוספת פעילות
                        </button>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}

        {!canEdit && !nothingPlanned && Object.values(agenda.days).every((d) => !d.done.length) && (
          <p className="ag-hint">לחיצה על פעילות מסמנת שהיא בוצעה ✓</p>
        )}
        {editing && !isRoutine && desktop && (
          <p className="ag-hint">גררו כרטיס כדי להזיז אותו · לחיצה על שם היום פותחת העתקה וניקוי</p>
        )}
      </main>

      {confirm && (
        <div className="ag-backdrop" onClick={() => setConfirm(null)}>
          <div className="ag-menu" role="alertdialog" onClick={(e) => e.stopPropagation()}>
            <div className="ag-menu-title">{confirm.text}</div>
            <div className="ag-sheet-actions">
              <button
                type="button"
                className="ag-edit-btn danger"
                onClick={() => { confirm.run(); setConfirm(null); }}
              >
                {confirm.action}
              </button>
              <button type="button" className="ag-edit-btn ghost" onClick={() => setConfirm(null)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {menuCol && (
        <div className="ag-backdrop" onClick={() => setDayMenu(null)}>
          <div className="ag-menu" onClick={(e) => e.stopPropagation()}>
            <div className="ag-menu-title">
              העתקה וניקוי · {DAY_NAMES[menuCol.weekday]} {menuCol.date ? shortDate(menuCol.date, true) : ''}
            </div>
            {dayActions(menuCol).map((a) => (
              <button
                key={a.label}
                type="button"
                className={`ag-menu-item ${a.danger ? 'danger' : ''}`}
                onClick={() => { a.run(); setDayMenu(null); }}
              >
                <span>{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {sheet && (
        <AgendaItemSheet
          target={sheet}
          onSave={handleSheetSave}
          onDelete={handleSheetDelete}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

function AgendaRow({
  item,
  done,
  first,
  last,
  col,
  period,
  canEdit,
  onToggle,
  onEdit,
  onMove,
}: {
  item: AgendaItem;
  done: boolean;
  first: boolean;
  last: boolean;
  col: Column;
  period: AgendaPeriod;
  canEdit: boolean;
  desktop: boolean;
  onToggle: (col: Column, id: string) => void;
  onEdit: (col: Column, period: AgendaPeriod, item: AgendaItem) => void;
  onMove: (col: Column, period: AgendaPeriod, id: string, delta: number) => void;
  onRemove: (col: Column, period: AgendaPeriod, id: string) => void;
}) {
  return (
    <div
      className={`ag-row ${done ? 'done' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={!canEdit ? done : undefined}
      onClick={() => (canEdit ? onEdit(col, period, item) : onToggle(col, item.id))}
    >
      <span className="ag-row-title">
        {item.title}
        {item.time && <span className="ag-row-time">{item.time}</span>}
      </span>
      {canEdit ? (
        <span className="ag-row-move" onClick={(e) => e.stopPropagation()}>
          <button type="button" disabled={first} onClick={() => onMove(col, period, item.id, -1)} aria-label="למעלה">▲</button>
          <button type="button" disabled={last} onClick={() => onMove(col, period, item.id, 1)} aria-label="למטה">▼</button>
        </span>
      ) : null}
      <span className="ag-row-icon">
        {item.icon}
        {done && <span className="ag-check">✓</span>}
      </span>
    </div>
  );
}

function clonePlan(plan: AgendaDayPlan): AgendaDayPlan {
  return {
    morning: [...(plan.morning || [])],
    noon: [...(plan.noon || [])],
    evening: [...(plan.evening || [])],
  };
}

function withFreshIds(plan: AgendaDayPlan): AgendaDayPlan {
  const out = emptyPlan();
  for (const p of PERIODS) out[p] = (plan[p] || []).map((i) => ({ ...i, id: newItemId() }));
  return out;
}

function insertBefore(list: AgendaItem[], item: AgendaItem, beforeId: string | null) {
  const at = beforeId ? list.findIndex((i) => i.id === beforeId) : -1;
  if (at >= 0) list.splice(at, 0, item);
  else list.push(item);
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === 'right' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
