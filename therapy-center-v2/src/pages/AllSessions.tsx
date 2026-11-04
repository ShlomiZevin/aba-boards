import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, endOfWeek, addDays, subMonths, addMonths, isSameDay, isSameMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import { kidsApi, sessionsApi, practitionersApi } from '../api/client';
import type { Kid, Practitioner, Session, SessionType, SessionStatus } from '../types';
import { toDate } from '../utils/date';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import Icon from '../v2/Icon';
import KidAvatar from '../v2/KidAvatar';
import { kidColor } from '../v2/kidColor';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '../v2/pages/cm.css';

const TYPE_LABEL: Record<SessionType, string> = { therapy: 'טיפול', guidance: 'הדרכה', meeting: 'ישיבה' };
const STATUS_INFO: Record<SessionStatus, { label: string; tone: string }> = {
  scheduled: { label: 'מתוכנן', tone: 'sky' },
  pending_form: { label: 'חסר טופס', tone: 'pink' },
  completed: { label: 'הושלם', tone: 'mint' },
  missed: { label: 'לא התקיים', tone: 'peach' },
};

/** Marker tone for a session: the kid's own colour, or a stable one for free-text events. */
function sessionTone(s: Session): string {
  if (s.kidId) return kidColor(s.kidId);
  return kidColor((s.customTitle || s.title || '').trim().toLowerCase() || null);
}

const locales = { he };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

const HE_DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const HE_DAY_LETTER = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const calendarFormats = {
  weekdayFormat: (date: Date) => HE_DAY_SHORT[date.getDay()],
  monthHeaderFormat: (date: Date) => `${HE_MONTHS[date.getMonth()]} ${date.getFullYear()}`,
};

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  desc: string;
  start: Date;
  end: Date;
  resource: Session;
}

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar);

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function relativeDayLabel(d: Date) {
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  const full = format(d, 'EEEE d/M', { locale: he });
  if (diffDays === 0) return `היום · ${full}`;
  if (diffDays === 1) return `מחר · ${full}`;
  if (diffDays === -1) return `אתמול · ${full}`;
  return full;
}

/* ── one notebook row: time · avatar · who/what · status sticker · delete ── */

interface RowCtx {
  kidMap: Record<string, Kid>;
  therapistMap: Record<string, Practitioner>;
  onTap: (s: Session) => void;
  onDelete: (s: Session) => void;
}

function SessionRow({ s, ctx, past }: { s: Session; ctx: RowCtx; past?: boolean }) {
  const d = toDate(s.scheduledDate);
  const kid = s.kidId ? ctx.kidMap[s.kidId] : undefined;
  const name = s.kidId ? (kid?.name || s.kidId) : (s.customTitle || '');
  const therapistName = s.therapistId ? (ctx.therapistMap[s.therapistId]?.name || '') : '';
  const type = s.type || 'therapy';
  const status = STATUS_INFO[s.status] || STATUS_INFO.scheduled;
  const sub = [TYPE_LABEL[type], therapistName && type !== 'meeting' ? therapistName : ''].filter(Boolean).join(' · ');
  return (
    <li className={`cm-row${past ? ' is-past' : ''}`}>
      <button type="button" className="cm-row-main" onClick={() => ctx.onTap(s)}>
        <span className="cm-row-time tabular">{format(d, 'HH:mm')}</span>
        {kid
          ? <KidAvatar kid={kid} size="sm" />
          : <span className={`nb-av sm tone-${sessionTone(s)}`} aria-hidden="true">
              {name ? name.charAt(0) : <Icon name={type === 'meeting' ? 'team' : 'calendar'} size={16} />}
            </span>}
        <span className="cm-row-what">
          <b>{name || s.title || 'אירוע'}{name && s.title ? <small> · {s.title}</small> : null}</b>
          <span>{sub}</span>
        </span>
        <span className={`cm-status tone-${status.tone}`}>{status.label}</span>
      </button>
      <button type="button" className="cm-row-del" onClick={() => ctx.onDelete(s)} aria-label="בטל פגישה" title="בטל פגישה">
        <Icon name="trash" size={18} />
      </button>
    </li>
  );
}

function DayRows({ sessions, ctx, past, emptyAction }: { sessions: Session[]; ctx: RowCtx; past?: boolean; emptyAction?: () => void }) {
  if (sessions.length === 0) {
    return (
      <div className="cm-empty">
        <p className="hand">יום פנוי ביומן</p>
        {emptyAction && (
          <button type="button" className="nb-btn-ghost sm" onClick={emptyAction}>
            <Icon name="plus" size={16} /> פגישה ביום הזה
          </button>
        )}
      </div>
    );
  }
  const sorted = [...sessions].sort((a, b) => toDate(a.scheduledDate).getTime() - toDate(b.scheduledDate).getTime());
  return (
    <ol className="cm-rows">
      {sorted.map(s => <SessionRow key={s.id} s={s} ctx={ctx} past={past} />)}
    </ol>
  );
}

/* ── week strip: seven day bubbles ── */

function WeekStrip({ selectedDay, onSelect, byDay }: {
  selectedDay: Date;
  onSelect: (d: Date) => void;
  byDay: Record<string, Session[]>;
}) {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(selectedDay, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];
  const title = weekStart.getMonth() === weekEnd.getMonth()
    ? `${HE_MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`
    : `${HE_MONTHS[weekStart.getMonth()]} – ${HE_MONTHS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
  return (
    <div className="cm-week">
      <div className="cm-nav">
        <button type="button" className="cm-nav-btn" onClick={() => onSelect(addDays(selectedDay, -7))} aria-label="שבוע קודם"><Icon name="back" size={20} /></button>
        <b className="cm-nav-title">{title}</b>
        <button type="button" className="cm-nav-btn" onClick={() => onSelect(addDays(selectedDay, 7))} aria-label="שבוע הבא"><Icon name="chevron" size={20} /></button>
      </div>
      <div className="cm-bubbles" role="tablist" aria-label="ימי השבוע">
        {days.map(d => {
          const list = byDay[dayKey(d)] || [];
          const sel = isSameDay(d, selectedDay);
          return (
            <button
              key={dayKey(d)}
              type="button"
              role="tab"
              aria-selected={sel}
              className={`cm-bubble${sel ? ' is-sel' : ''}${isSameDay(d, today) ? ' is-today' : ''}`}
              onClick={() => onSelect(startOfDay(d))}
            >
              <span className="cm-bubble-l">{HE_DAY_LETTER[d.getDay()]}</span>
              <span className="cm-bubble-n tabular">{d.getDate()}</span>
              <span className="cm-dots">
                {list.slice(0, 3).map(s => <i key={s.id} className={`nb-dot tone-${sessionTone(s)}`} />)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── month grid for phones (desktop uses the drag-and-drop month) ── */

function MobileMonthCalendar({ date, onDateChange, selectedDay, onSelect, byDay }: {
  date: Date;
  onDateChange: (d: Date) => void;
  selectedDay: Date;
  onSelect: (d: Date) => void;
  byDay: Record<string, Session[]>;
}) {
  const today = startOfDay(new Date());
  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(date), { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(date), { weekStartsOn: 0 });
    const out: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [date]);

  return (
    <div className="cm-month">
      <div className="cm-nav">
        <button type="button" className="cm-nav-btn" onClick={() => onDateChange(subMonths(date, 1))} aria-label="חודש קודם"><Icon name="back" size={20} /></button>
        <b className="cm-nav-title">{HE_MONTHS[date.getMonth()]} {date.getFullYear()}</b>
        <button type="button" className="cm-nav-btn" onClick={() => onDateChange(addMonths(date, 1))} aria-label="חודש הבא"><Icon name="chevron" size={20} /></button>
      </div>
      <div className="cm-mgrid cm-mgrid-head">
        {HE_DAY_LETTER.map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="cm-mgrid">
        {days.map(d => {
          const list = byDay[dayKey(d)] || [];
          return (
            <button
              key={dayKey(d)}
              type="button"
              className={`cm-mday${!isSameMonth(d, date) ? ' is-other' : ''}${isSameDay(d, today) ? ' is-today' : ''}${isSameDay(d, selectedDay) ? ' is-sel' : ''}`}
              onClick={() => onSelect(startOfDay(d))}
            >
              <span className="cm-mday-n tabular">{d.getDate()}</span>
              <span className="cm-dots">
                {list.slice(0, 3).map(s => <i key={s.id} className={`nb-dot tone-${sessionTone(s)}`} />)}
                {list.length > 3 && <em>+{list.length - 3}</em>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── list view: upcoming days, past days folded ── */

function AgendaList({ sessions, ctx }: { sessions: Session[]; ctx: RowCtx }) {
  const today = startOfDay(new Date());
  const groups = useMemo(() => {
    const upcoming: Session[] = [];
    const past: Session[] = [];
    for (const s of sessions) {
      if (toDate(s.scheduledDate) >= today) upcoming.push(s);
      else past.push(s);
    }
    upcoming.sort((a, b) => toDate(a.scheduledDate).getTime() - toDate(b.scheduledDate).getTime());
    past.sort((a, b) => toDate(b.scheduledDate).getTime() - toDate(a.scheduledDate).getTime());
    function groupByDay(list: Session[]) {
      const byDay: Record<string, { date: Date; sessions: Session[] }> = {};
      for (const s of list) {
        const d = toDate(s.scheduledDate);
        const k = dayKey(d);
        if (!byDay[k]) byDay[k] = { date: startOfDay(d), sessions: [] };
        byDay[k].sessions.push(s);
      }
      return Object.values(byDay);
    }
    return { upcoming: groupByDay(upcoming), past: groupByDay(past) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);
  const [showPast, setShowPast] = useState(false);

  if (sessions.length === 0) return <div className="cm-empty"><p className="hand">אין פגישות להצגה</p></div>;

  return (
    <div className="cm-agenda">
      {groups.upcoming.length === 0 && <div className="cm-empty"><p className="hand">אין פגישות קרובות</p></div>}
      {groups.upcoming.map(g => (
        <section key={`u-${dayKey(g.date)}`} className="cm-day">
          <h3 className="cm-day-title">{relativeDayLabel(g.date)}</h3>
          <DayRows sessions={g.sessions} ctx={ctx} />
        </section>
      ))}
      {groups.past.length > 0 && (
        <>
          <button type="button" className="nb-btn-ghost cm-past-toggle" onClick={() => setShowPast(v => !v)}>
            {showPast ? 'הסתר פגישות שעברו' : `הצג פגישות שעברו (${groups.past.reduce((n, g) => n + g.sessions.length, 0)})`}
          </button>
          {showPast && groups.past.map(g => (
            <section key={`p-${dayKey(g.date)}`} className="cm-day is-past">
              <h3 className="cm-day-title">{relativeDayLabel(g.date)}</h3>
              <DayRows sessions={g.sessions} ctx={ctx} past />
            </section>
          ))}
        </>
      )}
    </div>
  );
}

type CalView = 'week' | 'month' | 'list';

export default function AllSessions() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const myId = user?.adminId || '';
  const [searchParams, setSearchParams] = useSearchParams();
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()));
  const [onlyMine, setOnlyMine] = useState(true);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900);
  const [view, setView] = useState<CalView>(() => (typeof window !== 'undefined' && window.innerWidth >= 900 ? 'month' : 'week'));
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { data: kidsRes } = useQuery({ queryKey: ['kids'], queryFn: () => kidsApi.getAll() });
  const { data: sessionsRes, isLoading } = useQuery({
    queryKey: ['all-sessions'],
    queryFn: () => sessionsApi.getAll(),
  });
  const { data: therapistsRes } = useQuery({
    queryKey: ['my-therapists'],
    queryFn: () => practitionersApi.getMyTherapists(),
  });

  const kids: Kid[] = kidsRes?.data || [];
  const sessions: Session[] = sessionsRes?.data || [];
  const therapists: Practitioner[] = therapistsRes?.data || [];

  const kidMap = useMemo(() => {
    const m: Record<string, Kid> = {};
    for (const k of kids) m[k.id] = k;
    return m;
  }, [kids]);
  const kidByName = useMemo(() => {
    const m: Record<string, Kid> = {};
    for (const k of kids) m[k.name.trim().toLowerCase()] = k;
    return m;
  }, [kids]);
  const therapistMap = useMemo(() => {
    const m: Record<string, Practitioner> = {};
    for (const t of therapists) m[t.id] = t;
    return m;
  }, [therapists]);

  const scheduleMutation = useMutation({
    mutationFn: (data: {
      scheduledDate: string;
      kidId?: string;
      customTitle?: string;
      notes?: string;
      therapistId?: string;
      type?: SessionType;
      until?: string;
    }) => sessionsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-sessions'] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Session> }) => sessionsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-sessions'] });
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['forms'] });
      qc.invalidateQueries({ queryKey: ['form'] });
      qc.invalidateQueries({ queryKey: ['meetingForms'] });
      qc.invalidateQueries({ queryKey: ['meetingForm'] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-sessions'] }),
  });

  const visibleSessions = useMemo(() => {
    if (!onlyMine) return sessions;
    // "Only mine" for the admin = her own therapy + guidance sessions + all meetings + admin-owned custom
    return sessions.filter(s =>
      s.type === 'meeting' ||
      s.therapistId === myId ||
      s.adminId === myId
    );
  }, [sessions, onlyMine, myId]);

  const sessionsByDay = useMemo(() => {
    const m: Record<string, Session[]> = {};
    for (const s of visibleSessions) {
      const k = dayKey(toDate(s.scheduledDate));
      (m[k] ||= []).push(s);
    }
    for (const k in m) m[k].sort((a, b) => toDate(a.scheduledDate).getTime() - toDate(b.scheduledDate).getTime());
    return m;
  }, [visibleSessions]);

  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return visibleSessions.map(s => {
      const start = toDate(s.scheduledDate);
      const end = new Date(start.getTime() + 45 * 60000);
      const time = format(start, 'HH:mm');
      const therapistName = s.therapistId ? (therapistMap[s.therapistId]?.name || '') : '';
      const kidName = s.kidId ? (kidMap[s.kidId]?.name || s.kidId) : (s.customTitle || '');
      const titlePart = s.title ? ` · ${s.title}` : '';
      const therapistPart = therapistName && s.type !== 'meeting' ? ` · ${therapistName.split(' ')[0]}` : '';
      const base = kidName || s.title || 'אירוע';
      const desc = kidName ? `${kidName}${titlePart}${therapistPart}` : `${base}${therapistPart}`;
      return { id: s.id, title: `${time} ${desc}`, time, desc, start, end, resource: s };
    });
  }, [visibleSessions, kidMap, therapistMap]);

  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleKidText, setScheduleKidText] = useState(''); // matches existing kid OR free-text external
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDate, setScheduleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [scheduleTherapist, setScheduleTherapist] = useState('');
  const [scheduleType, setScheduleType] = useState<SessionType>('therapy');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleRecurring, setScheduleRecurring] = useState(false);
  const [scheduleUntil, setScheduleUntil] = useState('');

  const [editSession, setEditSession] = useState<Session | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editTherapist, setEditTherapist] = useState('');
  const [editType, setEditType] = useState<SessionType>('therapy');
  const [editKidText, setEditKidText] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);

  function resolveKid(text: string): { kidId?: string; customTitle?: string } {
    const trimmed = text.trim();
    if (!trimmed) return {};
    const match = kidByName[trimmed.toLowerCase()];
    if (match) return { kidId: match.id };
    return { customTitle: trimmed };
  }

  function openSchedule(date?: Date) {
    const d = date || new Date();
    setScheduleDate(format(d, 'yyyy-MM-dd'));
    setScheduleTime(format(d, 'HH:mm') === '00:00' ? '10:00' : format(d, 'HH:mm'));
    setScheduleKidText('');
    setScheduleTitle('');
    setScheduleTherapist(onlyMine ? myId : '');
    setScheduleType('therapy');
    setScheduleNotes('');
    setScheduleRecurring(false);
    setScheduleUntil('');
    setShowSchedule(true);
  }

  function openEdit(s: Session) {
    const d = toDate(s.scheduledDate);
    setEditSession(s);
    setEditDate(format(d, 'yyyy-MM-dd'));
    setEditTime(format(d, 'HH:mm'));
    setEditTherapist(s.therapistId || '');
    setEditType(s.type || 'therapy');
    const currentText = s.kidId ? (kidMap[s.kidId]?.name || '') : (s.customTitle || '');
    setEditKidText(currentText);
    setEditTitle(s.title || '');
    setEditNotes(s.notes || '');
  }

  function submitSchedule(e: React.FormEvent) {
    e.preventDefault();
    const resolved = resolveKid(scheduleKidText);
    const title = scheduleTitle.trim();
    // need at least one of: kid (existing or custom) or title
    if (!resolved.kidId && !resolved.customTitle && !title) return;
    const scheduledDate = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    const payload: {
      scheduledDate: string;
      kidId?: string;
      customTitle?: string;
      title?: string;
      notes?: string;
      therapistId?: string;
      type?: SessionType;
      until?: string;
    } = {
      scheduledDate,
      type: scheduleType,
      therapistId: scheduleType !== 'meeting' ? (scheduleTherapist || undefined) : undefined,
      notes: scheduleNotes.trim() || undefined,
      title: title || undefined,
      ...resolved,
    };
    if (scheduleRecurring && scheduleUntil) {
      payload.until = new Date(`${scheduleUntil}T23:59:59`).toISOString();
    }
    scheduleMutation.mutate(payload, {
      onSuccess: () => setShowSchedule(false),
    });
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editSession) return;
    const resolved = resolveKid(editKidText);
    const title = editTitle.trim();
    if (!resolved.kidId && !resolved.customTitle && !title) return;
    const scheduledDate = new Date(`${editDate}T${editTime}:00`).toISOString();
    updateMutation.mutate({
      id: editSession.id,
      data: {
        scheduledDate: scheduledDate as unknown as Date,
        therapistId: editType !== 'meeting' ? (editTherapist || undefined) : undefined,
        type: editType,
        kidId: (resolved.kidId || null) as unknown as string,
        customTitle: resolved.kidId ? null : (resolved.customTitle || null),
        title: title || null,
        notes: editNotes.trim() || null,
      } as unknown as Partial<Session>,
    }, {
      onSuccess: () => setEditSession(null),
    });
  }

  // Quick-add (centre pen button) links here with ?new=1 — open the scheduling sheet straight away.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openSchedule();
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function selectDay(d: Date) {
    setSelectedDay(d);
    if (!isSameMonth(d, calendarDate)) setCalendarDate(d);
  }
  function goToday() {
    const t = startOfDay(new Date());
    setSelectedDay(t);
    setCalendarDate(t);
  }

  function renderTypeToggle(value: SessionType, onChange: (t: SessionType) => void) {
    const types: { key: SessionType; label: string }[] = [
      { key: 'therapy', label: 'טיפול' },
      { key: 'guidance', label: 'הדרכה' },
      { key: 'meeting', label: 'ישיבה' },
    ];
    return (
      <div className="cm-seg cm-seg-block" role="radiogroup">
        {types.map(t => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={value === t.key}
            className={value === t.key ? 'is-on' : ''}
            onClick={() => onChange(t.key)}
          >{t.label}</button>
        ))}
      </div>
    );
  }

  const rowCtx: RowCtx = { kidMap, therapistMap, onTap: openEdit, onDelete: setSessionToDelete };
  const selectedList = sessionsByDay[dayKey(selectedDay)] || [];
  const showDndMonth = view === 'month' && isDesktop;
  const showPhoneMonth = view === 'month' && !isDesktop;

  return (
    <div className="cm-cal">
      <header className="cm-head">
        <div className="cm-head-title">
          <h1 className="nb-h1"><mark className="hl-mint">יומן</mark></h1>
          <p className="nb-muted">{onlyMine ? 'הפגישות שלי' : 'כל הפגישות של כל הילדים'}</p>
        </div>
        <button type="button" onClick={() => openSchedule(view === 'month' ? undefined : selectedDay)} className="nb-btn cm-head-add">
          <Icon name="plus" /> פגישה חדשה
        </button>
      </header>

      <div className="cm-controls">
        <div className="cm-seg" role="radiogroup" aria-label="תצוגה">
          {([
            { value: 'week', label: 'שבוע' },
            { value: 'month', label: 'חודש' },
            { value: 'list', label: 'רשימה' },
          ] as const).map(opt => (
            <button key={opt.value} type="button" role="radio" aria-checked={view === opt.value}
              className={view === opt.value ? 'is-on' : ''} onClick={() => setView(opt.value)}>{opt.label}</button>
          ))}
        </div>
        <div className="cm-seg" role="radiogroup" aria-label="סינון">
          {([
            { value: true, label: 'רק שלי' },
            { value: false, label: 'הכל' },
          ] as const).map(opt => (
            <button key={opt.label} type="button" role="radio" aria-checked={onlyMine === opt.value}
              className={onlyMine === opt.value ? 'is-on' : ''} onClick={() => setOnlyMine(opt.value)}>{opt.label}</button>
          ))}
        </div>
        {view !== 'list' && (
          <button type="button" className="nb-btn-ghost sm cm-today" onClick={goToday}>היום</button>
        )}
      </div>

      {isLoading ? (
        <p className="hand nb-muted cm-loading">טוען את היומן…</p>
      ) : (<>
        {view === 'week' && (
          <div className="cm-split">
            <WeekStrip selectedDay={selectedDay} onSelect={selectDay} byDay={sessionsByDay} />
            <section className="cm-day">
              <h2 className="cm-day-title">{relativeDayLabel(selectedDay)}</h2>
              <DayRows sessions={selectedList} ctx={rowCtx} emptyAction={() => openSchedule(selectedDay)} />
            </section>
          </div>
        )}

        {showPhoneMonth && (
          <div className="cm-split">
            <MobileMonthCalendar date={calendarDate} onDateChange={setCalendarDate} selectedDay={selectedDay} onSelect={selectDay} byDay={sessionsByDay} />
            <section className="cm-day">
              <h2 className="cm-day-title">{relativeDayLabel(selectedDay)}</h2>
              <DayRows sessions={selectedList} ctx={rowCtx} emptyAction={() => openSchedule(selectedDay)} />
            </section>
          </div>
        )}

        {showDndMonth && (
          <div className="cm-dnd">
            <DnDCalendar
              localizer={localizer}
              formats={calendarFormats}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              view="month"
              views={['month']}
              date={calendarDate}
              onNavigate={(d) => setCalendarDate(d)}
              rtl
              selectable
              draggableAccessor={() => true}
              onEventDrop={({ event, start }: { event: CalendarEvent; start: Date | string }) => {
                const session = event.resource;
                const oldDate = toDate(session.scheduledDate);
                const newStart = new Date(start);
                newStart.setHours(oldDate.getHours(), oldDate.getMinutes());
                updateMutation.mutate({
                  id: session.id,
                  data: { scheduledDate: newStart.toISOString() as unknown as Date },
                });
              }}
              onSelectSlot={(slot) => openSchedule(slot.start)}
              style={{ height: 680 }}
              components={{
                event: ({ event }) => {
                  const s = event.resource;
                  return (
                    <div
                      className="calendar-event cm-ev"
                      onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                    >
                      <span className="cm-ev-time tabular">{(event as CalendarEvent).time}</span>
                      <span className="cm-ev-desc">{(event as CalendarEvent).desc}</span>
                      {s.status === 'pending_form' && <span className="cm-ev-flag" title="חסר טופס" />}
                      <button
                        onClick={(e) => { e.stopPropagation(); setSessionToDelete(s); }}
                        className="calendar-event-delete"
                        title="בטל פגישה"
                        aria-label="בטל פגישה"
                      ><Icon name="close" size={12} strokeWidth={2.6} /></button>
                    </div>
                  );
                },
              }}
              eventPropGetter={(event) => ({
                className: `cm-ev-wrap tone-${sessionTone(event.resource)}`,
                style: { cursor: 'pointer' },
              })}
              messages={{ today: 'היום', previous: 'הקודם', next: 'הבא', month: 'חודש', showMore: (n: number) => `ועוד ${n}` }}
            />
          </div>
        )}

        {view === 'list' && <AgendaList sessions={visibleSessions} ctx={rowCtx} />}
      </>)}

      {/* Schedule modal */}
      {showSchedule && (
        <div className="modal-overlay" onClick={() => setShowSchedule(false)}>
          <div className="modal cm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cm-modal-title">פגישה <mark className="hl-mint">חדשה</mark></h3>
            <form onSubmit={submitSchedule}>
              <div className="form-group">
                <label>סוג פגישה</label>
                {renderTypeToggle(scheduleType, setScheduleType)}
              </div>
              <div className="cm-form-row">
                <div className="form-group">
                  <label>ילד/ה</label>
                  <input
                    type="text"
                    list="all-sessions-kids"
                    value={scheduleKidText}
                    onChange={(e) => setScheduleKidText(e.target.value)}
                    placeholder="בחר או הקלד שם"
                  />
                  <datalist id="all-sessions-kids">
                    {kids.map(k => <option key={k.id} value={k.name} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label>כותרת (לא חובה)</label>
                  <input
                    type="text"
                    value={scheduleTitle}
                    onChange={(e) => setScheduleTitle(e.target.value)}
                    placeholder="פגישת הורים, סופרוויז׳ן..."
                  />
                </div>
              </div>
              {scheduleType !== 'meeting' && (
                <div className="form-group">
                  <label>איש/ת צוות</label>
                  <select value={scheduleTherapist} onChange={(e) => setScheduleTherapist(e.target.value)}>
                    <option value="">—</option>
                    {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div className="cm-form-row">
                <div className="form-group">
                  <label>תאריך</label>
                  <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>שעה</label>
                  <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} required />
                </div>
              </div>
              <div className="cm-recur">
                <label className="cm-check">
                  <input
                    type="checkbox"
                    checked={scheduleRecurring}
                    onChange={(e) => setScheduleRecurring(e.target.checked)}
                  />
                  <span>חוזר כל שבוע</span>
                </label>
                {scheduleRecurring && (
                  <div className="form-group">
                    <label>עד תאריך</label>
                    <input
                      type="date"
                      value={scheduleUntil}
                      onChange={(e) => setScheduleUntil(e.target.value)}
                      min={scheduleDate}
                      required
                    />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>הערות (לא חובה)</label>
                <textarea
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowSchedule(false)} className="btn-secondary">ביטול</button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={scheduleMutation.isPending || (!scheduleKidText.trim() && !scheduleTitle.trim())}
                >
                  {scheduleMutation.isPending ? 'מתזמן...' : 'תזמן'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editSession && (() => {
        const resolved = resolveKid(editKidText);
        const linkKidId = resolved.kidId;
        return (
        <div className="modal-overlay" onClick={() => setEditSession(null)}>
          <div className="modal cm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cm-modal-title">עריכת פגישה</h3>
            <form onSubmit={submitEdit}>
              <div className="form-group">
                <label>סוג פגישה</label>
                {renderTypeToggle(editType, setEditType)}
              </div>
              <div className="cm-form-row">
                <div className="form-group">
                  <label>ילד/ה</label>
                  <input
                    type="text"
                    list="all-sessions-kids-edit"
                    value={editKidText}
                    onChange={(e) => setEditKidText(e.target.value)}
                    placeholder="בחר או הקלד שם"
                  />
                  <datalist id="all-sessions-kids-edit">
                    {kids.map(k => <option key={k.id} value={k.name} />)}
                  </datalist>
                  {linkKidId && (
                    <button type="button" className="cm-link" onClick={() => navigate(`/kid/${linkKidId}`)}>
                      פתח כרטיס ילד/ה <Icon name="chevron" size={14} />
                    </button>
                  )}
                </div>
                <div className="form-group">
                  <label>כותרת (לא חובה)</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
              </div>
              {editType !== 'meeting' && (
                <div className="form-group">
                  <label>איש/ת צוות</label>
                  <select value={editTherapist} onChange={(e) => setEditTherapist(e.target.value)}>
                    <option value="">—</option>
                    {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div className="cm-form-row">
                <div className="form-group">
                  <label>תאריך</label>
                  <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>שעה</label>
                  <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} required />
                </div>
              </div>
              <div className="form-group">
                <label>הערות</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setEditSession(null)} className="btn-secondary">ביטול</button>
                <button type="submit" className="btn-primary" disabled={updateMutation.isPending || (!editKidText.trim() && !editTitle.trim())}>
                  {updateMutation.isPending ? 'שומר...' : 'שמור'}
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      <button
        type="button"
        onClick={() => openSchedule(view === 'month' ? undefined : selectedDay)}
        className="cm-fab"
        aria-label="פגישה חדשה"
      ><Icon name="plus" size={28} strokeWidth={2.4} /></button>

      {sessionToDelete && (
        <ConfirmModal
          title="ביטול פגישה"
          message={`האם לבטל את הפגישה ${sessionToDelete.customTitle || (sessionToDelete.kidId ? kidMap[sessionToDelete.kidId]?.name : '') || ''} בתאריך ${format(toDate(sessionToDelete.scheduledDate), 'dd/MM/yyyy')}?`}
          confirmText="בטל פגישה"
          onConfirm={() => {
            deleteMutation.mutate(sessionToDelete.id, {
              onSuccess: () => setSessionToDelete(null),
            });
          }}
          onCancel={() => setSessionToDelete(null)}
        />
      )}
    </div>
  );
}
