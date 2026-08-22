import { useParams } from 'react-router-dom';
import ParentSlides from '../parent-slides/ParentSlides';
import type { Slide } from '../parent-slides/slides';
import { findTopic } from './topics';

// Placeholder deck for knowledge topics whose content isn't written yet.
export default function KnowledgeStub() {
  const { id } = useParams<{ id: string }>();
  const topic = findTopic(id);
  const title = topic?.title || 'מרכז הידע';

  const slides: Slide[] = [
    {
      variant: 'cover', section: 'מרכז הידע',
      eng: 'Doing',
      title,
      sub: 'התוכן בהכנה — בקרוב יעלה לכאן חומר מלא בנושא זה.',
    },
  ];

  return <ParentSlides slides={slides} backTo="/knowledge" backLabel="מרכז הידע" />;
}
