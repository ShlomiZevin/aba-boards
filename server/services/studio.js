// סטודיו — Michal's (super admin) picture / video maker for the kids' builds.
// She shares a photo (kids next to what they built from magnets, Lego...) and says or writes a wish.
// Claude looks at the photo, suggests ideas and writes the final prompt; Piko makes the media.
// Settings are fixed here, she never chooses them:
//   pictures → two at once: flare + sunburst, medium quality, story 9:16
//   video    → 6 s, 480p, 9:16, with sound, the photo is the first frame.
//              The one choice she has: 'fast' (faithful faces, the default) or 'mini' (cheap draft).
//
// Firestore: studioCreations/{id} = { adminId, mode, wish, prompt, description, thumb, items[], usd, createdAt, updatedAt }
//   items[] = { jobId, kind: 'image'|'video', model, status (queued → working → running → saving → done | failed), progress, url, poster, urlAt, w, h, dur, usd, error }
// Files stay on Piko; a done item's 6-hour url is refreshed from GET /jobs/:id when it gets old.

const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./firebase');
const piko = require('./piko');

const MODEL = 'claude-sonnet-5-5';
const COLLECTION = 'studioCreations';
const URL_TTL_MS = 5 * 60 * 60 * 1000; // Piko links live 6 h; refresh after 5
const MAX_IMAGE = 12 * 1024 * 1024;

const IMAGE_SETUP = { models: ['flare', 'sunburst'], size: 'story', quality: 'medium' };
const VIDEO_SETUP = { duration: 6, quality: '480p', ratio: '9:16' };
const VIDEO_MODELS = ['fast', 'mini'];
const DEFAULT_VIDEO_MODEL = 'fast';

class StudioError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

let client = null;
const claude = () => (client ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

function parseImage(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new StudioError(400, 'צריך לצרף תמונה');
  if (m[2].length * 0.75 > MAX_IMAGE) throw new StudioError(413, piko.friendly('image_too_big'));
  return { mediaType: m[1], data: m[2] };
}

function parseJson(text) {
  const m = /\{[\s\S]*\}/.exec(text || '');
  if (!m) throw new Error('no JSON in model reply');
  return JSON.parse(m[0]);
}

async function askClaude(image, instructions, maxTokens = 1500) {
  const { mediaType, data } = parseImage(image);
  const res = await claude().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
        { type: 'text', text: instructions },
      ],
    }],
  });
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  console.log(`[studio] claude ${res.usage?.input_tokens}in/${res.usage?.output_tokens}out`);
  return parseJson(text);
}

const CONTEXT = `The photo comes from an ABA therapy center for young children. The therapist (Michal) photographs
the kids with things they built themselves (magnet tiles, Lego, blocks, cardboard...) and turns the photo into a short
magical video or picture as a reward for the kids: the build comes alive and does what it is meant to do
(a hot-air balloon flies with the kids in its basket, a ship sails at sea, a rocket launches, a house becomes a real house...).`;

// Look at the photo: what is in it + ideas she can tap.
async function understand(image) {
  const out = await askClaude(image, `${CONTEXT}

Look at the photo and answer ONLY with JSON:
{
  "description": "<one short Hebrew sentence: who is in the photo and what they built, e.g. 'שני ילדים ליד כדור פורח שבנו ממגנטים'>",
  "build": "<English: exactly what the build is, its shape, colours and material>",
  "video": ["<3 short Hebrew wishes for a 6-second video, written as Michal would ask, each under 12 words>"],
  "images": ["<3 short Hebrew wishes for a picture, each under 12 words>"]
}
The first idea of each list is the most natural one: the kids get into / onto the build and it does its job for real.
Keep everything joyful, gentle and safe for small children.`);
  return {
    description: String(out.description || ''),
    build: String(out.build || ''),
    ideas: {
      video: (out.video || []).slice(0, 3).map(String),
      images: (out.images || []).slice(0, 3).map(String),
    },
  };
}

const HEBREW = /[֐-׿]/;

// Always added to the end of every prompt, whatever Claude wrote: the photos are almost always
// of kids, and Michal wants them to recognise themselves in the result.
const FACES = 'Keep every person\'s face identical to the reference photo: same facial features, face shape, '
  + 'eyes, nose, mouth, skin tone, hair and age, so each child is clearly recognisable as themselves. '
  + 'Do not change, beautify, swap or stylise any face; faces stay consistent in every frame.';

// Turn her wish (Hebrew, maybe spoken) + the photo into the prompt Piko gets.
// The prompt is always English: the video model reads only English, so a video prompt
// with any Hebrew left in it is never sent (one more try, then an error).
async function composePrompt(image, opts, attempt = 1) {
  const prompt = await writePrompt(image, opts, attempt > 1);
  if (HEBREW.test(prompt)) {
    console.warn(`[studio] prompt had Hebrew (attempt ${attempt})`);
    if (attempt < 2) return composePrompt(image, opts, attempt + 1);
    if (opts.mode === 'video') throw new StudioError(500, piko.friendly('prompt'));
  }
  return `${prompt} ${FACES}`;
}

async function writePrompt(image, { mode, wish, build }, strict) {
  const isVideo = mode === 'video';
  const out = await askClaude(image, `${CONTEXT}

Michal's wish (may be empty, then pick the most natural magical idea yourself): "${wish || ''}"
${build ? `The build in the photo: ${build}` : ''}

Write the prompt for ${isVideo
    ? 'an image-to-video model. This photo is the FIRST FRAME of a 6-second vertical video with sound.'
    : 'an image model that gets this photo as a reference and makes a new vertical 9:16 picture.'}
Rules:
- English ONLY, 60-110 words, concrete and visual. Translate the wish; no Hebrew word or letter may remain.${strict ? ' Your previous answer contained Hebrew: write it entirely in English.' : ''}
- Keep the children exactly as they are in the photo: the same faces (this matters most, they must be recognisable), hair and clothes. Keep the build's exact shape, colours and material, now real and working.
- Prefer scenes where the faces stay visible and fairly close to the camera, with no fast turns, no masks or helmets covering the face.
${isVideo
    ? '- Describe the motion over the 6 seconds in order, the camera move, and the sound: cheerful music and matching sound effects, the kids laughing; no spoken words.'
    : '- Describe the scene, the kids\' happy expressions, the light and a bright storybook-photo look.'}
- Joyful, gentle, safe for small children. No text or letters in the image.
Answer ONLY with JSON: { "prompt": "..." }`, 1500);
  const prompt = String(out.prompt || '').trim();
  if (!prompt) throw new StudioError(500, piko.friendly('prompt'));
  return prompt;
}

const toIso = (v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v || null);

function serialize(id, d) {
  return {
    id, mode: d.mode, wish: d.wish || '', prompt: d.prompt || '', description: d.description || '',
    thumb: d.thumb || null, usd: d.usd || 0, createdAt: toIso(d.createdAt),
    items: (d.items || []).map(i => ({
      jobId: i.jobId, kind: i.kind, model: i.model || null, status: i.status,
      url: i.url || null, poster: i.poster || null, w: i.w || null, h: i.h || null, dur: i.dur || null,
      progress: i.progress || 0, usd: i.usd || 0, error: i.error || null,
    })),
  };
}

const isFinal = (s) => s === 'done' || s === 'failed';

async function create(req, { image, thumb, wish, mode, build, description, videoModel }) {
  if (mode !== 'video' && mode !== 'images') throw new StudioError(400, 'mode must be video or images');
  const model = VIDEO_MODELS.includes(videoModel) ? videoModel : DEFAULT_VIDEO_MODEL;
  if (!piko.configured()) throw new StudioError(500, piko.friendly('auth'));
  parseImage(image);
  const cleanWish = String(wish || '').slice(0, 1000).trim();
  const prompt = await composePrompt(image, { mode, wish: cleanWish, build: String(build || '').slice(0, 500) });

  let items;
  if (mode === 'video') {
    const job = await piko.createVideo({ prompt, start: image, model, ...VIDEO_SETUP });
    items = [{ jobId: job.id, kind: 'video', model: job.params?.model || model, status: job.status || 'queued' }];
  } else {
    const batches = await Promise.all(IMAGE_SETUP.models.map(model =>
      piko.createImages({ prompt, refs: [image], model, size: IMAGE_SETUP.size, quality: IMAGE_SETUP.quality, count: 1 })
        .then(jobs => jobs.map(j => ({ jobId: j.id, kind: 'image', model, status: j.status || 'queued' })))));
    items = batches.flat();
  }

  const id = uuidv4();
  const now = new Date();
  const doc = {
    adminId: req.adminId, mode, wish: cleanWish, prompt, description: String(description || '').slice(0, 300),
    thumb: typeof thumb === 'string' && thumb.length < 120 * 1024 ? thumb : null,
    items, usd: 0, createdAt: now, updatedAt: now,
  };
  await getDb().collection(COLLECTION).doc(id).set(doc);
  console.log(`[studio] ${id} ${mode} started: ${items.map(i => `${i.model}:${i.jobId}`).join(', ')}`);
  return serialize(id, doc);
}

// Brings unfinished items up to date and renews old links. Saves only when something changed.
async function refresh(id, d) {
  let changed = false;
  const items = await Promise.all((d.items || []).map(async (item) => {
    const stale = item.status === 'done' && (!item.urlAt || Date.now() - item.urlAt > URL_TTL_MS);
    if (isFinal(item.status) && !stale) return item;
    try {
      const job = await piko.getJob(item.jobId);
      const next = { ...item, status: job.status, progress: job.progress || 0 };
      if (job.status === 'done') {
        Object.assign(next, { url: job.url, poster: job.poster || null, urlAt: Date.now(), w: job.w || null, h: job.h || null, dur: job.dur || null, usd: job.usd || item.usd || 0 });
        if (item.status !== 'done') console.log(`[studio] ${id} ${item.model}:${item.jobId} done usd=${next.usd}`);
      } else if (job.status === 'failed') {
        next.error = piko.friendly('failed');
        console.log(`[studio] ${id} ${item.model}:${item.jobId} failed: ${job.error || ''}`);
      }
      if (next.status !== item.status || next.url !== item.url || next.progress !== item.progress) changed = true;
      return next;
    } catch (err) {
      console.error(`[studio] refresh ${item.jobId}:`, err.message);
      return item;
    }
  }));
  if (!changed) return d;
  const usd = Math.round(items.reduce((s, i) => s + (i.usd || 0), 0) * 10000) / 10000;
  const next = { ...d, items, usd, updatedAt: new Date() };
  await getDb().collection(COLLECTION).doc(id).update({ items, usd, updatedAt: next.updatedAt });
  if (items.every(i => isFinal(i.status))) console.log(`[studio] ${id} ${d.mode} finished, total usd=${usd}`);
  return next;
}

async function getOwned(req, id) {
  const snap = await getDb().collection(COLLECTION).doc(id).get();
  if (!snap.exists || snap.data().adminId !== req.adminId) throw new StudioError(404, 'היצירה לא נמצאה');
  return snap;
}

async function get(req, id) {
  const snap = await getOwned(req, id);
  return serialize(id, await refresh(id, snap.data()));
}

async function list(req) {
  const snap = await getDb().collection(COLLECTION).where('adminId', '==', req.adminId).get();
  const docs = snap.docs
    .map(s => ({ id: s.id, d: s.data() }))
    .sort((a, b) => (toIso(b.d.createdAt) || '').localeCompare(toIso(a.d.createdAt) || ''))
    .slice(0, 40);
  const fresh = await Promise.all(docs.map(({ id, d }) => refresh(id, d).then(nd => serialize(id, nd))));
  return fresh;
}

// The finished file itself, through this server: Piko's storage links don't allow the browser to
// fetch them, and the phone needs the bytes to offer "save to Photos".
async function file(req, id, jobId) {
  const snap = await getOwned(req, id);
  const d = await refresh(id, snap.data());
  const item = (d.items || []).find(i => i.jobId === jobId && i.status === 'done' && i.url);
  if (!item) throw new StudioError(404, 'הקובץ לא נמצא');
  const res = await fetch(item.url);
  if (!res.ok) throw new StudioError(502, piko.friendly('network'));
  return { res, kind: item.kind };
}

async function remove(req, id) {
  const snap = await getOwned(req, id);
  await snap.ref.delete();
}

async function transcribe({ audio, mime, mode }) {
  if (!audio || !mime) throw new StudioError(400, 'חסרה הקלטה');
  const out = await piko.transcribe({ audio, mime, mode: mode === 'video' ? 'video' : 'image', hasStart: mode === 'video', refs: mode === 'video' ? 0 : 1 });
  return { text: out?.text || '' };
}

async function balance() {
  return piko.getBalance();
}

// The two video choices with today's price for our fixed setup, read from Piko's GET /config (never hardcoded).
let optionsCache = null;
async function options() {
  if (optionsCache && Date.now() - optionsCache.at < 10 * 60 * 1000) return optionsCache.data;
  const cfg = await piko.getConfig();
  const models = (cfg?.video?.models || []).filter(m => VIDEO_MODELS.includes(m.id));
  const data = {
    defaultVideoModel: DEFAULT_VIDEO_MODEL,
    video: VIDEO_MODELS.map(id => {
      const m = models.find(x => x.id === id);
      const perSec = m?.usdPerSecond?.[VIDEO_SETUP.quality];
      return { id, usd: perSec ? Math.round(perSec * VIDEO_SETUP.duration * 100) / 100 : null };
    }),
  };
  optionsCache = { at: Date.now(), data };
  return data;
}

module.exports = { StudioError, understand, composePrompt, create, get, list, file, remove, transcribe, balance, options, IMAGE_SETUP, VIDEO_SETUP };
