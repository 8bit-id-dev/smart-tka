import { useState } from 'react';

export type FilterOption = { value: string; label: string; sub?: string };

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  minWidth = 170,
}: {
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
  placeholder: string;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <div className="pkg-filter" style={{ minWidth }}>
      <button
        type="button"
        className="filter-select pkg-dropdown-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="pkg-dropdown-value">{current ? current.label : placeholder}</span>
        <span className="pkg-dropdown-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <>
          <div className="pkg-dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="pkg-dropdown">
            <button
              type="button"
              className={`pkg-dropdown-item ${value === '' ? 'on' : ''}`}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              <span className="pkg-dropdown-title">{placeholder}</span>
            </button>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`pkg-dropdown-item ${value === o.value ? 'on' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span className="pkg-dropdown-title">{o.label}</span>
                {o.sub && <span className="pkg-dropdown-mapel">{o.sub}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
