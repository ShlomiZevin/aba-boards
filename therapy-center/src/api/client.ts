import type {
  Kid,
  Practitioner,
  Parent,
  Goal,
  GoalLibraryItem,
  Session,
  SessionForm,
  MeetingForm,
  FormTemplate,
  ApiResponse,
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
  const adminKey = localStorage.getItem('admin_key');
  if (adminKey) return { 'X-Admin-Key': adminKey };
  if (_therapistId) return { 'X-Practitioner-Id': _therapistId };
  if (_parentKidId) return { 'X-Kid-Id': _parentKidId };
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
  linkExisting: (kidId: string, practitionerId: string) =>
    fetchApi<void>(`/kids/${kidId}/practitioners/link`, {
      method: 'POST',
      body: JSON.stringify({ practitionerId }),
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
};
