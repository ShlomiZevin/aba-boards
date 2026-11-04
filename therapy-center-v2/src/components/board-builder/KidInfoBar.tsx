import { useRef } from 'react';
import type { KidInfo } from '../../hooks/useBoardState';
import type { ColorSchema } from '../../types';

interface KidInfoBarProps {
  kidInfo: KidInfo;
  colorSchema: ColorSchema;
  onChange: (changes: Partial<KidInfo>) => void;
  onColorChange: (schema: ColorSchema) => void;
  isNew: boolean;
  onSettingsClick: () => void;
}

const COLOR_SCHEMES: { value: ColorSchema; colors: [string, string] }[] = [
  { value: 'purple', colors: ['#A8D5E5', '#89C4B8'] },
  { value: 'pink', colors: ['#F5C6AA', '#E8A07E'] },
  { value: 'blue', colors: ['#B8D4E8', '#C5B8E8'] },
  { value: 'dark', colors: ['#3D5A6C', '#2C4A52'] },
];

export default function KidInfoBar({ kidInfo, colorSchema, onChange, onColorChange, isNew, onSettingsClick }: KidInfoBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d')!;
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
        onChange({ imageName: canvas.toDataURL('image/jpeg', 0.8) });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const age = Number(kidInfo.age) || 0;

  return (
    <div className="bb-kid-bar">
      <div className="bb-kid-bar-main">
        {/* Photo */}
        <div className="bb-kid-photo" onClick={() => fileRef.current?.click()}>
          {kidInfo.imageName ? (
            <img src={kidInfo.imageName} alt="" />
          ) : (
            <span className="bb-kid-photo-placeholder">{kidInfo.gender === 'girl' ? '👧' : '👦'}</span>
          )}
          <div className="bb-kid-photo-overlay">📷</div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
        </div>

        {/* Name */}
        <div className="bb-kid-name-area">
          {isNew ? (
            <input
              type="text"
              className="bb-kid-name"
              placeholder="שם הילד/ה..."
              value={kidInfo.name}
              onChange={(e) => onChange({ name: e.target.value })}
              autoFocus
            />
          ) : (
            <div className="bb-kid-name bb-kid-name-display">{kidInfo.name}</div>
          )}
        </div>

        {/* Age stepper */}
        <div className="bb-age-stepper">
          <button
            className="bb-age-btn"
            onClick={() => age > 1 && onChange({ age: String(age - 1) })}
            disabled={age <= 1}
          >−</button>
          <span className="bb-age-value">{age || '—'}</span>
          <button
            className="bb-age-btn"
            onClick={() => onChange({ age: String(age + 1) })}
            disabled={age >= 18}
          >+</button>
          <span className="bb-age-label">שנים</span>
        </div>

        {/* Gender pills */}
        <div className="bb-gender-pills">
          <button
            className={`bb-gender-pill ${kidInfo.gender === 'boy' ? 'active' : ''}`}
            onClick={() => onChange({ gender: 'boy' })}
          >👦 בן</button>
          <button
            className={`bb-gender-pill ${kidInfo.gender === 'girl' ? 'active' : ''}`}
            onClick={() => onChange({ gender: 'girl' })}
          >👧 בת</button>
        </div>

        {/* Settings */}
        <button className="bb-gear-btn" onClick={onSettingsClick} title="הגדרות">⚙️</button>
      </div>

      {/* Color scheme quick-switch */}
      <div className="bb-color-row">
        {COLOR_SCHEMES.map((s) => (
          <button
            key={s.value}
            className={`bb-color-chip ${colorSchema === s.value ? 'active' : ''}`}
            style={{ background: `linear-gradient(135deg, ${s.colors[0]}, ${s.colors[1]})` }}
            onClick={() => onColorChange(s.value)}
          />
        ))}
      </div>
    </div>
  );
}
