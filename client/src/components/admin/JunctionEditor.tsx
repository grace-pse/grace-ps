import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Pill } from '../hifi/Pill';
import type { Relevance } from '../../lib/csmp-types';

const RELEVANCES: Relevance[] = ['HIGH', 'MEDIUM', 'LOW'];

export interface JunctionRow {
  targetId: string;
  targetLabel: string;
  relevance: Relevance;
  rationale: string | null;
}

interface Candidate {
  id: string;
  label: string;
}

interface JunctionEditorProps {
  title: string;
  rows: JunctionRow[];
  candidates: Candidate[];
  onAttach: (targetId: string, relevance: Relevance, rationale: string | null) => Promise<void>;
  onUpdate: (targetId: string, relevance: Relevance, rationale: string | null) => Promise<void>;
  onDetach: (targetId: string) => Promise<void>;
}

export function JunctionEditor({
  title, rows, candidates, onAttach, onUpdate, onDetach,
}: JunctionEditorProps) {
  const [adding, setAdding] = useState(false);
  const [newTargetId, setNewTargetId] = useState('');
  const [newRelevance, setNewRelevance] = useState<Relevance>('MEDIUM');
  const [newRationale, setNewRationale] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const taken = new Set(rows.map((r) => r.targetId));
  const available = candidates.filter((c) => !taken.has(c.id));

  async function handleAdd() {
    if (!newTargetId) return;
    setBusy('add');
    try {
      await onAttach(newTargetId, newRelevance, newRationale.trim() || null);
      setNewTargetId('');
      setNewRelevance('MEDIUM');
      setNewRationale('');
      setAdding(false);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border border-n-150 rounded-r2 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">
          {title} · {rows.length}
        </div>
        {!adding && available.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-[11.5px] text-a-700 hover:text-a-800"
          >
            <Plus className="w-3.5 h-3.5" /> Link
          </button>
        )}
      </div>

      {rows.length === 0 && !adding && (
        <div className="text-[11px] text-n-500 italic">No links.</div>
      )}

      {rows.map((r) => (
        <div key={r.targetId} className="flex items-start gap-2 text-[12px] py-1 border-t border-n-100 first:border-t-0 pt-1.5">
          <div className="flex-1 min-w-0">
            <div className="truncate text-n-800">{r.targetLabel}</div>
            {r.rationale && (
              <div className="text-[11px] text-n-500 mt-0.5 break-words">{r.rationale}</div>
            )}
          </div>
          <select
            value={r.relevance}
            onChange={async (e) => {
              setBusy(r.targetId);
              try {
                await onUpdate(r.targetId, e.target.value as Relevance, r.rationale);
              } finally {
                setBusy(null);
              }
            }}
            disabled={busy === r.targetId}
            className="h-7 px-1.5 text-[11px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
          >
            {RELEVANCES.map((rel) => <option key={rel} value={rel}>{rel}</option>)}
          </select>
          <button
            type="button"
            onClick={async () => {
              setBusy(r.targetId);
              try { await onDetach(r.targetId); } finally { setBusy(null); }
            }}
            disabled={busy === r.targetId}
            className="w-6 h-6 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
            aria-label="Unlink"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}

      {adding && (
        <div className="border-t border-n-100 pt-2 space-y-1.5">
          <select
            value={newTargetId}
            onChange={(e) => setNewTargetId(e.target.value)}
            className="w-full h-8 px-2 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
          >
            <option value="">Select target…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5">
            <select
              value={newRelevance}
              onChange={(e) => setNewRelevance(e.target.value as Relevance)}
              className="h-8 px-2 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
            >
              {RELEVANCES.map((rel) => <option key={rel} value={rel}>{rel}</option>)}
            </select>
            <input
              value={newRationale}
              onChange={(e) => setNewRationale(e.target.value)}
              placeholder="Rationale (optional)"
              className="flex-1 h-8 px-2 text-[12px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => { setAdding(false); setNewTargetId(''); setNewRationale(''); }}
              className="text-[11.5px] text-n-600 px-2 py-1 hover:bg-n-100 rounded-r1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newTargetId || busy === 'add'}
              className="text-[11.5px] text-white bg-a-500 hover:bg-a-600 disabled:opacity-50 px-2.5 py-1 rounded-r2"
            >
              {busy === 'add' ? 'Linking…' : 'Link'}
            </button>
          </div>
        </div>
      )}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {rows.map((r) => (
            <Pill key={`pill-${r.targetId}`} variant="outline">{r.relevance}</Pill>
          ))}
        </div>
      )}
    </div>
  );
}
