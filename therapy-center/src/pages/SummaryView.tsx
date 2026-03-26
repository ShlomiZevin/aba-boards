import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { summariesApi, kidsApi } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import ConfirmModal from '../components/ConfirmModal';
import { toDate } from '../utils/date';

export default function SummaryView() {
  const { summaryId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isTherapistView, isParentView } = useTherapist();
  const links = useTherapistLinks();
  const [showDelete, setShowDelete] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const { data: summaryRes, isLoading } = useQuery({
    queryKey: ['summary', summaryId],
    queryFn: () => summariesApi.getById(summaryId!),
    enabled: !!summaryId,
  });

  const summary = summaryRes?.data;

  const { data: kidRes } = useQuery({
    queryKey: ['kid', summary?.kidId],
    queryFn: () => kidsApi.getById(summary!.kidId),
    enabled: !!summary?.kidId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => summariesApi.delete(summaryId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
      navigate(summary?.kidId ? links.kidDetail(summary.kidId) : links.home());
    },
  });

  const titleMutation = useMutation({
    mutationFn: (newTitle: string) => summariesApi.update(summaryId!, { title: newTitle }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summary', summaryId] });
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
      setEditingTitle(false);
    },
  });

  const kid = kidRes?.data;

  if (isLoading) {
    return (
      <div className="container">
        <div className="loading">...</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="container">
        <div className="content-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#a0aec0', marginBottom: '16px' }}>הסיכום לא נמצא</p>
          <Link to={links.home()} className="btn-primary">חזור לדף הבית</Link>
        </div>
      </div>
    );
  }

  const fromStr = format(toDate(summary.fromDate), 'dd/MM/yyyy');
  const toStr = format(toDate(summary.toDate), 'dd/MM/yyyy');
  const isAdmin = !isTherapistView && !isParentView;

  return (
    <div className="container">
      <div className="kid-header-card">
        <div className="kid-header-top">
          <Link to={kid ? links.kidDetail(kid.id) : links.home()} className="kid-header-back">
            <span className="back-arrow">→</span>
            <span className="back-label">חזרה</span>
          </Link>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {editingTitle ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') titleMutation.mutate(titleDraft);
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                  autoFocus
                  style={{ fontSize: '1.05em', fontWeight: 700, color: '#2d3748', border: '1px solid #cbd5e0', borderRadius: '6px', padding: '4px 8px', width: '250px' }}
                />
                <button className="btn-primary btn-small" onClick={() => titleMutation.mutate(titleDraft)} disabled={titleMutation.isPending}>
                  {titleMutation.isPending ? '...' : 'שמור'}
                </button>
                <button className="btn-secondary btn-small" onClick={() => setEditingTitle(false)}>ביטול</button>
              </div>
            ) : (
              <h1
                style={{ fontSize: '1.05em', fontWeight: 700, color: '#2d3748', margin: 0, cursor: isAdmin ? 'pointer' : 'default' }}
                onClick={() => { if (isAdmin) { setTitleDraft(summary.title || ''); setEditingTitle(true); } }}
                title={isAdmin ? 'לחץ לעריכה' : undefined}
              >
                {summary.title || 'סיכום תקופתי'}
                {isAdmin && <span style={{ fontSize: '0.7em', color: '#94a3b8', marginRight: '6px' }}>✏️</span>}
              </h1>
            )}
            {kid && <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>{kid.name}</p>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => window.print()} className="btn-secondary btn-small">
              הדפס
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowDelete(true)}
                className="btn-small"
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1em', padding: '6px 8px' }}
                title="מחק סיכום"
              >
                🗑
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="content-card">
        {/* Date range bar */}
        <div className="form-view-stats" style={{ gridTemplateColumns: 'auto auto' }}>
          <div className="stat">
            <div className="stat-label">מתאריך</div>
            <div className="stat-value">{fromStr}</div>
          </div>
          <div className="stat">
            <div className="stat-label">עד תאריך</div>
            <div className="stat-value">{toStr}</div>
          </div>
        </div>

        {/* Summary content */}
        <div className="summary-content" style={{ lineHeight: 1.7, color: '#2d3748' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary.content}</ReactMarkdown>
        </div>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '2px solid #f0f4f8', fontSize: '0.85em', color: '#a0aec0' }}>
          נוצר ב-{format(toDate(summary.createdAt), 'dd/MM/yyyy HH:mm')}
        </div>
      </div>

      {showDelete && (
        <ConfirmModal
          title="מחיקת סיכום"
          message={`האם למחוק את הסיכום "${summary.title || 'סיכום תקופתי'}"?`}
          confirmText={deleteMutation.isPending ? 'מוחק...' : 'מחק'}
          confirmStyle="danger"
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
