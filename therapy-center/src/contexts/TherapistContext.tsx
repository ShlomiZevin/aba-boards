import { createContext, useContext } from 'react';

interface TherapistContextValue {
  isTherapistView: boolean;
  isParentView: boolean;
  practitionerId: string | null;
}

const TherapistContext = createContext<TherapistContextValue>({
  isTherapistView: false,
  isParentView: false,
  practitionerId: null,
});

export const useTherapist = () => useContext(TherapistContext);
export default TherapistContext;
