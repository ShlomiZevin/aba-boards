import { useState } from 'react';
import type { TaskType } from '../../types';
import EmojiPicker from './EmojiPicker';

interface AddTaskModalProps {
  onAdd: (title: string, icon: string, type: TaskType) => void;
  onClose: () => void;
}

export default function AddTaskModal({ onAdd, onClose }: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('✅');
  const [type, setType] = useState<TaskType>('regular');
  const [showEmoji, setShowEmoji] = useState(false);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), icon, type);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal bb-modal" onClick={(e) => e.stopPropagation()}>
        <h3>הוספת משימה</h3>

        <div className="bb-form-row">
          <button type="button" className="bb-emoji-trigger" onClick={() => setShowEmoji(!showEmoji)}>
            {icon}
          </button>
          <input
            type="text"
            className="bb-input"
            placeholder="שם המשימה..."
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

        <div className="bb-type-selector">
          <button
            type="button"
            className={`bb-type-btn ${type === 'regular' ? 'active' : ''}`}
            onClick={() => setType('regular')}
          >
            משימה רגילה
          </button>
          <button
            type="button"
            className={`bb-type-btn ${type === 'bonus' ? 'active' : ''}`}
            onClick={() => setType('bonus')}
          >
            בונוס 💰
          </button>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!title.trim()}>הוסף</button>
        </div>
      </div>
    </div>
  );
}
