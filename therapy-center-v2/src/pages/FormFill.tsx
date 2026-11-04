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
import GoalsWeeklyTable from '../components/GoalsWeeklyTable';
import Icon from '../v2/Icon';
import { FfHeader, FfIcon, FfTextSection, FfAdditionalGoals } from '../v2/pages/ffParts';

const PCT_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const pctWord = (v: number) => (v >= 80 ? 'מצוין' : v >= 60 ? 'טוב' : v >= 40 ? 'בינוני' : 'נמוך');



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
  const [sessionTime, setSessionTime] = useState(format(new Date(), 'HH:mm'));

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
    const formDateObj = toDate(form.sessionDate);
    setSessionDate(format(formDateObj, 'yyyy-MM-dd'));
    setSessionTime(format(formDateObj, 'HH:mm'));

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
      setSessionTime(format(sessionDateObj, 'HH:mm'));
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
  const goals = (goalsRes?.data || []).filter((g: Goal) => g.isActive !== false);

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
      sessionDate: new Date(`${sessionDate}T${sessionTime}:00`),
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
      <div className="ff">
        <div className="nb-card ff-missing">
          <p className="hand">חסר מזהה ילד</p>
          <Link to={links.home()} className="nb-btn-ghost">לדף הבית</Link>
        </div>
      </div>
    );
  }

  const backTo = kidId ? links.kidDetail(kidId) : links.home();

  // Render a dynamic field based on type
  const renderField = (section: FormTemplateSection) => {
    const value = fieldValues[section.id];

    switch (section.type) {
      case 'percentage': {
        const num = typeof value === 'number' ? value : undefined;
        const step = (d: number) => updateField(section.id, Math.min(100, Math.max(10, (num ?? 50) + d)));
        return (
          <section className="nb-card ff-pct" key={section.id}>
            <div className="ff-pct-head">
              <h2 className="ff-sec-title">{section.label}</h2>
              <div className="ff-pct-read" aria-live="polite">
                <b className="tabular">{num !== undefined ? `${num}%` : '—'}</b>
                {num !== undefined && <span className="ff-pct-word">{pctWord(num)}</span>}
              </div>
            </div>
            <div className="ff-pct-grid" role="radiogroup" aria-label={section.label}>
              {PCT_STEPS.map((val) => (
                <button
                  key={val}
                  type="button"
                  role="radio"
                  aria-checked={num === val}
                  className={`ff-pct-btn tabular${num === val ? ' is-on' : ''}${num !== undefined && val < num ? ' is-under' : ''}`}
                  onClick={() => updateField(section.id, val)}
                >
                  {val}
                </button>
              ))}
            </div>
            <div className="ff-pct-fine">
              <button type="button" className="ff-step" onClick={() => step(-5)} aria-label="הורדה ב-5"><FfIcon name="minus" size={20} strokeWidth={2.4} /></button>
              <div className="ff-pct-track" aria-hidden="true"><i style={{ width: `${num ?? 0}%` }} /></div>
              <button type="button" className="ff-step" onClick={() => step(5)} aria-label="הוספה של 5"><Icon name="plus" size={20} strokeWidth={2.4} /></button>
            </div>
          </section>
        );
      }

      case 'number': {
        const num = (value as number) || 0;
        return (
          <div className="ff-num" key={section.id}>
            <label className="ff-num-label" htmlFor={`ff-${section.id}`}>{section.label}</label>
            <div className="ff-num-ctl">
              <button type="button" className="ff-step" onClick={() => updateField(section.id, Math.max(0, num - 5))} aria-label="פחות 5"><FfIcon name="minus" size={20} strokeWidth={2.4} /></button>
              <input
                id={`ff-${section.id}`}
                type="number"
                inputMode="numeric"
                min="0"
                max="999"
                className="tabular"
                value={num}
                onChange={(e) => updateField(section.id, Number(e.target.value))}
              />
              <button type="button" className="ff-step" onClick={() => updateField(section.id, Math.min(999, num + 5))} aria-label="עוד 5"><Icon name="plus" size={20} strokeWidth={2.4} /></button>
            </div>
          </div>
        );
      }

      case 'text':
      default:
        return (
          <FfTextSection
            key={section.id}
            label={section.label}
            value={(value as string) || ''}
            onChange={(val) => updateField(section.id, val)}
          />
        );
    }
  };

  // Keep template order: consecutive number fields share a card, consecutive text fields share one checklist
  const isText = (s: FormTemplateSection) => s.type !== 'number' && s.type !== 'percentage';
  const renderDynamicFields = () => {
    const elements: React.ReactNode[] = [];
    let i = 0;
    while (i < template.length) {
      const section = template[i];
      if (section.type === 'number') {
        const group: FormTemplateSection[] = [];
        while (i < template.length && template[i].type === 'number') group.push(template[i++]);
        elements.push(<div className="nb-card ff-nums" key={`nums-${group[0].id}`}>{group.map(renderField)}</div>);
      } else if (isText(section)) {
        const group: FormTemplateSection[] = [];
        while (i < template.length && isText(template[i])) group.push(template[i++]);
        elements.push(<ol className="nb-card ff-check" key={`txt-${group[0].id}`}>{group.map(renderField)}</ol>);
      } else {
        elements.push(renderField(section));
        i++;
      }
    }
    return elements;
  };

  const staffName = practitioners.find((p) => p.id === practitionerId)?.name || '';

  return (
    <div className="ff ff-fill">
      <FfHeader backTo={backTo} kid={kid} title={isEditMode ? 'עריכת טופס' : 'טופס טיפול'} />

      <form onSubmit={handleSubmit} className="ff-form">
        <div className="ff-meta">
          <label className="ff-meta-item ff-meta-date">
            <span className="ff-meta-k"><Icon name="calendar" size={16} /> תאריך *</span>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              required
              disabled={!!sessionId}
            />
          </label>
          <label className="ff-meta-item ff-meta-time">
            <span className="ff-meta-k"><Icon name="clock" size={16} /> שעה</span>
            <input
              type="time"
              value={sessionTime}
              onChange={(e) => setSessionTime(e.target.value)}
            />
          </label>
          <label className="ff-meta-item ff-meta-staff">
            <span className="ff-meta-k"><Icon name="user" size={16} /> איש/ת צוות *</span>
            {isTherapistView ? (
              <input type="text" value={staffName} disabled />
            ) : (
              <select
                value={practitionerId}
                onChange={(e) => setPractitionerId(e.target.value)}
                required
              >
                <option value="">בחר איש/ת צוות</option>
                {practitioners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>

        <div className="ff-layout">
          <div className="ff-col">
            {renderDynamicFields()}
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

        {/* Sticky save bar */}
        <div className="ff-savebar">
          <Link to={backTo} className="nb-btn-ghost ff-savebar-cancel">ביטול</Link>
          <button type="submit" className="nb-btn ff-savebar-save" disabled={isPending}>
            <Icon name="check" size={22} strokeWidth={2.4} />
            {isPending ? 'שומר...' : 'שמירת הטופס'}
          </button>
        </div>
      </form>
    </div>
  );
}
