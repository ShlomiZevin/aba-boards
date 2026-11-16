// Per-kid game pictures (a character drawn to look like the child, one picture per step...).
// They go to Firestore `kidGameAssets`, served only to the kid's own people through
// GET /api/therapy/kids/:kidId/game-assets/:gameId - never into git, public/ or the bundle.
//
//   node scripts/games/kid-assets.mjs put  <kidId> <gameId> <name> <file.jpg|png|webp>
//   node scripts/games/kid-assets.mjs list <kidId> <gameId>
//   node scripts/games/kid-assets.mjs rm   <kidId> <gameId> <name|--all>
//
// Keep each picture small (webp/jpg at the size shown, ~100-300 KB); the limit is 900 KB.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const { getDb } = require(path.join(ROOT, 'server', 'services', 'firebase'));

const [cmd, kidId, gameId, name, file] = process.argv.slice(2);
const NAME_RE = /^[a-z0-9-]{1,40}$/;
if (!kidId || !NAME_RE.test(gameId || '')) {
  console.error('usage: put <kidId> <gameId> <name> <file> | list <kidId> <gameId> | rm <kidId> <gameId> <name|--all>');
  process.exit(1);
}
const db = getDb();
const col = db.collection('kidGameAssets');
const id = (n) => `${kidId}__${gameId}__${n}`;

async function main() {
  if (!(await db.collection('kids').doc(kidId).get()).exists) throw new Error(`no kid ${kidId}`);
  if (cmd === 'put') {
    if (!NAME_RE.test(name || '')) throw new Error('name: a-z 0-9 - only');
    const buf = fs.readFileSync(file);
    if (buf.length > 900 * 1024) throw new Error(`${file} is ${Math.round(buf.length / 1024)} KB - make it smaller (max 900 KB)`);
    const type = /\.png$/i.test(file) ? 'image/png' : /\.webp$/i.test(file) ? 'image/webp' : 'image/jpeg';
    await col.doc(id(name)).set({ kidId, gameId, name, data: `data:${type};base64,${buf.toString('base64')}`, updatedAt: new Date() });
    console.log(`put ${name} (${Math.round(buf.length / 1024)} KB)`);
  } else if (cmd === 'list') {
    const snap = await col.where('kidId', '==', kidId).where('gameId', '==', gameId).get();
    snap.docs.forEach((d) => console.log(d.data().name, Math.round(d.data().data.length * 0.75 / 1024) + ' KB'));
    if (snap.empty) console.log('(none)');
  } else if (cmd === 'rm') {
    const snap = name === '--all'
      ? await col.where('kidId', '==', kidId).where('gameId', '==', gameId).get()
      : { docs: [col.doc(id(name))].map((ref) => ({ ref })) };
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    console.log('removed');
  } else throw new Error('unknown command');
  process.exit(0);
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
