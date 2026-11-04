import { useState } from 'react';
import EmojiPicker from './EmojiPicker';

interface AddGoalModalProps {
  onAdd: (title: string, icon: string, pointsRequired: number) => void;
  onClose: () => void;
}

export default function AddGoalModal({ onAdd, onClose }: AddGoalModalProps) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🎁');
  const [points, setPoints] = useState('100');
  const [showEmoji, setShowEmoji] = useState(false);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), icon, Number(points) || 100);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal bb-modal" onClick={(e) => e.stopPropagation()}>
        <h3>הוספת פרס</h3>

        <div className="bb-form-row">
          <button type="button" className="bb-emoji-trigger" onClick={() => setShowEmoji(!showEmoji)}>
            {icon}
          </button>
          <input
            type="text"
            className="bb-input"
            placeholder="שם הפרס..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {showEmoji && (
          <EmojiPicker
            value={icon}
            onChange={(emoji) => { setIcon(emoji); setShowEmoji(false); }}
            inline
          />
        )}

        <div className="bb-form-field">
          <label>כמה נקודות נדרשות?</label>
          <input
            type="number"
            className="bb-input bb-input-small"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            min="1"
          />
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!title.trim()}>הוסף</button>
        </div>
      </div>
    </div>
  );
}
