import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { kidsApi } from '../api/client';
import Icon, { type IconName } from './Icon';
import { kidColor } from './kidColor';
import { CLASSIC_ORIGIN } from './classic';

const BASE = import.meta.env.BASE_URL;

export interface NavItem { path: string; label: string; icon: IconName; badge?: number; exact?: boolean }
export interface QuickAction { key: string; label: string; hint: string; icon: IconName; tone: string; to: (kidId: string) => string; needsKid: boolean }

interface Props {
  prefix: string;            // '' for admin, '/t/<id>' for a therapist
  primary: NavItem[];        // exactly 4: shown in the bottom bar around the + button
  more: NavItem[];           // everything else (side bar on desktop, "עוד" sheet on mobile)
  quick: QuickAction[];
  userName: string;
  userRole: string;
  onUserClick?: () => void;
  footer?: ReactNode;        // account actions (key, logout, subscription)
  children: ReactNode;
}

/** The notebook frame: paper side bar on desktop, bottom strip + quick-add on mobile. */
export default function NbNav({ prefix, primary, more, quick, userName, userRole, onUserClick, footer, children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<null | 'quick' | 'more' | { action: QuickAction }>(null);

  useEffect(() => { setSheet(null); }, [location.pathname]);
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(null); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [sheet]);

  const { data: kidsRes } = useQuery({ queryKey: ['kids'], queryFn: () => kidsApi.getAll(), enabled: !!sheet && typeof sheet === 'object' });
  const kids = kidsRes?.data || [];

  const isActive = (item: NavItem) => {
    const here = location.pathname.replace(/\/$/, '') || '/';
    const target = (prefix + item.path).replace(/\/$/, '') || '/';
    if (item.exact || item.path === '/') return here === target;
    return here === target || here.startsWith(target + '/');
  };
  const moreActive = more.some(isActive);
  // Same screen in the previous app, kept at /therapy-classic as a fallback.
  const classicHref = `${CLASSIC_ORIGIN}/therapy-classic${location.pathname}${location.search}`;

  function runQuick(a: QuickAction) {
    if (a.needsKid) setSheet({ action: a });
    else navigate(prefix + a.to(''));
  }

  const navLink = (item: NavItem, cls: string) => (
    <Link key={item.path} to={prefix + item.path} className={`${cls}${isActive(item) ? ' is-active' : ''}`} aria-current={isActive(item) ? 'page' : undefined}>
      <Icon name={item.icon} />
      <span>{item.label}</span>
      {!!item.badge && <b className="nb-badge">{item.badge}</b>}
    </Link>
  );

  return (
    <div className="nb-shell">
      {/* Desktop: paper side bar */}
      <aside className="nb-side">
        <Link to={prefix + '/'} className="nb-side-brand">
          <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" />
          <span>מרכז הטיפול</span>
        </Link>
        <button type="button" className="nb-side-quick" onClick={() => setSheet('quick')}>
          <Icon name="plus" /> פעולה חדשה
        </button>
        <nav className="nb-side-nav" aria-label="ניווט ראשי">
          {primary.map(i => navLink(i, 'nb-side-link'))}
          <div className="nb-side-sep" />
          {more.map(i => navLink(i, 'nb-side-link'))}
        </nav>
        <div className="nb-side-foot">
          <button type="button" className="nb-user" onClick={onUserClick} disabled={!onUserClick}>
            <span className="nb-user-av">{userName.charAt(0)}</span>
            <span className="nb-user-txt"><b>{userName}</b><small>{userRole}</small></span>
          </button>
          {footer}
          <a className="nb-foot-btn" href={classicHref}><Icon name="back" /> לגרסה הקודמת</a>
        </div>
      </aside>

      {/* Mobile: slim top bar */}
      <header className="nb-top">
        <Link to={prefix + '/'} className="nb-top-brand"><img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" /></Link>
        <button type="button" className="nb-top-user" onClick={() => setSheet('more')} aria-label="חשבון ועוד">
          <span className="nb-user-av">{userName.charAt(0)}</span>
        </button>
      </header>

      <main className="nb-main">{children}</main>

      {/* Mobile: bottom paper strip */}
      <nav className="nb-bottom" aria-label="ניווט ראשי">
        {primary.slice(0, 2).map(i => navLink(i, 'nb-tab'))}
        <button type="button" className="nb-fab" onClick={() => setSheet('quick')} aria-label="פעולה חדשה">
          <Icon name="plus" size={28} strokeWidth={2.4} />
        </button>
        {primary.slice(2, 3).map(i => navLink(i, 'nb-tab'))}
        <button type="button" className={`nb-tab${moreActive ? ' is-active' : ''}`} onClick={() => setSheet('more')}>
          <Icon name="more" /><span>עוד</span>
          {!!primary[3]?.badge && <b className="nb-badge">{primary[3].badge}</b>}
        </button>
      </nav>

      {/* Sheets */}
      {sheet && (
        <div className="nb-sheet-wrap" onClick={() => setSheet(null)}>
          <div className="nb-sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="nb-sheet-grip" />
            {sheet === 'quick' && (
              <>
                <h2 className="nb-sheet-title">מה <mark className="hl-yellow">עושים</mark>?</h2>
                <div className="nb-quick-grid">
                  {quick.map(a => (
                    <button type="button" key={a.key} className={`nb-quick tone-${a.tone}`} onClick={() => runQuick(a)}>
                      <Icon name={a.icon} size={26} />
                      <b>{a.label}</b>
                      <small>{a.hint}</small>
                    </button>
                  ))}
                </div>
              </>
            )}
            {typeof sheet === 'object' && (
              <>
                <h2 className="nb-sheet-title">{sheet.action.label}: <mark className="hl-pink">לאיזה ילד?</mark></h2>
                <div className="nb-kid-pick">
                  {kids.map(k => (
                    <button type="button" key={k.id} className="nb-kid-chip" onClick={() => navigate(prefix + sheet.action.to(k.id))}>
                      <span className={`nb-av tone-${kidColor(k.id)}`}>{k.name.charAt(0)}</span>
                      <b>{k.name}</b>
                    </button>
                  ))}
                  {!kids.length && <p className="nb-muted">טוען…</p>}
                </div>
                <button type="button" className="nb-btn-ghost" onClick={() => setSheet('quick')}>חזרה</button>
              </>
            )}
            {sheet === 'more' && (
              <>
                <div className="nb-more-user">
                  <span className="nb-user-av lg">{userName.charAt(0)}</span>
                  <div><b>{userName}</b><small>{userRole}</small></div>
                  {onUserClick && <button type="button" className="nb-btn-ghost sm" onClick={() => { setSheet(null); onUserClick(); }}>עריכה</button>}
                </div>
                <nav className="nb-more-list" aria-label="עוד">
                  {primary.slice(3).concat(more).map(i => navLink(i, 'nb-more-link'))}
                </nav>
                <div className="nb-more-foot" onClick={() => setSheet(null)}>
                  {footer}
                  <a className="nb-foot-btn" href={classicHref}><Icon name="back" /> לגרסה הקודמת</a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
