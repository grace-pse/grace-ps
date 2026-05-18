// SurveyQuestion library CRUD. Reusable questions get attached to AAA
// templates and to cluster survey scopes. System questions (isSystem=true)
// show up here read-only; instance-owned questions are editable.

import { useCallback, useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Btn2 } from '../components/hifi/Btn2';
import { Pill } from '../components/hifi/Pill';
import { surveyQuestionsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  SURVEY_TYPES,
  type SurveyQuestionLibraryItem,
  type SurveyQuestionCreateInput,
  type SurveyType,
} from '../lib/csmp-types';

type QType = 'yes_no_partial' | 'number' | 'text' | 'select';
const Q_TYPES: QType[] = ['yes_no_partial', 'number', 'text', 'select'];
const SEVERITY_KEYS_YN = ['YES', 'PARTIAL', 'NO'];
const SEVERITY_KEYS_NUM = ['BELOW_30', '30_TO_60', 'ABOVE_60'];

export function SurveyQuestionsPage() {
  const [items, setItems] = useState<SurveyQuestionLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<SurveyType | ''>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await surveyQuestionsApi.list({
        evidenceType: filterType || undefined,
        search: search.trim() || undefined,
      });
      setItems(r.items);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, [filterType, search]);

  useEffect(() => { void load(); }, [load]);

  const editing = editingId ? items.find((q) => q.id === editingId) ?? null : null;

  async function remove(id: string) {
    if (!window.confirm('Delete this question? This cannot be undone.')) return;
    try {
      await surveyQuestionsApi.remove(id);
      await load();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  return (
    <>
      <Topbar
        breadcrumbs={<span>Catalog / Survey questions</span>}
        title="Survey question library"
        subtitle={`${items.length} total · attach to AAA templates and cluster scopes`}
        actions={
          <Btn2
            variant="primary"
            leading={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setEditingId(null);
              setDrawerOpen(true);
            }}
          >
            New question
          </Btn2>
        }
      />

      <div className="p-6 space-y-4">
        {error && (
          <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 bg-white border border-n-150 rounded-r3 shadow-sh1 p-3">
          <input
            className="border border-n-200 rounded-r1 h-7 px-2 text-[12px] flex-1 min-w-[200px]"
            placeholder="Search prompt or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="inline-flex items-center gap-1.5 text-[11.5px] text-n-700">
            <span className="font-mono uppercase text-[10px] text-n-500 tracking-[0.4px]">Evidence</span>
            <select
              className="h-7 border border-n-200 rounded-r1 px-2 text-[12px] bg-white"
              value={filterType}
              onChange={(e) => setFilterType((e.target.value as SurveyType) || '')}
            >
              <option value="">All</option>
              {SURVEY_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center text-[12.5px] text-n-500">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center text-[12.5px] text-n-500">
            No questions match.
          </div>
        ) : (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead className="bg-n-50 text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">
                <tr>
                  <th className="text-left px-4 py-2">Prompt</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Evidence</th>
                  <th className="text-left px-4 py-2">Weight</th>
                  <th className="text-left px-4 py-2">Attached</th>
                  <th className="text-left px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((q) => (
                  <tr key={q.id} className="border-t border-n-100 hover:bg-n-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-n-900">{q.prompt}</div>
                      <div className="text-[10.5px] font-mono text-n-500 tracking-[0.4px] mt-0.5">
                        {q.category ?? 'general'}
                        {q.isSystem && ' · system'}
                        {!q.isActive && ' · inactive'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><Pill variant="outline">{q.type}</Pill></td>
                    <td className="px-4 py-2.5">
                      <Pill variant="accent">{q.evidenceType.replace('_', ' ')}</Pill>
                    </td>
                    <td className="px-4 py-2.5 text-n-700 font-mono">{q.defaultWeight}</td>
                    <td className="px-4 py-2.5 text-n-700">{q.attachedTemplateCount}</td>
                    <td className="px-4 py-2.5 text-right">
                      {!q.isSystem && (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { setEditingId(q.id); setDrawerOpen(true); }}
                            className="w-7 h-7 flex items-center justify-center text-n-500 hover:text-a-700 rounded-r1 hover:bg-n-100"
                            aria-label="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(q.id)}
                            className="w-7 h-7 flex items-center justify-center text-n-500 hover:text-bad rounded-r1 hover:bg-n-100"
                            aria-label="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drawerOpen && (
        <QuestionDrawer
          existing={editing}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => {
            setDrawerOpen(false);
            void load();
          }}
        />
      )}
    </>
  );
}

function QuestionDrawer({
  existing, onClose, onSaved,
}: {
  existing: SurveyQuestionLibraryItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [prompt, setPrompt] = useState(existing?.prompt ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [hint, setHint] = useState(existing?.hint ?? '');
  const [type, setType] = useState<QType>(existing?.type ?? 'yes_no_partial');
  const [evidenceType, setEvidenceType] = useState<SurveyType>(existing?.evidenceType ?? 'PHYSICAL');
  const [defaultWeight, setDefaultWeight] = useState<number>(existing?.defaultWeight ?? 3);
  const [optionsText, setOptionsText] = useState(
    existing?.options ? existing.options.join('\n') : '',
  );
  const [severityMap, setSeverityMap] = useState<Record<string, 'ok' | 'warn' | 'bad'>>(
    existing?.severityMap ?? { YES: 'ok', PARTIAL: 'warn', NO: 'bad' },
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const severityKeys =
    type === 'yes_no_partial'
      ? SEVERITY_KEYS_YN
      : type === 'number'
        ? SEVERITY_KEYS_NUM
        : type === 'select'
          ? optionsText.split('\n').map((s) => s.trim()).filter(Boolean)
          : [];

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const options = type === 'select'
        ? optionsText.split('\n').map((s) => s.trim()).filter(Boolean)
        : undefined;
      const data: SurveyQuestionCreateInput = {
        prompt: prompt.trim(),
        category: category.trim() || null,
        hint: hint.trim() || null,
        type,
        evidenceType,
        defaultWeight,
        options,
        severityMap: severityKeys.length > 0 ? severityMap : undefined,
      };
      if (existing) {
        await surveyQuestionsApi.update(existing.id, data);
      } else {
        await surveyQuestionsApi.create(data);
      }
      onSaved();
    } catch (e) {
      setErr(await extractError(e));
    } finally {
      setSaving(false);
    }
  }

  const canSave = prompt.trim().length > 0 && !saving;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white h-full w-full max-w-[600px] shadow-sh3 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-n-150">
          <div className="text-[14px] font-semibold text-n-900">
            {existing ? 'Edit question' : 'New question'}
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

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {err && (
            <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
              {err}
            </div>
          )}

          <Field label="Prompt *">
            <textarea
              className="w-full border border-n-200 rounded-r1 px-2 py-1.5 text-[12.5px] min-h-[60px]"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. EN 50131 Grade 3 conformity certificate on file"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <input
                className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Compliance"
              />
            </Field>
            <Field label="Default weight">
              <input
                type="number"
                min={1}
                max={5}
                className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
                value={defaultWeight}
                onChange={(e) => setDefaultWeight(Number(e.target.value))}
              />
            </Field>
          </div>

          <Field label="Hint">
            <input
              className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Helper text shown under the question on the run page"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select
                className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
                value={type}
                onChange={(e) => setType(e.target.value as QType)}
              >
                {Q_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Evidence type">
              <select
                className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
                value={evidenceType}
                onChange={(e) => setEvidenceType(e.target.value as SurveyType)}
              >
                {SURVEY_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </Field>
          </div>

          {type === 'select' && (
            <Field label="Options (one per line)">
              <textarea
                className="w-full border border-n-200 rounded-r1 px-2 py-1.5 text-[12.5px] min-h-[70px] font-mono"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder={'PASS\nWARN\nFAIL'}
              />
            </Field>
          )}

          {severityKeys.length > 0 && type !== 'text' && (
            <Field label="Severity map">
              <div className="space-y-1">
                {severityKeys.map((k) => (
                  <div key={k} className="flex items-center gap-2 text-[11.5px]">
                    <span className="font-mono w-24 text-n-700">{k}</span>
                    <select
                      className="h-7 border border-n-200 rounded-r1 px-2 text-[12px] bg-white"
                      value={severityMap[k] ?? 'ok'}
                      onChange={(e) =>
                        setSeverityMap((m) => ({ ...m, [k]: e.target.value as 'ok' | 'warn' | 'bad' }))
                      }
                    >
                      <option value="ok">ok</option>
                      <option value="warn">warn</option>
                      <option value="bad">bad</option>
                    </select>
                  </div>
                ))}
              </div>
            </Field>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-n-150 px-5 py-3">
          <Btn2 variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn2>
          <Btn2 variant="primary" onClick={save} disabled={!canSave}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Create question'}
          </Btn2>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">{label}</div>
      {children}
    </label>
  );
}
