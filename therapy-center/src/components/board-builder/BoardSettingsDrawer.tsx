import type { BoardSettings, ColorSchema, CoinStyle } from '../../types';

interface BoardSettingsDrawerProps {
  settings: BoardSettings;
  onChange: (changes: Partial<BoardSettings>) => void;
  onClose: () => void;
}

const COLOR_SCHEMES: { value: ColorSchema; label: string; colors: [string, string] }[] = [
  { value: 'purple', label: 'טורקיז', colors: ['#A8D5E5', '#89C4B8'] },
  { value: 'pink', label: 'אפרסק', colors: ['#F5C6AA', '#E8A07E'] },
  { value: 'blue', label: 'לבנדר', colors: ['#B8D4E8', '#C5B8E8'] },
  { value: 'dark', label: 'כהה', colors: ['#3D5A6C', '#2C4A52'] },
];

const COIN_STYLES: { value: CoinStyle; label: string }[] = [
  { value: 'dollar', label: '$ דולר' },
  { value: 'shekel', label: '₪ שקל' },
  { value: 'points', label: 'נקודות' },
];

export default function BoardSettingsDrawer({ settings, onChange, onClose }: BoardSettingsDrawerProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bb-settings-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="bb-settings-drawer-header">
          <h3>הגדרות הלוח</h3>
          <button type="button" className="bb-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="bb-settings-content">
          {/* Color scheme */}
          <div className="bb-settings-group">
            <label>צבע הלוח</label>
            <div className="bb-color-swatches">
              {COLOR_SCHEMES.map((scheme) => (
                <button
                  key={scheme.value}
                  type="button"
                  className={`bb-color-swatch ${settings.colorSchema === scheme.value ? 'active' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${scheme.colors[0]}, ${scheme.colors[1]})` }}
                  onClick={() => onChange({ colorSchema: scheme.value })}
                  title={scheme.label}
                />
              ))}
            </div>
          </div>

          {/* Coin style */}
          <div className="bb-settings-group">
            <label>סוג מטבע</label>
            <div className="bb-radio-group">
              {COIN_STYLES.map((cs) => (
                <button
                  key={cs.value}
                  type="button"
                  className={`bb-radio-btn ${settings.coinStyle === cs.value ? 'active' : ''}`}
                  onClick={() => onChange({ coinStyle: cs.value })}
                >
                  {cs.label}
                </button>
              ))}
            </div>
          </div>

          {/* Daily reward */}
          <div className="bb-settings-group">
            <label>פרס יומי (כמות מטבעות ליום מושלם)</label>
            <input
              type="number"
              className="bb-input bb-input-small"
              value={settings.dailyReward}
              onChange={(e) => onChange({ dailyReward: Number(e.target.value) || 0 })}
              min="0"
              step="0.5"
            />
          </div>

          {/* Kid description */}
          <div className="bb-settings-group">
            <label>תיאור הילד/ה (אופציונלי)</label>
            <textarea
              className="bb-textarea"
              value={settings.kidDescription}
              onChange={(e) => onChange({ kidDescription: e.target.value })}
              placeholder="תאר/י את הילד/ה..."
              rows={2}
            />
          </div>

          {/* Behavior goals */}
          <div className="bb-settings-group">
            <label>מטרות התנהגותיות (אופציונלי)</label>
            <textarea
              className="bb-textarea"
              value={settings.behaviorGoals}
              onChange={(e) => onChange({ behaviorGoals: e.target.value })}
              placeholder="מהן המטרות ההתנהגותיות?"
              rows={2}
            />
          </div>

          {/* Toggles */}
          <div className="bb-settings-group bb-toggle-row">
            <label>דינו חבר מדבר</label>
            <button
              type="button"
              className={`bb-toggle ${settings.showDino ? 'active' : ''}`}
              onClick={() => onChange({ showDino: !settings.showDino })}
            >
              {settings.showDino ? 'מופעל' : 'כבוי'}
            </button>
          </div>

          <div className="bb-settings-group bb-toggle-row">
            <label>צלילים</label>
            <button
              type="button"
              className={`bb-toggle ${settings.soundsEnabled ? 'active' : ''}`}
              onClick={() => onChange({ soundsEnabled: !settings.soundsEnabled })}
            >
              {settings.soundsEnabled ? 'מופעל' : 'כבוי'}
            </button>
          </div>

          {/* PIN */}
          <div className="bb-settings-group">
            <label>קוד PIN לעריכה</label>
            <input
              type="text"
              className="bb-input bb-input-small"
              value={settings.builderPin}
              onChange={(e) => onChange({ builderPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              maxLength={4}
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
