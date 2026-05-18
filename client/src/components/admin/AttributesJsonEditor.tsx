import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface AttributesJsonEditorProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

type Row = { key: string; value: string };

function toRows(v: Record<string, unknown>): Row[] {
  return Object.entries(v).map(([key, val]) => ({
    key,
    value: typeof val === 'string' ? val : JSON.stringify(val),
  }));
}

function fromRows(rows: Row[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    if (!r.key.trim()) continue;
    const raw = r.value;
    let parsed: unknown = raw;
    // Treat strings that look like JSON as parsed JSON, else keep as string.
    if (raw !== '' && /^[\[\{"]|^(true|false|null|-?\d)/.test(raw)) {
      try { parsed = JSON.parse(raw); } catch { parsed = raw; }
    }
    out[r.key.trim()] = parsed;
  }
  return out;
}

export function AttributesJsonEditor({ value, onChange }: AttributesJsonEditorProps) {
  const [rows, setRows] = useState<Row[]>(() => toRows(value));

  function update(next: Row[]) {
    setRows(next);
    onChange(fromRows(next));
  }

  return (
    <div className="space-y-1.5">
      {rows.length === 0 && (
        <div className="text-[11px] text-n-500 italic">
          No custom attributes. Add keys for vendor-specific metadata.
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={r.key}
            onChange={(e) => {
              const next = rows.slice();
              next[i] = { ...r, key: e.target.value };
              update(next);
            }}
            placeholder="key"
            className="w-[140px] h-8 px-2 text-[12px] border border-n-200 rounded-r2 font-mono focus:border-a-500 focus:outline-none"
          />
          <input
            value={r.value}
            onChange={(e) => {
              const next = rows.slice();
              next[i] = { ...r, value: e.target.value };
              update(next);
            }}
            placeholder='value (string, number, true/false, or JSON)'
            className="flex-1 h-8 px-2 text-[12px] border border-n-200 rounded-r2 font-mono focus:border-a-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => update(rows.filter((_, j) => j !== i))}
            className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
            aria-label="Remove row"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => update([...rows, { key: '', value: '' }])}
        className="inline-flex items-center gap-1 text-[11.5px] text-a-700 hover:text-a-800"
      >
        <Plus className="w-3.5 h-3.5" /> Add attribute
      </button>
    </div>
  );
}
