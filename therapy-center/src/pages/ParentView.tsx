import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { kidsApi, formsApi, practitionersApi, goalsApi } from '../api/client';
import { toDate } from '../utils/date';
import { GOAL_CATEGORIES, DEFAULT_FORM_TEMPLATE } from '../types';
import type { SessionForm, Practitioner, Goal, FormTemplateSection } from '../types';

const BASE = import.meta.env.BASE_URL;
const DEFAULT_AVATAR = `${BASE}me-default-small.jpg`;

function FormCard({ form, practitioners, kidId }: { form: SessionForm; practitioners: Practitioner[]; kidId: string }) {
  const [expanded, setExpanded] = useState(false);
  const therapist = practitioners.find(p => p.id === form.practitionerId);
  const dateStr = format(toDate(form.sessionDate), 'dd/MM/yyyy');

  const { data: templateRes } = useQuery({
    queryKey: ['parent-template', kidId],
    queryFn: () => import('../api/client').then(m => m.formTemplateApi.get(kidId)),
    enabled: expanded,
  });
  const template: FormTemplateSection[] = (templateRes?.data?.sections || DEFAULT_FORM_TEMPLATE)
    .sort((a: FormTemplateSection, b: FormTemplateSection) => a.order - b.order);
  const textFields = template.filter(s => s.type === 'text');
  const statFields = template.filter(s => s.type !== 'text');

  function getVal(section: FormTemplateSection) {
    const v = (form as unknown as Record<string, unknown>)[section.id];
    if (v !== undefined) return v;
    return form.customFields?.[section.id];
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          width: '100%', padding: '12px 14px', background: '#f8fafc',
          border: 'none', cursor: 'pointer', textAlign: 'right',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>{dateStr}</div>
          {therapist && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{therapist.name}</div>}
        </div>
        <span style={{ color: '#94a3b8', fontSize: 16, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>←</span>
      </button>

      {expanded && (
        <div style={{ padding: '14px 16px', borderTop: '1px solid #e2e8f0', direction: 'rtl' }}>
          {/* Stats */}
          {statFields.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {statFields.map(s => {
                const val = getVal(s);
                if (!val && val !== 0) return null;
                return (
                  <div key={s.id} style={{ background: '#f0f7ff', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>{s.label}: </span>
                    <span style={{ fontWeight: 600, color: '#1f2937' }}>{val as string | number}{s.type === 'percentage' ? '%' : ''}</span>
                  </div>
                );
              })}
            </div>
          )}
          {/* Goals worked on */}
          {form.goalsWorkedOn?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>מטרות שעבדנו עליהן:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {form.goalsWorkedOn.map(g => (
                  <span key={g.goalId} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 8px', fontSize: 12, color: '#15803d' }}>{g.goalTitle}</span>
                ))}
              </div>
            </div>
          )}
          {/* Text fields */}
          {textFields.map(s => {
            const val = getVal(s) as string;
            if (!val || val === '<p></p>') return null;
            return (
              <div key={s.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>{s.label}:</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: val }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ParentView({ kidId }: { kidId: string }) {
  const { data: kidRes, isLoading: kidLoading } = useQuery({
    queryKey: ['parent-kid', kidId],
    queryFn: () => kidsApi.getById(kidId),
  });

  const { data: formsRes, isLoading: formsLoading } = useQuery({
    queryKey: ['parent-forms', kidId],
    queryFn: () => formsApi.getForKid(kidId),
    enabled: !!kidId,
  });

  const { data: practitionersRes } = useQuery({
    queryKey: ['parent-practitioners', kidId],
    queryFn: () => practitionersApi.getForKid(kidId),
    enabled: !!kidId,
  });

  const { data: goalsRes } = useQuery({
    queryKey: ['parent-goals', kidId],
    queryFn: () => goalsApi.getForKid(kidId),
    enabled: !!kidId,
  });

  const kid = kidRes?.data;
  const forms: SessionForm[] = (formsRes?.data || [])
    .filter((f: SessionForm) => f.sessionDate)
    .sort((a: SessionForm, b: SessionForm) =>
      toDate(b.sessionDate).getTime() - toDate(a.sessionDate).getTime()
    );
  const practitioners: Practitioner[] = practitionersRes?.data || [];
  const activeGoals = (goalsRes?.data || []).filter((g: Goal) => g.isActive);
  const goalsByCategory = GOAL_CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = activeGoals.filter((g: Goal) => g.categoryId === cat.id);
    return acc;
  }, {} as Record<string, Goal[]>);

  if (kidLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: '#94a3b8' }}>טוען...</p>
      </div>
    );
  }

  if (!kid) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: '#94a3b8' }}>הדף לא נמצא</p>
      </div>
    );
  }

  const avatarUrl = kid.imageName
    ? (kid.imageName.startsWith('data:') ? kid.imageName : `${BASE}${kid.imageName}`)
    : DEFAULT_AVATAR;

  return (
    <div className="container" style={{ direction: 'rtl' }}>
      {/* Header */}
      <div className="header-card" style={{ textAlign: 'center' }}>
        <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="logo" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <img
            src={avatarUrl}
            alt={kid.name}
            onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
            style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid #e2e8f0' }}
          />
          <h1 style={{ margin: 0, fontSize: '1.5em' }}>{kid.name}</h1>
          {kid.age && <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9em' }}>גיל {kid.age}</p>}
        </div>
        <div style={{
          display: 'inline-block',
          marginTop: 10,
          padding: '4px 12px',
          background: '#f0f7ff',
          borderRadius: 20,
          fontSize: 12,
          color: '#3b82f6',
          fontWeight: 500,
        }}>
          צפייה בלבד
        </div>
      </div>

      {/* Goals summary */}
      {activeGoals.length > 0 && (
        <div className="content-card">
          <div className="content-card-header">
            <h2>מטרות טיפוליות פעילות</h2>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>{activeGoals.length} מטרות</span>
          </div>
          <div className="goals-visual">
            {GOAL_CATEGORIES.map(cat => {
              const catGoals = goalsByCategory[cat.id] || [];
              if (catGoals.length === 0) return null;
              return (
                <div key={cat.id} className="goal-category-bar" style={{ '--cat-color': cat.color } as React.CSSProperties}>
                  <div className="goal-category-label">
                    <span className="goal-category-name">{cat.nameHe}</span>
                    <span className="goal-category-count">{catGoals.length}</span>
                  </div>
                  <div className="goal-tags">
                    {catGoals.map((g: Goal) => (
                      <span key={g.id} className="goal-tag">{g.title}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Forms list */}
      <div className="content-card">
        <div className="content-card-header">
          <h2>טפסי טיפול</h2>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>{forms.length} טפסים</span>
        </div>

        {formsLoading ? (
          <p style={{ color: '#94a3b8' }}>טוען...</p>
        ) : forms.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>אין טפסים עדיין</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {forms.map((form: SessionForm) => (
              <FormCard key={form.id} form={form} practitioners={practitioners} kidId={kidId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
