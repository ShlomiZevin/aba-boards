/**
 * Menus v2 ("Robot's toy room", game-assets/challenge-room/design/v2/final): every menu screen
 * is its painted PLATE shown whole (contain, a 2:3 stage centred in the phone column, the same
 * plate blurred behind it so there are no bars). On top go only invisible hit areas on the
 * painted buttons and the text / pieces that change - all at the measured boxes of
 * <screen>.layout.json (% of the 1024x1536 canvas).
 */
import type { CSSProperties, ReactNode } from 'react';

export const V2 = Object.fromEntries(
  Object.entries(import.meta.glob('./art/v2/*.{webp,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
    .map(([p, u]) => [p.replace('./art/v2/', '').replace(/\.(webp|png)$/, ''), u])
) as Record<string, string>;

/** a box in % of the canvas */
export interface Box { left: number; top: number; width: number; height: number }

export const L = {
  home: {
    settings: { left: 2.93, top: 1.43, width: 11.72, height: 7.81 },
    sound: { left: 15.62, top: 1.43, width: 11.52, height: 7.68 },
    soundCircle: { left: 14.65, top: 1.73, width: 11.91, height: 7.94 },
    back: { left: 85.25, top: 1.3, width: 11.91, height: 7.81 },
    name: { left: 33.01, top: 15.49, width: 33.98, height: 5.47 },
    cards: {
      light: { left: 7.81, top: 36.78, width: 41.5, height: 25.07 },
      gonogo: { left: 50.0, top: 38.28, width: 43.26, height: 23.44 },
      sequence: { left: 4.39, top: 64.97, width: 44.92, height: 26.04 },
      switch: { left: 50.0, top: 64.32, width: 44.92, height: 26.69 },
    } as Record<string, Box>,
    stars: {
      light: { left: 17.58, top: 56.77, width: 22.17, height: 3.97 },
      gonogo: { left: 60.45, top: 56.84, width: 22.95, height: 3.97 },
      sequence: { left: 15.33, top: 85.48, width: 23.54, height: 4.23 },
      switch: { left: 60.64, top: 85.68, width: 23.73, height: 4.1 },
    } as Record<string, Box>,
  },
  intro: {
    sound: { left: 2.93, top: 1.3, width: 11.52, height: 7.81 },
    soundCircle: { left: 2.62, top: 1.1, width: 12.1, height: 8.07 },
    back: { left: 85.25, top: 1.3, width: 11.91, height: 7.81 },
    // the machine stands on the table top (y = 625px)
    machine: { left: 39.75, top: 11.72, width: 49.61, height: 28.97 },
    // measured on the painting (intro.png): the dark socket, the pad in it, the hands
    socketPress: { left: 20.02, top: 45.05, width: 22.07, height: 13.93 },
    socketNogo: { left: 58.2, top: 45.05, width: 22.07, height: 13.93 },
    padPress: { left: 21.78, top: 46.42, width: 18.95, height: 12.63 },
    handPress: { left: 24.66, top: 38.41, width: 13.18, height: 14.84 },
    padNogo: { left: 59.08, top: 46.42, width: 18.95, height: 12.63 },
    handNogo: { left: 62.6, top: 43.6, width: 14.6, height: 12.0 },
    play: { left: 2.15, top: 80.6, width: 49.41, height: 14.45 },
    explain: { left: 52.93, top: 81.71, width: 44.24, height: 12.7 },
  },
  pause: {
    cont: { left: 17.09, top: 46.35, width: 64.45, height: 13.67 },
    stop: { left: 19.53, top: 61.52, width: 59.57, height: 10.87 },
  },
  end: {
    stars: [
      { left: 62.7, top: 52.47, width: 20.31, height: 12.76 },
      { left: 37.89, top: 48.7, width: 24.22, height: 15.23 },
      { left: 16.89, top: 52.47, width: 20.41, height: 12.76 },
    ],
    again: { left: 4.69, top: 66.08, width: 43.95, height: 17.25 },
    all: { left: 49.8, top: 66.28, width: 45.41, height: 17.06 },
    stats: { left: 6.05, top: 86.46, width: 87.89, height: 9.38 },
  },
  rules: {
    // the card is cut in bands so a third colour gets its own painted row (spec.md)
    topEnd: 43.2,
    bands: { press: [43.2, 62.8], nogo: [62.8, 82.4] } as Record<'press' | 'nogo', [number, number]>,
    // pads / hands in % of the canvas, relative to their band's top
    pad: { left: 16.8, top: 2.24, width: 23.05, height: 15.36 },
    // the hands as painted in rules.png: the pointing hand from the lower left, the open hand tilted
    handPress: { left: 15.48, top: 6.8, width: 12.6, height: 14.2 },
    handNogo: { left: 14.26, top: 6.24, width: 16.8, height: 13.85 },
  },
};

/** machine pieces: pixel size (aspect) + the star tray inside the piece (% of the piece) */
export const MACHINES: Record<string, { w: number; h: number; tray: Box }> = {
  light: { w: 999, h: 1007, tray: { left: 21.0, top: 79.5, width: 57.1, height: 13.6 } },
  gonogo: { w: 1017, h: 898, tray: { left: 21.4, top: 77.5, width: 56.7, height: 15.4 } },
  sequence: { w: 1016, h: 862, tray: { left: 22.7, top: 77.7, width: 53.3, height: 14.8 } },
  switch: { w: 999, h: 931, tray: { left: 20.9, top: 80.2, width: 57.3, height: 13.3 } },
  base: { w: 1018, h: 980, tray: { left: 21.0, top: 76.4, width: 57.6, height: 14.7 } },
  wait: { w: 1022, h: 887, tray: { left: 20.5, top: 76.6, width: 58.4, height: 16.5 } },
};

export const boxStyle = (b: Box, extra?: CSSProperties): CSSProperties => ({
  position: 'absolute', left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%`, ...extra,
});

/** a screen = its plate, contained in the phone, the same plate blurred behind it */
export function Plate({ src, children, className = '', below }: { src: string; children?: ReactNode; className?: string; below?: ReactNode }) {
  return (
    <div className={`cr-plate-wrap ${className}`} style={{ '--plate': `url(${src})` } as CSSProperties}>
      <div className="cr-plate-bg" aria-hidden />
      <div className="cr-plate">
        <img className="cr-plate-img" src={src} alt="" draggable={false} />
        {children}
      </div>
      {below && <div className="cr-plate-below">{below}</div>}
    </div>
  );
}

/** an overlay piece (pause / rules card): the same 2:3 stage, no plate behind */
export function Stage({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <div className={`cr-stage ${className}`}><div className="cr-plate">{children}</div></div>;
}

/** an invisible button exactly over a painted one */
export function Hit({ box, label, onClick, shape = 'round', id, className = '' }: { box: Box; label: string; onClick: () => void; shape?: 'round' | 'circle' | 'card'; id: string; className?: string }) {
  return (
    <button type="button" className={`cr-hit is-${shape} ${className}`} data-hit={id} aria-label={label} title={label}
      style={boxStyle(box)} onClick={onClick}
      onPointerDown={(e) => {
        // a brief brightening of the painted button itself (no outline, no new box)
        const el = e.currentTarget;
        el.classList.remove('is-pressed');
        void el.offsetWidth;
        el.classList.add('is-pressed');
        window.setTimeout(() => el.classList.remove('is-pressed'), 260);
      }} />
  );
}

/** a piece laid in a box, contained (centred, or standing on the bottom) */
export function Piece({ src, box, bottom = false, className = '', style }: { src?: string; box: Box; bottom?: boolean; className?: string; style?: CSSProperties }) {
  if (!src) return null;
  return <img className={`cr-piece${bottom ? ' is-bottom' : ''} ${className}`} src={src} alt="" draggable={false} style={boxStyle(box, style)} />;
}

/** three stars in a box, the first on the RIGHT (RTL) */
export function TrayStars({ n, box, pop = true }: { n: number; box: Box; pop?: boolean }) {
  return (
    <div className={`cr-tray${pop ? ' is-pop' : ''}`} style={boxStyle(box)} aria-label={`${n} כוכבים מתוך 3`}>
      {[0, 1, 2].map((k) => (
        <img key={k} src={V2[k < n ? 'star-full' : 'star-empty']} alt="" draggable={false} style={{ animationDelay: `${0.25 + k * 0.08}s` }} />
      ))}
    </div>
  );
}

export interface RuleRow { color: string; press: boolean }

/**
 * The rules card over the dimmed game: rules-card.png cut into bands (top, one painted row per
 * colour, bottom). Two colours = the painting exactly; a third colour clones its row's band
 * and the card shrinks to 88% (spec.md). The first rule shows the "הכלל" variant of the title.
 */
export function RulesCard({ chips, first }: { chips: RuleRow[]; first: boolean }) {
  const src = V2[first ? 'rules-card-first' : 'rules-card'];
  const R = L.rules;
  const rows = chips.length ? chips : [{ color: 'green', press: true }, { color: 'red', press: false }];
  const BAND = R.bands.press[1] - R.bands.press[0];
  const total = 100 + Math.max(0, rows.length - 2) * BAND;
  const scale = rows.length > 2 ? 0.88 : 1;
  // keep the visible card (robot antenna 4.4% .. card bottom ~86.6%) centred
  const visTop = 4.4, visBottom = total - (100 - 86.6);
  const offset = rows.length > 2 ? 50 - ((visTop + visBottom) / 2) * scale : 0;
  const pct = (v: number) => `${(v / total) * 100}%`;
  // a slice of the card: [from, end] of the painting drawn at `at`. Plain slices run 0.4% past
  // their end (under the next one) so no hairline shows. `mid` = only the row (x 12.9..87.1%),
  // reaching `ext` into its neighbours and fading there, so the cream joins without a line.
  const slice = (from: number, end: number, at: number, key: string, mid = false, ext = 0) => {
    const f = from - ext, to = Math.min(100, mid ? end + ext : end + 0.4), h = to - f;
    const l = mid ? 12.9 : 0, w = mid ? 74.2 : 100;
    const fade = ext ? `${(ext / h) * 100}%` : '';
    const mask = ext ? `linear-gradient(to bottom, transparent 0, #000 ${fade}, #000 calc(100% - ${fade}), transparent 100%)` : undefined;
    return (
      <div key={key} className="cr-rc-slice" style={{ top: pct(at - ext), height: pct(h), left: `${l}%`, width: `${w}%`, WebkitMaskImage: mask, maskImage: mask }}>
        <img src={src} alt="" draggable={false} style={{ top: `${(-f / h) * 100}%`, height: `${(100 / h) * 100}%`, left: `${(-l / w) * 100}%`, width: `${(100 / w) * 100}%` }} />
      </div>
    );
  };
  // two colours = the painting itself, uncut
  const asPainted = rows.length === 2 && rows[0].press && !rows[1].press;
  // more: the painting down to the end of the first row, the extra rows (the card's straight
  // sides + the row cloned from its band), then the painting from the last row down
  const firstEnd = R.bands.press[1];
  const parts: ReactNode[] = [slice(0, firstEnd, 0, 'top')];
  const pieces: ReactNode[] = [];
  const mids: ReactNode[] = [];
  rows.forEach((c, k) => {
    const at = R.topEnd + k * BAND;
    if (k > 0 && k < rows.length - 1) {
      const [from, to] = R.bands[c.press ? 'press' : 'nogo'];
      parts.push(slice(55, 55 + BAND, at, `bg${k}`));
      mids.push(slice(from, to, at, `row${k}`, true, 0.5));
    }
    const pb = (b: Box): CSSProperties => ({ position: 'absolute', left: `${b.left}%`, width: `${b.width}%`, top: pct(at + b.top), height: pct(b.height) });
    pieces.push(<img key={`p${k}`} className="cr-piece" src={V2[`pad-${c.color}`]} alt="" style={pb(R.pad)} />);
    pieces.push(c.press
      ? <img key={`h${k}`} className="cr-piece cr-rc-hand-press" src={V2['hand-press']} alt="" style={pb(R.handPress)} />
      : <img key={`h${k}`} className="cr-piece cr-rc-hand-stop" src={V2['hand-stop']} alt="" style={pb(R.handNogo)} />);
  });
  parts.push(slice(firstEnd, 100, firstEnd + Math.max(0, rows.length - 2) * BAND, 'bottom'));
  parts.push(...mids); // the cloned rows last: their soft edges lie over both neighbours
  return (
    <div className="cr-stage cr-rules-stage">
      <div className="cr-plate">
        <div className="cr-rc" style={{ left: `${(100 - scale * 100) / 2}%`, width: `${scale * 100}%`, top: `${offset}%`, height: `${(total / 100) * scale * 100}%` }}>
          {asPainted ? <img className="cr-plate-img" src={src} alt="" draggable={false} /> : parts}
          {pieces}
        </div>
      </div>
    </div>
  );
}

/** Fredoka from Google Fonts, once (Varela Round as the fallback) */
let fontsAdded = false;
export function useMenuFont() {
  if (fontsAdded || typeof document === 'undefined') return;
  fontsAdded = true;
  if (document.querySelector('link[data-cr-font]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Varela+Round&display=swap';
  l.setAttribute('data-cr-font', '1');
  document.head.appendChild(l);
}
