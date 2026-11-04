// Shared inbox look for the admin message centre and the therapist's messages page.
import type { ReactNode } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import type { Kid } from '../../types';
import KidAvatar from '../KidAvatar';
import './cm.css';

export function inboxWhen(d: Date) {
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `אתמול · ${format(d, 'HH:mm')}`;
  return format(d, 'd/M/yy · HH:mm');
}

/** Eye with a slash — "hide" (not in the shared icon set). */
export function HideIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12s3.2-6 9-6c1.6 0 3 .4 4.2 1.1 M21 12s-3.2 6-9 6c-1.6 0-3-.4-4.2-1.1 M9.9 14.1A3 3 0 0 1 14.1 9.9 M4 20L20 4" />
    </svg>
  );
}

export function InboxRow({ unread, kid, kidId, kidName, who, message, date, tags, actions, dim }: {
  unread: boolean;
  kid?: Kid;
  kidId: string;
  kidName: string;
  who?: ReactNode;
  message: string;
  date: Date;
  tags?: ReactNode;
  actions?: ReactNode;
  dim?: boolean;
}) {
  return (
    <li className={`cm-msg${unread ? ' is-unread' : ''}${dim ? ' is-dim' : ''}`}>
      <span className="cm-msg-av">
        {kid ? <KidAvatar kid={kid} size="sm" /> : <span className="nb-av sm tone-lilac" aria-hidden="true">{(kidName || '?').charAt(0)}</span>}
        {unread && <i className="cm-pen-dot" aria-label="לא נקרא" />}
      </span>
      <div className="cm-msg-body">
        <div className="cm-msg-top">
          <span className="cm-msg-who">{who}{who ? ' · ' : ''}על <mark className={`hl-${kidId ? 'yellow' : 'lilac'}`}>{kidName || 'ילד/ה'}</mark></span>
          <time className="cm-msg-when tabular">{inboxWhen(date)}</time>
        </div>
        <p className="cm-msg-text">{message}</p>
        {(tags || actions) && (
          <div className="cm-msg-foot">
            <span className="cm-msg-tags">{tags}</span>
            {actions && <span className="cm-msg-actions">{actions}</span>}
          </div>
        )}
      </div>
    </li>
  );
}

export function InboxEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="cm-inbox-empty">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3.5 7.5h17v11h-17z M3.5 7.5l8.5 6 8.5-6" />
      </svg>
      <p className="hand">{children}</p>
    </div>
  );
}
