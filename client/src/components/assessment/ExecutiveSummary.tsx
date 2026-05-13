import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { assessmentsApi } from '../../lib/csmp-api';
import { extractError } from '../../lib/api';
import type { AssessmentSummaryResponse } from '../../lib/csmp-types';
import { Btn2 } from '../hifi/Btn2';
import { HeroStrip } from './summary/HeroStrip';
import { PostureKpis } from './summary/PostureKpis';
import { DistributionBars } from './summary/DistributionBars';
import { TopThreatsTable } from './summary/TopThreatsTable';
import { ActionPlanProgress } from './summary/ActionPlanProgress';
import { ComplianceCoverage } from './summary/ComplianceCoverage';
import { ProtectiveCoverage } from './summary/ProtectiveCoverage';
import { RecommendationsList } from './summary/RecommendationsList';

interface ExecutiveSummaryProps {
  assessmentId: string;
  assessmentTitle: string;
  onDownloadReport: () => void | Promise<void>;
  downloadingReport: boolean;
}

const IRV_LABEL: Record<string, string> = {
  EXTREME: 'Extreme',
  HIGH: 'High',
  MODERATE: 'Moderate',
  LOW: 'Low',
  NEGLIGIBLE: 'Negligible',
  UNSCORED: 'Unscored',
};
const IRV_TONE: Record<string, 'Extreme' | 'High' | 'Moderate' | 'Low' | 'Negligible' | 'Neutral'> = {
  EXTREME: 'Extreme',
  HIGH: 'High',
  MODERATE: 'Moderate',
  LOW: 'Low',
  NEGLIGIBLE: 'Negligible',
  UNSCORED: 'Neutral',
};

const PRIORITY_LABEL: Record<string, string> = {
  HIGHEST: 'Highest',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  UNSCORED: 'Unscored',
};
const PRIORITY_TONE: Record<string, 'Extreme' | 'High' | 'Moderate' | 'Low' | 'Neutral'> = {
  HIGHEST: 'Extreme',
  HIGH: 'High',
  MEDIUM: 'Moderate',
  LOW: 'Low',
  UNSCORED: 'Neutral',
};

const TEAR_LABEL_MAP: Record<string, string> = {
  REDUCE: 'Reduce',
  TRANSFER: 'Transfer',
  ACCEPT: 'Accept',
  ELIMINATE: 'Eliminate',
  UNSCORED: 'Not set',
};
const TEAR_TONE: Record<string, 'Neutral'> = {
  REDUCE: 'Neutral',
  TRANSFER: 'Neutral',
  ACCEPT: 'Neutral',
  ELIMINATE: 'Neutral',
  UNSCORED: 'Neutral',
};

const VULN_LABEL_MAP: Record<string, string> = {
  INADEQUATE: 'Inadequate',
  BARELY_ADEQUATE: 'Barely adequate',
  BASELINE: 'Baseline',
  STRONG: 'Strong',
  UNSCORED: 'Unscored',
};
const VULN_TONE: Record<string, 'Extreme' | 'High' | 'Moderate' | 'Low' | 'Neutral'> = {
  INADEQUATE: 'Extreme',
  BARELY_ADEQUATE: 'High',
  BASELINE: 'Moderate',
  STRONG: 'Low',
  UNSCORED: 'Neutral',
};

export function ExecutiveSummary({
  assessmentId,
  assessmentTitle,
  onDownloadReport,
  downloadingReport,
}: ExecutiveSummaryProps) {
  const [data, setData] = useState<AssessmentSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await assessmentsApi.getSummary(assessmentId);
      setData(res);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-6 text-center text-[12px] text-n-500">
        Loading executive summary…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2 text-[12px] text-bad">
        {error ?? 'Failed to load summary.'}
      </div>
    );
  }

  void assessmentTitle;
  const totalThreats = data.posture.totalThreats;

  return (
    <div className="space-y-4">
      <HeroStrip hero={data.hero} />

      <PostureKpis posture={data.posture} actionPlan={data.actionPlan} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DistributionBars
          title="Risk severity (IRV)"
          subtitle="Inherent risk band — likelihood × impact"
          buckets={data.irvDistribution}
          labels={IRV_LABEL}
          tones={IRV_TONE}
        />
        <DistributionBars
          title="Treatment priority"
          subtitle="IRV × vulnerability — what gets attention first"
          buckets={data.priorityDistribution}
          labels={PRIORITY_LABEL}
          tones={PRIORITY_TONE}
        />
      </div>

      <TopThreatsTable threats={data.topThreats} />

      <ActionPlanProgress actionPlan={data.actionPlan} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DistributionBars
          title="Treatment strategy (TEAR)"
          subtitle="How each threat is being handled"
          buckets={data.tearMix}
          labels={TEAR_LABEL_MAP}
          tones={TEAR_TONE}
        />
        <DistributionBars
          title="Vulnerability posture"
          subtitle="Control strength against in-scope threats"
          buckets={data.vulnerabilityMix}
          labels={VULN_LABEL_MAP}
          tones={VULN_TONE}
        />
      </div>

      <ComplianceCoverage items={data.compliance} totalThreats={totalThreats} />

      <ProtectiveCoverage items={data.protectiveCoverage} />

      <RecommendationsList items={data.recommendations} />

      <div className="flex justify-end">
        <Btn2
          variant="primary"
          leading={<Download className="w-3.5 h-3.5" />}
          disabled={downloadingReport}
          onClick={() => void onDownloadReport()}
        >
          {downloadingReport ? 'Generating PDF…' : 'Download PDF report'}
        </Btn2>
      </div>
    </div>
  );
}
