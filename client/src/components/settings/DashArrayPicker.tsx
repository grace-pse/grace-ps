interface DashArrayPickerProps {
  value: string | null;
  onChange: (next: string | null) => void;
}

const OPTIONS: { label: string; value: string | null; preview: string | undefined }[] = [
  { label: 'Solid',  value: null,  preview: undefined },
  { label: 'Dashed', value: '4 3', preview: '4 3' },
  { label: 'Dotted', value: '1 2', preview: '1 2' },
];

export function DashArrayPicker({ value, onChange }: DashArrayPickerProps) {
  return (
    <div className="inline-flex items-center gap-1">
      {OPTIONS.map((opt) => {
        const active = (opt.value ?? '') === (value ?? '');
        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'inline-flex items-center gap-1.5 h-7 px-2 rounded-r1 border text-[11px]',
              active ? 'bg-a-50 border-a-500 text-a-700' : 'bg-white border-n-200 text-n-700 hover:bg-n-50',
            ].join(' ')}
          >
            <svg width="32" height="6" viewBox="0 0 32 6">
              <line
                x1="0" y1="3" x2="32" y2="3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray={opt.preview}
              />
            </svg>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
