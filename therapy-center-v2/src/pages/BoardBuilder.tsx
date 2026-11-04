import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kidsApi } from '../api/client';
import { useBoardState } from '../hooks/useBoardState';
import BoardPreview from '../components/board-builder/BoardPreview';
import KidInfoBar from '../components/board-builder/KidInfoBar';
import AddTaskModal from '../components/board-builder/AddTaskModal';
import AddGoalModal from '../components/board-builder/AddGoalModal';
import AddCalmDownModal from '../components/board-builder/AddCalmDownModal';
import EditItemModal from '../components/board-builder/EditItemModal';
import BoardSettingsDrawer from '../components/board-builder/BoardSettingsDrawer';
import PinScreen from '../components/board-builder/PinScreen';
import type { BoardLayoutItem, Kid, ColorSchema } from '../types';

type ModalState =
  | { type: 'none' }
  | { type: 'add-task'; index: number }
  | { type: 'add-goal'; index: number }
  | { type: 'add-calm-down'; index: number }
  | { type: 'edit-item'; item: BoardLayoutItem }
  | { type: 'settings' };

interface BoardBuilderProps {
  isPublic?: boolean;
}

export default function BoardBuilder({ isPublic }: BoardBuilderProps) {
  const { kidId } = useParams<{ kidId: string }>();
  const isEditing = !!kidId;
  const [pinVerified, setPinVerified] = useState(!isPublic);

  const { data: kidData, isLoading } = useQuery({
    queryKey: ['kid-board', kidId],
    queryFn: () => kidsApi.getById(kidId!),
    enabled: !!kidId,
  });

  const kid = kidData?.data as (Kid & Record<string, unknown>) | undefined;

  if (isEditing && isLoading) {
    return <div className="bb-loading">טוען...</div>;
  }

  if (isPublic && !pinVerified) {
    return <PinScreen kidPin={(kid?.builderPin as string) ?? '1234'} onSuccess={() => setPinVerified(true)} />;
  }

  return <BoardBuilderInner key={kid?.id ?? 'new'} kid={kid} isEditing={isEditing} isPublic={isPublic} />;
}

function BoardBuilderInner({ kid, isEditing, isPublic }: {
  kid: (Kid & Record<string, unknown>) | undefined;
  isEditing: boolean;
  isPublic?: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const board = useBoardState(kid);
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [saveMsg, setSaveMsg] = useState('');

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (isEditing && kid) {
        return kidsApi.update(kid.id, payload as Partial<Kid>);
      }
      return kidsApi.create(payload as { name: string; age?: number | string; gender?: string });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['kid-board'] });
      queryClient.invalidateQueries({ queryKey: ['kids'] });
      setSaveMsg('נשמר בהצלחה!');
      setTimeout(() => setSaveMsg(''), 3000);
      if (!isEditing && res.data) {
        const newKid = res.data as Kid;
        navigate(isPublic ? `/build/${newKid.id}` : `/board-builder/${newKid.id}`, { replace: true });
      }
    },
    onError: () => {
      setSaveMsg('שגיאה בשמירה');
      setTimeout(() => setSaveMsg(''), 3000);
    },
  });

  const handleSave = () => {
    const payload = board.toSavePayload();
    if (!payload.name) {
      setSaveMsg('נא להזין שם ילד/ה');
      setTimeout(() => setSaveMsg(''), 3000);
      return;
    }
    saveMutation.mutate(payload);
  };

  const handleAddHeader = (index: number) => {
    board.addHeaderAt(index, 'כותרת חדשה');
  };

  return (
    <div className="bb-page">
      <KidInfoBar
        kidInfo={board.kidInfo}
        colorSchema={board.settings.colorSchema}
        onChange={board.updateKidInfo}
        onColorChange={(schema: ColorSchema) => board.updateSettings({ colorSchema: schema })}
        isNew={!isEditing}
        onSettingsClick={() => setModal({ type: 'settings' })}
      />

      <BoardPreview
        items={board.items}
        settings={board.settings}
        kidInfo={board.kidInfo}
        onEditItem={(item) => setModal({ type: 'edit-item', item })}
        onDeleteItem={board.removeItem}
        onMoveUp={board.moveItemUp}
        onMoveDown={board.moveItemDown}
        onAddTask={(i) => setModal({ type: 'add-task', index: i })}
        onAddBonus={(i) => setModal({ type: 'add-task', index: i })}
        onAddCalmDown={(i) => setModal({ type: 'add-calm-down', index: i })}
        onAddGoal={(i) => setModal({ type: 'add-goal', index: i })}
        onAddHeader={handleAddHeader}
      />

      {/* Bottom save bar */}
      <div className="bb-bottom-bar">
        <div className="bb-bottom-inner">
          {isEditing && (
            <a href={`/board.html?kid=${kid?.id}`} target="_blank" rel="noopener noreferrer" className="bb-link-btn">
              👁️ צפה בלוח
            </a>
          )}
          <button className="bb-save-btn" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'שומר...' : '💾 שמור לוח'}
          </button>
          {saveMsg && (
            <span className={`bb-save-msg ${saveMsg.includes('שגיאה') || saveMsg.includes('נא') ? 'error' : ''}`}>
              {saveMsg}
            </span>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal.type === 'add-task' && (
        <AddTaskModal
          onAdd={(title, icon, type) => board.addTaskAt(modal.index, title, icon, type)}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'add-goal' && (
        <AddGoalModal
          onAdd={(title, icon, pts) => board.addGoalAt(modal.index, title, icon, pts)}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'add-calm-down' && (
        <AddCalmDownModal
          onAdd={(activityType) => board.addCalmDownAt(modal.index, activityType)}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'edit-item' && (
        <EditItemModal
          item={modal.item}
          onSave={board.updateItem}
          onDelete={board.removeItem}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'settings' && (
        <BoardSettingsDrawer
          settings={board.settings}
          onChange={board.updateSettings}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  );
}
