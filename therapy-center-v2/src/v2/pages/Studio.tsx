import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { studioApi, type StudioCreation, type StudioMode, type StudioReading } from '../../api/client';
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

function Progress({ creation, startedAt }: { creation: StudioCreation | null; startedAt: number }) {
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
    : mode === 'video' ? 'הסרטון בדרך, זה לוקח כ־3 דקות. אפשר לצאת ולחזור, הוא יחכה ב״מה יצרנו״.' : `מציירת ${doneCount ? 'את התמונה השנייה' : 'שתי תמונות'}…`;
  return (
    <div className="st-progress" role="status">
      <div className="st-progress-top"><span className="hand">{label}</span><b dir="ltr">{fmt(elapsed)}</b></div>
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

function GalleryCard({ c, onOpen }: { c: StudioCreation; onOpen: () => void }) {
  const first = c.items.find(i => i.status === 'done');
  const cover = first?.kind === 'video' ? first.poster : first?.url;
  const failed = c.items.every(i => i.status === 'failed');
  return (
    <button type="button" className="st-tile" onClick={onOpen}>
      {cover || c.thumb ? <img src={cover || c.thumb!} alt="" loading="lazy" /> : <span className="st-tile-blank" />}
      <span className={`st-tile-tag ${c.mode}`}><Icon name={c.mode === 'video' ? 'film' : 'image'} size={14} /> {c.mode === 'video' ? 'סרטון' : `${c.items.length} תמונות`}</span>
      {!allFinal(c) && <span className="st-tile-state">בדרך…</span>}
      {failed && <span className="st-tile-state bad">לא הצליח</span>}
    </button>
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
  const [wish, setWish] = useState('');
  const [error, setError] = useState('');
  const [run, setRun] = useState<{ id: string | null; startedAt: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: listRes } = useQuery({
    queryKey: ['studio'],
    queryFn: () => studioApi.list(),
    enabled: !!user?.isSuperAdmin,
    refetchInterval: q => (q.state.data?.data || []).some(c => !allFinal(c)) ? 8000 : false,
  });
  const creations = listRes?.data || [];

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

  async function go() {
    if (!photo) return;
    setError('');
    setRun({ id: null, startedAt: Date.now() });
    setTimeout(() => workRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    const res = await studioApi.create({ image: photo.image, thumb: photo.thumb, wish: wish.trim(), mode, build: reading?.build, description: reading?.description });
    if (!res.success || !res.data) {
      setRun(null);
      setError(res.error || 'משהו השתבש. אפשר לנסות שוב.');
      return;
    }
    qc.setQueryData(['studio', res.data.id], { success: true, data: res.data });
    setRun({ id: res.data.id, startedAt: Date.now() - 4000 });
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

                <button type="button" className="nb-btn st-go" onClick={go} disabled={readingBusy}>
                  <Icon name="sparkle" size={20} /> {mode === 'video' ? 'צרי סרטון' : 'צרי 2 תמונות'}
                </button>
                {!wish.trim() && !readingBusy && <p className="st-hint nb-muted">בלי בקשה? אבחר בעצמי את הרעיון הכי מתאים.</p>}
              </>
            )}

            {running && <Progress creation={current} startedAt={run!.startedAt} />}
          </div>
        </section>
      )}

      {error && (
        <div className="st-error" role="alert">
          <span>{error}</span>
          {photo && !run && <button type="button" className="nb-btn-ghost" onClick={go}><Icon name="refresh" size={18} /> לנסות שוב</button>}
        </div>
      )}

      {current && finished && (
        <section ref={doneRef} className="st-done">
          <Result creation={current} />
          {someFailed && (
            <div className="st-error" role="alert">
              <span>{failedAll ? 'היצירה לא הצליחה הפעם.' : 'אחת התמונות לא הצליחה.'}</span>
              <button type="button" className="nb-btn-ghost" onClick={go}><Icon name="refresh" size={18} /> לנסות שוב</button>
            </div>
          )}
          <div className="st-next">
            {!someFailed && <button type="button" className="nb-btn-ghost" onClick={go}><Icon name="refresh" size={18} /> עוד גרסה</button>}
            <button type="button" className="nb-btn-ghost" onClick={() => setRun(null)}><Icon name="edit" size={18} /> לשנות את הבקשה</button>
            <button type="button" className="nb-btn-ghost" onClick={reset}><Icon name="camera" size={18} /> תמונה חדשה</button>
          </div>
        </section>
      )}

      {creations.length > 0 && (
        <section className="st-gallery">
          <h2 className="nb-h2">מה יצרנו</h2>
          <div className="st-grid">
            {creations.map(c => <GalleryCard key={c.id} c={c} onOpen={() => setOpenId(c.id)} />)}
          </div>
        </section>
      )}

      {opened && (
        <div className="st-sheet" role="dialog" aria-modal="true" onClick={() => setOpenId(null)}>
          <div className="st-sheet-body nb-card" onClick={e => e.stopPropagation()}>
            <div className="st-sheet-head">
              <span className="hand">{opened.wish || opened.description || (opened.mode === 'video' ? 'סרטון' : 'תמונות')}</span>
              <button type="button" className="st-x" onClick={() => setOpenId(null)} aria-label="סגירה"><Icon name="close" /></button>
            </div>
            {allFinal(opened) ? <Result creation={opened} /> : <p className="nb-muted">עדיין בדרך…</p>}
            {opened.items.every(i => i.status === 'failed') && <p className="st-error">היצירה הזאת לא הצליחה.</p>}
            <button type="button" className="st-del" onClick={async () => { await studioApi.delete(opened.id); setOpenId(null); qc.invalidateQueries({ queryKey: ['studio'], exact: true }); }}>
              <Icon name="trash" size={16} /> הסרה מהרשימה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
