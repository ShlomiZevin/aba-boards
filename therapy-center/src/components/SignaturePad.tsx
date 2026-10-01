import { useCallback, useEffect, useRef, useState } from 'react';

// A drawn-signature pad. Pointer events cover mouse, touch and stylus with one
// code path; `touch-action: none` on the canvas is what stops a finger stroke
// from scrolling the page instead of drawing.

const LOGICAL_WIDTH = 600;
const LOGICAL_HEIGHT = 200;

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
  /** Drawn on mount, so a signer can see what they signed before re-drawing. */
  initialImage?: string | null;
  disabled?: boolean;
}

export default function SignaturePad({ onChange, initialImage, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(!initialImage);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a202c';
    return ctx;
  }, []);

  // Size the backing store to the device pixel ratio so strokes are not blurry,
  // then work in logical coordinates for everything else.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = LOGICAL_WIDTH * ratio;
    canvas.height = LOGICAL_HEIGHT * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    if (initialImage) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      img.src = initialImage;
    }
  }, [initialImage]);

  /** Canvas coordinates in the logical space, whatever the CSS size is. */
  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * LOGICAL_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * LOGICAL_HEIGHT,
    };
  };

  const emit = () => {
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL('image/png'));
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPoint.current = pointFrom(e);
    // A tap with no movement should still leave a mark.
    const ctx = getCtx();
    const p = lastPoint.current;
    if (ctx && p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.25, 0, Math.PI * 2);
      ctx.fillStyle = '#1a202c';
      ctx.fill();
    }
    setIsEmpty(false);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !drawing.current) return;
    e.preventDefault();
    const ctx = getCtx();
    const from = lastPoint.current;
    const to = pointFrom(e);
    if (!ctx || !from) return;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    lastPoint.current = to;
  };

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    drawing.current = false;
    lastPoint.current = null;
    emit();
  };

  const clear = () => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    setIsEmpty(true);
    onChange(null);
  };

  return (
    <div className="signature-pad">
      <canvas
        ref={canvasRef}
        className="signature-pad-canvas"
        style={{ touchAction: 'none', cursor: disabled ? 'not-allowed' : 'crosshair' }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onPointerLeave={handleUp}
      />
      <div className="signature-pad-footer">
        <span className="signature-pad-hint">
          {isEmpty ? 'חתמו כאן באצבע או בעכבר' : 'ניתן לנקות ולחתום מחדש'}
        </span>
        <button type="button" onClick={clear} className="btn-secondary btn-small" disabled={disabled}>
          נקה
        </button>
      </div>
    </div>
  );
}
