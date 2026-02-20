import { useTherapist } from '../contexts/TherapistContext';

export function useTherapistLinks() {
  const { isTherapistView, practitionerId } = useTherapist();

  const prefix = isTherapistView ? `/t/${practitionerId}` : '';

  return {
    home: () => `${prefix}/`,
    kidDetail: (kidId: string) => `${prefix}/kid/${kidId}`,
    kidGoals: (kidId: string) => `${prefix}/kid/${kidId}/goals`,
    formNew: (params: { kidId: string; sessionId?: string; date?: string }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('kidId', params.kidId);
      if (params.sessionId) searchParams.set('sessionId', params.sessionId);
      if (params.date) searchParams.set('date', params.date);
      return `${prefix}/form/new?${searchParams.toString()}`;
    },
    formEdit: (formId: string) => `${prefix}/form/${formId}/edit`,
    formView: (formId: string) => `${prefix}/form/${formId}/view`,
    // Meeting form routes — fill/edit are admin-only (no prefix), view works for both
    meetingFormNew: (params: { kidId: string; sessionId?: string; date?: string }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('kidId', params.kidId);
      if (params.sessionId) searchParams.set('sessionId', params.sessionId);
      if (params.date) searchParams.set('date', params.date);
      return `/meeting-form/new?${searchParams.toString()}`;
    },
    meetingFormEdit: (formId: string) => `/meeting-form/${formId}/edit`,
    meetingFormView: (formId: string) => `${prefix}/meeting-form/${formId}/view`,
  };
}
