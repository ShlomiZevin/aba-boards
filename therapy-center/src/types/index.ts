// Practitioner types
export type PractitionerType = 'מטפלת' | 'מנתחת התנהגות' | 'מדריכת הורים';

export interface Practitioner {
  id: string;
  name: string;
  mobile?: string;
  email?: string;
  type: PractitionerType;
  isSuperAdmin?: boolean;
  createdAt: Date;
  createdBy?: string;
}

export interface KidPractitioner {
  id: string;
  kidId: string;
  practitionerId: string;
  role: 'therapist' | 'admin';
  addedAt: Date;
  addedBy: string;
}

// Parent type
export interface Parent {
  id: string;
  kidId: string;
  name: string;
  mobile?: string;
  email?: string;
  createdAt: Date;
}

// Goal form template types (for תוכנית למידה and איסוף נתונים)
export type GoalColumnType = 'text' | 'date' | 'options';

export interface GoalColumnDef {
  id: string;
  label: string;
  type: GoalColumnType;
  options?: string[];
  wide?: boolean; // kept for backward compat with old stored data, not shown in UI
}

// A table block — the fundamental unit of a form template.
// vertical: fields displayed as rows (label | value) — one row of data per block
// horizontal: fields displayed as columns — multiple rows of data per block
export type GoalTableType = 'vertical' | 'horizontal';

export interface GoalTableBlock {
  id: string;
  title?: string;
  type: GoalTableType;
  columns: GoalColumnDef[];
}

export interface GoalFormTemplate {
  tables: GoalTableBlock[];
  updatedAt?: Date;
}

// A single row of filled data (columnId → value string)
export type GoalFormRow = Record<string, string>;

// Per-table filled data (rows can be 1 for vertical, N for horizontal)
export interface TableBlockData {
  tableId: string;
  rows: GoalFormRow[];
}

export interface KidGoalLearningPlan {
  id: string;
  kidId: string;
  goalLibraryId: string;
  goalTitle: string;
  tables: TableBlockData[];
  updatedAt: Date;
  updatedBy: string;
}

export interface KidGoalDataEntry {
  id: string;
  kidId: string;
  goalLibraryId: string;
  goalTitle: string;
  sessionDate: Date;
  practitionerId?: string;
  tables: TableBlockData[];
  createdAt: Date;
}

// ---- Backward-compat normalizers ----
// Old Firestore data may have columns/rows/row at top level instead of tables.

export function normalizeTemplate(t: GoalFormTemplate | null | undefined): GoalTableBlock[] {
  if (!t) return [];
  if (t.tables && t.tables.length > 0) return t.tables;
  // old format: flat columns array
  const oldCols = (t as Record<string, unknown>).columns as GoalColumnDef[] | undefined;
  if (oldCols && oldCols.length > 0) {
    return [{ id: 'default', title: '', type: 'horizontal', columns: oldCols }];
  }
  return [];
}

export function normalizeLpData(plan: KidGoalLearningPlan | null): TableBlockData[] {
  if (!plan) return [];
  if (plan.tables && plan.tables.length > 0) return plan.tables;
  const oldRows = (plan as Record<string, unknown>).rows as GoalFormRow[] | undefined;
  if (oldRows) return [{ tableId: 'default', rows: oldRows }];
  return [];
}

export function normalizeDcEntry(entry: KidGoalDataEntry): TableBlockData[] {
  if (entry.tables && entry.tables.length > 0) return entry.tables;
  const oldRow = (entry as Record<string, unknown>).row as GoalFormRow | undefined;
  if (oldRow) return [{ tableId: 'default', rows: [oldRow] }];
  return [];
}

// ---- Built-in presets ----
// Based on reference documents: תוכניתלמידה1.docx and דף איסוף.docx / דף 10.docx

export const PRESET_LP_PROGRAM: GoalFormTemplate = {
  tables: [
    {
      id: 'lp_meta',
      title: 'פרטי תוכנית',
      type: 'vertical',
      columns: [
        { id: 'child_name', label: 'שם הילד', type: 'text' },
        { id: 'therapist_name', label: 'שם המטפלת', type: 'text' },
        { id: 'goal_desc', label: 'תיאור המטרה', type: 'text' },
        { id: 'general_instructions', label: 'הוראות כלליות', type: 'text' },
      ],
    },
    {
      id: 'lp_program',
      title: 'תוכנית',
      type: 'horizontal',
      columns: [
        { id: 'item', label: 'פריט / פעילות', type: 'text' },
        { id: 'stimulus', label: 'גירוי', type: 'text' },
        { id: 'response', label: 'תגובה', type: 'text' },
        { id: 'prompts', label: 'רמזים', type: 'options', options: ['פיזי מלא', 'פיזי חלקי', 'מילולי', 'עצמאי'] },
        { id: 'datePresented', label: 'תאריך הצגה', type: 'date' },
        { id: 'dateAcquired', label: 'תאריך רכישה', type: 'date' },
        { id: 'mastered', label: 'מסטר', type: 'options', options: ['כן', 'לא', 'חלקי'] },
      ],
    },
  ],
};

export const PRESET_DC_ACTIVITY: GoalFormTemplate = {
  tables: [
    {
      id: 'dc_activity',
      title: 'פרטי פגישה',
      type: 'horizontal',
      columns: [
        { id: 'activity', label: 'מה עשינו', type: 'text' },
        { id: 'cooperation', label: 'שיתוף פעולה', type: 'options', options: ['מלא', 'חלקי', 'לא שיתף פעולה'] },
        { id: 'assistance', label: 'כמה סייעתי', type: 'options', options: ['עצמאי', 'סיוע חלקי', 'סיוע מלא'] },
        { id: 'difficulties', label: 'קשיים', type: 'text' },
        { id: 'successes', label: 'הצלחות', type: 'text' },
      ],
    },
  ],
};

export const PRESET_DC_DTT: GoalFormTemplate = {
  tables: [
    {
      id: 'dc_dtt',
      title: 'ניסויים',
      type: 'horizontal',
      columns: [
        { id: 'item', label: 'הפריט שהוצג', type: 'text' },
        { id: 'response', label: 'תגובת הילד', type: 'options', options: ['+', 'ר'] },
        { id: 'notes', label: 'הערות', type: 'text' },
      ],
    },
  ],
};

// Goal types
export type GoalCategoryId =
  | 'motor-gross'
  | 'motor-fine'
  | 'language'
  | 'play-social'
  | 'cognitive'
  | 'adl'
  | 'general';

export interface GoalCategory {
  id: GoalCategoryId;
  name: string;
  nameHe: string;
  order: number;
  color: string;
}

export interface Goal {
  id: string;
  kidId: string;
  categoryId: GoalCategoryId;
  title: string;
  isActive: boolean;
  createdAt: Date;
  deactivatedAt?: Date;
  libraryItemId?: string;
  learningPlanTemplate?: GoalFormTemplate;
  dataCollectionTemplate?: GoalFormTemplate;
}

export interface GoalLibraryItem {
  id: string;
  title: string;
  categoryId: GoalCategoryId;
  usageCount: number;
  activeCount?: number;
  isOrphan?: boolean;
  learningPlanTemplate?: GoalFormTemplate;
  dataCollectionTemplate?: GoalFormTemplate;
}

// Session types
export type SessionStatus = 'scheduled' | 'pending_form' | 'completed' | 'missed';
export type SessionType = 'therapy' | 'meeting';

export interface Session {
  id: string;
  kidId: string;
  therapistId?: string;
  scheduledDate: Date;
  type?: SessionType;
  status: SessionStatus;
  formId?: string;
  createdAt: Date;
}

// Meeting form types
export interface MeetingAttendee {
  id: string;
  name: string;
  type: 'parent' | 'practitioner';
}

export interface MeetingForm {
  id: string;
  sessionId?: string;
  kidId: string;
  sessionDate: Date;
  attendees: MeetingAttendee[];
  generalNotes: string;
  behaviorNotes: string;
  adl: string;
  grossMotorPrograms: string;
  programsOutsideRoom: string;
  learningProgramsInRoom: string;
  tasks: string;
  createdAt: Date;
  updatedAt: Date;
}

// Form types
export interface GoalSnapshot {
  goalId: string;
  goalTitle: string;
  categoryId: GoalCategoryId;
}

export interface SessionForm {
  id: string;
  sessionId?: string;
  kidId: string;
  practitionerId: string;
  sessionDate: Date;

  // Structured fields
  cooperation: number; // 10-100
  sessionDuration: number; // minutes
  sittingDuration: number; // minutes

  // Rich text fields (HTML)
  mood: string;
  concentrationLevel: string;
  newReinforcers: string;
  wordsProduced: string;
  breakActivities: string;
  endOfSessionActivity: string;
  successes: string;
  difficulties: string;
  notes: string;

  // Goals
  goalsWorkedOn: GoalSnapshot[];
  additionalGoals: string[];

  // Custom fields from dynamic template
  customFields?: Record<string, string | number>;

  createdAt: Date;
  updatedAt: Date;
}

// Kid type (from existing collection)
export interface Kid {
  id: string;
  name: string;
  age?: number;
  gender?: 'boy' | 'girl';
  imageName?: string;
  createdBy?: string;
  adminId?: string;
  // Board data (present in full Firestore document)
  totalMoney?: number;
  tasks?: { id: number; [key: string]: unknown }[];
  dailyReward?: number;
  completedTasks?: number[];
  completedBonusTasks?: number[];
}

// Super admin kid management
export interface KidWithAdmin extends Kid {
  adminName?: string;
}

export interface GroupedKidsResponse {
  myKids: Kid[];
  orphanKids: Kid[];
  otherAdminKids: KidWithAdmin[];
}

// Form Template types
export type FormFieldType = 'text' | 'number' | 'percentage';

export interface FormTemplateSection {
  id: string;
  label: string;
  type: FormFieldType;
  order: number;
  isDefault?: boolean;
}

export interface FormTemplate {
  sections: FormTemplateSection[];
  updatedAt?: Date;
}

export const DEFAULT_FORM_TEMPLATE: FormTemplateSection[] = [
  { id: 'cooperation', label: 'שיתוף פעולה', type: 'percentage', order: 1, isDefault: true },
  { id: 'sessionDuration', label: 'משך הטיפול (דקות)', type: 'number', order: 2, isDefault: true },
  { id: 'sittingDuration', label: 'משך ישיבה (דקות)', type: 'number', order: 3, isDefault: true },
  { id: 'mood', label: 'מצב רוח', type: 'text', order: 4, isDefault: true },
  { id: 'concentrationLevel', label: 'רמת ריכוז / עייפות', type: 'text', order: 5, isDefault: true },
  { id: 'newReinforcers', label: 'מחזקים (חדשים)', type: 'text', order: 6, isDefault: true },
  { id: 'wordsProduced', label: 'מילים שהפיק', type: 'text', order: 7, isDefault: true },
  { id: 'breakActivities', label: 'פעילות בהפסקות', type: 'text', order: 8, isDefault: true },
  { id: 'endOfSessionActivity', label: 'פעילות סוף שיעור', type: 'text', order: 9, isDefault: true },
  { id: 'successes', label: 'הצלחות', type: 'text', order: 10, isDefault: true },
  { id: 'difficulties', label: 'קשיים', type: 'text', order: 11, isDefault: true },
  { id: 'notes', label: 'הערות', type: 'text', order: 12, isDefault: true },
];

// Known field IDs for backward compatibility
export const KNOWN_FIELD_IDS = DEFAULT_FORM_TEMPLATE.map(s => s.id);

// Notification types
export interface Notification {
  id: string;
  kidId: string;
  adminId: string;
  message: string;
  createdAt: Date;
  recipientType: 'practitioner' | 'parent';
  recipientId: string;
  recipientName: string;
  read: boolean;
  readAt?: Date;
  dismissed?: boolean;
  dismissedByAdmin?: boolean;
}

// Board Request types
export interface BoardRequest {
  id: string;
  childName: string;
  parentName?: string;
  email?: string;
  phone?: string;
  age?: number;
  gender?: 'boy' | 'girl';
  childImage?: string;
  childDescription?: string;
  tasks?: string;
  behaviorGoals?: string;
  rewards?: string;
  additionalNotes?: string;
  dailyReward?: number;
  coinStyle?: 'points' | 'shekel' | 'dollar';
  colorSchema?: 'purple' | 'pink' | 'blue' | 'dark';
  showDino?: boolean;
  soundsEnabled?: boolean;
  status: 'pending' | 'completed';
  createdBoardId?: string;
  inviteToken?: string;
  submittedAt?: { _seconds: number; _nanoseconds: number };
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Goal categories constant
export const GOAL_CATEGORIES: GoalCategory[] = [
  { id: 'motor-gross', name: 'Gross Motor', nameHe: 'מוטוריקה גסה', order: 1, color: '#4CAF50' },
  { id: 'motor-fine', name: 'Fine Motor', nameHe: 'מוטוריקה עדינה', order: 2, color: '#2196F3' },
  { id: 'language', name: 'Language/Communication', nameHe: 'שפה/תקשורת', order: 3, color: '#FF9800' },
  { id: 'play-social', name: 'Play/Social', nameHe: 'משחק/חברה', order: 4, color: '#E91E63' },
  { id: 'cognitive', name: 'Cognitive', nameHe: 'קוגנטיבי', order: 5, color: '#9C27B0' },
  { id: 'adl', name: 'ADL', nameHe: 'ADL', order: 6, color: '#00BCD4' },
  { id: 'general', name: 'General', nameHe: 'כללי', order: 7, color: '#607D8B' },
];
