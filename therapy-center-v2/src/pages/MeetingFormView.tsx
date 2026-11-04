import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { meetingFormsApi, kidsApi, goalsApi, practitionersApi } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import ConfirmModal from '../components/ConfirmModal';
import { toDate } from '../utils/date';
import type { MeetingAttendee, Goal } from '../types';
import GoalsWeeklyTable from '../components/GoalsWeeklyTable';
import Icon from '../v2/Icon';
import { FfHeader, FfIcon, FfField } from '../v2/pages/ffParts';

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

  const { data: goalsRes } = useQuery({
    queryKey: ['goals', form?.kidId],
    queryFn: () => goalsApi.getForKid(form!.kidId),
    enabled: !!form?.kidId,
  });

  const { data: practitionersRes } = useQuery({
    queryKey: ['practitioners', form?.kidId],
    queryFn: () => practitionersApi.getForKid(form!.kidId),
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
  const goals = (goalsRes?.data || []).filter((g: Goal) => g.isActive !== false);
  const practitioners = practitionersRes?.data || [];

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

  const dateStr = format(toDate(form.sessionDate), 'dd/MM/yyyy');
  const practitionerAttendees = (form.attendees || []).filter((a: MeetingAttendee) => a.type === 'practitioner');
  const parentAttendees = (form.attendees || []).filter((a: MeetingAttendee) => a.type === 'parent');

  const isAdmin = !isTherapistView && !isParentView;
  const vp = form.visibility?.parents !== false;
  const vt = form.visibility?.therapists !== false;
  const visAll = vp && vt;
  const visLabel = visAll
    ? 'גלוי לכולם (הורים ומטפלים)'
    : !vp && !vt
    ? 'מוסתר — רק מנהל/ת המרכז'
    : `גלוי ל${vp ? 'הורים' : 'מטפלים'} בלבד`;

  return (
    <div className="ff ff-view">
      <FfHeader
        backTo={kid ? links.kidDetail(kid.id) : links.home()}
        kid={kid}
        title="סיכום ישיבה"
        actions={
          <>
            {isAdmin && (
              <button onClick={() => navigate(links.meetingFormEdit(formId!))} className="nb-btn-ghost ff-edit-btn">
                <Icon name="edit" size={18} /> עריכה
              </button>
            )}
            <button onClick={() => window.print()} className="ff-icon-btn" aria-label="הדפסה" title="הדפסה">
              <FfIcon name="print" />
            </button>
            {isAdmin && (
              <button onClick={() => setShowDelete(true)} className="ff-icon-btn danger" aria-label="מחק טופס" title="מחק טופס">
                <Icon name="trash" size={20} />
              </button>
            )}
          </>
        }
      >
        <div className="ff-sub">
          <span><Icon name="calendar" size={16} /> <b className="tabular">{dateStr}</b></span>
          <span><Icon name="team" size={16} /> {form.attendees?.length || 0} נוכחים</span>
        </div>
      </FfHeader>

      {/* Visibility — admin only */}
      {isAdmin && (
        <span className={`nb-sticker ff-vis-flag ${visAll ? 'tone-mint' : 'tone-yellow'}`}>
          <FfIcon name={visAll ? 'eye' : 'lock'} size={18} /> נראות: {visLabel}
        </span>
      )}

      <div className="ff-view-grid">
        <div className="ff-col">
          {form.attendees?.length > 0 && (
            <section className="nb-card ff-att">
              <h2 className="ff-sec-title"><Icon name="team" size={22} /> נוכחים</h2>
              <div className="ff-att-list">
                {practitionerAttendees.map((a: MeetingAttendee) => (
                  <span key={a.id} className="ff-att-chip ff-att-static is-on tone-lilac">{a.name}</span>
                ))}
                {parentAttendees.map((a: MeetingAttendee) => (
                  <span key={a.id} className="ff-att-chip ff-att-static is-on tone-mint">{a.name}</span>
                ))}
              </div>
            </section>
          )}

          <article className="nb-card ff-page">
            <FfField label="נקודות כלליות" html={form.generalNotes} />
            <FfField label="התנהגות - נקודות כלליות" html={form.behaviorNotes} />
            <FfField label="ADL" html={form.adl} />
            <FfField label="תוכניות מוטוריקה גסה" html={form.grossMotorPrograms} />
            <FfField label="תוכניות מחוץ לחדר" html={form.programsOutsideRoom} />
            <FfField label="תוכניות למידה בחדר" html={form.learningProgramsInRoom} />
            <FfField label="משימות" html={form.tasks} />
          </article>
        </div>

        <section className="nb-card ff-goals">
          <h2 className="ff-sec-title"><Icon name="target" size={22} /> מטרות שעבדנו עליהן</h2>

          <GoalsWeeklyTable
            kidId={form.kidId}
            goals={goals}
            selectedGoals={new Set((form.goalsWorkedOn || []).map((g: { goalId: string }) => g.goalId))}
            currentFormDate={format(toDate(form.sessionDate), 'yyyy-MM-dd')}
            currentFormId={form.id}
            practitioners={practitioners}
          />

          {(form.additionalGoals || []).length > 0 && (
            <div className="ff-extra">
              <div className="ff-extra-title">מטרות נוספות</div>
              <ul className="ff-extra-list">
                {form.additionalGoals.map((g: string, idx: number) => (
                  <li key={idx}>{g}</li>
                ))}
              </ul>
            </div>
          )}

          {(form.goalsWorkedOn || []).length === 0 && (form.additionalGoals || []).length === 0 && (
            <p className="ff-empty-note">לא צוינו מטרות</p>
          )}
        </section>
      </div>

      <div className="ff-foot tabular">
        נוצר ב-{format(toDate(form.createdAt), 'dd/MM/yyyy HH:mm')}
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
