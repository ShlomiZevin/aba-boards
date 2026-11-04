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
import Icon from '../v2/Icon';
import { FfHeader, FfIcon } from '../v2/pages/ffParts';

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
      <div className="ff"><div className="loading">טוען...</div></div>
    );
  }

  if (!summary) {
    return (
      <div className="ff">
        <div className="nb-card ff-missing">
          <p className="hand">הסיכום לא נמצא</p>
          <Link to={links.home()} className="nb-btn">חזור לדף הבית</Link>
        </div>
      </div>
    );
  }

  const fromStr = format(toDate(summary.fromDate), 'dd/MM/yyyy');
  const toStr = format(toDate(summary.toDate), 'dd/MM/yyyy');
  const isAdmin = !isTherapistView && !isParentView;

  const titleNode = editingTitle ? (
    <div className="ff-title-edit">
      <input
        type="text"
        value={titleDraft}
        onChange={e => setTitleDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') titleMutation.mutate(titleDraft);
          if (e.key === 'Escape') setEditingTitle(false);
        }}
        autoFocus
        aria-label="כותרת הסיכום"
      />
      <button className="btn-primary btn-small" onClick={() => titleMutation.mutate(titleDraft)} disabled={titleMutation.isPending}>
        {titleMutation.isPending ? '...' : 'שמור'}
      </button>
      <button className="btn-secondary btn-small" onClick={() => setEditingTitle(false)}>ביטול</button>
    </div>
  ) : (
    <h1 className="ff-title">
      {isAdmin ? (
        <button
          type="button"
          className="ff-title-btn"
          onClick={() => { setTitleDraft(summary.title || ''); setEditingTitle(true); }}
          title="לחץ לעריכה"
        >
          {summary.title || 'סיכום תקופתי'}
          <Icon name="edit" size={20} />
        </button>
      ) : (summary.title || 'סיכום תקופתי')}
    </h1>
  );

  return (
    <div className="ff ff-view ff-summary">
      <FfHeader
        backTo={kid ? links.kidDetail(kid.id) : links.home()}
        kid={kid}
        title={titleNode}
        actions={
          <>
            <button onClick={() => window.print()} className="ff-icon-btn" aria-label="הדפסה" title="הדפסה">
              <FfIcon name="print" />
            </button>
            {isAdmin && (
              <button onClick={() => setShowDelete(true)} className="ff-icon-btn danger" aria-label="מחק סיכום" title="מחק סיכום">
                <Icon name="trash" size={20} />
              </button>
            )}
          </>
        }
      />

      <div className="ff-stats">
        <span className="ff-stat tone-sky"><span>מתאריך</span> <b className="tabular">{fromStr}</b></span>
        <span className="ff-stat tone-peach" style={{ ['--rot' as string]: '2deg' }}><span>עד תאריך</span> <b className="tabular">{toStr}</b></span>
      </div>

      <article className="nb-card nb-tape ff-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary.content}</ReactMarkdown>
      </article>

      <div className="ff-foot tabular">
        נוצר ב-{format(toDate(summary.createdAt), 'dd/MM/yyyy HH:mm')}
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
