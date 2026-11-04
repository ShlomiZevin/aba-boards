import { useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { kidsApi, practitionersApi, sessionsApi, goalDataApi, formsApi } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import { toDate } from '../utils/date';
import type { Kid, KidGoalDataEntry, Session, SessionForm } from '../types';
import Icon from '../v2/Icon';
import KidAvatar from '../v2/KidAvatar';
import '../v2/pages/cm.css';

const TYPE_LABEL: Record<string, string> = { therapy: 'טופס טיפול', guidance: 'טופס הדרכה', meeting: 'סיכום ישיבה' };
const ROTS = ['-1.2deg', '0.8deg', '-0.6deg', '1.1deg'];

function when(d: Date) {
  return format(d, 'EEEE d/M · HH:mm', { locale: he });
}

function KidPic({ kid, name }: { kid?: Kid; name: string }) {
  return kid ? <KidAvatar kid={kid} /> : <span className="nb-av tone-lilac" aria-hidden="true">{(name || '?').charAt(0)}</span>;
}

/* ── a pending item: sticker row with one big "מילוי" ── */

function PendingSticker({ kid, kidName, title, sub, to, tone, i }: {
  kid?: Kid; kidName: string; title: string; sub: string; to: string; tone: string; i: number;
}) {
  return (
    <li className={`cm-pend tone-${tone}`} style={{ ['--rot' as string]: ROTS[i % ROTS.length] }}>
      <KidPic kid={kid} name={kidName} />
      <div className="cm-pend-what">
        <b>{kidName}</b>
        <span className="cm-pend-title">{title}</span>
        <span className="cm-pend-sub">{sub}</span>
      </div>
      <Link to={to} className="nb-btn cm-pend-go"><Icon name="edit" size={20} /> מילוי</Link>
    </li>
  );
}

/* ── grouped-by-kid view of the pending data-collection entries ── */

function KidFormsCard({ kid, pending, loading }: { kid: Kid; pending: KidGoalDataEntry[]; loading: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const links = useTherapistLinks();
  if (!loading && pending.length === 0) return null;

  return (
    <li className="cm-bykid">
      <button type="button" className="cm-bykid-head" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <KidAvatar kid={kid} size="sm" />
        <span className="cm-bykid-name">
          <b>{kid.name}</b>
          {kid.age ? <small>גיל {kid.age}</small> : null}
        </span>
        <span className="nb-chip tone-yellow">{loading ? '...' : `${pending.length} ממתינים`}</span>
        <span className={`cm-caret${expanded ? ' is-open' : ''}`}><Icon name="chevron" size={18} /></span>
      </button>
      {expanded && (
        <div className="cm-bykid-body">
          <ol className="cm-rows">
            {pending.map(entry => (
              <li key={entry.id} className="cm-frow">
                <Link to={links.kidDetail(kid.id)} className="cm-frow-main">
                  <span className="cm-frow-what"><b>{entry.goalTitle}</b><span className="tabular">{format(toDate(entry.sessionDate), 'dd/MM/yyyy · HH:mm')}</span></span>
                  <span className="cm-frow-go">מילוי <Icon name="chevron" size={16} /></span>
                </Link>
              </li>
            ))}
          </ol>
          <Link to={links.kidDetail(kid.id)} className="nb-btn-ghost sm">פתח דף ילד</Link>
        </div>
      )}
    </li>
  );
}

/* ── Main page ── */

export default function FormsOverview() {
  const { isTherapistView, practitionerId } = useTherapist();
  const links = useTherapistLinks();
  const [view, setView] = useState<'flat' | 'byKid'>('flat');

  const { data: kidsResponse, isLoading } = useQuery({
    queryKey: isTherapistView ? ['kids', 'practitioner', practitionerId] : ['kids'],
    queryFn: () => isTherapistView
      ? practitionersApi.getKidsForPractitioner(practitionerId!)
      : kidsApi.getAll(),
  });

  const { data: alertsResponse } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => sessionsApi.getAlerts(),
  });

  const kids: Kid[] = kidsResponse?.data || [];
  const kidById = new Map(kids.map(k => [k.id, k]));

  // Sessions still waiting for their form. A therapist sees only her own.
  const sessionAlerts: Session[] = (alertsResponse?.data || [])
    .filter(s => !isTherapistView || !s.therapistId || s.therapistId === practitionerId)
    .filter(s => !isTherapistView || (s.kidId && kidById.has(s.kidId)))
    .sort((a, b) => toDate(a.scheduledDate).getTime() - toDate(b.scheduledDate).getTime());
  const alertKids = new Set(sessionAlerts.map(a => a.kidId).filter(Boolean));

  // Pending data-collection entries, per kid.
  const pendingQueries = useQueries({
    queries: kids.map(kid => ({
      queryKey: ['dc-pending', kid.id],
      queryFn: () => goalDataApi.getPending(kid.id),
    })),
  });
  const pendingLoading = pendingQueries.some(q => q.isLoading);
  const allPending: (KidGoalDataEntry & { kidId: string })[] = [];
  kids.forEach((kid, i) => {
    for (const entry of (pendingQueries[i]?.data?.data || []) as KidGoalDataEntry[]) allPending.push({ ...entry, kidId: kid.id });
  });
  allPending.sort((a, b) => toDate(a.sessionDate).getTime() - toDate(b.sessionDate).getTime());

  // Recently filled therapy forms (newest first).
  const formQueries = useQueries({
    queries: kids.map(kid => ({
      queryKey: ['forms', kid.id],
      queryFn: () => formsApi.getForKid(kid.id),
    })),
  });
  const formsLoading = formQueries.some(q => q.isLoading);
  const recentForms: SessionForm[] = formQueries
    .flatMap(q => (q.data?.data || []) as SessionForm[])
    .filter(f => !isTherapistView || f.practitionerId === practitionerId)
    .sort((a, b) => toDate(b.sessionDate).getTime() - toDate(a.sessionDate).getTime())
    .slice(0, 10);

  const pendingTotal = sessionAlerts.length + allPending.length;

  return (
    <div className="cm-forms">
      <header className="cm-head">
        <div className="cm-head-title">
          <h1 className="nb-h1"><mark className="hl-pink">טפסים</mark></h1>
          <p className="nb-muted">
            {pendingTotal > 0
              ? <><b className="cm-ink">{pendingTotal === 1 ? 'טופס אחד מחכה' : `${pendingTotal} טפסים מחכים`}</b>{alertKids.size > 1 ? ` · ${alertKids.size} ילדים` : ''}</>
              : 'אין טפסים שמחכים לך'}
          </p>
        </div>
      </header>

      {isLoading ? (
        <p className="hand nb-muted cm-loading">טוען…</p>
      ) : kids.length === 0 ? (
        <div className="cm-empty"><p className="hand">{isTherapistView ? 'אין ילדים משויכים אלייך' : 'אין ילדים במערכת'}</p></div>
      ) : (
        <div className="cm-forms-grid">
          {/* ── waiting ── */}
          <section className="nb-sec">
            <div className="nb-sec-head">
              <h2 className="nb-h2">מחכים למילוי</h2>
              {allPending.length > 0 && (
                <div className="cm-seg sm" role="radiogroup" aria-label="תצוגה">
                  <button type="button" role="radio" aria-checked={view === 'flat'} className={view === 'flat' ? 'is-on' : ''} onClick={() => setView('flat')}>ממתינים</button>
                  <button type="button" role="radio" aria-checked={view === 'byKid'} className={view === 'byKid' ? 'is-on' : ''} onClick={() => setView('byKid')}>לפי ילד</button>
                </div>
              )}
            </div>

            {sessionAlerts.length > 0 && (
              <ul className="cm-pends">
                {sessionAlerts.map((s, i) => {
                  const kid = s.kidId ? kidById.get(s.kidId) : undefined;
                  return (
                    <PendingSticker
                      key={s.id}
                      i={i}
                      tone="pink"
                      kid={kid}
                      kidName={kid?.name || s.customTitle || 'פגישה'}
                      title={TYPE_LABEL[s.type || 'therapy'] || 'טופס טיפול'}
                      sub={when(toDate(s.scheduledDate))}
                      to={links.formNew({ kidId: s.kidId || '', sessionId: s.id })}
                    />
                  );
                })}
              </ul>
            )}

            {view === 'flat' ? (
              allPending.length > 0 && (
                <ul className="cm-pends">
                  {allPending.map((entry, i) => {
                    const kid = kidById.get(entry.kidId);
                    return (
                      <PendingSticker
                        key={entry.id}
                        i={i + 1}
                        tone="yellow"
                        kid={kid}
                        kidName={kid?.name || ''}
                        title={`איסוף נתונים · ${entry.goalTitle}`}
                        sub={when(toDate(entry.sessionDate))}
                        to={links.kidDetail(entry.kidId)}
                      />
                    );
                  })}
                </ul>
              )
            ) : (
              <ul className="cm-bykids">
                {kids.map((kid, i) => (
                  <KidFormsCard
                    key={kid.id}
                    kid={kid}
                    loading={!!pendingQueries[i]?.isLoading}
                    pending={(pendingQueries[i]?.data?.data || []) as KidGoalDataEntry[]}
                  />
                ))}
              </ul>
            )}

            {pendingTotal === 0 && !pendingLoading && (
              <div className="cm-done nb-card nb-tape">
                <Icon name="check" size={28} strokeWidth={2.4} />
                <p className="hand">אין טפסים ממתינים. הכל מעודכן!</p>
              </div>
            )}
          </section>

          {/* ── recent ── */}
          <section className="nb-sec">
            <div className="nb-sec-head">
              <h2 className="nb-h2">מולאו לאחרונה</h2>
            </div>
            {formsLoading ? (
              <p className="hand nb-muted">טוען…</p>
            ) : recentForms.length === 0 ? (
              <div className="cm-empty"><p className="hand">עוד לא מולאו טפסים</p></div>
            ) : (
              <ol className="cm-rows">
                {recentForms.map(f => {
                  const kid = kidById.get(f.kidId);
                  const d = toDate(f.sessionDate);
                  return (
                    <li key={f.id} className="cm-frow">
                      <Link to={links.formView(f.id)} className="cm-frow-main">
                        <span className="cm-frow-date tabular"><b>{format(d, 'd/M')}</b><small>{format(d, 'HH:mm')}</small></span>
                        {kid ? <KidAvatar kid={kid} size="sm" /> : <span className="nb-av sm tone-lilac" aria-hidden="true">?</span>}
                        <span className="cm-frow-what">
                          <b>{kid?.name || 'ילד/ה'}</b>
                          <span>טופס טיפול{typeof f.cooperation === 'number' ? ` · שיתוף פעולה ${f.cooperation}%` : ''}</span>
                        </span>
                        <span className="cm-status tone-mint">מולא</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
