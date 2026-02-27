import { createContext, useContext } from 'react';

interface TherapistContextValue {
  isTherapistView: boolean;
  isParentView: boolean;
  practitionerId: string | null;
  parentKidId?: string | null;
}

const TherapistContext = createContext<TherapistContextValue>({
  isTherapistView: false,
  isParentView: false,
  practitionerId: null,
  parentKidId: null,
});

export const useTherapist = () => useContext(TherapistContext);
export default TherapistContext;
