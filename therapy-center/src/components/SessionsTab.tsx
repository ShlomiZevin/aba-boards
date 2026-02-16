import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { sessionsApi, practitionersApi } from '../api/client';
import { toDate } from '../utils/date';
import type { Session, Practitioner, SessionStatus } from '../types';
import ConfirmModal from './ConfirmModal';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { he };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

const STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: 'מתוכנן',
  pending_form: 'ממתין לטופס',
  completed: 'הושלם',
  missed: 'לא התקיים',
};

// Status colors for potential future use
// const STATUS_COLORS: Record<SessionStatus, string> = {
//   scheduled: '#1976D2',
//   pending_form: '#F57C00',
//   completed: '#388E3C',
//   missed: '#D32F2F',
// };

interface ScheduleModalProps {
  onClose: () => void;
  onSchedule: (data: { scheduledDate: string; therapistId?: string }) => void;
  therapists: Practitioner[];
}

function ScheduleModal({ onClose, onSchedule, therapists }: ScheduleModalProps) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('10:00');
  const [therapistId, setTherapistId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const scheduledDate = `${date}T${time}:00`;
    onSchedule({ scheduledDate, therapistId: therapistId || undefined });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>תזמון פגישה חדשה</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>תאריך</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>שעה</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>מטפלת (לא חובה)</label>
            <select
              value={therapistId}
              onChange={(e) => setTherapistId(e.target.value)}
            >
              <option value="">בחר מטפלת</option>
              {therapists
                .filter((t) => t.type === 'מטפלת')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              ביטול
            </button>
            <button type="submit" className="btn-primary">
              תזמן
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SessionCard({
  session,
  therapists,
  onFillForm,
  onDelete,
}: {
  session: Session;
  therapists: Practitioner[];
  onFillForm: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const therapist = therapists.find((t) => t.id === session.therapistId);
  const dateStr = format(toDate(session.scheduledDate), 'dd/MM/yyyy HH:mm');
  const hasForm = session.status === 'completed' && session.formId;

  return (
    <div className="session-card">
      <div className="session-info">
        <h4>{dateStr}</h4>
        {therapist && <p>{therapist.name}</p>}
        <span
          className={`status-badge ${
            session.status === 'pending_form' ? 'pending' : session.status
          }`}
        >
          {STATUS_LABELS[session.status]}
        </span>
      </div>
      <div className="session-actions">
        {hasForm ? (
          <button onClick={() => navigate(`/form/${session.formId}/view`)}>
            צפה בטופס
          </button>
        ) : (
          <button onClick={onFillForm} className="fill-form-btn">
            מלא טופס
          </button>
        )}
        <button onClick={onDelete} className="delete-btn">
          מחק
        </button>
      </div>
    </div>
  );
}

// Custom calendar event component
function CalendarEvent({
  event,
  kidId,
}: {
  event: { title: string; resource: Session };
  kidId: string;
}) {
  const navigate = useNavigate();
  const session = event.resource;
  const hasForm = session.formId;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasForm) {
      navigate(`/form/${session.formId}/view`);
    } else {
      navigate(`/form/new?kidId=${kidId}&sessionId=${session.id}`);
    }
  };

  return (
    <div className="calendar-event" onClick={handleClick}>
      <div className="calendar-event-title">{event.title}</div>
      <div className={`calendar-event-status ${hasForm ? 'has-form' : 'no-form'}`}>
        {hasForm ? '✓ צפה בטופס' : '+ מלא טופס'}
      </div>
    </div>
  );
}

export default function SessionsTab({ kidId }: { kidId: string }) {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: sessionsRes, isLoading } = useQuery({
    queryKey: ['sessions', kidId],
    queryFn: () => sessionsApi.getForKid(kidId),
  });

  const { data: practitionersRes } = useQuery({
    queryKey: ['practitioners', kidId],
    queryFn: () => practitionersApi.getForKid(kidId),
  });

  const scheduleMutation = useMutation({
    mutationFn: (data: { scheduledDate: string; therapistId?: string }) =>
      sessionsApi.schedule(kidId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', kidId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => sessionsApi.delete(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', kidId] });
      setSessionToDelete(null);
    },
  });

  const sessions = sessionsRes?.data || [];
  const therapists = practitionersRes?.data || [];

  const calendarEvents = sessions.map((s: Session) => {
    const startDate = toDate(s.scheduledDate);
    return {
      id: s.id,
      title: therapists.find((t: Practitioner) => t.id === s.therapistId)?.name || 'פגישה',
      start: startDate,
      end: new Date(startDate.getTime() + 60 * 60 * 1000),
      resource: s,
    };
  });

  if (isLoading) {
    return <div className="loading">טוען פגישות...</div>;
  }

  // Count pending forms
  const pendingCount = sessions.filter(
    (s: Session) => s.status !== 'completed'
  ).length;

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div className="view-toggle">
          <button
            onClick={() => setView('list')}
            className={view === 'list' ? 'active' : ''}
          >
            רשימה
          </button>
          <button
            onClick={() => setView('calendar')}
            className={view === 'calendar' ? 'active' : ''}
          >
            לוח שנה
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => navigate(`/form/new?kidId=${kidId}`)}
            className="btn-secondary btn-small"
          >
            מלא טופס
          </button>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="btn-primary btn-small"
          >
            + פגישה חדשה
          </button>
        </div>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <div className="pending-alert">
          {pendingCount} פגישות ממתינות לטופס
        </div>
      )}

      {/* Content */}
      {view === 'list' ? (
        <div>
          {sessions.length === 0 ? (
            <div className="empty-state">
              <p>אין פגישות</p>
            </div>
          ) : (
            sessions
              .sort(
                (a: Session, b: Session) =>
                  toDate(b.scheduledDate).getTime() -
                  toDate(a.scheduledDate).getTime()
              )
              .map((session: Session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  therapists={therapists}
                  onFillForm={() =>
                    navigate(`/form/new?kidId=${kidId}&sessionId=${session.id}`)
                  }
                  onDelete={() => setSessionToDelete(session)}
                />
              ))
          )}
        </div>
      ) : (
        <div style={{ height: 500 }} dir="ltr">
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            view="month"
            views={['month']}
            date={calendarDate}
            onNavigate={(newDate) => setCalendarDate(newDate)}
            toolbar={true}
            components={{
              event: (props) => <CalendarEvent event={props.event} kidId={kidId} />,
            }}
            eventPropGetter={(event) => ({
              style: {
                backgroundColor: event.resource.formId ? '#388E3C' : '#F57C00',
                cursor: 'pointer',
              },
            })}
            messages={{
              today: 'היום',
              previous: 'הקודם',
              next: 'הבא',
              month: 'חודש',
            }}
          />
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          onClose={() => setShowScheduleModal(false)}
          onSchedule={(data) => scheduleMutation.mutate(data)}
          therapists={therapists}
        />
      )}

      {/* Delete Confirmation Modal */}
      {sessionToDelete && (
        <ConfirmModal
          title="מחיקת פגישה"
          message={`האם למחוק את הפגישה מתאריך ${format(
            toDate(sessionToDelete.scheduledDate),
            'dd/MM/yyyy'
          )}?`}
          confirmText="מחק"
          confirmStyle="danger"
          onConfirm={() => deleteMutation.mutate(sessionToDelete.id)}
          onCancel={() => setSessionToDelete(null)}
        />
      )}
    </div>
  );
}
