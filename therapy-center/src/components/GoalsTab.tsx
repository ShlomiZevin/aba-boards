import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsApi } from '../api/client';
import { GOAL_CATEGORIES } from '../types';
import type { Goal, GoalCategoryId, GoalLibraryItem } from '../types';

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

  useEffect(() => {
    const searchLibrary = async () => {
      if (title.length >= 3) {
        const res = await goalsApi.searchLibrary(title);
        if (res.success && res.data) {
          setSuggestions(res.data.filter((s) => s.categoryId === categoryId));
          setShowSuggestions(true);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
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
    setTitle(suggestion.title);
    setShowSuggestions(false);
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
              placeholder="התחל להקליד..."
              required
              autoFocus
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className="suggestion-item"
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
  readOnly = false,
}: {
  goal: Goal;
  onToggleActive: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className={`goal-item ${goal.isActive ? 'active' : 'inactive'}`}>
      <div className="goal-text">
        <button
          onClick={onToggleActive}
          className={`goal-checkbox ${goal.isActive ? 'checked' : ''}`}
          style={readOnly ? { cursor: 'default' } : undefined}
        >
          {goal.isActive && '✓'}
        </button>
        <span style={{ textDecoration: goal.isActive ? 'none' : 'line-through' }}>
          {goal.title}
        </span>
      </div>
      {!readOnly && (
        <button onClick={onDelete} className="btn-icon" title="מחק">
          ✕
        </button>
      )}
    </div>
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
  readOnly = false,
}: {
  categoryId: GoalCategoryId;
  categoryName: string;
  color: string;
  goals: Goal[];
  onAddGoal: (categoryId: GoalCategoryId) => void;
  onToggleActive: (goalId: string, isActive: boolean) => void;
  onDeleteGoal: (goalId: string) => void;
  readOnly?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const activeCount = goals.filter((g) => g.isActive).length;

  return (
    <div className="category-section">
      <div
        className="category-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ '--category-color': color } as React.CSSProperties}
      >
        <h4>
          <span>{isExpanded ? '▼' : '◀'}</span>
          {categoryName}
          <span className="count">
            ({activeCount} פעילות מתוך {goals.length})
          </span>
        </h4>
        {!readOnly && (
          <button
            className="add-btn"
            onClick={(e) => {
              e.stopPropagation();
              onAddGoal(categoryId);
            }}
          >
            + הוסף מטרה
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="category-content">
          {goals.length === 0 ? (
            <p style={{ color: '#a0aec0', fontSize: '0.9em', padding: '8px 0' }}>
              אין מטרות בקטגוריה זו
            </p>
          ) : (
            goals.map((goal) => (
              <GoalItem
                key={goal.id}
                goal={goal}
                onToggleActive={() => !readOnly && onToggleActive(goal.id, !goal.isActive)}
                onDelete={() => onDeleteGoal(goal.id)}
                readOnly={readOnly}
              />
            ))
          )}
        </div>
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
    return <div className="loading">טוען מטרות...</div>;
  }

  const addingCategory = GOAL_CATEGORIES.find((c) => c.id === addingToCategory);

  return (
    <div>
      <div className="section-header">
        <h3>מטרות טיפוליות</h3>
        <span style={{ color: '#64748b', fontSize: '0.9em' }}>
          {goals.filter((g: Goal) => g.isActive).length} מטרות פעילות
        </span>
      </div>

      {GOAL_CATEGORIES.map((cat) => (
        <CategorySection
          key={cat.id}
          categoryId={cat.id}
          categoryName={cat.nameHe}
          color={cat.color}
          goals={goalsByCategory[cat.id] || []}
          onAddGoal={(catId) => setAddingToCategory(catId)}
          onToggleActive={(goalId, isActive) =>
            updateGoalMutation.mutate({ id: goalId, isActive })
          }
          onDeleteGoal={(goalId) => deleteGoalMutation.mutate(goalId)}
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
