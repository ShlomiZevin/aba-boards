import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { formsApi, kidsApi, practitionersApi } from '../api/client';
import { toDate } from '../utils/date';
import { GOAL_CATEGORIES } from '../types';

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

  const kid = kidRes?.data;
  const practitioners = practitionersRes?.data || [];
  const therapist = practitioners.find((p) => p.id === form?.practitionerId);

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
          <Link to="/" className="btn-primary">
            חזור לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  const dateStr = format(toDate(form.sessionDate), 'dd/MM/yyyy');

  // Group goals by category
  const goalsByCategory = GOAL_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat.id] = form.goalsWorkedOn.filter((g) => g.categoryId === cat.id);
      return acc;
    },
    {} as Record<string, typeof form.goalsWorkedOn>
  );

  const cooperationColor =
    form.cooperation >= 70
      ? '#388E3C'
      : form.cooperation >= 50
        ? '#F57C00'
        : '#D32F2F';

  return (
    <div className="container">
      {/* Combined Header with Logo and Back */}
      <div className="kid-header-card">
        <div className="kid-header-top">
          <Link to={kid ? `/kid/${kid.id}` : '/'} className="kid-header-back">
            <span className="back-arrow">←</span>
            <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="logo-small" />
          </Link>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.4em', fontWeight: 700, color: '#2d3748', margin: 0 }}>טופס פגישה</h1>
            {kid && <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>{kid.name}</p>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate(`/form/${formId}/edit`)}
              className="btn-primary btn-small"
            >
              ערוך
            </button>
            <button
              onClick={() => window.print()}
              className="btn-secondary btn-small"
            >
              הדפס
            </button>
          </div>
        </div>
      </div>

      <div className="content-card">

        {/* Basic Info */}
        <div className="form-view-stats">
          <div className="stat">
            <div className="stat-label">תאריך</div>
            <div className="stat-value">{dateStr}</div>
          </div>
          <div className="stat">
            <div className="stat-label">מטפלת</div>
            <div className="stat-value">{therapist?.name || '-'}</div>
          </div>
          <div className="stat">
            <div className="stat-label">משך הטיפול</div>
            <div className="stat-value">{form.sessionDuration} דקות</div>
          </div>
          <div className="stat">
            <div className="stat-label">שיתוף פעולה</div>
            <div className="stat-value" style={{ color: cooperationColor }}>
              {form.cooperation}%
            </div>
          </div>
        </div>

        {/* Fields */}
        <div>
          <FieldRow label="משך ישיבה">
            <div className="form-field-value">{form.sittingDuration} דקות</div>
          </FieldRow>
          <FieldRow label="מצב רוח">
            <RichTextDisplay html={form.mood} />
          </FieldRow>
          <FieldRow label="רמת ריכוז / עייפות">
            <RichTextDisplay html={form.concentrationLevel} />
          </FieldRow>
          <FieldRow label="מחזקים (חדשים)">
            <RichTextDisplay html={form.newReinforcers} />
          </FieldRow>
          <FieldRow label="מילים שהפיק">
            <RichTextDisplay html={form.wordsProduced} />
          </FieldRow>
          <FieldRow label="פעילות בהפסקות">
            <RichTextDisplay html={form.breakActivities} />
          </FieldRow>
          <FieldRow label="פעילות סוף שיעור">
            <RichTextDisplay html={form.endOfSessionActivity} />
          </FieldRow>
          <FieldRow label="הצלחות">
            <RichTextDisplay html={form.successes} />
          </FieldRow>
          <FieldRow label="קשיים">
            <RichTextDisplay html={form.difficulties} />
          </FieldRow>
          <FieldRow label="הערות">
            <RichTextDisplay html={form.notes} />
          </FieldRow>
        </div>

        {/* Goals */}
        <div className="goals-list">
          <h4>מטרות שעבדנו עליהן</h4>

          {GOAL_CATEGORIES.map((cat) => {
            const catGoals = goalsByCategory[cat.id] || [];
            if (catGoals.length === 0) return null;

            return (
              <div key={cat.id} className="goals-category">
                <div className="goals-category-name" style={{ color: cat.color }}>
                  {cat.nameHe}
                </div>
                <ul>
                  {catGoals.map((g, idx) => (
                    <li key={idx}>{g.goalTitle}</li>
                  ))}
                </ul>
              </div>
            );
          })}

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
    </div>
  );
}
