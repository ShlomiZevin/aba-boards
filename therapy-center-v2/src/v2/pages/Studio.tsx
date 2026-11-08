import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { studioApi, type StudioCreation, type StudioMode, type StudioReading, type StudioVideoModel } from '../../api/client';
import Icon from '../Icon';
import './studio.css';

// סטודיו: Michal shares a photo of what the kids built, says or writes what should happen,
// and gets a short video or two pictures. Every setting is fixed on the server.

const EXPECTED_S: Record<StudioMode, number> = { video: 170, images: 40 };
const isFinal = (s: string) => s === 'done' || s === 'failed';
const allFinal = (c?: StudioCreation | null) => !!c && c.items.every(i => isFinal(i.status));

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

function toJpeg(img: HTMLImageElement, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Save or share a finished file. Mobile: the share sheet (WhatsApp, gallery…); else a download. */
async function saveFile(url: string, kind: 'image' | 'video', share: boolean) {
  const name = `doing-${Date.now()}.${kind === 'video' ? 'mp4' : 'png'}`;
  try {
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], name, { type: blob.type || (kind === 'video' ? 'video/mp4' : 'image/png') });
    if (share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (err) {
    if ((err as Error).name === 'AbortError') return; // closed the share sheet
    window.open(url, '_blank', 'noopener');
  }
}

function Result({ creation }: { creation: StudioCreation }) {
  const done = creation.items.filter(i => i.status === 'done' && i.url);
  if (!done.length) return null;
  return (
    <div className={`st-result ${creation.mode}`}>
      {done.map(item => (
        <figure key={item.jobId} className="st-media">
          {item.kind === 'video'
            ? <video src={item.url!} poster={item.poster || undefined} controls playsInline loop preload="metadata" />
            : <img src={item.url!} alt={creation.wish || creation.description} />}
          <div className="st-media-actions">
            <button type="button" className="nb-btn" onClick={() => saveFile(item.url!, item.kind, true)}><Icon name="share" size={18} /> שיתוף</button>
            <button type="button" className="nb-btn-ghost" onClick={() => saveFile(item.url!, item.kind, false)}><Icon name="download" size={18} /> שמירה</button>
          </div>
        </figure>
      ))}
    </div>
  );
}

function Progress({ creation, startedAt, compact }: { creation: StudioCreation | null; startedAt: number; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const mode = creation?.mode || 'video';
  const elapsed = (now - startedAt) / 1000;
  // eases toward 95% so it never looks stuck and never claims to be done early
  const real = creation?.items.length ? creation.items.reduce((a, i) => a + (i.status === 'done' ? 100 : i.progress || 0), 0) / creation.items.length : 0;
  const pct = Math.max(real, Math.min(95, (1 - Math.exp(-elapsed / (EXPECTED_S[mode] * 0.75))) * 100));
  const doneCount = creation?.items.filter(i => i.status === 'done').length || 0;
  const label = !creation
    ? 'מסתכלת על התמונה וכותבת הוראות…'
    : mode === 'video' ? 'הסרטון בדרך, זה לוקח כ־3 דקות. אפשר לצאת ולחזור: הוא ממשיך, ויחכה ב״היצירות שלי״.' : `מציירת ${doneCount ? 'את התמונה השנייה' : 'שתי תמונות'}…`;
  return (
    <div className={`st-progress ${compact ? 'compact' : ''}`} role="status">
      <div className="st-progress-top"><span className="hand">{compact ? `${Math.round(pct)}%` : label}</span><b dir="ltr">{fmt(elapsed)}</b></div>
      <div className="st-bar"><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Recorder({ mode, onText, disabled }: { mode: StudioMode; onText: (t: string) => void; disabled: boolean }) {
  const [state, setState] = useState<'idle' | 'rec' | 'busy'>('idle');
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState('');
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); rec.current?.stream.getTracks().forEach(t => t.stop()); }, []);

  async function start() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(m => MediaRecorder.isTypeSupported?.(m)) || '';
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      r.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timer.current) clearInterval(timer.current);
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
        if (blob.size < 1000) { setState('idle'); return; }
        setState('busy');
        const res = await studioApi.transcribe(await blobToBase64(blob), blob.type.split(';')[0], mode);
        setState('idle');
        if (res.success && res.data?.text) onText(res.data.text);
        else setError(res.error || 'לא הצלחתי לשמוע. אפשר לנסות שוב או לכתוב.');
      };
      rec.current = r;
      r.start();
      setSecs(0);
      setState('rec');
      timer.current = setInterval(() => setSecs(s => { if (s >= 59) r.stop(); return s + 1; }), 1000);
    } catch {
      setError('אין גישה למיקרופון. אפשר לכתוב במקום.');
    }
  }

  return (
    <div className="st-rec">
      {state === 'rec' ? (
        <button type="button" className="st-mic is-rec" onClick={() => rec.current?.stop()} aria-label="סיום הקלטה">
          <Icon name="stop" size={22} /> <span dir="ltr">{fmt(secs)}</span>
        </button>
      ) : (
        <button type="button" className="st-mic" onClick={start} disabled={disabled || state === 'busy'} aria-label="הקלטה">
          <Icon name="mic" size={24} /> {state === 'busy' ? 'רגע…' : 'הקלטה'}
        </button>
      )}
      {error && <span className="st-rec-err">{error}</span>}
    </div>
  );
}

// The one video choice Michal makes. Faithful faces is the default: the photos are of real kids.
const VIDEO_CHOICES: { id: StudioVideoModel; title: string; note: string }[] = [
  { id: 'fast', title: 'פנים נאמנות', note: 'הילדים נשארים עם הפנים שלהם, כמו בתמונה. בערך פי 3 במחיר.' },
  { id: 'mini', title: 'טיוטה', note: 'זול ומהיר, לנסות רעיון. הפנים עלולות להשתנות קצת.' },
];
const videoModelOf = (c: StudioCreation) => c.mode === 'video' ? c.items[0]?.model : null;
const MODEL_TAG: Record<string, string> = { fast: 'פנים נאמנות', mini: 'טיוטה' };

function VideoModelPick({ value, onChange, prices }: { value: StudioVideoModel; onChange: (m: StudioVideoModel) => void; prices: Partial<Record<StudioVideoModel, number | null>> }) {
  return (
    <div className="st-vmodel" role="radiogroup" aria-label="איזה סרטון">
      {VIDEO_CHOICES.map(c => (
        <button key={c.id} type="button" role="radio" aria-checked={value === c.id} className={value === c.id ? 'is-on' : ''} onClick={() => onChange(c.id)}>
          <span className="st-vmodel-dot" aria-hidden="true">{value === c.id && <Icon name="check" size={16} />}</span>
          <span className="st-vmodel-body">
            <span className="st-vmodel-top">
              <b>{c.title}</b>
              {c.id === 'fast' && <span className="st-vmodel-rec">מומלץ</span>}
              {prices[c.id] != null && <span className="st-vmodel-usd">בערך ${prices[c.id]!.toFixed(2)}</span>}
            </span>
            <small>{c.note}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

// Piko's job statuses, as Michal reads them
const STATUS_HE: Record<string, string> = { queued: 'ממתין בתור', working: 'מתחיל ליצור', running: 'נוצר עכשיו', saving: 'כמעט מוכן', done: 'מוכן', failed: 'לא הצליח' };
const ORDER = ['failed', 'queued', 'working', 'running', 'saving', 'done'];
const statusOf = (c: StudioCreation) => {
  const live = c.items.filter(i => !isFinal(i.status));
  if (live.length) return live.map(i => i.status).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0];
  return c.items.some(i => i.status === 'done') ? 'done' : 'failed';
};

function dayLabel(iso: string | null) {
  if (!iso) return 'קודם';
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'היום';
  if (d.toDateString() === y.toDateString()) return 'אתמול';
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
}
const timeOf = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '');
const startOf = (c: StudioCreation) => (c.createdAt ? Date.parse(c.createdAt) : Date.now());

function GalleryCard({ c, onOpen }: { c: StudioCreation; onOpen: () => void }) {
  const first = c.items.find(i => i.status === 'done');
  const cover = first?.kind === 'video' ? first.poster : first?.url;
  const partial = c.items.some(i => i.status === 'failed');
  return (
    <button type="button" className="st-tile" onClick={onOpen}>
      {cover || c.thumb ? <img src={cover || c.thumb!} alt="" loading="lazy" /> : <span className="st-tile-blank" />}
      {c.mode === 'video' && <span className="st-tile-play"><Icon name="play" size={20} /></span>}
      <span className={`st-tile-tag ${c.mode}`}>
        <Icon name={c.mode === 'video' ? 'film' : 'image'} size={14} /> {c.mode === 'video' ? 'סרטון' : `${c.items.filter(i => i.status === 'done').length} תמונות`}{videoModelOf(c) === 'mini' ? ' · טיוטה' : ''}{partial ? ' · חלקי' : ''}
      </span>
    </button>
  );
}

function RowCard({ c, onOpen, onRemove }: { c: StudioCreation; onOpen: () => void; onRemove?: () => void }) {
  const st = statusOf(c);
  const live = !allFinal(c);
  return (
    <div className={`st-row nb-card ${live ? 'is-live' : ''}`}>
      <button type="button" className="st-row-main" onClick={onOpen}>
        {c.thumb ? <img src={c.thumb} alt="" /> : <span className="st-row-blank" />}
        <span className="st-row-body">
          <span className="st-row-top">
            <b>{c.mode === 'video' ? 'סרטון' : 'תמונות'}{MODEL_TAG[videoModelOf(c) || ''] ? ` · ${MODEL_TAG[videoModelOf(c)!]}` : ''}</b>
            <span className={`st-status s-${st}`}>{STATUS_HE[st] || st}</span>
          </span>
          {(c.wish || c.description) && <span className="st-row-wish">{c.wish || c.description}</span>}
          {live
            ? <Progress creation={c} startedAt={startOf(c)} compact />
            : <span className="st-row-time">{dayLabel(c.createdAt)} · {timeOf(c.createdAt)}</span>}
        </span>
      </button>
      {onRemove && <button type="button" className="st-row-x" onClick={onRemove} aria-label="הסרה"><Icon name="trash" size={18} /></button>}
    </div>
  );
}

function MyCreations({ creations, onOpen, onRemove, onNew }: { creations: StudioCreation[]; onOpen: (id: string) => void; onRemove: (id: string) => void; onNew: () => void }) {
  const live = creations.filter(c => !allFinal(c));
  const ready = creations.filter(c => allFinal(c) && statusOf(c) === 'done');
  const failed = creations.filter(c => allFinal(c) && statusOf(c) === 'failed');
  const days: [string, StudioCreation[]][] = [];
  for (const c of ready) {
    const k = dayLabel(c.createdAt);
    const g = days.find(d => d[0] === k);
    if (g) g[1].push(c);
    else days.push([k, [c]]);
  }
  if (!creations.length) {
    return (
      <div className="st-empty nb-card">
        <p className="hand">עוד לא יצרנו כלום.</p>
        <button type="button" className="nb-btn" onClick={onNew}><Icon name="camera" size={20} /> ליצירה הראשונה</button>
      </div>
    );
  }
  return (
    <div className="st-mine">
      {live.length > 0 && (
        <section className="st-sec">
          <h2 className="nb-h2">בדרך עכשיו <span className="st-count">{live.length}</span></h2>
          {live.map(c => <RowCard key={c.id} c={c} onOpen={() => onOpen(c.id)} />)}
        </section>
      )}
      {days.length > 0 && (
        <section className="st-sec">
          <h2 className="nb-h2">מוכנים <span className="st-count">{ready.length}</span></h2>
          {days.map(([day, list]) => (
            <div key={day} className="st-day">
              <span className="st-day-label">{day}</span>
              <div className="st-grid">{list.map(c => <GalleryCard key={c.id} c={c} onOpen={() => onOpen(c.id)} />)}</div>
            </div>
          ))}
        </section>
      )}
      {failed.length > 0 && (
        <section className="st-sec">
          <h2 className="nb-h2">לא הצליחו <span className="st-count">{failed.length}</span></h2>
          {failed.map(c => <RowCard key={c.id} c={c} onOpen={() => onOpen(c.id)} onRemove={() => onRemove(c.id)} />)}
        </section>
      )}
    </div>
  );
}

export default function Studio() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const workRef = useRef<HTMLElement>(null);
  const doneRef = useRef<HTMLElement>(null);

  const [photo, setPhoto] = useState<{ image: string; thumb: string } | null>(null);
  const [reading, setReading] = useState<StudioReading | null>(null);
  const [readingBusy, setReadingBusy] = useState(false);
  const [mode, setMode] = useState<StudioMode>('video');
  const [videoModel, setVideoModel] = useState<StudioVideoModel>('fast');
  const [wish, setWish] = useState('');
  const [error, setError] = useState('');
  const [run, setRun] = useState<{ id: string | null; startedAt: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'mine' ? 'mine' : 'new';
  const goTab = (t: 'new' | 'mine') => { setParams(t === 'mine' ? { tab: 'mine' } : {}); window.scrollTo({ top: 0 }); };

  const { data: listRes } = useQuery({
    queryKey: ['studio'],
    queryFn: () => studioApi.list(),
    enabled: !!user?.isSuperAdmin,
    refetchInterval: q => (q.state.data?.data || []).some(c => !allFinal(c)) ? 5000 : false,
  });
  const creations = listRes?.data || [];
  const { data: optRes } = useQuery({ queryKey: ['studio-options'], queryFn: () => studioApi.options(), enabled: !!user?.isSuperAdmin, staleTime: 10 * 60 * 1000 });
  const prices = Object.fromEntries((optRes?.data?.video || []).map(v => [v.id, v.usd])) as Partial<Record<StudioVideoModel, number | null>>;

  // Jobs that keep running while she is away (or started before this visit): shown on top with progress,
  // and the one that finishes while she is here opens by itself.
  const waiting = creations.filter(c => !allFinal(c) && c.id !== run?.id);
  const liveCount = creations.filter(c => !allFinal(c)).length;
  const watched = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const c of creations) {
      if (!allFinal(c)) watched.current.add(c.id);
      else if (watched.current.has(c.id)) {
        watched.current.delete(c.id);
        if (c.id !== run?.id && c.items.some(i => i.status === 'done')) setOpenId(c.id);
      }
    }
  }, [creations, run?.id]);

  const { data: runRes } = useQuery({
    queryKey: ['studio', run?.id],
    queryFn: () => studioApi.get(run!.id!),
    enabled: !!run?.id,
    refetchInterval: q => allFinal(q.state.data?.data) ? false : 4000,
  });
  const current = run?.id ? runRes?.data || null : null;
  const finished = allFinal(current);
  useEffect(() => {
    if (!finished) return;
    qc.invalidateQueries({ queryKey: ['studio'], exact: true });
    // on a phone the result opens below the fold: bring it up
    setTimeout(() => doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }, [finished, qc]);

  if (!user?.isSuperAdmin) return <Navigate to="/" replace />;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError('');
    setRun(null);
    setReading(null);
    setWish('');
    try {
      const img = await loadImage(file);
      const next = { image: toJpeg(img, 1536, 0.88), thumb: toJpeg(img, 360, 0.72) };
      setPhoto(next);
      setReadingBusy(true);
      const res = await studioApi.understand(next.image);
      setReadingBusy(false);
      if (res.success && res.data) setReading(res.data);
    } catch {
      setReadingBusy(false);
      setError('לא הצלחתי לפתוח את התמונה. נסי תמונה אחרת.');
    }
  }

  async function go(model: StudioVideoModel = videoModel) {
    if (!photo) return;
    if (model !== videoModel) setVideoModel(model);
    setError('');
    setRun({ id: null, startedAt: Date.now() });
    setTimeout(() => workRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    const res = await studioApi.create({ image: photo.image, thumb: photo.thumb, wish: wish.trim(), mode, videoModel: mode === 'video' ? model : undefined, build: reading?.build, description: reading?.description });
    if (!res.success || !res.data) {
      setRun(null);
      setError(res.error || 'משהו השתבש. אפשר לנסות שוב.');
      return;
    }
    qc.setQueryData(['studio', res.data.id], { success: true, data: res.data });
    setRun({ id: res.data.id, startedAt: Date.now() - 4000 });
    qc.invalidateQueries({ queryKey: ['studio'], exact: true });
  }

  async function remove(id: string) {
    setOpenId(null);
    await studioApi.delete(id);
    qc.invalidateQueries({ queryKey: ['studio'], exact: true });
  }

  function reset() {
    setPhoto(null); setReading(null); setWish(''); setRun(null); setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const running = !!run && !finished;
  const failedAll = !!current && finished && current.items.every(i => i.status === 'failed');
  const someFailed = !!current && finished && current.items.some(i => i.status === 'failed');
  const ideas = reading?.ideas[mode] || [];
  const opened = creations.find(c => c.id === openId) || null;

  return (
    <div className="st">
      <header className="st-head">
        <h1 className="nb-h1">סטודיו <mark className="hl-pink">קסם</mark></h1>
        <p className="nb-muted">תמונה של מה שהילדים בנו, ומה את רוצה שיקרה. אני אדאג לשאר.</p>
      </header>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => pick(e.target.files?.[0])} />

      <div className="st-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'new'} className={tab === 'new' ? 'is-on' : ''} onClick={() => goTab('new')}>
          <Icon name="sparkle" size={18} /> יצירה חדשה
        </button>
        <button type="button" role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'is-on' : ''} onClick={() => goTab('mine')}>
          <Icon name="image" size={18} /> היצירות שלי
          {liveCount > 0 ? <span className="st-tab-live">{liveCount} בדרך</span> : creations.length > 0 ? <span className="st-tab-n">{creations.length}</span> : null}
        </button>
      </div>

      {tab === 'mine' ? (
        <MyCreations creations={creations} onOpen={setOpenId} onRemove={remove} onNew={() => { reset(); goTab('new'); }} />
      ) : (<>
      {waiting.length > 0 && (
        <button type="button" className="st-banner" onClick={() => goTab('mine')}>
          <span className="st-banner-dot" />
          <span className="st-banner-txt"><b>{waiting.length === 1 ? (waiting[0].mode === 'video' ? 'סרטון בדרך' : 'תמונות בדרך') : `${waiting.length} יצירות בדרך`}</b> · {STATUS_HE[statusOf(waiting[0])]}</span>
          <span className="st-banner-go">לראות <Icon name="chevron" size={16} /></span>
        </button>
      )}

      {!photo ? (
        <button type="button" className="st-drop nb-card" onClick={() => fileRef.current?.click()}>
          <span className="st-drop-ico"><Icon name="camera" size={34} /></span>
          <b>צלמי או בחרי תמונה</b>
          <span className="nb-muted">של הילדים עם מה שבנו: מגנטים, לגו, קופסאות…</span>
        </button>
      ) : (
        <section ref={workRef} className={`st-work nb-card ${run ? 'is-compact' : ''}`}>
          <div className="st-photo">
            <img src={photo.image} alt="התמונה שנבחרה" />
            {!running && <button type="button" className="st-swap" onClick={() => fileRef.current?.click()}><Icon name="camera" size={16} /> החלפה</button>}
          </div>

          <div className="st-side">
            <p className={`st-seen ${readingBusy ? 'is-busy' : ''}`}>
              <Icon name="sparkle" size={18} />
              {readingBusy ? 'מסתכלת על התמונה…' : reading?.description ? <span><b>אני רואה:</b> {reading.description}</span> : 'התמונה מוכנה.'}
            </p>

            {!run && (
              <>
                <div className="st-modes" role="radiogroup" aria-label="מה ליצור">
                  <button type="button" role="radio" aria-checked={mode === 'video'} className={mode === 'video' ? 'is-on' : ''} onClick={() => setMode('video')}>
                    <Icon name="film" size={22} /><b>סרטון</b><small>6 שניות עם צליל</small>
                  </button>
                  <button type="button" role="radio" aria-checked={mode === 'images'} className={mode === 'images' ? 'is-on' : ''} onClick={() => setMode('images')}>
                    <Icon name="image" size={22} /><b>תמונות</b><small>2 תמונות, 2 סגנונות</small>
                  </button>
                </div>

                {mode === 'video' && <VideoModelPick value={videoModel} onChange={setVideoModel} prices={prices} />}

                {ideas.length > 0 && (
                  <div className="st-ideas">
                    <span className="st-label">רעיונות:</span>
                    {ideas.map(t => (
                      <button key={t} type="button" className={`st-idea ${wish === t ? 'is-on' : ''}`} onClick={() => setWish(t)}>{t}</button>
                    ))}
                  </div>
                )}

                <div className="st-wish">
                  <textarea
                    value={wish}
                    onChange={e => setWish(e.target.value)}
                    rows={3}
                    placeholder={mode === 'video' ? 'מה יקרה בסרטון? למשל: הילדים נכנסים לכדור הפורח והוא עף לשמיים' : 'מה יהיה בתמונה? למשל: הילדים מפליגים בספינה שבנו'}
                  />
                  <Recorder mode={mode} disabled={false} onText={t => setWish(w => (w.trim() ? `${w.trim()} ${t}` : t))} />
                </div>

                <button type="button" className="nb-btn st-go" onClick={() => go()} disabled={readingBusy}>
                  <Icon name="sparkle" size={20} /> {mode === 'video' ? (videoModel === 'mini' ? 'צרי סרטון טיוטה' : 'צרי סרטון') : 'צרי 2 תמונות'}
                </button>
                {!wish.trim() && !readingBusy && <p className="st-hint nb-muted">בלי בקשה? אבחר בעצמי את הרעיון הכי מתאים.</p>}
              </>
            )}

            {running && (
              <>
                <Progress creation={current} startedAt={run!.startedAt} />
                <div className="st-while">
                  <button type="button" className="nb-btn-ghost" onClick={reset}><Icon name="plus" size={18} /> עוד יצירה בינתיים</button>
                  <button type="button" className="nb-btn-ghost" onClick={() => goTab('mine')}><Icon name="image" size={18} /> כל היצירות</button>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {error && (
        <div className="st-error" role="alert">
          <span>{error}</span>
          {photo && !run && <button type="button" className="nb-btn-ghost" onClick={() => go()}><Icon name="refresh" size={18} /> לנסות שוב</button>}
        </div>
      )}

      {current && finished && (
        <section ref={doneRef} className="st-done">
          <Result creation={current} />
          {someFailed && (
            <div className="st-error" role="alert">
              <span>{failedAll ? 'היצירה לא הצליחה הפעם.' : 'אחת התמונות לא הצליחה.'}</span>
              <button type="button" className="nb-btn-ghost" onClick={() => go()}><Icon name="refresh" size={18} /> לנסות שוב</button>
            </div>
          )}
          <div className="st-next">
            {!someFailed && videoModelOf(current) === 'mini' && (
              <button type="button" className="nb-btn st-upgrade" onClick={() => go('fast')}><Icon name="sparkle" size={18} /> אהבתי! עכשיו עם פנים נאמנות</button>
            )}
            {!someFailed && <button type="button" className="nb-btn-ghost" onClick={() => go()}><Icon name="refresh" size={18} /> עוד גרסה</button>}
            <button type="button" className="nb-btn-ghost" onClick={() => setRun(null)}><Icon name="edit" size={18} /> לשנות את הבקשה</button>
            <button type="button" className="nb-btn-ghost" onClick={reset}><Icon name="camera" size={18} /> תמונה חדשה</button>
            <button type="button" className="nb-btn-ghost" onClick={() => goTab('mine')}><Icon name="image" size={18} /> כל היצירות</button>
          </div>
        </section>
      )}

      </>)}

      {opened && (
        <div className="st-sheet" role="dialog" aria-modal="true" onClick={() => setOpenId(null)}>
          <div className="st-sheet-body nb-card" onClick={e => e.stopPropagation()}>
            <div className="st-sheet-head">
              <span className="hand">{opened.wish || opened.description || (opened.mode === 'video' ? 'סרטון' : 'תמונות')}</span>
              <button type="button" className="st-x" onClick={() => setOpenId(null)} aria-label="סגירה"><Icon name="close" /></button>
            </div>
            <span className={`st-status s-${statusOf(opened)}`}>{STATUS_HE[statusOf(opened)]} · {dayLabel(opened.createdAt)} {timeOf(opened.createdAt)}{MODEL_TAG[videoModelOf(opened) || ''] ? ` · ${MODEL_TAG[videoModelOf(opened)!]}` : ''}</span>
            {allFinal(opened) ? <Result creation={opened} /> : <Progress creation={opened} startedAt={startOf(opened)} />}
            {opened.items.every(i => i.status === 'failed') && <p className="st-error">היצירה הזאת לא הצליחה.</p>}
            <button type="button" className="st-del" onClick={() => remove(opened.id)}>
              <Icon name="trash" size={16} /> הסרה מהרשימה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
