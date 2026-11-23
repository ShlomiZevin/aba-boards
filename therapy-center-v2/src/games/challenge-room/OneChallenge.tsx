/**
 * Games 2 and 3 of the challenge room - each its own game in the games room with ONE
 * challenge (spec games 7 and 8), built on the room: the same pads, plates, levels,
 * results and history, saved under the game's own id. It opens on the challenge's intro.
 */
import type { GameComponentProps } from '../../types';
import ChallengeRoom from './ChallengeRoom';

export function BackToBase(props: GameComponentProps) {
  return <ChallengeRoom {...props} gameId="back-to-base" only={['base']} />;
}

export function CountThenTouch(props: GameComponentProps) {
  return <ChallengeRoom {...props} gameId="count-then-touch" only={['wait']} />;
}
