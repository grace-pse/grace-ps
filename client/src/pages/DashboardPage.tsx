import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ClipboardCheck, AlertTriangle, CheckCircle2, Flame } from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Card, CardHeader, KPICard, Pill } from '../components/hifi';
import { RiskBadge } from '../components/hifi/RiskBadge';
import { Btn2 } from '../components/hifi/Btn2';
import { assessmentsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import { PRIORITY_TO_LEVEL, REVIEW_STATUS_VARIANT, statusLabel } from '../lib/risk-ui';
import { useAuthStore } from '../stores/auth';
import type { AssessmentSummary } from '../lib/csmp-types';

const IN_FLIGHT_STATUSES = new Set<AssessmentSummary['status']>([
  'STEP_1_ASSETS', 'STEP_2_THREATS', 'STEP_3_LIKELIHOOD', 'STEP_4_IMPACT',
  'STEP_5_IRV', 'STEP_6_VULNERABILITY', 'STEP_7_TREATMENT',
]);

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const org = useAuthStore((s) => s.organization);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  });

  const [items, setItems] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await assessmentsApi.list({ pageSize: 200 });
        if (!cancelled) setItems(res.items);
      } catch (err) {
        if (!cancelled) setError(await extractError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const inFlight = items.filter((a) => IN_FLIGHT_STATUSES.has(a.status)).length;
  const awaitingReview = items.filter((a) => a.status === 'REVIEW' || a.reviewStatus === 'IN_REVIEW').length;
  const approved = items.filter((a) => a.status === 'APPROVED').length;
  const highRisk = items.filter((a) => a.highestPriority === 'HIGH' || a.highestPriority === 'HIGHEST').length;

  const recent = [...items]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <>
      <Topbar
        breadcrumbs={<span>{org?.name} · {today}</span>}
        title={`Welcome, ${user?.firstName}`}
        subtitle="GRACE Engine · 3-A methodology"
        actions={<Pill variant="accent">v2 · phase 1</Pill>}
      />

      <div className="p-6 space-y-6">
        {error && (
          <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-4 gap-3">
          <KPICard
            label="In progress"
            value={loading ? '—' : String(inFlight)}
            sub="assessments being worked"
          />
          <KPICard
            label="Awaiting review"
            value={loading ? '—' : String(awaitingReview)}
            sub="ready for sign-off"
          />
          <KPICard
            label="Approved"
            value={loading ? '—' : String(approved)}
            sub="signed off & archived"
          />
          <KPICard
            label="High-risk threats"
            value={loading ? '—' : String(highRisk)}
            sub="HIGH or HIGHEST priority"
          />
        </div>

        <Card>
          <CardHeader
            title="Recent assessments"
            subtitle="Latest activity"
            actions={
              <Link to="/assessments">
                <Btn2 variant="ghost">View all</Btn2>
              </Link>
            }
          />
          {loading ? (
            <div className="p-5 text-[12.5px] text-n-500">Loading…</div>
          ) : recent.length === 0 ? (
            <div className="p-5 flex items-center justify-between">
              <div className="text-[12.5px] text-n-600">
                No assessments yet. Start your first one to populate this dashboard.
              </div>
              <Link to="/assessments">
                <Btn2 variant="primary">Go to assessments</Btn2>
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-n-50 border-b border-t border-n-150">
                <tr className="text-[10.5px] font-mono uppercase text-n-500 tracking-[0.4px]">
                  <th className="text-left px-4 py-2">Title</th>
                  <th className="text-left px-3 py-2">Step</th>
                  <th className="text-left px-3 py-2">Review</th>
                  <th className="text-left px-3 py-2">Top priority</th>
                  <th className="text-left px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.id} className="border-b border-n-100 hover:bg-n-25 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link
                        to="/assessments/$id"
                        params={{ id: a.id }}
                        className="text-[13px] font-medium text-n-900 hover:text-a-600"
                      >
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-n-600">{statusLabel(a.status)}</td>
                    <td className="px-3 py-2.5">
                      <Pill variant={REVIEW_STATUS_VARIANT[a.reviewStatus]}>{a.reviewStatus}</Pill>
                    </td>
                    <td className="px-3 py-2.5">
                      {a.highestPriority
                        ? <RiskBadge level={PRIORITY_TO_LEVEL[a.highestPriority]} value={a.highestPriority} />
                        : <span className="text-[11px] text-n-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] font-mono text-n-500">
                      {new Date(a.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div className="grid grid-cols-4 gap-3">
          <Status icon={<ClipboardCheck className="w-3.5 h-3.5" />} label="Assessments" state="ok" />
          <Status icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Assets & Clusters" state="ok" />
          <Status icon={<Flame className="w-3.5 h-3.5" />} label="Template library" state="ok" />
          <Status icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Incidents (Phase 2)" state="pending" />
        </div>
      </div>
    </>
  );
}

function Status({ icon, label, state }: { icon: React.ReactNode; label: string; state: 'ok' | 'pending' }) {
  const cls =
    state === 'ok'
      ? 'bg-ok-bg text-ok border-ok/20'
      : 'bg-n-75 text-n-500 border-n-150';
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-r2 border ${cls}`}>
      {icon}
      <span className="text-[11.5px] font-medium">{label}</span>
    </div>
  );
}
