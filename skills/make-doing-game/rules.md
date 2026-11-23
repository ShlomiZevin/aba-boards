# Build rules for Start Doing games (children in ABA therapy)

The general craft (phone first, the play area is the screen, painted not drawn, sound on iPhone, real-tap tests) is
in the Shlomiverse rules: `~/.claude/skills/make-verse-game/rules.md`. These are the rules that are different, or
extra, because the players are young children in ABA therapy. Add a principle here whenever a round teaches one.

## The child
- **Errorless, not silent**: no lives, no game over, no score that goes down, never a buzzer or a red "wrong!" screen -
  but a miss is always SHOWN clearly (the piece shakes, a calm badge, a gentle sound) and the right target glows or a
  hand shows it. Clear feedback is the point for autistic children; a mistake that "does nothing" confuses them.
- **Predictable**: the same screen layout every round, the same sounds for the same events, nothing surprising.
  A change of scene is announced (a voice line) before it happens.
- **One step at a time**: one target active, the rest dimmed. Never two things moving that the child didn't start.
- **Short rounds** (1-3 minutes) with a clear end: a celebration, then a calm end screen with "שוב" and "סיימתי".
- **Real-world first**: in a reward game the game moves only when the adult gives a piece for real success. The game
  is the reinforcer, not the task.

## Senses
- Soft palette, no strobe or fast flicker, animations gentle (prefers-reduced-motion respected).
- Sounds soft and short; the success sound can be bigger. Volume levelled across all sounds. A remembered sound switch.
- Voice lines: warm, slow, short (3-6 words), in the child's grammatical gender, the words also on screen.

## Hands
- Targets >= 64px on a phone, >= 16px apart; drag needs a generous drop zone (snap within ~40% of the piece size).
- A drag that is dropped anywhere wrong returns home - never lost off screen.
- Works with a whole palm on a tablet: ignore extra touches during a drag.

## Adults
- Settings behind a gear, only when `canEdit` (admins, therapists). Parents play with settings locked.
- Anything that gives a reward can be adult-only (long-press), so the child can't farm it.
- The settings sheet speaks to the adult in one plain line per setting.

## Pictures of a real child
- A character that looks like the child is made only on Shlomi's ask, from the photo he gives, with
  `gpt-image-2.6-sunburst` HIGH and the photo as `--ref`. Same face, hair and clothes in every picture - compare every
  pose with the photo and regenerate any that drift (a visual schedule's steps 4-5 drifted once).
- Bath / shower / dressing steps: the child is always modestly covered (a towel, foam, the shower curtain, shown from
  the shoulders up) - never undressed in a picture.
- Those pictures live only in `kidGameAssets` (kid-scoped) and the workshop folder outside git. The game must also
  look right with generic art when there are none (the mock app has none).

## Learnt on shower-steps (2026-11-16)
- **A routine game = choose, then do**: choosing the next item is the sequencing practice, and a short rub/pour/wipe
  action with it is the fun. Rub-to-reveal (the current picture on a canvas over the next one, the finger wipes it
  away with `destination-out`) works for any "before -> after" step. Progress comes from rubbing distance, not pixel
  counting, so it is predictable.
- **Never stall**: an action the child stops gets a voice reminder after ~5s and finishes slowly by itself after ~9s.
- **Where the child's face is, nothing rests**: a waiting tool or hint sits on the chest or the side, never on the face.
- **Announce the end** before it comes ("עוד רגע מסיימים" with two bubbles left): transitions are hard for these kids.
- **Captions sit above every layer** (z-index over canvases and bubbles), or they vanish exactly when they matter.
- **Bubbles and floating targets stay fully on the picture**: clamp each centre by half its own size.
- **Never cross-fade or wipe between two paintings of the child**: no two generated pictures line up exactly, so a fade or
  reveal shows two faces ("double eyes" - Shlomi, 2026-11-16). Change the picture in one cut behind a cover (a soft
  bubble cloud, ~0.3s in, ~0.6s out). Rubbing paints only the effect (foam, drops, sparkles) on top of the one picture.
  A true morph would need the character rigged (Blender / a 2D puppet) - ask before going there.

## Learnt on challenge-room (2026-11-23, his play-tests)
- **Upright phone, always** ("why are you doing it wide? regular format, like holding the mobile vertically"): every game
  is laid out for a phone held upright; on a computer it is a phone-shaped column in the middle (width
  `min(100%, 100dvh * 0.5625)`), on a phone held sideways a "turn the phone" card.
- **The play pieces take the screen** ("the pod should take a large amount of the screen") - 2x2 quadrants, each piece
  ~95% of its cell's width.
- **Ask before explaining**: before a game, "רוצה לראות הסבר?" with two big buttons ("כן, להסביר" / "לא, לשחק!") - never
  run a demo by itself. The explanation = the voice lines, then the demo hand plays a short round.
- **The demo hand comes from the bottom of the phone**, fingertip up, landing exactly on the target's centre, and leaves
  after its tap (a hand from above, pointing down, "doesn't look good").
- **"On" is the same picture filling with colour**: a lit piece keeps its own lines (make a mask from the picture's own
  ridges/edges with a high-pass filter) and its face fills with the colour - never a second, different picture.
- **Faster than you think** ("make it more challenging, more fast"): a level 1 that feels calm to an adult is slow for
  the child. Short gaps (0.3-0.8 s), short showings, more trials; levels that speed up.
- **Feedback lives on the piece** (his note: "not a different emoji - just the fingerprint highlighted with the colour glowing"): right = green glow + bounce, wrong = red glow + shake. Badges, check-mark stickers, outline rings and confetti over the pads were all rejected ("the green inside the fingerprint is enough") - confetti only on the end screen. The lit look copies the menu icons (deep colour, bright thick lines, glossy shine) - compare a crop of the game with the icon side by side.
- **Success must be FUN**: the target glows and bounces, confetti + a ring, the target bounces, the counter
  jumps, a streak shows from 3 in a row ("x3") and the success sound climbs a little higher with each one in a row. Joyful,
  never loud (effects about -18 LUFS, the voice -18).
- **Simon is cumulative**: one sequence that grows by one light after each right answer (A, AB, ABC...) until a
  mistake - not a new random sequence each time. Measure the span; say "new record" when the child passes their best.
- **No flicker on entering**: decode every picture before the game shows (fade in when ready), let the game page wait on
  the game's own colour (`bg` in the registry entry), and give each screen a short fade-in.
- **iPhone silent switch**: Web Audio obeys it, an <audio> voice does not - set `navigator.audioSession.type = 'playback'`
  in the first tap, or effects are silent while the voice talks.
- **RTL and effects**: absolutely positioned effects inside an RTL container land on the wrong side - give effect layers
  `direction: ltr`.
- **A measuring game**: the scoring engine has no React, runs on its own clock and is fast-forwarded by scripted players
  in tests (perfect / impulsive / passive / early / double press / pause). Scripted players must react like a child
  (>= 300 ms) - faster presses are rightly counted as "too early".
- **Menus rejected twice (2026-11-23) - why, and the method that fixes it**: (1) the design had decorative leaves,
  ribbon banners and badge plaques ("why the leaves? it's stupid", "very simple, like a PowerPoint"); (2) the build was
  re-assembled from cut pieces and CSS and looked nothing like the design. The method now: a DESIGNER sub-agent paints 3
  home directions to a premium kids-game bar and picks; then every menu screen is painted final (1024x1536, sunburst
  HIGH); for each screen a PLATE = the same painting with only the changing text removed; `layout.json` = measured
  boxes (% of the canvas) of every button and changing text; the code shows the plate as the screen and lays only
  hit areas + changing text on the boxes. Then the build is screenshotted next to the design and fixed until they match.
  Never rebuild a painted design out of generic pieces.
- **Menus are designed too** (his rule: "have designs per menus, not only the screens - a real, super impressive game"): GPT paints 3 main-menu directions from the game's art, he picks, then GPT designs every other menu in that style, then blank pieces are painted + measured (`pieces.json` faces) and the code lays words/icons on the faces. No decorative leaves/laurels ("stupid").
- **"Put it live" for a new game** = in `GAMES` (every games room shows it to admins / therapists), switched on for no kid
  until he says so - parents see nothing.
- **Levels must be visible and reachable** (his question: "why is everything level 1? how do I reach level 2?"): every
  level has a name; the rule to pass a round is written for adults (`PASS_RULE`); N passed rounds IN A ROW at the same
  level (stopped / invalid rounds don't count) raise the level BY ITSELF by default (an adult switch turns it into
  "the adult approves"). The child's end screen says where it stands in one big line ("עלית לרמה 2!" /
  "עוד סבב מוצלח אחד לרמה 2") with progress dots; the adult's level picker shows "1/2 לרמה 2".
- **Results after every round, readable**: the child gets stars + the level line; the adult opens a "תוצאות הסבב" sheet
  with big numbers per measure, a pass/fail verdict against the level's bar and how to level up - never a strip of
  7-pixel stats squeezed into a painted box. History gets a small trend graph per challenge with the 80% bar.
- **Adults can wipe the data**: two resets - achievements only (stars, bests) and everything (saved rounds via the
  DELETE route, stars, levels), each with a two-step confirm. Parents can't delete.
- **Words**: never "תיווך" (professional jargon he dislikes) - say "עם עזרה". Gendered voice lines need niqqud in the
  TTS text or the voice speaks feminine to everyone.
- **A delayed voice line must be cancelled when the child acts**: a question said 350 ms after a screen opens cut off
  the explanation the child had already asked for, and the demo never started. Keep such timers in a ref; clear them on
  every button that starts something.
