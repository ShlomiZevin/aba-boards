import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { kidsApi, chatApi, chatHistoryApi, summariesApi, practitionersApi, imagesApi, IMAGE_MODELS } from '../api/client';
import type { ImageModel } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useAuth } from '../contexts/AuthContext';
import ChatHistoryPanel from '../components/ChatHistoryPanel';
import type { Kid } from '../types';
import Icon from '../v2/Icon';
import KidAvatar from '../v2/KidAvatar';
import '../v2/pages/tm.css';

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
  images?: string[];
  imageCost?: number;
  imageCostCurrency?: string;
  imageModelLabel?: string;
}

export default function ChatCenter() {
  const { isParentView, parentKidId, isTherapistView, practitionerId } = useTherapist();
  const { user } = useAuth();
  const canGenerateImages = !!user?.isSuperAdmin;
  // Therapist/parent links override a stored admin key in API calls, so only the admin view acts as super admin
  const isSuperAdminView = !!user?.isSuperAdmin && !isTherapistView && !isParentView;

  const welcomeMessage = isParentView
    ? 'שלום! אני העוזרת של Doing. אפשר לשאול אותי שאלות על ההתקדמות של הילד/ה, להבין את המטרות, או לקבל טיפים. איך אפשר לעזור?'
    : 'שלום! אני העוזרת החכמה של Doing. אפשר לשאול אותי שאלות על הילדים, לבנות לוחות חדשים, או לבקש סיכומים. איך אפשר לעזור?';

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', content: welcomeMessage },
  ]);
  const [input, setInput] = useState('');
  const [selectedKidId, setSelectedKidId] = useState<string | null>(parentKidId || null);
  const [isSending, setIsSending] = useState(false);
  // History: the conversation being continued, or (super admin) someone else's being viewed read-only
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [viewingOwner, setViewingOwner] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const queryClient = useQueryClient();
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
    if (!text || isSending || requiresKidSelection || viewingOwner) return;

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
      }, { ...extraBody, conversationId });
      if (result.conversationId) setConversationId(result.conversationId);
      queryClient.invalidateQueries({ queryKey: ['chat-history'] });

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
    } catch (err) {
      const msg = (err as Error)?.message || '';
      setMessages(prev =>
        prev.filter(m => !m.isLoading).concat({
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: /^HTTP|fetch|network/i.test(msg) || !msg ? 'שגיאה בתקשורת עם השרת. נסו שוב.' : msg,
        })
      );
    }

    setIsSending(false);
    inputRef.current?.focus();
  };

  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryKidId, setSummaryKidId] = useState('');
  const [summaryWeeks, setSummaryWeeks] = useState('2');
  const [summaryDetail, setSummaryDetail] = useState<'short' | 'full'>('short');
  const pendingSummaryMeta = useRef<{ kidId: string; kidName: string; fromDate: string; toDate: string } | null>(null);

  const [showImageModal, setShowImageModal] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageModel, setImageModel] = useState<ImageModel>('nano-banana-2');

  const generateImage = async () => {
    const prompt = imagePrompt.trim();
    if (!prompt || isSending) return;

    setShowImageModal(false);
    setImagePrompt('');

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: `🎨 ${prompt}` };
    const loadingMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      isLoading: true,
      statusLabel: 'יוצר 2 תמונות... (עשוי לקחת עד דקה)',
    };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsSending(true);

    try {
      const result = await imagesApi.generate(prompt, imageModel, { conversationId, kidId: selectedKidId });
      if (result.success && result.data) {
        const { images, cost, costCurrency, modelLabel } = result.data;
        if (result.data.conversationId) setConversationId(result.data.conversationId);
        queryClient.invalidateQueries({ queryKey: ['chat-history'] });
        setMessages(prev => prev.filter(m => !m.isLoading).concat({
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: '',
          images,
          imageCost: cost,
          imageCostCurrency: costCurrency,
          imageModelLabel: modelLabel,
        }));
      } else {
        setMessages(prev => prev.filter(m => !m.isLoading).concat({
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: result.error || 'שגיאה ביצירת התמונה. נסו שוב.',
        }));
      }
    } catch {
      setMessages(prev => prev.filter(m => !m.isLoading).concat({
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'שגיאה ביצירת התמונה. נסו שוב.',
      }));
    }

    setIsSending(false);
    inputRef.current?.focus();
  };

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
    sendMessage({ summaryDetail }, prompt);
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

  const startNewChat = () => {
    setMessages([{ id: 'welcome', role: 'assistant', content: 'שלום! איך אפשר לעזור?' }]);
    setConversationId(null);
    setViewingOwner(null);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const openConversation = async (id: string) => {
    setShowHistory(false);
    const res = await chatHistoryApi.get(id);
    if (!res.success || !res.data) return;
    const conv = res.data;
    setMessages(conv.messages.map((m, i) => ({
      id: `${conv.id}-${i}`,
      role: m.role,
      content: m.content,
      toolsUsed: m.toolsUsed,
      boardUpdated: m.boardUpdated,
      summaryCreated: m.summaryCreated,
      images: m.images,
      imageModelLabel: m.imageModelLabel,
    })));
    if (conv.isMine) {
      setConversationId(conv.id);
      setViewingOwner(null);
      if (!isParentView) setSelectedKidId(conv.kidId);
    } else {
      setConversationId(null);
      setViewingOwner(`${conv.ownerRole} · ${conv.ownerName}`);
    }
  };

  const weekOptions = [
    { value: '1', label: 'שבוע אחרון' },
    { value: '2', label: 'שבועיים' },
    { value: '3', label: '3 שבועות' },
    { value: '4', label: 'חודש' },
    { value: '6', label: '6 שבועות' },
    { value: '8', label: 'חודשיים' },
  ];

  return (
    <div className={`chat-center-page tm-chat${isParentView ? ' is-bare' : ''}`}>
      <div className="tm-chat-top">
        <div className="tm-chat-title">
          {isParentView && (
            <Link to={`/p/${parentKidId}`} className="tm-back"><Icon name="back" size={20} /> חזרה</Link>
          )}
          <h1>צ׳אט <mark className="hl-lilac">AI</mark></h1>
          <button type="button" className="tm-ic" onClick={() => setShowHistory(true)} title="היסטוריית שיחות" aria-label="היסטוריית שיחות"><Icon name="clock" /></button>
          <button type="button" className="tm-ic" onClick={startNewChat} title="שיחה חדשה" aria-label="שיחה חדשה"><Icon name="plus" /></button>
        </div>
        {!isParentView && (kids.length > 0 || !isTherapistView) && (
          <div className={`tm-kidpick${requiresKidSelection ? ' needs' : ''}`} role="group" aria-label="בחירת ילד/ה לשיחה">
            {!isTherapistView && (
              <button type="button" className={`tm-pick${!selectedKidId ? ' is-on' : ''}`} aria-pressed={!selectedKidId}
                onClick={() => setSelectedKidId(null)} disabled={!!viewingOwner}>כל הילדים</button>
            )}
            {kids.map(kid => (
              <button key={kid.id} type="button" className={`tm-pick${selectedKidId === kid.id ? ' is-on' : ''}`} aria-pressed={selectedKidId === kid.id}
                onClick={() => setSelectedKidId(kid.id)} disabled={!!viewingOwner}>
                <KidAvatar kid={kid} size="sm" /> {kid.name}
              </button>
            ))}
          </div>
        )}
        {requiresKidSelection && <p className="tm-hint">בחרו ילד/ה כדי להתחיל לשאול</p>}
      </div>

      {viewingOwner && (
        <div className="tm-viewing">
          <span>צפייה בשיחה של {viewingOwner} — קריאה בלבד</span>
          <button type="button" className="nb-btn-ghost sm" onClick={startNewChat}>חזרה לשיחה חדשה</button>
        </div>
      )}

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
                {msg.content && (
                  <div className="chat-center-msg-text">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                )}
                {msg.images && msg.images.length > 0 && (
                  <div className="chat-image-result">
                    <div className="chat-image-grid">
                      {msg.images.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="chat-image-item">
                          <img src={url} alt={`תמונה ${i + 1}`} loading="lazy" />
                        </a>
                      ))}
                    </div>
                    <div className="chat-image-meta">
                      {msg.imageModelLabel && <span className="nb-chip chat-image-model">{msg.imageModelLabel}</span>}
                      {typeof msg.imageCost === 'number' && (
                        <span className="chat-image-cost tabular">
                          עלות: ${msg.imageCost.toFixed(4)} ({msg.images.length} תמונות)
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {(msg.boardUpdated || msg.summaryCreated) && (
                  <div className="tm-badge-row">
                    {msg.boardUpdated && <span className="nb-sticker tone-mint"><Icon name="check" size={16} /> הלוח עודכן</span>}
                    {msg.summaryCreated && <span className="nb-sticker tone-yellow" style={{ ['--rot' as string]: '2deg' }}><Icon name="report" size={16} /> הסיכום נשמר</span>}
                  </div>
                )}
                {msg.summaryMeta && !msg.summaryCreated && (
                  <button
                    type="button"
                    className="nb-btn-ghost sm tm-save"
                    onClick={() => saveSummaryDirect(msg)}
                    disabled={isSending}
                  >
                    <Icon name="report" size={18} /> שמור כסיכום
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="tm-composer">
        {!isSuperAdminView && (
          <p className="tm-privacy">השיחות נשמרות ל-14 יום וגלויות גם למנהלת המערכת</p>
        )}
        <div className="tm-compose-row">
          {!isParentView && (
            <button
              type="button"
              className="tm-ic"
              onClick={() => { setSummaryKidId(selectedKidId || ''); setShowSummaryModal(true); }}
              disabled={isSending}
              title="בקש סיכום תקופתי"
              aria-label="בקשת סיכום תקופתי"
            >
              <Icon name="report" />
            </button>
          )}
          {canGenerateImages && (
            <button
              type="button"
              className="tm-ic"
              onClick={() => setShowImageModal(true)}
              disabled={isSending}
              title="צור תמונה מטקסט"
              aria-label="יצירת תמונה מטקסט"
            >
              <ImageIcon />
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            className="chat-center-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
            placeholder={requiresKidSelection ? "יש לבחור ילד/ה לפני שליחת הודעה" : isParentView ? "שאלו שאלה על הילד/ה, על ההתקדמות, או בקשו טיפים..." : "שאלו שאלה, בקשו לבנות לוח, או בקשו סיכום..."}
            disabled={isSending || requiresKidSelection || !!viewingOwner}
            aria-label="הודעה"
            autoFocus
          />
          <button
            type="button"
            className="tm-send"
            onClick={() => sendMessage()}
            disabled={isSending || !input.trim() || requiresKidSelection || !!viewingOwner}
            aria-label="שליחה"
          >
            <SendIcon />
          </button>
        </div>
      </div>
      {showHistory && (
        <ChatHistoryPanel
          isSuperAdmin={isSuperAdminView}
          activeId={conversationId}
          onOpen={openConversation}
          onNew={startNewChat}
          onDeleted={id => { if (id === conversationId) startNewChat(); }}
          onClose={() => setShowHistory(false)}
        />
      )}
      {showSummaryModal && (
        <div className="modal-overlay" onClick={() => setShowSummaryModal(false)}>
          <div className="modal tm-req" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="tm-sum-title">
            <h3 id="tm-sum-title"><Icon name="report" /> בקשת סיכום תקופתי</h3>
            <div className="tm-field">
              <b>ילד/ה</b>
              <div className="tm-chips" role="group" aria-label="ילד/ה">
                {kids.map(kid => (
                  <button key={kid.id} type="button" className={`tm-pick${summaryKidId === kid.id ? ' is-on' : ''}`} aria-pressed={summaryKidId === kid.id}
                    onClick={() => setSummaryKidId(kid.id)}>{kid.name}</button>
                ))}
              </div>
            </div>
            <div className="tm-field">
              <b>תקופה</b>
              <div className="tm-chips" role="group" aria-label="תקופה">
                {weekOptions.map(o => (
                  <button key={o.value} type="button" className={`tm-pick${summaryWeeks === o.value ? ' is-on' : ''}`} aria-pressed={summaryWeeks === o.value}
                    onClick={() => setSummaryWeeks(o.value)}>{o.label}</button>
                ))}
              </div>
            </div>
            <div className="tm-field">
              <b>רמת פירוט</b>
              <div className="tm-chips" role="group" aria-label="רמת פירוט">
                <button type="button" className={`tm-pick${summaryDetail === 'short' ? ' is-on' : ''}`} aria-pressed={summaryDetail === 'short'} onClick={() => setSummaryDetail('short')}>מקוצר (מהיר)</button>
                <button type="button" className={`tm-pick${summaryDetail === 'full' ? ' is-on' : ''}`} aria-pressed={summaryDetail === 'full'} onClick={() => setSummaryDetail('full')}>מלא (איטי יותר)</button>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowSummaryModal(false)}>ביטול</button>
              <button type="button" className="btn-primary" onClick={requestSummary} disabled={!summaryKidId}>בקש סיכום</button>
            </div>
          </div>
        </div>
      )}
      {showImageModal && (
        <div className="modal-overlay" onClick={() => !isSending && setShowImageModal(false)}>
          <div className="modal tm-req" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="tm-img-title">
            <h3 id="tm-img-title"><ImageIcon /> יצירת תמונה מטקסט</h3>
            <label className="tm-field">
              <b>תיאור התמונה</b>
              <textarea
                className="chat-image-prompt"
                value={imagePrompt}
                onChange={e => setImagePrompt(e.target.value)}
                placeholder="לדוגמה: דינוזאור חמוד ומחייך בסגנון איור שטוח לילדים"
                rows={3}
                autoFocus
              />
            </label>
            <div className="tm-field">
              <b>מודל</b>
              <div className="tm-chips" role="group" aria-label="מודל">
                {IMAGE_MODELS.map(m => (
                  <button key={m.value} type="button" className={`tm-pick${imageModel === m.value ? ' is-on' : ''}`} aria-pressed={imageModel === m.value}
                    onClick={() => setImageModel(m.value)}>{m.label}</button>
                ))}
              </div>
            </div>
            <p className="nb-muted">יווצרו 2 תמונות בגודל 9:16 (לאורך). העלות תוצג לאחר היצירה.</p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowImageModal(false)} disabled={isSending}>ביטול</button>
              <button type="button" className="btn-primary" onClick={generateImage} disabled={!imagePrompt.trim() || isSending}>צור 2 תמונות</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SendIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12l16-7.5-5.5 16-3-6.5z M11.5 14L20 4.5" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v14H4z M4 16l4.5-4.5 4 4 2.5-2.5 5 5 M15.5 9.5h.01" />
    </svg>
  );
}
