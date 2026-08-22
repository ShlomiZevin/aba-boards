/**
 * Mini-games registry.
 *
 * Games are standalone reward loops for a kid — independent of the board's
 * tasks and coins. An adult adds a piece when the child succeeds at something
 * real; the child does something satisfying with it.
 *
 * Adding a game is two steps:
 *   1. Write the component and register it in `GAME_COMPONENTS` (GamePage.tsx).
 *   2. Add an entry here, with its settings schema.
 *
 * Everything else — the launcher menu, the settings form, routing — is built
 * from this list.
 */
import type { GameDefinition, GameConfigValues, KidGameEntry } from '../types';

export const GAMES: GameDefinition[] = [
  {
    id: 'lego-tower',
    name: 'מגדל הלגו',
    icon: '🧱',
    description: 'הילד מקבל חתיכת לגו על כל הצלחה, ומרכיב אותה על המגדל. מגדל שלם — פרס.',
    settings: [
      { key: 'title', type: 'text', label: 'כותרת', default: 'מגדל הלגו' },
      { key: 'goal', type: 'number', label: 'מספר חתיכות', min: 3, max: 12, default: 10 },
      { key: 'prize', type: 'text', label: 'פרס', default: '', placeholder: 'למשל: פארק עם אבא' },
      {
        key: 'scene',
        type: 'select',
        label: 'רקע',
        default: 'city',
        options: [
          { value: 'city', label: '🏙️ עיר' },
          { value: 'space', label: '🚀 חלל' },
          { value: 'hero', label: '🦸 גיבורי על' },
          { value: 'dino', label: '🦕 דינוזאורים' },
          { value: 'pirate', label: '🏴‍☠️ פיראטים' },
          { value: 'race', label: '🏎️ מרוצים' },
          { value: 'plain', label: '⬜ רגיל' },
        ],
      },
      { key: 'sound', type: 'checkbox', label: 'צלילים', default: true },
      {
        key: 'adultOnly',
        type: 'checkbox',
        label: 'רק מבוגר מוסיף חתיכה (לחיצה ארוכה)',
        default: false,
      },
    ],
  },
];

/** Scenes with artwork. Anything else falls back to the plain gradient. */
export const SCENES = ['city', 'space', 'hero', 'dino', 'pirate', 'race'] as const;
export type SceneId = (typeof SCENES)[number];

export function sceneClass(scene: unknown): string {
  return SCENES.includes(scene as SceneId) ? ` has-scene scene-${scene}` : '';
}

const BY_ID: Record<string, GameDefinition> = {};
GAMES.forEach((g) => {
  BY_ID[g.id] = g;
});

export function getGame(gameId: string): GameDefinition | undefined {
  return BY_ID[gameId];
}

/** Default config straight from a game's settings schema. */
export function defaultConfig(gameId: string): GameConfigValues {
  const game = BY_ID[gameId];
  if (!game) return {};
  const out: GameConfigValues = {};
  game.settings.forEach((s) => {
    out[s.key] = s.default;
  });
  return out;
}

/**
 * Stored config merged over the defaults, so a game that gains a new setting
 * keeps working for kids configured before it existed.
 */
export function configFor(gameId: string, stored?: GameConfigValues): GameConfigValues {
  return { ...defaultConfig(gameId), ...(stored || {}) };
}

/** Games enabled for a kid. A game with no stored entry is off. */
export function enabledGames(entries?: KidGameEntry[]): GameDefinition[] {
  const on = new Set(
    (entries || []).filter((e) => e && e.enabled !== false).map((e) => e.id)
  );
  return GAMES.filter((g) => on.has(g.id));
}
