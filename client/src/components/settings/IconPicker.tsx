import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { LUCIDE_ICON_WHITELIST, isKnownIcon, resolveIcon } from '../../lib/appearance-defaults';

interface IconPickerProps {
  value: string;
  onChange: (name: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setText(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const Current = resolveIcon(value);
  const known = isKnownIcon(text);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-7 px-2 border border-n-200 rounded-r1 bg-white hover:bg-n-50 text-[11.5px] text-n-800"
      >
        <Current className="w-3.5 h-3.5" />
        <span className="font-mono">{value}</span>
        <ChevronDown className="w-3 h-3 text-n-500" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-[280px] bg-white border border-n-200 rounded-r2 shadow-sh3 p-2">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {LUCIDE_ICON_WHITELIST.map((entry) => {
              const Ic = entry.component;
              const selected = entry.name === value;
              return (
                <button
                  key={entry.name}
                  type="button"
                  onClick={() => { onChange(entry.name); setText(entry.name); setOpen(false); }}
                  className={[
                    'w-9 h-9 grid place-items-center rounded-r1 border',
                    selected
                      ? 'bg-a-50 border-a-500 text-a-700'
                      : 'bg-white border-n-150 text-n-700 hover:bg-n-50',
                  ].join(' ')}
                  title={entry.name}
                >
                  <Ic className="w-4 h-4" />
                </button>
              );
            })}
          </div>
          <div className="border-t border-n-150 pt-2">
            <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
              Custom Lucide icon name
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="ShieldAlert"
                className="flex-1 h-7 px-2 border border-n-200 rounded-r1 text-[11.5px] font-mono"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => { onChange(text); setOpen(false); }}
                className="h-7 px-2 text-[11.5px] bg-a-500 text-white rounded-r1 hover:bg-a-600"
              >
                Use
              </button>
            </div>
            {!known && text && (
              <div className="text-[10.5px] text-warn mt-1">
                "{text}" not in the curated list — will fall back to a generic box if unknown.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
