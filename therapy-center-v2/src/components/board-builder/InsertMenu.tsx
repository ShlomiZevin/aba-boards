interface InsertMenuProps {
  onTask: () => void;
  onBonus: () => void;
  onCalmDown: () => void;
  onGoal: () => void;
  onHeader: () => void;
}

export default function InsertMenu({ onTask, onBonus, onCalmDown, onGoal, onHeader }: InsertMenuProps) {
  return (
    <div className="bb-insert-menu">
      <button className="bb-insert-option" onClick={onTask}>
        <span>✅</span><span>משימה</span>
      </button>
      <button className="bb-insert-option" onClick={onBonus}>
        <span>💰</span><span>בונוס</span>
      </button>
      <button className="bb-insert-option" onClick={onCalmDown}>
        <span>🧘</span><span>הרגעה</span>
      </button>
      <button className="bb-insert-option" onClick={onGoal}>
        <span>🎁</span><span>פרס</span>
      </button>
      <button className="bb-insert-option" onClick={onHeader}>
        <span>📝</span><span>כותרת</span>
      </button>
    </div>
  );
}
