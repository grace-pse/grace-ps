// Structured editor for TemplatePackage.customFieldSchema. Each row defines
// one field that operators will fill in on the bound entity (asset, threat,
// etc.) — these are NOT the per-template `attributes` blob (opaque metadata
// for tooling), they are end-user inputs surfaced in the asset / threat /
// assessment forms.
//
// Stored shape: array of CustomFieldDef. Legacy packages may have null/{}
// — the parent normalizes those to [] before mounting this editor, so the
// component can assume a clean array.

import { useMemo, useState } from 'react';
import { Plus, X, GripVertical, AlertCircle } from 'lucide-react';
import {
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_APPLIES_TO,
  type CustomFieldDef,
  type CustomFieldType,
  type CustomFieldAppliesTo,
} from '../../lib/csmp-types';

interface Props {
  value: CustomFieldDef[];
  onChange: (next: CustomFieldDef[]) => void;
  disabled?: boolean;
}

const KEY_RE = /^[a-z][a-z0-9_]*$/;

function blankField(): CustomFieldDef {
  return {
    key: '',
    label: '',
    type: 'text',
    appliesTo: 'asset',
    required: false,
  };
}

// Per-row validation surfaces inline errors but doesn't block the parent
// save handler — that's the parent's job. The editor just refuses to add
// duplicate keys (which would silently overwrite values on save).
function rowError(row: CustomFieldDef, others: CustomFieldDef[]): string | null {
  if (!row.key.trim()) return 'key required';
  if (!KEY_RE.test(row.key)) return 'snake_case (start with a letter)';
  if (!row.label.trim()) return 'label required';
  if (row.type === 'select' && (!row.options || row.options.length === 0)) {
    return 'select needs at least one option';
  }
  if (others.some((o) => o.key === row.key)) return 'duplicate key';
  return null;
}

export function CustomFieldSchemaEditor({ value, onChange, disabled }: Props) {
  // Drag-reorder state. We use HTML5 drag with a single dragIndex marker so
  // we don't pull in a library; the editor is shallow (≤20 fields typical).
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [optionDraft, setOptionDraft] = useState<Record<number, string>>({});

  function update(next: CustomFieldDef[]) {
    // Recompute sortOrder so import/export round-trips preserve the user's
    // last reordering. The parent decides when to commit.
    onChange(next.map((f, i) => ({ ...f, sortOrder: i })));
  }

  function addField() {
    if (disabled) return;
    update([...value, blankField()]);
  }

  function deleteField(idx: number) {
    if (disabled) return;
    update(value.filter((_, i) => i !== idx));
  }

  function patchField(idx: number, patch: Partial<CustomFieldDef>) {
    if (disabled) return;
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch };
    update(next);
  }

  function addOption(idx: number) {
    if (disabled) return;
    const draft = (optionDraft[idx] ?? '').trim();
    if (!draft) return;
    const cur = value[idx].options ?? [];
    if (cur.includes(draft)) {
      setOptionDraft({ ...optionDraft, [idx]: '' });
      return;
    }
    patchField(idx, { options: [...cur, draft] });
    setOptionDraft({ ...optionDraft, [idx]: '' });
  }

  function removeOption(idx: number, opt: string) {
    if (disabled) return;
    const cur = value[idx].options ?? [];
    patchField(idx, { options: cur.filter((o) => o !== opt) });
  }

  // Drag-reorder handlers. We swap two rows on drop and clear the marker.
  function onDragStart(idx: number) {
    if (disabled) return;
    setDragIndex(idx);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDrop(targetIdx: number) {
    if (disabled || dragIndex === null || dragIndex === targetIdx) {
      setDragIndex(null);
      return;
    }
    const next = value.slice();
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIdx, 0, moved);
    setDragIndex(null);
    update(next);
  }

  const errors = useMemo(
    () => value.map((row, i) => rowError(row, value.filter((_, j) => i !== j))),
    [value],
  );

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <div className="text-[11.5px] text-n-500 italic border border-dashed border-n-200 rounded-r2 px-3 py-2.5 bg-n-50/40">
          No custom fields yet. Add fields that operators will fill in on assets,
          threats, or assessments.
        </div>
      )}
      {value.map((row, idx) => {
        const err = errors[idx];
        return (
          <div
            key={idx}
            draggable={!disabled}
            onDragStart={() => onDragStart(idx)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(idx)}
            className={
              'border border-n-200 rounded-r2 p-2.5 space-y-1.5 bg-white ' +
              (dragIndex === idx ? 'opacity-60' : '')
            }
          >
            <div className="flex items-center gap-2">
              <span
                className="text-n-400 cursor-grab shrink-0"
                title="Drag to reorder"
                aria-hidden
              >
                <GripVertical className="w-3.5 h-3.5" />
              </span>
              <input
                value={row.key}
                onChange={(e) => patchField(idx, { key: e.target.value })}
                disabled={disabled}
                placeholder="snake_case_key"
                className="w-[160px] h-8 px-2 text-[12.5px] font-mono border border-n-200 rounded-r1 focus:border-a-500 focus:outline-none disabled:bg-n-50"
                maxLength={64}
              />
              <input
                value={row.label}
                onChange={(e) => patchField(idx, { label: e.target.value })}
                disabled={disabled}
                placeholder="Display label"
                className="flex-1 h-8 px-2 text-[12.5px] border border-n-200 rounded-r1 focus:border-a-500 focus:outline-none disabled:bg-n-50"
                maxLength={120}
              />
              <button
                type="button"
                onClick={() => deleteField(idx)}
                disabled={disabled}
                className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-bad-bg hover:text-bad rounded-r1 disabled:opacity-40"
                aria-label="Remove field"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-12 gap-2 pl-5">
              <select
                value={row.type}
                onChange={(e) => {
                  const next = e.target.value as CustomFieldType;
                  // Switching to a non-select wipes options to keep the
                  // shape valid; other types ignore options.
                  patchField(idx, {
                    type: next,
                    options: next === 'select' ? row.options ?? [] : undefined,
                  });
                }}
                disabled={disabled}
                className="col-span-3 h-8 px-2 text-[12px] border border-n-200 rounded-r1 bg-white disabled:bg-n-50"
              >
                {CUSTOM_FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={row.appliesTo}
                onChange={(e) => patchField(idx, { appliesTo: e.target.value as CustomFieldAppliesTo })}
                disabled={disabled}
                className="col-span-4 h-8 px-2 text-[12px] border border-n-200 rounded-r1 bg-white disabled:bg-n-50"
                title="Where this field is rendered"
              >
                {CUSTOM_FIELD_APPLIES_TO.map((a) => (
                  <option key={a} value={a}>applies to: {a}</option>
                ))}
              </select>
              <label className="col-span-5 flex items-center gap-1.5 text-[11.5px] text-n-700">
                <input
                  type="checkbox"
                  checked={!!row.required}
                  onChange={(e) => patchField(idx, { required: e.target.checked })}
                  disabled={disabled}
                  className="shrink-0"
                />
                Required (block submit if empty)
              </label>
            </div>
            {row.type === 'select' && (
              <div className="pl-5 space-y-1">
                <div className="flex flex-wrap gap-1">
                  {(row.options ?? []).map((opt) => (
                    <span
                      key={opt}
                      className="inline-flex items-center gap-1 text-[11.5px] bg-a-50 text-a-800 border border-a-200 rounded-r1 px-1.5 py-0.5"
                    >
                      {opt}
                      <button
                        type="button"
                        onClick={() => removeOption(idx, opt)}
                        disabled={disabled}
                        className="hover:text-bad"
                        aria-label={`Remove option ${opt}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    value={optionDraft[idx] ?? ''}
                    onChange={(e) => setOptionDraft({ ...optionDraft, [idx]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(idx); } }}
                    disabled={disabled}
                    placeholder="add option…"
                    className="flex-1 h-7 px-2 text-[11.5px] border border-n-200 rounded-r1 focus:border-a-500 focus:outline-none disabled:bg-n-50"
                    maxLength={120}
                  />
                  <button
                    type="button"
                    onClick={() => addOption(idx)}
                    disabled={disabled}
                    className="text-[11.5px] text-a-700 hover:text-a-800 hover:bg-a-50 rounded-r1 px-2 py-0.5 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
            <div className="pl-5">
              <textarea
                value={row.helpText ?? ''}
                onChange={(e) => patchField(idx, { helpText: e.target.value })}
                disabled={disabled}
                placeholder="Help text shown beneath the input (optional)"
                className="w-full min-h-[28px] px-2 py-1 text-[11.5px] border border-n-200 rounded-r1 focus:border-a-500 focus:outline-none disabled:bg-n-50 resize-y"
                rows={1}
                maxLength={500}
              />
            </div>
            {err && (
              <div className="pl-5 flex items-center gap-1.5 text-[11px] text-bad">
                <AlertCircle className="w-3 h-3" />
                <span>{err}</span>
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={addField}
        disabled={disabled}
        className="inline-flex items-center gap-1 text-[12px] text-a-700 hover:text-a-800 hover:bg-a-50 rounded-r1 px-2 py-1 disabled:opacity-40"
      >
        <Plus className="w-3.5 h-3.5" />
        Add field
      </button>
    </div>
  );
}
