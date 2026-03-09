import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { notificationsApi } from '../api/client';
import { toDate } from '../utils/date';
import type { Notification } from '../types';

export default function TherapistNotifications() {
  const queryClient = useQueryClient();
  const [pendingReadIds, setPendingReadIds] = useState<Set<string>>(new Set());

  const { data: notificationsRes, isLoading } = useQuery({
    queryKey: ['notifications', 'mine'],
    queryFn: () => notificationsApi.getMine(),
    refetchInterval: 30_000,
  });

  const notifications: Notification[] = notificationsRes?.data || [];
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
    return (
      <div style={{
        display: 'flex',
        gap: 12,
        padding: '12px 16px',
        background: isUnread ? '#eff6ff' : '#fff',
        borderRadius: 10,
        border: `1px solid ${isUnread ? '#bfdbfe' : '#e5e7eb'}`,
        alignItems: 'flex-start',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {notification.message}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            {format(toDate(notification.createdAt), 'dd/MM/yyyy HH:mm')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {isUnread && (
            <button
              onClick={() => markReadMutation.mutate(notification.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                padding: '2px 4px',
                borderRadius: 4,
              }}
              title="סמן כנקרא"
            >
              ✓
            </button>
          )}
          <button
            onClick={() => dismissMutation.mutate(notification.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              padding: '2px 4px',
              borderRadius: 4,
              color: '#9ca3af',
            }}
            title="הסתר"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="content-card">
        <div className="content-card-header">
          <h2>הודעות</h2>
          {unread.length > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="btn-secondary btn-small"
              disabled={markAllReadMutation.isPending}
            >
              סמן הכל כנקרא
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="loading">טוען...</div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <p>אין הודעות</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Unread first */}
            {unread.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6', padding: '4px 0' }}>
                  לא נקראו ({unread.length})
                </div>
                {unread.map(n => (
                  <NotificationCard key={n.id} notification={n} />
                ))}
              </>
            )}
            {/* Read */}
            {read.length > 0 && (
              <>
                {unread.length > 0 && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', padding: '8px 0 4px' }}>
                    נקראו ({read.length})
                  </div>
                )}
                {read.map(n => (
                  <NotificationCard key={n.id} notification={n} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
