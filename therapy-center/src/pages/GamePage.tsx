import { useCallback } from 'react';
import type { ComponentType } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kidsApi, gamesApi } from '../api/client';
import { getGame, configFor } from '../games/registry';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import { useTherapist } from '../contexts/TherapistContext';
import LegoTower from '../games/LegoTower';
import type {
  ApiResponse,
  GameComponentProps,
  GameConfigValues,
  GamePlayState,
  KidGameEntry,
  KidGameState,
} from '../types';

/** Each game's component, keyed by the id used in the registry. */
const GAME_COMPONENTS: Record<string, ComponentType<GameComponentProps>> = {
  'lego-tower': LegoTower,
};

/**
 * A game gets its own page and its own URL, so it can be opened full-screen,
 * bookmarked, or sent to a parent:  /kid/:kidId/game/:gameId
 */
export default function GamePage() {
  const { kidId, gameId } = useParams<{ kidId: string; gameId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const links = useTherapistLinks();
  const { isParentView } = useTherapist();

  const def = gameId ? getGame(gameId) : undefined;
  const Component = gameId ? GAME_COMPONENTS[gameId] : undefined;

  const kidQuery = useQuery({
    queryKey: ['kid', kidId],
    queryFn: () => kidsApi.getById(kidId!),
    enabled: !!kidId,
  });

  const stateQuery = useQuery({
    queryKey: ['kid-game-state', kidId],
    queryFn: () => gamesApi.getState(kidId!),
    enabled: !!kidId,
  });

  const saveState = useMutation({
    mutationFn: (state: GamePlayState) => gamesApi.saveState(kidId!, gameId!, state),
    // Apply locally first — the tower must never lag behind the finger
    onMutate: async (state) => {
      await queryClient.cancelQueries({ queryKey: ['kid-game-state', kidId] });
      const previous = queryClient.getQueryData<ApiResponse<KidGameState>>(['kid-game-state', kidId]);
      queryClient.setQueryData<ApiResponse<KidGameState>>(['kid-game-state', kidId], {
        success: true,
        data: { ...(previous?.data || {}), [gameId!]: state },
      });
      return { previous };
    },
    onError: (_err, _state, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['kid-game-state', kidId], context.previous);
      }
    },
  });

  const saveConfig = useMutation({
    mutationFn: (games: KidGameEntry[]) => kidsApi.update(kidId!, { games }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kid', kidId] }),
  });

  const kid = kidQuery.data?.data;
  const entry = (kid?.games || []).find((g) => g && g.id === gameId);
  const config = configFor(gameId || '', entry?.config);
  const state: GamePlayState = stateQuery.data?.data?.[gameId || ''] || {};

  const handleSaveConfig = useCallback(
    (values: GameConfigValues) => {
      if (!kid || !gameId) return;
      const others = (kid.games || []).filter((g) => g && g.id !== gameId);
      saveConfig.mutate([...others, { id: gameId, enabled: true, config: values }]);
    },
    [kid, gameId, saveConfig]
  );

  const handleExit = useCallback(() => {
    if (kidId) navigate(links.kidDetail(kidId));
  }, [navigate, links, kidId]);

  if (!def || !Component) {
    return <div className="empty-state"><p>המשחק לא נמצא.</p></div>;
  }
  if (kidQuery.isLoading || stateQuery.isLoading) {
    return <div className="empty-state"><p>טוען…</p></div>;
  }
  if (!kid) {
    return <div className="empty-state"><p>הילד לא נמצא.</p></div>;
  }

  return (
    <Component
      config={config}
      state={state}
      canEdit={!isParentView}
      onSaveState={(next) => saveState.mutate(next)}
      onSaveConfig={handleSaveConfig}
      onExit={handleExit}
    />
  );
}
