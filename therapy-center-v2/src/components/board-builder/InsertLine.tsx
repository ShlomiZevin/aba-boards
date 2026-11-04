import { useState, useRef, useEffect } from 'react';
import InsertMenu from './InsertMenu';

interface InsertLineProps {
  index: number;
  onAddTask: (index: number) => void;
  onAddBonus: (index: number) => void;
  onAddCalmDown: (index: number) => void;
  onAddGoal: (index: number) => void;
  onAddHeader: (index: number) => void;
}

export default function InsertLine({ index, onAddTask, onAddBonus, onAddCalmDown, onAddGoal, onAddHeader }: InsertLineProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="bb-insert-line" ref={ref}>
      <div className="bb-insert-rule" />
      <button
        className={`bb-insert-btn ${open ? 'bb-insert-btn-active' : ''}`}
        onClick={() => setOpen(!open)}
        title="הוסף פריט"
      >
        +
      </button>
      <div className="bb-insert-rule" />
      {open && (
        <InsertMenu
          onTask={() => { onAddTask(index); setOpen(false); }}
          onBonus={() => { onAddBonus(index); setOpen(false); }}
          onCalmDown={() => { onAddCalmDown(index); setOpen(false); }}
          onGoal={() => { onAddGoal(index); setOpen(false); }}
          onHeader={() => { onAddHeader(index); setOpen(false); }}
        />
      )}
    </div>
  );
}
