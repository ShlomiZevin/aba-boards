import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, practitionersApi } from '../api/client';
import { toDate } from '../utils/date';
import type { Notification, Kid } from '../types';
import { useTherapist } from '../contexts/TherapistContext';
import Icon from '../v2/Icon';
import { InboxRow, InboxEmpty, HideIcon } from '../v2/pages/CmInbox';

export default function TherapistNotifications() {
  const queryClient = useQueryClient();
  const [pendingReadIds, setPendingReadIds] = useState<Set<string>>(new Set());

  const { data: notificationsRes, isLoading } = useQuery({
    queryKey: ['notifications', 'mine'],
    queryFn: () => notificationsApi.getMine(),
    refetchInterval: 30_000,
  });

  const notifications: Notification[] = notificationsRes?.data || [];

  // Kids are only used to say who a message is about ("על נגה").
  const { practitionerId } = useTherapist();
  const { data: kidsRes } = useQuery({
    queryKey: ['kids', 'practitioner', practitionerId],
    queryFn: () => practitionersApi.getKidsForPractitioner(practitionerId!),
    enabled: !!practitionerId,
  });
  const kidById = new Map<string, Kid>((kidsRes?.data || []).map(k => [k.id, k]));
  const unread = notifications.filter(n => !n.read && !pendingReadIds.has(n.id));
  const read = notifications.filter(n => n.read || pendingReadIds.has(n.id));

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await notificationsApi.markRead(id);
      if (!res.success) throw new Error(res.error || 'Failed');
      return id;
    },
    onMutate: async (id: string) => {
      setPendingReadIds(prev => new Set(prev).add(id));
      await queryClient.cancelQueries({ queryKey: ['notifications', 'mine'] });
      const previous = queryClient.getQueryData(['notifications', 'mine']);
      queryClient.setQueryData(['notifications', 'mine'], (old: { data?: Notification[] } | undefined) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((n: Notification) => n.id === id ? { ...n, read: true } : n) };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications', 'mine'], context.previous);
    },
    onSettled: (_data, _err, id) => {
      setPendingReadIds(prev => { const next = new Set(prev); next.delete(id!); return next; });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'mine'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const ids = unread.map(n => n.id);
      if (ids.length === 0) return;
      await Promise.all(ids.map(id => notificationsApi.markRead(id)));
    },
    onMutate: async () => {
      const ids = unread.map(n => n.id);
      setPendingReadIds(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next; });
      await queryClient.cancelQueries({ queryKey: ['notifications', 'mine'] });
      const previous = queryClient.getQueryData(['notifications', 'mine']);
      queryClient.setQueryData(['notifications', 'mine'], (old: { data?: Notification[] } | undefined) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((n: Notification) => ({ ...n, read: true })) };
      });
      return { previous };
    },
    onError: (_err, _v, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications', 'mine'], context.previous);
    },
    onSettled: () => {
      setPendingReadIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['notifications', 'mine'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.dismiss(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', 'mine'] });
      const previous = queryClient.getQueryData(['notifications', 'mine']);
      queryClient.setQueryData(['notifications', 'mine'], (old: { data?: Notification[] } | undefined) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((n: Notification) => n.id !== id) };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications', 'mine'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'mine'] });
    },
  });

  function NotificationCard({ notification }: { notification: Notification }) {
    const isUnread = !notification.read && !pendingReadIds.has(notification.id);
    const kid = kidById.get(notification.kidId);
    return (
      <InboxRow
        unread={isUnread}
        kid={kid}
        kidId={notification.kidId}
        kidName={kid?.name || ''}
        who={<>מ<b>המרכז</b></>}
        message={notification.message}
        date={toDate(notification.createdAt)}
        actions={<>
          {isUnread && (
            <button type="button" className="cm-icon-btn pen" onClick={() => markReadMutation.mutate(notification.id)} title="סמן כנקרא" aria-label="סמן כנקרא">
              <Icon name="check" size={18} strokeWidth={2.4} />
            </button>
          )}
          <button type="button" className="cm-icon-btn" onClick={() => dismissMutation.mutate(notification.id)} title="הסתר" aria-label="הסתר">
            <HideIcon />
          </button>
        </>}
      />
    );
  }

  return (
    <div className="cm-inbox">
      <header className="cm-head">
        <div className="cm-head-title">
          <h1 className="nb-h1"><mark className="hl-sky">הודעות</mark></h1>
          <p className="nb-muted">
            {unread.length > 0
              ? <b className="cm-ink">{unread.length === 1 ? 'הודעה חדשה אחת' : `${unread.length} הודעות חדשות`}</b>
              : 'הכל נקרא'}
          </p>
        </div>
        {unread.length > 0 && (
          <button
            type="button"
            onClick={() => markAllReadMutation.mutate()}
            className="nb-btn-ghost"
            disabled={markAllReadMutation.isPending}
          >
            <Icon name="check" size={18} /> סמן הכל כנקרא
          </button>
        )}
      </header>

      {isLoading ? (
        <p className="hand nb-muted cm-loading">טוען הודעות…</p>
      ) : notifications.length === 0 ? (
        <InboxEmpty>אין הודעות</InboxEmpty>
      ) : (
        <div className="cm-inbox-cols">
          {unread.length > 0 && (
            <section className="nb-sec">
              <h2 className="cm-sec-label">לא נקראו ({unread.length})</h2>
              <ul className="cm-msgs">
                {unread.map(n => <NotificationCard key={n.id} notification={n} />)}
              </ul>
            </section>
          )}
          {read.length > 0 && (
            <section className="nb-sec">
              {unread.length > 0 && <h2 className="cm-sec-label muted">נקראו ({read.length})</h2>}
              <ul className="cm-msgs">
                {read.map(n => <NotificationCard key={n.id} notification={n} />)}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
