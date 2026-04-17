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
import ConfirmModal from '../components/ConfirmModal';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const THERAPIST_PALETTE = ['#0891b2', '#7c3aed', '#db2777', '#059669', '#d97706', '#2563eb', '#dc2626', '#65a30d', '#0d9488', '#9333ea'];
const MEETING_PALETTE = ['#67e8f9', '#c4b5fd', '#f9a8d4', '#6ee7b7', '#fcd34d', '#93c5fd', '#fca5a5', '#bef264', '#5eead4', '#d8b4fe'];
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  return Math.abs(h);
}
function getTherapistColor(therapistId: string | undefined, isMeeting = false): string {
  const palette = isMeeting ? MEETING_PALETTE : THERAPIST_PALETTE;
  if (!therapistId) return isMeeting ? '#a78bfa' : '#64748b';
  return palette[hashId(therapistId) % palette.length];
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
  const [calendarDate, setCalendarDate] = useState(new Date());

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
  const therapistMap = useMemo(() => {
    const m: Record<string, Practitioner> = {};
    for (const t of therapists) m[t.id] = t;
    return m;
  }, [therapists]);

  const scheduleMutation = useMutation({
    mutationFn: ({ kidId, data }: { kidId: string; data: { scheduledDate: string; therapistId?: string; type?: SessionType } }) =>
      sessionsApi.schedule(kidId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-sessions'] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Session> }) => sessionsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-sessions'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-sessions'] }),
  });

  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return sessions.map(s => {
      const start = toDate(s.scheduledDate);
      const end = new Date(start.getTime() + 45 * 60000);
      const kidName = kidMap[s.kidId]?.name || s.kidId;
      const time = format(start, 'HH:mm');
      const therapistName = s.therapistId ? (therapistMap[s.therapistId]?.name || '') : '';
      const desc = s.type === 'meeting' ? `${kidName} (ישיבה)` : `${kidName}${therapistName ? ` · ${therapistName}` : ''}`;
      return { id: s.id, title: `${time} ${desc}`, time, desc, start, end, resource: s };
    });
  }, [sessions, kidMap, therapistMap]);

  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleKidId, setScheduleKidId] = useState('');
  const [scheduleDate, setScheduleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [scheduleTherapist, setScheduleTherapist] = useState('');
  const [scheduleType, setScheduleType] = useState<SessionType>('therapy');

  const [editSession, setEditSession] = useState<Session | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editTherapist, setEditTherapist] = useState('');
  const [editType, setEditType] = useState<SessionType>('therapy');

  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);

  function openSchedule(date?: Date) {
    const d = date || new Date();
    setScheduleDate(format(d, 'yyyy-MM-dd'));
    setScheduleTime(format(d, 'HH:mm') === '00:00' ? '10:00' : format(d, 'HH:mm'));
    setScheduleKidId(kids[0]?.id || '');
    setScheduleTherapist('');
    setScheduleType('therapy');
    setShowSchedule(true);
  }

  function openEdit(s: Session) {
    const d = toDate(s.scheduledDate);
    setEditSession(s);
    setEditDate(format(d, 'yyyy-MM-dd'));
    setEditTime(format(d, 'HH:mm'));
    setEditTherapist(s.therapistId || '');
    setEditType(s.type || 'therapy');
  }

  function submitSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleKidId) return;
    const scheduledDate = `${scheduleDate}T${scheduleTime}:00`;
    scheduleMutation.mutate({
      kidId: scheduleKidId,
      data: {
        scheduledDate,
        therapistId: scheduleType === 'therapy' ? (scheduleTherapist || undefined) : undefined,
        type: scheduleType,
      },
    }, {
      onSuccess: () => setShowSchedule(false),
    });
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editSession) return;
    const scheduledDate = `${editDate}T${editTime}:00`;
    updateMutation.mutate({
      id: editSession.id,
      data: {
        scheduledDate: scheduledDate as unknown as Date,
        therapistId: editType === 'therapy' ? (editTherapist || undefined) : undefined,
        type: editType,
      },
    }, {
      onSuccess: () => setEditSession(null),
    });
  }

  return (
    <div style={{ padding: '24px 24px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <div className="content-card">
        <div className="content-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📅 לוח פגישות</h1>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>כל הפגישות של כל הילדים</div>
          </div>
          <button onClick={() => openSchedule()} className="btn-primary btn-small">+ פגישה חדשה</button>
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
                const isMeeting = s.type === 'meeting';
                return {
                  style: {
                    backgroundColor: getTherapistColor(s.therapistId, isMeeting),
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
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ direction: 'rtl', minWidth: 320 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17 }}>תזמון פגישה חדשה</h3>
            <form onSubmit={submitSchedule}>
              <div className="form-group">
                <label>סוג פגישה</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={scheduleType === 'therapy' ? 'btn-primary btn-small' : 'btn-secondary btn-small'} onClick={() => setScheduleType('therapy')} style={{ flex: 1 }}>טיפול</button>
                  <button type="button" className={scheduleType === 'meeting' ? 'btn-primary btn-small' : 'btn-secondary btn-small'} onClick={() => setScheduleType('meeting')} style={{ flex: 1, ...(scheduleType === 'meeting' ? { backgroundColor: '#7C3AED', borderColor: '#7C3AED' } : {}) }}>ישיבה</button>
                </div>
              </div>
              <div className="form-group">
                <label>ילד/ה</label>
                <select value={scheduleKidId} onChange={(e) => setScheduleKidId(e.target.value)} required>
                  <option value="">בחר ילד/ה</option>
                  {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>תאריך</label>
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>שעה</label>
                <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} required />
              </div>
              {scheduleType === 'therapy' && (
                <div className="form-group">
                  <label>איש/ת צוות (לא חובה)</label>
                  <select value={scheduleTherapist} onChange={(e) => setScheduleTherapist(e.target.value)}>
                    <option value="">בחר איש/ת צוות</option>
                    {therapists.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
                  </select>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => setShowSchedule(false)} className="btn-secondary">ביטול</button>
                <button type="submit" className="btn-primary" disabled={scheduleMutation.isPending || !scheduleKidId}>
                  {scheduleMutation.isPending ? 'מתזמן...' : 'תזמן'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editSession && (
        <div className="modal-overlay" onClick={() => setEditSession(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ direction: 'rtl', minWidth: 320 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>עריכת פגישה</h3>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              {kidMap[editSession.kidId]?.name || editSession.kidId}
              {' · '}
              <button
                type="button"
                onClick={() => navigate(`/kid/${editSession.kidId}`)}
                style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', padding: 0, fontSize: 13 }}
              >פתח כרטיס</button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="form-group">
                <label>סוג פגישה</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={editType === 'therapy' ? 'btn-primary btn-small' : 'btn-secondary btn-small'} onClick={() => setEditType('therapy')} style={{ flex: 1 }}>טיפול</button>
                  <button type="button" className={editType === 'meeting' ? 'btn-primary btn-small' : 'btn-secondary btn-small'} onClick={() => setEditType('meeting')} style={{ flex: 1, ...(editType === 'meeting' ? { backgroundColor: '#7C3AED', borderColor: '#7C3AED' } : {}) }}>ישיבה</button>
                </div>
              </div>
              <div className="form-group">
                <label>תאריך</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>שעה</label>
                <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} required />
              </div>
              {editType === 'therapy' && (
                <div className="form-group">
                  <label>איש/ת צוות</label>
                  <select value={editTherapist} onChange={(e) => setEditTherapist(e.target.value)}>
                    <option value="">בחר איש/ת צוות</option>
                    {therapists.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
                  </select>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => setEditSession(null)} className="btn-secondary">ביטול</button>
                <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'שומר...' : 'שמור'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sessionToDelete && (
        <ConfirmModal
          title="ביטול פגישה"
          message={`האם לבטל את הפגישה של ${kidMap[sessionToDelete.kidId]?.name || ''} בתאריך ${format(toDate(sessionToDelete.scheduledDate), 'dd/MM/yyyy')}?`}
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
