import type {
  Kid,
  Practitioner,
  Parent,
  Goal,
  GoalLibraryItem,
  Session,
  SessionForm,
  FormTemplate,
  ApiResponse,
} from '../types';

// Auto-detect: dev uses Vite proxy, production uses Cloud Run
const API_BASE = import.meta.env.DEV
  ? '/api/therapy'  // Dev: proxied by Vite to localhost:3001
  : 'https://avatar-server-1018338671074.me-west1.run.app/api/therapy';  // Prod: Cloud Run

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
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
  getMyTherapists: () => fetchApi<Practitioner[]>('/practitioners/my-therapists'),
  getKidsForPractitioner: (practitionerId: string) =>
    fetchApi<Kid[]>(`/practitioners/${practitionerId}/kids`),
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
    data: { scheduledDate: string; therapistId?: string }
  ) =>
    fetchApi<Session>(`/kids/${kidId}/sessions`, {
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
