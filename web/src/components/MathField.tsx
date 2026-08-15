import { useRef, useState } from 'react';
import { MathText } from './MathText';

const TOMBOL: { lab: string; ins: string }[] = [
  { lab: 'a/b', ins: '$\\frac{a}{b}$' },
  { lab: '√', ins: '$\\sqrt{x}$' },
  { lab: 'xⁿ', ins: '$x^{n}$' },
  { lab: 'xₙ', ins: '$x_{n}$' },
  { lab: '≤', ins: '$\\leq$' },
  { lab: '≥', ins: '$\\geq$' },
  { lab: '≠', ins: '$\\neq$' },
  { lab: '±', ins: '$\\pm$' },
  { lab: '·', ins: '$\\cdot$' },
  { lab: 'π', ins: '$\\pi$' },
  { lab: 'θ', ins: '$\\theta$' },
  { lab: 'Σ', ins: '$\\sum$' },
  { lab: '∫', ins: '$\\int$' },
  { lab: '( )', ins: '$\\left(\\right)$' },
];

export function MathField({
  label,
  value,
  onChange,
  rows,
  required,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  required?: boolean;
  prefix?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  function sisip(s: string) {
    const el = ref.current;

    if (!el) {
      onChange(value + s);
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;

    const next = value.slice(0, start) + s + value.slice(end);

    onChange(next);

    requestAnimationFrame(() => {
      el.focus();

      const pos = start + s.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const multiline = Boolean(rows && rows > 1);

  return (
    <div className="math-field">
      <div className="math-field-head">
        {prefix ? (
          <span className="math-field-pref">{prefix}</span>
        ) : null}

        <span className="math-field-lab">
          {label}
        </span>

        <button
          type="button"
          className="math-field-tog"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Tutup rumus' : 'Rumus'}
        </button>
      </div>

      {open && (
        <div className="eq-bar">
          {TOMBOL.map((t) => (
            <button
              key={t.lab}
              type="button"
              className="eq-btn"
              onClick={() => sisip(t.ins)}
            >
              {t.lab}
            </button>
          ))}

          <p
            className="type-lab"
            style={{
              width: '100%',
              margin: '4px 0 0',
            }}
          >
            Rumus di antara tanda $ · contoh $x^2+1$
          </p>
        </div>
      )}

      {multiline ? (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          className="sel-input math-field-textarea"
          rows={rows}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            label.toLowerCase().includes('pertanyaan') ||
            label.toLowerCase().includes('stimulus')
              ? 'Tulis stimulus atau pertanyaan. Tekan Enter untuk baris baru, Enter dua kali untuk paragraf baru.'
              : undefined
          }
        />
      ) : (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          className="sel-input"
          type="text"
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {value.trim() ? (
        <div className="eq-preview">
          <span className="type-lab">Pratinjau</span>

          <MathText text={value} />
        </div>
      ) : null}
    </div>
  );
}