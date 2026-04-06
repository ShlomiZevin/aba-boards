import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { kidsApi, chatApi, summariesApi, practitionersApi } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import ConfirmModal from '../components/ConfirmModal';
import type { Kid } from '../types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
  statusLabel?: string;
  toolsUsed?: string[];
  boardUpdated?: boolean;
  summaryCreated?: boolean;
  summaryMeta?: { kidId: string; kidName: string; fromDate: string; toDate: string };
}

export default function ChatCenter() {
  const { isParentView, parentKidId, isTherapistView, practitionerId } = useTherapist();

  const welcomeMessage = isParentView
    ? 'שלום! אני העוזרת של Doing. אפשר לשאול אותי שאלות על ההתקדמות של הילד/ה, להבין את המטרות, או לקבל טיפים. איך אפשר לעזור?'
    : 'שלום! אני העוזרת החכמה של Doing. אפשר לשאול אותי שאלות על הילדים, לבנות לוחות חדשים, או לבקש סיכומים. איך אפשר לעזור?';

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', content: welcomeMessage },
  ]);
  const [input, setInput] = useState('');
  const [selectedKidId, setSelectedKidId] = useState<string | null>(parentKidId || null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: kidsResult } = useQuery({
    queryKey: isTherapistView ? ['therapist-kids', practitionerId] : ['kids'],
    queryFn: () => isTherapistView && practitionerId
      ? practitionersApi.getKidsForPractitioner(practitionerId)
      : kidsApi.getAll(),
    enabled: !isParentView,
  });
  const kids: Kid[] = kidsResult?.success ? (kidsResult.data ?? []) : [];
  const requiresKidSelection = isTherapistView && !selectedKidId;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (extraBody?: Record<string, unknown>, overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || isSending || requiresKidSelection) return;

    setInput('');
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text };
    const loadingMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: '', isLoading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsSending(true);

    try {
      // Build message history for API (exclude loading and system messages)
      const history = [...messages.filter(m => m.id !== 'welcome'), userMsg]
        .filter(m => !m.isLoading)
        .slice(-20) // last 20 messages for context
        .map(m => ({ role: m.role, content: m.content }));

      const result = await chatApi.sendStream(history, selectedKidId, (event) => {
        // Update loading message with current status
        if (event.type === 'thinking' || event.type === 'tool') {
          setMessages(prev =>
            prev.map(m => m.isLoading ? { ...m, statusLabel: event.label } : m)
          );
        }
      }, extraBody);

      const meta = pendingSummaryMeta.current;
      pendingSummaryMeta.current = null;
      const aiMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: result.reply,
        toolsUsed: result.toolsUsed,
        boardUpdated: result.boardUpdated,
        summaryCreated: result.summaryCreated,
        ...(meta && result.toolsUsed?.includes('get_summary_data') ? { summaryMeta: meta } : {}),
      };
      setMessages(prev => prev.filter(m => !m.isLoading).concat(aiMsg));
    } catch {
      setMessages(prev =>
        prev.filter(m => !m.isLoading).concat({
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: 'שגיאה בתקשורת עם השרת. נסו שוב.',
        })
      );
    }

    setIsSending(false);
    inputRef.current?.focus();
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryKidId, setSummaryKidId] = useState('');
  const [summaryWeeks, setSummaryWeeks] = useState('2');
  const pendingSummaryMeta = useRef<{ kidId: string; kidName: string; fromDate: string; toDate: string } | null>(null);

  const requestSummary = () => {
    const kid = kids.find(k => k.id === summaryKidId);
    if (!kid) return;
    const weeks = parseInt(summaryWeeks) || 2;
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - weeks * 7);
    const from = fromDate.toISOString().split('T')[0];
    const to = toDate.toISOString().split('T')[0];

    const prompt = `הכיני סיכום תקופתי מקצועי עבור ${kid.name} לתקופה ${from} עד ${to}.

הסיכום צריך לכלול:
1. **פרטי הילד/ה** — שם, תקופת הסיכום
2. **מטרות טיפול פעילות** — רשימת המטרות הנוכחיות
3. **סיכום טיפולים** — כמה טיפולים היו, שיתוף פעולה ממוצע, מצב רוח כללי, ריכוז
4. **הצלחות בולטות** — מה הלך טוב בתקופה
5. **קשיים ואתגרים** — מה היה קשה
6. **איסוף נתונים** — נתונים ממטרות שנאספו בתקופה
7. **המלצות להמשך** — מה לעשות בהמשך

כתבי את הסיכום בעברית, בפורמט מקצועי ומסודר עם כותרות ותתי-כותרות.`;

    pendingSummaryMeta.current = { kidId: summaryKidId, kidName: kid.name, fromDate: from, toDate: to };
    setShowSummaryModal(false);
    setSelectedKidId(summaryKidId);
    sendMessage(undefined, prompt);
  };

  const saveSummaryDirect = async (msg: ChatMessage) => {
    if (!msg.summaryMeta || isSending) return;
    const { kidId, kidName, fromDate, toDate } = msg.summaryMeta;

    setIsSending(true);
    try {
      const title = `סיכום תקופתי - ${kidName} - ${fromDate} עד ${toDate}`;
      const result = await summariesApi.create({ kidId, title, content: msg.content, fromDate, toDate });
      if (result.success) {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, summaryCreated: true } : m));
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'שגיאה בשמירת הסיכום. נסו שוב.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'שגיאה בשמירת הסיכום. נסו שוב.' }]);
    }
    setIsSending(false);
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'שלום! איך אפשר לעזור?',
      },
    ]);
    setShowClearConfirm(false);
  };

  return (
    <div className="chat-center-page">
      <div className="chat-center-topbar">
        {isParentView && (
          <Link to={`/p/${parentKidId}`} style={{ color: '#7c3aed', textDecoration: 'none', fontSize: '1.1rem' }}>→ חזרה</Link>
        )}
        <div className="chat-center-title">🤖 צ׳אט AI</div>
        <div className="chat-center-controls">
          {!isParentView && (
            <select
              className="chat-kid-select"
              value={selectedKidId || ''}
              onChange={e => setSelectedKidId(e.target.value || null)}
            >
              {isTherapistView
                ? <option value="">בחרו ילד/ה</option>
                : <option value="">כל הילדים</option>
              }
              {kids.map(kid => (
                <option key={kid.id} value={kid.id}>{kid.name}</option>
              ))}
            </select>
          )}
          <button className="chat-clear-btn" onClick={() => setShowClearConfirm(true)} title="ניקוי שיחה">🗑</button>
        </div>
      </div>

      <div className="chat-center-messages">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`chat-center-msg chat-center-msg-${msg.role} ${msg.isLoading ? 'loading' : ''}`}
          >
            {msg.isLoading ? (
              <div className="chat-center-typing">
                <div className="chat-center-typing-dots"><span /><span /><span /></div>
                {msg.statusLabel && <div className="chat-center-status-label">{msg.statusLabel}</div>}
              </div>
            ) : (
              <>
                <div className="chat-center-msg-text">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
                {msg.boardUpdated && (
                  <div className="chat-center-board-badge">✅ הלוח עודכן</div>
                )}
                {msg.summaryCreated && (
                  <div className="chat-center-board-badge">📝 הסיכום נשמר</div>
                )}
                {msg.summaryMeta && !msg.summaryCreated && (
                  <button
                    className="chat-save-summary-btn"
                    onClick={() => saveSummaryDirect(msg)}
                    disabled={isSending}
                  >
                    📝 שמור כסיכום
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-center-input-area">
        <input
          ref={inputRef}
          type="text"
          className="chat-center-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
          placeholder={requiresKidSelection ? "יש לבחור ילד/ה לפני שליחת הודעה" : isParentView ? "שאלו שאלה על הילד/ה, על ההתקדמות, או בקשו טיפים..." : "שאלו שאלה, בקשו לבנות לוח, או בקשו סיכום..."}
          disabled={isSending || requiresKidSelection}
          autoFocus
        />
        <button
          className="chat-center-send-btn"
          onClick={() => sendMessage()}
          disabled={isSending || !input.trim() || requiresKidSelection}
        >
          ➤
        </button>
        {!isParentView && (
          <button
            className="chat-summary-btn"
            onClick={() => { setSummaryKidId(selectedKidId || ''); setShowSummaryModal(true); }}
            disabled={isSending}
            title="בקש סיכום תקופתי"
          >
            📊
          </button>
        )}
      </div>
      {showClearConfirm && (
        <ConfirmModal
          title="ניקוי שיחה"
          message="לנקות את כל השיחה?"
          confirmText="נקה"
          onConfirm={clearChat}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
      {showSummaryModal && (
        <div className="modal-overlay" onClick={() => setShowSummaryModal(false)}>
          <div className="summary-request-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: '#2d3748' }}>📊 בקשת סיכום תקופתי</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.9rem' }}>ילד/ה</label>
              <select
                className="chat-kid-select"
                style={{ width: '100%' }}
                value={summaryKidId}
                onChange={e => setSummaryKidId(e.target.value)}
              >
                <option value="">בחרו ילד/ה</option>
                {kids.map(kid => (
                  <option key={kid.id} value={kid.id}>{kid.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.9rem' }}>תקופה</label>
              <select
                className="chat-kid-select"
                style={{ width: '100%' }}
                value={summaryWeeks}
                onChange={e => setSummaryWeeks(e.target.value)}
              >
                <option value="1">שבוע אחרון</option>
                <option value="2">שבועיים אחרונים</option>
                <option value="3">3 שבועות אחרונים</option>
                <option value="4">חודש אחרון</option>
                <option value="6">6 שבועות אחרונים</option>
                <option value="8">חודשיים אחרונים</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start' }}>
              <button
                className="chat-center-send-btn"
                style={{ width: 'auto', padding: '8px 20px', borderRadius: 8, fontSize: '0.95rem' }}
                onClick={requestSummary}
                disabled={!summaryKidId}
              >
                בקש סיכום
              </button>
              <button
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontSize: '0.95rem' }}
                onClick={() => setShowSummaryModal(false)}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
