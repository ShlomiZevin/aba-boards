import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { kidsApi, practitionersApi, parentsApi, goalsApi, sessionsApi, notificationsApi } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import { toDate } from '../utils/date';
import { GOAL_CATEGORIES } from '../types';
import type { Practitioner, Parent, Goal, GoalCategoryId, Session, SessionType, PractitionerType, Notification } from '../types';
import ConfirmModal from '../components/ConfirmModal';
import FormTemplateEditor from '../components/FormTemplateEditor';
import ImageCropModal from '../components/ImageCropModal';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

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

export default function KidDetail() {
  const { kidId } = useParams<{ kidId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isTherapistView, isParentView, practitionerId: contextPractitionerId } = useTherapist();
  const links = useTherapistLinks();
  const isSimplifiedView = isTherapistView || isParentView;
  const isReadOnly = isParentView;
  const isAdmin = !isTherapistView && !isParentView;

  // State
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showAddPractitioner, setShowAddPractitioner] = useState(false);
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

  const { data: practitionersRes } = useQuery({
    queryKey: ['practitioners', kidId],
    queryFn: () => practitionersApi.getForKid(kidId!),
    enabled: !!kidId,
  });

  const { data: parentsRes } = useQuery({
    queryKey: ['parents', kidId],
    queryFn: () => parentsApi.getForKid(kidId!),
    enabled: !!kidId && !isSimplifiedView,
  });

  const { data: goalsRes } = useQuery({
    queryKey: ['goals', kidId],
    queryFn: () => goalsApi.getForKid(kidId!),
    enabled: !!kidId && !isSimplifiedView,
  });

  const { data: sessionsRes } = useQuery({
    queryKey: ['sessions', kidId],
    queryFn: () => sessionsApi.getForKid(kidId!),
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
      setEditingSession(null);
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

  const therapists = practitioners.filter((p: Practitioner) => p.type === 'מטפלת');
  const activeGoals = goals.filter((g: Goal) => g.isActive);
  // Pending = no form, and (admin sees all, therapist only sees their own therapy sessions, parent sees none)
  const pendingSessions = sessions.filter((s: Session) => {
    if (isParentView) return false;
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
    const url = `${window.location.origin}/therapy/t/${pId}/`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLinkId(pId);
      setTimeout(() => setCopiedLinkId(null), 2000);
    });
  };

  // Copy parent view link to clipboard
  const copyParentLink = () => {
    const url = `${window.location.origin}/therapy/p/${kidId}`;
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
      {/* Kid Profile Header - Combined logo, back, and kid info */}
      <div className="kid-header-card">
        <div className="kid-header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {!isParentView ? (
            <Link to={links.home()} className="kid-header-back">
              <span className="back-arrow">←</span>
              <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="logo-small" />
            </Link>
          ) : (
            <div />
          )}
          {isAdmin && (
            <button
              onClick={() => setShowDeleteKid(true)}
              className="delete-btn-small"
              title="מחק ילד"
              style={{ width: '30px', height: '30px', fontSize: '1em' }}
            >
              🗑
            </button>
          )}
        </div>
        <div className="kid-header-profile">
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={avatarUrl}
              alt={kid.name}
              className="kid-avatar-large"
              onError={(e) => {
                (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
              }}
            />
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowImageUpload(true)}
                  title="שנה תמונה"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#667eea',
                    border: '2px solid white',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                  }}
                >
                  ✎
                </button>
                {kid.imageName && (
                  <button
                    onClick={() => updateKidImageMutation.mutate('')}
                    title="הסר תמונה"
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      border: '2px solid white',
                      cursor: 'pointer',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                )}
              </>
            )}
          </div>
          <div className="kid-header-info">
            <h1 className="kid-header-name">{kid.name}</h1>
            {kid.age && <div className="kid-header-age">גיל {kid.age}</div>}
            <div className="kid-header-stats">
              {!isSimplifiedView && <span>{activeGoals.length} מטרות פעילות</span>}
              {!isSimplifiedView && <span>{sessions.length} טיפולים</span>}
              {pendingSessions.length > 0 && (
                <span className="pending-badge">{pendingSessions.length} ממתינים לטופס</span>
              )}
            </div>
            {isParentView && (
              <div className="readonly-badge">צפייה בלבד</div>
            )}
          </div>
        </div>
        {/* Kid Action Links - admin only */}
        {!isSimplifiedView && (
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
        )}
      </div>

      {/* Notifications Section - Therapist and Parent view (always visible, top of page) */}
      {(isTherapistView || isParentView) && (
        <div className="content-card" style={{ marginTop: '16px' }}>
          <div className="content-card-header">
            <h3>הודעות מהצוות</h3>
            {myNotifications.some(n => !n.read) && (
              <button
                className="btn-secondary btn-small"
                onClick={() => markAllReadMutation.mutate(myNotifications.filter(n => !n.read).map(n => n.id))}
                disabled={markAllReadMutation.isPending}
              >סמן הכל כנקרא</button>
            )}
          </div>
          {myNotifications.length === 0 ? (
            <p className="empty-text">אין הודעות</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {myNotifications.map((n: Notification) => (
                <div
                  key={n.id}
                  style={{
                    padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
                    background: n.read ? '#f8fafc' : '#fffbeb',
                  }}
                >
                  <div style={{ fontSize: '0.9em', marginBottom: '4px', wordBreak: 'break-word', fontWeight: n.read ? 'normal' : 600 }}>{n.message}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.75em', color: '#94a3b8' }}>
                      {format(toDate(n.createdAt), 'dd/MM/yyyy HH:mm')}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {!n.read ? (
                        <button
                          onClick={() => markReadMutation.mutate(n.id)}
                          disabled={pendingReadIds.has(n.id)}
                          style={{ fontSize: '0.78em', padding: '2px 8px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '6px', cursor: 'pointer' }}
                        >סמן כנקרא</button>
                      ) : (
                        <button
                          onClick={() => dismissMutation.mutate(n.id)}
                          style={{ fontSize: '0.78em', padding: '2px 8px', background: 'transparent', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}
                        >הסתר</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dashboard Grid - admin only */}
      {!isSimplifiedView && <div className="dashboard-grid">
        {/* Team Section */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h3>צוות</h3>
            {(practitioners.length > 0 || parents.length > 0) && (
              <button
                onClick={() => openComposeFor([
                  ...practitioners.map((p: Practitioner) => `p:${p.id}`),
                  ...parents.map((p: Parent) => `par:${p.id}`),
                ])}
                style={{ fontSize: '0.75em', padding: '3px 10px', borderRadius: '12px', border: '1px solid #667eea', background: '#eef2ff', color: '#4f46e5', cursor: 'pointer', fontWeight: 600 }}
              >שלח הודעה לכולם</button>
            )}
          </div>

          {/* Therapists */}
          <div className="team-subsection">
            <div className="team-subsection-header">
              <span>צוות טיפולי ({therapists.length})</span>
              {!isTherapistView && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  {practitioners.length > 0 && (
                    <button
                      onClick={() => openComposeFor(practitioners.map((p: Practitioner) => `p:${p.id}`))}
                      title="שלח הודעה לכל הצוות"
                      style={{ fontSize: '0.7em', padding: '2px 8px', borderRadius: '10px', border: '1px solid #c4b5fd', background: '#ede9fe', color: '#7c3aed', cursor: 'pointer', fontWeight: 600 }}
                    >שלח לכולם</button>
                  )}
                  <button onClick={() => setShowAddPractitioner(true)} className="add-btn-small">+</button>
                </div>
              )}
            </div>
            {practitioners.length === 0 ? (
              <p className="empty-text">אין מטפלות</p>
            ) : (
              <div className="team-list">
                {practitioners.map((p: Practitioner) => (
                  <div key={p.id} className="team-member">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="team-name">{p.name}</span>
                        <span className="team-type">{p.type}</span>
                        {copiedLinkId === p.id && (
                          <span style={{ color: '#48bb78', fontSize: '0.8em' }}>הקישור הועתק!</span>
                        )}
                      </div>
                      {(p.mobile || p.email) && (
                        <div style={{ fontSize: '0.8em', color: '#94a3b8', marginTop: '2px' }}>
                          {[p.mobile, p.email].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    {!isTherapistView ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => openComposeFor([`p:${p.id}`])}
                          title="שלח הודעה"
                          style={{ fontSize: '0.7em', padding: '2px 7px', borderRadius: '10px', border: '1px solid #c4b5fd', background: '#ede9fe', color: '#7c3aed', cursor: 'pointer', fontWeight: 500 }}
                        >שלח</button>
                        {p.type === 'מטפלת' && (
                          <button
                            onClick={() => copyTherapistLink(p.id)}
                            className="edit-btn-small"
                            title="העתק קישור מטפלת"
                          >
                            🔗
                          </button>
                        )}
                        <button onClick={() => setEditingPractitioner(p)} className="edit-btn-small">✎</button>
                        <button
                          onClick={() => deletePractitionerMutation.mutate(p.id)}
                          className="delete-btn-small"
                        >
                          ✕
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parents */}
          <div className="team-subsection">
            <div className="team-subsection-header">
              <span>הורים ({parents.length})</span>
              {!isTherapistView && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  {parents.length > 0 && (
                    <button
                      onClick={() => openComposeFor(parents.map((p: Parent) => `par:${p.id}`))}
                      title="שלח הודעה לכל ההורים"
                      style={{ fontSize: '0.7em', padding: '2px 8px', borderRadius: '10px', border: '1px solid #86efac', background: '#dcfce7', color: '#15803d', cursor: 'pointer', fontWeight: 600 }}
                    >שלח לכולם</button>
                  )}
                  <button onClick={() => setShowAddParent(true)} className="add-btn-small">+</button>
                </div>
              )}
            </div>
            {parents.length === 0 ? (
              <p className="empty-text">אין הורים</p>
            ) : (
              <div className="team-list">
                {parents.map((p: Parent) => (
                  <div key={p.id} className="team-member">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="team-name">{p.name}</span>
                        {copiedParentLink && (
                          <span style={{ color: '#48bb78', fontSize: '0.8em' }}>הקישור הועתק!</span>
                        )}
                      </div>
                      {(p.mobile || p.email) && (
                        <div style={{ fontSize: '0.8em', color: '#94a3b8', marginTop: '2px' }}>
                          {p.mobile && <a href={`tel:${p.mobile}`} style={{ color: '#94a3b8', textDecoration: 'none' }}>{p.mobile}</a>}
                          {p.mobile && p.email && ' · '}
                          {p.email && <a href={`mailto:${p.email}`} style={{ color: '#94a3b8', textDecoration: 'none' }}>{p.email}</a>}
                        </div>
                      )}
                    </div>
                    {!isTherapistView && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={copyParentLink}
                          className="edit-btn-small"
                          title="העתק קישור הורה (צפייה בלבד)"
                        >🔗</button>
                        <button onClick={() => setEditingParent(p)} className="edit-btn-small">✎</button>
                        <button
                          onClick={() => deleteParentMutation.mutate(p.id)}
                          className="delete-btn-small"
                        >
                          ✕
                        </button>
                      </div>
                    )}
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
            <Link to={links.kidGoals(kidId!)} className="manage-link">
              {isTherapistView ? 'צפה →' : 'ניהול →'}
            </Link>
          </div>

          {activeGoals.length === 0 ? (
            <div className="goals-empty">
              <p>אין מטרות פעילות</p>
              {!isTherapistView && (
                <Link to={links.kidGoals(kidId!)} className="btn-primary btn-small">
                  + הוסף מטרות
                </Link>
              )}
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
      </div>}

      {/* Sessions Section - Full Width */}
      <div className="content-card sessions-section">
        <div className="sessions-header">
          <h3>טיפולים</h3>
          {!isReadOnly && (
            <div className="sessions-actions">
              {isAdmin && (
                <button
                  onClick={() => setShowTemplateEditor(true)}
                  className="btn-secondary btn-small"
                  style={{ color: '#64748b', borderColor: '#e2e8f0' }}
                >
                  תבנית טופס
                </button>
              )}
              <button
                onClick={() => navigate(links.formNew({ kidId: kidId! }))}
                className="btn-secondary btn-small"
              >
                מלא טופס
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowScheduleSession(true)}
                  className="btn-primary btn-small"
                >
                  + פגישה חדשה
                </button>
              )}
            </div>
          )}
        </div>

        {pendingSessions.length > 0 && (
          <div className="pending-alert">
            {pendingSessions.length} טיפולים ממתינים לטופס
          </div>
        )}

        {/* Calendar */}
        <div className="calendar-container" dir="rtl">
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
                        {allHaveForms ? '✓' : someHaveForms ? '⚠' : '○'}
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
                        navigate(isMeeting
                          ? links.meetingFormNew({ kidId: kidId!, sessionId: session.id })
                          : links.formNew({ kidId: kidId!, sessionId: session.id }));
                      }
                    }}
                  >
                    {isAdmin && !hasForm ? (
                      <span
                        className="calendar-event-indicator"
                        onClick={(e) => { e.stopPropagation(); openEditSession(session); }}
                        title="ערוך פגישה"
                        style={{ cursor: 'pointer' }}
                      >✎</span>
                    ) : (
                      <span className="calendar-event-indicator">
                        {hasForm ? '✓' : (canFill ? '✎' : '○')}
                      </span>
                    )}
                    <span className="calendar-event-title" style={{ flex: 1 }}>{event.title}</span>
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSessionToDelete(session); }}
                        className="calendar-event-delete"
                        title="בטל פגישה"
                      >✕</button>
                    )}
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

              const session = resource as Session;
              const own = isOwnSession(session);
              const isMeeting = session.type === 'meeting';
              const canFillStyle = isReadOnly ? false : (isMeeting ? isAdmin : own);
              const bgColor = isMeeting
                ? (session.formId ? '#388E3C' : '#7C3AED')
                : (!own ? '#94a3b8' : session.formId ? '#388E3C' : '#F57C00');
              return {
                style: {
                  backgroundColor: bgColor,
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
              className="mobile-add-session-btn"
              onClick={() => setShowScheduleSession(true)}
            >
              + הוסף פגישה
            </button>
          )}
        </div>


        {/* Sessions List */}
        <div className="recent-sessions">
          <h4>מפגשים</h4>
          {sessions.length === 0 ? (
            <p className="empty-text">אין מפגשים</p>
          ) : (() => {
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
              return (
                <div key={session.id} className="session-card-mobile">
                  <div className="session-card-top">
                    <span className="session-card-date">
                      {format(toDate(session.scheduledDate), 'dd/MM/yyyy')}
                    </span>
                    <span className={`session-type-badge ${isMeeting ? 'meeting' : 'therapy'}`}>
                      {isMeeting ? 'ישיבה' : 'טיפול'}
                    </span>
                    {!isMeeting && therapist && (
                      <span className="session-card-therapist">{therapist.name}</span>
                    )}
                  </div>
                  <div className="session-card-bottom">
                    <span className={`session-status ${hasForm ? 'completed' : 'pending'}`}>
                      {hasForm ? 'הושלם' : 'ממתין'}
                    </span>
                    <div className="session-card-actions">
                      {hasForm ? (
                        <button onClick={() => navigate(isMeeting ? links.meetingFormView(session.formId!) : links.formView(session.formId!))}>
                          צפה
                        </button>
                      ) : isReadOnly ? (
                        <span style={{ color: '#a0aec0', fontSize: '0.85em' }}>טרם הושלם</span>
                      ) : canFill ? (
                        <button
                          onClick={() => navigate(isMeeting
                            ? links.meetingFormNew({ kidId: kidId!, sessionId: session.id })
                            : links.formNew({ kidId: kidId!, sessionId: session.id }))}
                          className="fill-btn"
                        >
                          מלא
                        </button>
                      ) : (
                        <span style={{ color: '#a0aec0', fontSize: '0.85em' }}>מפגש אחר</span>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEditSession(session)}
                            className="edit-btn-small"
                            title="ערוך מפגש"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => setSessionToDelete(session)}
                            className="delete-btn"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <>
                {/* Desktop: side-by-side columns */}
                <div className="sessions-columns">
                  <div>
                    <div className="sessions-col-label future">
                      עתידיים ({futureSessions.length})
                    </div>
                    {futureSessions.length === 0
                      ? <p className="sessions-empty">אין מפגשים קרובים</p>
                      : <div className="sessions-list" style={{ maxHeight: 320, overflowY: 'auto' }}>{futureSessions.map(renderSession)}</div>
                    }
                  </div>
                  <div>
                    <div className="sessions-col-label past">
                      אחרונים ({pastSessions.length})
                    </div>
                    {pastSessions.length === 0
                      ? <p className="sessions-empty">אין מפגשים קודמים</p>
                      : <div className="sessions-list" style={{ maxHeight: 320, overflowY: 'auto' }}>{pastSessions.map(renderSession)}</div>
                    }
                  </div>
                </div>

                {/* Mobile: tabbed layout */}
                <div className="sessions-tabbed">
                  <div className="sessions-tabs">
                    <button
                      className={`sessions-tab ${sessionsTab === 'future' ? 'active' : ''}`}
                      onClick={() => setSessionsTab('future')}
                    >
                      עתידיים ({futureSessions.length})
                    </button>
                    <button
                      className={`sessions-tab ${sessionsTab === 'past' ? 'active' : ''}`}
                      onClick={() => setSessionsTab('past')}
                    >
                      אחרונים ({pastSessions.length})
                    </button>
                  </div>
                  <div className="sessions-tab-content">
                    {sessionsTab === 'future' ? (
                      futureSessions.length === 0
                        ? <p className="sessions-empty">אין מפגשים קרובים</p>
                        : <div className="sessions-list">{futureSessions.map(renderSession)}</div>
                    ) : (
                      pastSessions.length === 0
                        ? <p className="sessions-empty">אין מפגשים קודמים</p>
                        : <div className="sessions-list">{pastSessions.map(renderSession)}</div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Notifications Section - Admin only */}
      {isAdmin && (() => {
        const sentNotifications: Notification[] = sentNotificationsRes?.data || [];
        const toggleTarget = (key: string) => {
          setNotifyTargets(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
          });
        };
        return (
          <div className="content-card" style={{ marginTop: '16px' }}>
            <div className="content-card-header">
              <h3>התראות</h3>
              <button className="btn-primary btn-small" onClick={() => setShowNotifyCompose(true)}>
                + שלח הודעה
              </button>
            </div>

            {/* Compose modal */}
            {showNotifyCompose && (
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
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.85em', color: '#64748b', marginBottom: '6px' }}>למי לשלוח:</div>
                    {practitioners.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.8em', color: '#7c3aed', fontWeight: 600, marginBottom: '4px' }}>מטפלות / צוות</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                            style={{
                              padding: '3px 10px', borderRadius: '12px', fontSize: '0.82em', cursor: 'pointer', border: '1.5px solid #7c3aed',
                              background: practitioners.every((p: Practitioner) => notifyTargets.has(`p:${p.id}`)) ? '#7c3aed' : 'white',
                              color: practitioners.every((p: Practitioner) => notifyTargets.has(`p:${p.id}`)) ? 'white' : '#7c3aed',
                            }}
                          >כולם</button>
                          {practitioners.map((p: Practitioner) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleTarget(`p:${p.id}`)}
                              style={{
                                padding: '3px 10px', borderRadius: '12px', fontSize: '0.82em', cursor: 'pointer', border: '1.5px solid #7c3aed',
                                background: notifyTargets.has(`p:${p.id}`) ? '#7c3aed' : 'white',
                                color: notifyTargets.has(`p:${p.id}`) ? 'white' : '#7c3aed',
                              }}
                            >{p.name}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {parents.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.8em', color: '#15803d', fontWeight: 600, marginBottom: '4px' }}>הורים</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                            style={{
                              padding: '3px 10px', borderRadius: '12px', fontSize: '0.82em', cursor: 'pointer', border: '1.5px solid #15803d',
                              background: parents.every((p: Parent) => notifyTargets.has(`par:${p.id}`)) ? '#15803d' : 'white',
                              color: parents.every((p: Parent) => notifyTargets.has(`par:${p.id}`)) ? 'white' : '#15803d',
                            }}
                          >כולם</button>
                          {parents.map((p: Parent) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleTarget(`par:${p.id}`)}
                              style={{
                                padding: '3px 10px', borderRadius: '12px', fontSize: '0.82em', cursor: 'pointer', border: '1.5px solid #15803d',
                                background: notifyTargets.has(`par:${p.id}`) ? '#15803d' : 'white',
                                color: notifyTargets.has(`par:${p.id}`) ? 'white' : '#15803d',
                              }}
                            >{p.name}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {practitioners.length === 0 && parents.length === 0 && (
                      <p style={{ fontSize: '0.85em', color: '#94a3b8' }}>אין מטפלות או הורים משויכים לילד זה</p>
                    )}
                  </div>
                  {sendNotificationMutation.isError && (
                    <div style={{ color: '#D32F2F', fontSize: '0.9em', marginBottom: '8px' }}>שגיאה בשליחה</div>
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
            )}

            {/* Sent log */}
            {sentNotifications.length === 0 ? (
              <p className="empty-text">לא נשלחו הודעות</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sentNotifications.map((n: Notification) => (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{
                      flexShrink: 0, padding: '2px 8px', borderRadius: '10px', fontSize: '0.75em', fontWeight: 600,
                      background: n.recipientType === 'practitioner' ? '#ede9fe' : '#dcfce7',
                      color: n.recipientType === 'practitioner' ? '#7c3aed' : '#15803d',
                    }}>{n.recipientName}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.9em', wordBreak: 'break-word' }}>{n.message}</div>
                      <div style={{ fontSize: '0.75em', color: '#94a3b8', marginTop: '2px' }}>
                        {format(toDate(n.createdAt), 'dd/MM/yyyy HH:mm')}
                        {' · '}
                        {n.read
                          ? <span style={{ color: '#15803d' }}>נקרא</span>
                          : <span style={{ color: '#f59e0b' }}>לא נקרא</span>
                        }
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button
                        onClick={() => adminDismissMutation.mutate(n.id)}
                        style={{ padding: '2px 8px', fontSize: '0.75em', background: 'transparent', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}
                      >הסתר</button>
                      {notifyDeleteConfirm === n.id ? (
                        <>
                          <button
                            onClick={() => deleteNotificationMutation.mutate(n.id)}
                            disabled={deleteNotificationMutation.isPending}
                            style={{ padding: '2px 8px', fontSize: '0.78em', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                          >מחק</button>
                          <button
                            onClick={() => setNotifyDeleteConfirm(null)}
                            style={{ padding: '2px 8px', fontSize: '0.78em', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                          >ביטול</button>
                        </>
                      ) : (
                        <button
                          onClick={() => setNotifyDeleteConfirm(n.id)}
                          style={{ padding: '2px 8px', fontSize: '0.75em', background: 'transparent', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}
                        >מחק</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Admin-only Modals */}
      {isAdmin && (
        <>
          {/* Add Practitioner Modal */}
          {showAddPractitioner && (() => {
            const linkedIds = new Set(practitioners.map((p: Practitioner) => p.id));
            const available = (myTherapistsRes?.data || []).filter((p: Practitioner) => !linkedIds.has(p.id));
            return (
              <AddModal title="הוספת איש צוות" onClose={() => { setShowAddPractitioner(false); setShowNewPractitionerForm(false); resetForm(); }}>
                {/* Pick existing */}
                {!showNewPractitionerForm && available.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.9em', color: '#64748b', marginBottom: '8px' }}>בחר מאיש צוות קיים:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {available.map((p: Practitioner) => (
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
                    <div style={{ textAlign: 'center', margin: '12px 0', color: '#a0aec0', fontSize: '0.85em' }}>— או —</div>
                  </div>
                )}

                {/* Create new */}
                {(!showNewPractitionerForm && available.length > 0) ? (
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => setShowNewPractitionerForm(true)}
                  >
                    + הוסף חדש
                  </button>
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
                      <button type="button" onClick={() => { setShowAddPractitioner(false); setShowNewPractitionerForm(false); resetForm(); }} className="btn-secondary">
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
                const dateStr = `${scheduleDate}T${scheduleTime}:00`;
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
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className={scheduleType === 'therapy' ? 'btn-primary btn-small' : 'btn-secondary btn-small'}
                      onClick={() => setScheduleType('therapy')}
                      style={{ flex: 1 }}
                    >
                      טיפול
                    </button>
                    <button
                      type="button"
                      className={scheduleType === 'meeting' ? 'btn-primary btn-small' : 'btn-secondary btn-small'}
                      onClick={() => setScheduleType('meeting')}
                      style={{ flex: 1, ...(scheduleType === 'meeting' ? { backgroundColor: '#7C3AED', borderColor: '#7C3AED' } : {}) }}
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
                    <label>מטפלת (לא חובה)</label>
                    <select value={scheduleTherapist} onChange={(e) => setScheduleTherapist(e.target.value)}>
                      <option value="">בחר מטפלת</option>
                      {therapists.map((t: Practitioner) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
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
                    scheduledDate: `${editSessionDate}T${editSessionTime}:00` as unknown as Date,
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
                  <label>מטפלת (לא חובה)</label>
                  <select value={editSessionTherapist} onChange={(e) => setEditSessionTherapist(e.target.value)}>
                    <option value="">ללא מטפלת</option>
                    {therapists.map((t: Practitioner) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
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
                    <span className="date-action-desc">הוסף טיפול או ישיבה ללוח</span>
                  </button>
                  <button
                    className="date-action-btn form"
                    onClick={() => {
                      setShowDateActions(false);
                      navigate(links.formNew({ kidId: kidId!, date: format(selectedDate, 'yyyy-MM-dd') }));
                    }}
                  >
                    <span className="date-action-icon">📝</span>
                    <span className="date-action-label">מלא טופס</span>
                    <span className="date-action-desc">מלא טופס טיפול ישירות</span>
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
        </>
      )}

      {/* Day Sessions Modal - when clicking on day with multiple sessions */}
      {showDaySessions && selectedDate && (
        <div className="modal-overlay" onClick={() => setShowDaySessions(false)}>
          <div className="modal day-sessions-modal" onClick={(e) => e.stopPropagation()}>
            <h3>טיפולים ב-{format(selectedDate, 'dd/MM/yyyy')}</h3>
            <div className="day-sessions-list">
              {daySessionsList.map((session) => {
                const therapist = practitioners.find((t: Practitioner) => t.id === session.therapistId);
                const hasForm = session.formId;
                const own = isOwnSession(session);
                const isMeeting = session.type === 'meeting';
                const canFill = isReadOnly ? false : (isMeeting ? isAdmin : own);
                return (
                  <div
                    key={session.id}
                    className={`day-session-item ${hasForm ? 'completed' : 'pending'}${!own && !isMeeting ? ' other-therapist' : ''}`}
                  >
                    <div className="day-session-info" style={(!own && !isMeeting) ? { opacity: 0.55 } : undefined}>
                      <span className="day-session-therapist" style={isMeeting ? { color: '#7C3AED' } : undefined}>
                        {isMeeting ? 'ישיבה' : (therapist?.name || 'טיפול')}
                      </span>
                      <span className="day-session-time">
                        {format(toDate(session.scheduledDate), 'HH:mm')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {hasForm ? (
                        <button
                          className="btn-small btn-secondary"
                          onClick={() => {
                            setShowDaySessions(false);
                            navigate(isMeeting ? links.meetingFormView(session.formId!) : links.formView(session.formId!));
                          }}
                        >
                          צפה
                        </button>
                      ) : canFill && (
                        <button
                          className="btn-small btn-primary"
                          onClick={() => {
                            setShowDaySessions(false);
                            navigate(isMeeting
                              ? links.meetingFormNew({ kidId: kidId!, sessionId: session.id })
                              : links.formNew({ kidId: kidId!, sessionId: session.id }));
                          }}
                        >
                          מלא
                        </button>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            className="edit-btn-small"
                            title="ערוך טיפול"
                            onClick={() => { setShowDaySessions(false); openEditSession(session); }}
                          >✎</button>
                          <button
                            className="delete-btn-small"
                            title="מחק טיפול"
                            onClick={() => { setShowDaySessions(false); setSessionToDelete(session); }}
                          >✕</button>
                        </>
                      )}
                    </div>
                  </div>
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
