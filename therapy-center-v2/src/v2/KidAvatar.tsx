import type { Kid } from '../types';
import { kidColor } from './kidColor';

const BASE = import.meta.env.BASE_URL;

/** The kid's photo when one was uploaded, otherwise their initial on their own marker colour. */
export default function KidAvatar({ kid, size = 'md' }: { kid: Pick<Kid, 'id' | 'name' | 'imageName'>; size?: 'sm' | 'md' | 'lg' }) {
  const cls = `nb-av ${size === 'md' ? '' : size} tone-${kidColor(kid.id)}`;
  if (kid.imageName) {
    const src = kid.imageName.startsWith('data:') || kid.imageName.startsWith('http') ? kid.imageName : `${BASE}${kid.imageName}`;
    return <img className={`${cls} nb-av-img`} src={src} alt="" />;
  }
  return <span className={cls} aria-hidden="true">{kid.name.charAt(0)}</span>;
}
