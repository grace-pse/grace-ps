// Admin page for survey templates. Lists system + tenant-owned
// templates. System templates are read-only; admins can fork them into
// an editable tenant copy (matching the template-library fork pattern).
// The forked copy can then be renamed, activated/deactivated, and
// (later) edited question-by-question.

import { useCallback, useEffect, useState } from 'react';
import { GitFork, Trash2, Power, Package, ListChecks } from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Pill } from '../components/hifi/Pill';
import { SurveyTemplateEditDrawer } from '../components/admin/SurveyTemplateEditDrawer';
import { surveyTemplatesApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import type { SurveyTemplateSummary } from '../lib/csmp-types';

export function SurveyTemplatesPage() {
  const [items, setItems] = useState<SurveyTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SurveyTemplateSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await surveyTemplatesApi.list();
      setItems(res.items);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleFork(t: SurveyTemplateSummary) {
    const name = window.prompt('Name for the forked template', `${t.name} (fork)`);
    if (!name || !name.trim()) return;
    try {
      await surveyTemplatesApi.fork(t.id, { name: name.trim() });
      await load();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function handleToggleActive(t: SurveyTemplateSummary) {
    try {
      await surveyTemplatesApi.update(t.id, { isActive: !t.isActive });
      await load();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function handleDelete(t: SurveyTemplateSummary) {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    try {
      await surveyTemplatesApi.remove(t.id);
      await load();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  return (
    <>
      <Topbar
        breadcrumbs={<span>Admin / Survey templates</span>}
        title="Survey templates"
        subtitle={`${items.length} total · system + tenant-owned`}
      />

      <div className="p-6 space-y-4">
        {error && (
          <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center text-[12.5px] text-n-500">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-r2 bg-n-75 text-n-500 mb-3">
              <Package className="w-5 h-5" />
            </div>
            <div className="text-[13px] font-medium text-n-800 mb-1">No templates</div>
            <div className="text-[12px] text-n-500">
              System templates should seed automatically via migration 8.
            </div>
          </div>
        ) : (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead className="bg-n-50 text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">
                <tr>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Questions</th>
                  <th className="text-left px-4 py-2">Scope</th>
                  <th className="text-left px-4 py-2">Ownership</th>
                  <th className="text-left px-4 py-2">Active</th>
                  <th className="text-right px-4 py-2 w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} className="border-t border-n-100 hover:bg-n-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-n-900">{t.name}</div>
                      {t.description && (
                        <div className="text-[11px] text-n-500 mt-0.5">{t.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Pill variant="accent">{t.surveyType.replace('_', ' ')}</Pill>
                    </td>
                    <td className="px-4 py-2.5 text-n-700 font-mono text-[11.5px]">
                      {t.questionCount}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-n-600">
                      {t.applicableClusterTypes.length > 0 && (
                        <div>Clusters: {t.applicableClusterTypes.join(', ')}</div>
                      )}
                      {t.applicableAssetTypes.length > 0 && (
                        <div>Assets: {t.applicableAssetTypes.join(', ')}</div>
                      )}
                      {t.applicableClusterTypes.length === 0
                        && t.applicableAssetTypes.length === 0 && (
                          <span className="text-n-400">any</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.isSystem ? (
                        <Pill variant="outline">system</Pill>
                      ) : (
                        <Pill variant="info">tenant</Pill>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.isActive ? (
                        <Pill variant="ok">active</Pill>
                      ) : (
                        <Pill variant="default">inactive</Pill>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleFork(t)}
                          className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 hover:text-n-800 rounded-r1"
                          aria-label={`Fork ${t.name}`}
                          title="Fork"
                        >
                          <GitFork className="w-3.5 h-3.5" />
                        </button>
                        {!t.isSystem && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditing(t)}
                              className="w-7 h-7 flex items-center justify-center text-a-600 hover:bg-a-50 hover:text-a-700 rounded-r1"
                              aria-label={`Edit ${t.name}`}
                              title="Edit (name, description, questions)"
                            >
                              <ListChecks className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(t)}
                              className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 hover:text-n-800 rounded-r1"
                              aria-label={t.isActive ? `Deactivate ${t.name}` : `Activate ${t.name}`}
                              title={t.isActive ? 'Deactivate' : 'Activate'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(t)}
                              className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-bad-bg hover:text-bad rounded-r1"
                              aria-label={`Delete ${t.name}`}
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-[11.5px] text-n-500">
          System templates are read-only. Fork one to make a tenant-owned editable copy —
          then click the edit icon to rename it, change the description, or customise
          the questionnaire.
        </div>
      </div>

      {editing && (
        <SurveyTemplateEditDrawer
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </>
  );
}

export default SurveyTemplatesPage;
