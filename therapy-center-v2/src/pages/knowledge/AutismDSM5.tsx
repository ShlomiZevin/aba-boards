import ParentSlides from '../parent-slides/ParentSlides';
import { DSM5_SLIDES } from './dsm5-slides';

// DSM-5 autism criteria — rendered as a short immersive deck (reuses the deck engine).
export default function AutismDSM5() {
  return <ParentSlides slides={DSM5_SLIDES} backTo="/knowledge" backLabel="מרכז הידע" />;
}
