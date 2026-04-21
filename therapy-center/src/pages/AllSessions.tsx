import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
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

export default function AllSessions() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const myId = user?.adminId || '';
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [onlyMine, setOnlyMine] = useState(true);

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
    <div style={{ padding: '24px 24px 60px', maxWidth: 1400, margin: '0 auto' }}>
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
            <button onClick={() => openSchedule()} className="btn-primary btn-small">+ פגישה חדשה</button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>טוען...</div>
        ) : (
          <div className="calendar-container" style={{ padding: 16 }}>
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
              style={{ height: 620 }}
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
                  : (s.customTitle?.trim().toLowerCase() || null);
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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
