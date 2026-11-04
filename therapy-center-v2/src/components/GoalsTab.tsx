import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsApi } from '../api/client';
import { GOAL_CATEGORIES } from '../types';
import type { Goal, GoalCategoryId, GoalLibraryItem } from '../types';
import Icon from '../v2/Icon';
import { CATEGORY_TONE, CATEGORY_LABEL } from '../v2/kidColor';
import '../v2/pages/kp.css';

interface AddGoalModalProps {
  categoryId: GoalCategoryId;
  categoryName: string;
  onClose: () => void;
  onAdd: (title: string) => void;
}

function AddGoalModal({ categoryId, categoryName, onClose, onAdd }: AddGoalModalProps) {
  const [title, setTitle] = useState('');
  const [suggestions, setSuggestions] = useState<GoalLibraryItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const skipSearchRef = useRef(false);

  useEffect(() => {
    // Skip the search that fires right after a suggestion is selected
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    const searchLibrary = async () => {
      if (title.length >= 3) {
        const res = await goalsApi.searchLibrary(title);
        if (res.success && res.data) {
          setSuggestions(res.data.filter((s) => s.categoryId === categoryId));
          setShowSuggestions(true);
          setHighlightedIndex(-1);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    };

    const debounce = setTimeout(searchLibrary, 300);
    return () => clearTimeout(debounce);
  }, [title, categoryId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onAdd(title.trim());
      onClose();
    }
  };

  const handleSelectSuggestion = (suggestion: GoalLibraryItem) => {
    skipSearchRef.current = true; // prevent the next effect from re-searching
    setTitle(suggestion.title);
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>הוספת מטרה - {categoryName}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ position: 'relative' }}>
            <label>מטרה</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="התחל להקליד..."
              required
              autoFocus
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className={`suggestion-item${idx === highlightedIndex ? ' highlighted' : ''}`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              ביטול
            </button>
            <button type="submit" className="btn-primary">
              הוסף
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GoalItem({
  goal,
  onToggleActive,
  onDelete,
  onRename,
  readOnly = false,
}: {
  goal: Goal;
  onToggleActive: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(goal.title);

  function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== goal.title) onRename(trimmed);
    setEditing(false);
  }

  return (
    <li className={`kp-goal-item${goal.isActive ? '' : ' is-off'}`}>
      <button
        type="button"
        onClick={onToggleActive}
        className={`kp-check${goal.isActive ? ' is-on' : ''}`}
        style={readOnly ? { cursor: 'default' } : undefined}
        aria-pressed={goal.isActive}
        aria-label={goal.isActive ? 'מטרה פעילה' : 'מטרה לא פעילה'}
      >
        {goal.isActive && <Icon name="check" size={16} strokeWidth={2.8} />}
      </button>
      {editing ? (
        <form onSubmit={handleRenameSubmit} className="kp-goal-edit">
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            autoFocus
            aria-label="שם המטרה"
          />
          <button type="submit" className="btn-primary btn-small">שמור</button>
          <button type="button" className="kp-text-btn" onClick={() => { setEditing(false); setEditTitle(goal.title); }}>ביטול</button>
        </form>
      ) : (
        <span className="kp-goal-title">{goal.title}</span>
      )}
      {!readOnly && !editing && (
        <div className="kp-acts">
          <button type="button" onClick={() => { setEditTitle(goal.title); setEditing(true); }} className="kp-icon-btn" title="ערוך מטרה" aria-label="עריכת מטרה">
            <Icon name="edit" size={18} />
          </button>
          <button type="button" onClick={onDelete} className="kp-icon-btn is-danger" title="מחק" aria-label="מחיקת מטרה">
            <Icon name="trash" size={18} />
          </button>
        </div>
      )}
    </li>
  );
}

function CategorySection({
  categoryId,
  categoryName,
  color,
  goals,
  onAddGoal,
  onToggleActive,
  onDeleteGoal,
  onRenameGoal,
  readOnly = false,
}: {
  categoryId: GoalCategoryId;
  categoryName: string;
  color: string;
  goals: Goal[];
  onAddGoal: (categoryId: GoalCategoryId) => void;
  onToggleActive: (goalId: string, isActive: boolean) => void;
  onDeleteGoal: (goalId: string) => void;
  onRenameGoal: (goalId: string, title: string) => void;
  readOnly?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const activeCount = goals.filter((g) => g.isActive).length;

  return (
    <div className={`kp-gcat tone-${CATEGORY_TONE[categoryId] || 'lilac'}`} data-color={color}>
      <div className="kp-gcat-head">
        <button type="button" className="kp-gcat-toggle" onClick={() => setIsExpanded(!isExpanded)} aria-expanded={isExpanded}>
          <span className={`kp-fold-chev${isExpanded ? ' is-open' : ''}`}><Icon name="chevron" size={18} /></span>
          <span className="nb-chip">{categoryName}</span>
          <span className="kp-gcat-count tabular" title={`${activeCount} פעילות מתוך ${goals.length}`}>{activeCount}/{goals.length}</span>
        </button>
        {!readOnly && (
          <button type="button" className="nb-btn-ghost sm" onClick={(e) => { e.stopPropagation(); onAddGoal(categoryId); }}>
            <Icon name="plus" size={17} /> מטרה
          </button>
        )}
      </div>

      {isExpanded && (
        goals.length === 0 ? (
          <p className="kp-empty-line" style={{ margin: "0 0 8px", fontSize: 14 }}>אין מטרות בקטגוריה זו</p>
        ) : (
          <ul className="kp-goal-items">
            {goals.map((goal) => (
              <GoalItem
                key={goal.id}
                goal={goal}
                onToggleActive={() => !readOnly && onToggleActive(goal.id, !goal.isActive)}
                onDelete={() => onDeleteGoal(goal.id)}
                onRename={(title) => onRenameGoal(goal.id, title)}
                readOnly={readOnly}
              />
            ))}
          </ul>
        )
      )}
    </div>
  );
}

export default function GoalsTab({ kidId, readOnly = false }: { kidId: string; readOnly?: boolean }) {
  const [addingToCategory, setAddingToCategory] = useState<GoalCategoryId | null>(null);
  const queryClient = useQueryClient();

  const { data: goalsRes, isLoading } = useQuery({
    queryKey: ['goals', kidId],
    queryFn: () => goalsApi.getForKid(kidId),
  });

  const addGoalMutation = useMutation({
    mutationFn: ({ categoryId, title }: { categoryId: GoalCategoryId; title: string }) =>
      goalsApi.add(kidId, { categoryId, title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', kidId] });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      goalsApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', kidId] });
    },
  });

  const renameGoalMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      goalsApi.update(id, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', kidId] });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (id: string) => goalsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', kidId] });
    },
  });

  const goals = goalsRes?.data || [];
  const goalsByCategory = GOAL_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat.id] = goals.filter((g: Goal) => g.categoryId === cat.id);
      return acc;
    },
    {} as Record<GoalCategoryId, Goal[]>
  );

  if (isLoading) {
    return <div className="kp-empty hand">טוען מטרות...</div>;
  }

  const addingCategory = GOAL_CATEGORIES.find((c) => c.id === addingToCategory);

  return (
    <div>
      <div className="kp-sec-head">
        <h2 className="nb-h2"><Icon name="target" /> מטרות טיפוליות</h2>
        <span className="nb-sticker tone-sky" style={{ ['--rot' as string]: '2deg' }}>
          <b className="tabular">{goals.filter((g: Goal) => g.isActive).length}</b> פעילות
        </span>
      </div>

      {GOAL_CATEGORIES.map((cat) => (
        <CategorySection
          key={cat.id}
          categoryId={cat.id}
          categoryName={CATEGORY_LABEL[cat.id] || cat.nameHe}
          color={cat.color}
          goals={goalsByCategory[cat.id] || []}
          onAddGoal={(catId) => setAddingToCategory(catId)}
          onToggleActive={(goalId, isActive) =>
            updateGoalMutation.mutate({ id: goalId, isActive })
          }
          onDeleteGoal={(goalId) => deleteGoalMutation.mutate(goalId)}
          onRenameGoal={(goalId, title) => renameGoalMutation.mutate({ id: goalId, title })}
          readOnly={readOnly}
        />
      ))}

      {addingToCategory && addingCategory && (
        <AddGoalModal
          categoryId={addingToCategory}
          categoryName={addingCategory.nameHe}
          onClose={() => setAddingToCategory(null)}
          onAdd={(title) =>
            addGoalMutation.mutate({ categoryId: addingToCategory, title })
          }
        />
      )}
    </div>
  );
}
