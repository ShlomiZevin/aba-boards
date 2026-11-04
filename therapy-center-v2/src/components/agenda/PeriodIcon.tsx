import type { AgendaPeriod } from '../../types';

/**
 * Hand-drawn sun / sun-behind-cloud / moon for the three parts of the day.
 * Pen outline (currentColor) over a marker fill — friendly for kids, no emoji.
 */
export default function PeriodIcon({ period, size = 40 }: { period: AgendaPeriod; size?: number }) {
  const common = {
    width: size, height: size, viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor',
    strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
  };
  if (period === 'morning') {
    return (
      <svg {...common}>
        <circle cx="24" cy="24" r="9" style={{ fill: 'var(--m-yellow)' }} />
        <path d="M24 5v5 M24 38v5 M5 24h5 M38 24h5 M10.6 10.6l3.5 3.5 M33.9 33.9l3.5 3.5 M10.6 37.4l3.5-3.5 M33.9 14.1l3.5-3.5" />
        <path d="M20.5 25.5c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2" strokeWidth={2} />
      </svg>
    );
  }
  if (period === 'noon') {
    return (
      <svg {...common}>
        <circle cx="19" cy="18" r="8" style={{ fill: 'var(--m-yellow)' }} />
        <path d="M19 4v3.5 M7.7 8.7l2.4 2.4 M5 18h3.5 M30.3 8.7l-2.4 2.4" />
        <path d="M15 38h20a7 7 0 0 0 .6-14 9 9 0 0 0-17.1 2.4A5.8 5.8 0 0 0 15 38z" style={{ fill: 'var(--m-sky)' }} />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M30 7a15 15 0 1 0 11 24A13 13 0 0 1 30 7z" style={{ fill: 'var(--m-lilac)' }} />
      <path d="M36 9.5l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z M41 19l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" strokeWidth={1.6} style={{ fill: 'var(--m-yellow)' }} />
    </svg>
  );
}
