import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatHistoryApi } from '../api/client';
import type { ChatConversationSummary } from '../api/client';
import Icon from '../v2/Icon';
import type { Tone } from '../v2/kidColor';
import '../v2/pages/tm.css';

type RoleFilter = 'all' | 'therapist' | 'parent' | 'admin';

interface Props {
  isSuperAdmin: boolean;
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}

const ROLE_TONE: Record<ChatConversationSummary['ownerType'], Tone> = {
  therapist: 'lilac',
  parent: 'peach',
  admin: 'sky',
};

function relTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  if (days <= 0 && new Date().toDateString() === d.toDateString()) return `היום ${time}`;
  if (days <= 1) return `אתמול ${time}`;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

function daysLeft(iso: string | null) {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

export default function ChatHistoryPanel({ isSuperAdmin, activeId, onOpen, onNew, onDeleted, onClose }: Props) {
  const qc = useQueryClient();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [role, setRole] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['chat-history', scope],
    queryFn: () => chatHistoryApi.list(scope),
  });
  const remove = useMutation({
    mutationFn: (id: string) => chatHistoryApi.remove(id),
    onSuccess: (_r, id) => { qc.invalidateQueries({ queryKey: ['chat-history'] }); onDeleted(id); },
  });

  const q = search.trim().toLowerCase();
  const list = (res?.data || []).filter(c =>
    (scope === 'mine' || role === 'all' || c.ownerType === role) &&
    (!q || [c.title, c.ownerName, c.kidName].some(v => (v || '').toLowerCase().includes(q))));

  const roleChips: { key: RoleFilter; label: string }[] = [
    { key: 'all', label: 'כולם' },
    { key: 'therapist', label: 'מטפלות' },
    { key: 'parent', label: 'הורים' },
    { key: 'admin', label: 'מנהלים' },
  ];

  return (
    <>
      <div className="chat-history-backdrop" onClick={onClose} />
      <aside className="chat-history-panel" role="dialog" aria-modal="true" aria-labelledby="tm-hist-title">
        <div className="tm-hist-head">
          <h2 id="tm-hist-title">היסטוריית שיחות</h2>
          <button type="button" className="tm-ic" onClick={onClose} aria-label="סגירה"><Icon name="close" /></button>
        </div>

        <button type="button" className="nb-btn block" onClick={onNew}><Icon name="plus" /> שיחה חדשה</button>

        {isSuperAdmin && (
          <div className="tm-chips" role="group" aria-label="אילו שיחות">
            <button type="button" className={`tm-pick${scope === 'mine' ? ' is-on' : ''}`} aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>השיחות שלי</button>
            <button type="button" className={`tm-pick${scope === 'all' ? ' is-on' : ''}`} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>כל השיחות</button>
          </div>
        )}
        {scope === 'all' && (
          <div className="tm-chips" role="group" aria-label="סינון לפי תפקיד">
            {roleChips.map(r => (
              <button key={r.key} type="button" className={`tm-pick${role === r.key ? ' is-on' : ''}`} aria-pressed={role === r.key} onClick={() => setRole(r.key)}>{r.label}</button>
            ))}
          </div>
        )}
        <label className="tm-hist-search">
          <Icon name="search" size={20} />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={scope === 'all' ? 'חיפוש לפי שם, ילד/ה או נושא' : 'חיפוש בשיחות'}
          />
        </label>

        <div className="chat-history-list">
          {isLoading ? (
            <div className="chat-history-empty">טוען…</div>
          ) : list.length === 0 ? (
            <div className="chat-history-empty">אין שיחות שמורות</div>
          ) : list.map(c => {
            const left = daysLeft(c.expiresAt);
            return (
              <div key={c.id} className={`tm-hist-item${c.id === activeId ? ' active' : ''}`}>
                <button type="button" className="tm-hist-open" onClick={() => onOpen(c.id)}>
                  <b>{c.title}</b>
                  <span className="tm-hist-meta">
                    {scope === 'all' && (
                      <span className={`nb-chip tone-${ROLE_TONE[c.ownerType]}`}>{c.ownerRole} · {c.ownerName}</span>
                    )}
                    {c.kidName && <span>{c.kidName}</span>}
                    <span>{relTime(c.updatedAt)}</span>
                    {left !== null && left <= 3 && <span className="tm-hist-exp">נמחקת בעוד {left} ימים</span>}
                  </span>
                </button>
                <button
                  type="button"
                  className="tm-ic danger"
                  title="מחיקת שיחה"
                  aria-label={`מחיקת השיחה ${c.title}`}
                  onClick={() => { if (confirm('למחוק את השיחה לצמיתות?')) remove.mutate(c.id); }}
                ><Icon name="trash" size={20} /></button>
              </div>
            );
          })}
        </div>
        <div className="chat-history-foot">שיחות נשמרות 14 יום מההודעה האחרונה</div>
      </aside>
    </>
  );
}
