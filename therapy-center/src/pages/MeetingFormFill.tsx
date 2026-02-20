import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { kidsApi, practitionersApi, parentsApi, sessionsApi, meetingFormsApi } from '../api/client';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import { toDate } from '../utils/date';
import type { Practitioner, Parent, MeetingAttendee, MeetingForm, Session } from '../types';
import RichTextEditor from '../components/RichTextEditor';

const BASE = import.meta.env.BASE_URL;

export default function MeetingFormFill() {
  const { formId } = useParams(); // edit mode
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const links = useTherapistLinks();

  const kidIdParam = searchParams.get('kidId') || '';
  const sessionIdParam = searchParams.get('sessionId') || undefined;
  const dateParam = searchParams.get('date');
  const isEditMode = !!formId;

  const [kidId, setKidId] = useState(kidIdParam);
  const [sessionId, setSessionId] = useState<string | undefined>(sessionIdParam);
  const [sessionDate, setSessionDate] = useState(dateParam || format(new Date(), 'yyyy-MM-dd'));
  const [selectedAttendees, setSelectedAttendees] = useState<MeetingAttendee[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [behaviorNotes, setBehaviorNotes] = useState('');
  const [adl, setAdl] = useState('');
  const [grossMotorPrograms, setGrossMotorPrograms] = useState('');
  const [programsOutsideRoom, setProgramsOutsideRoom] = useState('');
  const [learningProgramsInRoom, setLearningProgramsInRoom] = useState('');
  const [tasks, setTasks] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Load existing form for edit mode
  const { data: existingFormRes } = useQuery({
    queryKey: ['meetingForm', formId],
    queryFn: () => meetingFormsApi.getById(formId!),
    enabled: isEditMode,
  });

  // Load sessions to pre-populate date
  const { data: sessionsRes } = useQuery({
    queryKey: ['sessions', kidId],
    queryFn: () => sessionsApi.getForKid(kidId),
    enabled: !!kidId && !!sessionId && !isEditMode,
  });

  // Initialize from existing form (edit mode)
  useEffect(() => {
    if (initialized || !isEditMode || !existingFormRes?.data) return;
    const form = existingFormRes.data;
    setKidId(form.kidId);
    setSessionId(form.sessionId);
    setSessionDate(format(toDate(form.sessionDate), 'yyyy-MM-dd'));
    setSelectedAttendees(form.attendees || []);
    setGeneralNotes(form.generalNotes || '');
    setBehaviorNotes(form.behaviorNotes || '');
    setAdl(form.adl || '');
    setGrossMotorPrograms(form.grossMotorPrograms || '');
    setProgramsOutsideRoom(form.programsOutsideRoom || '');
    setLearningProgramsInRoom(form.learningProgramsInRoom || '');
    setTasks(form.tasks || '');
    setInitialized(true);
  }, [isEditMode, existingFormRes, initialized]);

  // Pre-populate date from session (new mode)
  useEffect(() => {
    if (initialized || isEditMode || !sessionId || !sessionsRes?.data) return;
    const session = sessionsRes.data.find((s: Session) => s.id === sessionId);
    if (session) {
      setSessionDate(format(toDate(session.scheduledDate), 'yyyy-MM-dd'));
      setInitialized(true);
    }
  }, [sessionId, sessionsRes, initialized, isEditMode]);

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

  const { data: parentsRes } = useQuery({
    queryKey: ['parents', kidId],
    queryFn: () => parentsApi.getForKid(kidId),
    enabled: !!kidId,
  });

  const submitMutation = useMutation({
    mutationFn: (data: Omit<MeetingForm, 'id' | 'createdAt' | 'updatedAt'>) =>
      meetingFormsApi.submit(data),
    onSuccess: (res) => {
      if (res.success && res.data) {
        queryClient.invalidateQueries({ queryKey: ['sessions', kidId] });
        navigate(links.meetingFormView(res.data.id));
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<MeetingForm>) => meetingFormsApi.update(formId!, data),
    onSuccess: (res) => {
      if (res.success && res.data) {
        queryClient.invalidateQueries({ queryKey: ['meetingForm', formId] });
        navigate(links.meetingFormView(res.data.id));
      }
    },
  });

  const kid = kidRes?.data;
  const practitioners = practitionersRes?.data || [];
  const parents = parentsRes?.data || [];

  const toggleAttendee = (id: string, name: string, type: 'parent' | 'practitioner') => {
    const existing = selectedAttendees.find((a) => a.id === id);
    if (existing) {
      setSelectedAttendees(selectedAttendees.filter((a) => a.id !== id));
    } else {
      setSelectedAttendees([...selectedAttendees, { id, name, type }]);
    }
  };

  const isAttendeeSelected = (id: string) => selectedAttendees.some((a) => a.id === id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      sessionId,
      kidId,
      sessionDate: new Date(sessionDate),
      attendees: selectedAttendees,
      generalNotes,
      behaviorNotes,
      adl,
      grossMotorPrograms,
      programsOutsideRoom,
      learningProgramsInRoom,
      tasks,
    };
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      submitMutation.mutate(data);
    }
  };

  const isPending = submitMutation.isPending || updateMutation.isPending;

  return (
    <div className="container">
      <div className="kid-header-card">
        <div className="kid-header-top">
          <Link to={kidId ? links.kidDetail(kidId) : links.home()} className="kid-header-back">
            <span className="back-arrow">←</span>
            <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="logo-small" />
          </Link>
        </div>
        <h1 style={{ fontSize: '1.4em', fontWeight: 700, color: '#2d3748', margin: 0 }}>
          {isEditMode ? 'עריכת סיכום ישיבה' : 'טופס סיכום ישיבה'}{kid ? ` - ${kid.name}` : ''}
        </h1>
      </div>

      <div className="content-card">
        <form onSubmit={handleSubmit}>
          {/* Kid & Date */}
          <div className="form-row-2">
            <div className="form-group">
              <label>שם הילד</label>
              <input
                type="text"
                value={kid?.name || ''}
                disabled
                style={{ backgroundColor: '#f1f5f9' }}
              />
            </div>
            <div className="form-group">
              <label>תאריך הישיבה</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
                disabled={!!sessionId}
                style={sessionId ? { backgroundColor: '#f1f5f9' } : undefined}
              />
            </div>
          </div>

          {/* Attendees */}
          <div className="form-group">
            <label>נוכחים</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {practitioners.map((p: Practitioner) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleAttendee(p.id, p.name, 'practitioner')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '2px solid',
                    borderColor: isAttendeeSelected(p.id) ? '#667eea' : '#e2e8f0',
                    background: isAttendeeSelected(p.id) ? '#667eea' : 'white',
                    color: isAttendeeSelected(p.id) ? 'white' : '#4a5568',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                >
                  {p.name}
                  <span style={{ opacity: 0.75, fontSize: '0.8em', marginRight: '4px' }}>({p.type})</span>
                </button>
              ))}
              {parents.map((p: Parent) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleAttendee(p.id, p.name, 'parent')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '2px solid',
                    borderColor: isAttendeeSelected(p.id) ? '#48bb78' : '#e2e8f0',
                    background: isAttendeeSelected(p.id) ? '#48bb78' : 'white',
                    color: isAttendeeSelected(p.id) ? 'white' : '#4a5568',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                >
                  {p.name}
                  <span style={{ opacity: 0.75, fontSize: '0.8em', marginRight: '4px' }}>(הורה)</span>
                </button>
              ))}
              {practitioners.length === 0 && parents.length === 0 && (
                <span style={{ color: '#a0aec0', fontSize: '0.9em' }}>לא נמצאו נוכחים אפשריים</span>
              )}
            </div>
          </div>

          {/* Rich Text Fields */}
          <div className="form-group">
            <label>נקודות כלליות</label>
            <RichTextEditor value={generalNotes} onChange={setGeneralNotes} />
          </div>
          <div className="form-group">
            <label>התנהגות - נקודות כלליות</label>
            <RichTextEditor value={behaviorNotes} onChange={setBehaviorNotes} />
          </div>
          <div className="form-group">
            <label>ADL</label>
            <RichTextEditor value={adl} onChange={setAdl} />
          </div>
          <div className="form-group">
            <label>תוכניות מוטוריקה גסה</label>
            <RichTextEditor value={grossMotorPrograms} onChange={setGrossMotorPrograms} />
          </div>
          <div className="form-group">
            <label>תוכניות מחוץ לחדר</label>
            <RichTextEditor value={programsOutsideRoom} onChange={setProgramsOutsideRoom} />
          </div>
          <div className="form-group">
            <label>תוכניות למידה בחדר</label>
            <RichTextEditor value={learningProgramsInRoom} onChange={setLearningProgramsInRoom} />
          </div>
          <div className="form-group">
            <label>משימות</label>
            <RichTextEditor value={tasks} onChange={setTasks} />
          </div>

          <div className="form-actions">
            <Link to={kidId ? links.kidDetail(kidId) : links.home()} className="btn-secondary">
              ביטול
            </Link>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? 'שומר...' : 'שמור טופס'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
