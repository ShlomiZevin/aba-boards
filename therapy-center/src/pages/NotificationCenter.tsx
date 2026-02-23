import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { notificationsApi, kidsApi, practitionersApi, parentsApi } from '../api/client';
import { toDate } from '../utils/date';
import type { Notification, Kid, Practitioner, Parent } from '../types';
import ConfirmModal from '../components/ConfirmModal';

export default function NotificationCenter() {
  const queryClient = useQueryClient();

  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);
  const [kidSearch, setKidSearch] = useState('');
  const [showKidDropdown, setShowKidDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const kidSearchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [notifyTargets, setNotifyTargets] = useState<Set<string>>(new Set());
  const [notifyMessage, setNotifyMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  // Queries
  const { data: notificationsRes, isLoading } = useQuery({
    queryKey: ['notifications', 'all-sent', showHidden],
    queryFn: () => notificationsApi.getAllSent({ includeHidden: showHidden }),
  });
  const notifications: Notification[] = notificationsRes?.data || [];

  const { data: kidsRes } = useQuery({
    queryKey: ['kids'],
    queryFn: () => kidsApi.getAll(),
  });
  const kids: Kid[] = kidsRes?.data || [];
  const kidMap = new Map(kids.map(k => [k.id, k.name]));

  // Filtered kids for autocomplete
  const filteredKids = kidSearch.trim()
    ? kids.filter(k => k.name.includes(kidSearch.trim()))
    : kids;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          kidSearchRef.current && !kidSearchRef.current.contains(e.target as Node)) {
        setShowKidDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [kidSearch]);

  // Team for selected kid (compose step 2)
  const { data: practitionersRes } = useQuery({
    queryKey: ['practitioners', selectedKidId],
    queryFn: () => practitionersApi.getForKid(selectedKidId!),
    enabled: !!selectedKidId,
  });
  const { data: parentsRes } = useQuery({
    queryKey: ['parents', selectedKidId],
    queryFn: () => parentsApi.getForKid(selectedKidId!),
    enabled: !!selectedKidId,
  });
  const composePractitioners: Practitioner[] = practitionersRes?.data || [];
  const composeParents: Parent[] = parentsRes?.data || [];

  // Mutations
  const sendMutation = useMutation({
    mutationFn: (data: { kidId: string; message: string; targets: { type: string; id: string; name: string }[] }) =>
      notificationsApi.send(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'all-sent'] });
      setShowCompose(false);
      setNotifyMessage('');
      setNotifyTargets(new Set());
      setSelectedKidId(null);
      setKidSearch('');
    },
  });

  const adminDismissMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.adminDismiss(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', 'all-sent'] });
      const previous = queryClient.getQueryData(['notifications', 'all-sent', showHidden]);
      queryClient.setQueryData(['notifications', 'all-sent', showHidden], (old: { data?: Notification[] } | undefined) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((n: Notification) => n.id !== id) };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications', 'all-sent', showHidden], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'all-sent'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'all-sent'] });
      setDeleteConfirm(null);
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => notificationsApi.deleteAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'all-sent'] });
    },
  });

  const toggleTarget = (key: string) => {
    setNotifyTargets(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectKid = (kid: Kid) => {
    setSelectedKidId(kid.id);
    setKidSearch(kid.name);
    setShowKidDropdown(false);
    setHighlightedIndex(-1);
    setNotifyTargets(new Set());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showKidDropdown || selectedKidId) return;
    const count = filteredKids.length;
    if (count === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % count);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + count) % count);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < count) {
        selectKid(filteredKids[highlightedIndex]);
      } else if (count === 1) {
        selectKid(filteredKids[0]);
      }
    }
  };

  const handleSend = () => {
    if (!selectedKidId || !notifyMessage.trim() || notifyTargets.size === 0) return;
    const targets = Array.from(notifyTargets).map(key => {
      const [prefix, id] = key.split(':');
      if (prefix === 'p') {
        const practitioner = composePractitioners.find((p: Practitioner) => p.id === id);
        return { type: 'practitioner', id, name: practitioner?.name || 'מטפלת' };
      } else {
        const parent = composeParents.find((p: Parent) => p.id === id);
        return { type: 'parent', id: selectedKidId, name: parent?.name || 'הורה' };
      }
    });
    sendMutation.mutate({ kidId: selectedKidId, message: notifyMessage.trim(), targets });
  };

  const handleDeleteAll = () => {
    setShowDeleteAllConfirm(false);
    deleteAllMutation.mutate();
  };

  return (
    <div className="container">
      <div className="content-card">
        <div className="content-card-header">
          <h2>מרכז הודעות</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn-primary btn-small"
              onClick={() => { setShowCompose(true); setSelectedKidId(null); setKidSearch(''); setNotifyTargets(new Set()); setNotifyMessage(''); }}
            >
              + שלח הודעה
            </button>
          </div>
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85em', color: '#64748b', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showHidden}
              onChange={e => setShowHidden(e.target.checked)}
              style={{ accentColor: '#667eea' }}
            />
            הצג גם הודעות מוסתרות
          </label>
          {notifications.length > 0 && (
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              disabled={deleteAllMutation.isPending}
              style={{ fontSize: '0.78em', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 500 }}
            >
              {deleteAllMutation.isPending ? 'מוחק...' : 'מחק הכל'}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="loading">טוען...</div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <p>{showHidden ? 'אין הודעות במערכת' : 'לא נשלחו הודעות'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {notifications.map((n: Notification) => (
              <div
                key={n.id}
                className="team-member"
                style={{
                  alignItems: 'flex-start',
                  opacity: n.dismissedByAdmin ? 0.5 : 1,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{
                      padding: '1px 8px', borderRadius: '10px', fontSize: '0.75em', fontWeight: 600,
                      background: '#f1f5f9', color: '#475569',
                    }}>
                      {kidMap.get(n.kidId) || n.kidId}
                    </span>
                    <span style={{
                      padding: '1px 8px', borderRadius: '10px', fontSize: '0.75em', fontWeight: 600,
                      background: n.recipientType === 'practitioner' ? '#ede9fe' : '#dcfce7',
                      color: n.recipientType === 'practitioner' ? '#7c3aed' : '#15803d',
                    }}>
                      {n.recipientName}
                    </span>
                    {n.read
                      ? <span style={{ fontSize: '0.7em', color: '#15803d' }}>נקרא</span>
                      : <span style={{ fontSize: '0.7em', color: '#f59e0b' }}>לא נקרא</span>
                    }
                    {n.dismissedByAdmin && (
                      <span style={{ fontSize: '0.7em', color: '#94a3b8' }}>מוסתר</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.9em', wordBreak: 'break-word' }}>{n.message}</div>
                  <div style={{ fontSize: '0.75em', color: '#94a3b8', marginTop: '2px' }}>
                    {format(toDate(n.createdAt), 'dd/MM/yyyy HH:mm')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
                  {!n.dismissedByAdmin && (
                    <button
                      onClick={() => adminDismissMutation.mutate(n.id)}
                      className="edit-btn-small"
                      title="הסתר"
                      style={{ opacity: 0.5, fontSize: '0.85em' }}
                    >👁</button>
                  )}
                  {deleteConfirm === n.id ? (
                    <>
                      <button
                        onClick={() => deleteMutation.mutate(n.id)}
                        disabled={deleteMutation.isPending}
                        style={{ padding: '2px 8px', fontSize: '0.78em', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >מחק</button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        style={{ padding: '2px 8px', fontSize: '0.78em', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >ביטול</button>
                    </>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(n.id)}
                      className="delete-btn-small"
                      title="מחק"
                    >✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="modal-overlay" onClick={() => setShowCompose(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>שליחת הודעה</h3>

            {/* Step 1: Kid autocomplete */}
            <div className="form-group">
              <label>בחר ילד/ה</label>
              <div style={{ position: 'relative' }}>
                <input
                  ref={kidSearchRef}
                  type="text"
                  value={kidSearch}
                  onChange={e => {
                    setKidSearch(e.target.value);
                    setShowKidDropdown(true);
                    if (selectedKidId) {
                      setSelectedKidId(null);
                      setNotifyTargets(new Set());
                    }
                  }}
                  onFocus={() => setShowKidDropdown(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="הקלד שם ילד..."
                  autoFocus
                  autoComplete="off"
                />
                {showKidDropdown && filteredKids.length > 0 && !selectedKidId && (
                  <div
                    ref={dropdownRef}
                    style={{
                      position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 10,
                      background: 'white', border: '1px solid #d1d5db', borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto',
                    }}
                  >
                    {filteredKids.map((k, i) => (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => selectKid(k)}
                        style={{
                          display: 'block', width: '100%', padding: '8px 12px', border: 'none',
                          background: i === highlightedIndex ? '#eef2ff' : 'transparent',
                          textAlign: 'right', cursor: 'pointer',
                          fontSize: '0.95em', color: '#334155',
                        }}
                        onMouseEnter={() => setHighlightedIndex(i)}
                      >
                        {k.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Targets */}
            {selectedKidId && (
              <div className="form-group">
                <label>נמענים</label>
                {composePractitioners.length === 0 && composeParents.length === 0 ? (
                  <p style={{ fontSize: '0.85em', color: '#94a3b8', margin: '4px 0' }}>אין צוות לילד/ה זה/ו</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {composePractitioners.map((p: Practitioner) => {
                      const key = `p:${p.id}`;
                      const selected = notifyTargets.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleTarget(key)}
                          style={{
                            padding: '4px 12px', borderRadius: '16px', fontSize: '0.85em', cursor: 'pointer',
                            border: selected ? '2px solid #7c3aed' : '1px solid #d1d5db',
                            background: selected ? '#ede9fe' : 'white',
                            color: selected ? '#7c3aed' : '#334155',
                            fontWeight: selected ? 600 : 400,
                          }}
                        >{p.name}</button>
                      );
                    })}
                    {composeParents.map((p: Parent) => {
                      const key = `par:${p.id}`;
                      const selected = notifyTargets.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleTarget(key)}
                          style={{
                            padding: '4px 12px', borderRadius: '16px', fontSize: '0.85em', cursor: 'pointer',
                            border: selected ? '2px solid #15803d' : '1px solid #d1d5db',
                            background: selected ? '#dcfce7' : 'white',
                            color: selected ? '#15803d' : '#334155',
                            fontWeight: selected ? 600 : 400,
                          }}
                        >{p.name}</button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Message */}
            {selectedKidId && notifyTargets.size > 0 && (
              <div className="form-group">
                <label>הודעה</label>
                <textarea
                  value={notifyMessage}
                  onChange={e => setNotifyMessage(e.target.value)}
                  placeholder="תוכן ההודעה..."
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowCompose(false)}>ביטול</button>
              <button
                type="button"
                className="btn-primary"
                disabled={!selectedKidId || notifyTargets.size === 0 || !notifyMessage.trim() || sendMutation.isPending}
                onClick={handleSend}
              >
                {sendMutation.isPending ? 'שולח...' : 'שלח'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAllConfirm && (
        <ConfirmModal
          title="מחיקת כל ההודעות"
          message="האם למחוק את כל ההודעות? פעולה זו אינה ניתנת לביטול."
          confirmText="מחק הכל"
          confirmStyle="danger"
          onConfirm={handleDeleteAll}
          onCancel={() => setShowDeleteAllConfirm(false)}
        />
      )}
    </div>
  );
}
