import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { kidsApi, practitionersApi, sessionsApi, goalDataApi } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import { toDate } from '../utils/date';
import type { Kid, KidGoalDataEntry } from '../types';

const BASE = import.meta.env.BASE_URL;
const DEFAULT_AVATAR = `${BASE}me-default-small.jpg`;

/* ── Flat list view: all pending entries across kids, sorted by date ── */

function FlatPendingList({ kids }: { kids: Kid[] }) {
  const links = useTherapistLinks();

  // Fetch pending DC for every kid in parallel via individual useQuery hooks
  // We collect them into a flat array after all resolve
  const pendingQueries = kids.map(kid =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: ['dc-pending', kid.id],
      queryFn: () => goalDataApi.getPending(kid.id),
    })
  );

  const isLoading = pendingQueries.some(q => q.isLoading);

  // Build flat list with kid info attached
  const allPending: (KidGoalDataEntry & { kidName: string; kidId: string; avatarUrl: string })[] = [];
  for (let i = 0; i < kids.length; i++) {
    const kid = kids[i];
    const entries: KidGoalDataEntry[] = pendingQueries[i].data?.data || [];
    const avatarUrl = kid.imageName
      ? (kid.imageName.startsWith('data:') ? kid.imageName : `${BASE}${kid.imageName}`)
      : DEFAULT_AVATAR;
    for (const entry of entries) {
      allPending.push({ ...entry, kidName: kid.name, kidId: kid.id, avatarUrl });
    }
  }

  // Sort by date ascending (oldest first)
  allPending.sort((a, b) => toDate(a.sessionDate).getTime() - toDate(b.sessionDate).getTime());

  if (isLoading) {
    return <div className="loading">טוען...</div>;
  }

  if (allPending.length === 0) {
    return (
      <div className="empty-state">
        <p>אין טפסים ממתינים</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {allPending.map(entry => (
        <Link
          key={entry.id}
          to={links.kidDetail(entry.kidId)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: '#fffbeb',
            borderRadius: 10,
            textDecoration: 'none',
            color: 'inherit',
            border: '1px solid #fde68a',
          }}
        >
          <img
            src={entry.avatarUrl}
            alt={entry.kidName}
            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.goalTitle}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{entry.kidName}</div>
          </div>
          <div style={{ fontSize: 12, color: '#92400e', fontWeight: 500, flexShrink: 0 }}>
            {format(toDate(entry.sessionDate), 'dd/MM/yyyy')}
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ── Grouped-by-kid view (expandable cards) ── */

function KidFormsCard({ kid }: { kid: Kid }) {
  const [expanded, setExpanded] = useState(false);
  const links = useTherapistLinks();

  const { data: pendingRes, isLoading: pendingLoading } = useQuery({
    queryKey: ['dc-pending', kid.id],
    queryFn: () => goalDataApi.getPending(kid.id),
  });

  const pending: KidGoalDataEntry[] = pendingRes?.data || [];
  const pendingCount = pending.length;

  // Hide kids with no pending entries (still loading = show as placeholder)
  if (!pendingLoading && pendingCount === 0) return null;

  const avatarUrl = kid.imageName
    ? (kid.imageName.startsWith('data:') ? kid.imageName : `${BASE}${kid.imageName}`)
    : DEFAULT_AVATAR;

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          cursor: 'pointer',
          background: expanded ? '#f8fafc' : '#fff',
          transition: 'background 0.15s',
        }}
      >
        <img
          src={avatarUrl}
          alt={kid.name}
          style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{kid.name}</div>
          {kid.age && <div style={{ fontSize: 12, color: '#6b7280' }}>גיל {kid.age}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            background: '#fef3c7', color: '#92400e',
            borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600,
          }}>
            {pendingLoading ? '...' : `${pendingCount} ממתינים`}
          </span>
          <span style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s', fontSize: 14, color: '#9ca3af',
          }}>▼</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #e5e7eb', padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pending.map(entry => (
              <Link key={entry.id} to={links.kidDetail(kid.id)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', background: '#fffbeb', borderRadius: 8,
                textDecoration: 'none', color: 'inherit', fontSize: 13,
              }}>
                <span style={{ fontWeight: 500 }}>{entry.goalTitle}</span>
                <span style={{ color: '#6b7280', fontSize: 12 }}>
                  {format(toDate(entry.sessionDate), 'dd/MM/yyyy')}
                </span>
              </Link>
            ))}
          </div>

          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <Link to={links.kidDetail(kid.id)} style={{
              display: 'inline-block', padding: '6px 16px', background: '#f1f5f9',
              borderRadius: 8, fontSize: 13, color: '#475569', textDecoration: 'none', fontWeight: 500,
            }}>
              פתח דף ילד
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ── */

export default function FormsOverview() {
  const { isTherapistView, practitionerId } = useTherapist();
  const [view, setView] = useState<'flat' | 'byKid'>('flat');

  const { data: kidsResponse, isLoading } = useQuery({
    queryKey: isTherapistView ? ['kids', 'practitioner', practitionerId] : ['kids'],
    queryFn: () => isTherapistView
      ? practitionersApi.getKidsForPractitioner(practitionerId!)
      : kidsApi.getAll(),
  });

  const { data: alertsResponse } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => sessionsApi.getAlerts(),
    enabled: !isTherapistView,
  });

  const kids: Kid[] = kidsResponse?.data || [];
  const sessionAlerts = alertsResponse?.data || [];

  const alertsByKid = new Map<string, number>();
  for (const alert of sessionAlerts) {
    alertsByKid.set(alert.kidId, (alertsByKid.get(alert.kidId) || 0) + 1);
  }

  return (
    <div className="container">
      <div className="content-card">
        <div className="content-card-header">
          <h2>טפסים</h2>
          {/* View toggle */}
          <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            <button
              onClick={() => setView('flat')}
              style={{
                padding: '5px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                border: 'none',
                background: view === 'flat' ? '#6366f1' : '#fff',
                color: view === 'flat' ? '#fff' : '#6b7280',
              }}
            >
              ממתינים
            </button>
            <button
              onClick={() => setView('byKid')}
              style={{
                padding: '5px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                border: 'none', borderRight: '1px solid #e5e7eb',
                background: view === 'byKid' ? '#6366f1' : '#fff',
                color: view === 'byKid' ? '#fff' : '#6b7280',
              }}
            >
              לפי ילד
            </button>
          </div>
        </div>

        {/* Session form alerts summary (admin only) */}
        {!isTherapistView && sessionAlerts.length > 0 && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
            padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#92400e' }}>
                {sessionAlerts.length} טפסי טיפול ממתינים למילוי
              </div>
              <div style={{ fontSize: 12, color: '#a16207' }}>
                {alertsByKid.size} ילדים עם טפסים ממתינים
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="loading">טוען...</div>
        ) : kids.length === 0 ? (
          <div className="empty-state">
            <p>{isTherapistView ? 'אין ילדים משויכים אלייך' : 'אין ילדים במערכת'}</p>
          </div>
        ) : view === 'flat' ? (
          <FlatPendingList kids={kids} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {kids.map(kid => (
              <KidFormsCard key={kid.id} kid={kid} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
