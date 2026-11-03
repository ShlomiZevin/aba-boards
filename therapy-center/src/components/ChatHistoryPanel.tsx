import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatHistoryApi } from '../api/client';
import type { ChatConversationSummary } from '../api/client';

type RoleFilter = 'all' | 'therapist' | 'parent' | 'admin';

interface Props {
  isSuperAdmin: boolean;
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}

const ROLE_COLORS: Record<ChatConversationSummary['ownerType'], string> = {
  therapist: '#7c3aed',
  parent: '#d97706',
  admin: '#2D4A53',
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
      <aside className="chat-history-panel">
        <div className="chat-history-head">
          <strong>היסטוריית שיחות</strong>
          <button className="chat-clear-btn" onClick={onClose} aria-label="סגירה">✕</button>
        </div>

        <button className="chat-history-new" onClick={onNew}>＋ שיחה חדשה</button>

        {isSuperAdmin && (
          <div className="chat-history-tabs">
            <button className={scope === 'mine' ? 'active' : ''} onClick={() => setScope('mine')}>השיחות שלי</button>
            <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>כל השיחות</button>
          </div>
        )}
        {scope === 'all' && (
          <div className="chat-history-chips">
            {roleChips.map(r => (
              <button key={r.key} className={role === r.key ? 'active' : ''} onClick={() => setRole(r.key)}>{r.label}</button>
            ))}
          </div>
        )}
        <input
          className="chat-history-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={scope === 'all' ? 'חיפוש לפי שם, ילד/ה או נושא' : 'חיפוש בשיחות'}
        />

        <div className="chat-history-list">
          {isLoading ? (
            <div className="chat-history-empty">טוען…</div>
          ) : list.length === 0 ? (
            <div className="chat-history-empty">אין שיחות שמורות</div>
          ) : list.map(c => {
            const left = daysLeft(c.expiresAt);
            return (
              <div key={c.id} className={`chat-history-item ${c.id === activeId ? 'active' : ''}`} onClick={() => onOpen(c.id)}>
                <div className="chat-history-item-title">{c.title}</div>
                <div className="chat-history-item-meta">
                  {scope === 'all' && (
                    <span className="chat-history-role" style={{ background: ROLE_COLORS[c.ownerType] }}>
                      {c.ownerRole} · {c.ownerName}
                    </span>
                  )}
                  {c.kidName && <span>👧 {c.kidName}</span>}
                  <span>{relTime(c.updatedAt)}</span>
                  {left !== null && left <= 3 && <span className="chat-history-expiring">נמחקת בעוד {left} ימים</span>}
                </div>
                <button
                  className="chat-history-delete"
                  title="מחיקת שיחה"
                  onClick={e => { e.stopPropagation(); if (confirm('למחוק את השיחה לצמיתות?')) remove.mutate(c.id); }}
                >🗑</button>
              </div>
            );
          })}
        </div>
        <div className="chat-history-foot">שיחות נשמרות 14 יום מההודעה האחרונה</div>
      </aside>
    </>
  );
}
