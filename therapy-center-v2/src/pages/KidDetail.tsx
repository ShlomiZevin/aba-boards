import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { isRecentForPendingForm, kidsApi, practitionersApi, parentsApi, goalsApi, sessionsApi, notificationsApi, goalDataApi, summariesApi, crewHoursApi } from '../api/client';
import type { CrewHoursEntry } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import { useAuth } from '../contexts/AuthContext';
import { toDate } from '../utils/date';
import { GOAL_CATEGORIES } from '../types';
import type { Practitioner, Parent, Goal, GoalCategoryId, Session, SessionType, PractitionerType, Notification, KidGoalDataEntry, Summary } from '../types';
import ConfirmModal from '../components/ConfirmModal';
import Icon from '../v2/Icon';
import { KidDocsTab, useHasKidDocs } from '../v2/pages/Docs';
import { kidColor, CATEGORY_TONE, CATEGORY_LABEL } from '../v2/kidColor';
import '../v2/pages/kid.css';
import '../v2/pages/kp.css';

// Calendar events take each therapist's marker colour (kidColor hash), mint when done, lilac for meetings.
import FormTemplateEditor from '../components/FormTemplateEditor';
import ImageCropModal from '../components/ImageCropModal';
import GoalProgressChart from '../components/GoalProgressChart';
import GoalPlansTab from '../components/GoalPlansTab';
import { agreementApi } from '../api/client';
import LearningPlansTab from '../components/LearningPlansTab';
import GameLauncher from '../components/GameLauncher';
import DcEntryModal from '../components/DcEntryModal';
import CreatePendingDcModal from '../components/CreatePendingDcModal';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { CLASSIC_ORIGIN } from '../v2/classic';

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

const HE_DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const calendarFormats = {
  weekdayFormat: (date: Date) => HE_DAY_SHORT[date.getDay()],
  monthHeaderFormat: (date: Date) => `${HE_MONTHS[date.getMonth()]} ${date.getFullYear()}`,
};

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Session | { isMultiple: true; sessions: Session[]; allHaveForms: boolean; someHaveForms: boolean };
}

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar);

// Quick Action Link Component
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

// Edit Practitioner Form
function EditPractitionerForm({
  practitioner,
  onSave,
  onCancel,
}: {
  practitioner: Practitioner;
  onSave: (data: Partial<Practitioner>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(practitioner.name);
  const [mobile, setMobile] = useState(practitioner.mobile || '');
  const [email, setEmail] = useState(practitioner.email || '');
  const [type, setType] = useState<PractitionerType>(practitioner.type);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ name, mobile: mobile || undefined, email: email || undefined, type }); }}>
      <div className="form-group">
        <label>שם</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div className="form-group">
        <label>סוג</label>
        <select value={type} onChange={(e) => setType(e.target.value as PractitionerType)}>
          <option value="מטפלת">מטפלת</option>
          <option value="מנתחת התנהגות">מנתחת התנהגות</option>
          <option value="מדריכת הורים">מדריכת הורים</option>
        </select>
      </div>
      <div className="form-group">
        <label>טלפון (לא חובה)</label>
        <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} dir="ltr" />
      </div>
      <div className="form-group">
        <label>אימייל (לא חובה)</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
      </div>
      <div className="modal-actions">
        <button type="button" onClick={onCancel} className="btn-secondary">ביטול</button>
        <button type="submit" className="btn-primary">שמור</button>
      </div>
    </form>
  );
}

// Edit Parent Form
function EditParentForm({
  parent,
  onSave,
  onCancel,
}: {
  parent: Parent;
  onSave: (data: Partial<Parent>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(parent.name);
  const [mobile, setMobile] = useState(parent.mobile || '');
  const [email, setEmail] = useState(parent.email || '');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ name, mobile: mobile || undefined, email: email || undefined }); }}>
      <div className="form-group">
        <label>שם</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div className="form-group">
        <label>טלפון (לא חובה)</label>
        <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} dir="ltr" />
      </div>
      <div className="form-group">
        <label>אימייל (לא חובה)</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
      </div>
      <div className="modal-actions">
        <button type="button" onClick={onCancel} className="btn-secondary">ביטול</button>
        <button type="submit" className="btn-primary">שמור</button>
      </div>
    </form>
  );
}

function fmtHours(m: number) {
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h === 0) return `${mins} דק׳`;
  if (mins === 0) return `${h} שע׳`;
  return `${h}:${String(mins).padStart(2, '0')} שע׳`;
}
function fmtDateShort(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('he-IL', { weekday: 'short' });
  return `${day} ${d.getDate()}/${d.getMonth() + 1}`;
}
function fmtTimeRange(iso: string, durationMin: number) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + durationMin * 60000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(start.getHours())}:${pad(start.getMinutes())} – ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

function CrewHoursTab({ kidId }: { kidId: string }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { from, to, label: monthLabel } = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const fr = fmt(d);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const t = fmt(last);
    const label = d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    return { from: fr, to: t, label };
  }, [monthOffset]);

  const { data: response, isLoading } = useQuery({
    queryKey: ['crew-hours', kidId, from, to],
    queryFn: () => crewHoursApi.get({ from, to, kidId }),
  });

  const entries: CrewHoursEntry[] = response?.data || [];
  const totalMinutes = entries.reduce((s, e) => s + e.totalMinutes, 0);
  const totalSessions = entries.reduce((s, e) => s + e.sessionCount, 0);

  return (
    <section className="nb-card kp-panel">
      <div className="kp-sec-head">
        <h2 className="nb-h2"><Icon name="clock" /> שעות צוות</h2>
      </div>

      {/* Month nav — RTL: right arrow = back in time, left arrow = forward */}
      <div className="kp-month">
        <button type="button" onClick={() => setMonthOffset(o => o - 1)} className="kp-icon-btn" aria-label="החודש הקודם">
          <Icon name="back" size={20} />
        </button>
        <span className="kp-month-label"><mark className="hl-yellow">{monthLabel}</mark></span>
        <button type="button" onClick={() => setMonthOffset(o => o + 1)} disabled={monthOffset >= 0} className="kp-icon-btn" aria-label="החודש הבא">
          <Icon name="chevron" size={20} />
        </button>
        {monthOffset !== 0 && (
          <button type="button" onClick={() => setMonthOffset(0)} className="kp-text-btn">החודש</button>
        )}
      </div>

      {isLoading && <p className="kp-empty-line hand">טוען...</p>}

      {!isLoading && entries.length === 0 && (
        <div className="kp-empty"><Icon name="clock" size={30} /><p className="hand">אין נתוני שעות לחודש זה</p></div>
      )}

      {!isLoading && entries.length > 0 && (
        <>
          <div className="kp-stats kp-stats-center">
            <span className="kh-stat tone-sky" style={{ ['--rot' as string]: '-2deg' }}><b className="tabular">{fmtHours(totalMinutes)}</b> סה״כ</span>
            <span className="kh-stat tone-mint" style={{ ['--rot' as string]: '1.5deg' }}><b className="tabular">{totalSessions}</b> {totalSessions === 1 ? 'טיפול' : 'טיפולים'}</span>
          </div>

          {/* Practitioner rows with drill-down */}
          <ul className="kp-crew">
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.practitionerId;
              return (
                <li key={entry.practitionerId} className={`kp-crew-item${isExpanded ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="kp-crew-row"
                    onClick={() => setExpandedId(isExpanded ? null : entry.practitionerId)}
                    aria-expanded={isExpanded}
                  >
                    <span className={`nb-av sm tone-${kidColor(entry.practitionerId)}`} aria-hidden="true">{entry.practitionerName.charAt(0)}</span>
                    <span className="kp-crew-name">
                      <b>{entry.practitionerName}</b>
                      {entry.practitionerType && <small>{entry.practitionerType}</small>}
                    </span>
                    <span className="kp-crew-count tabular">{entry.sessionCount} {entry.sessionCount === 1 ? 'טיפול' : 'טיפולים'}</span>
                    <b className="kp-crew-hours tabular">{fmtHours(entry.totalMinutes)}</b>
                    <span className={`kp-fold-chev${isExpanded ? ' is-open' : ''}`}><Icon name="chevron" size={18} /></span>
                  </button>

                  {isExpanded && (
                    <table className="kp-crew-table">
                      <thead>
                        <tr>
                          <th>תאריך</th>
                          <th>שעות</th>
                          <th>משך</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.sessions.map((s, i) => (
                          <tr key={i}>
                            <td>{fmtDateShort(s.date)}</td>
                            <td className="tabular" dir="ltr">{fmtTimeRange(s.date, s.duration)}</td>
                            <td className="tabular"><b>{fmtHours(s.duration)}</b></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

export default function KidDetail() {
  const { kidId: urlKidId } = useParams<{ kidId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isTherapistView, isParentView, practitionerId: contextPractitionerId, parentKidId } = useTherapist();
  const kidId = urlKidId || parentKidId;
  const { user: authUser } = useAuth();
  const links = useTherapistLinks();
  const isSimplifiedView = isTherapistView || isParentView;
  const isReadOnly = isParentView;
  const isAdmin = !isTherapistView && !isParentView;
  const isSuperAdmin = isAdmin && (authUser?.isSuperAdmin ?? false);
  // מחברת tab: always for admins; for therapists/parents only when something is shared with them
  const hasSharedDocs = useHasKidDocs(urlKidId || parentKidId || undefined, !isAdmin);
  const showNotebook = isAdmin || hasSharedDocs;

  // Tab state
  type KidTab = 'overview' | 'progress' | 'sessions' | 'notebook' | 'notifications' | 'plans' | 'learning-plans' | 'crew-hours';
  const [kidTab, setKidTab] = useState<KidTab>('overview');

  // State
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showAddPractitioner, setShowAddPractitioner] = useState(false);
  const [practitionerSearch, setPractitionerSearch] = useState('');
  const [showNewPractitionerForm, setShowNewPractitionerForm] = useState(false);
  const [showAddParent, setShowAddParent] = useState(false);
  const [showScheduleSession, setShowScheduleSession] = useState(false);
  const [showDateActions, setShowDateActions] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDaySessions, setShowDaySessions] = useState(false);
  const [daySessionsList, setDaySessionsList] = useState<Session[]>([]);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editSessionDate, setEditSessionDate] = useState('');
  const [editSessionTime, setEditSessionTime] = useState('');
  const [editSessionTherapist, setEditSessionTherapist] = useState('');
  const [editingPractitioner, setEditingPractitioner] = useState<Practitioner | null>(null);
  const [editingParent, setEditingParent] = useState<Parent | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showDeleteKid, setShowDeleteKid] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [copiedParentLink, setCopiedParentLink] = useState(false);
  const [sessionsTab, setSessionsTab] = useState<'future' | 'past'>('future');
  const [showNotifyCompose, setShowNotifyCompose] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyTargets, setNotifyTargets] = useState<Set<string>>(new Set());
  const [notifyDeleteConfirm, setNotifyDeleteConfirm] = useState<string | null>(null);
  const [pendingReadIds, setPendingReadIds] = useState<Set<string>>(new Set());
  const [dcModalEntry, setDcModalEntry] = useState<KidGoalDataEntry | null>(null);
  const [dcModalOpen, setDcModalOpen] = useState(false);
  const [createPendingDcOpen, setCreatePendingDcOpen] = useState(false);
  const [dcDeleteConfirm, setDcDeleteConfirm] = useState<string | null>(null);
  const [dcSectionExpanded, setDcSectionExpanded] = useState(true);
  const [sessionsSectionExpanded, setSessionsSectionExpanded] = useState(true);
  const [summariesExpanded, setSummariesExpanded] = useState(true);

  // Form state for modals
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newType, setNewType] = useState<PractitionerType>('מטפלת');
  const [scheduleDate, setScheduleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [scheduleTherapist, setScheduleTherapist] = useState('');
  const [scheduleType, setScheduleType] = useState<SessionType>('therapy');
  const [scheduleRecurring, setScheduleRecurring] = useState(false);
  const [scheduleUntil, setScheduleUntil] = useState('');

  // Queries
  const { data: kidRes, isLoading } = useQuery({
    queryKey: ['kid', kidId],
    queryFn: () => kidsApi.getById(kidId!),
    enabled: !!kidId,
  });

  // Treatment agreement — surfaced as a card, and as a banner for parents who
  // still owe a signature.
  // Therapists are not party to the agreement, so they never fetch it.
  const { data: agreementRes } = useQuery({
    queryKey: ['agreement', kidId],
    queryFn: () => agreementApi.getForKid(kidId!),
    enabled: !!kidId && !isTherapistView,
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

  const { data: allDcRes } = useQuery({
    queryKey: ['all-dc', kidId],
    queryFn: () => goalDataApi.getAllEntries(kidId!),
    enabled: !!kidId,
    staleTime: 0,
  });

  const { data: summariesRes } = useQuery({
    queryKey: ['summaries', kidId],
    queryFn: () => summariesApi.getForKid(kidId!),
    enabled: !!kidId,
  });

  const { data: myTherapistsRes } = useQuery({
    queryKey: ['myTherapists'],
    queryFn: () => practitionersApi.getMyTherapists(),
    enabled: showAddPractitioner,
    staleTime: 0,
  });

  // Mutations
  const addPractitionerMutation = useMutation({
    mutationFn: (data: { name: string; mobile?: string; email?: string; type: PractitionerType }) =>
      practitionersApi.add(kidId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practitioners', kidId] });
      queryClient.invalidateQueries({ queryKey: ['myTherapists'] });
      setShowAddPractitioner(false);
      setShowNewPractitionerForm(false);
      resetForm();
    },
  });

  const linkExistingMutation = useMutation({
    mutationFn: (practitionerId: string) =>
      practitionersApi.linkExisting(kidId!, practitionerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practitioners', kidId] });
      setShowAddPractitioner(false);
      setShowNewPractitionerForm(false);
    },
  });

  const unlinkPractitionerMutation = useMutation({
    mutationFn: (practitionerId: string) => practitionersApi.unlink(kidId!, practitionerId),
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

  const updatePractitionerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Practitioner> }) =>
      practitionersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practitioners', kidId] });
      setEditingPractitioner(null);
    },
  });

  const updateParentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Parent> }) =>
      parentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents', kidId] });
      setEditingParent(null);
    },
  });

  const resetScheduleModal = () => {
    setScheduleDate(format(new Date(), 'yyyy-MM-dd'));
    setScheduleTime('10:00');
    setScheduleTherapist('');
    setScheduleType('therapy');
    setScheduleRecurring(false);
    setScheduleUntil('');
    setShowScheduleSession(false);
  };

  const scheduleSessionMutation = useMutation({
    mutationFn: (data: { scheduledDate: string; therapistId?: string; type: SessionType }) =>
      sessionsApi.schedule(kidId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', kidId] });
      resetScheduleModal();
    },
  });

  const scheduleRecurringMutation = useMutation({
    mutationFn: (data: { scheduledDate: string; therapistId?: string; type: SessionType; until: string }) =>
      sessionsApi.scheduleRecurring(kidId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', kidId] });
      resetScheduleModal();
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', kidId] });
      setSessionToDelete(null);
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Session> }) =>
      sessionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', kidId] });
      queryClient.invalidateQueries({ queryKey: ['forms', kidId] });
      queryClient.invalidateQueries({ queryKey: ['form'] });
      queryClient.invalidateQueries({ queryKey: ['meetingForms', kidId] });
      queryClient.invalidateQueries({ queryKey: ['meetingForm'] });
      setEditingSession(null);
    },
  });

  const deleteDcMutation = useMutation({
    mutationFn: (entry: KidGoalDataEntry) =>
      goalDataApi.deleteEntry(entry.kidId, entry.goalLibraryId, entry.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-dc', kidId] });
      queryClient.invalidateQueries({ queryKey: ['goal-data'] });
      setDcDeleteConfirm(null);
    },
  });


  const openEditSession = (session: Session) => {
    const d = toDate(session.scheduledDate);
    setEditSessionDate(format(d, 'yyyy-MM-dd'));
    setEditSessionTime(format(d, 'HH:mm'));
    setEditSessionTherapist(session.therapistId || '');
    setEditingSession(session);
  };

  const deleteKidMutation = useMutation({
    mutationFn: () => kidsApi.delete(kidId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kids'] });
      navigate(links.home());
    },
  });

  const updateKidImageMutation = useMutation({
    mutationFn: (imageName: string) => kidsApi.update(kidId!, { imageName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kid', kidId] });
      queryClient.invalidateQueries({ queryKey: ['kids'] });
      setShowImageUpload(false);
    },
  });

  const { data: sentNotificationsRes } = useQuery({
    queryKey: ['notifications', 'sent', kidId],
    queryFn: () => notificationsApi.getSent(kidId!),
    enabled: isAdmin && !!kidId,
  });

  const sendNotificationMutation = useMutation({
    mutationFn: (data: { kidId: string; message: string; targets: { type: string; id: string; name: string }[] }) =>
      notificationsApi.send(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'sent', kidId] });
      setShowNotifyCompose(false);
      setNotifyMessage('');
      setNotifyTargets(new Set());
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'sent', kidId] });
      setNotifyDeleteConfirm(null);
    },
  });

  const adminDismissMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.adminDismiss(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', 'sent', kidId] });
      const previous = queryClient.getQueryData(['notifications', 'sent', kidId]);
      queryClient.setQueryData(['notifications', 'sent', kidId], (old: { data?: Notification[] } | undefined) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((n: Notification) => n.id !== id) };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications', 'sent', kidId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'sent', kidId] });
    },
  });

  const { data: myNotificationsRes } = useQuery({
    queryKey: ['notifications', 'mine'],
    queryFn: () => notificationsApi.getMine(),
    enabled: isParentView || isTherapistView,
    refetchInterval: 60_000,
  });
  const allMyNotifications: Notification[] = myNotificationsRes?.data || [];
  // For therapist: show only notifications for this specific kid
  const myNotifications: Notification[] = isTherapistView
    ? allMyNotifications.filter(n => n.kidId === kidId)
    : allMyNotifications;

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await notificationsApi.markRead(id);
      if (!res.success) throw new Error(res.error || 'Failed');
      return id;
    },
    onMutate: async (id: string) => {
      setPendingReadIds(prev => new Set(prev).add(id));
      await queryClient.cancelQueries({ queryKey: ['notifications', 'mine'] });
      const previous = queryClient.getQueryData(['notifications', 'mine']);
      queryClient.setQueryData(['notifications', 'mine'], (old: { data?: Notification[] } | undefined) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((n: Notification) => n.id === id ? { ...n, read: true } : n) };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications', 'mine'], context.previous);
    },
    onSettled: (_data, _err, id) => {
      setPendingReadIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'mine'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const results = await Promise.all(ids.map(id => notificationsApi.markRead(id)));
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) throw new Error(failed[0].error || 'Failed to mark notifications as read');
    },
    onMutate: async (ids: string[]) => {
      setPendingReadIds(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next; });
      await queryClient.cancelQueries({ queryKey: ['notifications', 'mine'] });
      const previous = queryClient.getQueryData(['notifications', 'mine']);
      const idSet = new Set(ids);
      queryClient.setQueryData(['notifications', 'mine'], (old: { data?: Notification[] } | undefined) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((n: Notification) => idSet.has(n.id) ? { ...n, read: true } : n) };
      });
      return { previous };
    },
    onError: (_err, _v, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications', 'mine'], context.previous);
    },
    onSettled: (_data, _err, ids) => {
      setPendingReadIds(prev => { const next = new Set(prev); ids?.forEach(id => next.delete(id)); return next; });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'mine'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.dismiss(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', 'mine'] });
      const previous = queryClient.getQueryData(['notifications', 'mine']);
      queryClient.setQueryData(['notifications', 'mine'], (old: { data?: Notification[] } | undefined) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((n: Notification) => n.id !== id) };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications', 'mine'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'mine'] });
    },
  });

  const resetForm = () => {
    setNewName('');
    setNewMobile('');
    setNewEmail('');
    setNewType('מטפלת');
  };

  // Therapist access guard: redirect if not linked to this kid
  const practitioners = practitionersRes?.data || [];
  useEffect(() => {
    if (isTherapistView && contextPractitionerId && practitioners.length > 0) {
      const isLinked = practitioners.some((p: Practitioner) => p.id === contextPractitionerId);
      if (!isLinked) {
        navigate(links.home(), { replace: true });
      }
    }
  }, [isTherapistView, contextPractitionerId, practitioners, navigate, links]);

  const kid = kidRes?.data;
  const parents = parentsRes?.data || [];
  const goals = goalsRes?.data || [];
  const sessions = sessionsRes?.data || [];

  // Agreement status, for the card and the parent banner.
  const agreement = agreementRes?.data ?? null;
  const agreementSignatureCount = agreement ? Object.keys(agreement.signatures || {}).length : 0;
  const agreementSlotCount = 1 + parents.length;
  const agreementFullySigned = !!agreement && agreementSignatureCount >= agreementSlotCount;

  const therapists = practitioners;
  const activeGoals = goals.filter((g: Goal) => g.isActive);
  // Pending = no form, and (admin sees all, therapist only sees their own therapy sessions, parent sees none)
  const pendingSessions = sessions.filter((s: Session) => {
    if (isParentView) return false;
    // v2: only sessions that already happened, within the last two weeks
    const when = toDate(s.scheduledDate).getTime();
    if (when > Date.now() || !isRecentForPendingForm(s)) return false;
    if (!s.formId) {
      return isTherapistView ? (s.type !== 'meeting' && s.therapistId === contextPractitionerId) : true;
    }
    return false;
  });

  // Helper: is this session mine (therapist view)?
  const isOwnSession = (session: Session) =>
    !isTherapistView || session.therapistId === contextPractitionerId;

  // Copy therapist link to clipboard
  const copyTherapistLink = (pId: string) => {
    const url = `${CLASSIC_ORIGIN}/therapy/t/${pId}/`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLinkId(pId);
      setTimeout(() => setCopiedLinkId(null), 2000);
    });
  };

  // Copy parent view link to clipboard
  const copyParentLink = () => {
    const url = `${CLASSIC_ORIGIN}/therapy/p/${kidId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedParentLink(true);
      setTimeout(() => setCopiedParentLink(false), 2000);
    });
  };

  const openComposeFor = (targetKeys: string[]) => {
    setNotifyTargets(new Set(targetKeys));
    setNotifyMessage('');
    setShowNotifyCompose(true);
  };

  // Group sessions by date
  const sessionsByDate = sessions.reduce((acc: Record<string, Session[]>, s: Session) => {
    const dateKey = format(toDate(s.scheduledDate), 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(s);
    return acc;
  }, {});

  // Calendar events - one per day (grouped if multiple)
  const calendarEvents: CalendarEvent[] = Object.entries(sessionsByDate).map(([dateKey, daySessions]) => {
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
      const session = daySessions[0];
      const isMeeting = session.type === 'meeting';
      const therapist = practitioners.find((t: Practitioner) => t.id === session.therapistId);
      const isOwn = isTherapistView && session.therapistId === contextPractitionerId;
      const title = isMeeting ? 'ישיבה' : (isOwn ? 'שלי' : (therapist?.name || 'טיפול'));
      return {
        id: session.id,
        title,
        start: startDate,
        end: new Date(startDate.getTime() + 60 * 60 * 1000),
        resource: session,
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
            <Link to={links.home()} className="btn-primary" style={{ marginTop: '16px', display: 'inline-block' }}>
              חזור לדף הבית
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Handle both base64 data URLs (uploaded images) and plain filenames (static assets)
  const avatarUrl = kid.imageName
    ? (kid.imageName.startsWith('data:') ? kid.imageName : `${BASE}${kid.imageName}`)
    : DEFAULT_AVATAR;

  return (
    <div className="container">
      {/* v2 notebook header: who, a few stickers, one big action, then tiles */}
      <header className="kh">
        <div className="kh-top">
          {!isParentView ? (
            <Link to={`${links.home()}kids`} className="kh-back"><Icon name="back" size={20} /> הילדים</Link>
          ) : <span />}
          {isAdmin && (
            <button type="button" className="kh-icon-btn danger" onClick={() => setShowDeleteKid(true)} aria-label="מחיקת הילד">
              <Icon name="trash" size={20} />
            </button>
          )}
        </div>
        <div className="kh-who">
          <div className="kh-av">
            {kid.imageName ? (
              <img src={avatarUrl} alt="" className={`nb-av lg nb-av-img tone-${kidColor(kid.id)}`} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <span className={`nb-av lg tone-${kidColor(kid.id)}`}>{kid.name.charAt(0)}</span>
            )}
            {isAdmin && (
              <button type="button" className="kh-av-edit" onClick={() => setShowImageUpload(true)} aria-label="החלפת תמונה"><Icon name="edit" size={14} strokeWidth={2.4} /></button>
            )}
            {isAdmin && kid.imageName && (
              <button type="button" className="kh-av-remove" onClick={() => updateKidImageMutation.mutate('')} aria-label="הסרת התמונה"><Icon name="close" size={12} strokeWidth={2.6} /></button>
            )}
          </div>
          <div className="kh-name">
            <h1><mark className="hl-pink">{kid.name}</mark></h1>
            <div className="kh-meta">
              {kid.age && <span className="nb-sticker tone-yellow" style={{ ['--rot' as string]: '-3deg' }}>{kid.gender === 'girl' ? 'בת' : kid.gender === 'boy' ? 'בן' : 'גיל'} {kid.age}</span>}
              {isParentView && <span className="nb-chip tone-lilac">צפייה בלבד</span>}
            </div>
            {kid.kidDescription && <p className="kh-note hand">{kid.kidDescription}</p>}
          </div>
        </div>

        <div className="kh-stats">
          {!isSimplifiedView && <span className="kh-stat tone-sky" style={{ ['--rot' as string]: '-2deg' }}><b className="tabular">{activeGoals.length}</b> מטרות פעילות</span>}
          {!isSimplifiedView && <span className="kh-stat tone-mint" style={{ ['--rot' as string]: '1.5deg' }}><b className="tabular">{sessions.length}</b> טיפולים</span>}
          {pendingSessions.length > 0 && <span className="kh-stat tone-pink" style={{ ['--rot' as string]: '-1deg' }}><b className="tabular">{pendingSessions.length}</b> ממתינים לטופס</span>}
        </div>

        {!isParentView && (
          <Link to={links.formNew({ kidId: kidId! })} className="nb-btn xl block kh-main-cta"><Icon name="form" /> מילוי טופס טיפול</Link>
        )}

        <div className="kh-tiles">
          <Link to={links.kidAgenda(kidId!)} className="kh-tile tone-sky"><Icon name="agenda" /><span>סדר יום</span></Link>
          <Link to={links.kidDailyReports(kidId!)} className="kh-tile tone-mint"><Icon name="report" /><span>דיווח יומי</span></Link>
          {isParentView && <Link to={`/p/${kidId}/chat`} className="kh-tile tone-lilac"><Icon name="sparkle" /><span>צ׳אט AI</span></Link>}
          {!isSimplifiedView && <a href={`/board.html?kid=${kidId}`} className="kh-tile tone-yellow"><Icon name="board" /><span>לוח משימות</span></a>}
          {!isSimplifiedView && <a href={`/board.html?kid=${kidId}&mode=edit`} className="kh-tile tone-peach"><Icon name="edit" /><span>עריכת הלוח</span></a>}
          {!isSimplifiedView && <a href={`/stats.html?kid=${kidId}`} className="kh-tile tone-lilac"><Icon name="chart" /><span>סטטיסטיקה</span></a>}
          {isParentView && <Link to={`/p/${kidId}/models`} className="kh-tile tone-peach"><Icon name="blocks" /><span>מודלים</span></Link>}
          {kid && <div className="kh-tile-game"><GameLauncher kid={kid} variant="toolbar" /></div>}
        </div>
      </header>

      {/* Treatment agreement banner — parents see it wherever they are in the
          page, since signing is the one thing they may have come here to do. */}
      {isParentView && agreement && agreement.status === 'active' && !agreementFullySigned && (
        <Link to={`/p/${kidId}/agreement`} className="kp-banner">
          <Icon name="sign" size={30} />
          <span>
            <strong>הסכם הטיפול ממתין לחתימתכם</strong>
            <small>לחצו כאן לעיון ולחתימה</small>
          </span>
        </Link>
      )}

      {/* Pill Tab Bar */}
      {(() => {
        const unreadCount = isSimplifiedView
          ? myNotifications.filter(n => !n.read).length
          : (sentNotificationsRes?.data || []).filter((n: Notification) => !n.read).length;
        return (
          <div className="kid-tab-bar kid-tab-bar-desktop">
            <button className={`kid-tab${kidTab === 'overview' ? ' active' : ''}`} onClick={() => setKidTab('overview')}>
              סקירה
            </button>
            <button className={`kid-tab${kidTab === 'sessions' ? ' active' : ''}`} onClick={() => setKidTab('sessions')}>
              טיפולים
            </button>
            <button className={`kid-tab${kidTab === 'progress' ? ' active' : ''}`} onClick={() => setKidTab('progress')}>
              התקדמות
            </button>
            {showNotebook && (
              <button className={`kid-tab${kidTab === 'notebook' ? ' active' : ''}`} onClick={() => setKidTab('notebook')}>
                מחברת
              </button>
            )}
            <button className={`kid-tab${kidTab === 'notifications' ? ' active' : ''}`} onClick={() => setKidTab('notifications')}>
              הודעות
              {unreadCount > 0 && <span className="kid-tab-badge">{unreadCount}</span>}
            </button>
            <button className={`kid-tab${kidTab === 'plans' ? ' active' : ''}`} onClick={() => setKidTab('plans')}>
              איסוף נתונים
            </button>
            {!isParentView && (
              <button className={`kid-tab${kidTab === 'learning-plans' ? ' active' : ''}`} onClick={() => setKidTab('learning-plans')}>
                תוכניות למידה
              </button>
            )}
            {(isParentView || isAdmin || isTherapistView) && (
              <button className={`kid-tab${kidTab === 'crew-hours' ? ' active' : ''}`} onClick={() => setKidTab('crew-hours')}>
                שעות צוות
              </button>
            )}
          </div>
        );
      })()}

      {/* === OVERVIEW TAB === */}
      {kidTab === 'overview' && <>
      <div className="kp-ov">
        {/* Team — one clean list, line-icon actions */}
        <section className="nb-card kp-team">
          <div className="kp-sec-head">
            <h2 className="nb-h2"><Icon name="team" /> צוות</h2>
            {isAdmin && (practitioners.length > 0 || parents.length > 0) && (
              <button
                type="button"
                className="nb-btn-ghost sm"
                onClick={() => openComposeFor([
                  ...practitioners.map((p: Practitioner) => `p:${p.id}`),
                  ...parents.map((p: Parent) => `par:${p.id}`),
                ])}
              ><Icon name="chat" size={18} /> הודעה לכולם</button>
            )}
          </div>

          {/* Therapists */}
          <div className="kp-sub-head">
            <span>צוות טיפולי <span className="kp-count tabular">{therapists.length}</span></span>
            {isAdmin && (
              <div className="kp-sub-actions">
                {practitioners.length > 0 && (
                  <button type="button" className="kp-text-btn" onClick={() => openComposeFor(practitioners.map((p: Practitioner) => `p:${p.id}`))} title="שלח הודעה לכל הצוות">
                    שלח לכולם
                  </button>
                )}
                <button type="button" className="kp-icon-btn is-add" onClick={() => setShowAddPractitioner(true)} aria-label="הוספת איש צוות" title="הוספת איש צוות">
                  <Icon name="plus" size={20} />
                </button>
              </div>
            )}
          </div>
          {practitioners.length === 0 ? (
            <p className="kp-empty-line hand">אין מטפלות עדיין</p>
          ) : (
            <ul className="kp-people">
              {practitioners.map((p: Practitioner) => (
                <li key={p.id} className="kp-person">
                  <span className={`nb-av sm tone-${kidColor(p.id)}`} aria-hidden="true">{p.name.charAt(0)}</span>
                  <div className="kp-person-txt">
                    <div className="kp-person-name">
                      <b>{p.name}</b>
                      <small>{p.type}</small>
                      {copiedLinkId === p.id && <span className="nb-chip tone-mint kp-copied">הקישור הועתק</span>}
                    </div>
                    {(p.mobile || p.email) && (
                      <div className="kp-person-contact" dir="ltr">{[p.mobile, p.email].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="kp-acts">
                      <button type="button" className="kp-icon-btn" onClick={() => openComposeFor([`p:${p.id}`])} title="שלח הודעה" aria-label={`שליחת הודעה ל${p.name}`}><Icon name="chat" size={19} /></button>
                      {p.type === 'מטפלת' && (
                        <button type="button" className="kp-icon-btn" onClick={() => copyTherapistLink(p.id)} title="העתק קישור מטפלת" aria-label="העתקת קישור מטפלת"><Icon name="link" size={19} /></button>
                      )}
                      <button type="button" className="kp-icon-btn" onClick={() => setEditingPractitioner(p)} title="עריכה" aria-label={`עריכת ${p.name}`}><Icon name="edit" size={19} /></button>
                      <button type="button" className="kp-icon-btn is-danger" onClick={() => unlinkPractitionerMutation.mutate(p.id)} title="הסרה מהצוות" aria-label={`הסרת ${p.name} מהצוות`}><Icon name="trash" size={19} /></button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Parents */}
          <div className="kp-sub-head">
            <span>הורים <span className="kp-count tabular">{parents.length}</span></span>
            {isAdmin && (
              <div className="kp-sub-actions">
                {parents.length > 0 && (
                  <button type="button" className="kp-text-btn" onClick={() => openComposeFor(parents.map((p: Parent) => `par:${p.id}`))} title="שלח הודעה לכל ההורים">
                    שלח לכולם
                  </button>
                )}
                <button type="button" className="kp-icon-btn is-add" onClick={() => setShowAddParent(true)} aria-label="הוספת הורה" title="הוספת הורה">
                  <Icon name="plus" size={20} />
                </button>
              </div>
            )}
          </div>
          {parents.length === 0 ? (
            <p className="kp-empty-line hand">אין הורים עדיין</p>
          ) : (
            <ul className="kp-people">
              {parents.map((p: Parent) => (
                <li key={p.id} className="kp-person">
                  <span className={`nb-av sm tone-${kidColor(p.id)}`} aria-hidden="true">{p.name.charAt(0)}</span>
                  <div className="kp-person-txt">
                    <div className="kp-person-name">
                      <b>{p.name}</b>
                      {copiedParentLink && <span className="nb-chip tone-mint kp-copied">הקישור הועתק</span>}
                    </div>
                    {(p.mobile || p.email) && (
                      <div className="kp-person-contact" dir="ltr">
                        {p.mobile && <a href={`tel:${p.mobile}`}>{p.mobile}</a>}
                        {p.mobile && p.email && ' · '}
                        {p.email && <a href={`mailto:${p.email}`}>{p.email}</a>}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="kp-acts">
                      <button type="button" className="kp-icon-btn" onClick={copyParentLink} title="העתק קישור הורה (צפייה בלבד)" aria-label="העתקת קישור הורה"><Icon name="link" size={19} /></button>
                      <button type="button" className="kp-icon-btn" onClick={() => setEditingParent(p)} title="עריכה" aria-label={`עריכת ${p.name}`}><Icon name="edit" size={19} /></button>
                      <button type="button" className="kp-icon-btn is-danger" onClick={() => deleteParentMutation.mutate(p.id)} title="מחיקה" aria-label={`מחיקת ${p.name}`}><Icon name="trash" size={19} /></button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="kp-ov-side">
          {/* Treatment Agreement — between the analyst and the parents only. A sticky note. */}
          {!isTherapistView && (
            <section className={`kp-sticky ${!agreement ? 'tone-lilac' : agreementFullySigned ? 'tone-mint' : agreement.status === 'draft' ? 'tone-lilac' : 'tone-yellow'}`}>
              <div className="kp-sticky-head">
                <h2 className="nb-h2"><Icon name="sign" /> הסכם טיפול</h2>
                <Link to={links.kidAgreement(kidId!)} className="kp-more-link">
                  {isParentView ? 'צפייה' : 'ניהול'} <Icon name="chevron" size={16} />
                </Link>
              </div>
              {!agreement ? (
                <div className="kp-sticky-body">
                  <p className="kp-sticky-txt hand">
                    {isAdmin ? 'טרם נוצר הסכם התקשרות.' : 'אין כרגע הסכם לחתימה.'}
                  </p>
                  {isAdmin && (
                    <Link to={links.kidAgreement(kidId!)} className="nb-btn-ghost sm kp-sticky-btn"><Icon name="plus" size={18} /> יצירת הסכם</Link>
                  )}
                </div>
              ) : (
                <div className="kp-sticky-body">
                  <div className="kp-sticky-row">
                    {agreement.status === 'draft' ? (
                      <span className="nb-chip kp-chip-paper">טיוטה</span>
                    ) : agreementFullySigned ? (
                      <span className="nb-chip kp-chip-paper"><Icon name="check" size={15} /> נחתם על ידי כל הצדדים</span>
                    ) : (
                      <span className="nb-chip kp-chip-paper">ממתין לחתימות</span>
                    )}
                    <span className="kp-sticky-count tabular"><b>{agreementSignatureCount}</b> מתוך {agreementSlotCount} חתימות</span>
                  </div>
                  <div className="kp-sig-track" aria-hidden="true">
                    <div className="kp-sig-fill" style={{ width: `${Math.round((agreementSignatureCount / agreementSlotCount) * 100)}%` }} />
                  </div>
                  {agreement.status === 'active' && !agreementFullySigned && (
                    <Link to={links.kidAgreement(kidId!)} className="nb-btn kp-sticky-cta">
                      <Icon name="sign" size={20} /> {isParentView ? 'עיון וחתימה' : 'מעבר להסכם'}
                    </Link>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Goals — grouped by category, marker colours */}
          <section className="nb-card kp-goals">
            <div className="kp-sec-head">
              <h2 className="nb-h2"><Icon name="target" /> מטרות <span className="kp-count tabular">{activeGoals.length}</span></h2>
              <Link to={links.kidGoals(kidId!)} className="kp-more-link">
                {isSimplifiedView ? 'צפייה' : 'ניהול'} <Icon name="chevron" size={16} />
              </Link>
            </div>
            {activeGoals.length === 0 ? (
              <div className="kp-empty">
                <p className="hand">אין מטרות פעילות</p>
                {isAdmin && (
                  <Link to={links.kidGoals(kidId!)} className="nb-btn-ghost sm"><Icon name="plus" size={18} /> הוספת מטרות</Link>
                )}
              </div>
            ) : (
              <div className="kp-goal-cats">
                {GOAL_CATEGORIES.map((cat) => {
                  const catGoals = goalsByCategory[cat.id] || [];
                  if (catGoals.length === 0) return null;
                  return (
                    <div key={cat.id} className={`kp-goal-cat tone-${CATEGORY_TONE[cat.id] || 'lilac'}`}>
                      <div className="kp-goal-cat-head">
                        <span className="nb-chip">{CATEGORY_LABEL[cat.id] || cat.nameHe}</span>
                        <span className="kp-count tabular">{catGoals.length}</span>
                      </div>
                      <ul className="kp-goal-list">
                        {catGoals.slice(0, 3).map((g: Goal) => (
                          <li key={g.id}><span className="nb-dot" />{g.title}</li>
                        ))}
                        {catGoals.length > 3 && (
                          <li className="kp-goal-more">ועוד {catGoals.length - 3}</li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
      </>}

      {/* === PROGRESS TAB === */}
      {kidTab === 'progress' && <>
      <section className="nb-card kp-panel">
        <div className="kp-sec-head">
          <h2 className="nb-h2"><Icon name="chart" /> התקדמות מטרות</h2>
        </div>
        <GoalProgressChart kidId={kidId!} />
      </section>
      </>}

      {/* === SESSIONS TAB === */}
      {kidTab === 'sessions' && <>
      <section className="nb-card kp-panel kp-sessions">
        <div className="kp-sec-head kp-sec-head-wrap">
          <h2 className="nb-h2"><Icon name="calendar" /> טיפולים</h2>
          {!isReadOnly && (
            <div className="kp-toolbar">
              {isAdmin && (
                <button type="button" onClick={() => setShowTemplateEditor(true)} className="nb-btn-ghost sm">
                  <Icon name="settings" size={17} /> תבנית טופס
                </button>
              )}
              <button type="button" onClick={() => navigate(links.formNew({ kidId: kidId! }))} className="nb-btn-ghost sm">
                <Icon name="form" size={17} /> מלא טופס
              </button>
              {isAdmin && (
                <button type="button" onClick={() => setShowScheduleSession(true)} className="btn-primary btn-small kp-hide-m">
                  <Icon name="plus" size={17} /> פגישה חדשה
                </button>
              )}
            </div>
          )}
        </div>

        {pendingSessions.length > 0 && (
          <div className="kp-pending">
            <span className="nb-sticker tone-pink" style={{ ['--rot' as string]: '-1.5deg' }}>
              <b className="tabular">{pendingSessions.length}</b> טיפולים ממתינים לטופס
            </span>
          </div>
        )}

        {/* Calendar */}
        <div className="calendar-container kp-cal">
          <DnDCalendar
            localizer={localizer}
            formats={calendarFormats}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            view="month"
            views={['month']}
            date={calendarDate}
            onNavigate={(newDate) => setCalendarDate(newDate)}
            rtl
            selectable={!isReadOnly}
            draggableAccessor={() => isAdmin}
            onEventDrop={({ event, start }: { event: CalendarEvent; start: Date | string }) => {
              if (!isAdmin) return;
              const { resource } = event;
              if ('isMultiple' in resource && resource.isMultiple) return;
              const session = resource as Session;
              const oldDate = toDate(session.scheduledDate);
              const newStart = new Date(start);
              newStart.setHours(oldDate.getHours(), oldDate.getMinutes());
              updateSessionMutation.mutate({
                id: session.id,
                data: { scheduledDate: newStart.toISOString() as unknown as Date },
              });
            }}
            onSelectSlot={(slotInfo) => {
              if (isReadOnly) return;
              if (isTherapistView) {
                // Therapist: directly go to fill form
                setSelectedDate(slotInfo.start);
                navigate(links.formNew({ kidId: kidId!, date: format(slotInfo.start, 'yyyy-MM-dd') }));
              } else {
                setSelectedDate(slotInfo.start);
                setScheduleDate(format(slotInfo.start, 'yyyy-MM-dd'));
                setShowDateActions(true);
              }
            }}
            style={{ height: 420 }}
            components={{
              event: ({ event }) => {
                const resource = event.resource as Session | { isMultiple: true; sessions: Session[]; allHaveForms: boolean; someHaveForms: boolean };

                // Multiple sessions on same day
                if ('isMultiple' in resource && resource.isMultiple) {
                  const { sessions: daySessions, allHaveForms, someHaveForms } = resource;
                  return (
                    <div
                      className="calendar-event"
                      style={isReadOnly ? { cursor: 'default' } : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isReadOnly) return;
                        setDaySessionsList(daySessions);
                        setSelectedDate(event.start as Date);
                        setShowDaySessions(true);
                      }}
                    >
                      <span className="calendar-event-indicator">
                        {allHaveForms ? <Icon name="check" size={11} strokeWidth={3} /> : someHaveForms ? '!' : <span className="kp-ev-dot" />}
                      </span>
                      <span className="calendar-event-title">{daySessions.length} טיפולים</span>
                    </div>
                  );
                }

                // Single session
                const session = resource as Session;
                const hasForm = session.formId;
                const own = isOwnSession(session);
                const isMeeting = session.type === 'meeting';
                const canFill = isReadOnly ? false : (isMeeting ? isAdmin : own);
                return (
                  <div
                    className={`calendar-event${!own && !isMeeting ? ' calendar-event-other' : ''}`}
                    style={isReadOnly ? { cursor: 'default' } : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isReadOnly) return;
                      if (hasForm) {
                        navigate(isMeeting ? links.meetingFormView(session.formId!) : links.formView(session.formId!));
                      } else if (canFill) {
                        const sessionDateStr = format(toDate(session.scheduledDate), 'yyyy-MM-dd');
                        navigate(isMeeting
                          ? links.meetingFormNew({ kidId: kidId!, sessionId: session.id, date: sessionDateStr })
                          : links.formNew({ kidId: kidId!, sessionId: session.id, date: sessionDateStr }));
                      }
                    }}
                  >
                    {isAdmin && !hasForm ? (
                      <span
                        className="calendar-event-indicator"
                        onClick={(e) => { e.stopPropagation(); openEditSession(session); }}
                        title="ערוך פגישה"
                        style={{ cursor: 'pointer' }}
                      ><Icon name="edit" size={11} strokeWidth={2.4} /></span>
                    ) : (
                      <span className="calendar-event-indicator">
                        {hasForm ? <Icon name="check" size={11} strokeWidth={3} /> : (canFill ? <Icon name="edit" size={11} strokeWidth={2.4} /> : <span className="kp-ev-dot" />)}
                      </span>
                    )}
                    <span className="calendar-event-title" style={{ flex: 1 }}>{event.title}</span>
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSessionToDelete(session); }}
                        className="calendar-event-delete"
                        title="בטל פגישה"
                        aria-label="ביטול פגישה"
                      ><Icon name="close" size={11} strokeWidth={2.6} /></button>
                    )}
                  </div>
                );
              },
            }}
            eventPropGetter={(event) => {
              const resource = event.resource as Session | { isMultiple: true; sessions: Session[]; allHaveForms: boolean; someHaveForms: boolean };

              if ('isMultiple' in resource && resource.isMultiple) {
                const { allHaveForms, someHaveForms, sessions: daySess } = resource;
                const tone = allHaveForms ? 'mint' : someHaveForms ? 'sky' : kidColor(daySess[0]?.therapistId);
                return {
                  className: 'kp-ev',
                  style: { backgroundColor: `var(--m-${tone})`, cursor: 'pointer' },
                };
              }

              const session = resource as Session;
              const own = isOwnSession(session);
              const isMeeting = session.type === 'meeting';
              const canFillStyle = isReadOnly ? false : (isMeeting ? isAdmin : own);
              const tone = session.formId ? 'mint' : isMeeting ? 'lilac' : kidColor(session.therapistId);
              return {
                className: `kp-ev${session.formId ? ' is-done' : ''}`,
                style: {
                  backgroundColor: `var(--m-${tone})`,
                  cursor: (canFillStyle || session.formId) ? 'pointer' : 'default',
                  opacity: (!own && !isMeeting && !isParentView) ? 0.6 : 1,
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
          {/* Mobile add session button - admin only */}
          {isAdmin && (
            <button
              type="button"
              className="nb-btn block kp-add-session"
              onClick={() => setShowScheduleSession(true)}
            >
              <Icon name="plus" /> הוספת פגישה
            </button>
          )}
        </div>
      </section>

      {/* Sessions List — collapsible */}
      {(() => {
        const now = new Date();
        const futureSessions = [...sessions]
          .filter((s: Session) => toDate(s.scheduledDate) >= now)
          .sort((a: Session, b: Session) => toDate(a.scheduledDate).getTime() - toDate(b.scheduledDate).getTime());
        const pastSessions = [...sessions]
          .filter((s: Session) => toDate(s.scheduledDate) < now)
          .sort((a: Session, b: Session) => toDate(b.scheduledDate).getTime() - toDate(a.scheduledDate).getTime());

        const renderSession = (session: Session) => {
          const therapist = practitioners.find((t: Practitioner) => t.id === session.therapistId);
          const hasForm = session.formId;
          const own = isOwnSession(session);
          const isMeeting = session.type === 'meeting';
          const canFill = isReadOnly ? false : (isMeeting ? isAdmin : own);
          const d = toDate(session.scheduledDate);
          return (
            <li key={session.id} className={`kp-srow${!own && !isMeeting ? ' is-other' : ''}`}>
              <div className="kp-srow-date">
                <b className="tabular">{d.getDate()}</b>
                <small>{HE_MONTHS[d.getMonth()].slice(0, 3)}׳ · {HE_DAY_SHORT[d.getDay()]}</small>
              </div>
              <div className="kp-srow-main">
                <div className="kp-srow-title">
                  <span className={`nb-chip ${isMeeting ? 'tone-lilac' : `tone-${kidColor(session.therapistId)}`}`}>{isMeeting ? 'ישיבה' : 'טיפול'}</span>
                  {!isMeeting && therapist && <b className="kp-ell">{therapist.name}</b>}
                </div>
                <div className="kp-srow-meta tabular">
                  {format(d, 'HH:mm')} · {format(d, 'dd/MM/yyyy')}
                </div>
              </div>
              <span className={`nb-sticker kp-status ${hasForm ? 'tone-mint' : 'tone-pink'}`} style={{ ['--rot' as string]: hasForm ? '2deg' : '-2deg' }}>
                {hasForm ? 'הושלם' : 'ממתין'}
              </span>
              <div className="kp-srow-acts">
                {hasForm ? (
                  <button type="button" className="nb-btn-ghost sm" onClick={() => navigate(isMeeting ? links.meetingFormView(session.formId!) : links.formView(session.formId!))}>
                    צפייה
                  </button>
                ) : isReadOnly ? (
                  <span className="kp-srow-note">טרם הושלם</span>
                ) : canFill ? (
                  <button
                    type="button"
                    onClick={() => navigate(isMeeting
                      ? links.meetingFormNew({ kidId: kidId!, sessionId: session.id })
                      : links.formNew({ kidId: kidId!, sessionId: session.id }))}
                    className="btn-primary btn-small"
                  >
                    <Icon name="form" size={16} /> מילוי
                  </button>
                ) : (
                  <span className="kp-srow-note">מפגש אחר</span>
                )}
                {isAdmin && (
                  <>
                    <button type="button" onClick={() => openEditSession(session)} className="kp-icon-btn" title="ערוך מפגש" aria-label="עריכת מפגש"><Icon name="edit" size={18} /></button>
                    <button type="button" onClick={() => setSessionToDelete(session)} className="kp-icon-btn is-danger" title="מחק מפגש" aria-label="מחיקת מפגש"><Icon name="trash" size={18} /></button>
                  </>
                )}
              </div>
            </li>
          );
        };

        return (
          <section className="nb-card kp-panel">
            <button type="button" className="kp-fold" onClick={() => setSessionsSectionExpanded(e => !e)} aria-expanded={sessionsSectionExpanded}>
              <span className="nb-h2"><Icon name="agenda" /> מפגשים <span className="kp-count tabular">{sessions.length}</span></span>
              {pendingSessions.length > 0 && <span className="nb-chip tone-pink">{pendingSessions.length} ממתינים</span>}
              <span className={`kp-fold-chev${sessionsSectionExpanded ? ' is-open' : ''}`}><Icon name="chevron" size={20} /></span>
            </button>
            {sessionsSectionExpanded && (
              sessions.length === 0 ? (
                <p className="kp-empty-line hand">אין מפגשים עדיין</p>
              ) : (
                <div className="kp-scols" data-tab={sessionsTab}>
                  <div className="kp-seg kp-show-m" role="tablist">
                    <button type="button" role="tab" aria-selected={sessionsTab === 'future'} className={`kp-seg-btn${sessionsTab === 'future' ? ' is-on' : ''}`} onClick={() => setSessionsTab('future')}>
                      קרובים <span className="tabular">({futureSessions.length})</span>
                    </button>
                    <button type="button" role="tab" aria-selected={sessionsTab === 'past'} className={`kp-seg-btn${sessionsTab === 'past' ? ' is-on' : ''}`} onClick={() => setSessionsTab('past')}>
                      קודמים <span className="tabular">({pastSessions.length})</span>
                    </button>
                  </div>
                  <div className="kp-scol kp-scol-future">
                    <h3 className="kp-h3 kp-hide-m"><mark className="hl-sky">קרובים</mark> <span className="nb-muted tabular">{futureSessions.length}</span></h3>
                    {futureSessions.length === 0
                      ? <p className="kp-empty-line hand">אין מפגשים קרובים</p>
                      : <ul className="kp-srows">{futureSessions.map(renderSession)}</ul>}
                  </div>
                  <div className="kp-scol kp-scol-past">
                    <h3 className="kp-h3 kp-hide-m"><mark className="hl-yellow">קודמים</mark> <span className="nb-muted tabular">{pastSessions.length}</span></h3>
                    {pastSessions.length === 0
                      ? <p className="kp-empty-line hand">אין מפגשים קודמים</p>
                      : <ul className="kp-srows">{pastSessions.map(renderSession)}</ul>}
                  </div>
                </div>
              )
            )}
          </section>
        );
      })()}

      {/* Data Collection Section — collapsible */}
      {(() => {
        const allDc = (allDcRes?.data || []) as KidGoalDataEntry[];
        const pendingCount = allDc.filter(e => e.status === 'pending').length;
        return (
          <section className="nb-card kp-panel">
            <button type="button" className="kp-fold" onClick={() => setDcSectionExpanded(e => !e)} aria-expanded={dcSectionExpanded}>
              <span className="nb-h2"><Icon name="report" /> איסוף נתונים <span className="kp-count tabular">{allDc.length}</span></span>
              {pendingCount > 0 && <span className="nb-chip tone-pink">{pendingCount} ממתינים</span>}
              <span className={`kp-fold-chev${dcSectionExpanded ? ' is-open' : ''}`}><Icon name="chevron" size={20} /></span>
            </button>
            {dcSectionExpanded && (
              <div className="kp-fold-body">
                {!isReadOnly && (
                  <div className="kp-toolbar kp-toolbar-start">
                    <button type="button" className="btn-primary btn-small" onClick={() => { setDcModalEntry(null); setDcModalOpen(true); }}>
                      <Icon name="plus" size={17} /> טופס איסוף נתונים
                    </button>
                    {isAdmin && (
                      <button type="button" className="nb-btn-ghost sm" onClick={() => setCreatePendingDcOpen(true)}>
                        <Icon name="plus" size={17} /> טופס ממתין
                      </button>
                    )}
                  </div>
                )}
                {allDc.length === 0 ? (
                  <p className="kp-empty-line hand">אין רשומות איסוף נתונים</p>
                ) : (
                  <ul className="kp-srows">
                    {allDc.map(entry => {
                      const therapist = practitioners.find((t: Practitioner) => t.id === entry.practitionerId);
                      const dateStr = entry.sessionDate ? format(toDate(entry.sessionDate), 'dd/MM/yyyy') : '';
                      const isPending = entry.status === 'pending';
                      return (
                        <li key={entry.id} className="kp-srow kp-dcrow">
                          <div className="kp-srow-main">
                            <div className="kp-srow-title"><b className="kp-wrap">{entry.goalTitle}</b></div>
                            <div className="kp-srow-meta tabular">{dateStr}{therapist ? ` · ${therapist.name}` : ''}</div>
                          </div>
                          <span className={`nb-sticker kp-status ${isPending ? 'tone-pink' : 'tone-mint'}`} style={{ ['--rot' as string]: isPending ? '-2deg' : '2deg' }}>
                            {isPending ? 'ממתין' : 'מולא'}
                          </span>
                          <div className="kp-srow-acts">
                            {isPending ? (
                              <button type="button" className="btn-primary btn-small" onClick={() => { setDcModalEntry(entry); setDcModalOpen(true); }}>מילוי</button>
                            ) : (
                              <button type="button" className="kp-icon-btn" onClick={() => { setDcModalEntry(entry); setDcModalOpen(true); }} title="עריכה" aria-label="עריכה"><Icon name="edit" size={18} /></button>
                            )}
                            {dcDeleteConfirm === entry.id ? (
                              <>
                                <button type="button" className="btn-danger btn-small" onClick={() => deleteDcMutation.mutate(entry)}>מחיקה</button>
                                <button type="button" className="nb-btn-ghost sm" onClick={() => setDcDeleteConfirm(null)}>ביטול</button>
                              </>
                            ) : (
                              <button type="button" className="kp-icon-btn is-danger" onClick={() => setDcDeleteConfirm(entry.id)} title="מחיקה" aria-label="מחיקה"><Icon name="trash" size={18} /></button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>
        );
      })()}

      {/* DC Entry Modal */}
      {dcModalOpen && (
        <DcEntryModal
          kidId={kidId!}
          goals={goals}
          practitioners={practitioners}
          entry={dcModalEntry}
          onClose={() => { setDcModalOpen(false); setDcModalEntry(null); }}
        />
      )}

      {createPendingDcOpen && (
        <CreatePendingDcModal
          kidId={kidId!}
          goals={goals}
          practitioners={practitioners}
          onClose={() => setCreatePendingDcOpen(false)}
        />
      )}

      {/* Summaries Section — collapsible */}
      {(() => {
        const summaries: Summary[] = (summariesRes?.data || []);
        const sorted = [...summaries].sort((a, b) => {
          const ta = toDate(a.createdAt)?.getTime() || 0;
          const tb = toDate(b.createdAt)?.getTime() || 0;
          return tb - ta;
        });
        return (
          <section className="nb-card kp-panel">
            <button type="button" className="kp-fold" onClick={() => setSummariesExpanded(e => !e)} aria-expanded={summariesExpanded}>
              <span className="nb-h2"><Icon name="book" /> סיכומים <span className="kp-count tabular">{sorted.length}</span></span>
              <span className={`kp-fold-chev${summariesExpanded ? ' is-open' : ''}`}><Icon name="chevron" size={20} /></span>
            </button>
            {summariesExpanded && (
              sorted.length === 0 ? (
                <p className="kp-empty-line hand">אין סיכומים עדיין</p>
              ) : (
                <ul className="kp-srows">
                  {sorted.map(s => {
                    const from = toDate(s.fromDate);
                    const to = toDate(s.toDate);
                    return (
                      <li key={s.id}>
                        <Link to={links.summaryView(s.id)} className="kp-srow kp-srow-link">
                          <div className="kp-srow-main">
                            <div className="kp-srow-title"><b className="kp-ell">{s.title || 'סיכום תקופתי'}</b></div>
                            <div className="kp-srow-meta tabular">{from ? format(from, 'dd/MM') : '?'} – {to ? format(to, 'dd/MM/yy') : '?'}</div>
                          </div>
                          <Icon name="chevron" size={20} className="kp-srow-chev" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )
            )}
          </section>
        );
      })()}
      </>}

      {/* === NOTIFICATIONS TAB === */}
      {kidTab === 'notifications' && <>

      {/* Incoming notifications - Therapist/Parent */}
      {isSimplifiedView && (
        <section className="nb-card kp-panel">
          <div className="kp-sec-head">
            <h2 className="nb-h2"><Icon name="bell" /> הודעות נכנסות</h2>
            {myNotifications.some(n => !n.read) && (
              <button type="button" className="nb-btn-ghost sm" onClick={() => {
                const unreadIds = myNotifications.filter(n => !n.read && !pendingReadIds.has(n.id)).map(n => n.id);
                if (unreadIds.length > 0) markAllReadMutation.mutate(unreadIds);
              }}>
                <Icon name="check" size={17} /> סמן הכל כנקרא
              </button>
            )}
          </div>
          {myNotifications.length === 0 ? (
            <div className="kp-empty"><Icon name="bell" size={30} /><p className="hand">אין הודעות</p></div>
          ) : (
            <ul className="kp-inbox">
              {myNotifications.map((n: Notification) => {
                const isRead = n.read || pendingReadIds.has(n.id);
                return (
                  <li key={n.id} className={`kp-msg${isRead ? '' : ' is-unread'}`}>
                    <span className="kp-msg-dot" aria-label={isRead ? 'נקרא' : 'לא נקרא'} />
                    <div className="kp-msg-body">
                      <p className="kp-msg-text">{n.message}</p>
                      <div className="kp-msg-meta tabular">{format(toDate(n.createdAt), 'dd/MM/yyyy HH:mm')}</div>
                    </div>
                    <div className="kp-msg-acts">
                      {!isRead && (
                        <button
                          type="button"
                          className="btn-primary btn-small"
                          onClick={() => markReadMutation.mutate(n.id)}
                          disabled={pendingReadIds.has(n.id)}
                        ><Icon name="check" size={16} /> נקרא</button>
                      )}
                      <button type="button" className="kp-text-btn" onClick={() => dismissMutation.mutate(n.id)}>הסתר</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Admin notifications - sent log */}
      {isAdmin && (() => {
        const sentNotifications: Notification[] = sentNotificationsRes?.data || [];
        return (
          <section className="nb-card kp-panel">
            <div className="kp-sec-head">
              <h2 className="nb-h2"><Icon name="chat" /> הודעות שנשלחו</h2>
              <button type="button" className="btn-primary btn-small" onClick={() => setShowNotifyCompose(true)}>
                <Icon name="plus" size={17} /> הודעה חדשה
              </button>
            </div>

            {/* Sent log */}
            {sentNotifications.length === 0 ? (
              <div className="kp-empty"><Icon name="chat" size={30} /><p className="hand">לא נשלחו הודעות</p></div>
            ) : (
              <ul className="kp-inbox">
                {sentNotifications.map((n: Notification) => (
                  <li key={n.id} className="kp-msg">
                    <span className={`nb-av sm tone-${n.recipientType === 'practitioner' ? kidColor(n.recipientId) : 'mint'}`} aria-hidden="true">{(n.recipientName || '?').charAt(0)}</span>
                    <div className="kp-msg-body">
                      <div className="kp-msg-to">
                        <b>{n.recipientName}</b>
                        <small>{n.recipientType === 'practitioner' ? 'צוות' : 'הורים'}</small>
                      </div>
                      <p className="kp-msg-text">{n.message}</p>
                      <div className="kp-msg-meta tabular">
                        {format(toDate(n.createdAt), 'dd/MM/yyyy HH:mm')}
                        {n.read
                          ? <span className="nb-chip tone-mint kp-msg-state"><Icon name="check" size={13} strokeWidth={2.6} /> נקרא</span>
                          : <span className="nb-chip tone-yellow kp-msg-state">לא נקרא</span>}
                      </div>
                    </div>
                    <div className="kp-msg-acts">
                      <button type="button" className="kp-text-btn" onClick={() => adminDismissMutation.mutate(n.id)}>הסתר</button>
                      {notifyDeleteConfirm === n.id ? (
                        <>
                          <button
                            type="button"
                            className="btn-danger btn-small"
                            onClick={() => deleteNotificationMutation.mutate(n.id)}
                            disabled={deleteNotificationMutation.isPending}
                          >מחיקה</button>
                          <button type="button" className="kp-text-btn" onClick={() => setNotifyDeleteConfirm(null)}>ביטול</button>
                        </>
                      ) : (
                        <button type="button" className="kp-icon-btn is-danger" onClick={() => setNotifyDeleteConfirm(n.id)} title="מחיקה" aria-label="מחיקת ההודעה"><Icon name="trash" size={18} /></button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })()}
      </>}

      {/* === PLANS TAB === */}
      {kidTab === 'plans' && (
        <GoalPlansTab
          kidId={kidId!}
          goals={goals}
          practitioners={practitioners}
          isReadOnly={isReadOnly}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
          practitionerId={contextPractitionerId || undefined}
        />
      )}

      {/* === LEARNING PLANS TAB === */}
      {kidTab === 'learning-plans' && (
        <LearningPlansTab
          kidId={kidId!}
          goals={goals}
          isReadOnly={isReadOnly}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {/* === NOTEBOOK (documents) TAB === */}
      {kidTab === 'notebook' && showNotebook && <KidDocsTab kidId={kidId!} />}

      {/* === CREW HOURS TAB === */}
      {kidTab === 'crew-hours' && (
        <CrewHoursTab kidId={kidId!} />
      )}

      {/* Admin-only Modals — always rendered, outside tabs */}
      {isAdmin && (
        <>
          {/* Add Practitioner Modal */}
          {showAddPractitioner && (() => {
            const linkedIds = new Set(practitioners.map((p: Practitioner) => p.id));
            const available = (myTherapistsRes?.data || []).filter((p: Practitioner) => !linkedIds.has(p.id));
            const query = practitionerSearch.trim().toLowerCase();
            const shown = query
              ? available.filter((p: Practitioner) =>
                  [p.name, p.type, p.mobile, p.email].some((v) => (v || '').toLowerCase().includes(query)))
              : available;
            const closeAdd = () => { setShowAddPractitioner(false); setShowNewPractitionerForm(false); setPractitionerSearch(''); resetForm(); };
            return (
              <AddModal title="הוספת איש צוות" onClose={closeAdd}>
                {/* Pick existing — search on top, the list scrolls, "add new" stays in view */}
                {!showNewPractitionerForm && available.length > 0 && (
                  <div className="team-picker">
                    {available.length > 6 && (
                      <input
                        type="search"
                        className="team-picker-search"
                        placeholder="חיפוש לפי שם…"
                        value={practitionerSearch}
                        onChange={(e) => setPractitionerSearch(e.target.value)}
                        autoFocus
                      />
                    )}
                    <div className="team-picker-count">
                      {query ? `${shown.length} מתוך ${available.length}` : `בחרו מאנשי הצוות הקיימים (${available.length})`}
                    </div>
                    <div className="team-picker-list">
                      {shown.length === 0 && <div className="team-picker-empty">לא נמצא איש צוות בשם הזה</div>}
                      {shown.map((p: Practitioner) => (
                        <button
                          key={p.id}
                          type="button"
                          className="picker-item"
                          onClick={() => linkExistingMutation.mutate(p.id)}
                          disabled={linkExistingMutation.isPending}
                        >
                          <div style={{ flex: 1 }}>
                            <div className="picker-item-name">{p.name}</div>
                            {(p.mobile || p.email) && (
                              <div className="picker-item-sub">
                                {[p.mobile, p.email].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                          <span className="picker-item-type">{p.type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Create new */}
                {(!showNewPractitionerForm && available.length > 0) ? (
                  <div className="team-picker-footer">
                    <button type="button" className="btn-secondary" onClick={closeAdd}>סגירה</button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => { setNewName(practitionerSearch.trim()); setShowNewPractitionerForm(true); }}
                    >
                      + איש צוות חדש
                    </button>
                  </div>
                ) : (
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
                      <button type="button" onClick={closeAdd} className="btn-secondary">
                        ביטול
                      </button>
                      <button type="submit" className="btn-primary" disabled={addPractitionerMutation.isPending}>
                        {addPractitionerMutation.isPending ? 'מוסיף...' : 'הוסף'}
                      </button>
                    </div>
                  </form>
                )}
              </AddModal>
            );
          })()}

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

          {/* Edit Practitioner Modal */}
          {editingPractitioner && (
            <AddModal title="עריכת איש צוות" onClose={() => setEditingPractitioner(null)}>
              <EditPractitionerForm
                practitioner={editingPractitioner}
                onSave={(data) => updatePractitionerMutation.mutate({ id: editingPractitioner.id, data })}
                onCancel={() => setEditingPractitioner(null)}
              />
            </AddModal>
          )}

          {/* Edit Parent Modal */}
          {editingParent && (
            <AddModal title="עריכת הורה" onClose={() => setEditingParent(null)}>
              <EditParentForm
                parent={editingParent}
                onSave={(data) => updateParentMutation.mutate({ id: editingParent.id, data })}
                onCancel={() => setEditingParent(null)}
              />
            </AddModal>
          )}

          {/* Schedule Session Modal */}
          {showScheduleSession && (
            <AddModal title="תזמון פגישה חדשה" onClose={resetScheduleModal}>
              <form onSubmit={(e) => {
                e.preventDefault();
                const dateStr = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
                if (scheduleRecurring) {
                  scheduleRecurringMutation.mutate({
                    scheduledDate: dateStr,
                    therapistId: scheduleType === 'therapy' ? (scheduleTherapist || undefined) : undefined,
                    type: scheduleType,
                    until: scheduleUntil,
                  });
                } else {
                  scheduleSessionMutation.mutate({
                    scheduledDate: dateStr,
                    therapistId: scheduleType === 'therapy' ? (scheduleTherapist || undefined) : undefined,
                    type: scheduleType,
                  });
                }
              }}>
                {/* Type Toggle */}
                <div className="form-group">
                  <label>סוג פגישה</label>
                  <div className="kp-type-toggle">
                    <button
                      type="button"
                      className={scheduleType === 'therapy' ? 'btn-primary btn-small' : 'btn-secondary btn-small'}
                      onClick={() => setScheduleType('therapy')}
                    >
                      טיפול
                    </button>
                    <button
                      type="button"
                      className={scheduleType === 'meeting' ? 'btn-primary btn-small' : 'btn-secondary btn-small'}
                      onClick={() => setScheduleType('meeting')}
                    >
                      ישיבה
                    </button>
                  </div>
                </div>
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
                {scheduleType === 'therapy' && (
                  <div className="form-group">
                    <label>איש/ת צוות (לא חובה)</label>
                    <select value={scheduleTherapist} onChange={(e) => setScheduleTherapist(e.target.value)}>
                      <option value="">בחר איש/ת צוות</option>
                      {therapists.map((t: Practitioner) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Recurring toggle */}
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={scheduleRecurring}
                      onChange={(e) => setScheduleRecurring(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    חוזר שבועי
                  </label>
                </div>
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
                <div className="modal-actions">
                  <button type="button" onClick={resetScheduleModal} className="btn-secondary">
                    ביטול
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={scheduleSessionMutation.isPending || scheduleRecurringMutation.isPending}
                  >
                    {(scheduleSessionMutation.isPending || scheduleRecurringMutation.isPending) ? 'מתזמן...' : 'תזמן'}
                  </button>
                </div>
              </form>
            </AddModal>
          )}

          {/* Edit Session Modal */}
          {editingSession && (
            <AddModal title="עריכת טיפול" onClose={() => setEditingSession(null)}>
              <form onSubmit={(e) => {
                e.preventDefault();
                updateSessionMutation.mutate({
                  id: editingSession.id,
                  data: {
                    scheduledDate: new Date(`${editSessionDate}T${editSessionTime}:00`).toISOString() as unknown as Date,
                    therapistId: editSessionTherapist || undefined,
                  },
                });
              }}>
                <div className="form-group">
                  <label>תאריך</label>
                  <input
                    type="date"
                    value={editSessionDate}
                    onChange={(e) => setEditSessionDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>שעה</label>
                  <input
                    type="time"
                    value={editSessionTime}
                    onChange={(e) => setEditSessionTime(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>איש/ת צוות (לא חובה)</label>
                  <select value={editSessionTherapist} onChange={(e) => setEditSessionTherapist(e.target.value)}>
                    <option value="">ללא איש/ת צוות</option>
                    {therapists.map((t: Practitioner) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                    ))}
                  </select>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setEditingSession(null)} className="btn-secondary">
                    ביטול
                  </button>
                  <button type="submit" className="btn-primary" disabled={updateSessionMutation.isPending}>
                    {updateSessionMutation.isPending ? 'שומר...' : 'שמור'}
                  </button>
                </div>
              </form>
            </AddModal>
          )}

          {/* Delete Session Modal */}
          {sessionToDelete && (
            <ConfirmModal
              title="מחיקת טיפול"
              message={`האם למחוק את הטיפול מתאריך ${format(toDate(sessionToDelete.scheduledDate), 'dd/MM/yyyy')}?`}
              confirmText="מחק"
              confirmStyle="danger"
              onConfirm={() => deleteSessionMutation.mutate(sessionToDelete.id)}
              onCancel={() => setSessionToDelete(null)}
            />
          )}

          {/* Delete Kid Modal */}
          {showDeleteKid && (
            <ConfirmModal
              title="מחיקת ילד"
              message={`האם למחוק את ${kid.name} וכל המידע הקשור? (מטפלות, הורים, מטרות, טיפולים, טפסים)\nפעולה זו אינה הפיכה!`}
              confirmText={deleteKidMutation.isPending ? 'מוחק...' : 'מחק הכל'}
              confirmStyle="danger"
              onConfirm={() => deleteKidMutation.mutate()}
              onCancel={() => setShowDeleteKid(false)}
            />
          )}

          {/* Date Actions Modal - when clicking empty date in calendar */}
          {showDateActions && selectedDate && (
            <div className="modal-overlay" onClick={() => setShowDateActions(false)}>
              <div className="modal date-actions-modal" onClick={(e) => e.stopPropagation()}>
                <h3>
                  {format(selectedDate, 'dd/MM/yyyy')}
                </h3>
                <p className="nb-muted" style={{ marginBottom: 16 }}>מה תרצה לעשות?</p>
                <div className="kp-date-acts">
                  <button
                    type="button"
                    className="kp-date-act tone-sky"
                    onClick={() => {
                      setShowDateActions(false);
                      setShowScheduleSession(true);
                    }}
                  >
                    <Icon name="calendar" />
                    <b>תזמן פגישה</b>
                    <small>הוסף טיפול או ישיבה ללוח</small>
                  </button>
                  <button
                    type="button"
                    className="kp-date-act tone-mint"
                    onClick={() => {
                      setShowDateActions(false);
                      navigate(links.formNew({ kidId: kidId!, date: format(selectedDate, 'yyyy-MM-dd') }));
                    }}
                  >
                    <Icon name="form" />
                    <b>מלא טופס</b>
                    <small>מלא טופס טיפול ישירות</small>
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

          {/* Form Template Editor Modal */}
          {showTemplateEditor && kidId && (
            <div className="modal-overlay" onClick={() => setShowTemplateEditor(false)}>
              <div className="modal" style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
                <h3>ערוך תבנית טופס</h3>
                <FormTemplateEditor kidId={kidId} onClose={() => setShowTemplateEditor(false)} />
              </div>
            </div>
          )}

          {/* Image Upload / Crop Modal */}
          {showImageUpload && (
            <ImageCropModal
              onSave={(dataUrl) => updateKidImageMutation.mutate(dataUrl)}
              onClose={() => setShowImageUpload(false)}
            />
          )}

          {/* Compose Notification Modal */}
          {showNotifyCompose && (() => {
            const toggleTarget = (key: string) => {
              setNotifyTargets(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
              });
            };
            return (
              <div className="modal-overlay" onClick={() => setShowNotifyCompose(false)}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                  <h3>שליחת הודעה</h3>
                  <div className="form-group">
                    <label>הודעה</label>
                    <textarea
                      value={notifyMessage}
                      onChange={e => setNotifyMessage(e.target.value)}
                      rows={3}
                      placeholder="כתוב הודעה..."
                      style={{ width: '100%', resize: 'vertical' }}
                      autoFocus
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div className="kp-target-label">למי לשלוח:</div>
                    {practitioners.length > 0 && (
                      <div className="kp-target-group">
                        <div className="nb-muted" style={{ fontSize: 13, marginBottom: 6 }}>מטפלות / צוות</div>
                        <div className="kp-targets">
                          <button
                            type="button"
                            onClick={() => {
                              const allPractKeys = practitioners.map((p: Practitioner) => `p:${p.id}`);
                              const allSelected = allPractKeys.every((k: string) => notifyTargets.has(k));
                              setNotifyTargets(prev => {
                                const next = new Set(prev);
                                allPractKeys.forEach((k: string) => allSelected ? next.delete(k) : next.add(k));
                                return next;
                              });
                            }}
                            className={`kp-target tone-lilac${practitioners.every((p: Practitioner) => notifyTargets.has(`p:${p.id}`)) ? ' is-on' : ''}`}
                          >כולם</button>
                          {practitioners.map((p: Practitioner) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleTarget(`p:${p.id}`)}
                              className={`kp-target tone-${kidColor(p.id)}${notifyTargets.has(`p:${p.id}`) ? ' is-on' : ''}`}
                            >{p.name}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {parents.length > 0 && (
                      <div className="kp-target-group">
                        <div className="nb-muted" style={{ fontSize: 13, marginBottom: 6 }}>הורים</div>
                        <div className="kp-targets">
                          <button
                            type="button"
                            onClick={() => {
                              const allParentKeys = parents.map((p: Parent) => `par:${p.id}`);
                              const allSelected = allParentKeys.every((k: string) => notifyTargets.has(k));
                              setNotifyTargets(prev => {
                                const next = new Set(prev);
                                allParentKeys.forEach((k: string) => allSelected ? next.delete(k) : next.add(k));
                                return next;
                              });
                            }}
                            className={`kp-target tone-mint${parents.every((p: Parent) => notifyTargets.has(`par:${p.id}`)) ? ' is-on' : ''}`}
                          >כולם</button>
                          {parents.map((p: Parent) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleTarget(`par:${p.id}`)}
                              className={`kp-target tone-mint${notifyTargets.has(`par:${p.id}`) ? ' is-on' : ''}`}
                            >{p.name}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {practitioners.length === 0 && parents.length === 0 && (
                      <p className="nb-muted" style={{ fontSize: 14 }}>אין מטפלות או הורים משויכים לילד זה</p>
                    )}
                  </div>
                  {sendNotificationMutation.isError && (
                    <div style={{ color: 'var(--red)', fontSize: 14, marginBottom: 8 }}>שגיאה בשליחה</div>
                  )}
                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => { setShowNotifyCompose(false); setNotifyMessage(''); setNotifyTargets(new Set()); }}>ביטול</button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!notifyMessage.trim() || notifyTargets.size === 0 || sendNotificationMutation.isPending}
                      onClick={() => {
                        if (!kidId) return;
                        const targets = Array.from(notifyTargets).map(key => {
                          if (key.startsWith('p:')) {
                            const id = key.slice(2);
                            const pract = practitioners.find((p: Practitioner) => p.id === id);
                            return { type: 'practitioner', id, name: pract?.name || id };
                          } else {
                            const id = key.slice(4);
                            const parent = parents.find((p: Parent) => p.id === id);
                            return { type: 'parent', id: kidId, name: parent?.name || 'הורה' };
                          }
                        });
                        sendNotificationMutation.mutate({ kidId, message: notifyMessage.trim(), targets });
                      }}
                    >
                      {sendNotificationMutation.isPending ? 'שולח...' : 'שלח'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* Day Sessions Modal - when clicking on day with multiple sessions */}
      {showDaySessions && selectedDate && (
        <div className="modal-overlay" onClick={() => setShowDaySessions(false)}>
          <div className="modal day-sessions-modal" onClick={(e) => e.stopPropagation()}>
            <h3>טיפולים ב-{format(selectedDate, 'dd/MM/yyyy')}</h3>
            <ul className="kp-day-list">
              {daySessionsList.map((session) => {
                const therapist = practitioners.find((t: Practitioner) => t.id === session.therapistId);
                const hasForm = session.formId;
                const own = isOwnSession(session);
                const isMeeting = session.type === 'meeting';
                const canFill = isReadOnly ? false : (isMeeting ? isAdmin : own);
                return (
                  <li key={session.id} className={`kp-day-item${!own && !isMeeting ? ' is-other' : ''}`}>
                    <span className={`nb-dot tone-${hasForm ? 'mint' : isMeeting ? 'lilac' : kidColor(session.therapistId)}`} />
                    <div className="kp-day-who">
                      <b>{isMeeting ? 'ישיבה' : (therapist?.name || 'טיפול')}</b>
                      <small className="tabular">{format(toDate(session.scheduledDate), 'HH:mm')}{hasForm ? ' · הושלם' : ''}</small>
                    </div>
                    {hasForm ? (
                      <button
                        type="button"
                        className="nb-btn-ghost sm"
                        onClick={() => {
                          setShowDaySessions(false);
                          navigate(isMeeting ? links.meetingFormView(session.formId!) : links.formView(session.formId!));
                        }}
                      >
                        צפה
                      </button>
                    ) : canFill && (
                      <button
                        type="button"
                        className="btn-small btn-primary"
                        onClick={() => {
                          setShowDaySessions(false);
                          const sessionDateStr = format(toDate(session.scheduledDate), 'yyyy-MM-dd');
                          navigate(isMeeting
                            ? links.meetingFormNew({ kidId: kidId!, sessionId: session.id, date: sessionDateStr })
                            : links.formNew({ kidId: kidId!, sessionId: session.id, date: sessionDateStr }));
                        }}
                      >
                        מלא
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button type="button" className="kp-icon-btn" title="ערוך טיפול" aria-label="עריכת טיפול"
                          onClick={() => { setShowDaySessions(false); openEditSession(session); }}><Icon name="edit" size={18} /></button>
                        <button type="button" className="kp-icon-btn is-danger" title="מחק טיפול" aria-label="מחיקת טיפול"
                          onClick={() => { setShowDaySessions(false); setSessionToDelete(session); }}><Icon name="trash" size={18} /></button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
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

      {/* (the kid page's old mobile tab bar is retired in v2 — the index tabs above + the shell nav cover it) */}
    </div>
  );
}
