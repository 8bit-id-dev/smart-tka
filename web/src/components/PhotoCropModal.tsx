import { useRef, useState } from 'react';

const VP = 240;
const OUT = 512;

export function PhotoCropModal({
  src,
  onCancel,
  onSave,
}: {
  src: string;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1.2);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [coverScale, setCoverScale] = useState(1);
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  function onImgLoad() {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    const cs = Math.max(VP / img.naturalWidth, VP / img.naturalHeight);
    setCoverScale(cs);
    setScale(cs * 1.15);
    setPos({ x: 0, y: 0 });
  }

  function clampPos(x: number, y: number) {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const dispW = img.naturalWidth * scale;
    const dispH = img.naturalHeight * scale;
    const mx = Math.max((dispW - VP) / 2, 0);
    const my = Math.max((dispH - VP) / 2, 0);
    return { x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setPos(clampPos(d.px + (e.clientX - d.sx), d.py + (e.clientY - d.sy)));
  }

  function endDrag() {
    dragRef.current = null;
  }

  function changeScale(next: number) {
    setScale(Math.min(3, Math.max(coverScale, next)));
    setPos((p) => clampPos(p.x, p.y));
  }

  function save() {
    const img = imgRef.current;
    if (!img || saving) return;
    setSaving(true);
    const dispW = img.naturalWidth * scale;
    const dispH = img.naturalHeight * scale;
    const winX = (dispW - VP) / 2 - pos.x;
    const winY = (dispH - VP) / 2 - pos.y;
    const sx = (winX / dispW) * img.naturalWidth;
    const sy = (winY / dispH) * img.naturalHeight;
    const sw = (VP / dispW) * img.naturalWidth;
    const sh = (VP / dispH) * img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setSaving(false);
      return;
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT, OUT);
    canvas.toBlob((blob) => {
      setSaving(false);
      if (blob) onSave(blob);
    }, 'image/jpeg', 0.92);
  }

  return (
    <div className="crop-backdrop" onClick={onCancel}>
      <div className="crop-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="crop-title">Atur Foto Profil</h3>
        <div className="crop-viewport">
          <img
            ref={imgRef}
            src={src}
            alt="Pratinjau foto"
            draggable={false}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLoad={onImgLoad}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) scale(${scale})`,
              maxWidth: 'none',
              maxHeight: 'none',
              cursor: 'grab',
              touchAction: 'none',
              userSelect: 'none',
            }}
          />
        </div>
        <div className="crop-zoom">
          <span aria-hidden>−</span>
          <input
            type="range"
            min={coverScale}
            max={3}
            step={0.05}
            value={scale}
            onChange={(e) => changeScale(Number(e.target.value))}
            aria-label="Perbesar"
          />
          <span aria-hidden>+</span>
        </div>
        <div className="crop-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Batal
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
