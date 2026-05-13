import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Shield, X } from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Pill } from '../components/hifi/Pill';
import { RiskBadge, type RiskLevel } from '../components/hifi/RiskBadge';
import { ThreatDetailDrawer } from '../components/ThreatDetailDrawer';
import { threatsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  ADVERSARY_TYPES,
  ACTION_TYPES,
  COMPLIANCE_TAGS,
  COMPLIANCE_TAG_LABEL,
  TEAR_STRATEGIES,
  type AdversaryType,
  type ActionType,
  type IrvBand,
  type RiskPriority,
  type TearStrategy,
  type ComplianceTag,
  type ThreatCatalogItem,
  type ThreatListParams,
} from '../lib/csmp-types';

const PAGE_SIZE = 50;

const IRV_BANDS: IrvBand[] = ['NEGLIGIBLE', 'LOW', 'MODERATE', 'HIGH', 'EXTREME'];
const PRIORITY_LEVELS: RiskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'HIGHEST'];
const DBT_LINKED: Array<{ value: 'yes' | 'no'; label: string }> = [
  { value: 'yes', label: 'Linked' },
  { value: 'no', label: 'Unlinked' },
];

const IRV_TO_LEVEL: Record<IrvBand, RiskLevel> = {
  NEGLIGIBLE: 'Negligible',
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  EXTREME: 'Extreme',
};

const PRIORITY_VARIANT: Record<RiskPriority, 'default' | 'info' | 'warn' | 'bad'> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warn',
  HIGHEST: 'bad',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  STEP_1_ASSETS: 'Step 1',
  STEP_2_THREATS: 'Step 2',
  STEP_3_LIKELIHOOD: 'Step 3',
  STEP_4_IMPACT: 'Step 4',
  STEP_5_IRV: 'Step 5',
  STEP_6_VULNERABILITY: 'Step 6',
  STEP_7_TREATMENT: 'Step 7',
  REVIEW: 'Review',
  APPROVED: 'Approved',
  ARCHIVED: 'Archived',
};

type Filters = {
  search: string;
  adversaryType: AdversaryType | '';
  actionType: ActionType | '';
  irv: IrvBand | '';
  priority: RiskPriority | '';
  tear: TearStrategy | '';
  dbtLinked: 'yes' | 'no' | '';
  complianceTag: ComplianceTag | '';
};

const EMPTY_FILTERS: Filters = {
  search: '',
  adversaryType: '',
  actionType: '',
  irv: '',
  priority: '',
  tear: '',
  dbtLinked: '',
  complianceTag: '',
};

export function ThreatsPage() {
  const [items, setItems] = useState<ThreatCatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = useMemo<ThreatListParams>(() => ({
    search: filters.search.trim() || undefined,
    adversaryType: (filters.adversaryType || undefined) as AdversaryType | undefined,
    actionType: (filters.actionType || undefined) as ActionType | undefined,
    irv: (filters.irv || undefined) as IrvBand | undefined,
    riskTreatmentPriority: (filters.priority || undefined) as RiskPriority | undefined,
    tearStrategy: (filters.tear || undefined) as TearStrategy | undefined,
    dbtLinked: filters.dbtLinked || undefined,
    complianceTag: (filters.complianceTag || undefined) as ComplianceTag | undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [filters, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await threatsApi.list(params);
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { void load(); }, [load]);

  const hasFilters =
    filters.search !== '' ||
    filters.adversaryType !== '' ||
    filters.actionType !== '' ||
    filters.irv !== '' ||
    filters.priority !== '' ||
    filters.tear !== '' ||
    filters.dbtLinked !== '' ||
    filters.complianceTag !== '';

  function patch<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  const selected = items.find((t) => t.id === selectedId) ?? null;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Topbar
        breadcrumbs={<span>Catalog / Threats</span>}
        title="Threats"
        subtitle={`${total} threats · catalog & DBT linkage`}
      />

      <div className="p-6 space-y-4">
        {error && (
          <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-3 space-y-2">
          <label className="relative block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-n-400" />
            <input
              value={filters.search}
              onChange={(e) => patch('search', e.target.value)}
              placeholder="Search adversary / action / asset / assessment…"
              className="w-full h-8 pl-8 pr-2.5 text-[12.5px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Adversary"
              value={filters.adversaryType}
              options={ADVERSARY_TYPES.map((a) => ({ value: a, label: a.replace('_', ' ') }))}
              onChange={(v) => patch('adversaryType', v as AdversaryType | '')}
            />
            <FilterSelect
              label="Action"
              value={filters.actionType}
              options={ACTION_TYPES.map((a) => ({ value: a, label: a.replace('_', ' ') }))}
              onChange={(v) => patch('actionType', v as ActionType | '')}
            />
            <FilterSelect
              label="IRV"
              value={filters.irv}
              options={IRV_BANDS.map((b) => ({ value: b, label: IRV_TO_LEVEL[b] }))}
              onChange={(v) => patch('irv', v as IrvBand | '')}
            />
            <FilterSelect
              label="Priority"
              value={filters.priority}
              options={PRIORITY_LEVELS.map((p) => ({ value: p, label: p }))}
              onChange={(v) => patch('priority', v as RiskPriority | '')}
            />
            <FilterSelect
              label="TEAR"
              value={filters.tear}
              options={TEAR_STRATEGIES.map((t) => ({ value: t, label: t }))}
              onChange={(v) => patch('tear', v as TearStrategy | '')}
            />
            <FilterSelect
              label="DBT"
              value={filters.dbtLinked}
              options={DBT_LINKED}
              onChange={(v) => patch('dbtLinked', v as 'yes' | 'no' | '')}
            />
            <FilterSelect
              label="Compliance"
              value={filters.complianceTag}
              options={COMPLIANCE_TAGS.map((t) => ({ value: t, label: COMPLIANCE_TAG_LABEL[t] }))}
              onChange={(v) => patch('complianceTag', v as ComplianceTag | '')}
            />
            {hasFilters && (
              <button
                type="button"
                onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}
                className="text-[11.5px] text-n-500 hover:text-n-800 underline ml-auto inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear filters
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center text-[12.5px] text-n-500">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-r2 bg-n-75 text-n-500 mb-3">
              <Shield className="w-5 h-5" />
            </div>
            <div className="text-[13px] font-medium text-n-800 mb-1">
              {hasFilters ? 'No threats match your filters' : 'No threats yet'}
            </div>
            <div className="text-[12px] text-n-500">
              Threats are created inside the assessment wizard (Step 2).
            </div>
          </div>
        ) : (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead className="bg-n-50 text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">
                <tr>
                  <th className="text-left px-4 py-2">Adversary</th>
                  <th className="text-left px-4 py-2">Action</th>
                  <th className="text-left px-4 py-2">Target asset</th>
                  <th className="text-left px-4 py-2">IRV</th>
                  <th className="text-left px-4 py-2">Priority</th>
                  <th className="text-left px-4 py-2">DBT</th>
                  <th className="text-left px-4 py-2">Assessment</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={[
                      'border-t border-n-100 cursor-pointer hover:bg-n-50 transition-colors',
                      selectedId === t.id ? 'bg-a-50/40' : '',
                    ].join(' ')}
                  >
                    <td className="px-4 py-2.5">
                      <Pill variant="accent">{t.adversaryType.replace('_', ' ')}</Pill>
                    </td>
                    <td className="px-4 py-2.5">
                      <Pill variant="outline">{t.actionType.replace('_', ' ')}</Pill>
                    </td>
                    <td className="px-4 py-2.5 text-n-800">
                      {t.targetAssetName ?? <span className="text-n-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.irv ? (
                        <RiskBadge level={IRV_TO_LEVEL[t.irv]} />
                      ) : (
                        <span className="text-[10.5px] font-mono uppercase text-n-400 tracking-[0.4px]">unscored</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.riskTreatmentPriority ? (
                        <Pill variant={PRIORITY_VARIANT[t.riskTreatmentPriority]}>
                          {t.riskTreatmentPriority}
                        </Pill>
                      ) : (
                        <span className="text-n-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.dbtCsmpUnitReference ? (
                        <span
                          className="font-mono text-[11px] text-n-700"
                          title={t.dbtScenarioName ?? undefined}
                        >
                          {t.dbtCsmpUnitReference}
                        </span>
                      ) : t.dbtScenarioName ? (
                        <span
                          className="text-[11.5px] text-n-700 truncate max-w-[140px] inline-block"
                          title={t.dbtScenarioName}
                        >
                          {t.dbtScenarioName}
                        </span>
                      ) : (
                        <span className="text-n-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-n-700 truncate max-w-[180px]" title={t.assessmentTitle ?? undefined}>
                        {t.assessmentTitle ?? <span className="text-n-400">—</span>}
                      </div>
                      <div className="text-[10.5px] font-mono uppercase text-n-500 tracking-[0.4px] mt-0.5">
                        {STATUS_LABEL[t.assessmentStatus] ?? t.assessmentStatus}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-n-100 bg-n-50/40 text-[11.5px] text-n-600">
                <span>
                  Page {page} of {totalPages} · {total} threats
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-7 px-2.5 rounded-r1 border border-n-200 text-n-700 disabled:opacity-40 hover:bg-white"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-7 px-2.5 rounded-r1 border border-n-200 text-n-700 disabled:opacity-40 hover:bg-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <ThreatDetailDrawer threat={selected} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11.5px] text-n-700">
      <span className="font-mono uppercase text-[10px] text-n-500 tracking-[0.4px]">{label}</span>
      <select
        className="h-7 border border-n-200 rounded-r1 px-2 text-[12px] bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
