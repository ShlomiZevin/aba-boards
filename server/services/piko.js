// Piko — Shlomi's picture / video API on the Shlomiverse (https://shlomiverse.com/piko/api).
// Every call goes from this server with PIKO_API_KEY; the browser never talks to Piko.
// Jobs are async: create → poll GET /jobs/:id until done | failed. Docs: https://shlomiverse.com/piko/api/docs

const BASE = process.env.PIKO_BASE_URL || 'https://shlomiverse.com/piko/api';

class PikoError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

// What Michal sees for each Piko error code.
const FRIENDLY = {
  auth: 'החיבור לשירות התמונות לא מוגדר נכון. צריך לבדוק את המפתח.',
  balance: 'נגמר הקרדיט לסרטונים. צריך להטעין קרדיט ב־Piko ואז לנסות שוב.',
  prompt: 'לא הצלחתי להבין מה ליצור. נסי לכתוב את הבקשה קצת אחרת.',
  image: 'לא הצלחתי לקרוא את התמונה. נסי תמונה אחרת.',
  too_many_refs: 'יותר מדי תמונות בבת אחת.',
  end_needs_start: 'חסרה תמונת פתיחה לסרטון.',
  image_too_big: 'התמונה גדולה מדי. נסי תמונה קטנה יותר.',
  too_many: 'יש כרגע יותר מדי בקשות. נסי שוב בעוד דקה.',
  failed: 'היצירה לא הצליחה הפעם. אפשר לנסות שוב.',
  timeout: 'זה לוקח יותר מהרגיל. אפשר לנסות שוב.',
  network: 'אין חיבור לשירות התמונות כרגע. נסי שוב בעוד רגע.',
};

function friendly(code) {
  return FRIENDLY[code] || FRIENDLY.failed;
}

function configured() {
  return !!process.env.PIKO_API_KEY;
}

async function call(method, path, body) {
  if (!configured()) throw new PikoError(500, 'auth', 'PIKO_API_KEY is not set');
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        Authorization: `Key ${process.env.PIKO_API_KEY}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new PikoError(502, 'network', err.message);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
  if (!res.ok) {
    const code = data?.error || (res.status === 401 ? 'auth' : res.status === 402 ? 'balance' : res.status === 413 ? 'image_too_big' : res.status === 429 ? 'too_many' : 'failed');
    throw new PikoError(res.status, code, `Piko ${method} ${path} → ${res.status} ${code}`);
  }
  return data;
}

// Pictures (GPT Image 2.5). Returns the job list (one per count).
async function createImages({ prompt, refs = [], model = 'flare', size = 'story', quality = 'low', count = 1 }) {
  const data = await call('POST', '/images', { prompt, refs, model, size, quality, count });
  return data?.jobs || [data];
}

// Videos (Seedance 2.0 Mini, always with sound). `start` is the first frame.
async function createVideo({ prompt, start, end, duration = 6, quality = '480p', ratio = '9:16' }) {
  return call('POST', '/videos', { prompt, start, ...(end ? { end } : {}), duration, quality, ratio });
}

// A fresh look at a job; done jobs carry a fresh 6-hour signed url each time.
async function getJob(id) {
  return call('GET', `/jobs/${encodeURIComponent(id)}`);
}

// Polls until done | failed (or timeout). onTick gets each job snapshot.
async function waitForJob(id, { intervalMs = 4000, timeoutMs = 5 * 60 * 1000, onTick } = {}) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const job = await getJob(id);
    onTick?.(job);
    if (job.status === 'done') return job;
    if (job.status === 'failed') throw new PikoError(500, 'failed', job.error || 'job failed');
    if (Date.now() > until) throw new PikoError(504, 'timeout');
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

// Voice → text. mode 'video' gives an English prompt, 'image' the spoken language.
async function transcribe({ audio, mime, mode = 'video', hasStart = false, hasEnd = false, refs = 0, language = 'he' }) {
  return call('POST', '/transcribe', { audio, mime, mode, hasStart, hasEnd, refs, language });
}

const getBalance = () => call('GET', '/balance');
const getConfig = () => call('GET', '/config');

module.exports = {
  PikoError, friendly, configured,
  createImages, createVideo, getJob, waitForJob, transcribe, getBalance, getConfig,
};
