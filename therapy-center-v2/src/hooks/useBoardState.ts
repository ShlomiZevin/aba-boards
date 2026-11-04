import { useState, useCallback, useRef } from 'react';
import type { BoardLayoutItem, BoardTaskData, BoardSettings, BoardLayout, TaskType, CalmDownActivity, ColorSchema, CoinStyle } from '../types';

export interface KidInfo {
  name: string;
  age: string;
  gender: 'boy' | 'girl' | '';
  imageName: string;
}

const DEFAULT_SETTINGS: BoardSettings = {
  dailyReward: 0.5,
  coinStyle: 'dollar',
  colorSchema: 'purple',
  showDino: true,
  soundsEnabled: true,
  builderPin: '1234',
  kidDescription: '',
  behaviorGoals: '',
};

const DEFAULT_KID_INFO: KidInfo = {
  name: '',
  age: '',
  gender: '',
  imageName: '',
};

const CALM_DOWN_DEFAULTS: Record<CalmDownActivity, { icon: string; title: string }> = {
  paint: { icon: '🎨', title: 'ציור' },
  bubbles: { icon: '🫧', title: 'בועות סבון' },
  xylophone: { icon: '🎵', title: 'קסילופון' },
  breathing: { icon: '🌬️', title: 'נשימות' },
  scooter: { icon: '🛴', title: 'קורקינט' },
};

/** Extract tasks from board layout items */
function extractTasks(items: BoardLayoutItem[]): BoardTaskData[] {
  return items
    .filter((item) => item.type === 'task' && item.taskData)
    .map((item) => item.taskData!);
}

/** Build the full boardLayout.items for saving — add bank + progress at top */
function buildSaveLayout(items: BoardLayoutItem[], settings: BoardSettings): BoardLayoutItem[] {
  let nextId = 9000;
  const layout: BoardLayoutItem[] = [];

  // Always prepend bank + progress
  layout.push({
    id: nextId++,
    type: 'bank',
    label: settings.coinStyle === 'shekel' ? '₪' : settings.coinStyle === 'dollar' ? '$' : 'נק׳',
  });
  layout.push({
    id: nextId++,
    type: 'progress',
    title: 'ההתקדמות שלי היום',
  });

  // Then all user items in display order
  layout.push(...items);

  return layout;
}

/** Parse existing boardLayout — keep headers, tasks, and goals in display order */
function parseExistingLayout(layout: BoardLayout | undefined): BoardLayoutItem[] {
  if (!layout?.items) return [];
  // Strip bank and progress (auto-generated), keep everything else in order
  return layout.items.filter((item) => item.type !== 'bank' && item.type !== 'progress');
}

export function useBoardState(initialKid?: Record<string, unknown>) {
  const nextIdRef = useRef(1);

  const initialItems = parseExistingLayout(initialKid?.boardLayout as BoardLayout | undefined);
  if (initialItems.length > 0) {
    const allIds = initialItems.flatMap((i) => {
      const ids = [i.id];
      if (i.taskData) ids.push(i.taskData.id);
      return ids;
    });
    nextIdRef.current = Math.max(...allIds) + 1;
  }

  const [items, setItems] = useState<BoardLayoutItem[]>(initialItems);
  const [settings, setSettings] = useState<BoardSettings>({
    ...DEFAULT_SETTINGS,
    ...(initialKid ? {
      dailyReward: (initialKid.dailyReward as number) ?? DEFAULT_SETTINGS.dailyReward,
      coinStyle: (initialKid.coinStyle as CoinStyle) ?? DEFAULT_SETTINGS.coinStyle,
      coinImageName: initialKid.coinImageName as string | undefined,
      colorSchema: (initialKid.colorSchema as ColorSchema) ?? DEFAULT_SETTINGS.colorSchema,
      showDino: (initialKid.showDino as boolean) ?? DEFAULT_SETTINGS.showDino,
      soundsEnabled: (initialKid.soundsEnabled as boolean) ?? DEFAULT_SETTINGS.soundsEnabled,
      builderPin: (initialKid.builderPin as string) ?? DEFAULT_SETTINGS.builderPin,
      kidDescription: (initialKid.kidDescription as string) ?? '',
      behaviorGoals: (initialKid.behaviorGoals as string) ?? '',
    } : {}),
  });
  const [kidInfo, setKidInfo] = useState<KidInfo>({
    ...DEFAULT_KID_INFO,
    ...(initialKid ? {
      name: (initialKid.name as string) ?? '',
      age: String((initialKid.age as number) ?? ''),
      gender: (initialKid.gender as 'boy' | 'girl' | '') ?? '',
      imageName: (initialKid.imageName as string) ?? '',
    } : {}),
  });
  const [isDirty, setDirty] = useState(false);

  const getNextId = useCallback(() => {
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    return id;
  }, []);

  const markDirty = useCallback(() => setDirty(true), []);

  // Insert at a specific position (or append if index >= length)
  const insertItemAt = useCallback((index: number, item: BoardLayoutItem) => {
    setItems((prev) => {
      const next = [...prev];
      next.splice(index, 0, item);
      return next;
    });
    markDirty();
  }, [markDirty]);

  const addTaskAt = useCallback((index: number, title: string, icon: string, type: TaskType) => {
    const id = getNextId();
    const taskData: BoardTaskData = {
      id, icon, title, type,
      requiresTestimony: false,
      trackTime: false,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
    };
    insertItemAt(index, { id, type: 'task', taskType: type, taskData });
  }, [getNextId, insertItemAt]);

  const addGoalAt = useCallback((index: number, title: string, icon: string, pointsRequired: number) => {
    const id = getNextId();
    insertItemAt(index, { id, type: 'goal', icon, title, pointsRequired });
  }, [getNextId, insertItemAt]);

  const addCalmDownAt = useCallback((index: number, activityType: CalmDownActivity) => {
    const id = getNextId();
    const defaults = CALM_DOWN_DEFAULTS[activityType];
    const taskData: BoardTaskData = {
      id, icon: defaults.icon, title: defaults.title, type: 'calm-down',
      activityType, activeDays: [0, 1, 2, 3, 4, 5, 6],
    };
    insertItemAt(index, { id, type: 'task', taskType: 'calm-down', taskData });
  }, [getNextId, insertItemAt]);

  const addHeaderAt = useCallback((index: number, text: string) => {
    const id = getNextId();
    insertItemAt(index, { id, type: 'header', size: 'medium', text });
  }, [getNextId, insertItemAt]);

  // Append versions (for modals that don't specify position)
  const addTask = useCallback((title: string, icon: string, type: TaskType) => {
    addTaskAt(Infinity, title, icon, type);
  }, [addTaskAt]);

  const addGoal = useCallback((title: string, icon: string, pointsRequired: number) => {
    addGoalAt(Infinity, title, icon, pointsRequired);
  }, [addGoalAt]);

  const addCalmDown = useCallback((activityType: CalmDownActivity) => {
    addCalmDownAt(Infinity, activityType);
  }, [addCalmDownAt]);

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    markDirty();
  }, [markDirty]);

  const updateItem = useCallback((id: number, changes: Partial<BoardLayoutItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...changes };
        if (updated.taskData && changes.taskData) {
          updated.taskData = { ...item.taskData!, ...changes.taskData };
        }
        return updated;
      })
    );
    markDirty();
  }, [markDirty]);

  const moveItemUp = useCallback((id: number) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
    markDirty();
  }, [markDirty]);

  const moveItemDown = useCallback((id: number) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
    markDirty();
  }, [markDirty]);

  const updateSettings = useCallback((changes: Partial<BoardSettings>) => {
    setSettings((prev) => ({ ...prev, ...changes }));
    markDirty();
  }, [markDirty]);

  const updateKidInfo = useCallback((changes: Partial<KidInfo>) => {
    setKidInfo((prev) => ({ ...prev, ...changes }));
    markDirty();
  }, [markDirty]);

  const toSavePayload = useCallback(() => {
    const fullLayout = buildSaveLayout(items, settings);
    const tasks = extractTasks(items);
    return {
      name: kidInfo.name,
      age: kidInfo.age ? Number(kidInfo.age) : undefined,
      gender: kidInfo.gender || undefined,
      imageName: kidInfo.imageName || undefined,
      boardLayout: { items: fullLayout },
      tasks,
      headerLabel: kidInfo.name ? `הלוח של ${kidInfo.name}` : 'הלוח שלי',
      savingsLabel: 'החיסכון שלי',
      regularTasksHeader: 'המשימות שלי',
      bonusTasksHeader: 'משימות בונוס',
      calmDownHeader: 'פעילויות הרגעה',
      ...settings,
    };
  }, [items, settings, kidInfo]);

  return {
    items,
    settings,
    kidInfo,
    addTask,
    addGoal,
    addCalmDown,
    addTaskAt,
    addGoalAt,
    addCalmDownAt,
    addHeaderAt,
    removeItem,
    updateItem,
    moveItemUp,
    moveItemDown,
    updateSettings,
    updateKidInfo,
    toSavePayload,
    isDirty,
  };
}
