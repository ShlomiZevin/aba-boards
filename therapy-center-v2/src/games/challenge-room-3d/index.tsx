/**
 * challenge-room-3d, loaded only when it is opened - three.js and the models stay out
 * of the app's main bundle. While it loads, the game's own colour fills the screen.
 */
import { lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import type { GameComponentProps } from '../../types';

const Game = lazy(() => import('./ChallengeRoom3D'));

export default function ChallengeRoom3DLazy(props: GameComponentProps) {
  return (
    <Suspense fallback={createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#6f8fcf' }} />, document.body)}>
      <Game {...props} />
    </Suspense>
  );
}
