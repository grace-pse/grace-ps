import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Btn2 } from './hifi/Btn2';
import { assessmentsApi, assetsApi, clustersApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  EVIDENCE_BASIS_OPTIONS,
  EVIDENCE_BASIS_LABEL,
  type AssetSummary, type ClusterSummary, type EvidenceBasis,
} from '../lib/csmp-types';

const EVIDENCE_BASIS_HELP: Record<EvidenceBasis, string> = {
  EXPERT_JUDGMENT: 'Relies on assessor expertise and on-site observation. No survey data incorporated.',
  SURVEY_LINKED: 'Backed by one or more completed surveys (physical walkthrough, remote tech review, doc review).',
  MIXED: 'Some scope items have survey coverage; others rely on expert judgment.',
};

interface Props {
  onClose: () => void;
  onCreated?: (id: string) => void;
}

type Target = { kind: 'asset'; id: string } | { kind: 'cluster'; id: string };

export function NewAssessmentDialog({ onClose, onCreated }: Props) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState<Target | null>(null);
  const [evidenceBasis, setEvidenceBasis] = useState<EvidenceBasis>('EXPERT_JUDGMENT');
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [aRes, cRes] = await Promise.all([
          assetsApi.list({ pageSize: 200 }),
          clustersApi.list(),
        ]);
        if (cancelled) return;
        setAssets(aRes.items);
        setClusters(cRes.items);
      } catch (err) {
        if (!cancelled) setError(await extractError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = target.kind === 'asset'
        ? { title: title.trim(), assetId: target.id, evidenceBasis }
        : { title: title.trim(), clusterId: target.id, evidenceBasis };
      const created = await assessmentsApi.create(payload);
      onCreated?.(created.id);
      void navigate({ to: '/assessments/$id', params: { id: created.id } });
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-n-900/30 z-30" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-labelledby="new-assessment-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-w-[95vw] bg-white rounded-r3 shadow-sh3 z-40 flex flex-col max-h-[85vh]"
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-n-150">
          <h2 id="new-assessment-title" className="text-[15px] font-semibold text-n-900">
            New assessment
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <form onSubmit={submit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <label className="block">
              <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
                Title
              </span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Q2 2026 HQ security review"
                className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
                maxLength={255}
              />
            </label>

            <div>
              <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
                Scope
              </div>
              {loading ? (
                <div className="text-[12px] text-n-500">Loading assets and clusters…</div>
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="block text-[11px] text-n-600 mb-0.5">Asset</span>
                    <select
                      value={target?.kind === 'asset' ? target.id : ''}
                      onChange={(e) => setTarget(e.target.value ? { kind: 'asset', id: e.target.value } : null)}
                      className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
                    >
                      <option value="">— select an asset —</option>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.assetType})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="text-center text-[10.5px] font-mono uppercase text-n-400 tracking-[0.4px]">
                    or
                  </div>
                  <label className="block">
                    <span className="block text-[11px] text-n-600 mb-0.5">Cluster</span>
                    <select
                      value={target?.kind === 'cluster' ? target.id : ''}
                      onChange={(e) => setTarget(e.target.value ? { kind: 'cluster', id: e.target.value } : null)}
                      className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
                    >
                      <option value="">— select a cluster —</option>
                      {clusters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.clusterType})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1.5">
                Evidence basis
              </div>
              <div className="space-y-1.5">
                {EVIDENCE_BASIS_OPTIONS.map((value) => (
                  <label
                    key={value}
                    className={[
                      'flex items-start gap-2 px-2.5 py-2 border rounded-r2 cursor-pointer transition-colors',
                      evidenceBasis === value
                        ? 'border-a-500 bg-a-50'
                        : 'border-n-200 hover:bg-n-50',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="evidenceBasis"
                      value={value}
                      checked={evidenceBasis === value}
                      onChange={() => setEvidenceBasis(value)}
                      className="mt-[3px]"
                    />
                    <span className="flex-1">
                      <span className="block text-[12.5px] font-medium text-n-900">
                        {EVIDENCE_BASIS_LABEL[value]}
                      </span>
                      <span className="block text-[11px] text-n-600 leading-snug">
                        {EVIDENCE_BASIS_HELP[value]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
                {error}
              </div>
            )}
          </div>

          <footer className="border-t border-n-150 px-5 py-3 flex items-center justify-end gap-2">
            <Btn2 type="button" variant="ghost" onClick={onClose}>Cancel</Btn2>
            <Btn2
              type="submit"
              variant="primary"
              disabled={saving || !title.trim() || !target}
            >
              {saving ? 'Creating…' : 'Create & open wizard'}
            </Btn2>
          </footer>
        </form>
      </div>
    </>
  );
}
