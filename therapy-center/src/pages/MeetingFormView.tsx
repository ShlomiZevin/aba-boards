import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { meetingFormsApi, kidsApi } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import ConfirmModal from '../components/ConfirmModal';
import { toDate } from '../utils/date';
import type { MeetingAttendee } from '../types';



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

export default function MeetingFormView() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isTherapistView, isParentView } = useTherapist();
  const links = useTherapistLinks();
  const [showDelete, setShowDelete] = useState(false);

  const { data: formRes, isLoading } = useQuery({
    queryKey: ['meetingForm', formId],
    queryFn: () => meetingFormsApi.getById(formId!),
    enabled: !!formId,
  });

  const form = formRes?.data;

  const { data: kidRes } = useQuery({
    queryKey: ['kid', form?.kidId],
    queryFn: () => kidsApi.getById(form!.kidId),
    enabled: !!form?.kidId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => meetingFormsApi.delete(formId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      navigate(form?.kidId ? links.kidDetail(form.kidId) : links.home());
    },
  });

  const kid = kidRes?.data;

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
          <Link to={links.home()} className="btn-primary">חזור לדף הבית</Link>
        </div>
      </div>
    );
  }

  const dateStr = format(toDate(form.sessionDate), 'dd/MM/yyyy');
  const practitionerAttendees = (form.attendees || []).filter((a: MeetingAttendee) => a.type === 'practitioner');
  const parentAttendees = (form.attendees || []).filter((a: MeetingAttendee) => a.type === 'parent');

  return (
    <div className="container">
      <div className="kid-header-card">
        <div className="kid-header-top">
          <Link to={kid ? links.kidDetail(kid.id) : links.home()} className="kid-header-back">
            <span className="back-arrow">→</span>
            <span className="back-label">חזרה</span>
          </Link>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.4em', fontWeight: 700, color: '#2d3748', margin: 0 }}>סיכום ישיבה</h1>
            {kid && <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>{kid.name}</p>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isTherapistView && !isParentView && (
              <button
                onClick={() => navigate(links.meetingFormEdit(formId!))}
                className="btn-primary btn-small"
              >
                ערוך
              </button>
            )}
            <button onClick={() => window.print()} className="btn-secondary btn-small">
              הדפס
            </button>
            {!isTherapistView && !isParentView && (
              <button
                onClick={() => setShowDelete(true)}
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
        {/* Stats bar */}
        <div className="form-view-stats" style={{ gridTemplateColumns: 'auto auto' }}>
          <div className="stat">
            <div className="stat-label">תאריך</div>
            <div className="stat-value">{dateStr}</div>
          </div>
          <div className="stat">
            <div className="stat-label">נוכחים</div>
            <div className="stat-value">{form.attendees?.length || 0}</div>
          </div>
        </div>

        {/* Attendees */}
        {form.attendees?.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontWeight: 600, marginBottom: '8px', color: '#4a5568' }}>נוכחים</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {practitionerAttendees.map((a: MeetingAttendee) => (
                <span
                  key={a.id}
                  style={{ padding: '4px 12px', borderRadius: '16px', background: '#e8eaf6', color: '#3f51b5', fontSize: '0.9em', fontWeight: 500 }}
                >
                  {a.name}
                </span>
              ))}
              {parentAttendees.map((a: MeetingAttendee) => (
                <span
                  key={a.id}
                  style={{ padding: '4px 12px', borderRadius: '16px', background: '#e8f5e9', color: '#2e7d32', fontSize: '0.9em', fontWeight: 500 }}
                >
                  {a.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rich Text Fields */}
        <FieldRow label="נקודות כלליות">
          <RichTextDisplay html={form.generalNotes} />
        </FieldRow>
        <FieldRow label="התנהגות - נקודות כלליות">
          <RichTextDisplay html={form.behaviorNotes} />
        </FieldRow>
        <FieldRow label="ADL">
          <RichTextDisplay html={form.adl} />
        </FieldRow>
        <FieldRow label="תוכניות מוטוריקה גסה">
          <RichTextDisplay html={form.grossMotorPrograms} />
        </FieldRow>
        <FieldRow label="תוכניות מחוץ לחדר">
          <RichTextDisplay html={form.programsOutsideRoom} />
        </FieldRow>
        <FieldRow label="תוכניות למידה בחדר">
          <RichTextDisplay html={form.learningProgramsInRoom} />
        </FieldRow>
        <FieldRow label="משימות">
          <RichTextDisplay html={form.tasks} />
        </FieldRow>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '2px solid #f0f4f8', fontSize: '0.85em', color: '#a0aec0' }}>
          נוצר ב-{format(toDate(form.createdAt), 'dd/MM/yyyy HH:mm')}
        </div>
      </div>

      {showDelete && (
        <ConfirmModal
          title="מחיקת סיכום ישיבה"
          message={`האם למחוק את סיכום הישיבה מתאריך ${dateStr}?\nהפגישה תחזור לסטטוס "ממתין".`}
          confirmText={deleteMutation.isPending ? 'מוחק...' : 'מחק'}
          confirmStyle="danger"
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
