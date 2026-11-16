---
name: make-doing-game
description: Make (or change) a mini-game for a child in Start Doing (startdoing.co.il, the ABA therapy-center app) - a simple, proven, phone/tablet-friendly game that lives in the kid's games room (חדר המשחקים), personalised per kid (their name, their interests, optionally a character that looks like them), built as well as the Shlomiverse games (plan, concept picture first, painted art, real sounds, played as a phone before it is called done) but made for children in ABA therapy - calm, errorless, adult-led rewards. Use whenever Shlomi asks for a game for a kid / a child / a תלמיד in Start Doing, a game for the therapy center, a reward game, a routine game (shower, teeth, dressing), "make a game for <kid>", or to change one of these games.
argument-hint: "[kid] [idea, or 'you decide']"
---

# make-doing-game - games for the kids in Start Doing

Start Doing (`c:\workspace\aba\aba-boards`, read its `CLAUDE.md` first) is a Hebrew, RTL platform for ABA therapy
centres: a behaviour analyst (the admin), the therapists around a child and the child's parents. The children are
mostly 3-10, many on the autism spectrum or with ADHD. A Start Doing game is **a tool in the child's day**, played on a
tablet or a phone, usually with an adult beside them. **Reply to Shlomi in English; Hebrew only inside the game.**

This is the sister of the Shlomiverse `make-verse-game` skill (`~/.claude/skills/make-verse-game/` - read its
`rules.md` for the general craft; everything about the verse, its frame, stories, records, Backstage and
shlomiverse.com does NOT apply here). Same bar: plan first, show the look as a picture, painted art, real sounds,
a tutorial, and PLAY it as a phone before anyone sees it. Never skip a step.

## 0. Setup (every time, seconds)
- **The repo**: `c:\workspace\aba\aba-boards` (git root, branch `master`). Other sessions work here too: `git status`
  first, touch only your own files, **never commit or push unless Shlomi asks**. Never change `c:\workspace\BoostMind`
  (reading is fine).
- **The app**: `therapy-center-v2/` (React 19 + TS + Vite + react-query, the live `/therapy` since 2026-11-04). The old
  `therapy-center/` is `/therapy-classic` - don't build there.
- **Run it on mock data** (no server, no real kids): `cd therapy-center-v2 && npx vite --port 5199 --strictPort --host 127.0.0.1`,
  admin key `1234` (super admin `9999`). Mock data is `mock/mockCore.ts`. On real data: the server
  (`cd server && node index.js`, port 3001, prod Firestore - careful) plus a Vite proxy to it.
- **The makers - Start Doing's own keys** (`server/.env`; the one exception is sound effects, below; never print a key):
  `node scripts/games/make.mjs image <prompt.txt> <out> [flare|sunburst] [MEDIUM|HIGH] [WxH] [--ref a.jpg ...] [--transparent]`,
  `... sfx <prompt.txt> <out.mp3> <secs>`, `... loop ...`, `... voice "<Hebrew>" <out.mp3> [voiceId]`.
  - Every picture = OpenAI **gpt-image-2.5-flare** (default: scenes, props, icons, concept) or **gpt-image-2.5-sunburst**
    (the most exact: characters, poses, cover, title art - HIGH only for these). No other image model.
  - Every sound = ElevenLabs. **Voice lines** use Start Doing's key with **`eleven_v4` + the Hebrew library voice Zina**
    (`Tbj9UQjXon5RB9MPEyc2`, a warm young woman - make.mjs's default; v3 and the default English voices sounded foreign,
    Shlomi 2026-11-16). Write **niqqud** on every line, direct with `[warm, gentle, slow]` tags, and **transcribe every
    line back** (faster-whisper, audio decoded with ffmpeg to 16 kHz float32) - re-record or reword any that come out
    wrong (שָׂמִים came out "שמעים" twice; "מְסַבְּנִים אֶת הַגּוּף" fixed it). Captions match the words exactly. **Effects and loops**
    (`sfx` / `loop`) borrow Plaxzy's ElevenLabs key, because Start Doing's key has no sound-generation permission
    (Shlomi's OK, 2026-11-16). make.mjs finds that key by itself in `plaxzy-creator/.env.local`, else in the gcloud
    secret `MAKEGAME_ELEVENLABS_KEY`. ElevenLabs allows 5 requests at a time, so generate in batches of 4.
    Level everything with ffmpeg `loudnorm` (loops about -24, one-shots about -21, voice -18), mono 64k.
- **3D** (only when a game needs it): three.js pinned from jsDelivr, Blender at `C:\tools\blender-5.2\blender.exe`.
  Plaxzy's `plaxzy-studio/PROTOCOL.md` techniques (guide sheets, cutting sprites, walk cycles) are open to us as craft -
  but never its keys, its single-file/upload rules or `plaxzy-studio/tools/gen.js` (Plaxzy's keys).
- **Browser tests**: `playwright-core` from `C:/Users/shazb/plaxzy-creator/node_modules/playwright-core`, `channel: 'msedge'`.
- **Workshop** (prompts, raw paintings, tests, the reference photos): `c:\workspace\aba\game-assets\<game-id>\` -
  outside the repo. Nothing with a real child's face ever goes into git.

## 1. Where games live (the platform - already built)
| What | Where |
|---|---|
| The games list + each game's settings schema | `therapy-center-v2/src/games/registry.ts` (`GAMES`) |
| The game component | `therapy-center-v2/src/games/<Name>.tsx` + `<name>.css` (classes prefixed by the game) |
| Generic art / sounds (no child's likeness) | `therapy-center-v2/src/games/<game-id>/` (imported, bundled) |
| Component registration | `GAME_COMPONENTS` in `therapy-center-v2/src/pages/GamePage.tsx` |
| Which games a kid has + settings | `kids/{kidId}.games = [{ id, enabled, config }]` (saved through `PUT /kids/:kidId`) |
| Play state | `kidGames/{kidId}.{gameId}` - any bounded plain data; a lifetime tally under `stats` survives "reset" |
| Per-kid pictures (a character that looks like the child) | Firestore `kidGameAssets`, via `node scripts/games/kid-assets.mjs put <kidId> <gameId> <name> <file>`; the game reads them with `gamesApi.getAssets(kidId, gameId)` |
| The page | `/kid/:kidId/game/:gameId` (admin), `/t/:practitionerId/kid/...` (therapist), `/p/:kidId/game/...` (parent) |
| The games room | `/kid/:kidId/games` - every game for this kid, entered from the kid page's "משחקים" tile |
| A game he tests quietly first | `HIDDEN_GAMES` in `registry.ts`: works by direct link, listed nowhere. Release it = move the entry into `GAMES` |

**Adding a game = two steps**: the component (props `GameComponentProps`: `config`, `state`, `canEdit`, `onSaveState`,
`onSaveConfig`, `onExit`) registered in `GAME_COMPONENTS`, and its entry in `GAMES` with a `settings` schema. The
games room, the settings sheet (`GameSettingsSheet.tsx`) and the routes build themselves from that entry. No server
change is needed. Worked example: `games/LegoTower.tsx` (portal into `<body>` + `body.lego-open` for a true full
screen, sizes from the measured viewport, `useGameSound.ts`, settings behind a gear, `canEdit={!isParentView}`).

**Games never touch the board** (`tasks`, `completedTasks`, `totalMoney`, `dailyReward`) - a game is its own loop.

## 2. The child comes first
Read before any idea - the game must fit THIS child:
- The kid document (`kids/{kidId}`: `name`, `age`, `gender`, `kidDescription`, `behaviorGoals`), the kid's active
  **goals** (`goals` where `kidId`), recent session forms (reinforcers that work - `newReinforcers`, what is hard -
  `difficulties`) and the board's tasks. Read real data only through the server or Admin SDK, never paste it anywhere
  outside our own machines and keys.
- What Shlomi gave you (a photo, a visual schedule, the routine the family is working on). Ask what the game is FOR if
  it isn't clear: a skill to practise (a routine's order, waiting, a word) or a reward for real-world success.
- **Privacy of the child** (not optional): the child's photo and anything that looks like them stay out of git,
  `public/`, the bundle and every public URL - only `kidGameAssets` (served to the kid's own people). Never put the
  child's name or diagnosis into an image or sound prompt. A likeness is made only when Shlomi asks for one.

## 3. The idea - concepts as pictures, his pick
- 3-4 ideas, each one sentence: "<known simple game> + <what the child practises>". Clickable options
  (AskUserQuestion). **"You decide"** = pick, build, then show.
- **Start from a mechanic proven in simple phone/tablet games** for young children: drag-to-place / jigsaw, sort into
  bins, sequence cards, connect-the-dots, pop / tap targets, colour-in, a sticker scene, catch, memory pairs, a stacker
  (Stack), Flow-style connect, a simple runner... - a real loop that is fun by itself. No quizzes, no "pick the right
  answer" dialogue.
- **Taken in Start Doing** (offer none of these again unless he asks): stacking a tower one earned piece at a time
  (`lego-tower`); a routine done as a sticker scene - drag the glowing item onto the child, then rub the picture with
  it (`shower-steps`). Add each new game's mechanic to this line.
- **Offer the LOOK too, as pictures**: painted (gouache storybook - the default for a child's own character), 3D
  (Blender / three.js), pixel art, clay... He picks the look from concept pictures, not words. If he leaves it to you,
  choose the look that makes the child's character clearest and the screen calmest.
- **Super fun, super easy, super clear** (his words): every step has a small action that feels good - rub, pour,
  pop, wipe, stretch - with a sound and a visible change, never only "pick a card". Each action takes 3-5 seconds, can't
  fail, and finishes by itself if the child stops (a voice reminder first). Built from a game the child already knows,
  not from another Start Doing game.
- **The child's action carries the meaning**: a routine game makes the child DO the steps in order; a reward game makes
  the earned piece go somewhere satisfying. Watching is not playing.
- **Show a concept picture before building** (one picture of the game screen, `make.mjs image`, MEDIUM). He approves
  the look from a picture, not words. Write the decisions into `game-assets/<id>/idea.md` (his words first).

## 3b. The child's own character - a painted version of HIM
Shlomi's rule (2026-11-16): **"a painted version of him, not a look-alike."** A storybook kid who only resembles the
child is wrong. The recipe that worked (`game-assets/shower-steps/prompts/nevo2-*`):
1. **The base picture** - Sunburst HIGH, the photo as `--ref`, a prompt that starts: *"A soft hand-painted portrait
   (gouache / watercolour) of EXACTLY the boy in the reference photo. A painted version of the real child, not a cartoon
   and not a look-alike: keep his real face exactly - face shape, eyes, eyebrows, nose, mouth, smile, ears, skin tone,
   hair - with realistic proportions (no big cartoon eyes). Only the rendering changes."* Then the scene. Put his
   photo beside it and compare before going on.
2. **Every other pose is an EDIT of that base** - `--ref base.jpg --ref photo.jpg`, *"keep everything identical
   (scene, framing, the same real child), change only: ..."*. Same face, hair and size in every picture; regenerate any
   that drift.
3. Later, "completely similar" (as the Shlomiverse does for its people) is the next step up - ask him before.
- The **generic** character (for kids without their own pictures, and the mock) is a separate storybook child that
  resembles nobody, made from the same scene prompts.
- Check the child's set inside the game on the mock without uploading: in the Playwright test,
  `page.route('**/game-assets/<id>', r => r.fulfill({ body: JSON.stringify({ 'scene-0': dataUrl, ... }) }))` - the
  body is the raw `{ name: dataUrl }` (the client wraps it).

## 4. The plan
Before code, show in plain words: title, what the child does, who taps what (child / adult), how a round ends, what
the settings are (per kid), the look (the concept picture), the sounds and voice lines, the tutorial. Build on his go.

## 5. Build - the rules for children in ABA
Read `rules.md` in this folder (the ABA-specific rules) AND the Shlomiverse `rules.md` (general craft: phone first,
the play area is the screen, painted not drawn, sound that comes back on iPhone, test with real taps). The short of it:
1. **Errorless and kind**: no losing, no lives, no timers that punish, no buzzers or "wrong!" - a wrong move gently
   returns and the right place glows. Success is loud and happy; mistakes are quiet.
2. **Calm senses**: soft colours, no flashing, no sudden loud sounds, a sound switch remembered per kid (a setting),
   music off by default.
3. **No reading needed**: every instruction is a picture + a short Hebrew voice line (ElevenLabs), with the words on
   screen too, in the child's gender (`kid.gender`: "גרור" / "גררי").
4. **Big targets** (>= 64px on a phone, well apart), one thing to do at a time, nothing moving that the child didn't
   start. Works by touch first; a mouse is the same.
5. **The adult is in charge**: settings behind a gear only when `canEdit`; a reward step can need a long-press by the
   adult (`adultOnly`, like the tower). Parents get a playable game with settings locked.
6. **Per-kid settings in the schema**: what changes from child to child (number of steps, the prize, a theme, sound,
   adult-only) is a setting - never a fork of the game.
7. **Fits the app**: Hebrew RTL, the Design 2.0 notebook look where the game shows app chrome (`src/v2/notebook.css`:
   `--paper`, `--pen`, `--ink`, `tone-*`; fonts from the app), a clear exit back to the kid page (`onExit`).
   Full-screen games render through a portal like the tower.
8. **A test hook**: `window.<GAME_ID_UPPER> = { state, ... }` so tests read the game, not pixels.

## 6. The tutorial
Short and visual for a child: a hand shows the move once (an animated hand doing a real valid move), the voice says
it, then it waits for the child to do it - no text walls, no step counter. Replays from a "?" button. The adult's
settings sheet has one line per setting explaining it.

## 7. Check - play it until it is good
- Play it as a child with Playwright on the mock app: the tutorial, a whole round with real taps, wrong moves on
  purpose, the end. Screenshots you READ.
- Sizes: 320x568, 390x844, 412x915 upright, a tablet (820x1180 and 1180x820 landscape) - tablets matter here.
  Nothing overflows, nothing under the thumbs, every button reachable.
- In all three views (admin, therapist `/t/...`, parent `/p/...`): settings locked for the parent.
- With and without per-kid pictures (the mock has none - the game must still look right).
- Then show him: the local link and two or three screenshots.

## 8. Live - on his word
- Turn it on for the kid: `kids/{kidId}.games` gets `{ id, enabled: true, config }` (from the games room / settings
  sheet in the app, or a one-off Admin SDK script).
- Per-kid pictures: `node scripts/games/kid-assets.mjs put ...` (check them with `list`).
- Deploy: client only = `node deploy.js` from `aba-boards/` (Firebase Hosting); a server change = `bash deploy.sh` in
  `server/` (Cloud Run - it prints "Deployment complete!" even on failure: look for ERROR). Claude has standing
  permission to deploy once verified; never commit/push unasked.
- Verify live on a phone size: open the kid's game on startdoing.co.il and play a round.

## 9. Remember it
A memory note for the game (where it is, its settings, which kid has it, how to update it), and any general lesson as
a line in `rules.md` here.

## Changing a game later
Read its `idea.md` and memory note, change it, play it on the mock app at all sizes, show him, then step 8 on his word.
