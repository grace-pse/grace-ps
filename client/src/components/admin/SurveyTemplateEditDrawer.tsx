// Full questionnaire editor for tenant-owned survey templates. Lets
// admins edit top-level metadata (name, description, requiresPhysical)
// plus the question schema — add/remove/reorder, set type, weight,
// hint, category, select options, and per-answer severity mapping.
// System templates are read-only on the server (404 on PATCH), so this
// drawer is only opened for tenant rows in SurveyTemplatesPage.

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, X, Save, GripVertical } from 'lucide-react';
import { Btn2 } from '../hifi/Btn2';
import { Pill } from '../hifi/Pill';
import { surveyTemplatesApi } from '../../lib/csmp-api';
import { extractError } from '../../lib/api';
import type {
  SurveyTemplateDetail, SurveyTemplateSummary,
  SurveyQuestion,
} from '../../lib/csmp-types';

type QuestionType = SurveyQuestion['type'];
type Severity = 'ok' | 'warn' | 'bad';

const QUESTION_TYPES: Array<{ value: QuestionType; label: string }> = [
  { value: 'yes_no_partial', label: 'Yes / No / Partial' },
  { value: 'select', label: 'Select (one of)' },
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Text' },
];

const SEVERITY_LEVELS: Severity[] = ['ok', 'warn', 'bad'];

const YES_NO_PARTIAL_KEYS = ['yes', 'partial', 'no'] as const;
const YES_NO_PARTIAL_DEFAULT: Record<string, Severity> = {
  yes: 'ok', partial: 'warn', no: 'bad',
};

function emptyQuestion(nextId: number): SurveyQuestion {
  return {
    id: `q${nextId}`,
    prompt: '',
    type: 'yes_no_partial',
    weight: 1,
    severityMap: { ...YES_NO_PARTIAL_DEFAULT },
  };
}

export function SurveyTemplateEditDrawer({
  template, onClose, onSaved,
}: {
  template: SurveyTemplateSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<SurveyTemplateDetail | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requiresPhysical, setRequiresPhysical] = useState(false);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const d = await surveyTemplatesApi.get(template.id);
        setDetail(d);
        setName(d.name);
        setDescription(d.description ?? '');
        setRequiresPhysical(d.requiresPhysical);
        setQuestions(d.schema.questions.map((q) => ({ ...q })));
      } catch (e) {
        setErr(await extractError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [template.id]);

  // Ensure every question has a unique id before save. Autogenerate
  // missing ones so admin can hand-paste prompts without juggling ids.
  const nextQId = useMemo(() => {
    let max = 0;
    for (const q of questions) {
      const m = /^q(\d+)$/.exec(q.id);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max + 1;
  }, [questions]);

  function patchQ(idx: number, patch: Partial<SurveyQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function changeType(idx: number, type: QuestionType) {
    setQuestions((qs) => qs.map((q, i) => {
      if (i !== idx) return q;
      const next: SurveyQuestion = { ...q, type };
      if (type === 'yes_no_partial') {
        next.severityMap = q.severityMap ?? { ...YES_NO_PARTIAL_DEFAULT };
        next.options = undefined;
      } else if (type === 'select') {
        next.options = q.options && q.options.length > 0 ? q.options : ['Option A', 'Option B'];
        const sev: Record<string, Severity> = {};
        for (const opt of next.options) sev[opt] = q.severityMap?.[opt] ?? 'warn';
        next.severityMap = sev;
      } else {
        next.severityMap = undefined;
        next.options = undefined;
      }
      return next;
    }));
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, emptyQuestion(nextQId)]);
  }

  function removeQuestion(idx: number) {
    if (questions.length <= 1) return;
    setQuestions((qs) => qs.filter((_, i) => i !== idx));
  }

  function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= questions.length) return;
    setQuestions((qs) => {
      const copy = [...qs];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }

  function addOption(idx: number) {
    setQuestions((qs) => qs.map((q, i) => {
      if (i !== idx) return q;
      const opts = [...(q.options ?? []), `Option ${(q.options?.length ?? 0) + 1}`];
      const sev = { ...(q.severityMap ?? {}) };
      sev[opts[opts.length - 1]] = 'warn';
      return { ...q, options: opts, severityMap: sev };
    }));
  }

  function renameOption(idx: number, optIdx: number, value: string) {
    setQuestions((qs) => qs.map((q, i) => {
      if (i !== idx || !q.options) return q;
      const oldVal = q.options[optIdx];
      const opts = q.options.map((o, oi) => (oi === optIdx ? value : o));
      const sev: Record<string, Severity> = {};
      for (const o of opts) {
        sev[o] = o === value
          ? q.severityMap?.[oldVal] ?? 'warn'
          : q.severityMap?.[o] ?? 'warn';
      }
      return { ...q, options: opts, severityMap: sev };
    }));
  }

  function removeOption(idx: number, optIdx: number) {
    setQuestions((qs) => qs.map((q, i) => {
      if (i !== idx || !q.options) return q;
      const opts = q.options.filter((_, oi) => oi !== optIdx);
      const sev: Record<string, Severity> = {};
      for (const o of opts) sev[o] = q.severityMap?.[o] ?? 'warn';
      return { ...q, options: opts, severityMap: sev };
    }));
  }

  function setOptionSeverity(idx: number, key: string, sev: Severity) {
    setQuestions((qs) => qs.map((q, i) => {
      if (i !== idx) return q;
      return { ...q, severityMap: { ...(q.severityMap ?? {}), [key]: sev } };
    }));
  }

  const validation = useMemo(() => {
    if (!name.trim()) return 'Name is required.';
    if (questions.length === 0) return 'At least one question is required.';
    const ids = new Set<string>();
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      if (!q.id.trim()) return `Question ${i + 1}: id is required.`;
      if (ids.has(q.id)) return `Duplicate question id: ${q.id}`;
      ids.add(q.id);
      if (!q.prompt.trim()) return `Question ${i + 1} (${q.id}): prompt is required.`;
      if (q.type === 'select' && (!q.options || q.options.length < 2)) {
        return `Question ${q.id}: select type needs at least 2 options.`;
      }
      if (q.type === 'select' && q.options) {
        const seen = new Set<string>();
        for (const o of q.options) {
          const t = o.trim();
          if (!t) return `Question ${q.id}: option labels cannot be blank.`;
          if (seen.has(t)) return `Question ${q.id}: duplicate option "${t}".`;
          seen.add(t);
        }
      }
    }
    return null;
  }, [name, questions]);

  const dirty = useMemo(() => {
    if (!detail) return false;
    if (name !== detail.name) return true;
    if (description !== (detail.description ?? '')) return true;
    if (requiresPhysical !== detail.requiresPhysical) return true;
    return JSON.stringify(questions) !== JSON.stringify(detail.schema.questions);
  }, [detail, name, description, requiresPhysical, questions]);

  async function save() {
    if (validation) { setErr(validation); return; }
    setSaving(true);
    setErr(null);
    try {
      await surveyTemplatesApi.update(template.id, {
        name: name.trim(),
        description: description.trim() ? description.trim() : undefined,
        requiresPhysical,
        schema: {
          questions: questions.map((q) => {
            const clean: SurveyQuestion = {
              id: q.id.trim(),
              prompt: q.prompt.trim(),
              type: q.type,
              weight: q.weight,
            };
            if (q.category && q.category.trim()) clean.category = q.category.trim();
            if (q.hint && q.hint.trim()) clean.hint = q.hint.trim();
            if (q.type === 'select' && q.options) clean.options = q.options.map((o) => o.trim());
            if (q.severityMap && (q.type === 'yes_no_partial' || q.type === 'select')) {
              clean.severityMap = q.severityMap;
            }
            return clean;
          }),
        },
      });
      onSaved();
    } catch (e) {
      setErr(await extractError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/40 flex items-stretch justify-end"
      onClick={onClose}
    >
      <div
        className="bg-n-50 h-full w-full max-w-[760px] shadow-sh3 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-n-150 bg-white">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-n-900 truncate">
              Edit questionnaire
            </div>
            <div className="text-[11.5px] text-n-500 font-mono tracking-[0.4px]">
              {template.surveyType}{template.isSystem ? ' · system (read-only)' : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[12.5px] text-n-500">
            Loading…
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {err && (
                <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
                  {err}
                </div>
              )}

              <section className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-4 space-y-3">
                <Field label="Name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border border-n-200 rounded-r1 px-2 py-1.5 text-[12.5px] min-h-[52px]"
                  />
                </Field>
                <label className="flex items-center gap-2 text-[12.5px] text-n-800">
                  <input
                    type="checkbox"
                    checked={requiresPhysical}
                    onChange={() => setRequiresPhysical(!requiresPhysical)}
                  />
                  Requires physical walkthrough
                </label>
              </section>

              <section className="space-y-3">
                <div className="flex items-center">
                  <div>
                    <div className="text-[12.5px] font-medium text-n-900">
                      Questions ({questions.length})
                    </div>
                    <div className="text-[11px] text-n-500">
                      Drag via arrow buttons. Severity mapping controls how answers score.
                    </div>
                  </div>
                  <Btn2
                    variant="secondary"
                    leading={<Plus className="w-3.5 h-3.5" />}
                    onClick={addQuestion}
                    className="ml-auto"
                  >
                    Add question
                  </Btn2>
                </div>

                {questions.map((q, idx) => (
                  <QuestionCard
                    key={`${q.id}-${idx}`}
                    q={q}
                    idx={idx}
                    total={questions.length}
                    onPatch={(patch) => patchQ(idx, patch)}
                    onType={(t) => changeType(idx, t)}
                    onRemove={() => removeQuestion(idx)}
                    onMoveUp={() => move(idx, -1)}
                    onMoveDown={() => move(idx, 1)}
                    onAddOption={() => addOption(idx)}
                    onRenameOption={(oi, v) => renameOption(idx, oi, v)}
                    onRemoveOption={(oi) => removeOption(idx, oi)}
                    onSeverity={(key, sev) => setOptionSeverity(idx, key, sev)}
                  />
                ))}

                <button
                  type="button"
                  onClick={addQuestion}
                  className="w-full border-2 border-dashed border-n-200 hover:border-a-300 hover:bg-a-50 rounded-r3 py-4 text-[12.5px] text-n-600 hover:text-a-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add question
                </button>
              </section>
            </div>

            <div className="flex items-center gap-2 border-t border-n-150 px-5 py-3 bg-white">
              {validation && (
                <div className="text-[11.5px] text-bad truncate">{validation}</div>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Btn2 variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn2>
                <Btn2
                  variant="primary"
                  leading={<Save className="w-3.5 h-3.5" />}
                  onClick={save}
                  disabled={!dirty || saving || !!validation}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Btn2>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── One question editor card ─────────────────────────────────
function QuestionCard({
  q, idx, total,
  onPatch, onType, onRemove, onMoveUp, onMoveDown,
  onAddOption, onRenameOption, onRemoveOption, onSeverity,
}: {
  q: SurveyQuestion;
  idx: number;
  total: number;
  onPatch: (patch: Partial<SurveyQuestion>) => void;
  onType: (t: QuestionType) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddOption: () => void;
  onRenameOption: (optIdx: number, value: string) => void;
  onRemoveOption: (optIdx: number) => void;
  onSeverity: (key: string, sev: Severity) => void;
}) {
  return (
    <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-n-100 bg-n-50">
        <GripVertical className="w-3.5 h-3.5 text-n-400" />
        <span className="font-mono text-[11px] text-n-500 tracking-[0.4px]">Q{idx + 1}</span>
        <input
          value={q.id}
          onChange={(e) => onPatch({ id: e.target.value.trim() })}
          className="font-mono text-[11.5px] border border-n-200 rounded-r1 h-6 px-2 w-[90px]"
          aria-label="Question id"
        />
        <Pill variant="outline">weight {q.weight}</Pill>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={idx === 0}
            className="w-6 h-6 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1 disabled:opacity-30"
            aria-label="Move up"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={idx === total - 1}
            className="w-6 h-6 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1 disabled:opacity-30"
            aria-label="Move down"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={total <= 1}
            className="w-6 h-6 flex items-center justify-center text-n-500 hover:bg-bad-bg hover:text-bad rounded-r1 disabled:opacity-30"
            aria-label="Remove question"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="p-3 space-y-3">
        <Field label="Prompt">
          <textarea
            value={q.prompt}
            onChange={(e) => onPatch({ prompt: e.target.value })}
            className="w-full border border-n-200 rounded-r1 px-2 py-1.5 text-[12.5px] min-h-[44px]"
            placeholder="e.g. Is there an active CCTV camera covering the main entrance?"
          />
        </Field>

        <div className="grid grid-cols-3 gap-2">
          <Field label="Type">
            <select
              value={q.type}
              onChange={(e) => onType(e.target.value as QuestionType)}
              className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12px] bg-white"
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Weight (1-5)">
            <input
              type="number"
              min={1}
              max={5}
              value={q.weight}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isFinite(n)) onPatch({ weight: Math.max(1, Math.min(5, n)) });
              }}
              className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
            />
          </Field>
          <Field label="Category (optional)">
            <input
              value={q.category ?? ''}
              onChange={(e) => onPatch({ category: e.target.value })}
              className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
              placeholder="e.g. Perimeter"
            />
          </Field>
        </div>

        <Field label="Hint (optional — shown to the assessor)">
          <input
            value={q.hint ?? ''}
            onChange={(e) => onPatch({ hint: e.target.value })}
            className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
          />
        </Field>

        {q.type === 'yes_no_partial' && (
          <SeverityGrid
            keys={[...YES_NO_PARTIAL_KEYS]}
            severityMap={q.severityMap ?? YES_NO_PARTIAL_DEFAULT}
            onChange={onSeverity}
          />
        )}

        {q.type === 'select' && (
          <div>
            <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
              Options + severity
            </div>
            <div className="space-y-1.5">
              {(q.options ?? []).map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    value={opt}
                    onChange={(e) => onRenameOption(oi, e.target.value)}
                    className="flex-1 border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
                    placeholder={`Option ${oi + 1}`}
                  />
                  <SeverityPicker
                    value={q.severityMap?.[opt] ?? 'warn'}
                    onChange={(sev) => onSeverity(opt, sev)}
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveOption(oi)}
                    disabled={(q.options?.length ?? 0) <= 2}
                    className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-bad-bg hover:text-bad rounded-r1 disabled:opacity-30"
                    aria-label="Remove option"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <Btn2
                variant="ghost"
                leading={<Plus className="w-3.5 h-3.5" />}
                onClick={onAddOption}
              >
                Add option
              </Btn2>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SeverityGrid({
  keys, severityMap, onChange,
}: {
  keys: string[];
  severityMap: Record<string, Severity>;
  onChange: (key: string, sev: Severity) => void;
}) {
  return (
    <div>
      <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
        Severity mapping
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => (
          <div key={k} className="border border-n-150 rounded-r2 p-2 bg-n-50">
            <div className="text-[11px] font-mono text-n-600 tracking-[0.4px] mb-1">{k}</div>
            <SeverityPicker
              value={severityMap[k] ?? 'warn'}
              onChange={(sev) => onChange(k, sev)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SeverityPicker({
  value, onChange,
}: { value: Severity; onChange: (v: Severity) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Severity)}
      className={[
        'border border-n-200 rounded-r1 h-8 px-2 text-[12px] bg-white w-[90px]',
        value === 'ok' ? 'text-ok' : value === 'warn' ? 'text-warn' : 'text-bad',
      ].join(' ')}
    >
      {SEVERITY_LEVELS.map((s) => (
        <option key={s} value={s}>{s.toUpperCase()}</option>
      ))}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}

export default SurveyTemplateEditDrawer;
