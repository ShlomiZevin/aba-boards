import { useState } from 'react';
import type { GameSetting, GameConfigValues, GameConfigValue } from '../types';

interface Props {
  settings: GameSetting[];
  values: GameConfigValues;
  onCancel: () => void;
  onSave: (values: GameConfigValues) => void;
}

/**
 * Settings for a game, rendered from its schema — so a new setting on any game
 * shows up here without touching this file.
 */
export default function GameSettingsSheet({ settings, values, onCancel, onSave }: Props) {
  const [draft, setDraft] = useState<GameConfigValues>(values);

  const set = (key: string, value: GameConfigValue) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="lego-sheet" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="lego-sheet-card">
        <h2>הגדרות</h2>

        {settings.map((s) => {
          const id = `set-${s.key}`;
          const value = draft[s.key];

          if (s.type === 'checkbox') {
            return (
              <div className="lego-field check" key={s.key}>
                <label htmlFor={id}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => set(s.key, e.target.checked)}
                  />
                  <span>{s.label}</span>
                </label>
              </div>
            );
          }

          return (
            <div className="lego-field" key={s.key}>
              <label htmlFor={id}>{s.label}</label>
              {s.type === 'number' ? (
                <input
                  id={id}
                  type="number"
                  min={s.min}
                  max={s.max}
                  value={value === undefined ? '' : String(value)}
                  onChange={(e) => set(s.key, Number(e.target.value))}
                />
              ) : s.type === 'select' ? (
                <select id={id} value={String(value ?? '')} onChange={(e) => set(s.key, e.target.value)}>
                  {(s.options || []).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  type="text"
                  value={String(value ?? '')}
                  placeholder={s.placeholder}
                  onChange={(e) => set(s.key, e.target.value)}
                />
              )}
            </div>
          );
        })}

        <div className="lego-sheet-actions">
          <button className="lego-btn-cancel" onClick={onCancel}>ביטול</button>
          <button className="lego-btn-save" onClick={() => onSave(draft)}>שמור</button>
        </div>
      </div>
    </div>
  );
}
