import { useCallback, useEffect, useState } from 'react';
import { Clock, Plus } from 'lucide-react';
import { Btn2 } from './hifi/Btn2';
import { Pill } from './hifi/Pill';
import { assessmentsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  type AssessmentDetail, type SnapshotSummary, type SnapshotDetail,
  type SnapshotReason, SNAPSHOT_REASON_LABEL,
} from '../lib/csmp-types';

const REASON_VARIANT: Record<SnapshotReason, 'ok' | 'warn' | 'info' | 'bad'> = {
  APPROVED: 'ok',
  SUBMITTED_FOR_REVIEW: 'warn',
  MANUAL_SAVE: 'info',
  REJECTED: 'bad',
};

export function HistoryPanel({ assessment }: { assessment: AssessmentDetail }) {
  const [items, setItems] = useState<SnapshotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<SnapshotDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await assessmentsApi.listSnapshots(assessment.id);
      setItems(res.items);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, [assessment.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const d = await assessmentsApi.getSnapshot(assessment.id, selected);
        if (!cancelled) setDetail(d);
      } catch (err) {
        if (!cancelled) setError(await extractError(err));
      }
    })();
    return () => { cancelled = true; };
  }, [assessment.id, selected]);

  async function handleSave() {
    const note = window.prompt('Snapshot note (what changed since last save?)');
    if (!note || !note.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await assessmentsApi.captureSnapshot(assessment.id, note.trim());
      await load();
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-n-150 rounded-r3 shadow-sh1">
      <div className="flex items-center justify-between px-4 py-3 border-b border-n-150">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-n-500" />
          <h3 className="text-[13px] font-semibold text-n-900">History</h3>
          <span className="text-[11px] text-n-500">{items.length} snapshot{items.length === 1 ? '' : 's'}</span>
        </div>
        <Btn2
          variant="secondary"
          leading={<Plus className="w-3.5 h-3.5" />}
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save snapshot'}
        </Btn2>
      </div>

      {error && (
        <div className="text-[12px] text-bad bg-bad-bg border-b border-bad/20 px-3 py-2">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-6 text-[12.5px] text-n-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-[12.5px] text-n-500">
          No snapshots yet. One will be captured automatically when you submit for review.
        </div>
      ) : (
        <ul className="divide-y divide-n-100">
          {items.map((s) => (
            <li key={s.id} className="px-4 py-2.5">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setSelected(selected === s.id ? null : s.id)}
              >
                <div className="flex items-center gap-2">
                  <Pill variant={REASON_VARIANT[s.reason]}>{SNAPSHOT_REASON_LABEL[s.reason]}</Pill>
                  <span className="text-[12px] text-n-700">
                    {new Date(s.capturedAt).toLocaleString()}
                  </span>
                  <span className="text-[11.5px] text-n-500">· {s.capturedByName ?? '—'}</span>
                </div>
                {s.note && (
                  <div className="text-[11.5px] text-n-600 mt-0.5 italic">“{s.note}”</div>
                )}
              </button>
              {selected === s.id && detail && (
                <DiffView current={assessment} snapshot={detail} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── diff ────────────────────────────────────────────────

type DiffRow = { path: string; before: string; after: string };

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) return v.length === 0 ? '[]' : v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function compareFields<T>(
  base: T | undefined, curr: T | undefined, keys: (keyof T)[], prefix: string,
): DiffRow[] {
  if (!base || !curr) return [];
  const rows: DiffRow[] = [];
  for (const k of keys) {
    const a = fmt(base[k]);
    const b = fmt(curr[k]);
    if (a !== b) rows.push({ path: `${prefix}.${String(k)}`, before: a, after: b });
  }
  return rows;
}

function DiffView({ current, snapshot }: { current: AssessmentDetail; snapshot: SnapshotDetail }) {
  const rows: DiffRow[] = [];
  const snapA = snapshot.payload.assessment;

  rows.push(
    ...compareFields(
      snapA, current,
      ['title', 'status', 'reviewStatus', 'currentStep', 'reviewNotes'],
      'assessment',
    ),
  );

  const currentThreats = new Map(current.threats.map((t) => [t.id, t]));
  const snapThreats = new Map(snapshot.payload.threats.map((t) => [t.id, t]));

  for (const [tid, t] of currentThreats) {
    const s = snapThreats.get(tid);
    if (!s) {
      rows.push({ path: `threat(${t.adversaryType}/${t.actionType})`, before: 'not present', after: 'added' });
      continue;
    }
    rows.push(
      ...compareFields(
        s, t,
        [
          'likelihoodScore', 'impactScore', 'vulnerabilityRating',
          'riskTreatmentPriority', 'irv', 'tearStrategy',
          'alarpJustification', 'complianceTags',
        ],
        `threat(${t.adversaryType}/${t.actionType})`,
      ),
    );
  }
  for (const [tid, s] of snapThreats) {
    if (!currentThreats.has(tid)) {
      rows.push({
        path: `threat(${s.adversaryType}/${s.actionType})`,
        before: 'present', after: 'removed',
      });
    }
  }

  if (rows.length === 0) {
    return (
      <div className="mt-2 text-[11.5px] text-n-500 italic">
        No differences between this snapshot and the current state.
      </div>
    );
  }

  return (
    <div className="mt-2 border border-n-150 rounded-r2 bg-n-25 overflow-hidden">
      <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] px-3 py-1.5 border-b border-n-150">
        Diff vs current ({rows.length} change{rows.length === 1 ? '' : 's'})
      </div>
      <table className="w-full">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-n-100 last:border-b-0">
              <td className="px-3 py-1.5 text-[11px] font-mono text-n-600 whitespace-nowrap align-top">
                {r.path}
              </td>
              <td className="px-2 py-1.5 text-[11.5px] text-n-500 line-through align-top">{r.before}</td>
              <td className="px-2 py-1.5 text-[11.5px] text-n-800 align-top">→ {r.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
