import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { kidsApi, practitionersApi, goalsApi, formsApi, formTemplateApi, sessionsApi } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import { toDate } from '../utils/date';
import { DEFAULT_FORM_TEMPLATE, KNOWN_FIELD_IDS } from '../types';
import type { Goal, GoalSnapshot, SessionForm, Session, FormTemplateSection } from '../types';
import RichTextEditor from '../components/RichTextEditor';
import GoalsWeeklyTable from '../components/GoalsWeeklyTable';

const BASE = import.meta.env.BASE_URL;

export default function FormFill() {
  const { formId } = useParams(); // For edit mode
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isTherapistView, practitionerId: contextPractitionerId } = useTherapist();
  const links = useTherapistLinks();

  const kidIdParam = searchParams.get('kidId') || '';
  const sessionId = searchParams.get('sessionId') || undefined;
  const dateParam = searchParams.get('date'); // Date from calendar click
  const isEditMode = !!formId;

  // Form state
  const [kidId, setKidId] = useState(kidIdParam);
  const [practitionerId, setPractitionerId] = useState(
    isTherapistView && contextPractitionerId ? contextPractitionerId : ''
  );
  const [sessionDate, setSessionDate] = useState(dateParam || format(new Date(), 'yyyy-MM-dd'));

  // Dynamic field values (replaces individual state vars)
  const [fieldValues, setFieldValues] = useState<Record<string, string | number>>({
    cooperation: 70,
    sessionDuration: 45,
    sittingDuration: 30,
  });

  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [additionalGoals, setAdditionalGoals] = useState<string[]>([]);
  const [newGoalText, setNewGoalText] = useState('');

  // Track if we've initialized
  const [initialized, setInitialized] = useState(false);

  const updateField = (fieldId: string, value: string | number) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  // Fetch existing form for edit mode
  const { data: existingFormRes } = useQuery({
    queryKey: ['form', formId],
    queryFn: () => formsApi.getById(formId!),
    enabled: isEditMode,
  });

  // Fetch form template for kid
  const { data: templateRes } = useQuery({
    queryKey: ['formTemplate', kidId],
    queryFn: () => formTemplateApi.get(kidId),
    enabled: !!kidId,
  });

  const template: FormTemplateSection[] = (templateRes?.data?.sections || DEFAULT_FORM_TEMPLATE)
    .sort((a: FormTemplateSection, b: FormTemplateSection) => a.order - b.order);

  // Initialize from existing form (edit mode)
  useEffect(() => {
    if (initialized || !isEditMode || !existingFormRes?.data) return;

    const form = existingFormRes.data;
    setKidId(form.kidId);
    setPractitionerId(form.practitionerId);
    setSessionDate(format(toDate(form.sessionDate), 'yyyy-MM-dd'));

    // Build field values from form data
    const values: Record<string, string | number> = {};
    for (const section of template) {
      const knownValue = (form as unknown as Record<string, unknown>)[section.id];
      if (knownValue !== undefined) {
        values[section.id] = knownValue as string | number;
      } else if (form.customFields?.[section.id] !== undefined) {
        values[section.id] = form.customFields[section.id];
      }
    }
    setFieldValues(values);
    setSelectedGoals(new Set(form.goalsWorkedOn.map((g) => g.goalId)));
    setAdditionalGoals(form.additionalGoals);
    setInitialized(true);
  }, [isEditMode, existingFormRes, initialized, template]);

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
      if (isTherapistView && contextPractitionerId) {
        setPractitionerId(contextPractitionerId);
      } else if (session.therapistId) {
        setPractitionerId(session.therapistId);
      }
      setInitialized(true);
    }
  }, [sessionId, sessionsRes, initialized, isEditMode, isTherapistView, contextPractitionerId]);

  const submitMutation = useMutation({
    mutationFn: (data: Omit<SessionForm, 'id' | 'createdAt' | 'updatedAt'>) =>
      formsApi.submit(data),
    onSuccess: (res) => {
      if (res.success && res.data) {
        queryClient.invalidateQueries({ queryKey: ['sessions', kidId] });
        queryClient.invalidateQueries({ queryKey: ['forms', kidId] });
        navigate(links.formView(res.data.id));
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
        navigate(links.formView(res.data.id));
      }
    },
  });

  const kid = kidRes?.data;
  const practitioners = practitionersRes?.data || [];
  const goals = (goalsRes?.data || []).filter((g: Goal) => g.isActive);

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

    // Split field values into known fields and custom fields
    const knownFields: Record<string, unknown> = {};
    const customFields: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(fieldValues)) {
      if (KNOWN_FIELD_IDS.includes(key)) {
        knownFields[key] = value;
      } else {
        customFields[key] = value;
      }
    }

    const formData = {
      sessionId,
      kidId,
      practitionerId,
      sessionDate: new Date(sessionDate),
      // Known fields with defaults
      cooperation: (knownFields.cooperation as number) || 70,
      sessionDuration: (knownFields.sessionDuration as number) || 45,
      sittingDuration: (knownFields.sittingDuration as number) || 30,
      mood: (knownFields.mood as string) || '',
      concentrationLevel: (knownFields.concentrationLevel as string) || '',
      newReinforcers: (knownFields.newReinforcers as string) || '',
      wordsProduced: (knownFields.wordsProduced as string) || '',
      breakActivities: (knownFields.breakActivities as string) || '',
      endOfSessionActivity: (knownFields.endOfSessionActivity as string) || '',
      successes: (knownFields.successes as string) || '',
      difficulties: (knownFields.difficulties as string) || '',
      notes: (knownFields.notes as string) || '',
      goalsWorkedOn,
      additionalGoals,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
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

  // Render a dynamic field based on type
  const renderField = (section: FormTemplateSection) => {
    const value = fieldValues[section.id];

    switch (section.type) {
      case 'percentage':
        return (
          <div className="form-group" key={section.id}>
            <label>{section.label}</label>
            <div className="percentage-selector">
              {[20, 40, 60, 80, 100].map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`percentage-btn ${value === val ? 'active' : ''}`}
                  onClick={() => updateField(section.id, val)}
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
                value={(value as number) || 50}
                onChange={(e) => updateField(section.id, Number(e.target.value))}
              />
              <span className="slider-value">{(value as number) || 50}%</span>
            </div>
          </div>
        );

      case 'number':
        return (
          <div className="form-group" key={section.id}>
            <label>{section.label}</label>
            <input
              type="number"
              min="0"
              max="999"
              value={(value as number) || 0}
              onChange={(e) => updateField(section.id, Number(e.target.value))}
            />
          </div>
        );

      case 'text':
      default:
        return (
          <div className="form-group" key={section.id}>
            <label>{section.label}</label>
            <RichTextEditor
              value={(value as string) || ''}
              onChange={(val) => updateField(section.id, val)}
            />
          </div>
        );
    }
  };

  // Group consecutive number fields into rows of 2
  const renderDynamicFields = () => {
    const elements: React.ReactNode[] = [];
    let i = 0;
    while (i < template.length) {
      const section = template[i];
      // Try to pair consecutive number fields
      if (section.type === 'number' && i + 1 < template.length && template[i + 1].type === 'number') {
        elements.push(
          <div className="form-row-2" key={`row-${section.id}`}>
            {renderField(section)}
            {renderField(template[i + 1])}
          </div>
        );
        i += 2;
      } else {
        elements.push(renderField(section));
        i++;
      }
    }
    return elements;
  };

  return (
    <div className="container">
      {/* Combined Header with Logo and Back */}
      <div className="kid-header-card">
        <div className="kid-header-top">
          <Link to={kidId ? links.kidDetail(kidId) : links.home()} className="kid-header-back">
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
          {/* Basic Info - always shown */}
          <div className="form-row-2">
            <div className="form-group">
              <label>מטפלת *</label>
              {isTherapistView ? (
                <input
                  type="text"
                  value={practitioners.find((p) => p.id === practitionerId)?.name || ''}
                  disabled
                  style={{ backgroundColor: '#f1f5f9' }}
                />
              ) : (
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
              )}
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

          {/* Dynamic Template Fields */}
          {renderDynamicFields()}

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

          {/* Submit */}
          <div className="form-actions">
            <Link to={kidId ? links.kidDetail(kidId) : links.home()} className="btn-secondary">
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
