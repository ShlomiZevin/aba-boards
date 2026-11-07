import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { kidsApi, sessionsApi, practitionersApi, notificationsApi } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useTherapist } from '../../contexts/TherapistContext';
import { toDate } from '../../utils/date';
import type { Session } from '../../types';
import Icon from '../Icon';
import { kidColor } from '../kidColor';
import './today.css';

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HE_MONTHS = ['בינואר', 'בפברואר', 'במרץ', 'באפריל', 'במאי', 'ביוני', 'ביולי', 'באוגוסט', 'בספטמבר', 'באוקטובר', 'בנובמבר', 'בדצמבר'];
const TYPE_LABEL: Record<string, string> = { therapy: 'טיפול', meeting: 'פגישה', guidance: 'הדרכת הורים' };
const SESSION_MIN = 90;

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  return 'ערב טוב';
}

type State = 'done' | 'needs-form' | 'live' | 'next' | 'later' | 'missed';

export default function Today() {
  const { user } = useAuth();
  const { isTherapistView, practitionerId } = useTherapist();
  const prefix = isTherapistView ? `/t/${practitionerId}` : '';
  const now = new Date();
  const dayKey = format(now, 'yyyy-MM-dd');

  const { data: sessionsRes, isLoading } = useQuery({
    queryKey: ['sessions', 'day', dayKey, practitionerId],
    queryFn: () => sessionsApi.getAll({ from: dayKey, to: dayKey }),
  });
  const { data: alertsRes } = useQuery({ queryKey: ['alerts'], queryFn: () => sessionsApi.getAlerts() });
  const { data: kidsRes } = useQuery({
    queryKey: isTherapistView ? ['practitioner-kids', practitionerId] : ['kids'],
    queryFn: () => (isTherapistView ? practitionersApi.getKidsForPractitioner(practitionerId!) : kidsApi.getAll()),
  });
  const { data: teamRes } = useQuery({
    queryKey: ['my-therapists'],
    queryFn: () => practitionersApi.getMyTherapists(),
    enabled: !isTherapistView,
  });
  const { data: meRes } = useQuery({
    queryKey: ['practitioner-info', practitionerId],
    queryFn: () => practitionersApi.getInfo(practitionerId!),
    enabled: isTherapistView && !!practitionerId,
  });
  const { data: notesRes } = useQuery({ queryKey: ['notifications', 'mine'], queryFn: () => notificationsApi.getMine() });

  const kids = kidsRes?.data || [];
  const kidName = (id: string | null) => kids.find(k => k.id === id)?.name || '';
  const team = teamRes?.data || (meRes?.data ? [meRes.data] : []);
  const therapistName = (id?: string) => (team.find(p => p.id === id)?.name || '').split(' ')[0];
  const pendingForms = (alertsRes?.data || []).length;
  const unread = (notesRes?.data || []).filter(n => !n.read).length;
  const myName = isTherapistView ? (meRes?.data?.name || '').split(' ')[0] : (user?.name || '').split(' ')[0];

  const today = useMemo(() => {
    const list = (sessionsRes?.data || [])
      .filter(s => toDate(s.scheduledDate).toDateString() === now.toDateString())
      .sort((a, b) => toDate(a.scheduledDate).getTime() - toDate(b.scheduledDate).getTime());
    let nextMarked = false;
    return list.map(s => {
      const start = toDate(s.scheduledDate);
      const end = new Date(start.getTime() + SESSION_MIN * 60000);
      let state: State;
      if (s.status === 'completed') state = 'done';
      else if (s.status === 'missed') state = 'missed';
      else if (s.status === 'pending_form' || end < now) state = 'needs-form';
      else if (start <= now) state = 'live';
      else if (!nextMarked) { state = 'next'; nextMarked = true; }
      else state = 'later';
      return { s, start, end, state };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsRes, dayKey]);

  const focus = today.find(t => t.state === 'live') || today.find(t => t.state === 'needs-form') || today.find(t => t.state === 'next');
  const doneCount = today.filter(t => t.state === 'done').length;

  const formLink = (s: Session) => `${prefix}/form/new?kidId=${s.kidId}&sessionId=${s.id}`;
  const kidLink = (id: string | null) => `${prefix}/kid/${id}`;

  return (
    <div className="td">
      <header className="td-hello">
        <h1 className="nb-h1">{greeting(now)}, <mark className="hl-yellow">{myName || 'שלום'}</mark></h1>
        <p className="td-date">יום {HE_DAYS[now.getDay()]}, {now.getDate()} {HE_MONTHS[now.getMonth()]}</p>
        <div className="td-stickers">
          {pendingForms > 0 && (
            <Link to={`${prefix}/forms`} className="nb-sticker tone-pink" style={{ ['--rot' as string]: '-3deg' }}>
              <Icon name="form" size={18} /> {pendingForms === 1 ? 'טופס אחד מחכה' : `${pendingForms} טפסים מחכים`}
            </Link>
          )}
          {unread > 0 && (
            <Link to={`${prefix}/notifications`} className="nb-sticker tone-sky" style={{ ['--rot' as string]: '2deg' }}>
              <Icon name="bell" size={18} /> {unread === 1 ? 'הודעה חדשה' : `${unread} הודעות חדשות`}
            </Link>
          )}
        </div>
      </header>

      {user?.isSuperAdmin && (
        <Link to="/studio" className="td-studio">
          <span className="td-studio-ico"><Icon name="camera" size={26} /></span>
          <span className="td-studio-txt"><b>סטודיו קסם</b><small>תמונה של מה שהילדים בנו ← סרטון קסום</small></span>
          <Icon name="chevron" size={22} />
        </Link>
      )}

      <div className="td-grid">
        <section className="td-col">
          {/* מה עכשיו? */}
          <div className="nb-card nb-tape td-now">
            <h2 className="td-now-title">מה <mark className="hl-yellow">עכשיו</mark>?</h2>
            {isLoading ? (
              <p className="hand nb-muted">טוען את היום…</p>
            ) : focus ? (
              <>
                <div className="td-now-who">
                  <span className={`nb-av lg tone-${kidColor(focus.s.kidId)}`}>{kidName(focus.s.kidId).charAt(0)}</span>
                  <div>
                    <b>{kidName(focus.s.kidId) || focus.s.customTitle || 'פגישה'}</b>
                    <span className="tabular">{format(focus.start, 'HH:mm')}–{format(focus.end, 'HH:mm')}</span>
                    <span>{TYPE_LABEL[focus.s.type || 'therapy']}{therapistName(focus.s.therapistId) && ` · ${therapistName(focus.s.therapistId)}`}</span>
                  </div>
                  <span className={`td-state st-${focus.state}`}>
                    {focus.state === 'live' ? 'עכשיו' : focus.state === 'needs-form' ? 'חסר טופס' : 'הבא בתור'}
                  </span>
                </div>
                {focus.state === 'live' && <LiveBar start={focus.start} end={focus.end} />}
                <div className="td-now-actions">
                  {focus.state === 'next' ? (
                    <Link to={kidLink(focus.s.kidId)} className="nb-btn xl block"><Icon name="play" /> פתיחת כרטיס הילד</Link>
                  ) : (
                    <Link to={formLink(focus.s)} className="nb-btn xl block"><Icon name="form" /> מילוי טופס טיפול</Link>
                  )}
                  {focus.state !== 'next' && <Link to={kidLink(focus.s.kidId)} className="nb-btn-ghost">כרטיס הילד</Link>}
                </div>
              </>
            ) : (
              <div className="td-free">
                <p className="hand">{today.length ? 'סיימנו להיום. כל הכבוד!' : 'אין טיפולים היום.'}</p>
                <Link to={`${prefix}${isTherapistView ? '/kids' : '/calendar'}`} className="nb-btn-ghost">{isTherapistView ? 'לילדים שלי' : 'ליומן'}</Link>
              </div>
            )}
          </div>

          {/* היום שלי */}
          <div className="nb-sec">
            <div className="nb-sec-head">
              <h2 className="nb-h2">היום שלי</h2>
              {today.length > 0 && <span className="nb-muted">{doneCount} מתוך {today.length} הושלמו</span>}
            </div>
            <ol className="td-list">
              {today.map(({ s, start, state }) => (
                <li key={s.id} className={`td-row st-${state}`}>
                  <span className="td-check" aria-hidden="true">{(state === 'done') && <Icon name="check" size={18} strokeWidth={2.6} />}</span>
                  <span className="td-time tabular">{format(start, 'HH:mm')}</span>
                  <Link to={kidLink(s.kidId)} className="td-what">
                    <b>{kidName(s.kidId) || s.customTitle || 'פגישה'}</b>
                    <span>{TYPE_LABEL[s.type || 'therapy']}{therapistName(s.therapistId) && ` · ${therapistName(s.therapistId)}`}</span>
                  </Link>
                  {state === 'needs-form' ? (
                    <Link to={formLink(s)} className="td-row-cta">טופס</Link>
                  ) : (
                    <span className="td-tag">{state === 'done' ? 'הושלם' : state === 'live' ? 'עכשיו' : state === 'missed' ? 'לא התקיים' : 'מתוכנן'}</span>
                  )}
                </li>
              ))}
              {!isLoading && today.length === 0 && <li className="td-empty hand">יום פנוי ביומן</li>}
            </ol>
          </div>
        </section>

        <section className="td-col">
          <div className="nb-sec">
            <div className="nb-sec-head">
              <h2 className="nb-h2">הילדים</h2>
              <Link to={`${prefix}/kids`}>לכל הילדים</Link>
            </div>
            <div className="td-kids">
              {kids.map(k => (
                <Link key={k.id} to={kidLink(k.id)} className="td-kid">
                  <span className={`nb-av tone-${kidColor(k.id)}`}>{k.name.charAt(0)}</span>
                  <b>{k.name}</b>
                  {k.age ? <small>{k.gender === 'girl' ? 'בת' : 'בן'} {k.age}</small> : null}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function LiveBar({ start, end }: { start: Date; end: Date }) {
  const total = end.getTime() - start.getTime();
  const done = Math.min(total, Math.max(0, Date.now() - start.getTime()));
  const pct = Math.round((done / total) * 100);
  const left = Math.max(0, Math.round((total - done) / 60000));
  return (
    <div className="td-live" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="התקדמות המפגש">
      <div className="td-live-track"><i style={{ width: `${pct}%` }} /></div>
      <span className="hand">עוד {left} דק׳</span>
    </div>
  );
}
