import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { Btn2 } from './hifi/Btn2';
import { RiskBadge } from './hifi/RiskBadge';
import { recommendationsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import { PRIORITY_TO_LEVEL } from '../lib/risk-ui';
import type { Recommendation, RecommendationInput, RiskPriority } from '../lib/csmp-types';

const PRIORITIES: RiskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'HIGHEST'];

const INPUT_CLS =
  'w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none';

interface FormState {
  ref: string;
  priority: RiskPriority;
  title: string;
  body: string;
  owner: string;
  horizon: string;
  cost: string;
}

function emptyForm(): FormState {
  return { ref: '', priority: 'MEDIUM', title: '', body: '', owner: '', horizon: '', cost: '' };
}

function toForm(r: Recommendation): FormState {
  return {
    ref: r.ref,
    priority: r.priority,
    title: r.title,
    body: r.body,
    owner: r.owner ?? '',
    horizon: r.horizon ?? '',
    cost: r.cost ?? '',
  };
}

function toInput(f: FormState): RecommendationInput {
  const trim = (s: string) => s.trim();
  return {
    ref: trim(f.ref) || undefined,
    priority: f.priority,
    title: trim(f.title),
    body: trim(f.body),
    owner: trim(f.owner) || null,
    horizon: trim(f.horizon) || null,
    cost: trim(f.cost) || null,
  };
}

export function RecommendationsEditor({
  assessmentId,
  canEdit,
}: {
  assessmentId: string;
  canEdit: boolean;
}) {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Recommendation | 'new' | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await recommendationsApi.listForAssessment(assessmentId);
      setItems(res.items);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this recommendation?')) return;
    try {
      await recommendationsApi.remove(id);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(await extractError(err));
    }
  }

  return (
    <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
            Recommendations
          </div>
          <h3 className="text-[15px] font-semibold text-n-900">Board-level recommendations</h3>
          <p className="text-[12px] text-n-600 mt-1">
            Synthesised treatment actions for the final report. Each is priority-ranked with an
            owner, horizon, and indicative cost.
          </p>
        </div>
        {canEdit && (
          <Btn2 variant="primary" leading={<Plus className="w-3.5 h-3.5" />} onClick={() => setEditing('new')}>
            Add recommendation
          </Btn2>
        )}
      </div>

      {error && (
        <div className="mb-3 text-[12px] text-bad bg-bad/10 border border-bad/20 rounded-r2 px-2.5 py-1.5">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-[12.5px] text-n-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-[12.5px] text-n-500 italic">
          No recommendations yet. {canEdit ? 'Add the first one to populate the report.' : ''}
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((r) => (
            <li
              key={r.id}
              className="border border-n-150 rounded-r2 px-3 py-2.5 flex gap-3 items-start"
            >
              <div className="flex-shrink-0 flex flex-col items-center gap-1 w-16">
                <span className="font-mono text-[11px] text-n-500 tracking-[0.4px]">{r.ref}</span>
                <RiskBadge level={PRIORITY_TO_LEVEL[r.priority]} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-n-900">{r.title}</div>
                <p className="text-[12px] text-n-700 mt-0.5 whitespace-pre-wrap">{r.body}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-[11px] text-n-500">
                  {r.owner && <span><span className="uppercase font-mono tracking-[0.4px]">Owner:</span> {r.owner}</span>}
                  {r.horizon && <span><span className="uppercase font-mono tracking-[0.4px]">Horizon:</span> {r.horizon}</span>}
                  {r.cost && <span><span className="uppercase font-mono tracking-[0.4px]">Cost:</span> {r.cost}</span>}
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-1 flex-shrink-0">
                  <Btn2 variant="ghost" onClick={() => setEditing(r)} title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </Btn2>
                  <Btn2 variant="ghost" onClick={() => void handleDelete(r.id)} title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Btn2>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <RecommendationForm
          assessmentId={assessmentId}
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, mode) => {
            setItems((prev) =>
              mode === 'create'
                ? [...prev, saved].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
                : prev.map((r) => (r.id === saved.id ? saved : r)),
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function RecommendationForm({
  assessmentId,
  existing,
  onClose,
  onSaved,
}: {
  assessmentId: string;
  existing: Recommendation | null;
  onClose: () => void;
  onSaved: (r: Recommendation, mode: 'create' | 'update') => void;
}) {
  const [form, setForm] = useState<FormState>(existing ? toForm(existing) : emptyForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and body are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const input = toInput(form);
      const saved = existing
        ? await recommendationsApi.update(existing.id, input)
        : await recommendationsApi.create(assessmentId, input);
      onSaved(saved, existing ? 'update' : 'create');
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-n-900/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-r3 shadow-sh3 w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
                {existing ? `Edit ${existing.ref}` : 'New recommendation'}
              </div>
              <h3 className="text-[15px] font-semibold text-n-900">
                {existing ? 'Edit recommendation' : 'Add a recommendation'}
              </h3>
            </div>
            <Btn2 variant="ghost" onClick={onClose} type="button" title="Close">
              <X className="w-3.5 h-3.5" />
            </Btn2>
          </div>

          {error && (
            <div className="mb-3 text-[12px] text-bad bg-bad/10 border border-bad/20 rounded-r2 px-2.5 py-1.5">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-1">
              <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-0.5">
                Ref (optional, auto-assigned)
              </span>
              <input
                className={INPUT_CLS}
                value={form.ref}
                onChange={(e) => update('ref', e.target.value)}
                placeholder="R01"
                maxLength={8}
              />
            </label>
            <label className="col-span-1">
              <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-0.5">
                Priority
              </span>
              <select
                className={INPUT_CLS}
                value={form.priority}
                onChange={(e) => update('priority', e.target.value as RiskPriority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="col-span-2">
              <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-0.5">
                Title
              </span>
              <input
                className={INPUT_CLS}
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                maxLength={255}
                required
              />
            </label>
            <label className="col-span-2">
              <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-0.5">
                Body
              </span>
              <textarea
                value={form.body}
                onChange={(e) => update('body', e.target.value)}
                className="w-full min-h-[100px] px-2.5 py-1.5 text-[12.5px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
                required
              />
            </label>
            <label className="col-span-2">
              <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-0.5">
                Owner
              </span>
              <input
                className={INPUT_CLS}
                value={form.owner}
                onChange={(e) => update('owner', e.target.value)}
                placeholder="Head of Security"
                maxLength={120}
              />
            </label>
            <label className="col-span-1">
              <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-0.5">
                Horizon
              </span>
              <input
                className={INPUT_CLS}
                value={form.horizon}
                onChange={(e) => update('horizon', e.target.value)}
                placeholder="0–6 months"
                maxLength={40}
              />
            </label>
            <label className="col-span-1">
              <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-0.5">
                Cost
              </span>
              <input
                className={INPUT_CLS}
                value={form.cost}
                onChange={(e) => update('cost', e.target.value)}
                placeholder="~€420k / yr"
                maxLength={40}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Btn2 variant="ghost" onClick={onClose} type="button">Cancel</Btn2>
            <Btn2 variant="primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : existing ? 'Save changes' : 'Add recommendation'}
            </Btn2>
          </div>
        </form>
      </div>
    </div>
  );
}
