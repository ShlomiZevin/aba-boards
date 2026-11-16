import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gamesApi, kidsApi } from '../../api/client';
import { useTherapistLinks } from '../../hooks/useTherapistLinks';
import { useTherapist } from '../../contexts/TherapistContext';
import { GAMES, configFor } from '../../games/registry';
import type { KidGameEntry } from '../../types';
import Icon from '../Icon';
import './games-room.css';

const TONES = ['lilac', 'peach', 'mint', 'sky', 'yellow', 'pink'];

/**
 * חדר המשחקים — every game for one kid, in all three views.
 * Admins and therapists see every game and switch each one on/off for this kid;
 * parents see only the games switched on.
 */
export default function GamesRoom() {
  const { kidId } = useParams<{ kidId: string }>();
  const links = useTherapistLinks();
  const { isParentView } = useTherapist();
  const qc = useQueryClient();
  const canEdit = !isParentView;

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
  const kid = kidQuery.data?.data;
  const played = stateQuery.data?.data || {};
  const entries: KidGameEntry[] = (kid?.games || []).filter(Boolean);
  // On = switched on; with no entry yet, a game the kid already plays counts as on
  // (kids who played before the games room existed keep their game).
  const isOn = (id: string) => {
    const e = entries.find((x) => x.id === id);
    return e ? e.enabled !== false : !!played[id];
  };

  const save = useMutation({
    mutationFn: (games: KidGameEntry[]) => kidsApi.update(kidId!, { games }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kid', kidId] }),
  });

  const toggle = (id: string) => {
    const existing = entries.find((e) => e.id === id);
    const next = existing
      ? entries.map((e) => (e.id === id ? { ...e, enabled: !isOn(id) } : e))
      : [...entries, { id, enabled: true, config: configFor(id) }];
    save.mutate(next);
  };

  if (kidQuery.isLoading) return <div className="empty-state"><p>טוען…</p></div>;
  if (!kid) return <div className="empty-state"><p>הילד לא נמצא.</p></div>;

  const shown = (canEdit ? GAMES : GAMES.filter((g) => isOn(g.id)))
    .slice()
    .sort((a, b) => Number(isOn(b.id)) - Number(isOn(a.id)));
  const gameUrl = (id: string) => `${links.kidDetail(kid.id)}/game/${id}`;

  return (
    <div className={`gr${isParentView ? " gr-bare" : ""}`}>
      <div className="gr-head">
        <Link to={links.kidDetail(kid.id)} className="gr-back" aria-label="חזרה לכרטיס הילד"><Icon name="back" /></Link>
        <div className="gr-title">
          <h1>חדר המשחקים</h1>
          <span>{kid.name}</span>
        </div>
      </div>

      {canEdit && (
        <p className="gr-sub">
          משחקים קצרים שהילד משחק בטאבלט או בטלפון, בדרך כלל עם מבוגר לידו.
          מדליקים משחק — וההורים רואים אותו גם אצלם.
        </p>
      )}

      {shown.length === 0 ? (
        <div className="nb-card gr-empty">
          <span className="gr-empty-ico">🎮</span>
          <p>עוד אין משחקים פעילים ל{kid.name}.</p>
        </div>
      ) : (
        <ul className="gr-grid">
          {shown.map((g, i) => {
            const on = isOn(g.id);
            return (
              <li key={g.id} className={`nb-card gr-card tone-${TONES[i % TONES.length]}${on ? ' is-on' : ''}`}>
                <Link to={gameUrl(g.id)} className="gr-play-area">
                  <span className="gr-ico" aria-hidden>{g.icon}</span>
                  <b>{g.name}</b>
                  <span className="gr-desc">{g.description}</span>
                </Link>
                <div className="gr-actions">
                  <Link to={gameUrl(g.id)} className="nb-btn gr-play"><Icon name="play" /> שחקו</Link>
                  {canEdit && (
                    <button
                      type="button"
                      className="gr-switch"
                      role="switch"
                      aria-checked={on}
                      disabled={save.isPending}
                      onClick={() => toggle(g.id)}
                    >
                      <span className="gr-knob" aria-hidden />
                      {on ? `פעיל ל${kid.name}` : 'כבוי'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
