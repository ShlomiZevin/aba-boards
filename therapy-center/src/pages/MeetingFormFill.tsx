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

  return (
    <div className="container">
      <div className="kid-header-card">
        <div className="kid-header-top">
          <Link to={kidId ? links.kidDetail(kidId) : links.home()} className="kid-header-back">
            <span className="back-arrow">→</span>
            <span className="back-label">חזרה</span>
          </Link>
        </div>
        <h1 style={{ fontSize: '1.05em', fontWeight: 700, color: '#2d3748', margin: 0, whiteSpace: 'nowrap' }}>
          {isEditMode ? 'עריכת סיכום ישיבה' : 'טופס סיכום ישיבה'}{kid ? ` - ${kid.name}` : ''}
        </h1>
      </div>

      <div className="content-card">
        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            borderBottom: '2px solid #e2e8f0',
            marginBottom: '20px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'form' ? '3px solid #667eea' : '3px solid transparent',
              marginBottom: '-2px',
              color: activeTab === 'form' ? '#667eea' : '#4a5568',
              fontWeight: activeTab === 'form' ? 700 : 500,
              fontSize: '1em',
              cursor: 'pointer',
            }}
          >
            טופס סיכום
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('draft')}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'draft' ? '3px solid #667eea' : '3px solid transparent',
              marginBottom: '-2px',
              color: activeTab === 'draft' ? '#667eea' : '#4a5568',
              fontWeight: activeTab === 'draft' ? 700 : 500,
              fontSize: '1em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            טיוטה
            {draftContent && draftContent !== '<p></p>' && (
              <span
                style={{
                  fontSize: '0.7em',
                  background: '#667eea',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '1px 6px',
                }}
              >•</span>
            )}
          </button>
        </div>

        {/* Draft tab */}
        {activeTab === 'draft' && (
          <div>
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fbd38d',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '12px',
                fontSize: '0.9em',
                color: '#744210',
              }}
            >
              מרחב חופשי לכתיבת הערות במהלך הישיבה. נשמר אוטומטית, לא מופיע בסיכום המובנה.
            </div>
            <div style={{ minHeight: '400px' }}>
              <RichTextEditor value={draftContent} onChange={handleDraftChange} />
            </div>
            <div
              style={{
                marginTop: '10px',
                fontSize: '0.85em',
                color: '#718096',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {draftSaving ? (
                <span>שומר…</span>
              ) : draftSavedAt ? (
                <span>נשמר {formatDistanceToNow(draftSavedAt, { locale: he, addSuffix: true })}</span>
              ) : (
                <span style={{ color: '#a0aec0' }}>עדיין לא נשמר</span>
              )}
              {draftDirtyRef.current && !draftSaving && (
                <span style={{ color: '#dd6b20' }}>• שינויים ממתינים לשמירה</span>
              )}
            </div>
          </div>
        )}

        {activeTab === 'form' && (
        <form onSubmit={handleSubmit}>
          {/* Kid & Date */}
          <div className="form-row-2">
            <div className="form-group">
              <label>שם הילד</label>
              <input
                type="text"
                value={kid?.name || ''}
                disabled
                style={{ backgroundColor: '#f1f5f9' }}
              />
            </div>
            <div className="form-group">
              <label>תאריך הישיבה</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
                disabled={!!sessionId}
                style={sessionId ? { backgroundColor: '#f1f5f9' } : undefined}
              />
            </div>
          </div>

          {/* Attendees */}
          <div className="form-group">
            <label>נוכחים</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {practitioners.map((p: Practitioner) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleAttendee(p.id, p.name, 'practitioner')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '2px solid',
                    borderColor: isAttendeeSelected(p.id) ? '#667eea' : '#e2e8f0',
                    background: isAttendeeSelected(p.id) ? '#667eea' : 'white',
                    color: isAttendeeSelected(p.id) ? 'white' : '#4a5568',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                >
                  {p.name}
                  <span style={{ opacity: 0.75, fontSize: '0.8em', marginRight: '4px' }}>({p.type})</span>
                </button>
              ))}
              {parents.map((p: Parent) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleAttendee(p.id, p.name, 'parent')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '2px solid',
                    borderColor: isAttendeeSelected(p.id) ? '#48bb78' : '#e2e8f0',
                    background: isAttendeeSelected(p.id) ? '#48bb78' : 'white',
                    color: isAttendeeSelected(p.id) ? 'white' : '#4a5568',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                >
                  {p.name}
                  <span style={{ opacity: 0.75, fontSize: '0.8em', marginRight: '4px' }}>(הורה)</span>
                </button>
              ))}
              {practitioners.length === 0 && parents.length === 0 && (
                <span style={{ color: '#a0aec0', fontSize: '0.9em' }}>לא נמצאו נוכחים אפשריים</span>
              )}
            </div>
          </div>

          {/* Rich Text Fields */}
          <div className="form-group">
            <label>נקודות כלליות</label>
            <RichTextEditor value={generalNotes} onChange={setGeneralNotes} />
          </div>
          <div className="form-group">
            <label>התנהגות - נקודות כלליות</label>
            <RichTextEditor value={behaviorNotes} onChange={setBehaviorNotes} />
          </div>
          <div className="form-group">
            <label>ADL</label>
            <RichTextEditor value={adl} onChange={setAdl} />
          </div>
          <div className="form-group">
            <label>תוכניות מוטוריקה גסה</label>
            <RichTextEditor value={grossMotorPrograms} onChange={setGrossMotorPrograms} />
          </div>
          <div className="form-group">
            <label>תוכניות מחוץ לחדר</label>
            <RichTextEditor value={programsOutsideRoom} onChange={setProgramsOutsideRoom} />
          </div>
          <div className="form-group">
            <label>תוכניות למידה בחדר</label>
            <RichTextEditor value={learningProgramsInRoom} onChange={setLearningProgramsInRoom} />
          </div>
          <div className="form-group">
            <label>משימות</label>
            <RichTextEditor value={tasks} onChange={setTasks} />
          </div>

          {/* Goals Section */}
          <div className="form-group">
            <label style={{ marginBottom: '12px' }}>מטרות שעבדנו עליהן</label>

            <GoalsWeeklyTable
              kidId={kidId}
              goals={goals}
              selectedGoals={selectedGoals}
              onToggleGoal={toggleGoal}
              currentFormDate={sessionDate}
              currentFormId={isEditMode ? formId : undefined}
              practitioners={practitioners}
            />

            {/* Additional Goals */}
            <div className="custom-goals">
              <div style={{ fontSize: '0.9em', fontWeight: 600, color: '#4a5568', marginBottom: '8px' }}>
                מטרות נוספות (לא ברשימה)
              </div>

              {additionalGoals.map((goal, idx) => (
                <span key={idx} className="custom-goal-tag">
                  {goal}
                  <button type="button" onClick={() => removeCustomGoal(idx)}>
                    ✕
                  </button>
                </span>
              ))}

              <div className="add-custom-goal">
                <input
                  type="text"
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(e.target.value)}
                  placeholder="הוסף מטרה נוספת..."
                />
                <button type="button" onClick={addCustomGoal} className="btn-secondary btn-small">
                  הוסף
                </button>
              </div>
            </div>
          </div>

          <div className="form-actions" style={{ alignItems: 'center', gap: '12px' }}>
            <Link to={kidId ? links.kidDetail(kidId) : links.home()} className="btn-secondary">
              ביטול
            </Link>
            <span
              style={{
                fontSize: '0.85em',
                color: '#718096',
                marginInlineStart: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {formSaving ? (
                <span>שומר…</span>
              ) : formSavedAt ? (
                <span>נשמר אוטומטית {formatDistanceToNow(formSavedAt, { locale: he, addSuffix: true })}</span>
              ) : null}
            </span>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? 'מסיים...' : 'שמור טופס'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
