import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { kidsApi, practitionersApi, parentsApi, goalsApi, sessionsApi } from '../api/client';
import { toDate } from '../utils/date';
import { GOAL_CATEGORIES } from '../types';
import type { Practitioner, Parent, Goal, GoalCategoryId, Session, PractitionerType } from '../types';
import ConfirmModal from '../components/ConfirmModal';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const BASE = import.meta.env.BASE_URL;
const DEFAULT_AVATAR = `${BASE}me-default-small.jpg`;

// Calendar setup
const locales = { he };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

// Quick Action Link Component
function QuickActionLink({ href, label, icon, color }: { href: string; label: string; icon: string; color: string }) {
  return (
    <a
      href={href}
      className="kid-action-link"
      style={{ '--action-color': color } as React.CSSProperties}
    >
      <span className="action-icon">{icon}</span>
      <span>{label}</span>
    </a>
  );
}

// Simple Add Modal
function AddModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default function KidDetail() {
  const { kidId } = useParams<{ kidId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showAddPractitioner, setShowAddPractitioner] = useState(false);
  const [showAddParent, setShowAddParent] = useState(false);
  const [showScheduleSession, setShowScheduleSession] = useState(false);
  const [showDateActions, setShowDateActions] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDaySessions, setShowDaySessions] = useState(false);
  const [daySessionsList, setDaySessionsList] = useState<Session[]>([]);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);

  // Form state for modals
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newType, setNewType] = useState<PractitionerType>('מטפלת');
  const [scheduleDate, setScheduleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [scheduleTherapist, setScheduleTherapist] = useState('');

  // Queries
  const { data: kidRes, isLoading } = useQuery({
    queryKey: ['kid', kidId],
    queryFn: () => kidsApi.getById(kidId!),
    enabled: !!kidId,
  });

  const { data: practitionersRes } = useQuery({
    queryKey: ['practitioners', kidId],
    queryFn: () => practitionersApi.getForKid(kidId!),
    enabled: !!kidId,
  });

  const { data: parentsRes } = useQuery({
    queryKey: ['parents', kidId],
    queryFn: () => parentsApi.getForKid(kidId!),
    enabled: !!kidId,
  });

  const { data: goalsRes } = useQuery({
    queryKey: ['goals', kidId],
    queryFn: () => goalsApi.getForKid(kidId!),
    enabled: !!kidId,
  });

  const { data: sessionsRes } = useQuery({
    queryKey: ['sessions', kidId],
    queryFn: () => sessionsApi.getForKid(kidId!),
    enabled: !!kidId,
  });

  // Mutations
  const addPractitionerMutation = useMutation({
    mutationFn: (data: { name: string; mobile?: string; email?: string; type: PractitionerType }) =>
      practitionersApi.add(kidId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practitioners', kidId] });
      setShowAddPractitioner(false);
      resetForm();
    },
  });

  const deletePractitionerMutation = useMutation({
    mutationFn: (id: string) => practitionersApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioners', kidId] }),
  });

  const addParentMutation = useMutation({
    mutationFn: (data: { name: string; mobile?: string; email?: string }) =>
      parentsApi.add(kidId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents', kidId] });
      setShowAddParent(false);
      resetForm();
    },
  });

  const deleteParentMutation = useMutation({
    mutationFn: (id: string) => parentsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parents', kidId] }),
  });

  const scheduleSessionMutation = useMutation({
    mutationFn: (data: { scheduledDate: string; therapistId?: string }) =>
      sessionsApi.schedule(kidId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', kidId] });
      setShowScheduleSession(false);
      setScheduleDate(format(new Date(), 'yyyy-MM-dd'));
      setScheduleTime('10:00');
      setScheduleTherapist('');
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', kidId] });
      setSessionToDelete(null);
    },
  });

  const resetForm = () => {
    setNewName('');
    setNewMobile('');
    setNewEmail('');
    setNewType('מטפלת');
  };

  const kid = kidRes?.data;
  const practitioners = practitionersRes?.data || [];
  const parents = parentsRes?.data || [];
  const goals = goalsRes?.data || [];
  const sessions = sessionsRes?.data || [];

  const therapists = practitioners.filter((p: Practitioner) => p.type === 'מטפלת');
  const activeGoals = goals.filter((g: Goal) => g.isActive);
  const pendingSessions = sessions.filter((s: Session) => !s.formId);

  // Group sessions by date
  const sessionsByDate = sessions.reduce((acc: Record<string, Session[]>, s: Session) => {
    const dateKey = format(toDate(s.scheduledDate), 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(s);
    return acc;
  }, {});

  // Calendar events - one per day (grouped if multiple)
  const calendarEvents = Object.entries(sessionsByDate).map(([dateKey, daySessions]) => {
    const startDate = toDate(daySessions[0].scheduledDate);
    const isMultiple = daySessions.length > 1;
    const allHaveForms = daySessions.every(s => s.formId);
    const someHaveForms = daySessions.some(s => s.formId);

    if (isMultiple) {
      return {
        id: dateKey,
        title: `${daySessions.length} פגישות`,
        start: startDate,
        end: new Date(startDate.getTime() + 60 * 60 * 1000),
        resource: { isMultiple: true, sessions: daySessions, allHaveForms, someHaveForms },
      };
    } else {
      const therapist = practitioners.find((t: Practitioner) => t.id === daySessions[0].therapistId);
      return {
        id: daySessions[0].id,
        title: therapist?.name || 'פגישה',
        start: startDate,
        end: new Date(startDate.getTime() + 60 * 60 * 1000),
        resource: daySessions[0],
      };
    }
  });

  // Goals by category
  const goalsByCategory = GOAL_CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = goals.filter((g: Goal) => g.categoryId === cat.id && g.isActive);
    return acc;
  }, {} as Record<GoalCategoryId, Goal[]>);

  if (isLoading) {
    return (
      <div className="container">
        <div className="loading">טוען...</div>
      </div>
    );
  }

  if (!kid) {
    return (
      <div className="container">
        <div className="content-card">
          <div className="empty-state">
            <p>הילד לא נמצא</p>
            <Link to="/" className="btn-primary" style={{ marginTop: '16px', display: 'inline-block' }}>
              חזור לדף הבית
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const avatarUrl = kid.imageName ? `${BASE}${kid.imageName}` : DEFAULT_AVATAR;

  return (
    <div className="container">
      {/* Kid Profile Header - Combined logo, back, and kid info */}
      <div className="kid-header-card">
        <div className="kid-header-top">
          <Link to="/" className="kid-header-back">
            <span className="back-arrow">←</span>
            <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="logo-small" />
          </Link>
        </div>
        <div className="kid-header-profile">
          <img
            src={avatarUrl}
            alt={kid.name}
            className="kid-avatar-large"
            onError={(e) => {
              (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
            }}
          />
          <div className="kid-header-info">
            <h1 className="kid-header-name">{kid.name}</h1>
            {kid.age && <div className="kid-header-age">גיל {kid.age}</div>}
            <div className="kid-header-stats">
              <span>{activeGoals.length} מטרות פעילות</span>
              <span>{sessions.length} פגישות</span>
              {pendingSessions.length > 0 && (
                <span className="pending-badge">{pendingSessions.length} ממתינות לטופס</span>
              )}
            </div>
          </div>
        </div>
        {/* Kid Action Links */}
        <div className="kid-action-links">
          <QuickActionLink
            href={`/board.html?kid=${kidId}`}
            label="לוח"
            icon="📱"
            color="#667eea"
          />
          <QuickActionLink
            href={`/board-builder.html?kid=${kidId}`}
            label="בנה לוח"
            icon="🎨"
            color="#48bb78"
          />
          <QuickActionLink
            href={`/stats.html?kid=${kidId}`}
            label="סטטיסטיקה"
            icon="📊"
            color="#ed8936"
          />
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Team Section */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h3>צוות</h3>
          </div>

          {/* Therapists */}
          <div className="team-subsection">
            <div className="team-subsection-header">
              <span>מטפלות ({therapists.length})</span>
              <button onClick={() => setShowAddPractitioner(true)} className="add-btn-small">+</button>
            </div>
            {practitioners.length === 0 ? (
              <p className="empty-text">אין מטפלות</p>
            ) : (
              <div className="team-list">
                {practitioners.map((p: Practitioner) => (
                  <div key={p.id} className="team-member">
                    <div>
                      <span className="team-name">{p.name}</span>
                      <span className="team-type">{p.type}</span>
                    </div>
                    <button
                      onClick={() => deletePractitionerMutation.mutate(p.id)}
                      className="delete-btn-small"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parents */}
          <div className="team-subsection">
            <div className="team-subsection-header">
              <span>הורים ({parents.length})</span>
              <button onClick={() => setShowAddParent(true)} className="add-btn-small">+</button>
            </div>
            {parents.length === 0 ? (
              <p className="empty-text">אין הורים</p>
            ) : (
              <div className="team-list">
                {parents.map((p: Parent) => (
                  <div key={p.id} className="team-member">
                    <div>
                      <span className="team-name">{p.name}</span>
                      {p.mobile && <a href={`tel:${p.mobile}`} className="team-contact">{p.mobile}</a>}
                    </div>
                    <button
                      onClick={() => deleteParentMutation.mutate(p.id)}
                      className="delete-btn-small"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Goals Section */}
        <div className="dashboard-card goals-card">
          <div className="dashboard-card-header">
            <h3>מטרות</h3>
            <Link to={`/kid/${kidId}/goals`} className="manage-link">
              ניהול →
            </Link>
          </div>

          {activeGoals.length === 0 ? (
            <div className="goals-empty">
              <p>אין מטרות פעילות</p>
              <Link to={`/kid/${kidId}/goals`} className="btn-primary btn-small">
                + הוסף מטרות
              </Link>
            </div>
          ) : (
            <div className="goals-visual">
              {GOAL_CATEGORIES.map((cat) => {
                const catGoals = goalsByCategory[cat.id] || [];
                if (catGoals.length === 0) return null;
                return (
                  <div key={cat.id} className="goal-category-bar" style={{ '--cat-color': cat.color } as React.CSSProperties}>
                    <div className="goal-category-label">
                      <span className="goal-category-name">{cat.nameHe}</span>
                      <span className="goal-category-count">{catGoals.length}</span>
                    </div>
                    <div className="goal-tags">
                      {catGoals.slice(0, 3).map((g: Goal) => (
                        <span key={g.id} className="goal-tag">{g.title}</span>
                      ))}
                      {catGoals.length > 3 && (
                        <span className="goal-tag more">+{catGoals.length - 3}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sessions Section - Full Width */}
      <div className="content-card sessions-section">
        <div className="sessions-header">
          <h3>פגישות</h3>
          <div className="sessions-actions">
            <button
              onClick={() => navigate(`/form/new?kidId=${kidId}`)}
              className="btn-secondary btn-small"
            >
              מלא טופס
            </button>
            <button
              onClick={() => setShowScheduleSession(true)}
              className="btn-primary btn-small"
            >
              + פגישה חדשה
            </button>
          </div>
        </div>

        {pendingSessions.length > 0 && (
          <div className="pending-alert">
            {pendingSessions.length} פגישות ממתינות לטופס
          </div>
        )}

        {/* Calendar */}
        <div className="calendar-container" dir="ltr">
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            view="month"
            views={['month']}
            date={calendarDate}
            onNavigate={(newDate) => setCalendarDate(newDate)}
            selectable
            onSelectSlot={(slotInfo) => {
              setSelectedDate(slotInfo.start);
              setScheduleDate(format(slotInfo.start, 'yyyy-MM-dd'));
              setShowDateActions(true);
            }}
            style={{ height: 400 }}
            components={{
              event: ({ event }) => {
                const resource = event.resource as Session | { isMultiple: true; sessions: Session[]; allHaveForms: boolean; someHaveForms: boolean };

                // Multiple sessions on same day
                if ('isMultiple' in resource && resource.isMultiple) {
                  const { sessions: daySessions, allHaveForms, someHaveForms } = resource;
                  return (
                    <div
                      className="calendar-event calendar-event-multiple"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDaySessionsList(daySessions);
                        setSelectedDate(event.start as Date);
                        setShowDaySessions(true);
                      }}
                    >
                      <div className="calendar-event-title">{daySessions.length} פגישות</div>
                      <div className={`calendar-event-status ${allHaveForms ? 'has-form' : someHaveForms ? 'partial' : 'no-form'}`}>
                        {allHaveForms ? '✓ כל הטפסים מולאו' : someHaveForms ? '⚠ חלק מולאו' : '+ ממתין למילוי'}
                      </div>
                    </div>
                  );
                }

                // Single session
                const session = resource as Session;
                const hasForm = session.formId;
                return (
                  <div
                    className="calendar-event"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasForm) {
                        navigate(`/form/${session.formId}/view`);
                      } else {
                        navigate(`/form/new?kidId=${kidId}&sessionId=${session.id}`);
                      }
                    }}
                  >
                    <div className="calendar-event-title">{event.title}</div>
                    <div className={`calendar-event-status ${hasForm ? 'has-form' : 'no-form'}`}>
                      {hasForm ? '✓ צפה בטופס' : '+ מלא טופס'}
                    </div>
                  </div>
                );
              },
            }}
            eventPropGetter={(event) => {
              const resource = event.resource as Session | { isMultiple: true; sessions: Session[]; allHaveForms: boolean; someHaveForms: boolean };

              if ('isMultiple' in resource && resource.isMultiple) {
                const { allHaveForms, someHaveForms } = resource;
                return {
                  style: {
                    backgroundColor: allHaveForms ? '#388E3C' : someHaveForms ? '#1976D2' : '#F57C00',
                    cursor: 'pointer',
                  },
                };
              }

              return {
                style: {
                  backgroundColor: (resource as Session).formId ? '#388E3C' : '#F57C00',
                  cursor: 'pointer',
                },
              };
            }}
            messages={{
              today: 'היום',
              previous: 'הקודם',
              next: 'הבא',
              month: 'חודש',
            }}
          />
        </div>

        {/* Recent Sessions List */}
        <div className="recent-sessions">
          <h4>פגישות אחרונות</h4>
          {sessions.length === 0 ? (
            <p className="empty-text">אין פגישות</p>
          ) : (
            <div className="sessions-list">
              {sessions
                .sort((a: Session, b: Session) =>
                  toDate(b.scheduledDate).getTime() - toDate(a.scheduledDate).getTime()
                )
                .slice(0, 5)
                .map((session: Session) => {
                  const therapist = practitioners.find((t: Practitioner) => t.id === session.therapistId);
                  const hasForm = session.formId;
                  return (
                    <div key={session.id} className="session-row">
                      <div className="session-row-info">
                        <span className="session-date">
                          {format(toDate(session.scheduledDate), 'dd/MM/yyyy')}
                        </span>
                        {therapist && <span className="session-therapist">{therapist.name}</span>}
                        <span className={`session-status ${hasForm ? 'completed' : 'pending'}`}>
                          {hasForm ? 'הושלם' : 'ממתין'}
                        </span>
                      </div>
                      <div className="session-row-actions">
                        {hasForm ? (
                          <button onClick={() => navigate(`/form/${session.formId}/view`)}>
                            צפה
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/form/new?kidId=${kidId}&sessionId=${session.id}`)}
                            className="fill-btn"
                          >
                            מלא
                          </button>
                        )}
                        <button
                          onClick={() => setSessionToDelete(session)}
                          className="delete-btn"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Add Practitioner Modal */}
      {showAddPractitioner && (
        <AddModal title="הוספת איש צוות" onClose={() => { setShowAddPractitioner(false); resetForm(); }}>
          <form onSubmit={(e) => {
            e.preventDefault();
            addPractitionerMutation.mutate({
              name: newName,
              mobile: newMobile || undefined,
              email: newEmail || undefined,
              type: newType,
            });
          }}>
            <div className="form-group">
              <label>שם</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>סוג</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value as PractitionerType)}>
                <option value="מטפלת">מטפלת</option>
                <option value="מנתחת התנהגות">מנתחת התנהגות</option>
                <option value="מדריכת הורים">מדריכת הורים</option>
              </select>
            </div>
            <div className="form-group">
              <label>טלפון (לא חובה)</label>
              <input type="tel" value={newMobile} onChange={(e) => setNewMobile(e.target.value)} dir="ltr" />
            </div>
            <div className="form-group">
              <label>אימייל (לא חובה)</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} dir="ltr" />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => { setShowAddPractitioner(false); resetForm(); }} className="btn-secondary">
                ביטול
              </button>
              <button type="submit" className="btn-primary">הוסף</button>
            </div>
          </form>
        </AddModal>
      )}

      {/* Add Parent Modal */}
      {showAddParent && (
        <AddModal title="הוספת הורה" onClose={() => { setShowAddParent(false); resetForm(); }}>
          <form onSubmit={(e) => {
            e.preventDefault();
            addParentMutation.mutate({
              name: newName,
              mobile: newMobile || undefined,
              email: newEmail || undefined,
            });
          }}>
            <div className="form-group">
              <label>שם</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>טלפון (לא חובה)</label>
              <input type="tel" value={newMobile} onChange={(e) => setNewMobile(e.target.value)} dir="ltr" />
            </div>
            <div className="form-group">
              <label>אימייל (לא חובה)</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} dir="ltr" />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => { setShowAddParent(false); resetForm(); }} className="btn-secondary">
                ביטול
              </button>
              <button type="submit" className="btn-primary">הוסף</button>
            </div>
          </form>
        </AddModal>
      )}

      {/* Schedule Session Modal */}
      {showScheduleSession && (
        <AddModal title="תזמון פגישה חדשה" onClose={() => setShowScheduleSession(false)}>
          <form onSubmit={(e) => {
            e.preventDefault();
            scheduleSessionMutation.mutate({
              scheduledDate: `${scheduleDate}T${scheduleTime}:00`,
              therapistId: scheduleTherapist || undefined,
            });
          }}>
            <div className="form-group">
              <label>תאריך</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>שעה</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>מטפלת (לא חובה)</label>
              <select value={scheduleTherapist} onChange={(e) => setScheduleTherapist(e.target.value)}>
                <option value="">בחר מטפלת</option>
                {therapists.map((t: Practitioner) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowScheduleSession(false)} className="btn-secondary">
                ביטול
              </button>
              <button type="submit" className="btn-primary">תזמן</button>
            </div>
          </form>
        </AddModal>
      )}

      {/* Delete Session Modal */}
      {sessionToDelete && (
        <ConfirmModal
          title="מחיקת פגישה"
          message={`האם למחוק את הפגישה מתאריך ${format(toDate(sessionToDelete.scheduledDate), 'dd/MM/yyyy')}?`}
          confirmText="מחק"
          confirmStyle="danger"
          onConfirm={() => deleteSessionMutation.mutate(sessionToDelete.id)}
          onCancel={() => setSessionToDelete(null)}
        />
      )}

      {/* Date Actions Modal - when clicking empty date in calendar */}
      {showDateActions && selectedDate && (
        <div className="modal-overlay" onClick={() => setShowDateActions(false)}>
          <div className="modal date-actions-modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {format(selectedDate, 'dd/MM/yyyy')}
            </h3>
            <p style={{ color: '#64748b', marginBottom: '20px' }}>מה תרצה לעשות?</p>
            <div className="date-actions-buttons">
              <button
                className="date-action-btn schedule"
                onClick={() => {
                  setShowDateActions(false);
                  setShowScheduleSession(true);
                }}
              >
                <span className="date-action-icon">📅</span>
                <span className="date-action-label">תזמן פגישה</span>
                <span className="date-action-desc">הוסף פגישה ללוח השנה</span>
              </button>
              <button
                className="date-action-btn form"
                onClick={() => {
                  setShowDateActions(false);
                  navigate(`/form/new?kidId=${kidId}&date=${format(selectedDate, 'yyyy-MM-dd')}`);
                }}
              >
                <span className="date-action-icon">📝</span>
                <span className="date-action-label">מלא טופס</span>
                <span className="date-action-desc">מלא טופס פגישה ישירות</span>
              </button>
            </div>
            <button
              className="btn-secondary"
              style={{ width: '100%', marginTop: '16px' }}
              onClick={() => setShowDateActions(false)}
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Day Sessions Modal - when clicking on day with multiple sessions */}
      {showDaySessions && selectedDate && (
        <div className="modal-overlay" onClick={() => setShowDaySessions(false)}>
          <div className="modal day-sessions-modal" onClick={(e) => e.stopPropagation()}>
            <h3>פגישות ב-{format(selectedDate, 'dd/MM/yyyy')}</h3>
            <div className="day-sessions-list">
              {daySessionsList.map((session) => {
                const therapist = practitioners.find((t: Practitioner) => t.id === session.therapistId);
                const hasForm = session.formId;
                return (
                  <button
                    key={session.id}
                    className={`day-session-item ${hasForm ? 'completed' : 'pending'}`}
                    onClick={() => {
                      setShowDaySessions(false);
                      if (hasForm) {
                        navigate(`/form/${session.formId}/view`);
                      } else {
                        navigate(`/form/new?kidId=${kidId}&sessionId=${session.id}`);
                      }
                    }}
                  >
                    <div className="day-session-info">
                      <span className="day-session-therapist">{therapist?.name || 'פגישה'}</span>
                      <span className="day-session-time">
                        {format(toDate(session.scheduledDate), 'HH:mm')}
                      </span>
                    </div>
                    <span className={`day-session-status ${hasForm ? 'has-form' : 'no-form'}`}>
                      {hasForm ? '✓ צפה בטופס' : '+ מלא טופס'}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              className="btn-secondary"
              style={{ width: '100%', marginTop: '16px' }}
              onClick={() => setShowDaySessions(false)}
            >
              סגור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
