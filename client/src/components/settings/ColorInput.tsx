import { useEffect, useState } from 'react';

interface ColorInputProps {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  className?: string;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function ColorInput({ value, onChange, label, className = '' }: ColorInputProps) {
  const [text, setText] = useState(value);

  useEffect(() => { setText(value); }, [value]);

  const valid = HEX_RE.test(text);

  function commit(next: string) {
    if (HEX_RE.test(next)) onChange(next);
  }

  return (
    <label className={['inline-flex items-center gap-1.5', className].join(' ')}>
      {label && (
        <span className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">{label}</span>
      )}
      <input
        type="color"
        value={valid ? text : value}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          onChange(v);
        }}
        className="w-7 h-7 rounded-r1 border border-n-200 cursor-pointer p-0"
        aria-label={label ?? 'color'}
      />
      <input
        type="text"
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          commit(v);
        }}
        onBlur={() => { if (!valid) setText(value); }}
        className={[
          'w-[88px] h-7 px-2 border rounded-r1 text-[11.5px] font-mono uppercase tracking-[0.4px]',
          'focus:ring-2 focus:ring-a-100 outline-none',
          valid ? 'border-n-200 text-n-800' : 'border-bad/50 text-bad',
        ].join(' ')}
        placeholder="#RRGGBB"
        spellCheck={false}
      />
    </label>
  );
}
