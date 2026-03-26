import type {
  Kid,
  Practitioner,
  Parent,
  Goal,
  GoalLibraryItem,
  GoalFormTemplate,
  GoalFormRow,
  KidGoalLearningPlan,
  LearningPlanVersion,
  KidGoalDataEntry,
  TableBlockData,
  Session,
  SessionForm,
  MeetingForm,
  Summary,
  FormTemplate,
  Notification,
  BoardRequest,
  ApiResponse,
  GroupedKidsResponse,
  CategoryLpTemplate,
  GoalTableBlock,
} from '../types';

// Auto-detect: dev uses Vite proxy, production uses Cloud Run
const API_BASE = import.meta.env.DEV
  ? '/api/therapy'  // Dev: proxied by Vite to localhost:3001
  : 'https://avatar-server-1018338671074.me-west1.run.app/api/therapy';  // Prod: Cloud Run

const ADMIN_API_BASE = import.meta.env.DEV
  ? '/api/admin'
  : 'https://avatar-server-1018338671074.me-west1.run.app/api/admin';

// Auth context for therapist/parent views (set by route components)
let _therapistId: string | null = null;
let _parentKidId: string | null = null;

export function setTherapistAuth(id: string | null) { _therapistId = id; }
export function setParentAuth(kidId: string | null) { _parentKidId = kidId; }

function getAuthHeaders(): Record<string, string> {
  // Therapist/parent auth must take priority when set (via route components).
  // Otherwise an admin_key still in localStorage overrides the intended auth type,
  // causing e.g. GET /notifications/mine to return [] instead of the therapist's notifications.
  if (_therapistId) return { 'X-Practitioner-Id': _therapistId };
  if (_parentKidId) return { 'X-Kid-Id': encodeURIComponent(_parentKidId) };
  const adminKey = localStorage.getItem('admin_key');
  if (adminKey) return { 'X-Admin-Key': adminKey };
  return {};
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Request failed' };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// Kids API
export const kidsApi = {
  getAll: () => fetchApi<Kid[]>('/kids'),
  getById: (kidId: string) => fetchApi<Kid>(`/kids/${kidId}`),
  create: (data: { name: string; age?: number | string; gender?: string }) =>
    fetchApi<Kid>('/kids', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (kidId: string, data: Partial<Kid>) =>
    fetchApi<Kid>(`/kids/${kidId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (kidId: string) =>
    fetchApi<void>(`/kids/${kidId}`, { method: 'DELETE' }),
  getAllGrouped: () => fetchApi<GroupedKidsResponse>('/kids/all-grouped'),
  detach: (kidId: string) => fetchApi<void>(`/kids/${kidId}/detach`, { method: 'POST' }),
  attach: (kidId: string) => fetchApi<void>(`/kids/${kidId}/attach`, { method: 'POST' }),
};

// Practitioners API
export const practitionersApi = {
  getForKid: (kidId: string) =>
    fetchApi<Practitioner[]>(`/kids/${kidId}/practitioners`),
  add: (kidId: string, data: Omit<Practitioner, 'id' | 'createdAt'>) =>
    fetchApi<Practitioner>(`/kids/${kidId}/practitioners`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Practitioner>) =>
    fetchApi<Practitioner>(`/practitioners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<void>(`/practitioners/${id}`, { method: 'DELETE' }),
  unlink: (kidId: string, practitionerId: string) =>
    fetchApi<void>(`/kids/${kidId}/practitioners/${practitionerId}`, { method: 'DELETE' }),
  linkExisting: (kidId: string, practitionerId: string) =>
    fetchApi<void>(`/kids/${kidId}/practitioners/link`, {
      method: 'POST',
      body: JSON.stringify({ practitionerId }),
    }),
  create: (data: Omit<Practitioner, 'id' | 'createdAt'>) =>
    fetchApi<Practitioner>('/practitioners', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMyTherapists: () => fetchApi<Practitioner[]>('/practitioners/my-therapists'),
  getKidsForPractitioner: (practitionerId: string) =>
    fetchApi<Kid[]>(`/practitioners/${practitionerId}/kids`),
  getInfo: (practitionerId: string) =>
    fetchApi<Practitioner>(`/practitioners/${practitionerId}/info`),
};

// Parents API
export const parentsApi = {
  getForKid: (kidId: string) => fetchApi<Parent[]>(`/kids/${kidId}/parents`),
  add: (kidId: string, data: Omit<Parent, 'id' | 'kidId' | 'createdAt'>) =>
    fetchApi<Parent>(`/kids/${kidId}/parents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Parent>) =>
    fetchApi<Parent>(`/parents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => fetchApi<void>(`/parents/${id}`, { method: 'DELETE' }),
};

// Goals API
export const goalsApi = {
  getForKid: (kidId: string) => fetchApi<Goal[]>(`/kids/${kidId}/goals`),
  add: (kidId: string, data: Omit<Goal, 'id' | 'kidId' | 'createdAt' | 'isActive'>) =>
    fetchApi<Goal>(`/kids/${kidId}/goals`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Goal>) =>
    fetchApi<Goal>(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => fetchApi<void>(`/goals/${id}`, { method: 'DELETE' }),
  searchLibrary: (search: string) =>
    fetchApi<GoalLibraryItem[]>(`/goals/library?search=${encodeURIComponent(search)}`),
  getAllLibrary: () =>
    fetchApi<GoalLibraryItem[]>('/goals/library/all'),
  deleteLibraryItem: (id: string) =>
    fetchApi<void>(`/goals/library/${id}`, { method: 'DELETE' }),
  addLibraryItem: (data: { title: string; categoryId: string }) =>
    fetchApi<GoalLibraryItem>('/goals/library', { method: 'POST', body: JSON.stringify(data) }),
  migrateLibraryLinks: (kidId: string) =>
    fetchApi<{ matched: { goalId: string; title: string; libraryItemId: string }[]; unmatched: { goalId: string; title: string }[] }>(
      `/kids/${kidId}/goals/migrate-library-links`, { method: 'POST' }
    ),
};

// Goal Templates API (admin only)
export const goalTemplatesApi = {
  updateTemplates: (
    libraryItemId: string,
    data: {
      learningPlanTemplate?: GoalFormTemplate | null;
      dataCollectionTemplate?: GoalFormTemplate | null;
      dcPresetName?: string | null;
      lpPresetName?: string | null;
      dcPresetSourceId?: string | null;
      lpPresetSourceId?: string | null;
    }
  ) =>
    fetchApi<GoalLibraryItem>(`/goals/library/${libraryItemId}/templates`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  bulkApply: (sourceId: string, targetIds: string[], formType: 'lp' | 'dc', options?: { replaceTitle?: boolean }) =>
    fetchApi<{ applied: number }>(`/goals/library/${sourceId}/apply-template`, {
      method: 'POST',
      body: JSON.stringify({ targetIds, formType, replaceTitle: options?.replaceTitle }),
    }),
};

// Goal Learning Plans API (per kid)
export const goalPlansApi = {
  get: (kidId: string, goalLibraryId: string) =>
    fetchApi<KidGoalLearningPlan>(`/kids/${kidId}/goal-plans/${goalLibraryId}`),
  save: (kidId: string, goalLibraryId: string, data: { goalTitle: string; tables: TableBlockData[] }) =>
    fetchApi<KidGoalLearningPlan>(`/kids/${kidId}/goal-plans/${goalLibraryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getVersions: (kidId: string, goalLibraryId: string) =>
    fetchApi<LearningPlanVersion[]>(`/kids/${kidId}/goal-plans/${goalLibraryId}/versions`),
  saveVersion: (kidId: string, goalLibraryId: string, data?: { versionLabel?: string }) =>
    fetchApi<LearningPlanVersion>(`/kids/${kidId}/goal-plans/${goalLibraryId}/versions`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  getVersion: (kidId: string, goalLibraryId: string, versionId: string) =>
    fetchApi<LearningPlanVersion>(`/kids/${kidId}/goal-plans/${goalLibraryId}/versions/${versionId}`),
  deleteVersion: (kidId: string, goalLibraryId: string, versionId: string) =>
    fetchApi<void>(`/kids/${kidId}/goal-plans/${goalLibraryId}/versions/${versionId}`, { method: 'DELETE' }),
  restoreVersion: (kidId: string, goalLibraryId: string, versionId: string) =>
    fetchApi<KidGoalLearningPlan>(`/kids/${kidId}/goal-plans/${goalLibraryId}/versions/${versionId}/restore`, {
      method: 'POST',
    }),
};

// Category LP Templates API
export const categoryLpTemplatesApi = {
  getAll: () => fetchApi<CategoryLpTemplate[]>('/category-lp-templates'),
  get: (categoryId: string) => fetchApi<CategoryLpTemplate>(`/category-lp-templates/${categoryId}`),
  save: (categoryId: string, data: { tables: GoalTableBlock[] }) =>
    fetchApi<CategoryLpTemplate>(`/category-lp-templates/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (categoryId: string) =>
    fetchApi<void>(`/category-lp-templates/${categoryId}`, { method: 'DELETE' }),
};

// Goal Data Collection API (per kid)
export const goalDataApi = {
  getEntries: (kidId: string, goalLibraryId: string) =>
    fetchApi<KidGoalDataEntry[]>(`/kids/${kidId}/goal-data/${goalLibraryId}`),
  addEntry: (
    kidId: string,
    goalLibraryId: string,
    data: { goalTitle: string; sessionDate: string; practitionerId?: string; tables: TableBlockData[] }
  ) =>
    fetchApi<KidGoalDataEntry>(`/kids/${kidId}/goal-data/${goalLibraryId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  bulkAddEntries: (
    kidId: string,
    goalLibraryId: string,
    entries: { goalTitle: string; sessionDate: string; practitionerId?: string; tables: TableBlockData[] }[]
  ) =>
    fetchApi<KidGoalDataEntry[]>(`/kids/${kidId}/goal-data/${goalLibraryId}/bulk`, {
      method: 'POST',
      body: JSON.stringify({ entries }),
    }),
  updateEntry: (
    kidId: string,
    goalLibraryId: string,
    entryId: string,
    data: { tables: TableBlockData[] }
  ) =>
    fetchApi<KidGoalDataEntry>(`/kids/${kidId}/goal-data/${goalLibraryId}/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteEntry: (kidId: string, goalLibraryId: string, entryId: string) =>
    fetchApi<void>(`/kids/${kidId}/goal-data/${goalLibraryId}/${entryId}`, { method: 'DELETE' }),
  getPending: (kidId: string) =>
    fetchApi<KidGoalDataEntry[]>(`/kids/${kidId}/pending-dc`),
  getAllEntries: (kidId: string) =>
    fetchApi<KidGoalDataEntry[]>(`/kids/${kidId}/all-dc`),
};

// Goal Form File Upload API
export interface GoalFormUploadResult {
  goalTitle: string;
  formType: 'lp' | 'dc';
  targetBlockId: string;
  columns: import('../types').GoalColumnDef[] | null;
  rows: GoalFormRow[] | null;
  entries: (GoalFormRow & { sessionDate: string })[] | null;
  /** Multi-block LP results: [{tableId, columns?, rows}] */
  tables?: { tableId: string; columns?: import('../types').GoalColumnDef[] | null; rows: GoalFormRow[] }[];
}

export const goalFormUploadApi = {
  upload: (
    kidId: string,
    goalLibraryId: string,
    file: File,
    formType: 'lp' | 'dc',
    updateStructure: boolean
  ): Promise<ApiResponse<GoalFormUploadResult>> => {
    const form = new FormData();
    form.append('file', file);
    form.append('formType', formType);
    form.append('updateStructure', String(updateStructure));
    return fetch(`${API_BASE}/kids/${kidId}/goal-forms/${goalLibraryId}/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: form,
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) return { success: false as const, error: data.error || 'שגיאה בהעלאה' };
      return { success: true as const, data };
    }).catch(err => ({ success: false as const, error: (err as Error).message }));
  },
};

// Sessions API
export const sessionsApi = {
  getForKid: (kidId: string, filters?: { from?: string; to?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);
    if (filters?.status) params.append('status', filters.status);
    const query = params.toString();
    return fetchApi<Session[]>(`/kids/${kidId}/sessions${query ? `?${query}` : ''}`);
  },
  schedule: (
    kidId: string,
    data: { scheduledDate: string; therapistId?: string; type?: string }
  ) =>
    fetchApi<Session>(`/kids/${kidId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  scheduleRecurring: (
    kidId: string,
    data: { scheduledDate: string; therapistId?: string; type?: string; until: string }
  ) =>
    fetchApi<Session[]>(`/kids/${kidId}/sessions/recurring`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Session>) =>
    fetchApi<Session>(`/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<void>(`/sessions/${id}`, { method: 'DELETE' }),
  getAlerts: () => fetchApi<Session[]>('/sessions/alerts'),
};

// Meeting Forms API
export const meetingFormsApi = {
  getForKid: (kidId: string) => fetchApi<MeetingForm[]>(`/kids/${kidId}/meeting-forms`),
  getById: (id: string) => fetchApi<MeetingForm>(`/meeting-forms/${id}`),
  submit: (data: Omit<MeetingForm, 'id' | 'createdAt' | 'updatedAt'>) =>
    fetchApi<MeetingForm>('/meeting-forms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<MeetingForm>) =>
    fetchApi<MeetingForm>(`/meeting-forms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => fetchApi<void>(`/meeting-forms/${id}`, { method: 'DELETE' }),
};

// Summaries API
export const summariesApi = {
  getForKid: (kidId: string) => fetchApi<Summary[]>(`/kids/${kidId}/summaries`),
  getById: (id: string) => fetchApi<Summary>(`/summaries/${id}`),
  create: (data: { kidId: string; title: string; content: string; fromDate: string; toDate: string }) =>
    fetchApi<Summary>('/summaries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Summary>) =>
    fetchApi<Summary>(`/summaries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => fetchApi<void>(`/summaries/${id}`, { method: 'DELETE' }),
};

// Forms API
export const formTemplateApi = {
  get: (kidId: string) =>
    fetchApi<FormTemplate>(`/kids/${kidId}/form-template`),
  update: (kidId: string, template: FormTemplate) =>
    fetchApi<FormTemplate>(`/kids/${kidId}/form-template`, {
      method: 'PUT',
      body: JSON.stringify(template),
    }),
};

export const formsApi = {
  getForKid: (kidId: string, filters?: { weekOf?: string }) => {
    const params = new URLSearchParams();
    if (filters?.weekOf) params.append('weekOf', filters.weekOf);
    const query = params.toString();
    return fetchApi<SessionForm[]>(`/kids/${kidId}/forms${query ? `?${query}` : ''}`);
  },
  getById: (id: string) => fetchApi<SessionForm>(`/forms/${id}`),
  getForSession: (sessionId: string) =>
    fetchApi<SessionForm>(`/sessions/${sessionId}/form`),
  submit: (data: Omit<SessionForm, 'id' | 'createdAt' | 'updatedAt'>) =>
    fetchApi<SessionForm>('/forms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<SessionForm>) =>
    fetchApi<SessionForm>(`/forms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<void>(`/forms/${id}`, { method: 'DELETE' }),
  createFormLink: (kidId: string, sessionId?: string) =>
    fetchApi<{ token: string; url: string }>('/forms/create-link', {
      method: 'POST',
      body: JSON.stringify({ kidId, sessionId }),
    }),
};

// Notifications API
export const notificationsApi = {
  send: (data: { kidId: string; message: string; targets: { type: string; id: string; name: string }[] }) =>
    fetchApi<void>('/notifications', { method: 'POST', body: JSON.stringify(data) }),
  getMine: () => fetchApi<Notification[]>('/notifications/mine'),
  getSent: (kidId: string) => fetchApi<Notification[]>(`/notifications/sent?kidId=${kidId}`),
  getAllSent: (opts?: { includeHidden?: boolean }) =>
    fetchApi<Notification[]>(`/notifications/all-sent${opts?.includeHidden ? '?includeHidden=true' : ''}`),
  markRead: (id: string) => fetchApi<void>(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () => fetchApi<void>('/notifications/mine/read-all', { method: 'PUT' }),
  dismiss: (id: string) => fetchApi<void>(`/notifications/${id}/dismiss`, { method: 'PUT' }),
  adminDismiss: (id: string) => fetchApi<void>(`/notifications/${id}/admin-dismiss`, { method: 'PUT' }),
  delete: (id: string) => fetchApi<void>(`/notifications/${id}`, { method: 'DELETE' }),
  deleteAll: () => fetchApi<{ deleted: number }>('/notifications/all', { method: 'DELETE' }),
};

// Board Requests API (super-admin only)
export const boardRequestsApi = {
  getAll: () => fetchApi<BoardRequest[]>('/board-requests'),
  generate: (id: string) =>
    fetchApi<{ kidId: string; boardUrl: string; builderUrl: string }>(`/board-requests/${id}/generate`, {
      method: 'POST',
    }),
  update: (id: string, data: Partial<BoardRequest>) =>
    fetchApi<BoardRequest>(`/board-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<void>(`/board-requests/${id}`, { method: 'DELETE' }),
};

// Admin API (super-admin operations)
async function fetchAdminApi<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${ADMIN_API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      ...options,
    });
    if (response.status === 204) return { success: true, data: undefined as unknown as T };
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.error || 'Request failed' };
    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export const adminApi = {
  createKey: (data: { name: string; key: string; mobile?: string; email?: string }) =>
    fetchAdminApi<{ key: string; adminId: string; name: string }>('/create-key', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  listAdmins: () =>
    fetchAdminApi<{ docId: string; adminId: string; name: string; key: string; active: boolean; mobile: string; email: string; createdAt: string | null }[]>('/list'),
  deleteAdmin: (adminId: string) =>
    fetchAdminApi<void>(`/${adminId}`, { method: 'DELETE' }),
  changeKey: (newKey: string) =>
    fetchAdminApi<{ success: boolean }>('/change-key', {
      method: 'POST',
      body: JSON.stringify({ newKey }),
    }),
  updateProfile: (data: { name: string; mobile?: string; email?: string }) =>
    fetchAdminApi<{ success: boolean; name: string; mobile: string; email: string }>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getSubscription: () =>
    fetchAdminApi<{ plan: string; status: string; trialEndDate: string | null; proEndDate: string | null; billingCycle: string | null; nextPaymentDate: string | null; paypalSubscriptionId: string | null; isSuperAdmin?: boolean }>('/subscription'),
  createSubscription: (billingCycle: 'monthly' | 'yearly') =>
    fetchAdminApi<{ approvalUrl: string; subscriptionId: string }>('/subscription/create', {
      method: 'POST',
      body: JSON.stringify({ billingCycle }),
    }),
  activateSubscription: (subscriptionId: string) =>
    fetchAdminApi<{ success: boolean }>('/subscription/activate', {
      method: 'POST',
      body: JSON.stringify({ subscriptionId }),
    }),
  cancelSubscription: () =>
    fetchAdminApi<{ success: boolean }>('/subscription/cancel', { method: 'POST' }),
  signup: (data: { name: string; mobile: string; email: string; key: string }) =>
    fetch(`${ADMIN_API_BASE}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) return { success: false as const, error: d.error || 'שגיאה' };
      return { success: true as const, data: d as { key: string; adminId: string; name: string } };
    }),
};

// AI Chat API
export interface ChatResponse {
  reply: string;
  boardUpdated?: boolean;
  summaryCreated?: boolean;
  toolsUsed?: string[];
}

export interface ChatStatusEvent {
  type: 'thinking' | 'tool' | 'done' | 'error';
  label?: string;
  tool?: string;
  reply?: string;
  boardUpdated?: boolean;
  summaryCreated?: boolean;
  toolsUsed?: string[];
  error?: string;
}

export const chatApi = {
  send: (messages: { role: string; content: string }[], kidId?: string | null) =>
    fetchApi<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, kidId }),
    }),

  sendStream: async (
    messages: { role: string; content: string }[],
    kidId: string | null,
    onStatus: (event: ChatStatusEvent) => void,
    extraBody?: Record<string, unknown>,
  ): Promise<ChatResponse> => {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ messages, kidId, stream: true, ...extraBody }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: ChatResponse = { reply: '' };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event: ChatStatusEvent = JSON.parse(line.slice(6));
          onStatus(event);
          if (event.type === 'done') {
            result = {
              reply: event.reply || '',
              boardUpdated: event.boardUpdated,
              summaryCreated: event.summaryCreated,
              toolsUsed: event.toolsUsed,
            };
          }
          if (event.type === 'error') {
            throw new Error(event.error || 'Chat error');
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue; // skip malformed SSE lines
          throw e;
        }
      }
    }

    return result;
  },
};
