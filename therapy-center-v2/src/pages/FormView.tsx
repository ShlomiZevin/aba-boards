import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { formsApi, kidsApi, practitionersApi, goalsApi, formTemplateApi } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import ConfirmModal from '../components/ConfirmModal';
import { toDate } from '../utils/date';
import { DEFAULT_FORM_TEMPLATE } from '../types';
import type { Goal, FormTemplateSection } from '../types';
import GoalsWeeklyTable from '../components/GoalsWeeklyTable';
import Icon from '../v2/Icon';
import { FfHeader, FfIcon, FfField } from '../v2/pages/ffParts';

export default function FormView() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isTherapistView, isParentView, practitionerId: contextPractitionerId } = useTherapist();
  const links = useTherapistLinks();
  const [showDeleteForm, setShowDeleteForm] = useState(false);

  const { data: formRes, isLoading } = useQuery({
    queryKey: ['form', formId],
    queryFn: () => formsApi.getById(formId!),
    enabled: !!formId,
  });

  const form = formRes?.data;

  const { data: kidRes } = useQuery({
    queryKey: ['kid', form?.kidId],
    queryFn: () => kidsApi.getById(form!.kidId),
    enabled: !!form?.kidId,
  });

  const { data: practitionersRes } = useQuery({
    queryKey: ['practitioners', form?.kidId],
    queryFn: () => practitionersApi.getForKid(form!.kidId),
    enabled: !!form?.kidId,
  });

  const { data: allGoalsRes } = useQuery({
    queryKey: ['goals', form?.kidId],
    queryFn: () => goalsApi.getForKid(form!.kidId),
    enabled: !!form?.kidId,
  });

  const { data: templateRes } = useQuery({
    queryKey: ['formTemplate', form?.kidId],
    queryFn: () => formTemplateApi.get(form!.kidId),
    enabled: !!form?.kidId,
  });

  const deleteFormMutation = useMutation({
    mutationFn: () => formsApi.delete(formId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      navigate(form?.kidId ? links.kidDetail(form.kidId) : links.home());
    },
  });

  const kid = kidRes?.data;
  const practitioners = practitionersRes?.data || [];
  const allGoals = (allGoalsRes?.data || []).filter((g: Goal) => g.isActive);
  const therapist = practitioners.find((p) => p.id === form?.practitionerId);
  const template: FormTemplateSection[] = (templateRes?.data?.sections || DEFAULT_FORM_TEMPLATE)
    .sort((a: FormTemplateSection, b: FormTemplateSection) => a.order - b.order);

  if (isLoading) {
    return (
      <div className="ff"><div className="loading">טוען...</div></div>
    );
  }

  if (!form) {
    return (
      <div className="ff">
        <div className="nb-card ff-missing">
          <p className="hand">הטופס לא נמצא</p>
          <Link to={links.home()} className="nb-btn">חזור לדף הבית</Link>
        </div>
      </div>
    );
  }

  // In therapist view: can view all forms, but only edit/delete own forms
  const isOwnForm = isParentView ? false : (!isTherapistView || form.practitionerId === contextPractitionerId);

  const sessionDateObj = toDate(form.sessionDate);
  const dateStr = format(sessionDateObj, 'dd/MM/yyyy');
  const hourStr = format(sessionDateObj, 'HH:mm');

  // Get value for a field from form data
  const getFieldValue = (section: FormTemplateSection): string | number | undefined => {
    const knownValue = (form as unknown as Record<string, unknown>)[section.id];
    if (knownValue !== undefined) return knownValue as string | number;
    if (form.customFields?.[section.id] !== undefined) return form.customFields[section.id];
    return undefined;
  };

  // Separate stat fields (percentage/number with values) from text fields for the stats bar
  const statFields = template.filter(s => s.type === 'percentage' || s.type === 'number');
  const textFields = template.filter(s => s.type === 'text');

  // goals worked on as a Set for the table
  const workedOnIds = new Set(form.goalsWorkedOn.map(g => g.goalId));

  return (
    <div className="ff ff-view">
      <FfHeader
        backTo={kid ? links.kidDetail(kid.id) : links.home()}
        kid={kid}
        title="טופס טיפול"
        actions={
          <>
            {isOwnForm && (
              <button onClick={() => navigate(links.formEdit(formId!))} className="nb-btn-ghost ff-edit-btn">
                <Icon name="edit" size={18} /> עריכה
              </button>
            )}
            <button onClick={() => window.print()} className="ff-icon-btn" aria-label="הדפסה" title="הדפסה">
              <FfIcon name="print" />
            </button>
            {isOwnForm && !isTherapistView && (
              <button onClick={() => setShowDeleteForm(true)} className="ff-icon-btn danger" aria-label="מחק טופס" title="מחק טופס">
                <Icon name="trash" size={20} />
              </button>
            )}
          </>
        }
      >
        <div className="ff-sub">
          <span><Icon name="calendar" size={16} /> <b className="tabular">{dateStr}</b></span>
          <span className="tabular"><Icon name="clock" size={16} /> {hourStr}</span>
          <span><Icon name="user" size={16} /> {therapist?.name || '-'}</span>
        </div>
      </FfHeader>

      {statFields.some(s => getFieldValue(s) !== undefined) && (
        <div className="ff-stats">
          {statFields.map((section, i) => {
            const value = getFieldValue(section);
            if (value === undefined) return null;
            const isPercentage = section.type === 'percentage';
            const numVal = value as number;
            const tone = isPercentage ? (numVal >= 70 ? 'mint' : numVal >= 50 ? 'yellow' : 'pink') : (i % 2 ? 'peach' : 'sky');
            return (
              <span key={section.id} className={`ff-stat tone-${tone}`} style={{ ['--rot' as string]: `${i % 2 ? 2 : -2}deg` }}>
                <b className="tabular">{isPercentage ? `${numVal}%` : `${numVal}`}</b> {section.label}
              </span>
            );
          })}
        </div>
      )}

      <div className="ff-view-grid">
        <article className="nb-card ff-page">
          {textFields.map(section => (
            <FfField key={section.id} label={section.label} html={(getFieldValue(section) as string) || ''} />
          ))}
        </article>

        <section className="nb-card ff-goals">
          <div className="ff-goals-head">
            <h2 className="ff-sec-title"><Icon name="target" size={22} /> מטרות שעבדנו עליהן</h2>
            {form.goalsWorkedOn.length > 0 && <span className="nb-sticker tone-mint ff-goals-count">{form.goalsWorkedOn.length} מטרות</span>}
          </div>

          <GoalsWeeklyTable
            kidId={form.kidId}
            goals={allGoals}
            selectedGoals={workedOnIds}
            currentFormDate={format(toDate(form.sessionDate), 'yyyy-MM-dd')}
            currentFormId={form.id}
            practitioners={practitioners}
          />

          {form.additionalGoals.length > 0 && (
            <div className="ff-extra">
              <div className="ff-extra-title">מטרות נוספות</div>
              <ul className="ff-extra-list">
                {form.additionalGoals.map((g, idx) => (
                  <li key={idx}>{g}</li>
                ))}
              </ul>
            </div>
          )}

          {form.goalsWorkedOn.length === 0 && form.additionalGoals.length === 0 && (
            <p className="ff-empty-note">לא צוינו מטרות</p>
          )}
        </section>
      </div>

      <div className="ff-foot tabular">
        נוצר ב-{format(toDate(form.createdAt), 'dd/MM/yyyy HH:mm')}
      </div>

      {/* Delete Form Confirmation */}
      {showDeleteForm && (
        <ConfirmModal
          title="מחיקת טופס"
          message={`האם למחוק את הטופס מתאריך ${dateStr}?\nהטיפול יחזור לסטטוס "ממתין לטופס".`}
          confirmText={deleteFormMutation.isPending ? 'מוחק...' : 'מחק טופס'}
          confirmStyle="danger"
          onConfirm={() => deleteFormMutation.mutate()}
          onCancel={() => setShowDeleteForm(false)}
        />
      )}
    </div>
  );
}
