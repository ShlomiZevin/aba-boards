import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, kidsApi, practitionersApi, parentsApi } from '../api/client';
import { toDate } from '../utils/date';
import type { Notification, Kid, Practitioner, Parent } from '../types';
import ConfirmModal from '../components/ConfirmModal';
import Icon from '../v2/Icon';
import KidAvatar from '../v2/KidAvatar';
import { InboxRow, InboxEmpty, HideIcon } from '../v2/pages/CmInbox';

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
  const kidById = new Map(kids.map(k => [k.id, k]));

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

  const openCompose = () => { setShowCompose(true); setSelectedKidId(null); setKidSearch(''); setNotifyTargets(new Set()); setNotifyMessage(''); };
  const unreadCount = notifications.filter(n => !n.read && !n.dismissedByAdmin).length;
  const selectedKid = selectedKidId ? kidById.get(selectedKidId) : undefined;

  return (
    <div className="cm-inbox">
      <header className="cm-head">
        <div className="cm-head-title">
          <h1 className="nb-h1"><mark className="hl-sky">הודעות</mark></h1>
          <p className="nb-muted">
            מה ששלחת לצוות ולהורים
            {unreadCount > 0 && <> · <b className="cm-ink">{unreadCount === 1 ? 'אחת עוד לא נקראה' : `${unreadCount} עוד לא נקראו`}</b></>}
          </p>
        </div>
        <button type="button" className="nb-btn cm-head-add" onClick={openCompose}>
          <Icon name="edit" /> הודעה חדשה
        </button>
      </header>

      <div className="cm-controls">
        <label className={`cm-toggle-chip${showHidden ? ' is-on' : ''}`}>
          <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />
          <HideIcon size={16} /> הצג גם הודעות מוסתרות
        </label>
        {notifications.length > 0 && (
          <button
            type="button"
            className="nb-btn-ghost sm cm-danger-ghost"
            onClick={() => setShowDeleteAllConfirm(true)}
            disabled={deleteAllMutation.isPending}
          >
            <Icon name="trash" size={16} /> {deleteAllMutation.isPending ? 'מוחק...' : 'מחק הכל'}
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="hand nb-muted cm-loading">טוען הודעות…</p>
      ) : notifications.length === 0 ? (
        <InboxEmpty>{showHidden ? 'אין הודעות במערכת' : 'לא נשלחו הודעות עדיין'}</InboxEmpty>
      ) : (
        <ul className="cm-msgs">
          {notifications.map((n: Notification) => (
            <InboxRow
              key={n.id}
              unread={!n.read && !n.dismissedByAdmin}
              dim={n.dismissedByAdmin}
              kid={kidById.get(n.kidId)}
              kidId={n.kidId}
              kidName={kidMap.get(n.kidId) || n.kidId}
              who={<>אל <b>{n.recipientName}</b></>}
              message={n.message}
              date={toDate(n.createdAt)}
              tags={<>
                <span className={`nb-chip tone-${n.recipientType === 'practitioner' ? 'lilac' : 'mint'}`}>{n.recipientType === 'practitioner' ? 'צוות' : 'הורה'}</span>
                {n.read
                  ? <span className="cm-read"><Icon name="check" size={14} strokeWidth={2.6} /> נקרא</span>
                  : <span className="cm-unread-tag">עוד לא נקרא</span>}
                {n.dismissedByAdmin && <span className="cm-hidden-tag">מוסתר</span>}
              </>}
              actions={deleteConfirm === n.id ? (
                <>
                  <button type="button" className="cm-confirm-del" onClick={() => deleteMutation.mutate(n.id)} disabled={deleteMutation.isPending}>מחק</button>
                  <button type="button" className="cm-confirm-cancel" onClick={() => setDeleteConfirm(null)}>ביטול</button>
                </>
              ) : (
                <>
                  {!n.dismissedByAdmin && (
                    <button type="button" className="cm-icon-btn" onClick={() => adminDismissMutation.mutate(n.id)} title="הסתר" aria-label="הסתר">
                      <HideIcon />
                    </button>
                  )}
                  <button type="button" className="cm-icon-btn danger" onClick={() => setDeleteConfirm(n.id)} title="מחק" aria-label="מחק">
                    <Icon name="trash" size={18} />
                  </button>
                </>
              )}
            />
          ))}
        </ul>
      )}

      <div className="cm-sticky">
        <button type="button" className="nb-btn block" onClick={openCompose}><Icon name="edit" /> הודעה חדשה</button>
      </div>

      {/* Compose — bottom sheet */}
      {showCompose && (
        <div className="nb-sheet-wrap" onClick={() => setShowCompose(false)}>
          <div className="nb-sheet cm-compose" role="dialog" aria-modal="true" aria-label="שליחת הודעה" onClick={e => e.stopPropagation()}>
            <div className="nb-sheet-grip" />
            <h3 className="nb-sheet-title">הודעה <mark className="hl-sky">חדשה</mark></h3>

            {/* Step 1: Kid autocomplete */}
            <div className="cm-step">
              <label className="cm-step-label" htmlFor="cm-kid-search"><span className="cm-step-n">1</span> על איזה ילד/ה?</label>
              <div className="cm-kid-search">
                {selectedKid && <KidAvatar kid={selectedKid} size="sm" />}
                {!selectedKid && <Icon name="search" size={20} />}
                <input
                  id="cm-kid-search"
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
              </div>
              {showKidDropdown && filteredKids.length > 0 && !selectedKidId && (
                <div ref={dropdownRef} className="cm-kid-list" role="listbox">
                  {filteredKids.map((k, i) => (
                    <button
                      key={k.id}
                      type="button"
                      role="option"
                      aria-selected={i === highlightedIndex}
                      className={`cm-kid-opt${i === highlightedIndex ? ' is-hl' : ''}`}
                      onClick={() => selectKid(k)}
                      onMouseEnter={() => setHighlightedIndex(i)}
                    >
                      <KidAvatar kid={k} size="sm" />
                      <span>{k.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Targets */}
            {selectedKidId && (
              <div className="cm-step">
                <span className="cm-step-label"><span className="cm-step-n">2</span> למי לשלוח?</span>
                {composePractitioners.length === 0 && composeParents.length === 0 ? (
                  <p className="nb-muted cm-small">אין צוות לילד/ה זה/ו</p>
                ) : (
                  <div className="cm-targets">
                    {composePractitioners.map((p: Practitioner) => {
                      const key = `p:${p.id}`;
                      const selected = notifyTargets.has(key);
                      return (
                        <button key={key} type="button" aria-pressed={selected}
                          className={`cm-target tone-lilac${selected ? ' is-on' : ''}`} onClick={() => toggleTarget(key)}>
                          <span className="cm-target-box">{selected && <Icon name="check" size={14} strokeWidth={2.8} />}</span>
                          {p.name}
                        </button>
                      );
                    })}
                    {composeParents.map((p: Parent) => {
                      const key = `par:${p.id}`;
                      const selected = notifyTargets.has(key);
                      return (
                        <button key={key} type="button" aria-pressed={selected}
                          className={`cm-target tone-mint${selected ? ' is-on' : ''}`} onClick={() => toggleTarget(key)}>
                          <span className="cm-target-box">{selected && <Icon name="check" size={14} strokeWidth={2.8} />}</span>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Message */}
            {selectedKidId && notifyTargets.size > 0 && (
              <div className="cm-step">
                <label className="cm-step-label" htmlFor="cm-msg-text"><span className="cm-step-n">3</span> מה כותבים?</label>
                <textarea
                  id="cm-msg-text"
                  className="cm-textarea"
                  value={notifyMessage}
                  onChange={e => setNotifyMessage(e.target.value)}
                  placeholder="תוכן ההודעה..."
                  rows={4}
                />
              </div>
            )}

            <div className="cm-compose-actions">
              <button
                type="button"
                className="nb-btn block"
                disabled={!selectedKidId || notifyTargets.size === 0 || !notifyMessage.trim() || sendMutation.isPending}
                onClick={handleSend}
              >
                {sendMutation.isPending ? 'שולח...' : 'שלח'}
              </button>
              <button type="button" className="nb-btn-ghost" onClick={() => setShowCompose(false)}>ביטול</button>
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
