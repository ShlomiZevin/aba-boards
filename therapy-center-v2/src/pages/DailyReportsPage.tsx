import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dailyReportsApi, kidsApi, practitionersApi } from '../api/client';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import { useTherapist } from '../contexts/TherapistContext';
import { useAuth } from '../contexts/AuthContext';
import { dateKey } from '../utils/agenda';
import {
  SECTION_OF,
  abcAntecedent,
  abcBehavior,
  abcConsequence,
  breakLine,
  breakType,
  lessonLine,
  longDate,
  newReportId,
  nowTime,
  shortReportDate,
} from '../utils/dailyReport';
import { AbcForm, BreakForm, LessonForm } from '../components/daily-report/forms';
import type {
  AbcReport,
  ApiResponse,
  BreakReport,
  DailyReport,
  LessonReport,
  ReportSection,
} from '../types';
import { BoltIcon, CupIcon, MoodFace, SaveIcon } from '../components/daily-report/icons';
import Icon from '../v2/Icon';
import KidAvatar from '../v2/KidAvatar';
import type { Kid } from '../types';
import '../components/daily-report/daily-report.css';
import '../v2/pages/dr.css';

/**
 * דיווח יומי — the school/therapy day report that replaces the paper form.
 *
 *   …/daily-reports                      history
 *   …/daily-reports/:date                one day: lessons, breaks, ABC
 *   …/daily-reports/:date/:kind/:itemId  one lesson / break / ABC event
 *
 * Staff (admin, therapist) write; parents read their own child's reports.
 */
export default function DailyReportsPage() {
  useEffect(() => {
    document.body.classList.add('dr-open');
    return () => document.body.classList.remove('dr-open');
  }, []);

  return (
    <div className="dr-page" dir="rtl">
      <Routes>
        <Route index element={<History />} />
        <Route path=":date" element={<ReportDay />} />
        <Route path=":date/:kind/:itemId" element={<ItemPage />} />
      </Routes>
    </div>
  );
}

// ---------------------------------------------------------------- shared

function useReportContext() {
  const { kidId, date } = useParams<{ kidId: string; date: string }>();
  const links = useTherapistLinks();
  const { isParentView } = useTherapist();
  const base = links.kidDailyReports(kidId!);
  return { kidId: kidId!, date, links, base, readOnly: isParentView };
}

function useKid(kidId: string) {
  return useQuery({ queryKey: ['kid', kidId], queryFn: () => kidsApi.getById(kidId), enabled: !!kidId });
}

function useReport(kidId: string, date?: string) {
  return useQuery({
    queryKey: ['daily-report', kidId, date],
    queryFn: () => dailyReportsApi.get(kidId, date!),
    enabled: !!kidId && !!date,
  });
}

/** Who is filling this in — prefilled from whoever is signed in. */
function useDefaultReporter() {
  const { user } = useAuth();
  const { isTherapistView, practitionerId } = useTherapist();
  const info = useQuery({
    queryKey: ['practitioner-info', practitionerId],
    queryFn: () => practitionersApi.getInfo(practitionerId!),
    enabled: isTherapistView && !!practitionerId,
  });
  return isTherapistView ? info.data?.data?.name || '' : user?.name || '';
}

/** Full page, no app nav: the back link says where it goes; the kid's face always leads to the kid page. */
function TopBar({ back, backLabel, crumbs, kid, kidUrl }: { back: string; backLabel: string; crumbs?: ReactNode; kid?: Kid; kidUrl: string }) {
  return (
    <div className="dr-top">
      <Link to={back} className="dr-back">
        <Icon name="back" size={20} strokeWidth={2.4} />
        <span>{backLabel}</span>
      </Link>
      <div className="dr-crumbs">{crumbs}</div>
      {kid && (
        <Link to={kidUrl} className="dr-kidlink" aria-label={`לדף של ${kid.name}`}>
          <KidAvatar kid={kid} size="sm" />
        </Link>
      )}
    </div>
  );
}

function Confirm({ text, action, onYes, onNo }: { text: string; action: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="dr-backdrop" onClick={onNo}>
      <div className="dr-dialog" role="alertdialog" onClick={(e) => e.stopPropagation()}>
        <p>{text}</p>
        <div className="dr-dialog-actions">
          <button type="button" className="dr-btn danger" onClick={onYes}>{action}</button>
          <button type="button" className="dr-btn ghost" onClick={onNo}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/** SVG, not "‹": that character is bidi-mirrored and flips in RTL text. */
function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

function Loading() {
  return <div className="dr-loading">טוען…</div>;
}

const ADD_ICON = <Icon name="plus" size={18} strokeWidth={2.4} />;

// ---------------------------------------------------------------- history

function History() {
  const { kidId, base, links, readOnly } = useReportContext();
  const navigate = useNavigate();
  const kid = useKid(kidId).data?.data;
  const today = dateKey(new Date());

  const list = useQuery({
    queryKey: ['daily-reports', kidId],
    queryFn: () => dailyReportsApi.list(kidId),
  });
  const reports = list.data?.data || [];
  const todayExists = reports.some((r) => r.date === today);

  if (!kid) return <Loading />;

  return (
    <>
      <TopBar back={links.kidDetail(kidId)} backLabel={`לדף של ${kid.name}`} kid={kid} kidUrl={links.kidDetail(kidId)} />
      <main className="dr-main">
        <div className="dr-title">
          <span className="dr-title-icon tone-sky" aria-hidden><Icon name="report" size={28} /></span>
          <div>
            <h1><mark className="hl-sky">דיווחים</mark> יומיים</h1>
            <p>{kid.name} · מה היה היום בבית הספר ובטיפול</p>
          </div>
        </div>

        {!readOnly && (
          /* Today is one tap; any other day goes through the phone's own date picker */
          <div className="dr-new">
            <button type="button" className="dr-btn primary" onClick={() => navigate(`${base}/${today}`)}>
              {todayExists ? <><Icon name="report" size={22} /> פתיחת הדיווח של היום</> : <>{ADD_ICON} דיווח להיום</>}
            </button>
            <label className="dr-btn dr-other-day">
              <Icon name="calendar" size={20} /> יום אחר
              <input
                type="date"
                max={today}
                aria-label="בחירת יום לדיווח"
                onClick={(e) => {
                  try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* opens natively */ }
                }}
                onChange={(e) => { if (e.target.value) navigate(`${base}/${e.target.value}`); }}
              />
            </label>
          </div>
        )}

        {list.isLoading ? (
          <Loading />
        ) : reports.length === 0 ? (
          <div className="dr-empty">
            <Icon name="report" size={40} strokeWidth={1.5} />
            <b>עוד אין דיווחים</b>
            {!readOnly && <span>הדיווח הראשון מתחיל בכפתור למעלה</span>}
          </div>
        ) : (
          <div className="dr-history">
            {reports.map((r) => {
              const d = shortReportDate(r.date);
              return (
                <Link key={r.date} to={`${base}/${r.date}`} className="dr-history-row">
                  <span className="dr-history-date">
                    <b>{d.day}</b>
                    <span>{d.date}</span>
                  </span>
                  <span className="dr-history-main">
                    <span className="dr-history-counts">
                      <span className="nb-chip tone-sky">{r.lessons} שיעורים</span>
                      <span className="nb-chip tone-mint">{r.breaks} הפסקות</span>
                      {r.abc > 0 && <span className="nb-chip tone-peach">{r.abc} ABC</span>}
                    </span>
                    {r.reporter && <span className="dr-history-reporter">מילא/ה: {r.reporter}</span>}
                  </span>
                  <ChevronLeft className="dr-chev" />
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

// ---------------------------------------------------------------- one day

function ReportDay() {
  const { kidId, date, base, links, readOnly } = useReportContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const kid = useKid(kidId).data?.data;
  const reportQuery = useReport(kidId, date);
  const report = reportQuery.data?.data || null;
  const defaultReporter = useDefaultReporter();
  const [reporter, setReporter] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const team = useQuery({
    queryKey: ['kid-practitioners', kidId],
    queryFn: () => practitionersApi.getForKid(kidId),
    enabled: !readOnly,
  });

  const shownReporter = reporter ?? (report?.reporter || defaultReporter);

  const saveMeta = useMutation({
    mutationFn: (name: string) => dailyReportsApi.saveMeta(kidId, date!, name),
    onSuccess: (res) => {
      if (res.success) queryClient.setQueryData(['daily-report', kidId, date], res);
      queryClient.invalidateQueries({ queryKey: ['daily-reports', kidId] });
    },
  });

  const remove = useMutation({
    mutationFn: () => dailyReportsApi.remove(kidId, date!),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['daily-report', kidId, date] });
      queryClient.invalidateQueries({ queryKey: ['daily-reports', kidId] });
      navigate(base, { replace: true });
    },
  });

  if (!kid || reportQuery.isLoading) return <Loading />;

  const lessons = report?.lessons || [];
  const breaks = report?.breaks || [];
  const abc = report?.abc || [];
  const item = (kind: string, id: string) => `${base}/${date}/${kind}/${id}`;

  const commitReporter = () => {
    if (reporter === null || reporter === (report?.reporter || '')) return;
    saveMeta.mutate(reporter.trim());
  };

  return (
    <>
      <TopBar back={base} backLabel="כל הדיווחים" kid={kid} kidUrl={links.kidDetail(kidId)}
        crumbs={<span>{shortReportDate(date!).date}</span>} />
      <main className="dr-main">
        <div className="dr-title">
          <span className="dr-title-icon tone-sky" aria-hidden><Icon name="report" size={28} /></span>
          <div>
            <h1>דיווח <mark className="hl-yellow">יומי</mark></h1>
            <p>{longDate(date!)}</p>
          </div>
        </div>

        <div className="dr-card dr-meta">
          <div className="dr-meta-cell">
            <span className="dr-meta-label">הילד/ה</span>
            <span className="dr-meta-kid"><KidAvatar kid={kid} size="sm" /><b className="dr-meta-big">{kid.name}</b></span>
          </div>
          <div className="dr-meta-cell">
            <span className="dr-meta-label">תאריך</span>
            <span>{longDate(date!)}</span>
          </div>
          <div className="dr-meta-cell">
            <span className="dr-meta-label">ממלא/ת את הדיווח</span>
            {readOnly ? (
              <span>{report?.reporter || '—'}</span>
            ) : (
              <>
                <input
                  className="dr-input"
                  list="dr-team"
                  value={shownReporter}
                  maxLength={80}
                  placeholder="שם המשלבת / המטפלת"
                  onChange={(e) => setReporter(e.target.value)}
                  onBlur={commitReporter}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                />
                <datalist id="dr-team">
                  {(team.data?.data || []).map((p) => <option key={p.id} value={p.name} />)}
                </datalist>
              </>
            )}
          </div>
        </div>

        {/* Lessons */}
        <section className="dr-section dr-tone-blue">
          <header className="dr-section-head">
            <span className="dr-group-icon" aria-hidden><Icon name="book" size={22} /></span>
            <span className="dr-section-title">
              <h2>שיעורים / פעילויות</h2>
              <p>רשימת השיעורים והפעילויות של היום</p>
            </span>
            {!readOnly && (
              <Link to={item('lesson', 'new')} className="dr-btn primary small">{ADD_ICON}<span className="dr-wide-only">הוסף </span>שיעור</Link>
            )}
          </header>
          {lessons.length === 0 && <div className="dr-row-empty">עוד לא נוספו שיעורים</div>}
          {lessons.map((l, i) => (
            <Link key={l.id} to={item('lesson', l.id)} className="dr-row">
              <span className="dr-num">{i + 1}</span>
              <span className="dr-row-title">{l.title}</span>
              {(l.mood || typeof l.cooperationPct === 'number') && (
                <span className="dr-row-mood">
                  {l.mood && <span className={`dr-face dr-face-${l.mood}`}><MoodFace mood={l.mood} size={24} /></span>}
                  {typeof l.cooperationPct === 'number' && <b className="dr-row-pct">{l.cooperationPct}%</b>}
                </span>
              )}
              <span className="dr-row-text">{lessonLine(l)}</span>
              <span className="dr-edit">{readOnly ? 'צפייה' : <><Icon name="edit" size={15} /> עריכה</>}</span>
            </Link>
          ))}
        </section>

        {/* Breaks */}
        <section className="dr-section dr-tone-green">
          <header className="dr-section-head">
            <span className="dr-group-icon" aria-hidden><CupIcon size={22} /></span>
            <span className="dr-section-title">
              <h2>הפסקות</h2>
              <p>רשימת ההפסקות במהלך היום</p>
            </span>
            {!readOnly && (
              <Link to={item('break', 'new')} className="dr-btn green small">{ADD_ICON}<span className="dr-wide-only">הוסף </span>הפסקה</Link>
            )}
          </header>
          {breaks.length === 0 && <div className="dr-row-empty">עוד לא נוספו הפסקות</div>}
          {breaks.map((b) => {
            const t = breakType(b.type);
            return (
              <Link key={b.id} to={item('break', b.id)} className="dr-row">
                <span className="dr-time">{b.time || '—'}</span>
                <span className="dr-row-title">{b.name || t?.label || 'הפסקה'}</span>
                {b.duration && <span className="dr-row-dur">{b.duration}</span>}
                <span className="dr-row-text">{breakLine(b)}</span>
                <span className="dr-edit">{readOnly ? 'צפייה' : <><Icon name="edit" size={15} /> עריכה</>}</span>
              </Link>
            );
          })}
        </section>

        {/* ABC */}
        <section className="dr-section dr-tone-peach">
          <header className="dr-section-head">
            <span className="dr-group-icon" aria-hidden><BoltIcon size={22} /></span>
            <span className="dr-section-title">
              <h2>אירועי ABC</h2>
              <p>אירועי התנהגות במהלך היום</p>
            </span>
            {!readOnly && (
              <Link to={item('abc', 'new')} className="dr-btn peach small">{ADD_ICON}<span className="dr-wide-only">הוסף </span>אירוע</Link>
            )}
          </header>
          {abc.length === 0 && <div className="dr-row-empty">לא נרשמו אירועים</div>}
          {abc.map((e) => (
            <Link key={e.id} to={item('abc', e.id)} className="dr-row dr-abc-row">
              <span className="dr-time">{e.time || '—'}</span>
              <span className="dr-abc-body">
                <span className="dr-abc-b"><i>B</i>{abcBehavior(e) || '—'}</span>
                <span className="dr-abc-ac">
                  {abcAntecedent(e) && <span><i>A</i>{abcAntecedent(e)}</span>}
                  {abcConsequence(e) && <span><i>C</i>{abcConsequence(e)}</span>}
                </span>
              </span>
              <span className="dr-edit">{readOnly ? 'צפייה' : <><Icon name="edit" size={15} /> עריכה</>}</span>
            </Link>
          ))}
        </section>

        {!readOnly && report && (
          <button type="button" className="dr-delete-report" onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" size={16} /> מחיקת הדיווח של היום
          </button>
        )}
      </main>

      {confirmDelete && (
        <Confirm
          text={`למחוק את כל הדיווח של ${longDate(date!)}? כל השיעורים, ההפסקות ואירועי ה-ABC יימחקו.`}
          action="מחיקה"
          onYes={() => { setConfirmDelete(false); remove.mutate(); }}
          onNo={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- one item

type AnyItem = LessonReport | BreakReport | AbcReport;

const KIND_META: Record<string, { label: string; icon: ReactNode; tone: string }> = {
  lesson: { label: 'שיעור', icon: <Icon name="book" size={26} />, tone: 'sky' },
  break: { label: 'הפסקה', icon: <CupIcon size={26} />, tone: 'mint' },
  abc: { label: 'אירוע ABC', icon: <BoltIcon size={26} />, tone: 'peach' },
};

function ItemPage() {
  const { kidId, date, base, links, readOnly } = useReportContext();
  const kid = useKid(kidId).data?.data;
  const { kind = '', itemId = '' } = useParams<{ kind: string; itemId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const section = SECTION_OF[kind] as ReportSection | undefined;
  const reportQuery = useReport(kidId, date);
  const report = reportQuery.data?.data || null;
  const defaultReporter = useDefaultReporter();
  const isNew = itemId === 'new';
  const [freshId] = useState(newReportId);
  const [draft, setDraft] = useState<AnyItem | null>(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const list: AnyItem[] = useMemo(
    () => (section && report ? ((report[section] as AnyItem[] | undefined) || []) : []),
    [section, report]
  );
  const stored = isNew ? null : list.find((i) => i.id === itemId) || null;
  const isToday = date === dateKey(new Date());
  const blank = kind === 'lesson'
    ? ({ id: freshId, title: '' } as LessonReport)
    : ({ id: freshId, time: isToday ? nowTime() : '' } as BreakReport);
  const value: AnyItem | null = draft ?? stored ?? (isNew ? blank : null);
  const index = isNew ? list.length : list.findIndex((i) => i.id === itemId);
  const dayUrl = `${base}/${date}`;

  const applyReport = (res: ApiResponse<DailyReport | null>) => {
    if (res.success) queryClient.setQueryData(['daily-report', kidId, date], res);
    queryClient.invalidateQueries({ queryKey: ['daily-reports', kidId] });
  };

  const save = useMutation({
    mutationFn: async (item: AnyItem) => {
      // First record of the day also creates the report, signed by whoever is filling it
      if (!report) await dailyReportsApi.saveMeta(kidId, date!, defaultReporter);
      return dailyReportsApi.saveItem(kidId, date!, section!, item);
    },
  });

  const remove = useMutation({
    mutationFn: () => dailyReportsApi.removeItem(kidId, date!, section!, itemId),
    onSuccess: (res) => { applyReport(res); navigate(dayUrl, { replace: true }); },
  });

  if (!section || !KIND_META[kind]) return <div className="dr-loading">לא נמצא.</div>;
  if (reportQuery.isLoading) return <Loading />;
  if (!value) return <div className="dr-loading">הרשומה לא נמצאה.</div>;

  const meta = KIND_META[kind];
  const heading = kind === 'lesson' ? `שיעור ${index + 1}` : kind === 'break' ? `הפסקה ${index + 1}` : meta.label;

  const submit = async (then?: string) => {
    if (kind === 'lesson' && !(value as LessonReport).title?.trim()) {
      setError('צריך לכתוב שם לשיעור');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setError('');
    const res = await save.mutateAsync(value);
    if (!res.success) {
      setError(res.error || 'השמירה נכשלה');
      return;
    }
    applyReport(res);
    navigate(then || dayUrl, { replace: !then });
  };

  const addAbc = readOnly ? undefined : () => submit(`${dayUrl}/abc/new`);
  const onChange = (next: AnyItem) => setDraft(next);

  return (
    <>
      <TopBar
        back={dayUrl}
        backLabel="לדיווח היומי"
        kid={kid}
        kidUrl={links.kidDetail(kidId)}
        crumbs={<span>{shortReportDate(date!).date}</span>}
      />
      <main className="dr-main dr-form">
        <div className="dr-title">
          <span className={`dr-title-icon tone-${meta.tone}`} aria-hidden>{meta.icon}</span>
          <div>
            <h1>{heading}</h1>
            <p>{longDate(date!)}</p>
          </div>
        </div>

        {error && <div className="dr-error">{error}</div>}

        <fieldset disabled={readOnly} className="dr-fieldset">
          {kind === 'lesson' && <LessonForm value={value as LessonReport} onChange={onChange} onAddAbc={addAbc} />}
          {kind === 'break' && <BreakForm value={value as BreakReport} onChange={onChange} onAddAbc={addAbc} />}
          {kind === 'abc' && <AbcForm value={value as AbcReport} onChange={onChange} />}
        </fieldset>
      </main>

      {!readOnly && (
        <div className="dr-savebar">
          <button type="button" className="dr-btn primary" disabled={save.isPending} onClick={() => submit()}>
            {save.isPending ? 'שומר…' : <><SaveIcon size={22} /> שמירה</>}
          </button>
          <Link to={dayUrl} className="dr-btn ghost">ביטול</Link>
          {!isNew && (
            <button type="button" className="dr-btn danger-text" onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={18} /> מחיקה
            </button>
          )}
        </div>
      )}

      {confirmDelete && (
        <Confirm
          text={`למחוק את ${heading}?`}
          action="מחיקה"
          onYes={() => { setConfirmDelete(false); remove.mutate(); }}
          onNo={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
