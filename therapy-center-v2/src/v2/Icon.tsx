// One line-icon set for the whole v2 app (replaces the emoji icons).
// 24×24, stroke = currentColor, round caps — reads like a pen drawing.

const PATHS: Record<string, string> = {
  today: 'M4 6.5h16v13H4z M4 10h16 M8 4v4 M16 4v4 M8.5 14.5l2 2 4-4',
  kids: 'M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11z M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5 M16 11a2.6 2.6 0 1 0 0-5.2 M17.2 14.6c1.9.4 3 1.9 3.4 4.4',
  calendar: 'M4 6h16v14H4z M4 10h16 M8 3.5v4 M16 3.5v4 M8 14h2 M12 14h2 M8 17h2',
  more: 'M4.2 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0 M10.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0 M16.6 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0',
  plus: 'M12 5v14 M5 12h14',
  close: 'M6 6l12 12 M18 6L6 18',
  chat: 'M5 5h14v10H10l-4 4v-4H5z',
  bell: 'M6.5 16V11a5.5 5.5 0 0 1 11 0v5l1.5 2h-14z M10 20.5h4',
  form: 'M6 3.5h9l3 3v14H6z M9 10h6 M9 13.5h6 M9 17h4',
  team: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 19c.5-3 2.4-4.6 5-4.6s4.5 1.6 5 4.6 M16 10.5a2.5 2.5 0 1 0 0-5 M15.5 14.3c2.6 0 4.5 1.6 5 4.7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3.5 2',
  book: 'M4 5.5c2.7-1 5.3-1 8 .7 2.7-1.7 5.3-1.7 8-.7v13c-2.7-1-5.3-1-8 .7-2.7-1.7-5.3-1.7-8-.7z M12 6.2v13',
  sparkle: 'M12 3.5l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8z M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z M12 12h.01',
  blocks: 'M4 13h7v7H4z M13 13h7v7h-7z M8.5 4h7v7h-7z',
  phone: 'M8 3h8v18H8z M11 18h2',
  key: 'M8 15a4 4 0 1 1 3.5-6h8.5v3h-2v2.5h-3V12h-3.5A4 4 0 0 1 8 15z',
  logout: 'M10 4H5v16h5 M14 8l4 4-4 4 M18 12H9',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M16 16l4.5 4.5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevron: 'M14.5 6l-6 6 6 6',
  back: 'M9.5 6l6 6-6 6',
  play: 'M8 5.5v13l10.5-6.5z',
  chart: 'M4 19.5h16 M6.5 16l4-5 3.5 3 4.5-6.5',
  home: 'M4 11l8-6.5 8 6.5v9H4z M10 20v-5h4v5',
  agenda: 'M5 4.5h14v15H5z M8.5 9h7 M8.5 12.5h7 M8.5 16h4',
  report: 'M6 3.5h12v17H6z M9 8h6 M9 11.5l1.5 1.5L13.5 10 M9 16h6',
  sign: 'M4 18c2.5-.2 3.8-4 5.5-8 1-2.3 2.6-2.6 2.8-.8.3 2.5-2.3 8.8-.6 8.8 1.3 0 2-2.8 3.3-2.8 1 0 1 1.8 2.3 1.8H20',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  trash: 'M5 7h14 M9.5 7V4.5h5V7 M7 7l1 13h8l1-13',
  edit: 'M4.5 19.5l1-4.5L15.5 5l3.5 3.5-10 10z M13.5 7l3.5 3.5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M12 3v2.5 M12 18.5V21 M3 12h2.5 M18.5 12H21 M5.6 5.6l1.8 1.8 M16.6 16.6l1.8 1.8 M5.6 18.4l1.8-1.8 M16.6 7.4l1.8-1.8',
  board: 'M4 4.5h16v15H4z M8 9h3 M8 13h3 M14 9h2 M14 13h2',
  star: 'M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z',
  camera: 'M4 8h3.5l1.5-2.5h6L16.5 8H20v11H4z M12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
  mic: 'M12 14.5a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5.5a3 3 0 0 0 3 3z M6.5 11a5.5 5.5 0 0 0 11 0 M12 16.5V20 M9 20h6',
  film: 'M4 5h16v14H4z M8 5v14 M16 5v14 M4 9h4 M4 15h4 M16 9h4 M16 15h4',
  image: 'M4 5h16v14H4z M4 16l4.5-4.5 3.5 3.5 2.5-2.5L20 17.5 M15.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  download: 'M12 4v11 M7.5 10.5L12 15l4.5-4.5 M5 19.5h14',
  share: 'M12 15V4 M8 7.5L12 3.5l4 4 M6 11v8.5h12V11',
  refresh: 'M19 12a7 7 0 1 1-2-4.9 M19 4.5v3.5h-3.5',
  stop: 'M7 7h10v10H7z',
};

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 22, className, strokeWidth = 1.9 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
