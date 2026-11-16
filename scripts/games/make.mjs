// Start Doing game makers: pictures (OpenAI GPT Image 2.5), sound effects / loops and
// Hebrew voice lines (ElevenLabs). Uses Start Doing's own keys from server/.env -
// never another project's key, never printed.
//
//   node scripts/games/make.mjs image <prompt.txt> <out.jpg|png> [flare|sunburst] [MEDIUM|HIGH] [WxH] [--ref a.jpg --ref b.png]
//   node scripts/games/make.mjs sfx   <prompt.txt> <out.mp3> <secs>
//   node scripts/games/make.mjs loop  <prompt.txt> <out.mp3> <secs>
//   node scripts/games/make.mjs voice "<Hebrew text>" <out.mp3> [voiceId]
//
// flare = default (scenes, props, icons, concept picture); sunburst = most exact
// (characters, poses, cover, title art) - HIGH only for those.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, 'server', '.env'), 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')])
);
const OPENAI = env.OPENAI_API_KEY;
const ELEVEN = env.ELEVENLABS_API_KEY;

const [cmd, ...rest] = process.argv.slice(2);
const refs = [];
const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--ref') refs.push(rest[++i]);
  else args.push(rest[i]);
}

function save(out, buf) {
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, buf);
  console.log(`saved ${out} (${Math.round(buf.length / 1024)} KB)`);
}

async function image([promptFile, out, model = 'flare', quality = 'MEDIUM', size = '1024x1024']) {
  if (!OPENAI) throw new Error('OPENAI_API_KEY missing in server/.env');
  if (!['flare', 'sunburst'].includes(model)) throw new Error('model must be flare or sunburst');
  const [w, h] = size.split('x').map(Number);
  const r16 = (x) => Math.max(16, Math.round(x / 16) * 16);
  const fields = {
    model: 'gpt-image-2.5-' + model, prompt: fs.readFileSync(promptFile, 'utf8').trim(),
    size: `${r16(w)}x${r16(h)}`, quality: quality.toLowerCase(), n: 1,
  };
  const png = /\.png$/i.test(out);
  fields.output_format = png ? 'png' : 'jpeg';
  if (png && process.argv.includes('--transparent')) fields.background = 'transparent';
  if (!png) fields.output_compression = 90;
  const auth = { authorization: `Bearer ${OPENAI}` };
  let res;
  if (refs.length) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
    for (const r of refs) {
      const type = /\.png$/i.test(r) ? 'image/png' : /\.webp$/i.test(r) ? 'image/webp' : 'image/jpeg';
      form.append('image[]', new Blob([fs.readFileSync(r)], { type }), path.basename(r));
    }
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: auth, body: form });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify(fields),
    });
  }
  const j = await res.json().catch(() => null);
  const b64 = j?.data?.[0]?.b64_json;
  if (!res.ok || !b64) throw new Error(j?.error?.message || `HTTP ${res.status}`);
  save(out, Buffer.from(b64, 'base64'));
}

// Start Doing's ElevenLabs key has no sound-generation permission, so sound EFFECTS
// borrow Plaxzy's ElevenLabs key (Shlomi's OK, 2026-11-16). Voice lines stay on
// Start Doing's own key. The key is read, never printed.
async function plaxzyElevenKey() {
  const local = path.join(process.env.USERPROFILE || process.env.HOME || '', 'plaxzy-creator', '.env.local');
  if (fs.existsSync(local)) {
    const m = fs.readFileSync(local, 'utf8').match(/^ELEVENLABS_API_KEY=(.*)$/m);
    if (m && m[1].trim()) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  const { execSync } = await import('node:child_process');
  try {
    return execSync('gcloud secrets versions access latest --secret=MAKEGAME_ELEVENLABS_KEY --project=plaxzy12',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 }).trim() || null;
  } catch { return null; }
}

async function sfx([promptFile, out, secs = '1.5'], loop) {
  const key = await plaxzyElevenKey();
  if (!key) throw new Error('no Plaxzy ElevenLabs key found (plaxzy-creator/.env.local or gcloud secret)');
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: fs.readFileSync(promptFile, 'utf8').trim(), model_id: 'eleven_text_to_sound_v2',
      duration_seconds: Math.max(0.5, Math.min(30, Number(secs))), prompt_influence: 0.7, loop,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  save(out, Buffer.from(await res.arrayBuffer()));
}

async function voice([text, out, voiceId = 'EXAVITQu4vr4xnSDxMaL']) {
  if (!ELEVEN) throw new Error('ELEVENLABS_API_KEY missing in server/.env');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': ELEVEN, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_v3', language_code: 'he' }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  save(out, Buffer.from(await res.arrayBuffer()));
}

const run = { image, sfx: (a) => sfx(a, false), loop: (a) => sfx(a, true), voice }[cmd];
if (!run) {
  console.error('commands: image | sfx | loop | voice  (see the top of this file)');
  process.exit(1);
}
run(args).catch((e) => { console.error(String(e.message || e)); process.exit(1); });
