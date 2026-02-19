import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formTemplateApi } from '../api/client';
import { DEFAULT_FORM_TEMPLATE } from '../types';
import type { FormTemplateSection, FormFieldType, FormTemplate } from '../types';
import { v4 as uuidv4 } from 'uuid';

const TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'טקסט',
  number: 'מספר',
  percentage: 'אחוזים',
};

const TYPE_COLORS: Record<FormFieldType, string> = {
  text: '#667eea',
  number: '#48bb78',
  percentage: '#ed8936',
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
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#a0aec0' }}>טוען תבנית...</div>
    );
  }

  const sorted = [...sections].sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="template-section-list">
        {sorted.map((section, idx) => (
          <div key={section.id} className="template-section-item">
            {editingId === section.id ? (
              <div className="template-section-edit">
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  autoFocus
                  style={{ flex: 1, padding: '8px 12px', border: '2px solid #667eea', borderRadius: '8px', fontSize: '0.9em' }}
                />
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as FormFieldType)}
                  style={{ padding: '8px', borderRadius: '8px', border: '2px solid #e2e8f0' }}
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
                <div className="template-section-info">
                  <span className="template-section-label">{section.label}</span>
                  <span
                    className="template-type-badge"
                    style={{ background: TYPE_COLORS[section.type] }}
                  >
                    {TYPE_LABELS[section.type]}
                  </span>
                </div>
                <div className="template-section-actions">
                  <button
                    onClick={() => moveSection(section.id, 'up')}
                    disabled={idx === 0}
                    className="template-move-btn"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveSection(section.id, 'down')}
                    disabled={idx === sorted.length - 1}
                    className="template-move-btn"
                  >
                    ▼
                  </button>
                  <button onClick={() => startEdit(section)} className="edit-btn-small">✎</button>
                  <button onClick={() => removeSection(section.id)} className="delete-btn-small">✕</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {showAddSection ? (
        <div className="template-add-form">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="שם השדה"
            autoFocus
            style={{ flex: 1, padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '0.95em' }}
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as FormFieldType)}
            style={{ padding: '10px', borderRadius: '10px', border: '2px solid #e2e8f0' }}
          >
            <option value="text">טקסט</option>
            <option value="number">מספר</option>
            <option value="percentage">אחוזים</option>
          </select>
          <button onClick={addSection} className="btn-primary btn-small">הוסף</button>
          <button onClick={() => { setShowAddSection(false); setNewLabel(''); }} className="btn-secondary btn-small">ביטול</button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddSection(true)}
          className="btn-secondary btn-small"
          style={{ width: '100%', marginTop: '12px' }}
        >
          + הוסף שדה
        </button>
      )}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', marginTop: '20px', paddingTop: '16px', borderTop: '2px solid #f0f4f8' }}>
        <button onClick={handleReset} className="btn-secondary btn-small" style={{ color: '#a0aec0', borderColor: '#e2e8f0' }}>
          אפס לברירת מחדל
        </button>
        <div style={{ display: 'flex', gap: '10px' }}>
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
