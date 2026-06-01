import { useEffect, useRef, useState } from 'react';

const STORAGE_PREFIX = 'doing-slide-shot-';

interface Props {
  slideId: number;
}

export default function SlideShot({ slideId }: Props) {
  const key = `${STORAGE_PREFIX}${slideId}`;
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      setSrc(stored);
    } catch {
      // localStorage may be disabled (private mode etc.)
    }
    setError(null);
  }, [key]);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onerror = () => setError('שגיאה בקריאת הקובץ.');
    reader.onload = () => {
      const dataUrl = reader.result as string;
      try {
        localStorage.setItem(key, dataUrl);
        setSrc(dataUrl);
      } catch {
        setError('הקובץ גדול מדי לאחסון. נסה תמונה קטנה יותר (עד ~2MB) או JPEG.');
      }
    };
    reader.readAsDataURL(file);
  }

  function handleRemove() {
    try { localStorage.removeItem(key); } catch {}
    setSrc(null);
    setError(null);
  }

  return (
    <div className="sl-shot">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleSelect}
        style={{ display: 'none' }}
      />

      {src ? (
        <>
          <img src={src} alt="" className="sl-shot-img" />
          <div className="sl-shot-actions">
            <button type="button" onClick={() => inputRef.current?.click()} className="sl-shot-mini-btn">החלף</button>
            <button type="button" onClick={handleRemove} className="sl-shot-mini-btn">הסר</button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="sl-shot-empty">
          <span className="sl-shot-empty-icon">⤴</span>
          <span>העלה צילום מסך</span>
          <span className="sl-shot-empty-hint">היחס המקורי יישמר</span>
        </button>
      )}

      {error && <div className="sl-shot-error">{error}</div>}
    </div>
  );
}
