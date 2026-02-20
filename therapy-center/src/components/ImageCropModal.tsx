import { useRef, useState, useCallback } from 'react';

interface CropState {
  x: number;
  y: number;
  size: number;
  isDragging: boolean;
  isResizing: boolean;
  resizeHandle: string | null;
  startMouseX: number;
  startMouseY: number;
  startSize: number;
  startCropX: number;
  startCropY: number;
}

interface Props {
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

export default function ImageCropModal({ onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cs = useRef<CropState>({
    x: 0, y: 0, size: 100,
    isDragging: false, isResizing: false, resizeHandle: null,
    startMouseX: 0, startMouseY: 0, startSize: 0, startCropX: 0, startCropY: 0,
  });

  const [hasImage, setHasImage] = useState(false);
  // canvasDim: explicit pixel size for both canvas attribute and CSS (no auto-scaling)
  const [canvasDim, setCanvasDim] = useState({ w: 400, h: 300 });
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, size: 100 });

  // ---- File loading ----
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.target.value = ''; // allow re-selecting same file

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        // Scale image to fit in available space (max 480px)
        const maxW = Math.min(window.innerWidth - 80, 480);
        const maxH = Math.min(window.innerHeight - 260, 480);
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        // Draw to canvas
        const canvas = canvasRef.current!;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        setCanvasDim({ w, h });
        // Initial crop box: centered, 70% of smaller dim
        const cropSize = Math.round(Math.min(w, h) * 0.7);
        const state = cs.current;
        state.x = Math.round((w - cropSize) / 2);
        state.y = Math.round((h - cropSize) / 2);
        state.size = cropSize;
        setCropBox({ x: state.x, y: state.y, size: cropSize });
        setHasImage(true);
      };
      img.src = ev.target!.result as string;
    };
    reader.readAsDataURL(file);
  };

  // ---- Coordinate helper ----
  // Since canvas CSS size = canvas pixel size, no scaling needed
  const getCanvasPos = (e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e ? e.touches[0] : e;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  // ---- Drag ----
  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const state = cs.current;
    const pos = getCanvasPos(e.nativeEvent as MouseEvent | TouchEvent);
    state.isDragging = true;
    state.startMouseX = pos.x - state.x;
    state.startMouseY = pos.y - state.y;
  };

  // ---- Resize ----
  const startResize = (e: React.MouseEvent | React.TouchEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    const state = cs.current;
    const pos = getCanvasPos(e.nativeEvent as MouseEvent | TouchEvent);
    state.isResizing = true;
    state.resizeHandle = handle;
    state.startMouseX = pos.x;
    state.startMouseY = pos.y;
    state.startSize = state.size;
    state.startCropX = state.x;
    state.startCropY = state.y;
  };

  // ---- Move (runs on container div) ----
  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const state = cs.current;
    const canvas = canvasRef.current;
    if (!canvas || (!state.isDragging && !state.isResizing)) return;

    const pos = getCanvasPos(e.nativeEvent as MouseEvent | TouchEvent);
    const minSize = 50;
    const W = canvas.width;
    const H = canvas.height;

    if (state.isDragging) {
      let nx = pos.x - state.startMouseX;
      let ny = pos.y - state.startMouseY;
      nx = Math.max(0, Math.min(nx, W - state.size));
      ny = Math.max(0, Math.min(ny, H - state.size));
      state.x = nx;
      state.y = ny;
    } else {
      const dx = pos.x - state.startMouseX;
      const dy = pos.y - state.startMouseY;
      const handle = state.resizeHandle!;
      let newSize = state.startSize;
      let newX = state.startCropX;
      let newY = state.startCropY;

      if (handle === 'se') {
        newSize = Math.max(minSize, state.startSize + Math.max(dx, dy));
      } else if (handle === 'sw') {
        newSize = Math.max(minSize, state.startSize - Math.min(dx, -dy));
        newX = state.startCropX + state.startSize - newSize;
      } else if (handle === 'ne') {
        newSize = Math.max(minSize, state.startSize + Math.max(dx, -dy));
        newY = state.startCropY + state.startSize - newSize;
      } else if (handle === 'nw') {
        newSize = Math.max(minSize, state.startSize - Math.max(dx, dy));
        newX = state.startCropX + state.startSize - newSize;
        newY = state.startCropY + state.startSize - newSize;
      }
      // Clamp
      newSize = Math.min(newSize, W - Math.max(0, newX), H - Math.max(0, newY));
      newX = Math.max(0, Math.min(newX, W - minSize));
      newY = Math.max(0, Math.min(newY, H - minSize));
      state.x = newX;
      state.y = newY;
      state.size = newSize;
    }
    setCropBox({ x: state.x, y: state.y, size: state.size });
  }, []);

  const stopMove = useCallback(() => {
    cs.current.isDragging = false;
    cs.current.isResizing = false;
    cs.current.resizeHandle = null;
  }, []);

  // ---- Apply crop & export ----
  const applyCrop = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const state = cs.current;
    const scaleX = img.width / canvas.width;
    const scaleY = img.height / canvas.height;

    const tmp = document.createElement('canvas');
    tmp.width = 200;
    tmp.height = 200;
    const ctx = tmp.getContext('2d')!;
    ctx.drawImage(
      img,
      state.x * scaleX, state.y * scaleY,
      state.size * scaleX, state.size * scaleY,
      0, 0, 200, 200
    );
    const pixels = ctx.getImageData(0, 0, 200, 200);
    let hasAlpha = false;
    for (let i = 3; i < pixels.data.length; i += 4) {
      if (pixels.data[i] < 255) { hasAlpha = true; break; }
    }
    const dataUrl = hasAlpha ? tmp.toDataURL('image/png') : tmp.toDataURL('image/jpeg', 0.85);
    onSave(dataUrl);
  };

  const HANDLE_SIZE = 18;
  const HALF = HANDLE_SIZE / 2;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: '560px', padding: 0, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
        onMouseMove={handleMove}
        onMouseUp={stopMove}
        onMouseLeave={stopMove}
        onTouchMove={handleMove}
        onTouchEnd={stopMove}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1em', color: '#2d3748' }}>העלאת תמונת פרופיל</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4em', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {!hasImage && (
            <div style={{ padding: '40px 0' }}>
              <p style={{ color: '#64748b', marginBottom: '16px' }}>בחר תמונה מהמכשיר</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                📤 בחר תמונה
              </button>
            </div>
          )}

          {/* Canvas area — always mounted so canvasRef is never null when img.onload fires */}
          <div style={{ display: hasImage ? 'block' : 'none' }}>
            <p style={{ color: '#64748b', fontSize: '0.85em', marginBottom: '10px' }}>
              גרור את המסגרת ← חתוך, גרור פינה ← שנה גודל
            </p>
            {/* Canvas + overlay container — exact same CSS size as canvas */}
            <div
              style={{
                position: 'relative',
                display: 'inline-block',
                width: `${canvasDim.w}px`,
                height: `${canvasDim.h}px`,
                maxWidth: '100%',
                cursor: 'crosshair',
              }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  display: 'block',
                  width: `${canvasDim.w}px`,
                  height: `${canvasDim.h}px`,
                  borderRadius: '6px',
                }}
              />

              {/* Dark overlay: 4 rectangles outside crop box */}
              {/* Top */}
              <div style={{ position: 'absolute', pointerEvents: 'none', top: 0, left: 0, right: 0, height: `${cropBox.y}px`, background: 'rgba(0,0,0,0.5)' }} />
              {/* Bottom */}
              <div style={{ position: 'absolute', pointerEvents: 'none', top: `${cropBox.y + cropBox.size}px`, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)' }} />
              {/* Left */}
              <div style={{ position: 'absolute', pointerEvents: 'none', top: `${cropBox.y}px`, left: 0, width: `${cropBox.x}px`, height: `${cropBox.size}px`, background: 'rgba(0,0,0,0.5)' }} />
              {/* Right */}
              <div style={{ position: 'absolute', pointerEvents: 'none', top: `${cropBox.y}px`, left: `${cropBox.x + cropBox.size}px`, right: 0, height: `${cropBox.size}px`, background: 'rgba(0,0,0,0.5)' }} />

              {/* Crop box */}
              <div
                style={{
                  position: 'absolute',
                  left: `${cropBox.x}px`,
                  top: `${cropBox.y}px`,
                  width: `${cropBox.size}px`,
                  height: `${cropBox.size}px`,
                  border: '3px solid #ffd700',
                  cursor: 'move',
                  boxSizing: 'border-box',
                }}
                onMouseDown={startDrag}
                onTouchStart={startDrag}
              >
                {/* 4 resize handles */}
                {(['nw', 'ne', 'sw', 'se'] as const).map((dir) => (
                  <div
                    key={dir}
                    style={{
                      position: 'absolute',
                      width: `${HANDLE_SIZE}px`,
                      height: `${HANDLE_SIZE}px`,
                      background: '#ffd700',
                      border: '2px solid white',
                      borderRadius: '50%',
                      cursor: `${dir}-resize`,
                      ...(dir.includes('n') ? { top: `-${HALF}px` } : { bottom: `-${HALF}px` }),
                      ...(dir.includes('w') ? { left: `-${HALF}px` } : { right: `-${HALF}px` }),
                    }}
                    onMouseDown={(e) => startResize(e, dir)}
                    onTouchStart={(e) => startResize(e, dir)}
                  />
                ))}
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                style={{ fontSize: '0.8em', color: '#667eea', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => { setHasImage(false); fileInputRef.current?.click(); }}
              >
                בחר תמונה אחרת
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 20px', display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
          {hasImage && (
            <button type="button" className="btn-primary" onClick={applyCrop}>✂️ שמור תמונה</button>
          )}
        </div>
      </div>
    </div>
  );
}
