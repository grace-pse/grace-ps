// Renders custom fields defined by enabled packages on the asset form.
// Reads schema from /assets/custom-field-schema (parent fetches it once on
// mount), values from `value` (parent owns state), emits via `onChange`.
//
// Storage shape on Asset.metadata: { customFields: { [packageSlug]: { [fieldKey]: value } } }.
// Namespacing by package slug avoids collisions when two packages define the
// same key, and reserves a clean fence so engine-set metadata keys never
// collide with user inputs.

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AssetCustomFieldSchemaResponse, AssetCustomFieldRenderDef } from '../lib/csmp-api';

export type CustomFieldsValue = Record<string, Record<string, unknown>>;

interface Props {
  schema: AssetCustomFieldSchemaResponse;
  value: CustomFieldsValue;
  onChange: (next: CustomFieldsValue) => void;
  // Errors keyed as `${packageSlug}.${fieldKey}`. Parent computes these on
  // submit and re-renders to highlight blanks; the section itself only
  // shows them, doesn't compute them.
  errors?: Record<string, string>;
}

export function CustomFieldsSection({ schema, value, onChange, errors }: Props) {
  // Default-expanded; sections are short and the user is filling them in.
  // We track collapse state per package only.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (schema.packages.length === 0) return null;

  function setFieldValue(packageSlug: string, key: string, v: unknown) {
    const pkgVals = { ...(value[packageSlug] ?? {}) };
    pkgVals[key] = v;
    onChange({ ...value, [packageSlug]: pkgVals });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-a-500" aria-hidden />
        <span className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">
          Custom fields
        </span>
      </div>
      {schema.packages.map((pkg) => {
        const isCollapsed = !!collapsed[pkg.slug];
        const pkgVals = value[pkg.slug] ?? {};
        return (
          <div key={pkg.slug} className="border border-n-200 rounded-r2 bg-white">
            <button
              type="button"
              onClick={() => setCollapsed({ ...collapsed, [pkg.slug]: !isCollapsed })}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-n-50 rounded-r2"
            >
              <div className="flex items-center gap-1.5">
                {isCollapsed
                  ? <ChevronRight className="w-3.5 h-3.5 text-n-500" />
                  : <ChevronDown className="w-3.5 h-3.5 text-n-500" />}
                <span className="text-[12.5px] font-medium text-n-900">{pkg.name}</span>
                <span className="text-[10.5px] font-mono text-n-500 tracking-[0.4px]">
                  {pkg.fields.length} field{pkg.fields.length === 1 ? '' : 's'}
                </span>
              </div>
            </button>
            {!isCollapsed && (
              <div className="border-t border-n-150 px-3 py-2.5 space-y-2.5">
                {pkg.fields.map((field) => (
                  <CustomFieldRow
                    key={field.key}
                    field={field}
                    value={pkgVals[field.key]}
                    onChange={(v) => setFieldValue(pkg.slug, field.key, v)}
                    error={errors?.[`${pkg.slug}.${field.key}`]}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CustomFieldRow({
  field, value, onChange, error,
}: {
  field: AssetCustomFieldRenderDef;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
}) {
  const labelEl = (
    <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
      {field.label}
      {field.required && <span className="text-bad ml-1">*</span>}
    </span>
  );

  let input: React.ReactNode;
  switch (field.type) {
    case 'text':
      input = (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
        />
      );
      break;
    case 'number':
      input = (
        <input
          type="number"
          value={typeof value === 'number' ? value : (typeof value === 'string' ? value : '')}
          onChange={(e) => {
            const raw = e.target.value;
            // Empty input clears the value rather than coercing to 0 — keeps
            // "unfilled" distinguishable from "explicitly zero".
            onChange(raw === '' ? null : Number(raw));
          }}
          className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
        />
      );
      break;
    case 'select':
      input = (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
        >
          <option value="">— select —</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
      break;
    case 'date':
      input = (
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
        />
      );
      break;
    case 'boolean':
      input = (
        <label className="flex items-center gap-2 text-[13px] text-n-700">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          {field.helpText ?? 'Enable'}
        </label>
      );
      break;
  }

  return (
    <div>
      {field.type === 'boolean' ? null : labelEl}
      {field.type === 'boolean' ? (
        <>
          {labelEl}
          {input}
        </>
      ) : input}
      {/* Help text rendered under non-boolean inputs (boolean uses it as
          inline label per the case above). Keeps copy short and consistent
          with the rest of the asset form (10–11px helper text). */}
      {field.helpText && field.type !== 'boolean' && (
        <p className="text-[11px] text-n-500 mt-1">{field.helpText}</p>
      )}
      {error && (
        <p className="text-[11px] text-bad mt-1">{error}</p>
      )}
    </div>
  );
}
