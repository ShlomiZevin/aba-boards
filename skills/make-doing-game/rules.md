# Build rules for Start Doing games (children in ABA therapy)

The general craft (phone first, the play area is the screen, painted not drawn, sound on iPhone, real-tap tests) is
in the Shlomiverse rules: `~/.claude/skills/make-verse-game/rules.md`. These are the rules that are different, or
extra, because the players are young children in ABA therapy. Add a principle here whenever a round teaches one.

## The child
- **Errorless learning**: the game never says "wrong". A misplaced piece floats back softly, the right target glows or
  a hand shows it. No lives, no game over, no score that goes down.
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
  `gpt-image-2.5-sunburst` HIGH and the photo as `--ref`. Same face, hair and clothes in every picture - compare every
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
