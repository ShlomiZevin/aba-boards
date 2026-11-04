import { useState } from 'react';
import type { BoardLayoutItem } from '../../types';
import EmojiPicker from './EmojiPicker';

interface EditItemModalProps {
  item: BoardLayoutItem;
  onSave: (id: number, changes: Partial<BoardLayoutItem>) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export default function EditItemModal({ item, onSave, onDelete, onClose }: EditItemModalProps) {
  const isTask = item.type === 'task';
  const isGoal = item.type === 'goal';

  const [title, setTitle] = useState(isTask ? item.taskData?.title ?? '' : item.title ?? '');
  const [icon, setIcon] = useState(isTask ? item.taskData?.icon ?? '✅' : item.icon ?? '🎁');
  const [points, setPoints] = useState(String(item.pointsRequired ?? 100));
  const [showEmoji, setShowEmoji] = useState(false);

  const handleSave = () => {
    if (!title.trim()) return;
    if (isTask && item.taskData) {
      onSave(item.id, {
        taskData: { ...item.taskData, title: title.trim(), icon },
      });
    } else if (isGoal) {
      onSave(item.id, {
        title: title.trim(),
        icon,
        pointsRequired: Number(points) || 100,
      });
    }
    onClose();
  };

  const handleDelete = () => {
    onDelete(item.id);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal bb-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isTask ? 'עריכת משימה' : 'עריכת פרס'}</h3>

        <div className="bb-form-row">
          <button type="button" className="bb-emoji-trigger" onClick={() => setShowEmoji(!showEmoji)}>
            {icon}
          </button>
          <input
            type="text"
            className="bb-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        {showEmoji && (
          <EmojiPicker
            value={icon}
            onChange={(emoji) => { setIcon(emoji); setShowEmoji(false); }}
            inline
          />
        )}

        {isGoal && (
          <div className="bb-form-field">
            <label>נקודות נדרשות</label>
            <input
              type="number"
              className="bb-input bb-input-small"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              min="1"
            />
          </div>
        )}

        <div className="modal-actions bb-modal-actions-spread">
          <button className="btn-danger" onClick={handleDelete}>מחק</button>
          <div>
            <button className="btn-secondary" onClick={onClose}>ביטול</button>
            <button className="btn-primary" onClick={handleSave} disabled={!title.trim()}>שמור</button>
          </div>
        </div>
      </div>
    </div>
  );
}
