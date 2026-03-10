import { useState } from 'react';

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'משימות יומיות',
    emojis: ['🛏️', '👕', '🧼', '🦷', '🍽️', '🚿', '🌙', '👋', '🎒', '📚', '✏️', '🧹', '🧺', '🍎', '💊', '🥤'],
  },
  {
    label: 'פעילויות',
    emojis: ['⚽', '🚴', '📖', '🎨', '🎵', '🧩', '🏊', '🛴', '🤸', '🎮', '🧸', '🎲'],
  },
  {
    label: 'פרסים',
    emojis: ['⭐', '🏆', '🎁', '🍦', '🍫', '🎈', '🎉', '👑', '💎', '🌈', '🦄', '🐶'],
  },
  {
    label: 'חברתי',
    emojis: ['🤝', '💬', '👀', '👂', '🙋', '😊', '❤️', '👨‍👩‍👧‍👦', '🫂', '✋', '🗣️', '😌'],
  },
  {
    label: 'עוד',
    emojis: ['🔔', '⏰', '📱', '🏠', '🚗', '✅', '💪', '🧠', '🌟', '🎯', '🔑', '📝'],
  },
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  onClose?: () => void;
  inline?: boolean;
}

export default function EmojiPicker({ value, onChange, onClose, inline }: EmojiPickerProps) {
  const [search, setSearch] = useState('');

  const allEmojis = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
  const filtered = search
    ? allEmojis.filter((e) => e.includes(search))
    : null;

  return (
    <div className={`bb-emoji-picker ${inline ? 'bb-emoji-picker-inline' : ''}`}>
      <input
        type="text"
        className="bb-emoji-search"
        placeholder="חפש אמוג׳י..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      {filtered ? (
        <div className="bb-emoji-grid">
          {filtered.length === 0 && <div className="bb-emoji-empty">לא נמצא</div>}
          {filtered.map((emoji, i) => (
            <button
              key={i}
              type="button"
              className={`bb-emoji-btn ${emoji === value ? 'selected' : ''}`}
              onClick={() => { onChange(emoji); onClose?.(); }}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : (
        EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <div className="bb-emoji-cat-label">{cat.label}</div>
            <div className="bb-emoji-grid">
              {cat.emojis.map((emoji, i) => (
                <button
                  key={i}
                  type="button"
                  className={`bb-emoji-btn ${emoji === value ? 'selected' : ''}`}
                  onClick={() => { onChange(emoji); onClose?.(); }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
