/**
 * The challenges of challenge-room. Each one: its levels (presets), the fields an
 * adult may override, the state machine, and the summary of a round's trials.
 *
 * Trial rows are flat ({ kind: 'trial' | 'early', ... }). `early` rows are presses
 * made before anything asked for one (impulsive presses), logged apart from trials.
 */
import {
  COLORS, POD_COLORS, OFF, allOff, shuffle, mean, median, pct, num, bool,
} from './engine';
import type { Challenge, ColorId, Ctx, PodId, PodView, Press, Settings, Trial, Val, RuleChip } from './engine';

export interface Field {
  key: string;
  label: string;
  type: 'number' | 'select' | 'checkbox';
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  help?: string;
}
export interface Metric { key: string; label: string; unit?: string }
export interface ChallengeDef {
  id: string;
  name: string;
  short: string;
  icon: string;          // art file name (icon-*.webp)
  emoji: string;         // fallback
  howto: (s: Settings) => string[];   // voice lines that explain it
  levels: { name: string; settings: Settings }[];
  fields: Field[];
  make: () => Challenge;
  summarize: (trials: Trial[], s: Settings) => Record<string, Val>;
  metrics: Metric[];
  /** may suggest the next level: every check must pass in 2 rounds in a row */
  passed: (summary: Record<string, Val>) => boolean;
  demo: Settings;
  /** the card's frame colour on the menu */
  color: 'green' | 'blue' | 'amber' | 'purple' | 'orange';
  /** 1-3 stars for a finished round (what the child sees) */
  score: (summary: Record<string, Val>, s: Settings) => number;
}

const COLOR_OPTIONS = (Object.keys(COLORS) as ColorId[]).map((c) => ({ value: c, label: COLORS[c].name }));
const pick = <T,>(arr: T[], rand: () => number) => arr[Math.floor(rand() * arr.length)];
const podOtherThan = (last: number, rand: () => number) => {
  const opts = [0, 1, 2, 3].filter((p) => p !== last);
  return pick(opts, rand) as PodId;
};
const trialsOnly = (trials: Trial[]) => trials.filter((t) => t.kind === 'trial' && !t.void && !t.practice);
const earlyCount = (trials: Trial[]) => trials.filter((t) => t.kind === 'early').length;
const hintCount = (trials: Trial[]) => trials.filter((t) => t.hint).length;
const s2n = (s: Settings, k: string, d: number) => num(s[k], d);
const color = (s: Settings, k: string, d: ColorId) => (typeof s[k] === 'string' && s[k] in COLORS ? (s[k] as ColorId) : d);

/** Time between trials, with optional jitter so the next light can't be predicted. */
const isi = (ctx: Ctx) => {
  const base = s2n(ctx.settings, 'isiMs', 1000);
  const jit = s2n(ctx.settings, 'isiJitter', 0);
  return Math.max(200, base + (jit ? Math.round((ctx.rand() * 2 - 1) * jit) : 0));
};

// ====================================================================================
// 1. רואה אור, נוגע באור - a light comes on, touch it.
// ====================================================================================
function makeSeeLight(): Challenge {
  let ctx: Ctx;
  let i = 0;
  let lit: PodId | null = null;
  let onset = 0;
  let wrong = 0;
  let order = 0;
  let last = -1;
  let timeout = 0;
  let idle = 0;
  let total = 0;
  const ORDER: PodId[] = [0, 1, 3, 2]; // around the square

  const next = () => {
    if (i >= total) { ctx.later(500, () => ctx.finish()); return; }
    if (total - i === 2 && total >= 6) ctx.say('almost-end');
    ctx.later(isi(ctx), show);
  };
  const show = () => {
    const pod = ctx.settings.random === false ? ORDER[order++ % 4] : podOtherThan(last, ctx.rand);
    last = pod;
    lit = pod;
    wrong = 0;
    onset = ctx.now();
    ctx.setPod(pod, { color: color(ctx.settings, 'color', 'blue'), mode: 'lit' });
    const win = s2n(ctx.settings, 'windowMs', 0);
    if (win > 0) timeout = ctx.later(win, miss);
    else idle = ctx.later(7000, () => ctx.say('idle-press'));
  };
  const clear = () => {
    ctx.cancel(timeout); ctx.cancel(idle);
    if (lit !== null) ctx.setPod(lit, OFF);
    lit = null;
  };
  const miss = () => {
    ctx.log({ kind: 'trial', i: i + 1, pod: (lit ?? 0) + 1, outcome: 'miss', rt: null, wrong });
    clear();
    i++;
    next();
  };
  return {
    start(c) { ctx = c; total = s2n(c.settings, 'trials', 10); c.setPods(allOff()); next(); },
    press(p: Press) {
      if (lit === null) { ctx.log({ kind: 'early', at: Math.round(p.t) }); return; }
      if (p.pod === lit) {
        ctx.log({ kind: 'trial', i: i + 1, pod: lit + 1, outcome: 'hit', rt: Math.round(p.t - onset), wrong });
        ctx.flash(lit, color(ctx.settings, 'color', 'blue'));
        clear();
        ctx.success();
        i++;
        next();
      } else if (p.pod !== null) {
        wrong++;
        ctx.neutral('wrong', p.pod);
      }
    },
    abort() {
      if (lit !== null) ctx.log({ kind: 'trial', i: i + 1, pod: lit + 1, outcome: 'void', void: true });
      lit = null;
    },
    resume() { next(); },
    demoAnswer: () => lit,
    remaining: () => total - i,
  };
}

// ====================================================================================
// 2. ירוק כן, אדום לא (Go / No-Go) - press on the go colour, wait on the other.
//    The game moves on by itself; not pressing on no-go is a success.
// ====================================================================================
interface GoTrialPlan { go: boolean; color: ColorId; pod: PodId; stimMs: number; windowMs: number }

function planGoNoGo(s: Settings, rand: () => number, goC: ColorId, nogoC: ColorId | ColorId[], trials: number, goPct: number): GoTrialPlan[] {
  const nGo = Math.max(1, Math.round((trials * goPct) / 100));
  let kinds = shuffle([...Array(nGo).fill(true), ...Array(Math.max(0, trials - nGo)).fill(false)] as boolean[], rand);
  // start with a go, and never more than 3 no-go in a row
  for (let tries = 0; tries < 50; tries++) {
    let run = 0; let ok = kinds[0] === true;
    for (const k of kinds) { run = k ? 0 : run + 1; if (run > 3) ok = false; }
    if (ok) break;
    kinds = shuffle(kinds, rand);
  }
  let last = -1;
  const stimBase = s2n(s, 'stimMs', 1500);
  const winBase = s2n(s, 'windowMs', 1500);
  return kinds.map((go) => {
    const stimMs = bool(s.varStim) ? Math.round(stimBase * (0.5 + rand())) : stimBase;
    const pod = podOtherThan(last, rand); last = pod;
    const c = go ? goC : Array.isArray(nogoC) ? pick(nogoC, rand) : nogoC;
    return { go, color: c, pod, stimMs, windowMs: Math.max(winBase, stimMs) };
  });
}

/**
 * One go/no-go trial runner, shared by Go/No-Go and the rule switch.
 * Outcomes: hit, omission (go, no press), commission (no-go, pressed), cr (no-go,
 * waited = success), anticipation (a press faster than minRt - impulsive, not a hit).
 */
function goTrialRunner(ctx: Ctx, extra: () => Trial, done: (outcome: string) => void) {
  let cur: GoTrialPlan | null = null;
  let onset = 0;
  let answered = false;
  let hideT = 0;
  let endT = 0;
  let idx = 0;
  const minRt = () => s2n(ctx.settings, 'minRt', 150);

  const end = (outcome: string, rt: number | null) => {
    if (!cur) return;
    const c = cur;
    ctx.log({ kind: 'trial', i: idx, go: c.go, color: c.color, pod: c.pod + 1, outcome, rt, stimMs: c.stimMs, ...extra() });
    cur = null;
    done(outcome);
  };
  return {
    show(plan: GoTrialPlan, i: number) {
      cur = plan; idx = i; answered = false; onset = ctx.now();
      ctx.setPod(plan.pod, { color: plan.color, mode: 'lit' });
      hideT = ctx.later(plan.stimMs, () => ctx.setPod(plan.pod, OFF));
      endT = ctx.later(plan.windowMs, () => {
        if (!cur || answered) return;
        if (cur.go) { end('omission', null); }
        else { ctx.success('stop'); end('cr', null); }
      });
    },
    /** returns false when no stimulus is up (the press is early) */
    press(p: Press): boolean {
      if (!cur) return false;
      if (answered) return true; // a second press in the same trial is ignored
      answered = true;
      const rt = Math.round(p.t - onset);
      ctx.cancel(hideT); ctx.cancel(endT);
      ctx.setPod(cur.pod, OFF);
      if (rt < minRt()) { end('anticipation', rt); return true; }
      if (cur.go) { ctx.flash(cur.pod, cur.color); ctx.success(); end('hit', rt); }
      else { ctx.neutral('wait', cur.pod); end('commission', rt); }
      return true;
    },
    abort() {
      if (!cur) return;
      ctx.log({ kind: 'trial', i: idx, go: cur.go, color: cur.color, outcome: 'void', void: true, ...extra() });
      ctx.cancel(hideT); ctx.cancel(endT);
      cur = null;
    },
    get active() { return cur; },
  };
}

function makeGoNoGo(): Challenge {
  let ctx: Ctx;
  let plan: GoTrialPlan[] = [];
  let i = 0;
  let runner: ReturnType<typeof goTrialRunner>;
  const next = () => {
    if (i >= plan.length) { ctx.later(600, () => ctx.finish()); return; }
    if (plan.length - i === 2 && plan.length >= 8) ctx.say('almost-end');
    ctx.later(isi(ctx), () => runner.show(plan[i], i + 1));
  };
  return {
    start(c) {
      ctx = c;
      const goC = color(c.settings, 'goColor', 'green');
      const nogoC = color(c.settings, 'nogoColor', 'red');
      plan = planGoNoGo(c.settings, c.rand, goC, nogoC, s2n(c.settings, 'trials', 20), s2n(c.settings, 'goPct', 80));
      if (c.settings.forceDemo) plan = [plan[0], { ...plan[0], go: false, color: nogoC }, { ...plan[0], pod: 3 as PodId }, { ...plan[0], go: false, color: nogoC, pod: 1 as PodId }];
      runner = goTrialRunner(c, () => ({}), () => { i++; next(); });
      c.overlay({ rules: [{ color: goC, press: true }, { color: nogoC, press: false }] });
      c.setPods(allOff());
      next();
    },
    press(p) {
      if (!runner.press(p)) ctx.log({ kind: 'early', at: Math.round(p.t) });
    },
    abort() { runner.abort(); },
    resume() { next(); },
    demoAnswer: () => (runner?.active?.go ? runner.active.pod : null),
    remaining: () => plan.length - i,
  };
}

function summarizeGo(trials: Trial[]) {
  const t = trialsOnly(trials);
  const go = t.filter((x) => x.go === true);
  const nogo = t.filter((x) => x.go === false);
  const hits = go.filter((x) => x.outcome === 'hit');
  const rts = hits.map((x) => num(x.rt)).filter((x) => x > 0);
  const antic = t.filter((x) => x.outcome === 'anticipation').length;
  return {
    goTrials: go.length,
    nogoTrials: nogo.length,
    hits: hits.length,
    goPct: pct(hits.length, go.length),
    crs: nogo.filter((x) => x.outcome === 'cr').length,
    nogoPct: pct(nogo.filter((x) => x.outcome === 'cr').length, nogo.length),
    commissions: nogo.filter((x) => x.outcome === 'commission').length,
    omissions: go.filter((x) => x.outcome === 'omission').length,
    anticipations: antic,
    earlyPresses: earlyCount(trials) + antic,
    meanRtGo: mean(rts),
    medianRtGo: median(rts),
    hinted: hintCount(trials),
  } as Record<string, Val>;
}

// ====================================================================================
// 3. זוכר את הרצף - Simon: watch, then repeat. Every right answer adds ONE light to the
//    same sequence (A, AB, ABC...). A mistake: try that length again (retries), else the
//    round ends. The measure is the span - the longest sequence repeated.
// ====================================================================================
function makeSequence(): Challenge {
  let ctx: Ctx;
  let seq: PodId[] = [];
  let attempt = 0;          // running attempt number (trial i)
  let tries = 0;            // tries at the current length
  let phase: 'idle' | 'show' | 'answer' = 'idle';
  let pos = 0;
  let answer: number[] = [];
  let early = 0;
  let replays = 0;
  let idle = 0;
  let saidNotYet = false;
  let maxLen = 8;
  let bestBefore = 0;
  let saidRecord = false;

  const addOne = () => {
    let p = Math.floor(ctx.rand() * 4) as PodId;
    if (!bool(ctx.settings.repeats)) while (seq.length && p === seq[seq.length - 1]) p = Math.floor(ctx.rand() * 4) as PodId;
    seq.push(p);
  };
  const play = () => {
    phase = 'show'; pos = 0; answer = []; saidNotYet = false; early = 0;
    ctx.overlay({ status: { icon: '👀', text: 'מסתכלים' }, actions: [], progress: { now: seq.length, max: maxLen } });
    ctx.setPods(allOff());
    const lit = s2n(ctx.settings, 'litMs', 600);
    const gap = s2n(ctx.settings, 'gapMs', 250);
    let at = 500;
    seq.forEach((p) => {
      ctx.later(at, () => { ctx.setPod(p, { color: POD_COLORS[p], mode: 'lit' }); ctx.sfx(`note${p + 1}`); });
      ctx.later(at + lit, () => ctx.setPod(p, OFF));
      at += lit + gap;
    });
    ctx.later(at + 150, yourTurn);
  };
  const yourTurn = () => {
    phase = 'answer';
    ctx.sfx('turn');
    ctx.say('your-turn');
    ctx.overlay({ status: { icon: '☝️', text: 'עכשיו תורך' }, actions: bool(ctx.settings.replay) ? [{ id: 'replay', label: 'לראות שוב' }] : [] });
    armIdle();
  };
  const armIdle = () => { ctx.cancel(idle); idle = ctx.later(8000, () => { if (phase === 'answer') { ctx.say('your-turn'); armIdle(); } }); };
  const logAttempt = (outcome: 'full' | 'error', errorAt: number) => {
    attempt++;
    ctx.log({
      kind: 'trial', i: attempt, length: seq.length, attempt: tries, outcome,
      itemsCorrect: outcome === 'full' ? seq.length : errorAt, errorAt: outcome === 'full' ? -1 : errorAt + 1,
      early, replays, seq: seq.map((p) => p + 1).join('-'), answer: answer.map((p) => p + 1).join('-'),
    });
  };
  return {
    start(c) {
      ctx = c;
      maxLen = s2n(c.settings, 'maxLength', 8);
      bestBefore = s2n(c.settings, 'best', 0);
      seq = [];
      const startLen = Math.max(1, Math.min(maxLen, s2n(c.settings, 'startLength', 1)));
      for (let k = 0; k < startLen; k++) addOne();
      tries = 1;
      c.setPods(allOff());
      c.later(300, play);
    },
    press(p) {
      if (phase !== 'answer') {
        early++;
        ctx.log({ kind: 'early', at: Math.round(p.t), during: phase });
        if (phase === 'show' && !saidNotYet) { saidNotYet = true; ctx.say('not-yet'); }
        return;
      }
      if (p.pod === null) return;
      armIdle();
      ctx.overlay({ actions: [] });
      answer.push(p.pod);
      if (p.pod === seq[pos]) {
        ctx.flash(p.pod, POD_COLORS[p.pod], 300);
        ctx.sfx(`note${p.pod + 1}`);
        pos++;
        if (pos === seq.length) {
          phase = 'idle'; ctx.cancel(idle);
          ctx.overlay({ status: null });
          logAttempt('full', -1);
          ctx.later(300, () => ctx.success());
          if (seq.length >= maxLen) { ctx.later(900, () => ctx.finish()); return; }
          // the sequence grows by one
          const grown = seq.length + 1;
          ctx.later(700, () => {
            if (!saidRecord && bestBefore > 0 && grown > bestBefore) { saidRecord = true; ctx.sfx('levelup'); ctx.say('new-record'); }
            else ctx.say('one-more');
          });
          addOne();
          tries = 1;
          ctx.later(2000, play);
        }
      } else {
        phase = 'idle'; ctx.cancel(idle);
        ctx.overlay({ status: null });
        ctx.neutral('wrong', p.pod);
        logAttempt('error', pos);
        if (tries <= s2n(ctx.settings, 'retries', 1)) {
          tries++;
          ctx.later(700, () => ctx.say('try-again'));
          ctx.later(2300, play);
        } else {
          ctx.later(900, () => ctx.finish());
        }
      }
    },
    action(id) {
      if (id === 'replay' && phase === 'answer' && pos === 0) { replays++; ctx.cancel(idle); play(); }
    },
    abort() { phase = 'idle'; ctx.cancel(idle); ctx.overlay({ status: null, actions: [] }); },
    resume() { ctx.later(800, play); },
    demoAnswer: () => (phase === 'answer' ? seq[pos] : null),
    remaining: () => maxLen - seq.length,
  };
}

function summarizeSeq(trials: Trial[], s: Settings) {
  const t = trialsOnly(trials);
  const start = s2n(s, 'startLength', 1);
  const full = t.filter((x) => x.outcome === 'full');
  const errs = t.filter((x) => x.outcome === 'error');
  const lengths = [...new Set(t.map((x) => num(x.length)))];
  const firstTry = lengths.filter((L) => { const first = t.find((x) => num(x.length) === L); return first?.outcome === 'full'; }).length;
  const span = Math.max(0, ...full.map((x) => num(x.length)));
  return {
    span,
    gained: Math.max(0, span - start + 1),
    reachedMax: span >= s2n(s, 'maxLength', 8),
    attempts: t.length,
    errors: errs.length,
    firstTryPct: pct(firstTry, lengths.length),
    itemsToFirstError: errs.length ? Math.round((errs.reduce((a, x) => a + num(x.itemsCorrect), 0) / errs.length) * 10) / 10 : null,
    replays: t.reduce((a, x) => a + num(x.replays), 0),
    earlyPresses: earlyCount(trials),
    hinted: hintCount(trials),
  } as Record<string, Val>;
}

// ====================================================================================
// 4. הכללים התחלפו! - go/no-go whose rule flips between blocks, with a clear cue,
//    time to get ready and (optionally) a few practice trials after each switch.
// ====================================================================================
const RULES_2: ColorId[][] = [['green'], ['red']];          // press-set per block, alternating
const RULES_3: ColorId[][] = [['green'], ['red'], ['blue']]; // 3 colours: press only one
function ruleFor(block: number, colors: number) {
  const set = colors >= 3 ? RULES_3 : RULES_2;
  return set[block % set.length];
}
function ruleChips(press: ColorId[], colors: number): RuleChip[] {
  const palette: ColorId[] = colors >= 3 ? ['green', 'red', 'blue'] : ['green', 'red'];
  return [...palette.filter((c) => press.includes(c)), ...palette.filter((c) => !press.includes(c))].map((c) => ({ color: c, press: press.includes(c) }));
}
function sayRule(ctx: Ctx, chips: RuleChip[], then: () => void) {
  const lines = chips.map((c) => `${c.press ? 'go' : 'nogo'}-${c.color}`);
  const step = (k: number) => (k >= lines.length ? then() : ctx.say(lines[k], () => step(k + 1)));
  step(0);
}

function makeRuleSwitch(): Challenge {
  let ctx: Ctx;
  let block = 0;
  let blocks = 2;
  let colors = 2;
  let plan: GoTrialPlan[] = [];
  let practiceLeft = 0;
  let i = 0;          // index in block plan
  let scored = 0;     // scored trials in this block
  let n = 0;          // running trial number
  let press: ColorId[] = [];
  let prevPress: ColorId[] | null = null;
  let runner: ReturnType<typeof goTrialRunner>;
  let inTrial = false;

  const blockPlan = () => {
    const palette: ColorId[] = colors >= 3 ? ['green', 'red', 'blue'] : ['green', 'red'];
    const per = s2n(ctx.settings, 'trialsPerBlock', 10) + practiceLeft;
    const goPct = s2n(ctx.settings, 'goPct', 50);
    const nogo = palette.filter((c) => !press.includes(c));
    return planGoNoGo(ctx.settings, ctx.rand, press[0], nogo, per, goPct);
  };
  const startBlock = (first: boolean) => {
    press = ruleFor(block, colors);
    practiceLeft = first ? 0 : s2n(ctx.settings, 'practice', 2);
    plan = blockPlan(); i = 0; scored = 0;
    const chips = ruleChips(press, colors);
    ctx.setPods(allOff());
    if (first) {
      ctx.overlay({ rules: chips, banner: { title: 'הכלל', rules: chips } });
      sayRule(ctx, chips, () => ctx.later(600, () => { ctx.overlay({ banner: null }); next(); }));
    } else {
      ctx.overlay({ rules: null, banner: { title: 'הכללים התחלפו!', rules: chips } });
      ctx.sfx('switch');
      ctx.say('rules-changed', () => sayRule(ctx, chips, () => {
        ctx.later(s2n(ctx.settings, 'prepMs', 2500), () => { ctx.overlay({ banner: null, rules: chips }); next(); });
      }));
    }
  };
  const next = () => {
    if (i >= plan.length) {
      block++;
      if (block >= blocks) { ctx.later(600, () => ctx.finish()); return; }
      prevPress = press;
      ctx.later(900, () => startBlock(false));
      return;
    }
    const left = (blocks - block - 1) * s2n(ctx.settings, 'trialsPerBlock', 10) + (plan.length - i);
    if (left === 2) ctx.say('almost-end');
    ctx.later(isi(ctx), () => { inTrial = true; n++; runner.show(plan[i], n); });
  };
  return {
    start(c) {
      ctx = c;
      blocks = s2n(c.settings, 'blocks', 2);
      colors = s2n(c.settings, 'colors', 2);
      runner = goTrialRunner(c, () => {
        const practice = i < practiceLeft;
        const cur = runner.active;
        // perseveration: the error matches what the previous rule asked for this colour
        let persev: boolean | null = null;
        if (cur && prevPress) persev = prevPress.includes(cur.color) !== press.includes(cur.color);
        return { block: block + 1, rule: press.join('+'), practice, sinceSwitch: practice ? -1 : scored + 1, ruleDiffers: persev };
      }, (outcome) => {
        inTrial = false;
        if (i >= practiceLeft && outcome !== 'void') scored++;
        i++;
        next();
      });
      c.setPods(allOff());
      startBlock(true);
    },
    press(p) {
      if (!inTrial || !runner.press(p)) ctx.log({ kind: 'early', at: Math.round(p.t), block: block + 1 });
    },
    abort() { runner.abort(); inTrial = false; ctx.overlay({ banner: null }); },
    resume() { ctx.overlay({ rules: ruleChips(press, colors) }); next(); },
    demoAnswer: () => (runner?.active && press.includes(runner.active.color) ? runner.active.pod : null),
    remaining: () => (blocks - block - 1) * s2n(ctx.settings, 'trialsPerBlock', 10) + (plan.length - i),
  };
}

function summarizeSwitch(trials: Trial[]) {
  const t = trialsOnly(trials);
  const ok = (x: Trial) => x.outcome === 'hit' || x.outcome === 'cr';
  const err = (x: Trial) => x.outcome === 'commission' || x.outcome === 'omission' || x.outcome === 'anticipation';
  const blocks = [...new Set(t.map((x) => num(x.block)))].sort((a, b) => a - b);
  const after = t.filter((x) => num(x.block) > 1 && num(x.sinceSwitch) >= 1 && num(x.sinceSwitch) <= 5);
  // trials until 3 correct in a row under the new rule (per switched block)
  const toCrit: number[] = [];
  const rtBefore: number[] = [];
  const rtAfter: number[] = [];
  blocks.slice(1).forEach((b) => {
    const rows = t.filter((x) => num(x.block) === b);
    let run = 0; let at = -1;
    rows.forEach((x, k) => { if (at < 0) { run = ok(x) ? run + 1 : 0; if (run === 3) at = k + 1; } });
    toCrit.push(at < 0 ? rows.length : at);
    const prev = t.filter((x) => num(x.block) === b - 1 && x.outcome === 'hit').slice(-5).map((x) => num(x.rt));
    const nxt = rows.filter((x) => x.outcome === 'hit').slice(0, 5).map((x) => num(x.rt));
    rtBefore.push(...prev); rtAfter.push(...nxt);
  });
  const go = t.filter((x) => x.go === true);
  const nogo = t.filter((x) => x.go === false);
  return {
    trials: t.length,
    accuracy: pct(t.filter(ok).length, t.length),
    goPct: pct(go.filter((x) => x.outcome === 'hit').length, go.length),
    nogoPct: pct(nogo.filter((x) => x.outcome === 'cr').length, nogo.length),
    switches: Math.max(0, blocks.length - 1),
    errorsAfterSwitch: after.filter(err).length,
    persevErrors: t.filter((x) => err(x) && x.ruleDiffers === true && num(x.block) > 1).length,
    trialsToCriterion: toCrit.length ? Math.round((toCrit.reduce((a, b) => a + b, 0) / toCrit.length) * 10) / 10 : null,
    rtBefore: mean(rtBefore),
    rtAfter: mean(rtAfter),
    commissions: t.filter((x) => x.outcome === 'commission').length,
    omissions: t.filter((x) => x.outcome === 'omission').length,
    earlyPresses: earlyCount(trials) + t.filter((x) => x.outcome === 'anticipation').length,
    practiceTrials: trials.filter((x) => x.practice === true).length,
    hinted: hintCount(trials),
  } as Record<string, Val>;
}

// ====================================================================================
// 7. חזור לבסיס - one pod is home (a yellow pad with a house). A blue light comes on
//    somewhere else: touch it, then go back home. Only the touch on home ends the
//    sequence and starts the next one. Errorless: a wrong touch is shown and logged,
//    the sequence waits for the right one.
// ====================================================================================
const HOME_C: ColorId = 'yellow';
const TARGET_C: ColorId = 'blue';
function makeBase(): Challenge {
  let ctx: Ctx;
  let i = 0;
  let total = 0;
  let base: PodId = 3;
  let phase: 'idle' | 'target' | 'return' = 'idle';
  let targets: PodId[] = [];
  let k = 0;                 // which target in the chain is lit
  let onset = 0;
  let firstRt: number | null = null;
  let leftAt = 0;            // when the last target was touched
  let err = { wrongTarget: 0, baseEarly: 0, skipReturn: 0 };
  let cued = false;
  let idle = 0;

  const homeView = (lit: boolean): PodView => ({ color: HOME_C, mode: lit ? 'lit' : 'base', icon: 'house' });
  const showHome = (lit = false) => ctx.setPod(base, homeView(lit));
  const next = () => {
    phase = 'idle';
    if (i >= total) { ctx.later(500, () => ctx.finish()); return; }
    if (total - i === 2 && total >= 6) ctx.say('almost-end');
    const every = s2n(ctx.settings, 'moveEvery', 0);
    if (every > 0 && i > 0 && i % every === 0) {
      // home moves: the old home goes dark, the new one pops in with a sound and a line
      ctx.setPod(base, OFF);
      base = podOtherThan(base, ctx.rand);
      ctx.later(350, () => { showHome(true); ctx.sfx('switch'); ctx.say('new-base'); });
      ctx.later(2100, () => { showHome(false); ctx.later(isi(ctx), start); });
      return;
    }
    ctx.later(isi(ctx), start);
  };
  const start = () => {
    const chain = Math.max(1, Math.min(3, s2n(ctx.settings, 'chain', 1)));
    targets = [];
    let last = base as number;
    for (let c = 0; c < chain; c++) {
      const opts = [0, 1, 2, 3].filter((p) => p !== base && p !== last) as PodId[];
      const p = pick(opts, ctx.rand); targets.push(p); last = p;
    }
    k = 0; firstRt = null; err = { wrongTarget: 0, baseEarly: 0, skipReturn: 0 }; cued = false;
    lightTarget();
  };
  const armIdle = (line: string) => {
    ctx.cancel(idle);
    idle = ctx.later(6500, () => {
      if (phase === 'return' && !cued) { cued = true; showHome(true); }
      ctx.say(line);
      armIdle(line);
    });
  };
  const lightTarget = () => {
    phase = 'target';
    onset = ctx.now();
    ctx.setPod(targets[k], { color: TARGET_C, mode: 'lit' });
    armIdle('idle-press');
  };
  const goReturn = () => {
    phase = 'return';
    leftAt = ctx.now();
    if (bool(ctx.settings.returnCue)) showHome(true);
    armIdle('go-home');
  };
  return {
    start(c) {
      ctx = c;
      total = s2n(c.settings, 'trials', 8);
      base = (Math.max(1, Math.min(4, s2n(c.settings, 'basePod', 4))) - 1) as PodId;
      c.setPods(allOff());
      showHome(false);
      c.later(600, next);
    },
    press(p) {
      if (p.pod === null) return;
      if (phase === 'idle') { ctx.log({ kind: 'early', at: Math.round(p.t) }); return; }
      if (phase === 'target') {
        const want = targets[k];
        if (p.pod === want) {
          if (firstRt === null) firstRt = Math.round(p.t - onset);
          ctx.cancel(idle);
          ctx.setPod(want, OFF);
          ctx.flash(want, TARGET_C, 260);
          ctx.sfx('tap1');
          k++;
          if (k < targets.length) ctx.later(250, lightTarget);
          else goReturn();
        } else if (p.pod === base) { err.baseEarly++; ctx.neutral('wrong', p.pod); }
        else { err.wrongTarget++; ctx.neutral('wrong', p.pod); }
        return;
      }
      // phase === 'return'
      if (p.pod === base) {
        ctx.cancel(idle);
        const errors = err.wrongTarget + err.baseEarly + err.skipReturn;
        ctx.log({
          kind: 'trial', i: i + 1, base: base + 1, targets: targets.map((x) => x + 1).join('-'),
          outcome: errors ? 'error' : 'clean', ...err, cued, rt: firstRt, returnRt: Math.round(p.t - leftAt),
        });
        phase = 'idle';
        showHome(false);
        ctx.flash(base, HOME_C, 300);
        ctx.success('good', base);
        i++;
        next();
      } else { err.skipReturn++; ctx.neutral('wrong', p.pod); }
    },
    abort() {
      ctx.cancel(idle);
      if (phase !== 'idle') ctx.log({ kind: 'trial', i: i + 1, outcome: 'void', void: true });
      phase = 'idle';
    },
    resume() { ctx.setPods(allOff()); showHome(false); next(); },
    demoAnswer: () => (phase === 'target' ? targets[k] : phase === 'return' ? base : null),
    remaining: () => total - i,
  };
}

function summarizeBase(trials: Trial[]) {
  const t = trialsOnly(trials);
  const clean = t.filter((x) => x.outcome === 'clean');
  const sum = (k: string) => t.reduce((a, x) => a + num(x[k]), 0);
  return {
    trials: t.length,
    clean: clean.length,
    cleanPct: pct(clean.length, t.length),
    skipReturn: sum('skipReturn'),
    skipRounds: t.filter((x) => num(x.skipReturn) > 0).length,
    baseEarly: sum('baseEarly'),
    wrongTarget: sum('wrongTarget'),
    orderErrors: sum('skipReturn') + sum('baseEarly') + sum('wrongTarget'),
    cuedReturns: t.filter((x) => x.cued === true).length,
    meanRt: mean(t.map((x) => num(x.rt)).filter((x) => x > 0)),
    meanReturnRt: mean(t.map((x) => num(x.returnRt)).filter((x) => x > 0)),
    earlyPresses: earlyCount(trials),
    hinted: hintCount(trials),
  } as Record<string, Val>;
}

// ====================================================================================
// 8. סופרים לפני שנוגעים - a pad turns yellow and counts (1, 2, 3...): wait. When it
//    turns green, touch it. The wait and the time allowed to answer are separate
//    settings (spec: teach the pause, not slow answers). A touch while yellow is an
//    early press - logged, the light goes out calmly, the next one comes.
// ====================================================================================
const WAIT_C: ColorId = 'yellow';
const GO_C: ColorId = 'green';
function makeWait(): Challenge {
  let ctx: Ctx;
  let i = 0;
  let total = 0;
  let pod: PodId | null = null;
  let last = -1;
  let phase: 'idle' | 'wait' | 'go' = 'idle';
  let onset = 0;
  let goAt = 0;
  let waitMs = 0;
  let wrong = 0;
  let timers: number[] = [];

  const clearT = () => { timers.forEach((t) => ctx.cancel(t)); timers = []; };
  const next = () => {
    phase = 'idle';
    if (i >= total) { ctx.later(500, () => ctx.finish()); return; }
    if (total - i === 2 && total >= 6) ctx.say('almost-end');
    ctx.later(isi(ctx), show);
  };
  const show = () => {
    const lo = s2n(ctx.settings, 'waitMs', 1000);
    const hi = Math.max(lo, s2n(ctx.settings, 'waitMax', lo));
    waitMs = hi > lo ? Math.round((lo + ctx.rand() * (hi - lo)) / 100) * 100 : lo;
    const p = podOtherThan(last, ctx.rand); last = p; pod = p;
    phase = 'wait'; wrong = 0; onset = ctx.now();
    const showCount = ctx.settings.showCount !== false;
    const voice = bool(ctx.settings.countVoice);
    ctx.setPod(p, { color: WAIT_C, mode: 'lit', count: showCount ? 1 : null });
    if (voice) ctx.say('n1');
    // one number every second while waiting
    for (let n = 2; (n - 1) * 1000 < waitMs; n++) {
      timers.push(ctx.later((n - 1) * 1000, () => {
        if (phase !== 'wait' || pod === null) return;
        ctx.setPod(pod, { color: WAIT_C, mode: 'lit', count: showCount ? n : null });
        if (voice && n <= 5) ctx.say(`n${n}`); else ctx.sfx('tap2');
      }));
    }
    timers.push(ctx.later(waitMs, go));
  };
  const go = () => {
    if (pod === null) return;
    phase = 'go'; goAt = ctx.now();
    ctx.setPod(pod, { color: GO_C, mode: 'lit' });
    ctx.sfx('turn');
    const win = s2n(ctx.settings, 'windowMs', 0);
    if (win > 0) timers.push(ctx.later(win, miss));
    else timers.push(ctx.later(6000, () => { if (phase === 'go') ctx.say('idle-press'); }));
  };
  const end = (outcome: string, row: Record<string, Val>) => {
    clearT();
    ctx.log({ kind: 'trial', i: i + 1, pod: (pod ?? 0) + 1, waitMs, outcome, wrong, ...row });
    if (pod !== null) ctx.setPod(pod, OFF);
    pod = null; phase = 'idle'; i++;
  };
  const miss = () => { end('miss', { rt: null, waited: null }); next(); };
  return {
    start(c) { ctx = c; total = s2n(c.settings, 'trials', 8); c.setPods(allOff()); c.later(300, next); },
    press(p) {
      if (p.pod === null) return;
      if (phase === 'idle') { ctx.log({ kind: 'early', at: Math.round(p.t) }); return; }
      const at = pod;
      if (p.pod !== pod) {
        if (phase === 'go') { wrong++; ctx.neutral('wrong', p.pod); return; }
        // any touch while it is still yellow is pressing too early
        end('early', { rt: null, waited: Math.round(p.t - onset), otherPod: true });
        ctx.neutral('wait', at);
        next();
        return;
      }
      if (phase === 'wait') {
        end('early', { rt: null, waited: Math.round(p.t - onset) });
        ctx.neutral('wait', at);
        next();
        return;
      }
      end('hit', { rt: Math.round(p.t - goAt), waited: Math.round(p.t - onset) });
      if (at !== null) ctx.flash(at, GO_C, 300);
      ctx.success('stop', at ?? undefined);
      next();
    },
    abort() {
      clearT();
      if (phase !== 'idle') ctx.log({ kind: 'trial', i: i + 1, outcome: 'void', void: true });
      pod = null; phase = 'idle';
    },
    resume() { next(); },
    demoAnswer: () => (phase === 'go' ? pod : null),
    remaining: () => total - i,
  };
}

function summarizeWait(trials: Trial[]) {
  const t = trialsOnly(trials);
  const hits = t.filter((x) => x.outcome === 'hit');
  const earlyT = t.filter((x) => x.outcome === 'early');
  return {
    trials: t.length,
    hits: hits.length,
    waitPct: pct(hits.length, t.length),
    earlyTrials: earlyT.length,
    misses: t.filter((x) => x.outcome === 'miss').length,
    wrongPresses: t.reduce((a, x) => a + num(x.wrong), 0),
    meanWaited: mean(hits.map((x) => num(x.waited))),
    meanEarlyAt: mean(earlyT.map((x) => num(x.waited))),
    meanRt: mean(hits.map((x) => num(x.rt))),
    earlyPresses: earlyCount(trials),
    hinted: hintCount(trials),
  } as Record<string, Val>;
}

// ====================================================================================
// definitions
// ====================================================================================
const N = (key: string, label: string, min: number, max: number, step = 1, help?: string): Field => ({ key, label, type: 'number', min, max, step, help });
const C = (key: string, label: string, help?: string): Field => ({ key, label, type: 'checkbox', help });


const starsFor = (p: number) => (p >= 90 ? 3 : p >= 70 ? 2 : 1);
export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'light',
    name: 'רואה אור, נוגע באור',
    short: 'קשב ותגובה',
    icon: 'icon-light',
    emoji: '💡',
    howto: () => ['c1-howto'],
    levels: [
      { name: 'האור מחכה עד שלוחצים', settings: { trials: 12, windowMs: 0, isiMs: 800, isiJitter: 200, random: true, color: 'blue' } },
      { name: 'שנייה וחצי ללחוץ', settings: { trials: 16, windowMs: 1500, isiMs: 600, isiJitter: 250, random: true, color: 'blue' } },
      { name: 'שנייה ללחוץ', settings: { trials: 20, windowMs: 1000, isiMs: 450, isiJitter: 250, random: true, color: 'blue' } },
      { name: 'בזק', settings: { trials: 25, windowMs: 750, isiMs: 300, isiJitter: 200, random: true, color: 'blue' } },
    ],
    fields: [
      N('trials', 'מספר ניסיונות', 3, 60),
      N('windowMs', 'כמה זמן האור דולק (מ״ש, 0 = עד שלוחצים)', 0, 10000, 100),
      N('isiMs', 'זמן בין אורות (מ״ש)', 200, 5000, 100),
      N('isiJitter', 'שינוי אקראי בזמן בין אורות (± מ״ש)', 0, 2000, 100),
      C('random', 'מיקום אקראי (כבוי = מסביב לפי הסדר)'),
      { key: 'color', label: 'צבע האור', type: 'select', options: COLOR_OPTIONS },
    ],
    make: makeSeeLight,
    summarize: (trials) => {
      const t = trialsOnly(trials);
      const hits = t.filter((x) => x.outcome === 'hit');
      const rts = hits.map((x) => num(x.rt));
      return {
        trials: t.length,
        hits: hits.length,
        accuracy: pct(hits.length, t.length),
        misses: t.filter((x) => x.outcome === 'miss').length,
        wrongPresses: t.reduce((a, x) => a + num(x.wrong), 0),
        earlyPresses: earlyCount(trials),
        meanRt: mean(rts),
        medianRt: median(rts),
        hinted: hintCount(trials),
      };
    },
    metrics: [
      { key: 'accuracy', label: 'תגובות נכונות', unit: '%' },
      { key: 'wrongPresses', label: 'לחיצות על מקום אחר' },
      { key: 'misses', label: 'לא הגיב בזמן' },
      { key: 'earlyPresses', label: 'לחיצות לפני שנדלק' },
      { key: 'meanRt', label: 'זמן תגובה ממוצע', unit: 'מ״ש' },
    ],
    passed: (s) => num(s.accuracy) >= 80,
    demo: { trials: 3, windowMs: 0, isiMs: 900, random: true, color: 'blue' },
    color: 'purple',
    score: (m) => starsFor(num(m.accuracy)),
  },
  {
    id: 'gonogo',
    name: 'ירוק כן, אדום לא',
    short: 'עצירה לפני פעולה',
    icon: 'icon-gonogo',
    emoji: '🚦',
    howto: (s) => [`go-${color(s, 'goColor', 'green')}`, `nogo-${color(s, 'nogoColor', 'red')}`],
    levels: [
      { name: 'קל: 80% לוחצים', settings: { trials: 20, goPct: 80, stimMs: 1100, windowMs: 1100, isiMs: 750, isiJitter: 150, varStim: false } },
      { name: 'בינוני: 70% לוחצים', settings: { trials: 25, goPct: 70, stimMs: 900, windowMs: 900, isiMs: 600, isiJitter: 200, varStim: false } },
      { name: 'מתקדם: חצי ירוק חצי אדום', settings: { trials: 30, goPct: 50, stimMs: 700, windowMs: 750, isiMs: 500, isiJitter: 250, varStim: false } },
      { name: 'מאתגר: חצי חצי, זמנים משתנים', settings: { trials: 36, goPct: 50, stimMs: 650, windowMs: 800, isiMs: 400, isiJitter: 300, varStim: true } },
    ],
    fields: [
      N('trials', 'מספר ניסיונות', 4, 80),
      N('goPct', 'אחוז ניסיונות "לוחצים"', 20, 90, 5),
      N('stimMs', 'כמה זמן הצבע מופיע (מ״ש)', 300, 5000, 100),
      N('windowMs', 'חלון התגובה (מ״ש, לפחות כמו ההופעה)', 300, 6000, 100),
      N('isiMs', 'זמן המתנה בין ניסיונות (מ״ש)', 300, 5000, 100),
      N('isiJitter', 'שינוי אקראי בזמן ההמתנה (± מ״ש)', 0, 2000, 100),
      C('varStim', 'זמני הופעה משתנים (לא צפוי)'),
      { key: 'goColor', label: 'צבע "לוחצים"', type: 'select', options: COLOR_OPTIONS },
      { key: 'nogoColor', label: 'צבע "לא לוחצים"', type: 'select', options: COLOR_OPTIONS },
      N('minRt', 'לחיצה מהירה מזה נחשבת מוקדמת (מ״ש)', 0, 400, 10),
    ],
    make: makeGoNoGo,
    summarize: (trials) => summarizeGo(trials),
    metrics: [
      { key: 'goPct', label: 'לחץ על ירוק', unit: '%' },
      { key: 'nogoPct', label: 'עצר על אדום', unit: '%' },
      { key: 'commissions', label: 'לחץ כשהיה צריך לחכות' },
      { key: 'omissions', label: 'לא לחץ כשהיה צריך' },
      { key: 'earlyPresses', label: 'לחיצות מוקדמות' },
      { key: 'meanRtGo', label: 'זמן תגובה (רק ירוק)', unit: 'מ״ש' },
    ],
    passed: (s) => num(s.goPct) >= 80 && num(s.nogoPct) >= 80,
    demo: { trials: 4, goPct: 50, stimMs: 1800, windowMs: 1800, isiMs: 900, forceDemo: true, minRt: 0 },
    color: 'amber',
    score: (m) => starsFor(Math.min(num(m.goPct), num(m.nogoPct))),
  },
  {
    id: 'sequence',
    name: 'זוכר את הרצף',
    short: 'זיכרון עבודה',
    icon: 'icon-sequence',
    emoji: '🔢',
    howto: () => ['c3-howto'],
    levels: [
      { name: 'מתחילים מאור אחד', settings: { startLength: 1, maxLength: 6, litMs: 600, gapMs: 250, repeats: false, retries: 1, replay: true } },
      { name: 'מתחילים משניים', settings: { startLength: 2, maxLength: 8, litMs: 520, gapMs: 220, repeats: false, retries: 1, replay: true } },
      { name: 'מתחילים משלושה', settings: { startLength: 3, maxLength: 10, litMs: 460, gapMs: 200, repeats: true, retries: 1, replay: false } },
      { name: 'מהיר', settings: { startLength: 3, maxLength: 12, litMs: 400, gapMs: 180, repeats: true, retries: 0, replay: false } },
      { name: 'מהיר מאוד', settings: { startLength: 4, maxLength: 14, litMs: 350, gapMs: 150, repeats: true, retries: 0, replay: false } },
    ],
    fields: [
      N('startLength', 'מתחילים מכמה אורות', 1, 10),
      N('maxLength', 'עד כמה אורות (סוף הסבב)', 2, 20),
      N('litMs', 'משך כל אור (מ״ש)', 150, 2000, 50),
      N('gapMs', 'הפסקה בין אורות (מ״ש)', 80, 2000, 20),
      C('repeats', 'אותו אור יכול לחזור פעמיים ברצף'),
      N('retries', 'ניסיונות חוזרים אחרי טעות (0 = הסבב נגמר)', 0, 5),
      C('replay', 'כפתור "לראות שוב" לפני שעונים'),
    ],
    make: makeSequence,
    summarize: (trials, s) => summarizeSeq(trials, s),
    metrics: [
      { key: 'span', label: 'הרצף הארוך שחזר עליו' },
      { key: 'gained', label: 'כמה אורות הוסיף בסבב' },
      { key: 'errors', label: 'טעויות' },
      { key: 'firstTryPct', label: 'אורכים שעבר בניסיון ראשון', unit: '%' },
      { key: 'itemsToFirstError', label: 'פריטים נכונים עד הטעות' },
      { key: 'earlyPresses', label: 'לחיצות בזמן ההצגה' },
    ],
    passed: (s) => num(s.gained) >= 4 || s.reachedMax === true,
    demo: { startLength: 1, maxLength: 3, litMs: 600, gapMs: 300, retries: 0, replay: false },
    color: 'blue',
    score: (m, st) => { const r = num(m.span) / Math.max(1, s2n(st, 'maxLength', 8)); return r >= 0.85 ? 3 : r >= 0.5 ? 2 : 1; },
  },
  {
    id: 'switch',
    name: 'הכללים התחלפו!',
    short: 'גמישות מחשבתית',
    icon: 'icon-switch',
    emoji: '🔄',
    howto: () => ['c4-watch'],
    levels: [
      { name: 'שתי החלפות', settings: { blocks: 3, trialsPerBlock: 10, practice: 2, colors: 2, goPct: 50, stimMs: 1100, windowMs: 1100, isiMs: 750, prepMs: 2000 } },
      { name: 'שלוש החלפות', settings: { blocks: 4, trialsPerBlock: 8, practice: 1, colors: 2, goPct: 50, stimMs: 900, windowMs: 900, isiMs: 600, prepMs: 1800 } },
      { name: 'החלפות מהירות', settings: { blocks: 5, trialsPerBlock: 6, practice: 1, colors: 2, goPct: 50, stimMs: 750, windowMs: 800, isiMs: 500, prepMs: 1500 } },
      { name: 'שלושה צבעים', settings: { blocks: 5, trialsPerBlock: 8, practice: 1, colors: 3, goPct: 40, stimMs: 850, windowMs: 900, isiMs: 550, prepMs: 1800 } },
    ],
    fields: [
      N('blocks', 'מספר כללים (החלפות + 1)', 2, 8),
      N('trialsPerBlock', 'ניסיונות לכל כלל', 3, 30),
      N('practice', 'ניסיונות תרגול אחרי החלפה (לא נספרים)', 0, 6),
      { key: 'colors', label: 'מספר צבעים', type: 'select', options: [{ value: '2', label: 'שניים (ירוק/אדום)' }, { value: '3', label: 'שלושה (ירוק/אדום/כחול)' }] },
      N('goPct', 'אחוז ניסיונות "לוחצים"', 20, 80, 5),
      N('stimMs', 'כמה זמן הצבע מופיע (מ״ש)', 300, 5000, 100),
      N('windowMs', 'חלון התגובה (מ״ש)', 300, 6000, 100),
      N('isiMs', 'זמן המתנה בין ניסיונות (מ״ש)', 300, 5000, 100),
      N('prepMs', 'זמן התארגנות אחרי החלפה (מ״ש)', 500, 8000, 250),
    ],
    make: makeRuleSwitch,
    summarize: (trials) => summarizeSwitch(trials),
    metrics: [
      { key: 'accuracy', label: 'דיוק כללי', unit: '%' },
      { key: 'errorsAfterSwitch', label: 'טעויות אחרי החלפה (5 ראשונים)' },
      { key: 'persevErrors', label: 'טעויות לפי הכלל הקודם' },
      { key: 'trialsToCriterion', label: 'ניסיונות עד 3 נכונים ברצף' },
      { key: 'rtBefore', label: 'זמן תגובה לפני החלפה', unit: 'מ״ש' },
      { key: 'rtAfter', label: 'זמן תגובה אחרי החלפה', unit: 'מ״ש' },
    ],
    passed: (s) => num(s.goPct) >= 80 && num(s.nogoPct) >= 80,
    demo: { blocks: 2, trialsPerBlock: 2, practice: 0, colors: 2, goPct: 50, stimMs: 1800, windowMs: 1800, isiMs: 900, prepMs: 1200 },
    color: 'green',
    score: (m) => starsFor(num(m.accuracy)),
  },
];

/**
 * Games 2 and 3 (spec games 7 and 8): each is its own game in the games room with ONE
 * challenge - the same engine, pads, plates, levels and history as the room.
 */
export const EXTRA_CHALLENGES: ChallengeDef[] = [
  {
    id: 'base',
    name: 'חזור לבסיס',
    short: 'רצף פעולות',
    icon: 'machine-base',
    emoji: '🏠',
    howto: () => ['c7-howto'],
    levels: [
      { name: 'הבית נדלק ומראה את הדרך חזרה', settings: { trials: 8, chain: 1, moveEvery: 0, returnCue: true, basePod: 4, isiMs: 700, isiJitter: 150 } },
      { name: 'חוזרים הביתה בלי רמז', settings: { trials: 10, chain: 1, moveEvery: 0, returnCue: false, basePod: 4, isiMs: 600, isiJitter: 150 } },
      { name: 'הבית זז', settings: { trials: 12, chain: 1, moveEvery: 4, returnCue: false, basePod: 4, isiMs: 600, isiJitter: 150 } },
      { name: 'שני אורות ואז הביתה', settings: { trials: 10, chain: 2, moveEvery: 0, returnCue: false, basePod: 4, isiMs: 600, isiJitter: 150 } },
      { name: 'שני אורות, והבית זז', settings: { trials: 12, chain: 2, moveEvery: 4, returnCue: false, basePod: 4, isiMs: 550, isiJitter: 150 } },
    ],
    fields: [
      N('trials', 'מספר סבבים (אור + חזרה הביתה)', 3, 40),
      N('chain', 'כמה אורות לפני החזרה הביתה', 1, 3),
      N('moveEvery', 'הבית זז כל כמה סבבים (0 = קבוע)', 0, 20),
      C('returnCue', 'הבית נדלק כשצריך לחזור (רמז)'),
      N('basePod', 'איפה הבית בהתחלה (1-4)', 1, 4),
      N('isiMs', 'זמן בין סבבים (מ״ש)', 200, 5000, 100),
    ],
    make: makeBase,
    summarize: (trials) => summarizeBase(trials),
    metrics: [
      { key: 'cleanPct', label: 'רצפים נכונים בלי טעות', unit: '%' },
      { key: 'skipReturn', label: 'דילג על החזרה הביתה' },
      { key: 'baseEarly', label: 'לחץ על הבית לפני האור' },
      { key: 'wrongTarget', label: 'לחץ על מקום אחר' },
      { key: 'cuedReturns', label: 'חזר הביתה רק אחרי רמז' },
      { key: 'meanReturnRt', label: 'זמן חזרה הביתה', unit: 'מ״ש' },
    ],
    passed: (s) => num(s.cleanPct) >= 80,
    demo: { trials: 2, chain: 1, moveEvery: 0, returnCue: true, basePod: 4, isiMs: 800 },
    color: 'purple',
    score: (m) => starsFor(num(m.cleanPct)),
  },
  {
    id: 'wait',
    name: 'סופרים לפני שנוגעים',
    short: 'השהיית תגובה',
    icon: 'machine-wait',
    emoji: '⏳',
    howto: () => ['c8-howto'],
    levels: [
      { name: 'מחכים שנייה', settings: { trials: 8, waitMs: 1000, waitMax: 1000, windowMs: 0, isiMs: 900, isiJitter: 200, showCount: true, countVoice: true } },
      { name: 'מחכים שתי שניות', settings: { trials: 8, waitMs: 2000, waitMax: 2000, windowMs: 0, isiMs: 900, isiJitter: 200, showCount: true, countVoice: true } },
      { name: 'מחכים שלוש שניות', settings: { trials: 10, waitMs: 3000, waitMax: 3000, windowMs: 4000, isiMs: 800, isiJitter: 250, showCount: true, countVoice: true } },
      { name: 'זמני המתנה משתנים', settings: { trials: 10, waitMs: 1500, waitMax: 4000, windowMs: 3000, isiMs: 800, isiJitter: 300, showCount: true, countVoice: false } },
    ],
    fields: [
      N('trials', 'מספר ניסיונות', 3, 40),
      N('waitMs', 'זמן המתנה (מ״ש)', 500, 8000, 100),
      N('waitMax', 'זמן המתנה מקסימלי - יותר מהמינימום = משתנה (מ״ש)', 500, 10000, 100),
      N('windowMs', 'כמה זמן אפשר ללחוץ אחרי הירוק (מ״ש, 0 = עד שלוחצים)', 0, 10000, 100),
      N('isiMs', 'זמן בין ניסיונות (מ״ש)', 300, 5000, 100),
      C('showCount', 'מספרים סופרים על הפד בזמן ההמתנה'),
      C('countVoice', 'סופרים בקול (אחת, שתיים, שלוש)'),
    ],
    make: makeWait,
    summarize: (trials) => summarizeWait(trials),
    metrics: [
      { key: 'waitPct', label: 'המתנות מוצלחות', unit: '%' },
      { key: 'earlyTrials', label: 'לחיצות מוקדמות (לפני הירוק)' },
      { key: 'meanWaited', label: 'משך ההמתנה בפועל', unit: 'מ״ש' },
      { key: 'meanEarlyAt', label: 'לחיצה מוקדמת אחרי', unit: 'מ״ש' },
      { key: 'misses', label: 'לא לחץ בזמן' },
      { key: 'meanRt', label: 'זמן תגובה אחרי הירוק', unit: 'מ״ש' },
    ],
    passed: (s) => num(s.waitPct) >= 80,
    demo: { trials: 2, waitMs: 2000, waitMax: 2000, windowMs: 0, isiMs: 800, showCount: true, countVoice: true },
    color: 'orange',
    score: (m) => starsFor(num(m.waitPct)),
  },
];

const ALL_CHALLENGES = [...CHALLENGES, ...EXTRA_CHALLENGES];
export const challengeById = (id: string) => ALL_CHALLENGES.find((c) => c.id === id);


/** The settings a round runs with: the level's preset, then the adult's overrides. */
export function effectiveSettings(def: ChallengeDef, level: number, overrides?: Settings): Settings {
  const lv = def.levels[Math.max(0, Math.min(def.levels.length - 1, level - 1))];
  const out: Settings = { ...lv.settings, ...(overrides || {}) };
  if (typeof out.colors === 'string') out.colors = Number(out.colors);
  return out;
}

/** A stable key for "the same conditions" - level + every setting - to compare rounds fairly. */
export function settingsKey(level: number, s: Settings) {
  return `${level}|` + Object.keys(s).sort().map((k) => `${k}=${s[k]}`).join(',');
}

/** How a challenge's level goes up: rounds in a row that passed, at this level, valid and not stopped. */
export const ROUNDS_TO_LEVEL_UP = 2;

/** what the adult reads about passing a level (one line per challenge) */
export const PASS_RULE: Record<string, string> = {
  light: '80% תגובות נכונות',
  gonogo: '80% לחיצה על ירוק וגם 80% עצירה על אדום',
  sequence: 'להוסיף לפחות 4 אורות לרצף (או להגיע לסוף)',
  switch: '80% לחיצה וגם 80% עצירה, לפי הכלל שמתחלף',
  base: '80% מהרצפים נכונים (אור ואז הביתה) בלי טעות',
  wait: '80% המתנות מוצלחות (לוחצים רק כשירוק)',
};

interface RoundLike { challenge?: unknown; level?: unknown; valid?: unknown; stoppedEarly?: unknown; summary?: Record<string, Val> }

/** passed rounds in a row (newest first) at this level - the way to the next level */
export function levelStreak(def: ChallengeDef, level: number, rounds: RoundLike[]): number {
  let n = 0;
  for (const r of rounds) {
    if (r.challenge !== def.id) continue;
    if (Number(r.level) !== level) break;
    if (r.valid === false || r.stoppedEarly) continue;
    if (def.passed((r.summary || {}) as Record<string, Val>)) n++; else break;
  }
  return n;
}
