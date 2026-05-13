import { COMPLIANCE_TAGS, COMPLIANCE_TAG_LABEL, type ComplianceTag } from '../../lib/csmp-types';

interface TagMultiSelectProps {
  value: ComplianceTag[];
  onChange: (next: ComplianceTag[]) => void;
  disabled?: boolean;
  label?: string;
}

export function TagMultiSelect({ value, onChange, disabled, label = 'Compliance tags' }: TagMultiSelectProps) {
  const selected = new Set(value);

  function toggle(tag: ComplianceTag) {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    onChange(COMPLIANCE_TAGS.filter((t) => next.has(t)));
  }

  return (
    <div>
      <div className="text-[11px] font-medium text-n-600 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {COMPLIANCE_TAGS.map((tag) => {
          const on = selected.has(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              disabled={disabled}
              className={[
                'inline-flex items-center gap-1 text-[11px] font-medium rounded-[3px] px-2 py-0.5 border transition-colors',
                on
                  ? 'bg-a-50 text-a-700 border-a-200 hover:bg-a-100'
                  : 'bg-white text-n-600 border-n-200 hover:bg-n-50',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              <span
                className={[
                  'w-2.5 h-2.5 rounded-[2px] border flex items-center justify-center',
                  on ? 'bg-a-600 border-a-600' : 'border-n-300',
                ].join(' ')}
              >
                {on ? (
                  <svg viewBox="0 0 10 10" className="w-2 h-2 fill-white">
                    <path d="M1.5 5.2 L4 7.5 L8.5 2.5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              {COMPLIANCE_TAG_LABEL[tag]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
