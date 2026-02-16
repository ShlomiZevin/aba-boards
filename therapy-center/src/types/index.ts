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
}

export interface GoalLibraryItem {
  id: string;
  title: string;
  categoryId: GoalCategoryId;
  usageCount: number;
}

// Session types
export type SessionStatus = 'scheduled' | 'pending_form' | 'completed' | 'missed';

export interface Session {
  id: string;
  kidId: string;
  therapistId?: string;
  scheduledDate: Date;
  status: SessionStatus;
  formId?: string;
  createdAt: Date;
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
