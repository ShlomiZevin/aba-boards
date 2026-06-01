import { useParams, Navigate } from 'react-router-dom';
import { SLIDES } from './index';

export default function SlideRoute() {
  const { slideId } = useParams<{ slideId: string }>();
  const id = Number(slideId);
  const slide = SLIDES.find(s => s.id === id);
  if (!slide) return <Navigate to="/slides" replace />;
  const C = slide.Component;
  return <C />;
}
