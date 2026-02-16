import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { sessionsApi, formsApi, practitionersApi } from '../api/client';
import { toDate } from '../utils/date';
import type { Session, SessionForm, Practitioner } from '../types';

function PendingSessionCard({
  session,
  therapists,
  kidId,
}: {
  session: Session;
  therapists: Practitioner[];
  kidId: string;
}) {
  const navigate = useNavigate();
  const therapist = therapists.find((t) => t.id === session.therapistId);
  const dateStr = format(toDate(session.scheduledDate), 'dd/MM/yyyy HH:mm');

  return (
    <div className="session-card pending-session">
      <div className="session-info">
        <h4>{dateStr}</h4>
        {therapist && <p>{therapist.name}</p>}
        <span className="status-badge pending">ממתין לטופס</span>
      </div>
      <div className="session-actions">
        <button
          onClick={() => navigate(`/form/new?kidId=${kidId}&sessionId=${session.id}`)}
          className="fill-form-btn"
        >
          מלא טופס
        </button>
      </div>
    </div>
  );
}

function CompletedFormCard({
  form,
  therapists,
}: {
  form: SessionForm;
  therapists: Practitioner[];
}) {
  const therapist = therapists.find((t) => t.id === form.practitionerId);
  const dateStr = format(toDate(form.sessionDate), 'dd/MM/yyyy');
  const goalsCount = form.goalsWorkedOn.length + form.additionalGoals.length;

  const cooperationClass =
    form.cooperation >= 70 ? 'high' : form.cooperation >= 50 ? 'medium' : 'low';

  return (
    <Link to={`/form/${form.id}/view`} className="form-card">
      <div className="form-card-content">
        <div>
          <h4>{dateStr}</h4>
          {therapist && <p>{therapist.name}</p>}
        </div>
        <div className="stats">
          <div>{form.sessionDuration} דקות</div>
          <div>{goalsCount} מטרות</div>
          <div className={`cooperation ${cooperationClass}`}>
            {form.cooperation}% שיתוף פעולה
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function FormsTab({ kidId }: { kidId: string }) {
  const { data: sessionsRes, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', kidId],
    queryFn: () => sessionsApi.getForKid(kidId),
  });

  const { data: formsRes, isLoading: formsLoading } = useQuery({
    queryKey: ['forms', kidId],
    queryFn: () => formsApi.getForKid(kidId),
  });

  const { data: practitionersRes } = useQuery({
    queryKey: ['practitioners', kidId],
    queryFn: () => practitionersApi.getForKid(kidId),
  });

  const sessions = sessionsRes?.data || [];
  const forms = formsRes?.data || [];
  const therapists = practitionersRes?.data || [];

  // Sessions without forms (pending)
  const pendingSessions = sessions.filter(
    (s: Session) => s.status !== 'completed' && !s.formId
  );

  const isLoading = sessionsLoading || formsLoading;

  if (isLoading) {
    return <div className="loading">טוען...</div>;
  }

  return (
    <div>
      {/* Pending Sessions Section */}
      {pendingSessions.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h3>ממתינים לטופס ({pendingSessions.length})</h3>
          </div>
          <div>
            {pendingSessions
              .sort(
                (a: Session, b: Session) =>
                  toDate(a.scheduledDate).getTime() -
                  toDate(b.scheduledDate).getTime()
              )
              .map((session: Session) => (
                <PendingSessionCard
                  key={session.id}
                  session={session}
                  therapists={therapists}
                  kidId={kidId}
                />
              ))}
          </div>
        </div>
      )}

      {/* Completed Forms Section */}
      <div className="section">
        <div className="section-header">
          <h3>טפסים שהושלמו ({forms.length})</h3>
          <Link to={`/form/new?kidId=${kidId}`} className="btn-primary btn-small">
            + טופס חדש
          </Link>
        </div>

        {forms.length === 0 ? (
          <div className="empty-state">
            <p>אין טפסים</p>
          </div>
        ) : (
          <div>
            {forms
              .sort(
                (a: SessionForm, b: SessionForm) =>
                  toDate(b.sessionDate).getTime() -
                  toDate(a.sessionDate).getTime()
              )
              .map((form: SessionForm) => (
                <CompletedFormCard
                  key={form.id}
                  form={form}
                  therapists={therapists}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
