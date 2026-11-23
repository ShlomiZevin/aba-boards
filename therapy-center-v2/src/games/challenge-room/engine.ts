/**
 * challenge-room engine - no React here, so rounds can be fast-forwarded in tests.
 *
 * A Runner owns one round: a game clock (virtual ms, stopped while paused), a timer
 * list on that clock (`later`), the press router, the trial log and the success /
 * star count. A challenge is a small state machine that gets a Ctx and presses.
 *
 * Timing: in real play the clock advances by requestAnimationFrame deltas, and a
 * press is stamped with its event.timeStamp mapped onto the clock, so a response
 * time is measured from the frame the stimulus was set in to the key/touch event
 * (about one frame of display delay is the same in every session).
 */

export type PodId = 0 | 1 | 2 | 3;
export type ColorId = 'green' | 'red' | 'blue' | 'yellow' | 'purple';
export type Val = string | number | boolean | null;
export type Trial = Record<string, Val>;
export type Settings = Record<string, Val>;

export const COLORS: Record<ColorId, { hex: string; name: string }> = {
  green: { hex: '#37d67a', name: 'ירוק' },
  red: { hex: '#ff4d4d', name: 'אדום' },
  blue: { hex: '#3d9bff', name: 'כחול' },
  yellow: { hex: '#ffd23f', name: 'צהוב' },
  purple: { hex: '#b06bff', name: 'סגול' },
};
export const COLOR_IDS = Object.keys(COLORS) as ColorId[];
/** Each pod's own colour in the sequence game (Simon-style). */
export const POD_COLORS: ColorId[] = ['green', 'red', 'blue', 'yellow'];

export interface PodView {
  color: ColorId | null;
  /** off = dark; lit = glowing in `color`; base = a calm ring marks it (home pod) */
  mode: 'off' | 'lit' | 'base';
  /** a big number on the pad (counting while waiting) */
  count?: number | null;
  /** a symbol on the pad: the home base */
  icon?: 'house' | null;
}
export interface RuleChip { color: ColorId; press: boolean }
export interface Overlay {
  /** a small pill in the middle of the screen ("מסתכלים", "עכשיו תורך") */
  status: { icon: string; text: string } | null;
  /** the rule strip at the top (go / no-go colours) */
  rules: RuleChip[] | null;
  /** a big card between blocks ("הכללים התחלפו!") */
  banner: { title: string; rules?: RuleChip[] } | null;
  /** action buttons the child may use now (e.g. replay the sequence) */
  actions: { id: string; label: string }[];
  /** a small progress line (the sequence's length out of its max) */
  progress?: { now: number; max: number } | null;
}
export interface Press { pod: PodId | null; t: number }

export interface Ctx {
  settings: Settings;
  demo: boolean;
  now(): number;
  later(ms: number, fn: () => void): number;
  cancel(id: number): void;
  setPods(pods: PodView[]): void;
  setPod(i: number, v: PodView): void;
  overlay(o: Partial<Overlay>): void;
  sfx(name: string): void;
  /** a voice line; gendered lines are resolved by the sound layer (`intro` -> intro-m) */
  say(id: string, onEnd?: () => void): void;
  /** a success the child earned: sound, stars, sometimes a praise line */
  success(kind?: 'good' | 'stop', pod?: number): void;
  /** a mistake: clear but gentle - 'wrong' (not this one) or 'wait' (pressed on a wait colour), on a pod */
  neutral(kind?: 'wrong' | 'wait', pod?: number | null): void;
  log(t: Trial): void;
  rand(): number;
  finish(): void;
  /** a pod flash for a press the challenge accepted (sequence notes etc.) */
  flash(i: number, color: ColorId | null, ms?: number): void;
}

export interface Challenge {
  start(ctx: Ctx): void;
  press(p: Press): void;
  /** the round was paused: drop the trial in progress (it is logged as void) */
  abort?(): void;
  /** resume after a pause: start the next trial */
  resume?(): void;
  action?(id: string): void;
  /** demo bot: the correct pod to press now, 'space' for any press, or null = wait */
  demoAnswer?(): PodId | null;
  /** trials left - for the "almost done" line */
  remaining?(): number;
}

export const OFF: PodView = { color: null, mode: 'off' };
export const allOff = (): PodView[] => [OFF, OFF, OFF, OFF];

/** mulberry32 - a seeded generator so a round can be replayed in tests */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface RunnerHooks {
  onPods(p: PodView[]): void;
  onOverlay(o: Overlay): void;
  onSfx(name: string): void;
  onSay(id: string, onEnd?: () => void): void;
  onStar(stars: number): void;
  onFlash(i: number, color: ColorId | null, ms: number): void;
  /** a success moment for the screen (burst) - streak = successes in a row */
  onSuccess?(kind: 'good' | 'stop', streak: number, pod?: number): void;
  /** a miss for the screen: the pod shakes and shows a calm 'not this one' / 'this one waits' */
  onMiss?(kind: 'wrong' | 'wait', pod: number | null, count: number): void;
  onFinish(r: RoundResult): void;
}

export interface RoundResult {
  trials: Trial[];
  successes: number;
  stars: number;
  hints: number;
  pauses: number;
  focusLost: boolean;
  stoppedEarly: boolean;
  startedAt: string;
  durationMs: number;
}

interface Timer { id: number; at: number; fn: () => void }

export class Runner {
  private t = 0;
  private timers: Timer[] = [];
  private nextId = 1;
  private pods: PodView[] = allOff();
  private ov: Overlay = { status: null, rules: null, banner: null, actions: [] };
  private trials: Trial[] = [];
  private successes = 0;
  private stars = 0;
  private hintArmed = false;
  private hints = 0;
  private pauses = 0;
  private focusLost = false;
  private finished = false;
  private startedAt = new Date().toISOString();
  private praiseCount = 0;
  private epoch = 0;
  private streak = 0;
  private misses = 0;
  private lastPress: Record<string, number> = {};
  paused = false;
  readonly rand: () => number;

  private challenge: Challenge;
  readonly settings: Settings;
  private hooks: RunnerHooks;

  constructor(
    challenge: Challenge,
    settings: Settings,
    hooks: RunnerHooks,
    opts: { seed?: number; demo?: boolean; starsEvery?: number; voicePraise?: boolean; errorSound?: boolean } = {}
  ) {
    this.challenge = challenge;
    this.settings = settings;
    this.hooks = hooks;
    this.rand = seeded(opts.seed ?? (Date.now() & 0xffffffff));
    this.demo = !!opts.demo;
    this.starsEvery = Math.max(1, opts.starsEvery ?? 3);
    this.voicePraise = opts.voicePraise ?? true;
    this.errorSound = opts.errorSound ?? true;
    this.ctx = this.makeCtx();
  }
  readonly ctx: Ctx;
  readonly demo: boolean;
  private starsEvery: number;
  private voicePraise: boolean;
  private errorSound: boolean;

  now() { return this.t; }

  private started = false;
  start() {
    if (this.started) return;
    this.started = true;
    this.challenge.start(this.ctx);
  }

  /** advance the game clock (rAF in play, big steps in tests) */
  advance(dt: number) {
    if (this.paused || this.finished) return;
    const end = this.t + Math.max(0, dt);
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const next = this.timers[0];
      if (!next || next.at > end) break;
      this.timers.shift();
      this.t = Math.max(this.t, next.at);
      next.fn();
      if (this.paused || this.finished) return;
    }
    this.t = end;
  }

  /** a press; `lagMs` = how long ago it really happened (event.timeStamp vs now) */
  press(pod: PodId | null, lagMs = 0) {
    if (this.paused || this.finished) return;
    const t = Math.max(0, this.t - Math.max(0, lagMs));
    // the same pod / space again within 150 ms is one press (a bounce or double tap)
    const key = pod === null ? 'space' : String(pod);
    if (this.lastPress[key] !== undefined && t - this.lastPress[key] < 150) return;
    this.lastPress[key] = t;
    this.challenge.press({ pod, t });
  }

  action(id: string) {
    if (this.paused || this.finished) return;
    this.challenge.action?.(id);
  }

  /** the adult marks the trial in progress as helped (תיווך) */
  armHint() {
    this.hintArmed = true;
    this.hints++;
  }

  pause(reason: 'adult' | 'focus' = 'adult') {
    if (!this.started || this.paused || this.finished) return;
    this.paused = true;
    this.pauses++;
    this.epoch++;
    if (reason === 'focus') this.focusLost = true;
    this.timers = [];
    this.challenge.abort?.();
    this.setPods(allOff());
  }

  resume() {
    if (!this.paused || this.finished) return;
    this.paused = false;
    this.challenge.resume?.();
  }

  stopEarly() {
    if (this.finished) return;
    this.finishRound(true);
  }

  get isFinished() { return this.finished; }
  get trialLog() { return this.trials; }

  private setPods(p: PodView[]) {
    this.pods = p.slice(0, 4);
    this.hooks.onPods(this.pods);
  }

  private finishRound(stoppedEarly: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.timers = [];
    this.setPods(allOff());
    this.hooks.onFinish({
      trials: this.trials,
      successes: this.successes,
      stars: this.stars,
      hints: this.hints,
      pauses: this.pauses,
      focusLost: this.focusLost,
      stoppedEarly,
      startedAt: this.startedAt,
      durationMs: Math.round(this.t),
    });
  }

  private makeCtx(): Ctx { return {
    settings: this.settings,
    demo: this.demo,
    now: () => this.t,
    later: (ms, fn) => {
      const id = this.nextId++;
      this.timers.push({ id, at: this.t + Math.max(0, ms), fn });
      return id;
    },
    cancel: (id) => { this.timers = this.timers.filter((x) => x.id !== id); },
    setPods: (p) => this.setPods(p),
    setPod: (i, v) => { const p = this.pods.slice(); p[i] = v; this.setPods(p); },
    overlay: (o) => { this.ov = { ...this.ov, ...o }; this.hooks.onOverlay(this.ov); },
    sfx: (n) => this.hooks.onSfx(n),
    say: (id, onEnd) => {
      // a line that ends after a pause / the round's end must not restart anything
      const ep = this.epoch;
      this.hooks.onSay(id, onEnd ? () => { if (!this.paused && !this.finished && ep === this.epoch) onEnd(); } : undefined);
    },
    success: (kind = 'good', pod) => {
      this.streak++;
      this.hooks.onSuccess?.(kind, this.streak, pod);
      if (this.demo) { this.hooks.onSfx(kind === 'stop' ? 'stop-good' : 'good'); return; }
      this.successes++;
      this.hooks.onSfx(kind === 'stop' ? 'stop-good' : 'good');
      if (this.successes % this.starsEvery === 0) {
        this.stars++;
        this.hooks.onStar(this.stars);
        this.ctx.later(250, () => this.hooks.onSfx('star'));
        // a praise line now and then - never on every success
        if (this.voicePraise) {
          this.praiseCount++;
          const line = kind === 'stop' ? 'stop-good' : `praise${1 + (this.praiseCount % 3)}`;
          this.hooks.onSay(line);
        }
      }
    },
    neutral: (kind = 'wrong', pod = null) => {
      this.streak = 0;
      this.misses++;
      this.hooks.onMiss?.(kind, pod ?? null, this.misses);
      if (this.errorSound) this.hooks.onSfx(kind === 'wait' ? 'wait-miss' : 'miss');
    },
    log: (tr) => {
      if (this.demo) return;
      const row: Trial = { ...tr };
      if (this.hintArmed && row.kind !== 'early') { row.hint = true; this.hintArmed = false; }
      this.trials.push(row);
    },
    rand: () => this.rand(),
    finish: () => this.finishRound(false),
    flash: (i, color, ms = 250) => this.hooks.onFlash(i, color, ms),
  }; }
}

// ---------- shared helpers for summaries ----------
export const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
export const num = (v: Val | undefined, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export const bool = (v: Val | undefined) => v === true;
