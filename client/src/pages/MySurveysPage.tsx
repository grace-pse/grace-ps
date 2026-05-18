// P3 — "My surveys" inbox for the current user. Shows DRAFT responses
// where I'm the conductedBy (the scheduler assigns DRAFTs to the named
// assignee, and auto-created drafts appear here). Oldest first so the
// most overdue survey rises to the top.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ClipboardCheck, Inbox } from 'lucide-react';

import { Topbar } from '../components/shell/Topbar';
import { Pill } from '../components/hifi/Pill';
import { surveysApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import type { SurveyResponseSummary } from '../lib/csmp-types';

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

export function MySurveysPage() {
  const [items, setItems] = useState<SurveyResponseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await surveysApi.list({ status: 'DRAFT' });
      setItems(res.items);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const mine = useMemo(() => {
    if (!user) return [];
    return items
      .filter((s) => s.conductedById === user.id)
      .sort((a, b) => new Date(a.conductedAt).getTime() - new Date(b.conductedAt).getTime());
  }, [items, user]);

  return (
    <>
      <Topbar
        breadcrumbs={<span>Work / My surveys</span>}
        title="My surveys"
        subtitle={`${mine.length} draft${mine.length === 1 ? '' : 's'} assigned to you`}
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
        ) : mine.length === 0 ? (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-r2 bg-n-75 text-n-500 mb-3">
              <Inbox className="w-5 h-5" />
            </div>
            <div className="text-[13px] font-medium text-n-800 mb-1">Nothing to do right now</div>
            <div className="text-[12px] text-n-500">
              Scheduled surveys assigned to you land here as DRAFTs when they come due.
            </div>
          </div>
        ) : (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead className="bg-n-50 text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">
                <tr>
                  <th className="text-left px-4 py-2">Template</th>
                  <th className="text-left px-4 py-2">Cluster</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Age</th>
                  <th className="text-left px-4 py-2">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((s) => {
                  const age = daysSince(s.conductedAt);
                  const overdue = age >= 7;
                  return (
                    <tr key={s.id} className="border-t border-n-100 hover:bg-n-50">
                      <td className="px-4 py-2.5">
                        <Link
                          to="/surveys/$id"
                          params={{ id: s.id }}
                          className="font-medium text-n-900 hover:text-a-700 inline-flex items-center gap-1.5"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5 text-n-500" />
                          {s.templateName ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-n-700">{s.clusterName ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <Pill variant="accent">{s.surveyType.replace('_', ' ')}</Pill>
                      </td>
                      <td className="px-4 py-2.5">
                        {overdue ? (
                          <Pill variant="bad">{age}d overdue</Pill>
                        ) : age === 0 ? (
                          <span className="text-n-500 text-[11.5px]">today</span>
                        ) : (
                          <span className="text-n-700">{age}d</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-n-600 text-[11.5px]">
                        {new Date(s.conductedAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default MySurveysPage;
