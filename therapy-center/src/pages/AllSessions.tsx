import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, endOfWeek, addDays, subMonths, addMonths, isSameDay, isSameMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import { kidsApi, sessionsApi, practitionersApi } from '../api/client';
import type { Kid, Practitioner, Session, SessionType } from '../types';
import { toDate } from '../utils/date';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

// Per-kid color palette (vivid, distinct)
const KID_PALETTE = [
  '#0891b2', '#7c3aed', '#db2777', '#059669', '#d97706',
  '#2563eb', '#dc2626', '#65a30d', '#0d9488', '#9333ea',
  '#e11d48', '#0284c7', '#16a34a', '#ea580c', '#6366f1',
];
const EXTERNAL_COLOR = '#64748b'; // slate for non-kid events

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  return Math.abs(h);
}
function getColorForKey(key: string | null | undefined): string {
  if (!key) return EXTERNAL_COLOR;
  return KID_PALETTE[hashId(key) % KID_PALETTE.length];
}
function typeEmoji(type: SessionType | undefined): string {
  if (type === 'meeting') return '👥';
  if (type === 'guidance') return '🎓';
  return '🧩';
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

interface MobileAgendaListProps {
  sessions: Session[];
  kidMap: Record<string, Kid>;
  therapistMap: Record<string, Practitioner>;
  onTap: (s: Session) => void;
  onDelete: (s: Session) => void;
}

function MobileAgendaList({ sessions, kidMap, therapistMap, onTap, onDelete }: MobileAgendaListProps) {
  const today = startOfDay(new Date());

  const groups = useMemo(() => {
    // Partition: upcoming (today and future) vs past (before today)
    const upcoming: Session[] = [];
    const past: Session[] = [];
    for (const s of sessions) {
      const d = toDate(s.scheduledDate);
      if (d >= today) upcoming.push(s);
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
  }, [sessions, today]);

  const [showPast, setShowPast] = useState(false);

  if (sessions.length === 0) {
    return (
      <div className="as-list-view" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        אין פגישות להצגה
      </div>
    );
  }

  return (
    <div className="as-list-view" style={{ padding: '4px 10px 100px' }}>
      {groups.upcoming.length === 0 && (
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          אין פגישות קרובות
        </div>
      )}
      {groups.upcoming.map(g => (
        <DayGroup key={`u-${dayKey(g.date)}`} date={g.date} sessions={g.sessions} kidMap={kidMap} therapistMap={therapistMap} onTap={onTap} onDelete={onDelete} />
      ))}
      {groups.past.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowPast(v => !v)}
            style={{
              display: 'block',
              width: '100%',
              margin: '16px 0 10px',
              padding: '10px',
              background: '#f1f5f9',
              border: 'none',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            {showPast ? '▲ הסתר פגישות שעברו' : `▼ הצג פגישות שעברו (${groups.past.reduce((n, g) => n + g.sessions.length, 0)})`}
          </button>
          {showPast && groups.past.map(g => (
            <DayGroup key={`p-${dayKey(g.date)}`} date={g.date} sessions={g.sessions} kidMap={kidMap} therapistMap={therapistMap} onTap={onTap} onDelete={onDelete} past />
          ))}
        </>
      )}
    </div>
  );
}

function DayGroup({ date, sessions, kidMap, therapistMap, onTap, onDelete, past }: {
  date: Date;
  sessions: Session[];
  kidMap: Record<string, Kid>;
  therapistMap: Record<string, Practitioner>;
  onTap: (s: Session) => void;
  onDelete: (s: Session) => void;
  past?: boolean;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: past ? '#94a3b8' : '#334155',
        padding: '6px 4px',
        borderBottom: '1px solid #e2e8f0',
        marginBottom: 6,
      }}>{relativeDayLabel(date)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sessions.map(s => {
          const d = toDate(s.scheduledDate);
          const time = format(d, 'HH:mm');
          const kidName = s.kidId ? (kidMap[s.kidId]?.name || s.kidId) : (s.customTitle || '');
          const therapistName = s.therapistId ? (therapistMap[s.therapistId]?.name || '') : '';
          const emoji = typeEmoji(s.type);
          const colorKey = s.kidId
            ? (kidMap[s.kidId]?.name.trim().toLowerCase() || s.kidId)
            : (s.customTitle?.trim().toLowerCase() || s.title?.trim().toLowerCase() || null);
          const color = getColorForKey(colorKey);
          return (
            <div
              key={s.id}
              onClick={() => onTap(s)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRight: `4px solid ${color}`,
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                opacity: past ? 0.7 : 1,
              }}
            >
              <div style={{ minWidth: 48, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{time}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {emoji} {kidName || 'אירוע'}{s.title ? ` · ${s.title}` : ''}
                </div>
                {therapistName && s.type !== 'meeting' && (
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {therapistName}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(s); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#cbd5e1',
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: '4px 6px',
                }}
                aria-label="בטל פגישה"
              >✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MobileMonthCalendarProps {
  events: CalendarEvent[];
  date: Date;
  onDateChange: (d: Date) => void;
  onEventClick: (s: Session) => void;
  onSlotClick: (d: Date) => void;
  kidMap: Record<string, Kid>;
  therapistMap: Record<string, Practitioner>;
}

function MobileMonthCalendar({ events, date, onDateChange, onEventClick, onSlotClick, kidMap, therapistMap }: MobileMonthCalendarProps) {
  const today = startOfDay(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(today);

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

  const eventsByDay = useMemo(() => {
    const m: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      const k = dayKey(e.start);
      if (!m[k]) m[k] = [];
      m[k].push(e);
    }
    for (const k in m) m[k].sort((a, b) => a.start.getTime() - b.start.getTime());
    return m;
  }, [events]);

  const selectedKey = dayKey(selectedDay);
  const selectedEvents = eventsByDay[selectedKey] || [];

  return (
    <div className="mmc-root">
      <div className="mmc-toolbar">
        <button type="button" className="mmc-nav-btn" onClick={() => onDateChange(subMonths(date, 1))} aria-label="חודש קודם">‹</button>
        <div className="mmc-title">{HE_MONTHS[date.getMonth()]} {date.getFullYear()}</div>
        <button type="button" className="mmc-nav-btn" onClick={() => onDateChange(addMonths(date, 1))} aria-label="חודש הבא">›</button>
      </div>

      <button
        type="button"
        className="mmc-today-btn"
        onClick={() => { onDateChange(today); setSelectedDay(today); }}
      >היום</button>

      <div className="mmc-weekdays">
        {HE_DAY_SHORT.map(d => <div key={d} className="mmc-weekday">{d}</div>)}
      </div>

      <div className="mmc-grid">
        {days.map(d => {
          const k = dayKey(d);
          const dayEvents = eventsByDay[k] || [];
          const isOther = !isSameMonth(d, date);
          const isToday = isSameDay(d, today);
          const isSelected = isSameDay(d, selectedDay);
          return (
            <button
              key={k}
              type="button"
              className={`mmc-day${isOther ? ' mmc-day-other' : ''}${isToday ? ' mmc-day-today' : ''}${isSelected ? ' mmc-day-selected' : ''}`}
              onClick={() => setSelectedDay(startOfDay(d))}
            >
              <div className="mmc-day-num">{d.getDate()}</div>
              <div className="mmc-day-dots">
                {dayEvents.slice(0, 3).map((e, i) => {
                  const s = e.resource;
                  const colorKey = s.kidId
                    ? (kidMap[s.kidId]?.name.trim().toLowerCase() || s.kidId)
                    : (s.customTitle?.trim().toLowerCase() || s.title?.trim().toLowerCase() || null);
                  return <span key={i} className="mmc-dot" style={{ background: getColorForKey(colorKey) }} />;
                })}
                {dayEvents.length > 3 && <span className="mmc-dot-more">+{dayEvents.length - 3}</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mmc-day-events">
        <div className="mmc-day-events-title">{relativeDayLabel(selectedDay)}</div>
        {selectedEvents.length === 0 ? (
          <div className="mmc-empty">
            <span>אין פגישות ביום זה</span>
            <button type="button" onClick={() => onSlotClick(selectedDay)} className="btn-primary btn-small">+ הוסף</button>
          </div>
        ) : (
          <div className="mmc-events-list">
            {selectedEvents.map(e => {
              const s = e.resource;
              const kidName = s.kidId ? (kidMap[s.kidId]?.name || s.kidId) : (s.customTitle || '');
              const therapistName = s.therapistId ? (therapistMap[s.therapistId]?.name || '') : '';
              const emoji = typeEmoji(s.type);
              const colorKey = s.kidId
                ? (kidMap[s.kidId]?.name.trim().toLowerCase() || s.kidId)
                : (s.customTitle?.trim().toLowerCase() || s.title?.trim().toLowerCase() || null);
              const color = getColorForKey(colorKey);
              return (
                <div
                  key={e.id}
                  className="mmc-event"
                  style={{ borderRight: `4px solid ${color}` }}
                  onClick={() => onEventClick(s)}
                >
                  <div className="mmc-event-time">{e.time}</div>
                  <div className="mmc-event-body">
                    <div className="mmc-event-title">{emoji} {kidName || 'אירוע'}{s.title ? ` · ${s.title}` : ''}</div>
                    {therapistName && s.type !== 'meeting' && (
                      <div className="mmc-event-sub">{therapistName}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AllSessions() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const myId = user?.adminId || '';
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [onlyMine, setOnlyMine] = useState(true);
  const [mobileView, setMobileView] = useState<'list' | 'calendar'>('list');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const showDesktopCalendar = !isMobile;
  const showMobileCalendar = isMobile && mobileView === 'calendar';
  const showMobileList = isMobile && mobileView === 'list';

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

  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return visibleSessions.map(s => {
      const start = toDate(s.scheduledDate);
      const end = new Date(start.getTime() + 45 * 60000);
      const time = format(start, 'HH:mm');
      const therapistName = s.therapistId ? (therapistMap[s.therapistId]?.name || '') : '';
      const kidName = s.kidId ? (kidMap[s.kidId]?.name || s.kidId) : (s.customTitle || '');
      const emoji = typeEmoji(s.type);
      const titlePart = s.title ? ` · ${s.title}` : '';
      const therapistPart = therapistName && s.type !== 'meeting' ? ` · ${therapistName}` : '';
      const base = kidName || s.title || 'אירוע';
      const desc = kidName
        ? `${emoji} ${kidName}${titlePart}${therapistPart}`
        : `${emoji} ${base}${therapistPart}`;
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

  const typeBtnStyles: Record<SessionType, React.CSSProperties> = {
    therapy: {},
    guidance: { backgroundColor: '#0891b2', borderColor: '#0891b2' },
    meeting: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  };

  function renderTypeToggle(value: SessionType, onChange: (t: SessionType) => void) {
    const types: { key: SessionType; label: string }[] = [
      { key: 'therapy', label: 'טיפול' },
      { key: 'guidance', label: 'הדרכה' },
      { key: 'meeting', label: 'ישיבה' },
    ];
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        {types.map(t => (
          <button
            key={t.key}
            type="button"
            className={value === t.key ? 'btn-primary btn-small' : 'btn-secondary btn-small'}
            onClick={() => onChange(t.key)}
            style={{ flex: 1, ...(value === t.key ? typeBtnStyles[t.key] : {}) }}
          >{t.label}</button>
        ))}
      </div>
    );
  }

  return (
    <div className="all-sessions-page" style={{ padding: '24px 24px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <style>{`
        .as-fab { display: none; }
        .as-mobile-view-toggle { display: none !important; }
        @media (max-width: 768px) {
          .as-mobile-view-toggle { display: flex !important; }
          .as-fab { display: flex !important; }
          .as-header-add-btn { display: none !important; }

          .all-sessions-page { padding: 8px 6px 80px !important; max-width: 100% !important; }
          .all-sessions-page .content-card-header { padding: 12px 10px !important; flex-wrap: wrap !important; }
          .all-sessions-page .content-card-header h1 { font-size: 17px !important; }
          .all-sessions-page .content-card-header > div:last-child { width: 100%; justify-content: center; flex-wrap: wrap; }

          /* Modals: stack grid columns + fit screen */
          .all-sessions-page .modal {
            width: min(560px, 94vw) !important;
            padding: 16px !important;
            max-height: 90vh;
            overflow-y: auto;
          }
          .all-sessions-page .as-form-row {
            grid-template-columns: 1fr !important;
          }
        }

        /* Mobile month calendar — fits viewport, no horizontal overflow */
        .mmc-root {
          direction: rtl;
          padding: 4px 0 24px;
          width: 100%;
          box-sizing: border-box;
        }
        .mmc-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 2px 8px;
        }
        .mmc-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
        }
        .mmc-nav-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #f1f5f9;
          border: none;
          color: #334155;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
        }
        .mmc-today-btn {
          display: block;
          margin: 0 auto 8px;
          padding: 4px 14px;
          background: transparent;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          font-size: 12px;
          color: #475569;
          cursor: pointer;
          font-family: inherit;
        }
        .mmc-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
          margin-bottom: 4px;
        }
        .mmc-weekday {
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          padding: 4px 0;
        }
        .mmc-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
        }
        .mmc-day {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 4px 2px 5px;
          min-height: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 3px;
          cursor: pointer;
          font-family: inherit;
          min-width: 0;
          overflow: hidden;
        }
        .mmc-day-other {
          background: #f8fafc;
        }
        .mmc-day-today {
          background: #fff3e0;
          border-color: #fdba74;
        }
        .mmc-day-selected {
          background: #eef2ff;
          border-color: #667eea;
          box-shadow: 0 0 0 1px #667eea inset;
        }
        .mmc-day-num {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
        }
        .mmc-day-other .mmc-day-num {
          color: #94a3b8;
        }
        .mmc-day-dots {
          display: flex;
          gap: 2px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: center;
          min-height: 8px;
          max-width: 100%;
        }
        .mmc-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }
        .mmc-dot-more {
          font-size: 9px;
          color: #64748b;
          font-weight: 600;
          line-height: 1;
        }
        .mmc-day-events {
          margin-top: 14px;
          padding: 0 2px;
        }
        .mmc-day-events-title {
          font-size: 13px;
          font-weight: 700;
          color: #334155;
          padding: 8px 4px;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 8px;
        }
        .mmc-empty {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 8px;
          color: #64748b;
          font-size: 13px;
        }
        .mmc-events-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .mmc-event {
          display: flex;
          align-items: center;
          gap: 10px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 12px;
          cursor: pointer;
        }
        .mmc-event-time {
          min-width: 44px;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }
        .mmc-event-body {
          flex: 1;
          min-width: 0;
        }
        .mmc-event-title {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .mmc-event-sub {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
      <div className="content-card">
        <div className="content-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📅 לוח פגישות</h1>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              {onlyMine ? 'הפגישות שלי' : 'כל הפגישות של כל הילדים'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              borderRadius: 999,
              padding: 3,
              gap: 2,
            }}>
              {([
                { value: true, label: 'רק שלי' },
                { value: false, label: 'הכל' },
              ] as const).map(opt => {
                const active = onlyMine === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setOnlyMine(opt.value)}
                    style={{
                      background: active ? 'white' : 'transparent',
                      color: active ? '#0f172a' : '#64748b',
                      border: 'none',
                      borderRadius: 999,
                      padding: '6px 16px',
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      cursor: 'pointer',
                      boxShadow: active ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >{opt.label}</button>
                );
              })}
            </div>
            <button onClick={() => openSchedule()} className="btn-primary btn-small as-header-add-btn">+ פגישה חדשה</button>
          </div>
        </div>

        {/* Mobile-only view toggle */}
        <div className="as-mobile-view-toggle" style={{
          display: 'none',
          padding: '8px 10px 4px',
          gap: 6,
          justifyContent: 'center',
        }}>
          {([
            { value: 'list', label: '📋 רשימה' },
            { value: 'calendar', label: '📅 לוח' },
          ] as const).map(opt => {
            const active = mobileView === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMobileView(opt.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: active ? '#667eea' : '#f1f5f9',
                  color: active ? 'white' : '#64748b',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >{opt.label}</button>
            );
          })}
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>טוען...</div>
        ) : (<>
          {showDesktopCalendar && (
          <div className="as-calendar-view calendar-container">
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
              style={{ height: isMobile ? 500 : 620 }}
              components={{
                event: ({ event }) => {
                  const s = event.resource;
                  return (
                    <div
                      className="calendar-event"
                      onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}
                    >
                      <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{(event as CalendarEvent).time}</span>
                      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(event as CalendarEvent).desc}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSessionToDelete(s); }}
                        className="calendar-event-delete"
                        title="בטל פגישה"
                      >✕</button>
                    </div>
                  );
                },
              }}
              eventPropGetter={(event) => {
                const s = event.resource;
                const colorKey = s.kidId
                  ? (kidMap[s.kidId]?.name.trim().toLowerCase() || s.kidId)
                  : (s.customTitle?.trim().toLowerCase() || s.title?.trim().toLowerCase() || null);
                return {
                  style: {
                    backgroundColor: getColorForKey(colorKey),
                    cursor: 'pointer',
                  },
                };
              }}
              messages={{ today: 'היום', previous: 'הקודם', next: 'הבא', month: 'חודש' }}
            />
          </div>
          )}
          {showMobileCalendar && (
            <MobileMonthCalendar
              events={calendarEvents}
              date={calendarDate}
              onDateChange={setCalendarDate}
              onEventClick={openEdit}
              onSlotClick={openSchedule}
              kidMap={kidMap}
              therapistMap={therapistMap}
            />
          )}
          {showMobileList && (
            <MobileAgendaList
              sessions={visibleSessions}
              kidMap={kidMap}
              therapistMap={therapistMap}
              onTap={openEdit}
              onDelete={setSessionToDelete}
            />
          )}
        </>)}
      </div>

      {/* Schedule modal */}
      {showSchedule && (
        <div className="modal-overlay" onClick={() => setShowSchedule(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ direction: 'rtl', width: 'min(640px, 92vw)', maxWidth: 640 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>תזמון פגישה חדשה</h3>
            <form onSubmit={submitSchedule}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>סוג פגישה</label>
                {renderTypeToggle(scheduleType, setScheduleType)}
              </div>
              <div className="as-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
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
                <div className="form-group" style={{ margin: 0 }}>
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
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>איש/ת צוות</label>
                  <select value={scheduleTherapist} onChange={(e) => setScheduleTherapist(e.target.value)}>
                    <option value="">—</option>
                    {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div className="as-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>תאריך</label>
                  <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} required />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>שעה</label>
                  <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} required />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#334155',
                }}>
                  <input
                    type="checkbox"
                    checked={scheduleRecurring}
                    onChange={(e) => setScheduleRecurring(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#667eea', cursor: 'pointer' }}
                  />
                  🔁 חוזר שבועי
                </label>
                {scheduleRecurring && (
                  <div className="form-group" style={{ margin: '8px 0 0' }}>
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
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>הערות (לא חובה)</label>
                <textarea
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  rows={2}
                  style={{ resize: 'vertical', width: '100%' }}
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
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ direction: 'rtl', width: 'min(640px, 92vw)', maxWidth: 640 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>עריכת פגישה</h3>
            <form onSubmit={submitEdit}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>סוג פגישה</label>
                {renderTypeToggle(editType, setEditType)}
              </div>
              <div className="as-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
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
                    <button
                      type="button"
                      onClick={() => navigate(`/kid/${linkKidId}`)}
                      style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', padding: '4px 0 0', fontSize: 12 }}
                    >פתח כרטיס ילד/ה ←</button>
                  )}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>כותרת (לא חובה)</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
              </div>
              {editType !== 'meeting' && (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>איש/ת צוות</label>
                  <select value={editTherapist} onChange={(e) => setEditTherapist(e.target.value)}>
                    <option value="">—</option>
                    {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div className="as-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>תאריך</label>
                  <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} required />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>שעה</label>
                  <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>הערות</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  style={{ resize: 'vertical', width: '100%' }}
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
        onClick={() => openSchedule()}
        className="as-fab"
        aria-label="פגישה חדשה"
        style={{
          position: 'fixed',
          bottom: 20,
          insetInlineStart: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#667eea',
          color: 'white',
          border: 'none',
          fontSize: 28,
          fontWeight: 300,
          boxShadow: '0 4px 14px rgba(102,126,234,0.4)',
          cursor: 'pointer',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}
      >+</button>

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
