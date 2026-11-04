import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate, Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import { kidsApi, practitionersApi, parentsApi, sessionsApi, meetingFormsApi, goalsApi, meetingDraftsApi } from '../api/client';
import type { MeetingDraftKey } from '../api/client';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import { toDate } from '../utils/date';
import type { Practitioner, Parent, MeetingAttendee, MeetingForm, Session, Goal, GoalSnapshot } from '../types';
import RichTextEditor from '../components/RichTextEditor';
import GoalsWeeklyTable from '../components/GoalsWeeklyTable';
import Icon from '../v2/Icon';
import { FfHeader, FfIcon, FfTextSection, FfAdditionalGoals } from '../v2/pages/ffParts';



export default function MeetingFormFill() {
  const { formId } = useParams(); // edit mode
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const links = useTherapistLinks();

  const kidIdParam = searchParams.get('kidId') || '';
  const sessionIdParam = searchParams.get('sessionId') || undefined;
  const dateParam = searchParams.get('date');
  const isEditMode = !!formId;

  const [kidId, setKidId] = useState(kidIdParam);
  const [sessionId, setSessionId] = useState<string | undefined>(sessionIdParam);
  const [sessionDate, setSessionDate] = useState(dateParam || format(new Date(), 'yyyy-MM-dd'));
  const [selectedAttendees, setSelectedAttendees] = useState<MeetingAttendee[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [behaviorNotes, setBehaviorNotes] = useState('');
  const [adl, setAdl] = useState('');
  const [grossMotorPrograms, setGrossMotorPrograms] = useState('');
  const [programsOutsideRoom, setProgramsOutsideRoom] = useState('');
  const [learningProgramsInRoom, setLearningProgramsInRoom] = useState('');
  const [tasks, setTasks] = useState('');
  // Visibility of this meeting (type פגישה). Default: visible to everyone.
  const [visibleToParents, setVisibleToParents] = useState(true);
  const [visibleToTherapists, setVisibleToTherapists] = useState(true);
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [additionalGoals, setAdditionalGoals] = useState<string[]>([]);
  const [newGoalText, setNewGoalText] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Draft tab state
  const [activeTab, setActiveTab] = useState<'form' | 'draft'>('form');
  const [draftContent, setDraftContent] = useState('');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const draftContentRef = useRef('');
  const draftDirtyRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form autosave state — saves whatever the admin has filled every ~2s of idle time.
  // First autosave for a new form creates the doc (status='in_progress') and bumps URL
  // to edit mode so a refresh keeps the work. Finalize on Submit runs side effects (DC entries,
  // session status). Already-completed forms keep autosaving without status change.
  const [currentFormId, setCurrentFormId] = useState<string | null>(formId || null);
  const [formSavedAt, setFormSavedAt] = useState<Date | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const formAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formDirtyRef = useRef(false);
  const formInFlightRef = useRef(false);
  const formLoadedRef = useRef(false);
  const currentFormIdRef = useRef<string | null>(formId || null);
  useEffect(() => { currentFormIdRef.current = currentFormId; }, [currentFormId]);

  // Load existing form for edit mode
  const { data: existingFormRes } = useQuery({
    queryKey: ['meetingForm', formId],
    queryFn: () => meetingFormsApi.getById(formId!),
    enabled: isEditMode,
  });

  // Load sessions to pre-populate date
  const { data: sessionsRes } = useQuery({
    queryKey: ['sessions', kidId],
    queryFn: () => sessionsApi.getForKid(kidId),
    enabled: !!kidId && !!sessionId && !isEditMode,
  });

  // Initialize from existing form (edit mode)
  useEffect(() => {
    if (initialized || !isEditMode || !existingFormRes?.data) return;
    const form = existingFormRes.data;
    setKidId(form.kidId);
    setSessionId(form.sessionId);
    setSessionDate(format(toDate(form.sessionDate), 'yyyy-MM-dd'));
    setSelectedAttendees(form.attendees || []);
    setGeneralNotes(form.generalNotes || '');
    setBehaviorNotes(form.behaviorNotes || '');
    setAdl(form.adl || '');
    setGrossMotorPrograms(form.grossMotorPrograms || '');
    setProgramsOutsideRoom(form.programsOutsideRoom || '');
    setLearningProgramsInRoom(form.learningProgramsInRoom || '');
    setTasks(form.tasks || '');
    setVisibleToParents(form.visibility?.parents !== false);
    setVisibleToTherapists(form.visibility?.therapists !== false);
    setSelectedGoals(new Set((form.goalsWorkedOn || []).map((g: GoalSnapshot) => g.goalId)));
    setAdditionalGoals(form.additionalGoals || []);
    setInitialized(true);
  }, [isEditMode, existingFormRes, initialized]);

  // Pre-populate date from session (new mode)
  useEffect(() => {
    if (initialized || isEditMode || !sessionId || !sessionsRes?.data) return;
    const session = sessionsRes.data.find((s: Session) => s.id === sessionId);
    if (session) {
      setSessionDate(format(toDate(session.scheduledDate), 'yyyy-MM-dd'));
      setInitialized(true);
    }
  }, [sessionId, sessionsRes, initialized, isEditMode]);

  const { data: kidRes } = useQuery({
    queryKey: ['kid', kidId],
    queryFn: () => kidsApi.getById(kidId),
    enabled: !!kidId,
  });

  const { data: practitionersRes } = useQuery({
    queryKey: ['practitioners', kidId],
    queryFn: () => practitionersApi.getForKid(kidId),
    enabled: !!kidId,
  });

  const { data: parentsRes } = useQuery({
    queryKey: ['parents', kidId],
    queryFn: () => parentsApi.getForKid(kidId),
    enabled: !!kidId,
  });

  const { data: goalsRes } = useQuery({
    queryKey: ['goals', kidId],
    queryFn: () => goalsApi.getForKid(kidId),
    enabled: !!kidId,
  });

  const submitMutation = useMutation({
    mutationFn: (data: Omit<MeetingForm, 'id' | 'createdAt' | 'updatedAt'>) =>
      meetingFormsApi.submit(data),
    onSuccess: (res) => {
      if (res.success && res.data) {
        queryClient.invalidateQueries({ queryKey: ['sessions', kidId] });
        navigate(links.meetingFormView(res.data.id));
      }
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: (data: Partial<MeetingForm>) =>
      meetingFormsApi.finalize(currentFormIdRef.current!, data),
    onSuccess: (res) => {
      if (res.success && res.data) {
        queryClient.invalidateQueries({ queryKey: ['sessions', kidId] });
        queryClient.invalidateQueries({ queryKey: ['meetingForm', res.data.id] });
        navigate(links.meetingFormView(res.data.id));
      }
    },
  });

  const kid = kidRes?.data;
  const practitioners = practitionersRes?.data || [];
  const parents = parentsRes?.data || [];
  const goals = (goalsRes?.data || []).filter((g: Goal) => g.isActive !== false);

  // --- Draft: build lookup key and load existing draft ---
  // Always key by sessionId when available; fall back to adhoc by date. Forms always have a
  // sessionId once saved (auto-created on submit for ad-hoc), so edit mode reuses the same key.
  const draftKey: MeetingDraftKey = useMemo(() => {
    if (sessionId) return { kidId, sessionId };
    return { kidId, sessionDate };
  }, [sessionId, kidId, sessionDate]);

  const draftKeyRef = useRef(draftKey);
  useEffect(() => { draftKeyRef.current = draftKey; }, [draftKey]);

  // In edit mode, wait for the form to load (to get sessionId) before fetching the draft.
  const draftQueryEnabled = !!kidId && (!isEditMode || !!sessionId);

  const { data: existingDraftRes } = useQuery({
    queryKey: ['meetingDraft', draftKey],
    queryFn: () => meetingDraftsApi.get(draftKey),
    enabled: draftQueryEnabled,
  });

  useEffect(() => {
    if (draftLoaded || !existingDraftRes?.success) return;
    const d = existingDraftRes.data;
    if (d) {
      setDraftContent(d.content || '');
      draftContentRef.current = d.content || '';
      setDraftSavedAt(d.updatedAt ? toDate(d.updatedAt) : null);
    }
    setDraftLoaded(true);
  }, [existingDraftRes, draftLoaded]);

  const flushDraft = async () => {
    if (!draftDirtyRef.current) return;
    if (!kidId) return;
    draftDirtyRef.current = false;
    setDraftSaving(true);
    const res = await meetingDraftsApi.upsert(draftKeyRef.current, draftContentRef.current);
    setDraftSaving(false);
    if (res.success) setDraftSavedAt(new Date());
    else draftDirtyRef.current = true; // retry on next change
  };

  const handleDraftChange = (newContent: string) => {
    setDraftContent(newContent);
    draftContentRef.current = newContent;
    draftDirtyRef.current = true;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => { flushDraft(); }, 2000);
  };

  // Flush pending draft on unmount
  useEffect(() => {
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      if (draftDirtyRef.current) { flushDraft(); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn on navigation away if unsaved draft OR form changes are pending
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (draftDirtyRef.current || formDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // --- Form autosave ---
  // Build the payload from current state; called fresh each save.
  const buildFormPayload = () => {
    const goalsWorkedOn: GoalSnapshot[] = Array.from(selectedGoals)
      .map((goalId) => {
        const goal = goals.find((g: Goal) => g.id === goalId);
        return goal ? { goalId: goal.id, goalTitle: goal.title, categoryId: goal.categoryId } : null;
      })
      .filter((g): g is GoalSnapshot => g !== null);
    return {
      sessionId,
      kidId,
      sessionDate: new Date(sessionDate),
      visibility: { parents: visibleToParents, therapists: visibleToTherapists },
      attendees: selectedAttendees,
      goalsWorkedOn,
      additionalGoals,
      generalNotes,
      behaviorNotes,
      adl,
      grossMotorPrograms,
      programsOutsideRoom,
      learningProgramsInRoom,
      tasks,
    };
  };

  // Mark form as "loaded" once initial data is in place — guards against autosaving
  // pre-populated state on mount in edit mode.
  useEffect(() => {
    if (isEditMode) {
      if (initialized) formLoadedRef.current = true;
    } else {
      formLoadedRef.current = true;
    }
  }, [initialized, isEditMode]);

  const flushFormAutosave = async () => {
    if (formInFlightRef.current) return; // a save is already in flight; we'll re-trigger when it returns
    if (!formDirtyRef.current) return;
    if (!kidId) return;
    formInFlightRef.current = true;
    formDirtyRef.current = false;
    setFormSaving(true);
    const payload = buildFormPayload();
    const res = await meetingFormsApi.autosave({
      ...payload,
      id: currentFormIdRef.current || undefined,
    });
    formInFlightRef.current = false;
    setFormSaving(false);
    if (res.success && res.data) {
      setFormSavedAt(new Date());
      if (!currentFormIdRef.current && res.data.id) {
        // First autosave created a real form — capture its id and update the URL
        // so a refresh/back-button keeps the user's work.
        currentFormIdRef.current = res.data.id;
        setCurrentFormId(res.data.id);
        setInitialized(true); // prevent edit-mode init effect from re-clobbering state
        navigate(links.meetingFormEdit(res.data.id), { replace: true });
      }
      // If another change came in while we were saving, schedule a follow-up
      if (formDirtyRef.current && !formAutosaveTimerRef.current) {
        formAutosaveTimerRef.current = setTimeout(() => {
          formAutosaveTimerRef.current = null;
          flushFormAutosave();
        }, 2000);
      }
    } else {
      formDirtyRef.current = true; // retry on next change
    }
  };

  // Watch form fields → mark dirty and debounce a save.
  useEffect(() => {
    if (!formLoadedRef.current) return;
    if (!kidId) return;
    formDirtyRef.current = true;
    if (formAutosaveTimerRef.current) clearTimeout(formAutosaveTimerRef.current);
    formAutosaveTimerRef.current = setTimeout(() => {
      formAutosaveTimerRef.current = null;
      flushFormAutosave();
    }, 2000);
    return () => {
      if (formAutosaveTimerRef.current) {
        clearTimeout(formAutosaveTimerRef.current);
        formAutosaveTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    kidId,
    sessionDate,
    selectedAttendees,
    selectedGoals,
    additionalGoals,
    generalNotes,
    behaviorNotes,
    adl,
    grossMotorPrograms,
    programsOutsideRoom,
    learningProgramsInRoom,
    tasks,
    visibleToParents,
    visibleToTherapists,
  ]);

  // Flush pending form autosave on unmount
  useEffect(() => {
    return () => {
      if (formAutosaveTimerRef.current) clearTimeout(formAutosaveTimerRef.current);
      if (formDirtyRef.current) { flushFormAutosave(); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleGoal = (goalId: string) => {
    const newSet = new Set(selectedGoals);
    if (newSet.has(goalId)) {
      newSet.delete(goalId);
    } else {
      newSet.add(goalId);
    }
    setSelectedGoals(newSet);
  };

  const addCustomGoal = () => {
    if (newGoalText.trim()) {
      setAdditionalGoals([...additionalGoals, newGoalText.trim()]);
      setNewGoalText('');
    }
  };

  const removeCustomGoal = (index: number) => {
    setAdditionalGoals(additionalGoals.filter((_, i) => i !== index));
  };

  const toggleAttendee = (id: string, name: string, type: 'parent' | 'practitioner') => {
    const existing = selectedAttendees.find((a) => a.id === id);
    if (existing) {
      setSelectedAttendees(selectedAttendees.filter((a) => a.id !== id));
    } else {
      setSelectedAttendees([...selectedAttendees, { id, name, type }]);
    }
  };

  const isAttendeeSelected = (id: string) => selectedAttendees.some((a) => a.id === id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Cancel any pending autosave debounce — Submit supersedes it.
    if (formAutosaveTimerRef.current) {
      clearTimeout(formAutosaveTimerRef.current);
      formAutosaveTimerRef.current = null;
    }
    formDirtyRef.current = false;

    const data = buildFormPayload();
    if (currentFormIdRef.current) {
      finalizeMutation.mutate(data);
    } else {
      submitMutation.mutate(data);
    }
  };

  const isPending = submitMutation.isPending || finalizeMutation.isPending;

  const backTo = kidId ? links.kidDetail(kidId) : links.home();
  const hasDraft = !!draftContent && draftContent !== '<p></p>';
  const visState = visibleToParents && visibleToTherapists ? 'all' : (!visibleToParents && !visibleToTherapists ? 'hidden' : 'partial');

  return (
    <div className="ff ff-fill ff-meeting">
      <FfHeader backTo={backTo} kid={kid} title={isEditMode ? 'עריכת סיכום ישיבה' : 'טופס סיכום ישיבה'} />

      {/* Tab switcher */}
      <div className="ff-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={activeTab === 'form'} className={`ff-tab${activeTab === 'form' ? ' is-active' : ''}`} onClick={() => setActiveTab('form')}>
          <Icon name="form" size={18} /> טופס סיכום
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'draft'} className={`ff-tab${activeTab === 'draft' ? ' is-active' : ''}`} onClick={() => setActiveTab('draft')}>
          <Icon name="edit" size={18} /> טיוטה
          {hasDraft && <span className="ff-tab-dot" aria-label="יש טיוטה" />}
        </button>
      </div>

      {/* Draft tab */}
      {activeTab === 'draft' && (
        <div className="ff-draft">
          <div className="ff-note">
            מרחב חופשי לכתיבת הערות במהלך הישיבה. נשמר אוטומטית, לא מופיע בסיכום המובנה.
          </div>
          <RichTextEditor value={draftContent} onChange={handleDraftChange} />
          <div className="ff-draft-status">
            {draftSaving ? (
              <span>שומר…</span>
            ) : draftSavedAt ? (
              <span>נשמר {formatDistanceToNow(draftSavedAt, { locale: he, addSuffix: true })}</span>
            ) : (
              <span>עדיין לא נשמר</span>
            )}
            {draftDirtyRef.current && !draftSaving && (
              <span className="is-pending">• שינויים ממתינים לשמירה</span>
            )}
          </div>
        </div>
      )}

      {activeTab === 'form' && (
        <form onSubmit={handleSubmit} className="ff-form">
          {/* Kid & Date */}
          <div className="ff-meta">
            <div className="ff-meta-item ff-meta-date">
              <span className="ff-meta-k"><Icon name="user" size={16} /> שם הילד</span>
              <span className="ff-meta-ro">{kid?.name || ''}</span>
            </div>
            <label className="ff-meta-item">
              <span className="ff-meta-k"><Icon name="calendar" size={16} /> תאריך הישיבה</span>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
                disabled={!!sessionId}
              />
            </label>
          </div>

          <div className="ff-layout">
            <div className="ff-col">
              {/* Visibility — who can see this meeting */}
              <section className="nb-card ff-vis">
                <h2 className="ff-sec-title"><FfIcon name="eye" size={22} /> מי יכול לראות את הישיבה</h2>
                <p className="ff-vis-sub">בחרו למי יוצג סיכום הישיבה. כברירת מחדל — גלוי לכולם.</p>
                <div className="ff-vis-opts">
                  <button
                    type="button"
                    className={`ff-vis-opt tone-mint${visibleToParents ? ' is-on' : ''}`}
                    onClick={() => setVisibleToParents(v => !v)}
                    aria-pressed={visibleToParents}
                  >
                    <span className="ff-gw-box" aria-hidden="true">{visibleToParents && <Icon name="check" size={16} strokeWidth={2.8} />}</span>
                    הורים
                  </button>
                  <button
                    type="button"
                    className={`ff-vis-opt tone-lilac${visibleToTherapists ? ' is-on' : ''}`}
                    onClick={() => setVisibleToTherapists(v => !v)}
                    aria-pressed={visibleToTherapists}
                  >
                    <span className="ff-gw-box" aria-hidden="true">{visibleToTherapists && <Icon name="check" size={16} strokeWidth={2.8} />}</span>
                    מטפלים
                  </button>
                </div>
                <div className={`ff-vis-status is-${visState}`}>
                  <FfIcon name={visState === 'all' ? 'eye' : 'lock'} size={18} />
                  <span>
                    {visState === 'all'
                      ? 'גלוי לכולם — הורים ומטפלים יראו את הישיבה.'
                      : visState === 'hidden'
                      ? 'מוסתר — רק מנהל/ת המרכז יראה את הישיבה.'
                      : `גלוי ל${visibleToParents ? 'הורים' : 'מטפלים'} בלבד.`}
                  </span>
                </div>
              </section>

              {/* Attendees */}
              <section className="nb-card ff-att">
                <h2 className="ff-sec-title"><Icon name="team" size={22} /> נוכחים</h2>
                <div className="ff-att-list">
                  {practitioners.map((p: Practitioner) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleAttendee(p.id, p.name, 'practitioner')}
                      className={`ff-att-chip tone-lilac${isAttendeeSelected(p.id) ? ' is-on' : ''}`}
                      aria-pressed={isAttendeeSelected(p.id)}
                    >
                      {isAttendeeSelected(p.id) && <Icon name="check" size={16} strokeWidth={2.6} />}
                      {p.name}
                      <small>({p.type})</small>
                    </button>
                  ))}
                  {parents.map((p: Parent) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleAttendee(p.id, p.name, 'parent')}
                      className={`ff-att-chip tone-mint${isAttendeeSelected(p.id) ? ' is-on' : ''}`}
                      aria-pressed={isAttendeeSelected(p.id)}
                    >
                      {isAttendeeSelected(p.id) && <Icon name="check" size={16} strokeWidth={2.6} />}
                      {p.name}
                      <small>(הורה)</small>
                    </button>
                  ))}
                  {practitioners.length === 0 && parents.length === 0 && (
                    <span className="ff-att-empty">לא נמצאו נוכחים אפשריים</span>
                  )}
                </div>
              </section>

              {/* Rich Text Fields */}
              <ol className="nb-card ff-check">
                <FfTextSection label="נקודות כלליות" value={generalNotes} onChange={setGeneralNotes} />
                <FfTextSection label="התנהגות - נקודות כלליות" value={behaviorNotes} onChange={setBehaviorNotes} />
                <FfTextSection label="ADL" value={adl} onChange={setAdl} />
                <FfTextSection label="תוכניות מוטוריקה גסה" value={grossMotorPrograms} onChange={setGrossMotorPrograms} />
                <FfTextSection label="תוכניות מחוץ לחדר" value={programsOutsideRoom} onChange={setProgramsOutsideRoom} />
                <FfTextSection label="תוכניות למידה בחדר" value={learningProgramsInRoom} onChange={setLearningProgramsInRoom} />
                <FfTextSection label="משימות" value={tasks} onChange={setTasks} />
              </ol>
            </div>

            <div className="ff-col">
              <section className="nb-card ff-goals">
                <div className="ff-goals-head">
                  <h2 className="ff-sec-title"><Icon name="target" size={22} /> מטרות שעבדנו עליהן</h2>
                  {selectedGoals.size > 0 && <span className="nb-sticker tone-mint ff-goals-count">{selectedGoals.size} נבחרו</span>}
                </div>

                <GoalsWeeklyTable
                  kidId={kidId}
                  goals={goals}
                  selectedGoals={selectedGoals}
                  onToggleGoal={toggleGoal}
                  currentFormDate={sessionDate}
                  currentFormId={isEditMode ? formId : undefined}
                  practitioners={practitioners}
                />

                <FfAdditionalGoals
                  goals={additionalGoals}
                  onRemove={removeCustomGoal}
                  newText={newGoalText}
                  setNewText={setNewGoalText}
                  onAdd={addCustomGoal}
                />
              </section>
            </div>
          </div>

          <div className="ff-savebar">
            <Link to={backTo} className="nb-btn-ghost ff-savebar-cancel">ביטול</Link>
            {(formSaving || formSavedAt) && (
              <span className="ff-autosave">
                {formSaving ? 'שומר…' : formSavedAt ? `נשמר אוטומטית ${formatDistanceToNow(formSavedAt, { locale: he, addSuffix: true })}` : null}
              </span>
            )}
            <button type="submit" className="nb-btn ff-savebar-save" disabled={isPending}>
              <Icon name="check" size={22} strokeWidth={2.4} />
              {isPending ? 'מסיים...' : 'שמירת הטופס'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
