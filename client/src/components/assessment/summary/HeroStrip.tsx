import { CheckCircle2 } from 'lucide-react';
import type { AssessmentSummaryHero } from '../../../lib/csmp-types';
import { EVIDENCE_BASIS_LABEL } from '../../../lib/csmp-types';
import { Card } from '../../hifi/Card';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface HeroStripProps {
  hero: AssessmentSummaryHero;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase font-mono text-n-500 tracking-[0.4px]">{label}</div>
      <div className="text-[12.5px] text-n-900 mt-0.5 truncate">{value || '—'}</div>
    </div>
  );
}

export function HeroStrip({ hero }: HeroStripProps) {
  const scope = hero.assetName ?? hero.clusterName ?? '—';
  const period = hero.period ?? (hero.startedAt && hero.completedAt
    ? `${formatDate(hero.startedAt)} → ${formatDate(hero.completedAt)}`
    : null);

  return (
    <Card accent className="px-[14px] py-3">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <CheckCircle2 className="w-4 h-4 text-ok" />
            <span className="text-[10px] uppercase font-mono text-ok tracking-[0.4px]">
              Approved · v{hero.version}
            </span>
          </div>
          <div className="text-[16px] font-semibold tracking-[-0.3px] text-n-900">Executive summary</div>
          <div className="text-[12px] text-n-500">
            Signed off {formatDate(hero.signedOffAt ?? hero.completedAt)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Field label="Scope" value={scope} />
        <Field label="Period" value={period} />
        <Field label="Lead assessor" value={hero.leadAssessorName} />
        <Field label="Approver" value={hero.approverName} />
        <Field label="Reviewer" value={hero.reviewerName} />
        <Field label="Evidence" value={EVIDENCE_BASIS_LABEL[hero.evidenceBasis]} />
      </div>

      {hero.scopeDescription && (
        <div className="mt-3 pt-3 border-t border-n-150">
          <div className="text-[10px] uppercase font-mono text-n-500 tracking-[0.4px] mb-1">
            Scope description
          </div>
          <p className="text-[12.5px] text-n-700 whitespace-pre-wrap">{hero.scopeDescription}</p>
        </div>
      )}

      {hero.reviewNotes && (
        <div className="mt-3 pt-3 border-t border-n-150">
          <div className="text-[10px] uppercase font-mono text-n-500 tracking-[0.4px] mb-1">
            Reviewer notes
          </div>
          <p className="text-[12.5px] text-n-700 whitespace-pre-wrap">{hero.reviewNotes}</p>
        </div>
      )}
    </Card>
  );
}
