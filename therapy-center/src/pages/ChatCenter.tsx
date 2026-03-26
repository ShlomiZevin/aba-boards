import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { kidsApi, chatApi } from '../api/client';
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
}

export default function ChatCenter() {
  const { isParentView, parentKidId } = useTherapist();

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
    queryKey: ['kids'],
    queryFn: () => kidsApi.getAll(),
    enabled: !isParentView,
  });
  const kids: Kid[] = kidsResult?.success ? (kidsResult.data ?? []) : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isSending) return;

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
      });

      const aiMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: result.reply,
        toolsUsed: result.toolsUsed,
        boardUpdated: result.boardUpdated,
        summaryCreated: result.summaryCreated,
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
              <option value="">כל הילדים</option>
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
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={isParentView ? "שאלו שאלה על הילד/ה, על ההתקדמות, או בקשו טיפים..." : "שאלו שאלה, בקשו לבנות לוח, או בקשו סיכום..."}
          disabled={isSending}
          autoFocus
        />
        <button
          className="chat-center-send-btn"
          onClick={sendMessage}
          disabled={isSending || !input.trim()}
        >
          ➤
        </button>
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
    </div>
  );
}
