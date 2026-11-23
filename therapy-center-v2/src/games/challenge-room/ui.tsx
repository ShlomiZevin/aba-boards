/**
 * Painted menu pieces (style "C - game cards", designed with GPT image 2.6 - see
 * game-assets/challenge-room/design/menus). Every piece is a blank painting; the words
 * and icons are laid in code exactly on its measured empty face (art/ui/pieces.json),
 * so every Hebrew letter is exact and nothing sits off the face.
 */
import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export const UI = Object.fromEntries(
  Object.entries(import.meta.glob('./art/ui/*.{webp,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
    .map(([p, u]) => [p.replace('./art/ui/', '').replace(/\.(webp|png)$/, ''), u])
) as Record<string, string>;

interface Face { left: number; top: number; right: number; bottom: number }
interface PieceInfo { w?: number; h?: number; width?: number; height?: number; face?: Face; slice?: number; [k: string]: unknown }
const PIECES_RAW = Object.values(import.meta.glob('./art/ui/pieces.json', { eager: true, import: 'default' }))[0] as Record<string, PieceInfo> | undefined;
const PIECES: Record<string, PieceInfo> = {};
Object.entries(PIECES_RAW || {}).forEach(([k, v]) => { PIECES[k.replace(/\.(webp|png)$/, '')] = v; });

const DEFAULT_FACE: Record<string, Face> = {
  banner: { left: 16, top: 22, right: 16, bottom: 30 },
  'banner-big': { left: 16, top: 22, right: 16, bottom: 30 },
  'btn-green': { left: 12, top: 18, right: 12, bottom: 26 },
  'btn-cream': { left: 12, top: 18, right: 12, bottom: 26 },
  'badge-stars': { left: 8, top: 22, right: 30, bottom: 22 },
  chip: { left: 6, top: 14, right: 6, bottom: 14 },
  card: { left: 13, top: 10, right: 13, bottom: 26 },
};

/** the empty face of a piece as an absolute box */
export function faceOf(name: string): Face {
  const p = PIECES[name] || PIECES[name.replace(/-(green|blue|amber|purple)$/, '-green')];
  const f = p?.face as Face | undefined;
  return f || DEFAULT_FACE[name] || DEFAULT_FACE[name.replace(/-(green|blue|amber|purple)$/, '')] || { left: 10, top: 10, right: 10, bottom: 10 };
}
export const faceStyle = (name: string): CSSProperties => {
  const f = faceOf(name);
  return { position: 'absolute', left: `${f.left}%`, top: `${f.top}%`, right: `${f.right}%`, bottom: `${f.bottom}%` };
};
export function aspectOf(name: string, fallback: number): number {
  const p = PIECES[name] || PIECES[name.replace(/-(green|blue|amber|purple)$/, '-green')];
  const w = (p?.w || p?.width) as number | undefined;
  const h = (p?.h || p?.height) as number | undefined;
  return w && h ? w / h : fallback;
}
export function sliceOf(name: string, fallback = 80): number {
  const p = PIECES[name];
  const s = (p?.slice ?? p?.corner) as number | undefined;
  return typeof s === 'number' ? s : fallback;
}

/** text that shrinks until it fits its box on one line */
export function FitText({ children, max = 30, min = 12, className = '' }: { children: ReactNode; max?: number; min?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.parentElement;
    if (!box) return;
    let size = max;
    el.style.fontSize = `${size}px`;
    while (size > min && (el.scrollWidth > box.clientWidth || el.scrollHeight > box.clientHeight * 1.15)) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  });
  return <span ref={ref} className={`cr-fit ${className}`}>{children}</span>;
}

export function Banner({ text, big = false, max, className = '' }: { text: string; big?: boolean; max?: number; className?: string }) {
  const name = big ? 'banner-big' : 'banner';
  return (
    <div className={`cr-pbanner${big ? ' is-big' : ''} ${className}`} style={{ aspectRatio: String(aspectOf(name, big ? 1000 / 260 : 900 / 200)) }}>
      {UI[name] ? <img src={UI[name]} alt="" draggable={false} /> : <i className="cr-pbanner-fallback" />}
      <div className="cr-face" style={faceStyle(name)}><FitText max={max ?? (big ? 40 : 26)}>{text}</FitText></div>
    </div>
  );
}

export function PaintButton({ kind, children, icon, onClick, className = '', ...rest }: { kind: 'green' | 'cream'; children: ReactNode; icon?: ReactNode; onClick?: () => void; className?: string; [k: string]: unknown }) {
  const name = `btn-${kind}`;
  return (
    <button type="button" className={`cr-pbtn is-${kind} ${className}`} onClick={onClick} style={{ aspectRatio: String(aspectOf(name, 900 / 220)) }} {...rest}>
      {UI[name] ? <img src={UI[name]} alt="" draggable={false} /> : <i className="cr-pbtn-fallback" />}
      <div className="cr-face" style={faceStyle(name)}>
        {icon && <span className="cr-pbtn-icon">{icon}</span>}
        <FitText max={30}>{children}</FitText>
      </div>
    </button>
  );
}

export function IconButton({ name, label, onClick, fallback }: { name: string; label: string; onClick?: () => void; fallback: string }) {
  return (
    <button type="button" className="cr-ibtn" onClick={onClick} aria-label={label} title={label}>
      {UI[`ib-${name}`] ? <img src={UI[`ib-${name}`]} alt="" draggable={false} /> : <span>{fallback}</span>}
    </button>
  );
}

export function Stars({ n, of = 3, className = '' }: { n: number; of?: number; className?: string }) {
  return (
    <span className={`cr-pstars ${className}`} aria-label={`${n} כוכבים מתוך ${of}`}>
      {Array.from({ length: of }).map((_, k) => (
        UI['star-full'] ? <img key={k} src={UI[k < n ? 'star-full' : 'star-empty']} alt="" draggable={false} style={{ animationDelay: `${k * 0.12}s` }} />
          : <b key={k} className={k < n ? 'on' : ''}>★</b>
      ))}
    </span>
  );
}

export type CardColor = 'green' | 'blue' | 'amber' | 'purple';

/** a challenge card: painted frame, the icon in its window, the name on a banner, stars in a tray */
export function Card({ color, icon, name, stars, onClick, big = false, sub }: { color: CardColor; icon?: string; name: string; stars: number; onClick?: () => void; big?: boolean; sub?: ReactNode }) {
  const frame = `card-${color}`;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`cr-pcard is-${color}${big ? ' is-big' : ''}`} onClick={onClick} style={{ aspectRatio: String(aspectOf(frame, 3 / 4)) }}>
      {UI[frame] ? <img className="cr-pcard-frame" src={UI[frame]} alt="" draggable={false} /> : <i className="cr-pcard-fallback" />}
      <div className="cr-pcard-window" style={faceStyle(frame)}>
        {icon && <img className="cr-pcard-icon" src={icon} alt="" draggable={false} />}
      </div>
      <div className="cr-pcard-banner"><Banner text={name} max={big ? 30 : 20} /></div>
      <div className="cr-pcard-tray">
        {UI['star-tray'] && <img src={UI['star-tray']} alt="" draggable={false} />}
        <Stars n={stars} />
      </div>
      {sub}
    </Tag>
  );
}

/** a framed panel that stretches (CSS border-image from the painted panel) */
export function Panel({ amber = false, children, className = '' }: { amber?: boolean; children: ReactNode; className?: string }) {
  const name = amber ? 'panel-amber' : 'panel';
  const url = UI[name];
  const slice = sliceOf(name);
  // the painted corners drawn at ~36px: big enough to read as ornaments, small enough to leave the face room
  const bw = Math.round(slice * 0.24);
  const style: CSSProperties = url ? { borderImage: `url(${url}) ${slice} fill / ${bw}px stretch`, borderStyle: 'solid', borderWidth: `${bw}px` } : {};
  return <div className={`cr-ppanel${amber ? ' is-amber' : ''}${url ? ' has-art' : ''} ${className}`} style={style}>{children}</div>;
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <div className="cr-pchip" style={{ aspectRatio: String(aspectOf('chip', 600 / 170)) }}>
      {UI.chip ? <img src={UI.chip} alt="" draggable={false} /> : <i className="cr-pchip-fallback" />}
      <div className="cr-face cr-pchip-face" style={faceStyle('chip')}>{children}</div>
    </div>
  );
}

export function StarsBadge({ n }: { n: number }) {
  return (
    <div className="cr-pbadge" style={{ aspectRatio: String(aspectOf('badge-stars', 420 / 130)) }} aria-label={`${n} כוכבים`}>
      {UI['badge-stars'] ? <img src={UI['badge-stars']} alt="" draggable={false} /> : <i className="cr-pbadge-fallback">⭐</i>}
      <div className="cr-face" style={faceStyle('badge-stars')}><FitText max={22}>{n}</FitText></div>
    </div>
  );
}
