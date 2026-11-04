import type { CalmDownActivity } from '../../types';

const ACTIVITIES: { type: CalmDownActivity; icon: string; label: string }[] = [
  { type: 'paint', icon: '🎨', label: 'ציור' },
  { type: 'bubbles', icon: '🫧', label: 'בועות סבון' },
  { type: 'breathing', icon: '🌬️', label: 'נשימות' },
  { type: 'xylophone', icon: '🎵', label: 'קסילופון' },
  { type: 'scooter', icon: '🛴', label: 'קורקינט' },
];

interface AddCalmDownModalProps {
  onAdd: (activityType: CalmDownActivity) => void;
  onClose: () => void;
}

export default function AddCalmDownModal({ onAdd, onClose }: AddCalmDownModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal bb-modal" onClick={(e) => e.stopPropagation()}>
        <h3>פעילות הרגעה</h3>
        <p className="bb-modal-subtitle">בחר פעילות להוספה:</p>

        <div className="bb-calm-grid">
          {ACTIVITIES.map((act) => (
            <button
              key={act.type}
              type="button"
              className="bb-calm-card"
              onClick={() => { onAdd(act.type); onClose(); }}
            >
              <span className="bb-calm-icon">{act.icon}</span>
              <span className="bb-calm-label">{act.label}</span>
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
