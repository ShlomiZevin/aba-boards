import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsApi, kidsApi } from '../api/client';
import { GOAL_CATEGORIES } from '../types';
import type { GoalCategoryId, GoalLibraryItem, Kid } from '../types';

export default function GoalLibraryManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<GoalCategoryId | 'all'>('all');
  const [sortBy, setSortBy] = useState<'kids' | 'name'>('kids');
  const [orphansOnly, setOrphansOnly] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  // Add goal modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategoryId, setNewCategoryId] = useState<GoalCategoryId>('general');

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Assign-to-kid modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [kidSearch, setKidSearch] = useState('');
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);
  const [showKidDropdown, setShowKidDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const kidSearchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ['goals-library-all'],
    queryFn: () => goalsApi.getAllLibrary(),
  });

  const { data: kidsRes } = useQuery({
    queryKey: ['kids'],
    queryFn: () => kidsApi.getAll(),
  });
  const kids: Kid[] = kidsRes?.data || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => goalsApi.deleteLibraryItem(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['goals-library-all'] });
      const prev = queryClient.getQueryData(['goals-library-all']);
      queryClient.setQueryData(['goals-library-all'], (old: typeof response) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter(item => item.id !== id) };
      });
      setConfirmingDelete(null);
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) queryClient.setQueryData(['goals-library-all'], context.prev);
    },
  });

  const addLibraryMutation = useMutation({
    mutationFn: (data: { title: string; categoryId: GoalCategoryId }) =>
      goalsApi.addLibraryItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals-library-all'] });
      setShowAddModal(false);
      setNewTitle('');
      setNewCategoryId('general');
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ kidId, goals }: { kidId: string; goals: GoalLibraryItem[] }) => {
      for (const goal of goals) {
        await goalsApi.add(kidId, { categoryId: goal.categoryId, title: goal.title });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals-library-all'] });
      setShowAssignModal(false);
      setSelectedIds(new Set());
      setSelectedKidId(null);
      setKidSearch('');
    },
  });

  const items = response?.data || [];
  const orphanCount = useMemo(() => items.filter(i => i.isOrphan).length, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (orphansOnly) result = result.filter(item => item.isOrphan);
    if (categoryFilter !== 'all') result = result.filter(item => item.categoryId === categoryFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(item => item.title.toLowerCase().includes(q));
    }
    if (sortBy === 'name') result = [...result].sort((a, b) => a.title.localeCompare(b.title, 'he'));
    else result = [...result].sort((a, b) => (b.activeCount ?? b.usageCount) - (a.activeCount ?? a.usageCount));
    return result;
  }, [items, categoryFilter, search, sortBy, orphansOnly]);

  const selectedGoals = useMemo(() => items.filter(item => selectedIds.has(item.id)), [items, selectedIds]);

  const getCategoryName = (catId: GoalCategoryId) =>
    GOAL_CATEGORIES.find(c => c.id === catId)?.nameHe || catId;

  const getCategoryColor = (catId: GoalCategoryId) =>
    GOAL_CATEGORIES.find(c => c.id === catId)?.color || '#607D8B';

  // Selection helpers
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(item => item.id)));
    }
  };

  // Kid autocomplete
  const filteredKids = kidSearch.trim()
    ? kids.filter(k => k.name.includes(kidSearch.trim()))
    : kids;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          kidSearchRef.current && !kidSearchRef.current.contains(e.target as Node)) {
        setShowKidDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setHighlightedIndex(-1); }, [kidSearch]);

  const selectKid = (kid: Kid) => {
    setSelectedKidId(kid.id);
    setKidSearch(kid.name);
    setShowKidDropdown(false);
    setHighlightedIndex(-1);
  };

  const handleKidKeyDown = (e: React.KeyboardEvent) => {
    if (!showKidDropdown || selectedKidId) return;
    const count = filteredKids.length;
    if (count === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev + 1) % count); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev - 1 + count) % count); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < count) selectKid(filteredKids[highlightedIndex]);
      else if (count === 1) selectKid(filteredKids[0]);
    }
  };

  return (
    <div className="container">
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h2>ספריית מטרות</h2>
            <span style={{ fontSize: '0.85em', color: '#64748b' }}>{items.length} מטרות בספרייה</span>
          </div>
          <button className="btn-primary btn-small" onClick={() => setShowAddModal(true)}>
            + הוסף מטרה
          </button>
        </div>

        {/* Search */}
        <div className="form-group" style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="חיפוש מטרה..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSortBy(s => s === 'kids' ? 'name' : 'kids')}
            className="btn-secondary btn-small"
          >
            {sortBy === 'kids' ? 'מיון: ילדים ↓' : 'מיון: א-ב'}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9em' }}>
            <input type="checkbox" checked={orphansOnly} onChange={(e) => setOrphansOnly(e.target.checked)} style={{ accentColor: '#ef4444' }} />
            ללא ילד משויך ({orphanCount})
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9em', marginRight: 'auto' }}>
            <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length} onChange={toggleSelectAll} style={{ accentColor: '#667eea' }} />
            בחר הכל
          </label>
        </div>

        {/* Category chips */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button className={`tab-btn${categoryFilter === 'all' ? ' active' : ''}`} onClick={() => setCategoryFilter('all')}>
            הכל
          </button>
          {GOAL_CATEGORIES.map(cat => (
            <button key={cat.id} className={`tab-btn${categoryFilter === cat.id ? ' active' : ''}`} onClick={() => setCategoryFilter(cat.id)}>
              {cat.nameHe}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="loading">טוען...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>לא נמצאו מטרות</p></div>
        ) : (
          <div className="goal-library-list">
            {filtered.map(item => (
              <div key={item.id} className="goal-library-row">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelection(item.id)}
                  style={{ accentColor: '#667eea', cursor: 'pointer' }}
                />
                <span
                  className="goal-library-cat"
                  style={{ background: getCategoryColor(item.categoryId) + '20', color: getCategoryColor(item.categoryId) }}
                >
                  {getCategoryName(item.categoryId)}
                </span>
                <span className="goal-library-title">{item.title}</span>
                <span className="goal-library-count" title="ילדים פעילים">{item.activeCount ?? item.usageCount}</span>
                {confirmingDelete === item.id ? (
                  <span className="goal-library-confirm">
                    בטוח?
                    <button onClick={() => deleteMutation.mutate(item.id)} className="btn-danger btn-small">כן</button>
                    <button onClick={() => setConfirmingDelete(null)} className="btn-secondary btn-small">לא</button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmingDelete(item.id)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85em', padding: '2px 6px' }}
                  >מחק</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating selection bar */}
      {selectedIds.size > 0 && (
        <div className="goal-library-selection-bar">
          <span>{selectedIds.size} נבחרו</span>
          <button
            className="btn-primary btn-small"
            onClick={() => {
              setShowAssignModal(true);
              setKidSearch('');
              setSelectedKidId(null);
            }}
          >
            שייך לילד
          </button>
          <button className="btn-secondary btn-small" onClick={() => setSelectedIds(new Set())}>
            ביטול
          </button>
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>הוספת מטרה לספרייה</h3>
            <div className="form-group">
              <label>קטגוריה</label>
              <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value as GoalCategoryId)}>
                {GOAL_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nameHe}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>שם המטרה</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="הכנס שם מטרה..."
                autoFocus
              />
            </div>
            {addLibraryMutation.isError && (
              <div style={{ color: '#ef4444', fontSize: '0.85em', marginBottom: 8 }}>
                {(addLibraryMutation.error as Error)?.message || 'שגיאה בהוספת מטרה'}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>ביטול</button>
              <button
                type="button"
                className="btn-primary"
                disabled={!newTitle.trim() || addLibraryMutation.isPending}
                onClick={() => addLibraryMutation.mutate({ title: newTitle.trim(), categoryId: newCategoryId })}
              >
                {addLibraryMutation.isPending ? 'מוסיף...' : 'הוסף'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign-to-Kid Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>שיוך {selectedIds.size} מטרות לילד/ה</h3>

            <div className="form-group">
              <label>בחר ילד/ה</label>
              <div style={{ position: 'relative' }}>
                <input
                  ref={kidSearchRef}
                  type="text"
                  value={kidSearch}
                  onChange={e => {
                    setKidSearch(e.target.value);
                    setShowKidDropdown(true);
                    if (selectedKidId) setSelectedKidId(null);
                  }}
                  onFocus={() => setShowKidDropdown(true)}
                  onKeyDown={handleKidKeyDown}
                  placeholder="הקלד שם ילד..."
                  autoFocus
                  autoComplete="off"
                />
                {showKidDropdown && filteredKids.length > 0 && !selectedKidId && (
                  <div
                    ref={dropdownRef}
                    style={{
                      position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 10,
                      background: 'white', border: '1px solid #d1d5db', borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto',
                    }}
                  >
                    {filteredKids.map((k, i) => (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => selectKid(k)}
                        style={{
                          display: 'block', width: '100%', padding: '8px 12px', border: 'none',
                          background: i === highlightedIndex ? '#eef2ff' : 'transparent',
                          textAlign: 'right', cursor: 'pointer', fontSize: '0.95em', color: '#334155',
                        }}
                        onMouseEnter={() => setHighlightedIndex(i)}
                      >
                        {k.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedKidId && (
              <div style={{ fontSize: '0.85em', color: '#64748b', marginBottom: 8 }}>
                {selectedGoals.map(g => g.title).join(', ')}
              </div>
            )}

            {assignMutation.isError && (
              <div style={{ color: '#ef4444', fontSize: '0.85em', marginBottom: 8 }}>
                {(assignMutation.error as Error)?.message || 'שגיאה בשיוך המטרות'}
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowAssignModal(false)}>ביטול</button>
              <button
                type="button"
                className="btn-primary"
                disabled={!selectedKidId || assignMutation.isPending}
                onClick={() => assignMutation.mutate({ kidId: selectedKidId!, goals: selectedGoals })}
              >
                {assignMutation.isPending ? `משייך ${selectedGoals.length} מטרות...` : 'שייך'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
