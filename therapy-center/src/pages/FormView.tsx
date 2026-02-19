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

const BASE = import.meta.env.BASE_URL;

function RichTextDisplay({ html }: { html: string }) {
  if (!html || html === '<p></p>') {
    return <span className="form-field-value empty">-</span>;
  }
  return (
    <div
      className="form-field-value"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-field">
      <div className="form-field-label">{label}</div>
      {children}
    </div>
  );
}

export default function FormView() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isTherapistView, practitionerId: contextPractitionerId } = useTherapist();
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
      <div className="container">
        <div className="loading">טוען...</div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="container">
        <div className="content-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#a0aec0', marginBottom: '16px' }}>הטופס לא נמצא</p>
          <Link to={links.home()} className="btn-primary">
            חזור לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  // Therapist access control: can only view own forms
  if (isTherapistView && form.practitionerId !== contextPractitionerId) {
    return (
      <div className="container">
        <div className="content-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#a0aec0', marginBottom: '16px' }}>אין הרשאה לצפות בטופס זה</p>
          <Link to={links.home()} className="btn-primary">
            חזור לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  const dateStr = format(toDate(form.sessionDate), 'dd/MM/yyyy');

  // Get value for a field from form data
  const getFieldValue = (section: FormTemplateSection): string | number | undefined => {
    const knownValue = (form as Record<string, unknown>)[section.id];
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
    <div className="container">
      {/* Combined Header with Logo and Back */}
      <div className="kid-header-card">
        <div className="kid-header-top">
          <Link to={kid ? links.kidDetail(kid.id) : links.home()} className="kid-header-back">
            <span className="back-arrow">←</span>
            <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="logo-small" />
          </Link>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.4em', fontWeight: 700, color: '#2d3748', margin: 0 }}>טופס טיפול</h1>
            {kid && <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>{kid.name}</p>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isTherapistView && (
              <button
                onClick={() => navigate(links.formEdit(formId!))}
                className="btn-primary btn-small"
              >
                ערוך
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="btn-secondary btn-small"
            >
              הדפס
            </button>
            {!isTherapistView && (
              <button
                onClick={() => setShowDeleteForm(true)}
                className="btn-small"
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1em', padding: '6px 8px' }}
                title="מחק טופס"
              >
                🗑
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="content-card">

        {/* Stats Bar - date, therapist, and number/percentage fields */}
        <div className="form-view-stats" style={{ gridTemplateColumns: `repeat(${Math.min(statFields.length + 2, 4)}, 1fr)` }}>
          <div className="stat">
            <div className="stat-label">תאריך</div>
            <div className="stat-value">{dateStr}</div>
          </div>
          <div className="stat">
            <div className="stat-label">מטפלת</div>
            <div className="stat-value">{therapist?.name || '-'}</div>
          </div>
          {statFields.map(section => {
            const value = getFieldValue(section);
            if (value === undefined) return null;
            const isPercentage = section.type === 'percentage';
            const numVal = value as number;
            const color = isPercentage
              ? (numVal >= 70 ? '#388E3C' : numVal >= 50 ? '#F57C00' : '#D32F2F')
              : undefined;
            return (
              <div key={section.id} className="stat">
                <div className="stat-label">{section.label}</div>
                <div className="stat-value" style={color ? { color } : undefined}>
                  {isPercentage ? `${numVal}%` : `${numVal}`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Text Fields */}
        <div>
          {textFields.map(section => {
            const value = getFieldValue(section);
            return (
              <FieldRow key={section.id} label={section.label}>
                <RichTextDisplay html={(value as string) || ''} />
              </FieldRow>
            );
          })}
        </div>

        {/* Goals */}
        <div className="goals-list">
          <h4>מטרות שעבדנו עליהן</h4>

          <GoalsWeeklyTable
            kidId={form.kidId}
            goals={allGoals}
            selectedGoals={workedOnIds}
            currentFormDate={format(toDate(form.sessionDate), 'yyyy-MM-dd')}
            currentFormId={form.id}
            practitioners={practitioners}
          />

          {form.additionalGoals.length > 0 && (
            <div className="goals-category">
              <div className="goals-category-name" style={{ color: '#64748b' }}>
                מטרות נוספות
              </div>
              <ul>
                {form.additionalGoals.map((g, idx) => (
                  <li key={idx}>{g}</li>
                ))}
              </ul>
            </div>
          )}

          {form.goalsWorkedOn.length === 0 && form.additionalGoals.length === 0 && (
            <p style={{ color: '#a0aec0' }}>לא צוינו מטרות</p>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '2px solid #f0f4f8', fontSize: '0.85em', color: '#a0aec0' }}>
          נוצר ב-{format(toDate(form.createdAt), 'dd/MM/yyyy HH:mm')}
        </div>
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
