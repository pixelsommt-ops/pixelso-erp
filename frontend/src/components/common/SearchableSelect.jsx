import { useEffect, useRef, useState } from 'react';

// Select biasa (native <select>) tidak menampilkan apa yang sedang diketik saat operator
// mencari di antara ribuan opsi (mis. daftar customer) - cuma diam-diam loncat ke opsi yang
// cocok. Komponen ini pakai <input> teks biasa (cursor kedip & teks ketikan kelihatan normal)
// plus daftar hasil filter di bawahnya.
export default function SearchableSelect({ options, value, onChange, placeholder = 'Cari...', required, disabled }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    if (!open) setQuery(selected ? selected.label : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selected?.label]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const selectOption = (opt) => {
    onChange(String(opt.value));
    setQuery(opt.label);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlight]) selectOption(filtered[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        required={required && !value}
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && (
        <div className="searchable-select-menu">
          {filtered.length === 0 && <div className="searchable-select-empty">Tidak ditemukan</div>}
          {filtered.map((opt, i) => (
            <div
              key={opt.value}
              className={`searchable-select-option${i === highlight ? ' active' : ''}${
                String(opt.value) === String(value) ? ' selected' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(opt);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
