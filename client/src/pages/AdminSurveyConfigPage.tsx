// Admin survey config page (P2). Two tabs:
//   - Enabled types: pick which SurveyTypes this tenant uses + declare
//     custom types (code, name, requiresPhysical, starter template).
//   - Asset-type defaults: map each AssetType → (SurveyType, optional
//     template) so creating a survey on a cluster of that type pre-fills
//     the right choice.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, Package, Play, Pause, Calendar } from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Btn2 } from '../components/hifi/Btn2';
import { Pill } from '../components/hifi/Pill';
import {
  adminSurveyConfigApi, surveyTemplatesApi, surveySchedulesApi, clustersApi, usersApi,
  type TenantSurveyConfig, type AssetTypeSurveyDefault,
  type SurveyScheduleSummary, type SurveyScheduleCreateInput,
  type UserSummary,
} from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  ASSET_TYPES, SURVEY_TYPES,
  type AssetType, type SurveyType, type SurveyTemplateSummary,
  type ClusterSummary,
} from '../lib/csmp-types';

const BUILTIN_TYPES: SurveyType[] = SURVEY_TYPES;

export function AdminSurveyConfigPage() {
  const [tab, setTab] = useState<'types' | 'defaults' | 'schedules'>('types');
  const [config, setConfig] = useState<TenantSurveyConfig | null>(null);
  const [defaults, setDefaults] = useState<AssetTypeSurveyDefault[]>([]);
  const [templates, setTemplates] = useState<SurveyTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, defs, tpls] = await Promise.all([
        adminSurveyConfigApi.getConfig(),
        adminSurveyConfigApi.listDefaults(),
        surveyTemplatesApi.list(),
      ]);
      setConfig(cfg);
      setDefaults(defs.items);
      setTemplates(tpls.items);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <Topbar
        breadcrumbs={<span>Admin / Survey config</span>}
        title="Survey config"
        subtitle="Enable types, map asset-type defaults, declare custom types"
      />

      <div className="p-6 space-y-4">
        {error && (
          <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex items-center gap-1 border-b border-n-150">
          <TabBtn active={tab === 'types'} onClick={() => setTab('types')}>
            Enabled types
          </TabBtn>
          <TabBtn active={tab === 'defaults'} onClick={() => setTab('defaults')}>
            Asset-type defaults
          </TabBtn>
          <TabBtn active={tab === 'schedules'} onClick={() => setTab('schedules')}>
            Schedules
          </TabBtn>
        </div>

        {loading && (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center text-[12.5px] text-n-500">
            Loading…
          </div>
        )}

        {!loading && tab === 'types' && config && (
          <EnabledTypesTab config={config} onSaved={load} onError={setError} />
        )}

        {!loading && tab === 'defaults' && (
          <DefaultsTab
            defaults={defaults}
            templates={templates}
            enabledTypes={config?.enabledTypes ?? []}
            onChanged={load}
            onError={setError}
          />
        )}

        {!loading && tab === 'schedules' && (
          <SchedulesTab templates={templates} onError={setError} />
        )}
      </div>
    </>
  );
}

function TabBtn({
  active, children, onClick,
}: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 h-9 text-[12.5px]',
        active
          ? 'text-a-700 border-b-2 border-a-500 font-medium'
          : 'text-n-600 hover:text-n-900',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ─── Enabled types tab ────────────────────────────────────────
function EnabledTypesTab({
  config, onSaved, onError,
}: {
  config: TenantSurveyConfig;
  onSaved: () => void;
  onError: (e: string | null) => void;
}) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(config.enabledTypes));
  const [saving, setSaving] = useState(false);
  const [newCustomOpen, setNewCustomOpen] = useState(false);

  const customTypes = config.customTypes;

  function toggle(t: string) {
    const next = new Set(enabled);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setEnabled(next);
  }

  async function save() {
    setSaving(true);
    onError(null);
    try {
      await adminSurveyConfigApi.updateConfig({ enabledTypes: [...enabled] });
      onSaved();
    } catch (err) {
      onError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  const dirty = useMemo(() => {
    const a = [...enabled].sort().join(',');
    const b = [...config.enabledTypes].sort().join(',');
    return a !== b;
  }, [enabled, config.enabledTypes]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-n-150 rounded-r3 shadow-sh1">
        <div className="px-4 py-3 border-b border-n-150 flex items-center">
          <div>
            <div className="text-[12.5px] font-medium text-n-900">Built-in types</div>
            <div className="text-[11px] text-n-500">
              Pick which built-in survey types this tenant uses.
            </div>
          </div>
          <Btn2
            variant="primary"
            leading={<Save className="w-3.5 h-3.5" />}
            onClick={save}
            disabled={!dirty || saving}
            className="ml-auto"
          >
            {saving ? 'Saving…' : 'Save'}
          </Btn2>
        </div>
        <div className="p-4 grid grid-cols-2 gap-2">
          {BUILTIN_TYPES.map((t) => (
            <label
              key={t}
              className="flex items-center gap-2 border border-n-150 rounded-r2 px-3 py-2 cursor-pointer hover:bg-n-50"
            >
              <input
                type="checkbox"
                checked={enabled.has(t)}
                onChange={() => toggle(t)}
              />
              <span className="font-mono text-[12px] text-n-800">{t}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white border border-n-150 rounded-r3 shadow-sh1">
        <div className="px-4 py-3 border-b border-n-150 flex items-center">
          <div>
            <div className="text-[12.5px] font-medium text-n-900">Custom types</div>
            <div className="text-[11px] text-n-500">
              Declare your own survey-type codes (e.g. PRE_HANDOVER) with a starter template.
            </div>
          </div>
          <Btn2
            variant="ghost"
            leading={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setNewCustomOpen(true)}
            className="ml-auto"
          >
            Add custom type
          </Btn2>
        </div>
        {customTypes.length === 0 ? (
          <div className="p-6 text-center text-[12px] text-n-500">
            No custom types defined yet.
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="bg-n-50 text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">
              <tr>
                <th className="text-left px-4 py-2">Code</th>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Physical?</th>
                <th className="text-left px-4 py-2">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {customTypes.map((c) => (
                <tr key={c.code} className="border-t border-n-100">
                  <td className="px-4 py-2 font-mono">{c.code}</td>
                  <td className="px-4 py-2 text-n-900">{c.name}</td>
                  <td className="px-4 py-2">
                    {c.requiresPhysical ? (
                      <Pill variant="warn">yes</Pill>
                    ) : (
                      <Pill variant="default">no</Pill>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={enabled.has(c.code)}
                      onChange={() => toggle(c.code)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {newCustomOpen && (
        <NewCustomTypeDrawer
          existingCodes={new Set([...BUILTIN_TYPES, ...customTypes.map((c) => c.code)])}
          onClose={() => setNewCustomOpen(false)}
          onCreated={() => {
            setNewCustomOpen(false);
            onSaved();
          }}
          currentCustomTypes={customTypes}
          onError={onError}
        />
      )}
    </div>
  );
}

// ─── New custom type drawer ───────────────────────────────────
function NewCustomTypeDrawer({
  existingCodes, onClose, onCreated, currentCustomTypes, onError,
}: {
  existingCodes: Set<string>;
  onClose: () => void;
  onCreated: () => void;
  currentCustomTypes: TenantSurveyConfig['customTypes'];
  onError: (e: string | null) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requiresPhysical, setRequiresPhysical] = useState(false);
  const [questions, setQuestions] = useState([
    { id: 'q1', prompt: '', type: 'yes_no_partial' as const, weight: 1 },
    { id: 'q2', prompt: '', type: 'yes_no_partial' as const, weight: 1 },
    { id: 'q3', prompt: '', type: 'yes_no_partial' as const, weight: 1 },
  ]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Starter-template source: write 3 placeholder questions by hand, or
  // fork a system survey template (copies its full question set as the
  // editable starter for this new custom type).
  const [starterMode, setStarterMode] = useState<'scratch' | 'fork'>('scratch');
  const [forkSourceId, setForkSourceId] = useState('');
  const [systemTemplates, setSystemTemplates] = useState<SurveyTemplateSummary[]>([]);

  useEffect(() => {
    surveyTemplatesApi.list({ activeOnly: true })
      .then((res) => setSystemTemplates(res.items.filter((t) => t.isSystem)))
      .catch(() => { /* silent — admin can still use scratch mode */ });
  }, []);

  const codeUpper = code.trim().toUpperCase();
  const codeValid = /^[A-Z][A-Z0-9_]{1,39}$/.test(codeUpper);
  const codeCollision = existingCodes.has(codeUpper);
  const questionsValid = questions.every((q) => q.prompt.trim().length > 0);
  const canSubmit = starterMode === 'scratch'
    ? codeValid && !codeCollision && name.trim().length > 0 && questionsValid && !saving
    : codeValid && !codeCollision && name.trim().length > 0 && !!forkSourceId && !saving;

  async function submit() {
    setSaving(true);
    setErr(null);
    onError(null);
    try {
      // In fork mode, declare with 3 placeholder questions so the
      // server auto-materialises a starter template; we replace it with
      // the forked content in step 2.
      const starterQuestions = starterMode === 'scratch' ? questions : [
        { id: 'q1', prompt: 'Placeholder (replaced by fork)', type: 'yes_no_partial' as const, weight: 1 },
        { id: 'q2', prompt: 'Placeholder (replaced by fork)', type: 'yes_no_partial' as const, weight: 1 },
        { id: 'q3', prompt: 'Placeholder (replaced by fork)', type: 'yes_no_partial' as const, weight: 1 },
      ];
      const payload = {
        customTypes: [
          ...currentCustomTypes.map((c) => ({
            code: c.code,
            name: c.name,
            description: c.description ?? undefined,
            requiresPhysical: c.requiresPhysical,
            starterTemplate: { questions: [
              { id: 'q1', prompt: 'Placeholder', type: 'yes_no_partial' as const, weight: 1 },
              { id: 'q2', prompt: 'Placeholder', type: 'yes_no_partial' as const, weight: 1 },
              { id: 'q3', prompt: 'Placeholder', type: 'yes_no_partial' as const, weight: 1 },
            ] },
          })),
          {
            code: codeUpper,
            name: name.trim(),
            description: description.trim() || undefined,
            requiresPhysical,
            starterTemplate: { questions: starterQuestions },
          },
        ],
      };
      await adminSurveyConfigApi.updateConfig(payload);

      // Fork mode: after the custom type exists (and its auto-starter
      // placeholder has been created), replace the placeholder with a
      // fork of the chosen system template so the admin gets a richer
      // editable starter instead of 3 empty questions.
      if (starterMode === 'fork') {
        const starterName = `${codeUpper} — Starter`;
        try {
          const tpls = await surveyTemplatesApi.list();
          const placeholder = tpls.items.find(
            (t) => !t.isSystem
              && t.name === starterName
              && t.questionCount === 3,
          );
          await surveyTemplatesApi.fork(forkSourceId, { name: starterName });
          if (placeholder) {
            await surveyTemplatesApi.remove(placeholder.id);
          }
        } catch (forkErr) {
          // Custom type already exists; surface the fork failure but
          // don't roll back — admin can re-fork from the templates page.
          const msg = await extractError(forkErr);
          setErr(`Custom type created, but starter fork failed: ${msg}`);
          onError(`Custom type created, but starter fork failed: ${msg}`);
          setSaving(false);
          return;
        }
      }

      onCreated();
    } catch (e) {
      const msg = await extractError(e);
      setErr(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-[520px] h-full overflow-y-auto shadow-sh2 p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="text-[14px] font-semibold text-n-900">New custom survey type</div>
          <button
            type="button"
            onClick={onClose}
            className="text-n-500 hover:text-n-800 text-[12px]"
          >
            Close
          </button>
        </div>

        {err && (
          <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
            {err}
          </div>
        )}

        <Field label="Code (uppercase, underscores)">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="PRE_HANDOVER"
            className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] font-mono"
          />
          {code && !codeValid && (
            <div className="text-[10.5px] text-bad mt-0.5">Invalid — 2-40 chars, A-Z/0-9/_.</div>
          )}
          {codeValid && codeCollision && (
            <div className="text-[10.5px] text-bad mt-0.5">Already in use.</div>
          )}
        </Field>

        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
            placeholder="Pre-handover checklist"
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-n-200 rounded-r1 px-2 py-1.5 text-[12.5px] min-h-[60px]"
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

        <div>
          <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
            Starter template
          </div>
          <div className="space-y-1.5">
            <label
              className={[
                'flex items-start gap-2 border rounded-r2 px-3 py-2 cursor-pointer',
                starterMode === 'scratch'
                  ? 'border-a-300 bg-a-50'
                  : 'border-n-200 bg-white hover:bg-n-50',
              ].join(' ')}
            >
              <input
                type="radio"
                name="starterMode"
                className="mt-0.5"
                checked={starterMode === 'scratch'}
                onChange={() => setStarterMode('scratch')}
              />
              <div>
                <div className="text-[12.5px] font-medium text-n-900">Build from scratch</div>
                <div className="text-[11px] text-n-500">Hand-write 3 starter questions below.</div>
              </div>
            </label>
            <label
              className={[
                'flex items-start gap-2 border rounded-r2 px-3 py-2 cursor-pointer',
                starterMode === 'fork'
                  ? 'border-a-300 bg-a-50'
                  : 'border-n-200 bg-white hover:bg-n-50',
              ].join(' ')}
            >
              <input
                type="radio"
                name="starterMode"
                className="mt-0.5"
                checked={starterMode === 'fork'}
                onChange={() => setStarterMode('fork')}
              />
              <div className="flex-1">
                <div className="text-[12.5px] font-medium text-n-900">Fork a system template</div>
                <div className="text-[11px] text-n-500 mb-1.5">
                  Copy questions from an existing system survey template into your new starter.
                </div>
                {starterMode === 'fork' && (
                  <select
                    value={forkSourceId}
                    onChange={(e) => setForkSourceId(e.target.value)}
                    className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12px] bg-white"
                  >
                    <option value="">— pick a system template —</option>
                    {systemTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.surveyType} ({t.questionCount} q)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </label>
          </div>
        </div>

        {starterMode === 'scratch' && (
        <div>
          <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
            Starter questions (min 3)
          </div>
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={q.id} className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-n-500 w-6">{q.id}</span>
                <input
                  value={q.prompt}
                  onChange={(e) => {
                    const next = [...questions];
                    next[i] = { ...q, prompt: e.target.value };
                    setQuestions(next);
                  }}
                  placeholder="Question prompt"
                  className="flex-1 border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
                />
                <select
                  value={q.type}
                  onChange={(e) => {
                    const next = [...questions];
                    next[i] = { ...q, type: e.target.value as typeof q.type };
                    setQuestions(next);
                  }}
                  className="border border-n-200 rounded-r1 h-8 px-2 text-[12px] bg-white"
                >
                  <option value="yes_no_partial">yes/no/partial</option>
                  <option value="number">number</option>
                  <option value="text">text</option>
                </select>
                {questions.length > 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuestions(questions.filter((_, idx) => idx !== i));
                    }}
                    className="text-n-500 hover:text-bad"
                    aria-label="Remove question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <Btn2
              variant="ghost"
              leading={<Plus className="w-3.5 h-3.5" />}
              onClick={() =>
                setQuestions([
                  ...questions,
                  {
                    id: `q${questions.length + 1}`,
                    prompt: '',
                    type: 'yes_no_partial',
                    weight: 1,
                  },
                ])
              }
            >
              Add question
            </Btn2>
          </div>
        </div>
        )}

        <div className="pt-4 border-t border-n-100 flex justify-end gap-2">
          <Btn2 variant="ghost" onClick={onClose}>Cancel</Btn2>
          <Btn2 variant="primary" disabled={!canSubmit} onClick={submit}>
            {saving ? 'Saving…' : 'Create'}
          </Btn2>
        </div>
      </div>
    </div>
  );
}

// ─── Defaults tab ─────────────────────────────────────────────
function DefaultsTab({
  defaults, templates, enabledTypes, onChanged, onError,
}: {
  defaults: AssetTypeSurveyDefault[];
  templates: SurveyTemplateSummary[];
  enabledTypes: string[];
  onChanged: () => void;
  onError: (e: string | null) => void;
}) {
  const byAssetType = useMemo(() => {
    const m = new Map<AssetType, AssetTypeSurveyDefault[]>();
    for (const d of defaults) {
      if (!m.has(d.assetType)) m.set(d.assetType, []);
      m.get(d.assetType)!.push(d);
    }
    return m;
  }, [defaults]);

  const allowedBuiltIn: SurveyType[] = BUILTIN_TYPES.filter((t) => enabledTypes.includes(t));

  async function setAssetTypeDefault(
    at: AssetType,
    surveyType: SurveyType,
    templateId: string | null,
  ) {
    onError(null);
    try {
      await adminSurveyConfigApi.upsertDefault({
        assetType: at,
        surveyType,
        isDefault: true,
        templateId,
      });
      onChanged();
    } catch (err) {
      onError(await extractError(err));
    }
  }

  async function removeDefault(id: string) {
    if (!window.confirm('Remove this default?')) return;
    onError(null);
    try {
      await adminSurveyConfigApi.removeDefault(id);
      onChanged();
    } catch (err) {
      onError(await extractError(err));
    }
  }

  return (
    <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 overflow-hidden">
      <table className="w-full text-[12.5px]">
        <thead className="bg-n-50 text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">
          <tr>
            <th className="text-left px-4 py-2">Asset type</th>
            <th className="text-left px-4 py-2">Default survey type</th>
            <th className="text-left px-4 py-2">Template</th>
            <th className="text-right px-4 py-2 w-[80px]"></th>
          </tr>
        </thead>
        <tbody>
          {ASSET_TYPES.map((at) => {
            const rows = byAssetType.get(at) ?? [];
            const defaultRow = rows.find((r) => r.isDefault);
            return (
              <tr key={at} className="border-t border-n-100">
                <td className="px-4 py-2 text-n-900 font-mono">{at}</td>
                <td className="px-4 py-2">
                  <select
                    value={defaultRow?.surveyType ?? ''}
                    onChange={(e) => {
                      const v = e.target.value as SurveyType;
                      if (!v) return;
                      setAssetTypeDefault(at, v, defaultRow?.templateId ?? null);
                    }}
                    className="border border-n-200 rounded-r1 h-8 px-2 text-[12px] bg-white"
                  >
                    <option value="">— none —</option>
                    {allowedBuiltIn.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  {defaultRow ? (
                    <select
                      value={defaultRow.templateId ?? ''}
                      onChange={(e) => {
                        setAssetTypeDefault(
                          at,
                          defaultRow.surveyType,
                          e.target.value || null,
                        );
                      }}
                      className="border border-n-200 rounded-r1 h-8 px-2 text-[12px] bg-white w-full max-w-[280px]"
                    >
                      <option value="">— any —</option>
                      {templates
                        .filter((t) => t.surveyType === defaultRow.surveyType)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.isSystem ? '(system)' : ''}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span className="text-n-400 text-[11.5px] inline-flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" /> pick type first
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {defaultRow && (
                    <button
                      type="button"
                      onClick={() => removeDefault(defaultRow.id)}
                      className="w-7 h-7 inline-flex items-center justify-center text-n-500 hover:bg-bad-bg hover:text-bad rounded-r1"
                      aria-label="Remove default"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Schedules tab ────────────────────────────────────────────
function SchedulesTab({
  templates, onError,
}: {
  templates: SurveyTemplateSummary[];
  onError: (e: string | null) => void;
}) {
  const [schedules, setSchedules] = useState<SurveyScheduleSummary[]>([]);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const [sch, cls, us] = await Promise.all([
        surveySchedulesApi.list(),
        clustersApi.list(),
        usersApi.list({ active: true }),
      ]);
      setSchedules(sch.items);
      setClusters(cls.items);
      setUsers(us.items);
    } catch (err) {
      onError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => { void load(); }, [load]);

  async function togglePause(row: SurveyScheduleSummary) {
    onError(null);
    try {
      await surveySchedulesApi.update(row.id, {
        status: row.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
      });
      await load();
    } catch (err) {
      onError(await extractError(err));
    }
  }

  async function runNow(row: SurveyScheduleSummary) {
    if (!window.confirm(`Run "${row.templateName}" now for ${row.clusterName}?`)) return;
    onError(null);
    try {
      await surveySchedulesApi.runNow(row.id);
      await load();
    } catch (err) {
      onError(await extractError(err));
    }
  }

  async function remove(row: SurveyScheduleSummary) {
    if (!window.confirm('Delete this schedule? Past DRAFTs are kept.')) return;
    onError(null);
    try {
      await surveySchedulesApi.remove(row.id);
      await load();
    } catch (err) {
      onError(await extractError(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-n-150 rounded-r3 shadow-sh1">
        <div className="px-4 py-3 border-b border-n-150 flex items-center">
          <div>
            <div className="text-[12.5px] font-medium text-n-900">Scheduled surveys</div>
            <div className="text-[11px] text-n-500">
              Cron-driven DRAFT creation. Assignees get a bell notification the moment a draft appears.
            </div>
          </div>
          <Btn2
            variant="primary"
            leading={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setDrawerOpen(true)}
            className="ml-auto"
          >
            New schedule
          </Btn2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[12px] text-n-500">Loading…</div>
        ) : schedules.length === 0 ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-r2 bg-n-75 text-n-500 mb-3">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="text-[12.5px] font-medium text-n-800 mb-1">No schedules yet</div>
            <div className="text-[11.5px] text-n-500">
              Create one to auto-generate recurring DRAFT surveys for an assignee.
            </div>
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="bg-n-50 text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">
              <tr>
                <th className="text-left px-4 py-2">Template</th>
                <th className="text-left px-4 py-2">Cluster</th>
                <th className="text-left px-4 py-2">Assignee</th>
                <th className="text-left px-4 py-2">Cron</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Next run</th>
                <th className="text-right px-4 py-2 w-[150px]"></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-t border-n-100">
                  <td className="px-4 py-2 text-n-900">{s.templateName ?? '—'}</td>
                  <td className="px-4 py-2 text-n-700">{s.clusterName ?? '—'}</td>
                  <td className="px-4 py-2 text-n-700">{s.assignedToName ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-[11.5px] text-n-700">{s.cron}</td>
                  <td className="px-4 py-2">
                    <Pill variant={s.status === 'ACTIVE' ? 'ok' : 'warn'}>{s.status}</Pill>
                  </td>
                  <td className="px-4 py-2 text-n-600 text-[11.5px]">
                    {s.status === 'PAUSED' ? '—' : s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void togglePause(s)}
                        className="w-7 h-7 inline-flex items-center justify-center text-n-500 hover:bg-n-100 hover:text-n-800 rounded-r1"
                        aria-label={s.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                        title={s.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                      >
                        {s.status === 'ACTIVE' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runNow(s)}
                        className="w-7 h-7 inline-flex items-center justify-center text-n-500 hover:bg-a-50 hover:text-a-700 rounded-r1"
                        aria-label="Run now"
                        title="Run now (fires within 60s)"
                      >
                        <Play className="w-3.5 h-3.5" fill="currentColor" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(s)}
                        className="w-7 h-7 inline-flex items-center justify-center text-n-500 hover:bg-bad-bg hover:text-bad rounded-r1"
                        aria-label="Delete schedule"
                        title="Delete schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {drawerOpen && (
        <NewScheduleDrawer
          templates={templates}
          clusters={clusters}
          users={users}
          onClose={() => setDrawerOpen(false)}
          onCreated={() => {
            setDrawerOpen(false);
            void load();
          }}
          onError={onError}
        />
      )}
    </div>
  );
}

const CRON_PRESETS: Array<{ label: string; cron: string; description: string }> = [
  { label: 'Daily at 09:00 UTC', cron: '0 9 * * *', description: 'Every day at 9 am UTC' },
  { label: 'Weekly (Mon 09:00 UTC)', cron: '0 9 * * 1', description: 'Every Monday at 9 am UTC' },
  { label: 'Monthly (1st 09:00 UTC)', cron: '0 9 1 * *', description: 'First day of the month, 9 am UTC' },
  { label: 'Quarterly (1 Jan/Apr/Jul/Oct)', cron: '0 9 1 */3 *', description: 'Every three months, 9 am UTC' },
];

function NewScheduleDrawer({
  templates, clusters, users, onClose, onCreated, onError,
}: {
  templates: SurveyTemplateSummary[];
  clusters: ClusterSummary[];
  users: UserSummary[];
  onClose: () => void;
  onCreated: () => void;
  onError: (e: string | null) => void;
}) {
  const [clusterId, setClusterId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [preset, setPreset] = useState<string>(CRON_PRESETS[1].cron);
  const [advanced, setAdvanced] = useState(false);
  const [rawCron, setRawCron] = useState<string>(CRON_PRESETS[1].cron);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const effectiveCron = advanced ? rawCron.trim() : preset;

  const activeTemplates = templates.filter((t) => t.isActive);

  const canSave = !!clusterId && !!templateId && !!assignedToId && !!effectiveCron && !saving;

  async function submit() {
    setSaving(true);
    setErr(null);
    onError(null);
    try {
      const data: SurveyScheduleCreateInput = {
        clusterId,
        templateId,
        assignedToId,
        cron: effectiveCron,
        status: 'ACTIVE',
      };
      await surveySchedulesApi.create(data);
      onCreated();
    } catch (e) {
      const msg = await extractError(e);
      setErr(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

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
          <div className="text-[14px] font-semibold text-n-900">New survey schedule</div>
          <button
            type="button"
            onClick={onClose}
            className="text-n-500 hover:text-n-800 text-[12px]"
          >
            Close
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
              value={clusterId}
              onChange={(e) => setClusterId(e.target.value)}
              className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
            >
              <option value="">— pick a cluster —</option>
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.clusterType}</option>
              ))}
            </select>
          </Field>

          <Field label="Template *">
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
            >
              <option value="">— pick a template —</option>
              {activeTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.surveyType}{t.isSystem ? ' (system)' : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Assignee *">
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
            >
              <option value="">— pick a user —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} · {u.role}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cadence *">
            <div className="space-y-1.5">
              {CRON_PRESETS.map((p) => (
                <label
                  key={p.cron}
                  className={[
                    'flex items-center gap-2 border rounded-r2 px-3 py-2 cursor-pointer',
                    !advanced && preset === p.cron
                      ? 'border-a-300 bg-a-50'
                      : 'border-n-200 bg-white hover:bg-n-50',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="preset"
                    disabled={advanced}
                    checked={!advanced && preset === p.cron}
                    onChange={() => setPreset(p.cron)}
                  />
                  <div className="flex-1">
                    <div className="text-[12.5px] font-medium text-n-900">{p.label}</div>
                    <div className="text-[11px] text-n-500">{p.description}</div>
                  </div>
                  <span className="font-mono text-[10.5px] text-n-500 tracking-[0.4px]">{p.cron}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-[12.5px] text-n-800 mt-2">
                <input
                  type="checkbox"
                  checked={advanced}
                  onChange={() => setAdvanced(!advanced)}
                />
                Advanced: raw cron
              </label>
              {advanced && (
                <input
                  value={rawCron}
                  onChange={(e) => setRawCron(e.target.value)}
                  placeholder="* * * * *"
                  className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] font-mono"
                />
              )}
            </div>
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-n-150 px-5 py-3">
          <Btn2 variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn2>
          <Btn2 variant="primary" onClick={submit} disabled={!canSave}>
            {saving ? 'Creating…' : 'Create schedule'}
          </Btn2>
        </div>
      </div>
    </div>
  );
}

export default AdminSurveyConfigPage;
