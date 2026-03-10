import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { boardRequestsApi } from '../api/client';
import ConfirmModal from './ConfirmModal';
import type { BoardRequest } from '../types';

const COIN_LABELS: Record<string, string> = {
  points: 'נקודות',
  shekel: 'שקלים ₪',
  dollar: 'דולרים $',
};

const COLOR_LABELS: Record<string, string> = {
  purple: 'טורקיז',
  pink: 'אפרסק',
  blue: 'לבנדר',
  dark: 'כהה',
};

function formatDate(ts?: { _seconds: number }) {
  if (!ts?._seconds) return 'לא ידוע';
  return new Date(ts._seconds * 1000).toLocaleDateString('he-IL');
}

function buildCustomerMessage(childName: string, kidId: string) {
  const encoded = encodeURIComponent(kidId);
  return `הלוח של ${childName}: https://startdoing.co.il/board.html?kid=${encoded}\nעריכת הלוח: https://startdoing.co.il/board.html?kid=${encoded}&mode=edit (סיסמה: 1234. ניתן לשנות בלוח)`;
}

function buildJson(request: BoardRequest) {
  return JSON.stringify({
    childName: request.childName,
    age: request.age,
    gender: request.gender,
    childDescription: request.childDescription || '',
    behaviorGoals: request.behaviorGoals || '',
    tasks: request.tasks || '',
    rewards: request.rewards || '',
    additionalNotes: request.additionalNotes || '',
    dailyReward: request.dailyReward || 1,
    coinStyle: request.coinStyle || 'points',
    colorSchema: request.colorSchema || 'blue',
    showDino: request.showDino !== false,
    soundsEnabled: request.soundsEnabled !== false,
    childImage: request.childImage || null,
    parentInfo: {
      parentName: request.parentName,
      email: request.email,
      phone: request.phone,
    },
    inviteToken: request.inviteToken || null,
  }, null, 2);
}

export default function BoardRequests() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmGenerate, setConfirmGenerate] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [linkBoardId, setLinkBoardId] = useState<string | null>(null);
  const [linkBoardValue, setLinkBoardValue] = useState('');

  const { data: requestsResponse, isLoading } = useQuery({
    queryKey: ['board-requests'],
    queryFn: () => boardRequestsApi.getAll(),
  });

  const generateMutation = useMutation({
    mutationFn: (id: string) => boardRequestsApi.generate(id),
    onSuccess: (res, id) => {
      queryClient.invalidateQueries({ queryKey: ['board-requests'] });
      setConfirmGenerate(null);
      if (res.data?.kidId) {
        const request = allRequests.find(r => r.id === id);
        const msg = buildCustomerMessage(request?.childName || 'הילד', res.data.kidId);
        navigator.clipboard.writeText(msg);
        showToast('הלוח נוצר והודעה הועתקה!');
      }
    },
    onError: (err: Error) => {
      setConfirmGenerate(null);
      showToast('שגיאה: ' + err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BoardRequest> }) =>
      boardRequestsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-requests'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => boardRequestsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-requests'] });
      setConfirmDelete(null);
      setExpandedId(null);
      showToast('הבקשה נמחקה');
    },
  });

  const allRequests = requestsResponse?.data || [];
  const filtered = filter === 'all' ? allRequests : allRequests.filter(r => r.status === filter);
  const pendingCount = allRequests.filter(r => r.status === 'pending').length;
  const completedCount = allRequests.filter(r => r.status === 'completed').length;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  async function copyJson(request: BoardRequest) {
    await navigator.clipboard.writeText(buildJson(request));
    showToast('JSON הועתק!');
  }

  async function copyJsonAndComplete(request: BoardRequest) {
    await navigator.clipboard.writeText(buildJson(request));
    updateMutation.mutate({ id: request.id, data: { status: 'completed' } });
    showToast('JSON הועתק וסומן כהושלם!');
  }

  async function copyCustomerMessage(request: BoardRequest) {
    if (request.createdBoardId) {
      const msg = buildCustomerMessage(request.childName, request.createdBoardId);
      await navigator.clipboard.writeText(msg);
      showToast('הודעה ללקוח הועתקה!');
    } else {
      setLinkBoardId(request.id);
      setLinkBoardValue('');
    }
  }

  async function copyEmail(email: string) {
    await navigator.clipboard.writeText(email);
    showToast('אימייל הועתק!');
  }

  function handleLinkBoard() {
    if (linkBoardId && linkBoardValue.trim()) {
      updateMutation.mutate({ id: linkBoardId, data: { createdBoardId: linkBoardValue.trim() } });
      setLinkBoardId(null);
      setLinkBoardValue('');
      showToast('לוח קושר בהצלחה!');
    }
  }

  return (
    <div className="board-requests-container">
      {/* Toast */}
      {toast && <div className="br-toast">{toast}</div>}

      {/* Stats */}
      <div className="br-stats">
        <div className="br-stat-card">
          <div className="br-stat-number">{allRequests.length}</div>
          <div className="br-stat-label">סה"כ בקשות</div>
        </div>
        <div className="br-stat-card br-stat-pending">
          <div className="br-stat-number">{pendingCount}</div>
          <div className="br-stat-label">ממתינות</div>
        </div>
        <div className="br-stat-card br-stat-completed">
          <div className="br-stat-number">{completedCount}</div>
          <div className="br-stat-label">הושלמו</div>
        </div>
      </div>

      {/* Filter */}
      <div className="br-filter">
        <label>סינון:</label>
        <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
          <option value="all">הכל</option>
          <option value="pending">ממתין לטיפול</option>
          <option value="completed">הושלם</option>
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="loading">טוען בקשות...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p>אין בקשות {filter !== 'all' ? 'במצב זה' : 'עדיין'}</p></div>
      ) : (
        <div className="br-list">
          {filtered.map(request => (
            <RequestCard
              key={request.id}
              request={request}
              isExpanded={expandedId === request.id}
              onToggle={() => setExpandedId(expandedId === request.id ? null : request.id)}
              onGenerateAI={() => setConfirmGenerate(request.id)}
              onCopyJson={() => request.status === 'pending' ? copyJsonAndComplete(request) : copyJson(request)}
              onCopyMessage={() => copyCustomerMessage(request)}
              onCopyEmail={() => request.email && copyEmail(request.email)}
              onLinkBoard={() => { setLinkBoardId(request.id); setLinkBoardValue(''); }}
              onDelete={() => setConfirmDelete(request.id)}
              isGenerating={generateMutation.isPending && confirmGenerate === request.id}
            />
          ))}
        </div>
      )}

      {/* Confirm AI generation */}
      {confirmGenerate && (
        <ConfirmModal
          title="יצירת לוח עם AI"
          message="האם ליצור לוח אוטומטית עם AI? הלוח ייווצר והודעה עם הלינקים תועתק אוטומטית."
          confirmText={generateMutation.isPending ? 'יוצר...' : 'צור לוח'}
          onConfirm={() => generateMutation.mutate(confirmGenerate)}
          onCancel={() => setConfirmGenerate(null)}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmModal
          title="מחיקת בקשה"
          message={`למחוק את הבקשה של ${allRequests.find(r => r.id === confirmDelete)?.childName || ''}? לא ניתן לשחזר.`}
          confirmText={deleteMutation.isPending ? 'מוחק...' : 'מחק'}
          confirmStyle="danger"
          onConfirm={() => deleteMutation.mutate(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Link board modal */}
      {linkBoardId && (
        <div className="modal-overlay" onClick={() => setLinkBoardId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>קישור ללוח קיים</h3>
            <div className="form-group">
              <label>הכנס את ה-ID של הלוח:</label>
              <input
                type="text"
                value={linkBoardValue}
                onChange={e => setLinkBoardValue(e.target.value)}
                autoFocus
                placeholder="kid ID"
              />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setLinkBoardId(null)} className="btn-secondary">ביטול</button>
              <button type="button" onClick={handleLinkBoard} className="btn-primary" disabled={!linkBoardValue.trim()}>
                קשר לוח
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface RequestCardProps {
  request: BoardRequest;
  isExpanded: boolean;
  onToggle: () => void;
  onGenerateAI: () => void;
  onCopyJson: () => void;
  onCopyMessage: () => void;
  onCopyEmail: () => void;
  onLinkBoard: () => void;
  onDelete: () => void;
  isGenerating: boolean;
}

function RequestCard({
  request, isExpanded, onToggle, onGenerateAI, onCopyJson, onCopyMessage, onCopyEmail, onLinkBoard, onDelete, isGenerating,
}: RequestCardProps) {
  const isPending = request.status === 'pending';

  return (
    <div className={`br-card${isExpanded ? ' expanded' : ''}`}>
      {/* Clickable header */}
      <div className="br-card-header" onClick={onToggle}>
        <div className="br-card-header-left">
          <div className="br-avatar">
            {request.childImage
              ? <img src={request.childImage} alt={request.childName} />
              : <span>👤</span>
            }
          </div>
          <div className="br-card-info">
            <div className="br-card-name">{request.childName || 'לא צוין'}</div>
            <div className="br-card-parent">הורה: {request.parentName || 'לא צוין'}</div>
          </div>
        </div>
        <span className={`br-status ${isPending ? 'br-status-pending' : 'br-status-completed'}`}>
          {isPending ? 'ממתין' : 'הושלם'}
        </span>
      </div>

      {/* Meta info */}
      <div className="br-card-meta">
        {request.email && <span>📧 {request.email}</span>}
        {request.phone && <span>📱 {request.phone}</span>}
        {request.age && <span>גיל {request.age}</span>}
        <span>📅 {formatDate(request.submittedAt)}</span>
      </div>

      {/* Expandable details */}
      {isExpanded && (
        <div className="br-card-details">
          {/* Child image large */}
          {request.childImage && (
            <div className="br-detail-section" style={{ textAlign: 'center' }}>
              <div className="br-detail-title">תמונת הילד/ה</div>
              <img src={request.childImage} alt={request.childName} className="br-detail-image" />
            </div>
          )}

          {/* Settings grid */}
          <div className="br-detail-grid">
            <div className="br-detail-item">
              <div className="br-detail-item-label">מגדר</div>
              <div className="br-detail-item-value">
                {request.gender === 'boy' ? 'בן' : request.gender === 'girl' ? 'בת' : 'לא צוין'}
              </div>
            </div>
            <div className="br-detail-item">
              <div className="br-detail-item-label">סוג מטבע</div>
              <div className="br-detail-item-value">{COIN_LABELS[request.coinStyle || ''] || 'לא צוין'}</div>
            </div>
            <div className="br-detail-item">
              <div className="br-detail-item-label">פרס יומי</div>
              <div className="br-detail-item-value">{request.dailyReward ?? 0}</div>
            </div>
            <div className="br-detail-item">
              <div className="br-detail-item-label">צבע עיצוב</div>
              <div className="br-detail-item-value">{COLOR_LABELS[request.colorSchema || ''] || 'לא צוין'}</div>
            </div>
            <div className="br-detail-item">
              <div className="br-detail-item-label">דינו</div>
              <div className="br-detail-item-value">{request.showDino ? 'מופעל' : 'כבוי'}</div>
            </div>
            <div className="br-detail-item">
              <div className="br-detail-item-label">צלילים</div>
              <div className="br-detail-item-value">{request.soundsEnabled ? 'מופעל' : 'כבוי'}</div>
            </div>
          </div>

          {/* Text sections */}
          {request.childDescription && (
            <div className="br-detail-section">
              <div className="br-detail-title">תיאור הילד/ה</div>
              <div className="br-detail-content">{request.childDescription}</div>
            </div>
          )}
          {request.tasks && (
            <div className="br-detail-section">
              <div className="br-detail-title">משימות יומיומיות</div>
              <div className="br-detail-content">{request.tasks}</div>
            </div>
          )}
          {request.behaviorGoals && (
            <div className="br-detail-section">
              <div className="br-detail-title">יעדים התנהגותיים</div>
              <div className="br-detail-content">{request.behaviorGoals}</div>
            </div>
          )}
          {request.rewards && (
            <div className="br-detail-section">
              <div className="br-detail-title">פרסים ויעדים</div>
              <div className="br-detail-content">{request.rewards}</div>
            </div>
          )}
          {request.additionalNotes && (
            <div className="br-detail-section">
              <div className="br-detail-title">הערות נוספות</div>
              <div className="br-detail-content">{request.additionalNotes}</div>
            </div>
          )}

          {/* Action buttons */}
          <div className="br-actions">
            {isPending && (
              <button className="br-btn br-btn-ai" onClick={onGenerateAI} disabled={isGenerating}>
                {isGenerating ? <><span className="br-spinner" /> יוצר לוח...</> : 'צור לוח עם AI'}
              </button>
            )}
            <button className="br-btn br-btn-primary" onClick={onCopyJson}>
              העתק JSON
            </button>
            {!isPending && (
              <button className="br-btn br-btn-success" onClick={onCopyMessage}>
                העתק הודעה ללקוח
              </button>
            )}
            {!isPending && !request.createdBoardId && (
              <button className="br-btn br-btn-secondary" onClick={onLinkBoard}>
                קשר ללוח קיים
              </button>
            )}
            {request.createdBoardId && (
              <a
                href={`https://startdoing.co.il/board.html?kid=${encodeURIComponent(request.createdBoardId)}`}
                className="br-btn br-btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                צפה בלוח
              </a>
            )}
            {request.email && (
              <button className="br-btn br-btn-secondary" onClick={onCopyEmail}>
                העתק אימייל
              </button>
            )}
            <button className="br-btn br-btn-danger" onClick={onDelete}>
              מחק בקשה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
