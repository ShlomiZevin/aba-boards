import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formTemplateApi } from '../api/client';
import { DEFAULT_FORM_TEMPLATE } from '../types';
import type { FormTemplateSection, FormFieldType, FormTemplate } from '../types';
import { v4 as uuidv4 } from 'uuid';
import Icon from '../v2/Icon';
import { FfIcon } from '../v2/pages/ffParts';

const TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'טקסט',
  number: 'מספר',
  percentage: 'אחוזים',
};

const TYPE_TONES: Record<FormFieldType, 'lilac' | 'sky' | 'peach'> = {
  text: 'lilac',
  number: 'sky',
  percentage: 'peach',
};

export default function FormTemplateEditor({ kidId, onClose }: { kidId: string; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data: templateRes, isLoading } = useQuery({
    queryKey: ['formTemplate', kidId],
    queryFn: () => formTemplateApi.get(kidId),
  });

  const [sections, setSections] = useState<FormTemplateSection[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<FormFieldType>('text');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState<FormFieldType>('text');

  useEffect(() => {
    if (templateRes?.data) {
      setSections(templateRes.data.sections || DEFAULT_FORM_TEMPLATE);
    }
  }, [templateRes]);

  const saveMutation = useMutation({
    mutationFn: (template: FormTemplate) =>
      formTemplateApi.update(kidId, template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formTemplate', kidId] });
      setIsDirty(false);
    },
  });

  const addSection = () => {
    if (!newLabel.trim()) return;
    const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.order)) : 0;
    setSections([...sections, {
      id: uuidv4(),
      label: newLabel.trim(),
      type: newType,
      order: maxOrder + 1,
    }]);
    setNewLabel('');
    setNewType('text');
    setShowAddSection(false);
    setIsDirty(true);
  };

  const removeSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
    setIsDirty(true);
  };

  const startEdit = (section: FormTemplateSection) => {
    setEditingId(section.id);
    setEditLabel(section.label);
    setEditType(section.type);
  };

  const saveEdit = () => {
    if (!editLabel.trim() || !editingId) return;
    setSections(sections.map(s =>
      s.id === editingId ? { ...s, label: editLabel.trim(), type: editType } : s
    ));
    setEditingId(null);
    setIsDirty(true);
  };

  const moveSection = (id: string, direction: 'up' | 'down') => {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(s => s.id === id);
    if (direction === 'up' && idx > 0) {
      const tmp = sorted[idx].order;
      sorted[idx].order = sorted[idx - 1].order;
      sorted[idx - 1].order = tmp;
    } else if (direction === 'down' && idx < sorted.length - 1) {
      const tmp = sorted[idx].order;
      sorted[idx].order = sorted[idx + 1].order;
      sorted[idx + 1].order = tmp;
    }
    setSections([...sorted]);
    setIsDirty(true);
  };

  const handleSave = () => {
    saveMutation.mutate({ sections });
  };

  const handleReset = () => {
    setSections([...DEFAULT_FORM_TEMPLATE]);
    setIsDirty(true);
  };

  if (isLoading) {
    return <div className="loading" style={{ padding: '20px', textAlign: 'center' }}>טוען תבנית...</div>;
  }

  const sorted = [...sections].sort((a, b) => a.order - b.order);

  return (
    <div className="ff-tpl">
      <ul className="ff-tpl-list">
        {sorted.map((section, idx) => (
          <li key={section.id} className="ff-tpl-row">
            {editingId === section.id ? (
              <div className="ff-tpl-edit">
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  autoFocus
                  aria-label="שם השדה"
                />
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as FormFieldType)}
                  aria-label="סוג השדה"
                >
                  <option value="text">טקסט</option>
                  <option value="number">מספר</option>
                  <option value="percentage">אחוזים</option>
                </select>
                <button onClick={saveEdit} className="btn-primary btn-small">שמור</button>
                <button onClick={() => setEditingId(null)} className="btn-secondary btn-small">ביטול</button>
              </div>
            ) : (
              <>
                <div className="ff-tpl-info">
                  <span className="ff-tpl-label">{section.label}</span>
                  <span className={`nb-chip ff-tpl-type tone-${TYPE_TONES[section.type]}`}>
                    {TYPE_LABELS[section.type]}
                  </span>
                </div>
                <div className="ff-tpl-acts">
                  <button
                    onClick={() => moveSection(section.id, 'up')}
                    disabled={idx === 0}
                    className="ff-tpl-btn"
                    aria-label="הזזה למעלה"
                  >
                    <FfIcon name="up" size={18} />
                  </button>
                  <button
                    onClick={() => moveSection(section.id, 'down')}
                    disabled={idx === sorted.length - 1}
                    className="ff-tpl-btn"
                    aria-label="הזזה למטה"
                  >
                    <FfIcon name="down" size={18} />
                  </button>
                  <button onClick={() => startEdit(section)} className="ff-tpl-btn" aria-label="עריכה"><Icon name="edit" size={18} /></button>
                  <button onClick={() => removeSection(section.id)} className="ff-tpl-btn danger" aria-label="מחיקה"><Icon name="trash" size={18} /></button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {showAddSection ? (
        <div className="ff-tpl-edit">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="שם השדה"
            autoFocus
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as FormFieldType)}
            aria-label="סוג השדה"
          >
            <option value="text">טקסט</option>
            <option value="number">מספר</option>
            <option value="percentage">אחוזים</option>
          </select>
          <button onClick={addSection} className="btn-primary btn-small">הוסף</button>
          <button onClick={() => { setShowAddSection(false); setNewLabel(''); }} className="btn-secondary btn-small">ביטול</button>
        </div>
      ) : (
        <button onClick={() => setShowAddSection(true)} className="nb-btn-ghost" style={{ width: '100%' }}>
          <Icon name="plus" size={18} /> הוסף שדה
        </button>
      )}

      <div className="ff-tpl-foot">
        <button onClick={handleReset} className="ff-tpl-reset">
          אפס לברירת מחדל
        </button>
        <div>
          <button onClick={onClose} className="btn-secondary">סגור</button>
          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={!isDirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'שומר...' : 'שמור תבנית'}
          </button>
        </div>
      </div>
    </div>
  );
}
