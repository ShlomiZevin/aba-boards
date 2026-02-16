import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { kidsApi, practitionersApi, goalsApi, formsApi, sessionsApi } from '../api/client';
import { toDate } from '../utils/date';
import { GOAL_CATEGORIES } from '../types';
import type { Goal, GoalCategoryId, GoalSnapshot, SessionForm, Session } from '../types';
import RichTextEditor from '../components/RichTextEditor';

const BASE = import.meta.env.BASE_URL;

export default function FormFill() {
  const { formId } = useParams(); // For edit mode
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const kidIdParam = searchParams.get('kidId') || '';
  const sessionId = searchParams.get('sessionId') || undefined;
  const dateParam = searchParams.get('date'); // Date from calendar click
  const isEditMode = !!formId;

  // Form state
  const [kidId, setKidId] = useState(kidIdParam);
  const [practitionerId, setPractitionerId] = useState('');
  const [sessionDate, setSessionDate] = useState(dateParam || format(new Date(), 'yyyy-MM-dd'));
  const [cooperation, setCooperation] = useState(70);
  const [sessionDuration, setSessionDuration] = useState(45);
  const [sittingDuration, setSittingDuration] = useState(30);

  const [mood, setMood] = useState('');
  const [concentrationLevel, setConcentrationLevel] = useState('');
  const [newReinforcers, setNewReinforcers] = useState('');
  const [wordsProduced, setWordsProduced] = useState('');
  const [breakActivities, setBreakActivities] = useState('');
  const [endOfSessionActivity, setEndOfSessionActivity] = useState('');
  const [successes, setSuccesses] = useState('');
  const [difficulties, setDifficulties] = useState('');
  const [notes, setNotes] = useState('');

  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [additionalGoals, setAdditionalGoals] = useState<string[]>([]);
  const [newGoalText, setNewGoalText] = useState('');

  // Track if we've initialized
  const [initialized, setInitialized] = useState(false);

  // Fetch existing form for edit mode
  const { data: existingFormRes } = useQuery({
    queryKey: ['form', formId],
    queryFn: () => formsApi.getById(formId!),
    enabled: isEditMode,
  });

  // Initialize from existing form (edit mode)
  useEffect(() => {
    if (initialized || !isEditMode || !existingFormRes?.data) return;

    const form = existingFormRes.data;
    setKidId(form.kidId);
    setPractitionerId(form.practitionerId);
    setSessionDate(format(toDate(form.sessionDate), 'yyyy-MM-dd'));
    setCooperation(form.cooperation);
    setSessionDuration(form.sessionDuration);
    setSittingDuration(form.sittingDuration);
    setMood(form.mood);
    setConcentrationLevel(form.concentrationLevel);
    setNewReinforcers(form.newReinforcers);
    setWordsProduced(form.wordsProduced);
    setBreakActivities(form.breakActivities);
    setEndOfSessionActivity(form.endOfSessionActivity);
    setSuccesses(form.successes);
    setDifficulties(form.difficulties);
    setNotes(form.notes);
    setSelectedGoals(new Set(form.goalsWorkedOn.map((g) => g.goalId)));
    setAdditionalGoals(form.additionalGoals);
    setInitialized(true);
  }, [isEditMode, existingFormRes, initialized]);

  // Queries
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

  const { data: goalsRes } = useQuery({
    queryKey: ['goals', kidId],
    queryFn: () => goalsApi.getForKid(kidId),
    enabled: !!kidId,
  });

  // Fetch sessions for pre-population (new form from session)
  const { data: sessionsRes } = useQuery({
    queryKey: ['sessions', kidId],
    queryFn: () => sessionsApi.getForKid(kidId),
    enabled: !!kidId && !!sessionId && !isEditMode,
  });

  // Pre-populate from session data (new form mode)
  useEffect(() => {
    if (initialized || isEditMode || !sessionId || !sessionsRes?.data) return;

    const session = sessionsRes.data.find((s: Session) => s.id === sessionId);
    if (session) {
      const sessionDateObj = toDate(session.scheduledDate);
      setSessionDate(format(sessionDateObj, 'yyyy-MM-dd'));
      if (session.therapistId) {
        setPractitionerId(session.therapistId);
      }
      setInitialized(true);
    }
  }, [sessionId, sessionsRes, initialized, isEditMode]);

  const submitMutation = useMutation({
    mutationFn: (data: Omit<SessionForm, 'id' | 'createdAt' | 'updatedAt'>) =>
      formsApi.submit(data),
    onSuccess: (res) => {
      if (res.success && res.data) {
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['sessions', kidId] });
        queryClient.invalidateQueries({ queryKey: ['forms', kidId] });
        navigate(`/form/${res.data.id}/view`);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SessionForm>) =>
      formsApi.update(formId!, data),
    onSuccess: (res) => {
      if (res.success && res.data) {
        queryClient.invalidateQueries({ queryKey: ['sessions', kidId] });
        queryClient.invalidateQueries({ queryKey: ['forms', kidId] });
        queryClient.invalidateQueries({ queryKey: ['form', formId] });
        navigate(`/form/${res.data.id}/view`);
      }
    },
  });

  const kid = kidRes?.data;
  const practitioners = practitionersRes?.data || [];
  const goals = (goalsRes?.data || []).filter((g: Goal) => g.isActive);

  const goalsByCategory = GOAL_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat.id] = goals.filter((g: Goal) => g.categoryId === cat.id);
      return acc;
    },
    {} as Record<GoalCategoryId, Goal[]>
  );

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const goalsWorkedOn: GoalSnapshot[] = Array.from(selectedGoals).map(
      (goalId) => {
        const goal = goals.find((g: Goal) => g.id === goalId)!;
        return {
          goalId: goal.id,
          goalTitle: goal.title,
          categoryId: goal.categoryId,
        };
      }
    );

    const formData = {
      sessionId,
      kidId,
      practitionerId,
      sessionDate: new Date(sessionDate),
      cooperation,
      sessionDuration,
      sittingDuration,
      mood,
      concentrationLevel,
      newReinforcers,
      wordsProduced,
      breakActivities,
      endOfSessionActivity,
      successes,
      difficulties,
      notes,
      goalsWorkedOn,
      additionalGoals,
    };

    if (isEditMode) {
      updateMutation.mutate(formData);
    } else {
      submitMutation.mutate(formData);
    }
  };

  const isPending = submitMutation.isPending || updateMutation.isPending;

  if (!kidId && !isEditMode) {
    return (
      <div className="container">
        <div className="content-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#a0aec0' }}>חסר מזהה ילד</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Combined Header with Logo and Back */}
      <div className="kid-header-card">
        <div className="kid-header-top">
          <Link to={kidId ? `/kid/${kidId}` : '/'} className="kid-header-back">
            <span className="back-arrow">←</span>
            <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="logo-small" />
          </Link>
        </div>
        <h1 style={{ fontSize: '1.4em', fontWeight: 700, color: '#2d3748', margin: 0 }}>
          {isEditMode ? 'עריכת טופס' : 'טופס טיפול'} {kid ? `- ${kid.name}` : ''}
        </h1>
      </div>

      <div className="content-card">

        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <div className="form-row-2">
            <div className="form-group">
              <label>מטפלת *</label>
              <select
                value={practitionerId}
                onChange={(e) => setPractitionerId(e.target.value)}
                required
              >
                <option value="">בחר מטפלת</option>
                {practitioners
                  .filter((p) => p.type === 'מטפלת')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-group">
              <label>תאריך הטיפול *</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Cooperation - Mobile friendly percentage selector */}
          <div className="form-group">
            <label>שיתוף פעולה</label>
            <div className="percentage-selector">
              {[20, 40, 60, 80, 100].map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`percentage-btn ${cooperation === val ? 'active' : ''}`}
                  onClick={() => setCooperation(val)}
                >
                  {val}%
                </button>
              ))}
            </div>
            <div className="slider-container mobile-hidden">
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={cooperation}
                onChange={(e) => setCooperation(Number(e.target.value))}
              />
              <span className="slider-value">{cooperation}%</span>
            </div>
          </div>

          {/* Duration Fields */}
          <div className="form-row-2">
            <div className="form-group">
              <label>משך הטיפול (דקות)</label>
              <input
                type="number"
                min="5"
                max="180"
                value={sessionDuration}
                onChange={(e) => setSessionDuration(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label>משך ישיבה (דקות)</label>
              <input
                type="number"
                min="0"
                max="180"
                value={sittingDuration}
                onChange={(e) => setSittingDuration(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Rich Text Fields */}
          <div className="form-group">
            <label>מצב רוח</label>
            <RichTextEditor value={mood} onChange={setMood} />
          </div>

          <div className="form-group">
            <label>רמת ריכוז / עייפות</label>
            <RichTextEditor value={concentrationLevel} onChange={setConcentrationLevel} />
          </div>

          <div className="form-group">
            <label>מחזקים (חדשים)</label>
            <RichTextEditor value={newReinforcers} onChange={setNewReinforcers} />
          </div>

          <div className="form-group">
            <label>מילים שהפיק</label>
            <RichTextEditor value={wordsProduced} onChange={setWordsProduced} />
          </div>

          <div className="form-group">
            <label>פעילות בהפסקות</label>
            <RichTextEditor value={breakActivities} onChange={setBreakActivities} />
          </div>

          <div className="form-group">
            <label>פעילות סוף שיעור</label>
            <RichTextEditor value={endOfSessionActivity} onChange={setEndOfSessionActivity} />
          </div>

          <div className="form-group">
            <label>הצלחות</label>
            <RichTextEditor value={successes} onChange={setSuccesses} />
          </div>

          <div className="form-group">
            <label>קשיים</label>
            <RichTextEditor value={difficulties} onChange={setDifficulties} />
          </div>

          <div className="form-group">
            <label>הערות</label>
            <RichTextEditor value={notes} onChange={setNotes} />
          </div>

          {/* Goals Section */}
          <div className="form-group">
            <label style={{ marginBottom: '12px' }}>מטרות שעבדנו עליהן</label>

            {GOAL_CATEGORIES.map((cat) => {
              const catGoals = goalsByCategory[cat.id] || [];
              if (catGoals.length === 0) return null;

              return (
                <div key={cat.id} className="goals-category" style={{ '--category-color': cat.color } as React.CSSProperties}>
                  <div className="goals-category-name" style={{ color: cat.color }}>
                    {cat.nameHe}
                  </div>
                  <div className="checkbox-group">
                    {catGoals.map((goal: Goal) => (
                      <label key={goal.id} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedGoals.has(goal.id)}
                          onChange={() => toggleGoal(goal.id)}
                        />
                        <span>{goal.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

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

          {/* Submit */}
          <div className="form-actions">
            <Link to={kidId ? `/kid/${kidId}/sessions` : '/'} className="btn-secondary">
              ביטול
            </Link>
            <button
              type="submit"
              className="btn-primary"
              disabled={isPending}
            >
              {isPending ? 'שומר...' : 'שמור טופס'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
