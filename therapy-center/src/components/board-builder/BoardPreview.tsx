import { useState } from 'react';
import type { BoardLayoutItem, BoardSettings, ColorSchema } from '../../types';
import type { KidInfo } from '../../hooks/useBoardState';
import InsertLine from './InsertLine';

interface BoardPreviewProps {
  items: BoardLayoutItem[];
  settings: BoardSettings;
  kidInfo: KidInfo;
  onEditItem: (item: BoardLayoutItem) => void;
  onDeleteItem: (id: number) => void;
  onMoveUp: (id: number) => void;
  onMoveDown: (id: number) => void;
  onAddTask: (index: number) => void;
  onAddBonus: (index: number) => void;
  onAddCalmDown: (index: number) => void;
  onAddGoal: (index: number) => void;
  onAddHeader: (index: number) => void;
}

function getCoinLabel(coinStyle: string) {
  switch (coinStyle) {
    case 'shekel': return '₪';
    case 'dollar': return '$';
    default: return 'נק׳';
  }
}

export default function BoardPreview({
  items, settings, kidInfo,
  onEditItem, onDeleteItem, onMoveUp, onMoveDown,
  onAddTask, onAddBonus, onAddCalmDown, onAddGoal, onAddHeader,
}: BoardPreviewProps) {
  const coinLabel = getCoinLabel(settings.coinStyle);
  const boardTitle = kidInfo.name ? `הלוח של ${kidInfo.name}` : 'הלוח שלי';

  // Group consecutive same-type tasks for grid rendering
  const sections = groupItemsIntoSections(items);

  return (
    <div className={`bb-board bb-schema-${settings.colorSchema}`}>
      {/* Board Title */}
      <div className="bb-board-title">
        <h1>{boardTitle}</h1>
      </div>

      {/* Bank Section */}
      <div className="bb-bank">
        <div className="bb-bank-icon">
          {kidInfo.imageName ? (
            <img src={kidInfo.imageName} alt="" />
          ) : (
            <span className="bb-bank-icon-emoji">{kidInfo.gender === 'girl' ? '👧' : '👦'}</span>
          )}
        </div>
        <div className="bb-bank-amount">{coinLabel}0</div>
        <div className="bb-bank-label">קופת החיסכון</div>
        <div className="bb-bank-info">
          <div className="bb-bank-potential">
            <div className="bb-bank-potential-label">אפשר להרוויח היום:</div>
            <div className="bb-bank-potential-value">{coinLabel}{settings.dailyReward}</div>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="bb-progress">
        <div className="bb-progress-title">ההתקדמות שלי היום</div>
        <div className="bb-progress-container">
          <div className="bb-progress-bar" style={{ width: '0%' }}>0%</div>
        </div>
      </div>

      {/* Insert line at top */}
      <InsertLine
        index={0}
        onAddTask={onAddTask}
        onAddBonus={onAddBonus}
        onAddCalmDown={onAddCalmDown}
        onAddGoal={onAddGoal}
        onAddHeader={onAddHeader}
      />

      {/* Board items */}
      {items.length === 0 && (
        <div className="bb-empty">
          <div className="bb-empty-icon">📋</div>
          <div className="bb-empty-text">הלוח ריק — לחץ על + כדי להתחיל לבנות</div>
        </div>
      )}

      {sections.map((section, sIdx) => (
        <div key={sIdx}>
          {section.type === 'header' && (
            <>
              <HeaderItem
                item={section.items[0]}
                onEdit={() => onEditItem(section.items[0])}
                onDelete={() => onDeleteItem(section.items[0].id)}
              />
              <InsertLine
                index={section.endIndex}
                onAddTask={onAddTask}
                onAddBonus={onAddBonus}
                onAddCalmDown={onAddCalmDown}
                onAddGoal={onAddGoal}
                onAddHeader={onAddHeader}
              />
            </>
          )}

          {section.type === 'tasks' && (
            <>
              <div className="bb-tasks-grid">
                {section.items.map((item) => (
                  <TaskCard
                    key={item.id}
                    item={item}
                    onEdit={() => onEditItem(item)}
                    onDelete={() => onDeleteItem(item.id)}
                    onMoveUp={() => onMoveUp(item.id)}
                    onMoveDown={() => onMoveDown(item.id)}
                  />
                ))}
              </div>
              <InsertLine
                index={section.endIndex}
                onAddTask={onAddTask}
                onAddBonus={onAddBonus}
                onAddCalmDown={onAddCalmDown}
                onAddGoal={onAddGoal}
                onAddHeader={onAddHeader}
              />
            </>
          )}

          {section.type === 'goals' && (
            <>
              <div className="bb-goals-grid">
                {section.items.map((item) => (
                  <GoalCard
                    key={item.id}
                    item={item}
                    coinLabel={coinLabel}
                    onEdit={() => onEditItem(item)}
                    onDelete={() => onDeleteItem(item.id)}
                  />
                ))}
              </div>
              <InsertLine
                index={section.endIndex}
                onAddTask={onAddTask}
                onAddBonus={onAddBonus}
                onAddCalmDown={onAddCalmDown}
                onAddGoal={onAddGoal}
                onAddHeader={onAddHeader}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

interface Section {
  type: 'header' | 'tasks' | 'goals';
  items: BoardLayoutItem[];
  startIndex: number;
  endIndex: number; // index after last item (for InsertLine)
}

function groupItemsIntoSections(items: BoardLayoutItem[]): Section[] {
  const sections: Section[] = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    if (item.type === 'header') {
      sections.push({ type: 'header', items: [item], startIndex: i, endIndex: i + 1 });
      i++;
    } else if (item.type === 'task') {
      // Collect consecutive tasks
      const start = i;
      const taskItems: BoardLayoutItem[] = [];
      while (i < items.length && items[i].type === 'task') {
        taskItems.push(items[i]);
        i++;
      }
      sections.push({ type: 'tasks', items: taskItems, startIndex: start, endIndex: i });
    } else if (item.type === 'goal') {
      const start = i;
      const goalItems: BoardLayoutItem[] = [];
      while (i < items.length && items[i].type === 'goal') {
        goalItems.push(items[i]);
        i++;
      }
      sections.push({ type: 'goals', items: goalItems, startIndex: start, endIndex: i });
    } else {
      i++;
    }
  }
  return sections;
}

function HeaderItem({ item, onEdit, onDelete }: { item: BoardLayoutItem; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className={`bb-section-header size-${item.size || 'medium'}`}>
      <h2>{item.text}</h2>
      <div className="bb-item-controls">
        <button className="bb-ctrl-btn" onClick={onEdit} title="ערוך">✏️</button>
        <button className="bb-ctrl-btn" onClick={onDelete} title="מחק">✕</button>
      </div>
    </div>
  );
}

function TaskCard({ item, onEdit, onDelete, onMoveUp, onMoveDown }: {
  item: BoardLayoutItem; onEdit: () => void; onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
}) {
  const td = item.taskData;
  if (!td) return null;
  const isCalmDown = item.taskType === 'calm-down';
  const isBonus = item.taskType === 'bonus';

  const cls = isCalmDown ? 'bb-calm-card' : isBonus ? 'bb-bonus-card' : 'bb-task-card';

  return (
    <div className={cls} onClick={onEdit}>
      {isBonus && <div className="bb-bonus-badge">💰</div>}
      <div className="bb-card-icon">{td.icon}</div>
      <div className="bb-card-title">{td.title}</div>
      <div className="bb-card-controls" onClick={(e) => e.stopPropagation()}>
        <button className="bb-ctrl-btn bb-ctrl-sm" onClick={onMoveUp} title="▲">▲</button>
        <button className="bb-ctrl-btn bb-ctrl-sm" onClick={onMoveDown} title="▼">▼</button>
        <button className="bb-ctrl-btn bb-ctrl-sm bb-ctrl-del" onClick={onDelete} title="מחק">✕</button>
      </div>
    </div>
  );
}

function GoalCard({ item, coinLabel, onEdit, onDelete }: {
  item: BoardLayoutItem; coinLabel: string; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="bb-goal-wrapper">
      <div className="bb-goal-card" onClick={onEdit}>
        <div className="bb-goal-icon">{item.icon}</div>
        <div className="bb-goal-title">{item.title}</div>
        <div className="bb-goal-points">{item.pointsRequired} {coinLabel}</div>
        <div className="bb-card-controls bb-goal-controls" onClick={(e) => e.stopPropagation()}>
          <button className="bb-ctrl-btn bb-ctrl-sm bb-ctrl-del" onClick={onDelete} title="מחק">✕</button>
        </div>
      </div>
    </div>
  );
}
