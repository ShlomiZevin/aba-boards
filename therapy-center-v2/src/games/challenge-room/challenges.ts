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
import type { Challenge, ColorId, Ctx, PodId, Press, Settings, Trial, Val, RuleChip } from './engine';

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
        ctx.neutral();
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
      else { ctx.neutral(); end('commission', rt); }
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
// 3. זוכר את הרצף - watch the lights without touching, then repeat them.
// ====================================================================================
function makeSequence(): Challenge {
  let ctx: Ctx;
  let seqNo = 0;
  let total = 0;
  let seq: PodId[] = [];
  let attempt = 1;
  let phase: 'idle' | 'show' | 'answer' = 'idle';
  let pos = 0;
  let answer: number[] = [];
  let early = 0;
  let replays = 0;
  let idle = 0;
  let saidNotYet = false;

  const build = () => {
    const len = s2n(ctx.settings, 'length', 2);
    const out: PodId[] = [];
    for (let k = 0; k < len; k++) {
      let p = Math.floor(ctx.rand() * 4) as PodId;
      if (!bool(ctx.settings.repeats)) while (k > 0 && p === out[k - 1]) p = Math.floor(ctx.rand() * 4) as PodId;
      out.push(p);
    }
    return out;
  };
  const nextSeq = () => {
    if (seqNo >= total) { ctx.later(600, () => ctx.finish()); return; }
    if (total - seqNo === 1 && total >= 4) ctx.say('almost-end');
    seq = build(); attempt = 1; replays = 0; early = 0;
    ctx.later(seqNo === 0 ? 300 : 1200, play);
  };
  const play = () => {
    phase = 'show'; pos = 0; answer = []; saidNotYet = false;
    ctx.overlay({ status: { icon: '👀', text: 'מסתכלים' }, actions: [] });
    ctx.setPods(allOff());
    const lit = s2n(ctx.settings, 'litMs', 700);
    const gap = s2n(ctx.settings, 'gapMs', 400);
    let at = 700;
    seq.forEach((p) => {
      ctx.later(at, () => { ctx.setPod(p, { color: POD_COLORS[p], mode: 'lit' }); ctx.sfx(`note${p + 1}`); });
      ctx.later(at + lit, () => ctx.setPod(p, OFF));
      at += lit + gap;
    });
    ctx.later(at + 300, yourTurn);
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
    ctx.log({
      kind: 'trial', i: seqNo + 1, length: seq.length, attempt, outcome,
      itemsCorrect: outcome === 'full' ? seq.length : errorAt, errorAt: outcome === 'full' ? -1 : errorAt + 1,
      early, replays, seq: seq.map((p) => p + 1).join('-'), answer: answer.map((p) => p + 1).join('-'),
    });
  };
  return {
    start(c) { ctx = c; total = s2n(c.settings, 'trials', 5); c.setPods(allOff()); nextSeq(); },
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
          ctx.later(350, () => ctx.success());
          seqNo++;
          nextSeq();
        }
      } else {
        phase = 'idle'; ctx.cancel(idle);
        ctx.overlay({ status: null });
        ctx.neutral();
        logAttempt('error', pos);
        const retry = ctx.settings.onError !== 'next' && attempt <= s2n(ctx.settings, 'maxRetries', 2);
        if (retry) {
          attempt++;
          ctx.later(600, () => ctx.say('try-again'));
          ctx.later(2200, play);
        } else {
          seqNo++;
          nextSeq();
        }
      }
    },
    action(id) {
      if (id === 'replay' && phase === 'answer' && pos === 0) { replays++; ctx.cancel(idle); play(); }
    },
    abort() { phase = 'idle'; ctx.cancel(idle); ctx.overlay({ status: null, actions: [] }); },
    resume() { ctx.later(800, play); },
    demoAnswer: () => (phase === 'answer' ? seq[pos] : null),
    remaining: () => total - seqNo,
  };
}

function summarizeSeq(trials: Trial[]) {
  const t = trialsOnly(trials);
  const seqs = new Map<number, Trial[]>();
  t.forEach((x) => { const k = num(x.i); seqs.set(k, [...(seqs.get(k) || []), x]); });
  const all = [...seqs.values()];
  const firstTry = all.filter((a) => a[0]?.outcome === 'full').length;
  const full = all.filter((a) => a.some((x) => x.outcome === 'full')).length;
  const errs = t.filter((x) => x.outcome === 'error');
  const maxLen = Math.max(0, ...t.filter((x) => x.outcome === 'full').map((x) => num(x.length)));
  return {
    sequences: all.length,
    firstTryPct: pct(firstTry, all.length),
    fullPct: pct(full, all.length),
    maxLength: maxLen,
    itemsToFirstError: errs.length ? Math.round((errs.reduce((a, x) => a + num(x.itemsCorrect), 0) / errs.length) * 10) / 10 : null,
    attempts: t.length,
    attemptsPerSequence: all.length ? Math.round((t.length / all.length) * 10) / 10 : null,
    replays: all.reduce((a, arr) => a + Math.max(0, ...arr.map((x) => num(x.replays))), 0),
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
// definitions
// ====================================================================================
const N = (key: string, label: string, min: number, max: number, step = 1, help?: string): Field => ({ key, label, type: 'number', min, max, step, help });
const C = (key: string, label: string, help?: string): Field => ({ key, label, type: 'checkbox', help });

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'light',
    name: 'רואה אור, נוגע באור',
    short: 'קשב ותגובה',
    icon: 'icon-light',
    emoji: '💡',
    howto: () => ['c1-howto'],
    levels: [
      { name: 'האור מחכה עד שלוחצים', settings: { trials: 8, windowMs: 0, isiMs: 1500, isiJitter: 0, random: true, color: 'blue' } },
      { name: '3 שניות ללחוץ', settings: { trials: 10, windowMs: 3000, isiMs: 1200, isiJitter: 0, random: true, color: 'blue' } },
      { name: '2 שניות, קצב משתנה', settings: { trials: 12, windowMs: 2000, isiMs: 1000, isiJitter: 400, random: true, color: 'blue' } },
      { name: 'מהיר', settings: { trials: 16, windowMs: 1400, isiMs: 700, isiJitter: 600, random: true, color: 'blue' } },
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
  },
  {
    id: 'gonogo',
    name: 'ירוק כן, אדום לא',
    short: 'עצירה לפני פעולה',
    icon: 'icon-gonogo',
    emoji: '🚦',
    howto: (s) => [`go-${color(s, 'goColor', 'green')}`, `nogo-${color(s, 'nogoColor', 'red')}`],
    levels: [
      { name: 'קל: 80% לוחצים', settings: { trials: 15, goPct: 80, stimMs: 2000, windowMs: 2000, isiMs: 1500, isiJitter: 0, varStim: false } },
      { name: 'בינוני: 70% לוחצים', settings: { trials: 20, goPct: 70, stimMs: 1500, windowMs: 1500, isiMs: 1200, isiJitter: 0, varStim: false } },
      { name: 'מתקדם: חצי חצי', settings: { trials: 20, goPct: 50, stimMs: 1200, windowMs: 1200, isiMs: 1000, isiJitter: 0, varStim: false } },
      { name: 'מאתגר: זמנים משתנים', settings: { trials: 24, goPct: 50, stimMs: 1200, windowMs: 1400, isiMs: 1000, isiJitter: 800, varStim: true } },
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
  },
  {
    id: 'sequence',
    name: 'זוכר את הרצף',
    short: 'זיכרון עבודה',
    icon: 'icon-sequence',
    emoji: '🔢',
    howto: () => ['c3-howto'],
    levels: [
      { name: 'שני אורות', settings: { length: 2, trials: 5, litMs: 800, gapMs: 450, repeats: false, onError: 'retry', maxRetries: 2, replay: true } },
      { name: 'שלושה אורות', settings: { length: 3, trials: 5, litMs: 750, gapMs: 400, repeats: false, onError: 'retry', maxRetries: 2, replay: true } },
      { name: 'ארבעה אורות', settings: { length: 4, trials: 5, litMs: 700, gapMs: 400, repeats: false, onError: 'retry', maxRetries: 1, replay: true } },
      { name: 'חמישה אורות', settings: { length: 5, trials: 5, litMs: 650, gapMs: 350, repeats: true, onError: 'retry', maxRetries: 1, replay: false } },
      { name: 'שישה ויותר', settings: { length: 6, trials: 5, litMs: 600, gapMs: 350, repeats: true, onError: 'next', maxRetries: 0, replay: false } },
    ],
    fields: [
      N('length', 'אורך הרצף', 1, 10),
      N('trials', 'מספר רצפים', 1, 20),
      N('litMs', 'משך כל אור (מ״ש)', 200, 2000, 50),
      N('gapMs', 'הפסקה בין אורות (מ״ש)', 100, 2000, 50),
      C('repeats', 'אותו אור יכול לחזור פעמיים ברצף'),
      { key: 'onError', label: 'אחרי טעות', type: 'select', options: [{ value: 'retry', label: 'מנסים שוב את אותו רצף' }, { value: 'next', label: 'עוברים לרצף הבא' }] },
      N('maxRetries', 'כמה ניסיונות חוזרים', 0, 5),
      C('replay', 'כפתור "לראות שוב" לפני שעונים'),
    ],
    make: makeSequence,
    summarize: (trials) => summarizeSeq(trials),
    metrics: [
      { key: 'firstTryPct', label: 'רצפים נכונים בניסיון ראשון', unit: '%' },
      { key: 'fullPct', label: 'רצפים שהושלמו (כולל חזרות)', unit: '%' },
      { key: 'maxLength', label: 'הרצף הארוך שהושלם' },
      { key: 'itemsToFirstError', label: 'פריטים נכונים עד הטעות' },
      { key: 'earlyPresses', label: 'לחיצות בזמן ההצגה' },
      { key: 'attemptsPerSequence', label: 'ניסיונות לרצף' },
    ],
    passed: (s) => num(s.firstTryPct) >= 80,
    demo: { length: 2, trials: 1, litMs: 800, gapMs: 450, onError: 'next', replay: false },
  },
  {
    id: 'switch',
    name: 'הכללים התחלפו!',
    short: 'גמישות מחשבתית',
    icon: 'icon-switch',
    emoji: '🔄',
    howto: () => ['c4-watch'],
    levels: [
      { name: 'החלפה אחת', settings: { blocks: 2, trialsPerBlock: 10, practice: 3, colors: 2, goPct: 50, stimMs: 1800, windowMs: 1800, isiMs: 1300, prepMs: 3000 } },
      { name: 'שתי החלפות', settings: { blocks: 3, trialsPerBlock: 8, practice: 2, colors: 2, goPct: 50, stimMs: 1500, windowMs: 1500, isiMs: 1200, prepMs: 2500 } },
      { name: 'החלפות מהירות', settings: { blocks: 4, trialsPerBlock: 6, practice: 1, colors: 2, goPct: 50, stimMs: 1300, windowMs: 1300, isiMs: 1100, prepMs: 2000 } },
      { name: 'שלושה צבעים', settings: { blocks: 4, trialsPerBlock: 8, practice: 2, colors: 3, goPct: 40, stimMs: 1500, windowMs: 1500, isiMs: 1200, prepMs: 2500 } },
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
  },
];

export const challengeById = (id: string) => CHALLENGES.find((c) => c.id === id);

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
