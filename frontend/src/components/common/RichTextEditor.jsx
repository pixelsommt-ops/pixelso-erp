import { useEffect, useRef } from 'react';

// Editor rich text ringan untuk deskripsi produk - contentEditable + document.execCommand,
// bukan library besar (Quill/TipTap) karena cuma butuh 6 command dasar. Simpan sebagai string
// HTML (disanitasi ulang di server, lihat common/utils/htmlSanitize.js).
const COMMANDS = [
  { command: 'bold', label: 'B', title: 'Tebal', style: { fontWeight: 800 } },
  { command: 'italic', label: 'I', title: 'Miring', style: { fontStyle: 'italic' } },
  { command: 'underline', label: 'U', title: 'Garis bawah', style: { textDecoration: 'underline' } },
  { command: 'strikeThrough', label: 'S', title: 'Coret', style: { textDecoration: 'line-through' } },
  { command: 'insertUnorderedList', label: '•', title: 'Poin-poin' },
  { command: 'insertOrderedList', label: '1.', title: 'Penomoran' },
];

export default function RichTextEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);

  // Sinkron nilai luar -> DOM cuma saat beda (hindari kursor loncat ke awal tiap ketik).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  const exec = (command) => {
    ref.current?.focus();
    document.execCommand(command);
    onChange(ref.current?.innerHTML || '');
  };

  return (
    <div>
      <div className="btn-group" style={{ marginBottom: '0.4rem', flexWrap: 'wrap' }}>
        {COMMANDS.map((c) => (
          <button
            key={c.command}
            type="button"
            className="btn btn-sm"
            title={c.title}
            style={c.style}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(c.command)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        className="rich-text-editor"
        style={{
          minHeight: 90,
          border: '1px solid var(--color-border, #ddd)',
          borderRadius: 8,
          padding: '0.6rem 0.75rem',
          fontSize: '0.92rem',
        }}
      />
    </div>
  );
}
