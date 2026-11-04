import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import { GAMES } from '../games/registry';
import type { Kid } from '../types';

interface Props {
  kid: Kid;
  /** 'link' matches the desktop action row, 'toolbar' the compact header row. */
  variant?: 'link' | 'toolbar';
}

const MENU_W = 250;
const NARROW = 560;

/**
 * "Games" control for the kid's top panel. Hovering (or tapping, on touch)
 * reveals the games available for this kid; each opens on its own page.
 *
 * The menu renders into <body> and is positioned from the button's own rect,
 * clamped to the viewport — on a phone the button sits near the screen edge and
 * an absolutely-positioned dropdown would run off it. Below `NARROW` it becomes
 * a bottom sheet instead.
 */
export default function GameLauncher({ kid, variant = 'link' }: Props) {
  const navigate = useNavigate();
  const links = useTherapistLinks();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [narrow, setNarrow] = useState(() => window.innerWidth < NARROW);

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  const enabledIds = new Set(
    (kid.games || []).filter((g) => g && g.enabled !== false).map((g) => g.id)
  );

  const reposition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    setNarrow(window.innerWidth < NARROW);
    const r = btn.getBoundingClientRect();
    // Align the menu's right edge with the button's, then keep it on screen
    const left = Math.min(
      Math.max(8, r.right - MENU_W),
      window.innerWidth - MENU_W - 8
    );
    setPos({ top: r.bottom + 6, left });
  }, []);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // Hover only makes sense with a mouse; touch uses the click handler
  const hoverOpen = () => {
    if (narrow) return;
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = () => {
    if (narrow) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 200);
  };

  const go = (gameId: string) => {
    setOpen(false);
    navigate(`${links.kidDetail(kid.id)}/game/${gameId}`);
  };

  const items = GAMES.map((game) => (
    <button
      key={game.id}
      type="button"
      role="menuitem"
      className="game-menu-item"
      onClick={() => go(game.id)}
    >
      <span className="game-menu-icon">{game.icon}</span>
      <span className="game-menu-text">
        <span className="game-menu-name">{game.name}</span>
        <span className="game-menu-sub">
          {enabledIds.has(game.id) ? 'המשך משחק' : 'התחל משחק'}
        </span>
      </span>
    </button>
  ));

  const menu = narrow ? (
    <div className="game-menu-backdrop" onClick={() => setOpen(false)}>
      <div
        ref={menuRef}
        role="menu"
        className="game-menu game-menu-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="game-menu-handle" />
        {items}
      </div>
    </div>
  ) : (
    <div
      ref={menuRef}
      role="menu"
      className="game-menu"
      style={{ top: pos?.top ?? 0, left: pos?.left ?? 0 }}
      onMouseEnter={hoverOpen}
      onMouseLeave={hoverClose}
    >
      {items}
    </div>
  );

  return (
    <>
      {variant === 'link' ? (
        <button
          ref={btnRef}
          type="button"
          className="kid-action-link game-launch-btn"
          style={{ '--action-color': '#9f7aea' } as React.CSSProperties}
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={hoverOpen}
          onMouseLeave={hoverClose}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="kp-game-ic"><path d="M7 8h10a4 4 0 0 1 4 4.2l-.4 3.6a2.4 2.4 0 0 1-4.3 1.2L15 15H9l-1.3 2a2.4 2.4 0 0 1-4.3-1.2L3 12.2A4 4 0 0 1 7 8z M7.5 11v3 M6 12.5h3 M15.5 12h.01 M17.5 13.5h.01" /></svg></span>
          <span>משחקים</span>
        </button>
      ) : (
        <button
          ref={btnRef}
          type="button"
          className="kid-toolbar-btn"
          title="משחקים"
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={hoverOpen}
          onMouseLeave={hoverClose}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="kp-game-ic"><path d="M7 8h10a4 4 0 0 1 4 4.2l-.4 3.6a2.4 2.4 0 0 1-4.3 1.2L15 15H9l-1.3 2a2.4 2.4 0 0 1-4.3-1.2L3 12.2A4 4 0 0 1 7 8z M7.5 11v3 M6 12.5h3 M15.5 12h.01 M17.5 13.5h.01" /></svg><span className="toolbar-label">משחקים</span>
        </button>
      )}
      {open && createPortal(menu, document.body)}
    </>
  );
}
