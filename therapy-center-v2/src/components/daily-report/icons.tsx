// Local pen-drawn icons for the daily report (the shared Icon set lacks these).
// 24×24, stroke = currentColor — same hand as src/v2/Icon.tsx.

import type { ReactNode } from 'react';

type P = { size?: number; className?: string };

function Svg({ size = 22, className, children, sw = 1.9 }: P & { children: ReactNode; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export function CupIcon(p: P) {
  return <Svg {...p}><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16 M8.5 3.5c-.6 1 .6 2 0 3 M12 3.5c-.6 1 .6 2 0 3" /></Svg>;
}

export function BoltIcon(p: P) {
  return <Svg {...p}><path d="M13 3L5.5 13.5H11L10 21l7.5-10.5H12z" /></Svg>;
}

export function BagIcon(p: P) {
  return <Svg {...p}><path d="M6 8.5h12v11H6z M9 8.5V6a3 3 0 0 1 6 0v2.5 M9 13h6" /></Svg>;
}

export function WarnIcon(p: P) {
  return <Svg {...p}><path d="M12 4l9 15.5H3z M12 10v4 M12 17h.01" /></Svg>;
}

export function SaveIcon(p: P) {
  return <Svg {...p}><path d="M5 4.5h11l3 3v12H5z M8 4.5v5h7v-5 M8 19.5v-5h8v5" /></Svg>;
}

/** A face for the lesson rating — smile / flat / frown. */
export function MoodFace({ mood, size = 30, className }: P & { mood?: string }) {
  const mouth = mood === 'good'
    ? 'M8 14c1.2 1.8 2.5 2.6 4 2.6s2.8-.8 4-2.6'
    : mood === 'hard'
      ? 'M8.3 16.3c1.1-1.4 2.3-2 3.7-2s2.6.6 3.7 2'
      : 'M8.5 15h7';
  return (
    <Svg size={size} className={className} sw={1.8}>
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" style={{ fill: 'var(--face, transparent)' }} />
      <path d="M9 10v.6 M15 10v.6" strokeWidth={2.6} />
      <path d={mouth} />
    </Svg>
  );
}
