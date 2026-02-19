import { createContext, useContext } from 'react';

interface TherapistContextValue {
  isTherapistView: boolean;
  practitionerId: string | null;
}

const TherapistContext = createContext<TherapistContextValue>({
  isTherapistView: false,
  practitionerId: null,
});

export const useTherapist = () => useContext(TherapistContext);
export default TherapistContext;
