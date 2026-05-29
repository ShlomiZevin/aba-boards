import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/client';
import type { AdminOverviewEntry, AdminOverviewKid } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

type SortKey = 'newest' | 'oldest' | 'mostKids' | 'mostActivity' | 'name';

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return s; }
};

const daysSince = (s: string | null) => {
  if (!s) return null;
  const ms = Date.now() - new Date(s).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

export default function SuperAdminOverview() {
  const { user } = useAuth();
  const { data: res, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => adminApi.getOverview(),
    enabled: !!user?.isSuperAdmin,
    staleTime: 30_000,
  });

  const [sort, setSort] = useState<SortKey>('newest');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showOrphans, setShowOrphans] = useState(false);

  const filteredAdmins = useMemo(() => {
    const admins: AdminOverviewEntry[] = res?.data?.admins || [];
    const q = search.trim().toLowerCase();
    const list = q
      ? admins.filter(a =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.mobile.toLowerCase().includes(q) ||
          a.key.toLowerCase().includes(q),
        )
      : admins;

    const sorted = [...list];
    if (sort === 'newest') {
      sorted.sort((a, b) => (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime()));
    } else if (sort === 'oldest') {
      sorted.sort((a, b) => (new Date(a.createdAt || 0).getTime()) - (new Date(b.createdAt || 0).getTime()));
    } else if (sort === 'mostKids') {
      sorted.sort((a, b) => b.counts.kids - a.counts.kids);
    } else if (sort === 'mostActivity') {
      const score = (a: AdminOverviewEntry) =>
        a.counts.kids * 3 + a.counts.crew * 2 + a.counts.parents + a.counts.sessions + a.counts.forms;
      sorted.sort((a, b) => score(b) - score(a));
    } else if (sort === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'he'));
    }
    return sorted;
  }, [res, sort, search]);

  if (!user?.isSuperAdmin) {
    return (
      <div className="container">
        <div className="content-card">
          <div className="empty-state">
            <p>אין הרשאה לצפות בדף זה</p>
          </div>
        </div>
      </div>
    );
  }

  const totals = res?.data?.totals;
  const orphanKids = res?.data?.orphanKids || [];

  return (
    <div className="container" style={{ direction: 'rtl' }}>
      <div className="content-card">
        <div className="content-card-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0 }}>סופר אדמין — סקירה כללית</h2>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
              כל המנהלים שנרשמו ומה הם עשו במערכת
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-secondary btn-small"
            disabled={isFetching}
          >
            {isFetching ? 'מרענן...' : 'רענן'}
          </button>
        </div>

        {/* Totals strip */}
        {totals && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            <Stat label="מנהלים" value={totals.admins} color="#1e40af" />
            <Stat label="ילדים (כולל)" value={totals.kidsAcrossAllAdmins} color="#059669" />
            <Stat label="צוות (כולל)" value={totals.crewAcrossAllAdmins} color="#7c3aed" />
            <Stat label="הורים (כולל)" value={totals.parentsAcrossAllAdmins} color="#ea580c" />
            <Stat label="ילדים יתומים" value={totals.orphanKids} color="#9ca3af" />
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם / אימייל / טלפון / מפתח"
            style={{ flex: 1, minWidth: 240, padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}
          />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}
          >
            <option value="newest">חדשים ביותר</option>
            <option value="oldest">ישנים ביותר</option>
            <option value="mostKids">הכי הרבה ילדים</option>
            <option value="mostActivity">הכי פעילים</option>
            <option value="name">לפי שם</option>
          </select>
          <button
            onClick={() => {
              const next = !filteredAdmins.every(a => expanded[a.adminId]);
              const newState: Record<string, boolean> = {};
              filteredAdmins.forEach(a => { newState[a.adminId] = next; });
              setExpanded(newState);
            }}
            className="btn-secondary btn-small"
          >
            {filteredAdmins.every(a => expanded[a.adminId]) ? 'כווץ הכל' : 'הרחב הכל'}
          </button>
        </div>

        {isLoading ? (
          <p style={{ color: '#9ca3af', fontSize: 14 }}>טוען...</p>
        ) : filteredAdmins.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 14 }}>לא נמצאו מנהלים</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredAdmins.map(a => (
              <AdminCard
                key={a.adminId}
                admin={a}
                open={!!expanded[a.adminId]}
                onToggle={() => setExpanded(s => ({ ...s, [a.adminId]: !s[a.adminId] }))}
              />
            ))}
          </div>
        )}

        {/* Orphan kids section */}
        {orphanKids.length > 0 && (
          <div style={{ marginTop: 24, padding: 16, background: '#f9fafb', borderRadius: 12, border: '1px dashed #d1d5db' }}>
            <div
              onClick={() => setShowOrphans(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            >
              <h3 style={{ margin: 0, fontSize: 15, color: '#6b7280' }}>
                ילדים יתומים (ללא מנהל) — {orphanKids.length}
              </h3>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>{showOrphans ? '▲' : '▼'}</span>
            </div>
            {showOrphans && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {orphanKids.map(k => (
                  <div key={k.id} style={{ fontSize: 13, color: '#374151', padding: '6px 10px', background: 'white', borderRadius: 8 }}>
                    {k.name} {k.age ? `· גיל ${k.age}` : ''} · נוצר {fmtDate(k.createdAt)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: '10px 16px',
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      minWidth: 100,
      flex: '0 1 auto',
    }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function AdminCard({ admin, open, onToggle }: { admin: AdminOverviewEntry; open: boolean; onToggle: () => void }) {
  const c = admin.counts;
  const isInactive = !admin.active;
  const isEmpty = c.kids === 0 && c.crew === 0 && c.parents === 0;
  const days = daysSince(admin.createdAt);

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: 14,
      background: isInactive ? '#fafafa' : 'white',
      opacity: isInactive ? 0.7 : 1,
      overflow: 'hidden',
    }}>
      <div
        onClick={onToggle}
        style={{
          padding: '14px 18px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          background: isEmpty ? '#fffbeb' : 'transparent',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{admin.name}</h3>
            {isEmpty && <Badge color="#f59e0b" bg="#fef3c7">ריק — לא הוסיף כלום</Badge>}
            {admin.subscription?.plan === 'trial' && <Badge color="#7c3aed" bg="#ede9fe">ניסיון</Badge>}
            {admin.subscription?.plan === 'pro' && admin.subscription?.status === 'active' && <Badge color="#15803d" bg="#dcfce7">פרו</Badge>}
            {admin.subscription?.status === 'cancelled' && <Badge color="#9ca3af" bg="#f3f4f6">בוטל</Badge>}
            {isInactive && <Badge color="#dc2626" bg="#fee2e2">לא פעיל</Badge>}
            {admin.createdBy === 'self-signup' && <Badge color="#0369a1" bg="#e0f2fe">הרשמה עצמית</Badge>}
          </div>

          <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {admin.email && <span>📧 {admin.email}</span>}
            {admin.mobile && <span>📱 {admin.mobile}</span>}
            <span>🔑 <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{admin.key}</code></span>
            <span>נרשם {fmtDate(admin.createdAt)} {days !== null && `(לפני ${days} ימים)`}</span>
          </div>

          {/* Inline count chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <Chip icon="👧" label="ילדים" value={c.kids} />
            <Chip icon="👥" label="צוות" value={c.crew} />
            <Chip icon="👨‍👩‍👧" label="הורים" value={c.parents} />
            <Chip icon="📅" label="פגישות" value={c.sessions} />
            <Chip icon="📋" label="טפסי טיפול" value={c.forms} />
            <Chip icon="📝" label="טפסי ישיבה" value={c.meetingForms} />
          </div>
        </div>

        <div style={{ fontSize: 18, color: '#9ca3af' }}>{open ? '▲' : '▼'}</div>
      </div>

      {open && (
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid #f3f4f6' }}>
          {/* Kids */}
          <Section title={`ילדים (${admin.kids.length})`}>
            {admin.kids.length === 0 ? <Empty text="עדיין לא הוספו ילדים" /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {admin.kids.map(k => <KidRow key={k.id} kid={k} />)}
              </div>
            )}
          </Section>

          {/* Crew */}
          <Section title={`צוות (${admin.crew.length})`}>
            {admin.crew.length === 0 ? <Empty text="עדיין לא הוסיף אנשי צוות" /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {admin.crew.map(p => (
                  <div key={p.id} style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 8, fontSize: 13 }}>
                    <strong>{p.name}</strong>
                    {p.type && <span style={{ color: '#6b7280' }}> · {p.type}</span>}
                    {p.mobile && <span style={{ color: '#6b7280' }}> · 📱 {p.mobile}</span>}
                    {p.email && <span style={{ color: '#6b7280' }}> · 📧 {p.email}</span>}
                    <span style={{ color: '#9ca3af', fontSize: 11, marginInlineStart: 8 }}>נוצר {fmtDate(p.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Parents */}
          <Section title={`הורים (${admin.parents.length})`}>
            {admin.parents.length === 0 ? <Empty text="עדיין לא הוסיף הורים" /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {admin.parents.map(p => {
                  const kid = admin.kids.find(k => k.id === p.kidId);
                  return (
                    <div key={p.id} style={{ padding: '8px 12px', background: '#fff7ed', borderRadius: 8, fontSize: 13 }}>
                      <strong>{p.name || '(ללא שם)'}</strong>
                      {kid && <span style={{ color: '#6b7280' }}> · הורה של {kid.name}</span>}
                      {p.mobile && <span style={{ color: '#6b7280' }}> · 📱 {p.mobile}</span>}
                      {p.email && <span style={{ color: '#6b7280' }}> · 📧 {p.email}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function KidRow({ kid }: { kid: AdminOverviewKid }) {
  return (
    <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 10, fontSize: 13, border: '1px solid #d1fae5' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>{kid.name}</strong>
        {kid.age && <span style={{ color: '#6b7280' }}>גיל {kid.age}</span>}
        {kid.gender && <span style={{ color: '#6b7280' }}>· {kid.gender}</span>}
        {kid.hasBoardLayout && <Badge color="#0284c7" bg="#e0f2fe">לוח קיים</Badge>}
        {kid.tasksCount > 0 && <Badge color="#15803d" bg="#dcfce7">{kid.tasksCount} משימות</Badge>}
        {kid.totalMoney > 0 && <Badge color="#a16207" bg="#fef9c3">{kid.totalMoney} ₪</Badge>}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12, color: '#4b5563', flexWrap: 'wrap' }}>
        <span>📅 {kid.sessionsCount} פגישות</span>
        <span>📋 {kid.formsCount} טפסי טיפול</span>
        <span>📝 {kid.meetingFormsCount} טפסי ישיבה</span>
        <span>👨‍👩‍👧 {kid.parents.length} הורים</span>
        <span style={{ color: '#9ca3af' }}>נוצר {fmtDate(kid.createdAt)}</span>
      </div>
    </div>
  );
}

function Chip({ icon, label, value }: { icon: string; label: string; value: number }) {
  const dim = value === 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 999,
      background: dim ? '#f9fafb' : '#eff6ff',
      color: dim ? '#9ca3af' : '#1e40af',
      fontSize: 12, fontWeight: 600,
      border: `1px solid ${dim ? '#f3f4f6' : '#dbeafe'}`,
    }}>
      <span>{icon}</span>
      <span>{label}</span>
      <span style={{ fontWeight: 800 }}>{value}</span>
    </span>
  );
}

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      background: bg,
      color,
      fontSize: 11,
      fontWeight: 700,
    }}>
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#374151', fontWeight: 700 }}>{title}</h4>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>{text}</p>;
}
