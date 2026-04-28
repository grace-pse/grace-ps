// Survey listing + "Start new survey" drawer. Rows navigate to
// /surveys/:id (run page). System templates are filterable together
// with tenant-owned ones.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Plus, ClipboardCheck, X } from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Btn2 } from '../components/hifi/Btn2';
import { Pill } from '../components/hifi/Pill';
import {
  surveysApi, surveyTemplatesApi, clustersApi, adminSurveyConfigApi,
  type BuiltInSurveyTypeOverride,
} from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  SURVEY_TYPES, SURVEY_STATUSES,
  type SurveyResponseSummary, type SurveyTemplateSummary,
  type ClusterSummary, type SurveyType, type SurveyStatus,
  type SurveyRating,
} from '../lib/csmp-types';

type CustomTypeLite = { code: string; name: string };

// Render the survey-type code the admin's tenant-renamed name if they
// overrode a built-in, else the custom-type name, else the raw enum
// code humanised.
function typeLabel(
  code: string,
  overrides: BuiltInSurveyTypeOverride[],
  customTypes: CustomTypeLite[],
): string {
  const ov = overrides.find((o) => o.code === code);
  if (ov?.name) return ov.name;
  const ct = customTypes.find((c) => c.code === code);
  if (ct) return ct.name;
  return code.replace('_', ' ');
}

const RATING_VARIANT: Record<SurveyRating, 'ok' | 'info' | 'warn' | 'bad'> = {
  STRONG: 'ok',
  BASELINE: 'info',
  BARELY_ADEQUATE: 'warn',
  INADEQUATE: 'bad',
};

const STATUS_VARIANT: Record<SurveyStatus, 'warn' | 'info' | 'ok' | 'bad'> = {
  DRAFT: 'warn',
  SUBMITTED: 'info',
  APPROVED: 'ok',
  REJECTED: 'bad',
};

type Filters = { surveyType?: SurveyType; status?: SurveyStatus };

export function SurveysPage() {
  const [items, setItems] = useState<SurveyResponseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overrides, setOverrides] = useState<BuiltInSurveyTypeOverride[]>([]);
  const [customTypes, setCustomTypes] = useState<CustomTypeLite[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, cfg] = await Promise.all([
        surveysApi.list(filters),
        surveysApi.enabledTypes(),
      ]);
      setItems(res.items);
      setOverrides(cfg.builtInOverrides ?? []);
      setCustomTypes(cfg.customTypes.map((c) => ({ code: c.code, name: c.name })));
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <Topbar
        breadcrumbs={<span>Work / Surveys</span>}
        title="Surveys"
        subtitle={`${items.length} total · evidence capture for assessments`}
        actions={
          <Btn2
            variant="primary"
            leading={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setDrawerOpen(true)}
          >
            Start survey
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
          <FilterSelect
            label="Type"
            value={filters.surveyType ?? ''}
            options={SURVEY_TYPES.map((t) => ({ value: t, label: typeLabel(t, overrides, customTypes) }))}
            onChange={(v) => setFilters((f) => ({ ...f, surveyType: (v as SurveyType) || undefined }))}
          />
          <FilterSelect
            label="Status"
            value={filters.status ?? ''}
            options={SURVEY_STATUSES.map((s) => ({ value: s, label: s }))}
            onChange={(v) => setFilters((f) => ({ ...f, status: (v as SurveyStatus) || undefined }))}
          />
          {(filters.surveyType || filters.status) && (
            <button
              type="button"
              onClick={() => setFilters({})}
              className="text-[11.5px] text-n-500 hover:text-n-800 underline ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center text-[12.5px] text-n-500">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-r2 bg-n-75 text-n-500 mb-3">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div className="text-[13px] font-medium text-n-800 mb-1">No surveys yet</div>
            <div className="text-[12px] text-n-500 mb-4">
              Start a walkthrough, remote-tech review, or doc review. Submit it to lift
              linked assessments out of expert-judgment.
            </div>
            <Btn2
              variant="primary"
              leading={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setDrawerOpen(true)}
            >
              Start survey
            </Btn2>
          </div>
        ) : (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead className="bg-n-50 text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">
                <tr>
                  <th className="text-left px-4 py-2">Template</th>
                  <th className="text-left px-4 py-2">Cluster</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Rating</th>
                  <th className="text-left px-4 py-2">Score</th>
                  <th className="text-left px-4 py-2">Conducted</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-t border-n-100 hover:bg-n-50">
                    <td className="px-4 py-2.5">
                      <Link
                        to="/surveys/$id"
                        params={{ id: s.id }}
                        className="font-medium text-n-900 hover:text-a-700"
                      >
                        {s.templateName ?? '—'}
                      </Link>
                      {s.conductedByName && (
                        <div className="text-[10.5px] font-mono text-n-500 tracking-[0.4px] mt-0.5">
                          by {s.conductedByName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-n-700">{s.clusterName ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <Pill variant="accent">{typeLabel(s.surveyType, overrides, customTypes)}</Pill>
                    </td>
                    <td className="px-4 py-2.5">
                      <Pill variant={STATUS_VARIANT[s.status]}>{s.status}</Pill>
                    </td>
                    <td className="px-4 py-2.5">
                      {s.rating ? (
                        <Pill variant={RATING_VARIANT[s.rating]}>{s.rating.replace('_', ' ')}</Pill>
                      ) : (
                        <span className="text-n-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-n-700">
                      {s.scorePct == null ? '—' : `${s.scorePct.toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-2.5 text-n-600 text-[11.5px]">
                      {new Date(s.conductedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drawerOpen && (
        <StartSurveyDrawer
          onClose={() => setDrawerOpen(false)}
          onCreated={(id) => {
            setDrawerOpen(false);
            void load();
            window.setTimeout(() => {
              window.location.href = `/surveys/${id}`;
            }, 50);
          }}
        />
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

function StartSurveyDrawer({
  onClose, onCreated,
}: { onClose: () => void; onCreated: (id: string) => void }) {
  const navigate = useNavigate();
  void navigate;

  const [templates, setTemplates] = useState<SurveyTemplateSummary[]>([]);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [enabledTypes, setEnabledTypes] = useState<string[] | null>(null);
  const [overrides, setOverrides] = useState<BuiltInSurveyTypeOverride[]>([]);
  const [customTypes, setCustomTypes] = useState<CustomTypeLite[]>([]);
  const [clusterId, setClusterId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [evidenceSource, setEvidenceSource] = useState('');
  const [typeFilter, setTypeFilter] = useState<SurveyType | ''>('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [tpl, cls, cfg] = await Promise.all([
          surveyTemplatesApi.list({ activeOnly: true }),
          clustersApi.list(),
          surveysApi.enabledTypes(),
        ]);
        setTemplates(tpl.items);
        setClusters(cls.items);
        setEnabledTypes(cfg.enabledTypes);
        setOverrides(cfg.builtInOverrides ?? []);
        setCustomTypes(cfg.customTypes.map((c) => ({ code: c.code, name: c.name })));
      } catch (e) {
        setErr(await extractError(e));
      }
    })();
  }, []);

  const typeOptions = useMemo<SurveyType[]>(() => {
    if (!enabledTypes) return SURVEY_TYPES;
    return SURVEY_TYPES.filter((t) => enabledTypes.includes(t));
  }, [enabledTypes]);

  const templatesByEnabledType = useMemo(
    () => (enabledTypes
      ? templates.filter((t) => enabledTypes.includes(t.surveyType))
      : templates),
    [templates, enabledTypes],
  );

  const visibleTemplates = useMemo(
    () => (typeFilter
      ? templatesByEnabledType.filter((t) => t.surveyType === typeFilter)
      : templatesByEnabledType),
    [templatesByEnabledType, typeFilter],
  );

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      const created = await surveysApi.create({
        clusterId,
        templateId,
        evidenceSource: evidenceSource.trim() || undefined,
      });
      onCreated(created.id);
    } catch (e) {
      setErr(await extractError(e));
    } finally {
      setSaving(false);
    }
  }

  const canSave = clusterId && templateId && !saving;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white h-full w-full max-w-[560px] shadow-sh3 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-n-150">
          <div className="text-[14px] font-semibold text-n-900">Start a survey</div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {err && (
            <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
              {err}
            </div>
          )}

          <Field label="Cluster *">
            <select
              className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
              value={clusterId}
              onChange={async (e) => {
                const id = e.target.value;
                setClusterId(id);
                if (!id) return;
                try {
                  const s = await adminSurveyConfigApi.suggest(id);
                  if (s.reason !== 'FALLBACK') {
                    setTypeFilter(s.surveyType);
                    if (s.templateId) setTemplateId(s.templateId);
                  }
                } catch {
                  // suggestion is best-effort
                }
              }}
            >
              <option value="">— pick a cluster —</option>
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.clusterType}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Type filter">
            <select
              className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as SurveyType | '');
                setTemplateId('');
              }}
            >
              <option value="">All types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>{typeLabel(t, overrides, customTypes)}</option>
              ))}
            </select>
          </Field>

          <Field label="Template *">
            <div className="space-y-1.5">
              {visibleTemplates.length === 0 ? (
                <div className="text-[11.5px] text-n-500 bg-n-50 rounded-r1 px-2 py-2">
                  No templates match. Ask an admin to clone one.
                </div>
              ) : (
                visibleTemplates.map((t) => {
                  const active = t.id === templateId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplateId(t.id)}
                      className={[
                        'w-full text-left border rounded-r2 px-3 py-2',
                        active
                          ? 'border-a-300 bg-a-50'
                          : 'border-n-200 bg-white hover:bg-n-50',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-[12.5px] text-n-900 flex-1">
                          {t.name}
                        </div>
                        {t.isSystem && <Pill variant="outline">system</Pill>}
                        <Pill variant="accent">{typeLabel(t.surveyType, overrides, customTypes)}</Pill>
                      </div>
                      {t.description && (
                        <div className="text-[11px] text-n-500 mt-0.5">{t.description}</div>
                      )}
                      <div className="text-[10.5px] font-mono text-n-500 tracking-[0.4px] mt-1">
                        {t.questionCount} questions · {t.requiresPhysical ? 'requires site visit' : 'remote OK'}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Field>

          <Field label="Evidence source">
            <input
              className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
              placeholder="e.g. Walkthrough 2026-04-21 with site ops"
              value={evidenceSource}
              onChange={(e) => setEvidenceSource(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-n-150 px-5 py-3">
          <Btn2 variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn2>
          <Btn2 variant="primary" onClick={submit} disabled={!canSave}>
            {saving ? 'Creating…' : 'Create draft'}
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
