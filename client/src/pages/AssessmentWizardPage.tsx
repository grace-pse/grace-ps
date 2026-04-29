import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, CheckCircle2, Plus, Trash2, Send, Sparkles, Search, ArrowUp, ArrowDown, Download, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Btn2 } from '../components/hifi/Btn2';
import { Pill } from '../components/hifi/Pill';
import { RiskBadge } from '../components/hifi/RiskBadge';
import { TagMultiSelect } from '../components/hifi/TagMultiSelect';
import { HistoryPanel } from '../components/HistoryPanel';
import { ApproverPicker } from '../components/ApproverPicker';
import { RecommendationsEditor } from '../components/RecommendationsEditor';
import { assessmentsApi, assetsApi, actionPlansApi, surveysApi, assessmentSurveyLinksApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import { hasPermission } from '../lib/permissions';
import { useAuthStore } from '../stores/auth';
import {
  IRV_TO_LEVEL, PRIORITY_TO_LEVEL, REVIEW_STATUS_VARIANT, STEP_LABELS, STEP_KICKERS, VULN_LABEL,
  TEAR_LABEL, TEAR_BLURB,
} from '../lib/risk-ui';
import {
  ADVERSARY_TYPES, ACTION_TYPES, VULNERABILITY_RATINGS, TEAR_STRATEGIES,
  COMPLIANCE_TAG_LABEL,
  OPERATIONAL_STATUS_LABEL,
  type AssessmentDetail, type ThreatSummary, type ActionPlan, type AdversaryType, type ActionType,
  type AssetSummary, type ImpactBreakdown, type VulnerabilityRating, type TearStrategy, type SuggestedThreat,
  type ComplianceTag,
  type AssessmentSurveyLink, type SurveyResponseSummary,
  type ProtectiveCoverageItem, type OperationalStatus,
} from '../lib/csmp-types';

export function AssessmentWizardPage() {
  const { id } = useParams({ from: '/protected/assessments/$id' });
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [viewStep, setViewStep] = useState<number | null>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, assetsRes, plansRes] = await Promise.all([
        assessmentsApi.get(id),
        assetsApi.list({ pageSize: 200 }),
        actionPlansApi.listForAssessment(id),
      ]);
      setAssessment(a);
      setAssets(assetsRes.items);
      setActionPlans(plansRes.items);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function handleAdvance() {
    if (!assessment) return;
    setAdvancing(true);
    setError(null);
    try {
      await assessmentsApi.advance(assessment.id);
      await load();
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setAdvancing(false);
    }
  }

  async function handleDownloadReport() {
    if (!assessment) return;
    setDownloadingReport(true);
    setError(null);
    try {
      const blob = await assessmentsApi.downloadReport(assessment.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${assessment.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'report'}-${assessment.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setDownloadingReport(false);
    }
  }

  async function handleReview(action: 'approve' | 'reject', notes: string) {
    if (!assessment) return;
    try {
      await assessmentsApi.review(assessment.id, action, notes);
      await load();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  if (loading) {
    return <div className="p-10 text-center text-[13px] text-n-500">Loading assessment…</div>;
  }
  if (!assessment) {
    return (
      <div className="p-10 text-center">
        <div className="text-[13px] text-n-700 mb-3">{error ?? 'Assessment not found'}</div>
        <Link to="/assessments"><Btn2 variant="secondary">Back to assessments</Btn2></Link>
      </div>
    );
  }

  const step = assessment.currentStep;
  const inReview = assessment.status === 'REVIEW';
  const isApproved = assessment.status === 'APPROVED';
  const canNavigate = !inReview && !isApproved;
  const effectiveStep = canNavigate && viewStep != null && viewStep >= 1 && viewStep <= step
    ? viewStep
    : step;
  const viewingPast = canNavigate && effectiveStep < step;

  function handleSelectStep(target: number) {
    if (!canNavigate || target < 1 || target > step) return;
    setViewStep(target === step ? null : target);
  }

  return (
    <>
      <Topbar
        breadcrumbs={
          <span>
            <Link to="/assessments" className="hover:text-n-700">Assessments</Link>
            <span className="mx-1">/</span>
            {assessment.title}
          </span>
        }
        title={assessment.title}
        subtitle={
          <span className="flex items-center gap-2">
            <span>{assessment.assetName ?? assessment.clusterName ?? '—'}</span>
            <span>·</span>
            <Pill variant={REVIEW_STATUS_VARIANT[assessment.reviewStatus]}>{assessment.reviewStatus}</Pill>
            {isApproved && <Pill variant="ok">APPROVED</Pill>}
          </span>
        }
        actions={
          <Btn2 variant="ghost" onClick={() => void navigate({ to: '/assessments' })}>
            Back
          </Btn2>
        }
      />

      <div className="p-6 space-y-5">
        <StepProgress
          assessment={assessment}
          actionPlans={actionPlans}
          inReview={inReview}
          isApproved={isApproved}
          viewStep={effectiveStep}
          onSelectStep={handleSelectStep}
        />

        <DegradedPostureBanner assessment={assessment} assets={assets} />

        {error && (
          <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
            {error}
          </div>
        )}

        {canNavigate && (
          <>
            {viewingPast && (
              <div className="flex items-center justify-between gap-3 bg-a-50 border border-a-200 rounded-r2 px-3 py-2 text-[12px] text-a-700">
                <span>
                  Viewing completed <span className="font-semibold">Step {effectiveStep}</span>. Edits autosave; advancement resumes from Step {step}.
                </span>
                <Btn2 variant="ghost" onClick={() => setViewStep(null)}>
                  Return to Step {step}
                </Btn2>
              </div>
            )}
            {effectiveStep === 1 && (
              <ScopeStep
                assessment={assessment}
                canEdit={!isApproved && hasPermission(currentUser?.role, 'assessments:write')}
                onChanged={load}
              />
            )}
            {effectiveStep === 2 && (
              <ThreatsStep assessment={assessment} assets={assets} onChanged={load} />
            )}
            {effectiveStep === 3 && (
              <LikelihoodStep assessment={assessment} onChanged={load} />
            )}
            {effectiveStep === 4 && (
              <ImpactStep assessment={assessment} onChanged={load} />
            )}
            {effectiveStep === 5 && <IrvStep assessment={assessment} />}
            {effectiveStep === 6 && (
              <VulnerabilityStep assessment={assessment} onChanged={load} />
            )}
            {effectiveStep === 7 && (
              <TreatmentStep
                assessment={assessment}
                actionPlans={actionPlans}
                onChanged={load}
              />
            )}
          </>
        )}

        {inReview && (
          <ReviewStep assessment={assessment} onReview={handleReview} />
        )}

        {isApproved && assessment.reviewNotes && (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-4">
            <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
              Reviewer notes
            </div>
            <p className="text-[12.5px] text-n-700 whitespace-pre-wrap">{assessment.reviewNotes}</p>
          </div>
        )}

        {isApproved && (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-ok mx-auto mb-2" />
            <div className="text-[14px] font-semibold text-n-900">Assessment approved</div>
            {assessment.reviewNotes && (
              <div className="text-[12px] text-n-600 mt-1">Notes: {assessment.reviewNotes}</div>
            )}
            <div className="mt-4 flex justify-center">
              <Btn2
                variant="primary"
                leading={<Download className="w-3.5 h-3.5" />}
                disabled={downloadingReport}
                onClick={handleDownloadReport}
              >
                {downloadingReport ? 'Generating PDF…' : 'Download PDF report'}
              </Btn2>
            </div>
          </div>
        )}

        {(step >= 7 || inReview || isApproved) && (
          <>
            <ApproverPicker
              assessment={assessment}
              canEdit={!isApproved && hasPermission(currentUser?.role, 'assessments:write')}
              onChanged={load}
            />
            <RecommendationsEditor
              assessmentId={assessment.id}
              canEdit={!isApproved && hasPermission(currentUser?.role, 'assessments:write')}
            />
          </>
        )}

        <HistoryPanel assessment={assessment} />

        {canNavigate && (
          <div className="flex items-center justify-end gap-2">
            {viewingPast ? (
              <Btn2
                variant="primary"
                leading={<ArrowRight className="w-3.5 h-3.5" />}
                onClick={() => setViewStep(null)}
              >
                Return to Step {step}
              </Btn2>
            ) : (
              <Btn2
                variant="primary"
                leading={step >= 7 ? <Send className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                disabled={advancing}
                onClick={handleAdvance}
              >
                {advancing ? 'Working…' : step >= 7 ? 'Submit for review' : `Advance to Step ${step + 1}`}
              </Btn2>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Step progress bar ─────────────────────────────────────

function computeStepProgress(a: AssessmentDetail, actionPlans?: ActionPlan[]): number[] {
  const n = a.threats.length || 0;
  const frac = (matched: number) => (n === 0 ? 0 : matched / n);
  const likelihoodDone = a.threats.filter((t) => t.likelihoodScore != null).length;
  const impactDone = a.threats.filter((t) => t.impactScore != null).length;
  const vulnDone = a.threats.filter((t) => t.vulnerabilityRating != null).length;
  const plansByThreat = new Map<string, number>();
  for (const p of actionPlans ?? []) {
    plansByThreat.set(p.threatId, (plansByThreat.get(p.threatId) ?? 0) + 1);
  }
  const treatmentDone = a.threats.filter((t) => {
    const high = t.riskTreatmentPriority === 'HIGH' || t.riskTreatmentPriority === 'HIGHEST';
    if (!high) return true;
    if (!t.tearStrategy) return false;
    if (t.tearStrategy === 'REDUCE') return (plansByThreat.get(t.id) ?? 0) > 0;
    return !!t.alarpJustification && t.alarpJustification.trim().length > 0;
  }).length;
  return [
    a.assetId || a.clusterId ? 1 : 0,
    n > 0 ? 1 : 0,
    frac(likelihoodDone),
    frac(impactDone),
    likelihoodDone === n && impactDone === n && n > 0 ? 1 : 0,
    frac(vulnDone),
    n > 0 ? frac(treatmentDone) : 0,
  ];
}

function StepProgress({ assessment, actionPlans, inReview, isApproved, viewStep, onSelectStep }: {
  assessment: AssessmentDetail;
  actionPlans: ActionPlan[];
  inReview: boolean;
  isApproved: boolean;
  viewStep: number;
  onSelectStep: (target: number) => void;
}) {
  const step = assessment.currentStep;
  const progress = computeStepProgress(assessment, actionPlans);
  const canNavigate = !inReview && !isApproved;
  return (
    <div className="bg-white border-y border-n-150 px-3">
      <div className="flex">
        {STEP_LABELS.map((label, i) => {
          const idx = i + 1;
          const reached = idx < step || inReview || isApproved;
          const isCurrent = canNavigate && idx === step;
          const viewing = canNavigate && idx === viewStep;
          const clickable = canNavigate && idx <= step;
          const progressFrac = reached ? 1 : isCurrent ? progress[i] : 0;
          const pct = Math.round(progressFrac * 100);
          const barColor = viewing ? 'bg-a-500' : reached ? 'bg-ok' : isCurrent ? 'bg-a-500' : 'bg-transparent';
          const chipClass = viewing && reached
            ? 'bg-ok text-white ring-2 ring-a-500 ring-offset-1'
            : reached
              ? 'bg-ok text-white'
              : viewing
                ? 'bg-a-500 text-white'
                : isCurrent
                  ? 'bg-a-500 text-white'
                  : 'bg-n-100 text-n-500';
          const labelClass = viewing
            ? 'font-semibold text-n-900'
            : reached
              ? 'font-medium text-n-700'
              : isCurrent
                ? 'font-semibold text-n-900'
                : 'font-medium text-n-500';
          const cellCls = `flex-1 pt-2 pb-0 px-3 relative text-left ${
            i < STEP_LABELS.length - 1 ? 'border-r border-n-100' : ''
          } ${clickable ? 'cursor-pointer hover:bg-n-25' : 'cursor-default'}`;
          const inner = (
            <>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={[
                  'w-4 h-4 rounded-r1 inline-flex items-center justify-center text-[10px] font-mono font-semibold flex-shrink-0',
                  chipClass,
                ].join(' ')}>
                  {reached ? <CheckCircle2 className="w-2.5 h-2.5" /> : idx}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={['text-[12px] leading-tight whitespace-nowrap', labelClass].join(' ')}>
                    {label}
                  </div>
                  <div className="font-mono text-[9px] text-n-400 mt-[1px] whitespace-nowrap overflow-hidden text-ellipsis">
                    {STEP_KICKERS[i]}
                  </div>
                </div>
                {isCurrent && !reached && (
                  <span className="font-mono text-[10px] text-a-600 font-semibold">
                    {pct}%
                  </span>
                )}
              </div>
              <div className="h-0.5 bg-n-100 -mb-px relative">
                <div
                  className={`h-full ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          );
          if (clickable) {
            return (
              <button
                key={label}
                type="button"
                onClick={() => onSelectStep(idx)}
                aria-current={viewing ? 'step' : undefined}
                className={cellCls}
              >
                {inner}
              </button>
            );
          }
          return (
            <div key={label} className={cellCls} aria-disabled="true">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── STEP 1: Scope ─────────────────────────────────────────

function ScopeStep({ assessment, canEdit, onChanged }: {
  assessment: AssessmentDetail;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [value, setValue] = useState(assessment.scopeDescription ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(assessment.scopeDescription ?? '');
  }, [assessment.scopeDescription]);

  async function handleBlur() {
    const trimmed = value.trim();
    const next = trimmed ? trimmed : null;
    if (next === (assessment.scopeDescription ?? null)) return;
    setSaving(true);
    setError(null);
    try {
      await assessmentsApi.update(assessment.id, { scopeDescription: next });
      await onChanged();
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
    <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-5">
      <h3 className="text-[14px] font-semibold text-n-900 mb-3">Step 1 — Scope</h3>
      <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
        <div>
          <dt className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">Type</dt>
          <dd className="text-n-800">{assessment.assessmentType}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">Target</dt>
          <dd className="text-n-800">
            {assessment.assetName ?? assessment.clusterName ?? '—'}
            {assessment.clusterId && <span className="ml-1.5"><Pill variant="outline">cluster</Pill></span>}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">Lead assessor</dt>
          <dd className="text-n-800">{assessment.leadAssessorName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">Started</dt>
          <dd className="text-n-800">
            {assessment.startedAt ? new Date(assessment.startedAt).toLocaleString() : '—'}
          </dd>
        </div>
      </dl>

      <label className="block mt-4">
        <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-0.5">
          Scope description {saving && <span className="ml-1 normal-case tracking-normal text-n-400">saving…</span>}
        </span>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          disabled={!canEdit || saving}
          placeholder="Describe the physical, regulatory, and operational context for this assessment…"
          className="w-full min-h-[100px] px-2.5 py-1.5 text-[12.5px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none disabled:bg-n-50 disabled:text-n-600"
        />
      </label>
      {error && (
        <div className="text-[11.5px] text-bad mt-1">{error}</div>
      )}

      <div className="mt-4 text-[11.5px] text-n-600">
        When you advance, you'll define threats against the scope asset(s).
      </div>
    </div>
    <LinkedSurveysCard assessment={assessment} canEdit={canEdit} onChanged={onChanged} />
    </div>
  );
}

// ── Linked surveys card (GRACE v2) ────────────────────────

function LinkedSurveysCard({ assessment, canEdit, onChanged }: {
  assessment: AssessmentDetail;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [links, setLinks] = useState<AssessmentSurveyLink[]>([]);
  const [available, setAvailable] = useState<SurveyResponseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const currentUser = useAuthStore((s) => s.user);
  const canLink = canEdit && hasPermission(currentUser?.role, 'assessments:link_survey');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await assessmentSurveyLinksApi.list(assessment.id);
      setLinks(res.items);
    } catch (e) {
      setErr(await extractError(e));
    } finally {
      setLoading(false);
    }
  }, [assessment.id]);

  useEffect(() => { void load(); }, [load]);

  async function openPicker() {
    setPickerOpen(true);
    try {
      const scopeClusterId = assessment.clusterId ?? undefined;
      const res = await surveysApi.list({
        status: 'SUBMITTED',
        ...(scopeClusterId ? { clusterId: scopeClusterId } : {}),
      });
      const approved = await surveysApi.list({
        status: 'APPROVED',
        ...(scopeClusterId ? { clusterId: scopeClusterId } : {}),
      });
      const ids = new Set(links.map((l) => l.surveyResponseId));
      const merged = [...res.items, ...approved.items].filter((s) => !ids.has(s.id));
      setAvailable(merged);
    } catch (e) {
      setErr(await extractError(e));
    }
  }

  async function link(s: SurveyResponseSummary) {
    try {
      await assessmentSurveyLinksApi.link(assessment.id, {
        surveyResponseId: s.id,
        vulnerabilityOverride: false,
      });
      setPickerOpen(false);
      await load();
      await onChanged();
    } catch (e) {
      setErr(await extractError(e));
    }
  }

  async function unlink(l: AssessmentSurveyLink) {
    if (!window.confirm('Unlink this survey? The assessment may drop back to expert-judgment.')) return;
    try {
      await assessmentSurveyLinksApi.unlink(assessment.id, l.surveyResponseId);
      await load();
      await onChanged();
    } catch (e) {
      setErr(await extractError(e));
    }
  }

  return (
    <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[14px] font-semibold text-n-900">Linked surveys</h3>
          <div className="text-[11.5px] text-n-500">
            Evidence basis: <Pill variant={
              assessment.evidenceBasis === 'SURVEY_LINKED' ? 'ok'
                : assessment.evidenceBasis === 'MIXED' ? 'warn' : 'default'
            }>{assessment.evidenceBasis.replace('_', ' ')}</Pill>
            {assessment.lastSurveyDate && (
              <span className="ml-2">last survey {new Date(assessment.lastSurveyDate).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        {canLink && (
          <Btn2 variant="ghost" onClick={openPicker}>Link survey…</Btn2>
        )}
      </div>

      {err && (
        <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2 mb-2">
          {err}
        </div>
      )}

      {loading ? (
        <div className="text-[12px] text-n-500">Loading…</div>
      ) : links.length === 0 ? (
        <div className="text-[12px] text-n-500 bg-n-50 rounded-r2 px-3 py-2">
          No surveys linked yet. This assessment rests on expert judgment.
        </div>
      ) : (
        <div className="divide-y divide-n-100 border border-n-150 rounded-r2 overflow-hidden">
          {links.map((l) => (
            <div key={l.surveyResponseId} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-n-900 truncate">{l.templateName}</div>
                <div className="text-[11px] text-n-500">
                  {l.clusterName ?? '—'} · conducted {new Date(l.conductedAt).toLocaleDateString()}
                  {l.linkedByName && <> · linked by {l.linkedByName}</>}
                </div>
              </div>
              <Pill variant="accent">{l.surveyType.replace('_', ' ')}</Pill>
              <Pill variant={
                l.status === 'APPROVED' ? 'ok'
                  : l.status === 'SUBMITTED' ? 'info'
                  : l.status === 'REJECTED' ? 'bad' : 'warn'
              }>{l.status}</Pill>
              {l.rating && (
                <Pill variant={
                  l.rating === 'STRONG' ? 'ok'
                    : l.rating === 'BASELINE' ? 'info'
                    : l.rating === 'BARELY_ADEQUATE' ? 'warn' : 'bad'
                }>{l.rating.replace('_', ' ')}</Pill>
              )}
              {l.scorePct != null && (
                <span className="text-n-700 font-mono text-[11px]">{l.scorePct.toFixed(0)}%</span>
              )}
              {canLink && (
                <button
                  type="button"
                  onClick={() => void unlink(l)}
                  className="text-[11px] text-n-500 hover:text-bad underline ml-2"
                >
                  Unlink
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="bg-white rounded-r3 shadow-sh3 w-full max-w-[640px] max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-n-150 flex items-center justify-between">
              <div className="text-[14px] font-semibold text-n-900">Pick a survey to link</div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="text-[11.5px] text-n-500 hover:text-n-800 underline"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {available.length === 0 ? (
                <div className="text-[12px] text-n-500 bg-n-50 rounded-r2 px-3 py-4 text-center">
                  No submitted or approved surveys are available for this scope.
                </div>
              ) : available.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void link(s)}
                  className="w-full text-left border border-n-200 rounded-r2 px-3 py-2 hover:bg-n-50"
                >
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-[12.5px] text-n-900 flex-1">
                      {s.templateName ?? s.surveyType}
                    </div>
                    <Pill variant="accent">{s.surveyType.replace('_', ' ')}</Pill>
                    {s.rating && (
                      <Pill variant={
                        s.rating === 'STRONG' ? 'ok'
                          : s.rating === 'BASELINE' ? 'info'
                          : s.rating === 'BARELY_ADEQUATE' ? 'warn' : 'bad'
                      }>{s.rating.replace('_', ' ')}</Pill>
                    )}
                  </div>
                  <div className="text-[11px] text-n-500 mt-0.5">
                    {s.clusterName ?? '—'} · {new Date(s.conductedAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── STEP 2: Threats ───────────────────────────────────────

function ThreatsStep({ assessment, assets, onChanged }: {
  assessment: AssessmentDetail; assets: AssetSummary[]; onChanged: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    targetAssetId: assessment.assetId ?? '',
    adversaryType: 'CRIMINAL' as AdversaryType,
    actionType: 'THEFT' as ActionType,
    adversaryDescription: '',
    actionDescription: '',
    locationContext: '',
    timeContext: '',
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.targetAssetId) return;
    setAdding(true);
    setError(null);
    try {
      await assessmentsApi.addThreat(assessment.id, {
        targetAssetId: form.targetAssetId,
        adversaryType: form.adversaryType,
        actionType: form.actionType,
        adversaryDescription: form.adversaryDescription || null,
        actionDescription: form.actionDescription || null,
        locationContext: form.locationContext || null,
        timeContext: form.timeContext || null,
      });
      setForm({ ...form, adversaryDescription: '', actionDescription: '', locationContext: '', timeContext: '' });
      await onChanged();
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(t: ThreatSummary) {
    if (!window.confirm('Remove this threat?')) return;
    try {
      await assessmentsApi.removeThreat(assessment.id, t.id);
      await onChanged();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  return (
    <div className="space-y-4">
      <SuggestedThreatsPanel assessmentId={assessment.id} onAdded={onChanged} />

      <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-5">
        <h3 className="text-[14px] font-semibold text-n-900 mb-3">
          Step 2 — Threats <span className="text-n-500 font-normal">· Adversary × Action × Asset</span>
        </h3>
        <form onSubmit={submit} className="grid grid-cols-12 gap-2 text-[12.5px]">
          <div className="col-span-4">
            <Lbl>Target asset</Lbl>
            <select
              value={form.targetAssetId}
              onChange={(e) => setForm({ ...form, targetAssetId: e.target.value })}
              required
              className={INPUT_CLS}
            >
              <option value="">— pick asset —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-4">
            <Lbl>Adversary</Lbl>
            <select
              value={form.adversaryType}
              onChange={(e) => setForm({ ...form, adversaryType: e.target.value as AdversaryType })}
              className={INPUT_CLS}
            >
              {ADVERSARY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-4">
            <Lbl>Action</Lbl>
            <select
              value={form.actionType}
              onChange={(e) => setForm({ ...form, actionType: e.target.value as ActionType })}
              className={INPUT_CLS}
            >
              {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-6">
            <Lbl>Adversary description</Lbl>
            <input
              value={form.adversaryDescription}
              onChange={(e) => setForm({ ...form, adversaryDescription: e.target.value })}
              className={INPUT_CLS}
              placeholder="External actor with local knowledge"
            />
          </div>
          <div className="col-span-6">
            <Lbl>Action description</Lbl>
            <input
              value={form.actionDescription}
              onChange={(e) => setForm({ ...form, actionDescription: e.target.value })}
              className={INPUT_CLS}
              placeholder="After-hours forced entry"
            />
          </div>
          <div className="col-span-6">
            <Lbl>Location context</Lbl>
            <input
              value={form.locationContext}
              onChange={(e) => setForm({ ...form, locationContext: e.target.value })}
              className={INPUT_CLS}
              placeholder="Ground-floor rear entrance"
            />
          </div>
          <div className="col-span-6">
            <Lbl>Time context</Lbl>
            <input
              value={form.timeContext}
              onChange={(e) => setForm({ ...form, timeContext: e.target.value })}
              className={INPUT_CLS}
              placeholder="Nights, weekends"
            />
          </div>
          {error && (
            <div className="col-span-12 text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
              {error}
            </div>
          )}
          <div className="col-span-12 flex justify-end">
            <Btn2 type="submit" variant="primary" leading={<Plus className="w-3.5 h-3.5" />} disabled={adding || !form.targetAssetId}>
              {adding ? 'Adding…' : 'Add threat'}
            </Btn2>
          </div>
        </form>
      </div>

      <ThreatsTable threats={assessment.threats} onDelete={handleDelete} />
    </div>
  );
}

type SuggestSortKey = 'relevance' | 'scenario' | 'asset' | 'adversary' | 'action';
const RELEVANCE_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function SuggestedThreatsPanel({ assessmentId, onAdded }: {
  assessmentId: string; onAdded: () => Promise<void>;
}) {
  const [items, setItems] = useState<SuggestedThreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const [search, setSearch] = useState('');
  const [relevanceFilter, setRelevanceFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [assetFilter, setAssetFilter] = useState<string>('ALL');
  const [adversaryFilter, setAdversaryFilter] = useState<string>('ALL');
  const [hideAdded, setHideAdded] = useState(true);
  const [sortKey, setSortKey] = useState<SuggestSortKey>('relevance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await assessmentsApi.suggestedThreats(assessmentId);
      setItems(res.items);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => { void load(); }, [load]);

  async function handleAdd(s: SuggestedThreat) {
    const key = `${s.assetId}::${s.threatTemplateId}`;
    setAddingKey(key);
    setError(null);
    try {
      await assessmentsApi.addThreatFromTemplate(assessmentId, s.assetId, s.threatTemplateId);
      await load();
      await onAdded();
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setAddingKey(null);
    }
  }

  const assetOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of items) m.set(s.assetId, s.assetName);
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const adversaryOptions = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) s.add(it.adversaryType);
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = items.filter((s) => {
      if (hideAdded && s.alreadyAdded) return false;
      if (relevanceFilter !== 'ALL' && s.relevance !== relevanceFilter) return false;
      if (assetFilter !== 'ALL' && s.assetId !== assetFilter) return false;
      if (adversaryFilter !== 'ALL' && s.adversaryType !== adversaryFilter) return false;
      if (q) {
        const hay = `${s.scenarioName} ${s.assetName} ${s.adversaryType} ${s.actionType} ${s.rationale ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      let cmp = 0;
      switch (sortKey) {
        case 'relevance':
          cmp = (RELEVANCE_RANK[a.relevance] ?? 99) - (RELEVANCE_RANK[b.relevance] ?? 99);
          if (cmp === 0) cmp = a.scenarioName.localeCompare(b.scenarioName);
          break;
        case 'scenario': cmp = a.scenarioName.localeCompare(b.scenarioName); break;
        case 'asset': cmp = a.assetName.localeCompare(b.assetName); break;
        case 'adversary': cmp = a.adversaryType.localeCompare(b.adversaryType); break;
        case 'action': cmp = a.actionType.localeCompare(b.actionType); break;
      }
      return cmp * dir;
    });
    return out;
  }, [items, search, relevanceFilter, assetFilter, adversaryFilter, hideAdded, sortKey, sortDir]);

  function toggleSort(k: SuggestSortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  }

  async function addAll() {
    setError(null);
    for (const s of filtered.filter((x) => !x.alreadyAdded)) {
      try {
        await assessmentsApi.addThreatFromTemplate(assessmentId, s.assetId, s.threatTemplateId);
      } catch {
        // skip duplicates / errors silently, continue
      }
    }
    await load();
    await onAdded();
  }

  const remaining = items.filter((s) => !s.alreadyAdded);
  const visibleRemaining = filtered.filter((s) => !s.alreadyAdded);

  if (loading) {
    return (
      <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-4 text-[12.5px] text-n-500">
        Loading template suggestions…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="bg-n-25 border border-dashed border-n-200 rounded-r3 p-4 text-[12px] text-n-500">
        No template suggestions — scope assets aren't linked to template library entries.
      </div>
    );
  }
  return (
    <div className="bg-white border border-a-200 rounded-r3 shadow-sh1 overflow-hidden">
      <div className="bg-a-50 border-b border-a-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-a-600" />
          <span className="text-[12.5px] font-semibold text-a-700">
            Suggested from template library
          </span>
          <Pill variant="accent">{remaining.length} new</Pill>
        </div>
        <div className="flex items-center gap-2">
          {visibleRemaining.length > 0 && (
            <Btn2 variant="primary" onClick={addAll}>
              Add all {visibleRemaining.length}
            </Btn2>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] hover:text-n-700"
          >
            {collapsed ? 'show' : 'hide'}
          </button>
        </div>
      </div>
      {error && (
        <div className="text-[12px] text-bad bg-bad-bg border-b border-bad/20 px-4 py-2">
          {error}
        </div>
      )}
      {!collapsed && (
        <>
          <div className="border-b border-n-150 px-3 py-2 flex flex-wrap items-center gap-2 bg-white">
            <label className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-n-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search scenario, asset, adversary…"
                className="w-full h-7 pl-7 pr-2 text-[12px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
                data-testid="suggested-search"
              />
            </label>
            <select
              value={relevanceFilter}
              onChange={(e) => setRelevanceFilter(e.target.value as typeof relevanceFilter)}
              className="h-7 px-1.5 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
              data-testid="suggested-relevance"
            >
              <option value="ALL">All relevance</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
            <select
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              className="h-7 px-1.5 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none max-w-[200px]"
              data-testid="suggested-asset"
            >
              <option value="ALL">All assets</option>
              {assetOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select
              value={adversaryFilter}
              onChange={(e) => setAdversaryFilter(e.target.value)}
              className="h-7 px-1.5 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
              data-testid="suggested-adversary"
            >
              <option value="ALL">All adversaries</option>
              {adversaryOptions.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[11.5px] text-n-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideAdded}
                onChange={(e) => setHideAdded(e.target.checked)}
                className="accent-a-600"
              />
              Hide added
            </label>
            <span className="text-[11px] font-mono text-n-500 ml-auto">
              {filtered.length} / {items.length}
            </span>
          </div>
          <table className="w-full text-[12.5px]">
          <thead className="bg-n-50 border-b border-n-150">
            <tr className="text-[10.5px] font-mono uppercase text-n-500 tracking-[0.4px]">
              <SortTh label="Scenario" col="scenario" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              <SortTh label="Asset" col="asset" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              <SortTh label="Adversary" col="adversary" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              <SortTh label="Action" col="action" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              <SortTh label="Relevance" col="relevance" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              <th className="text-right px-3 py-2 w-[100px]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-[12px] text-n-500">
                  No suggestions match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((s) => {
              const key = `${s.assetId}::${s.threatTemplateId}`;
              return (
                <tr key={key} className={`border-b border-n-100 ${s.alreadyAdded ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2 text-n-900">
                    {s.scenarioName}
                    {s.csmpUnitReference && (
                      <span className="ml-2 text-[10px] font-mono text-n-500">{s.csmpUnitReference}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-n-700">{s.assetName}</td>
                  <td className="px-3 py-2 text-n-700 font-mono text-[11.5px]">{s.adversaryType}</td>
                  <td className="px-3 py-2 text-n-700 font-mono text-[11.5px]">{s.actionType}</td>
                  <td className="px-3 py-2">
                    <Pill variant={s.relevance === 'HIGH' ? 'bad' : s.relevance === 'MEDIUM' ? 'warn' : 'default'}>
                      {s.relevance}
                    </Pill>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.alreadyAdded ? (
                      <span className="text-[11px] text-n-500 font-mono">added</span>
                    ) : (
                      <Btn2
                        variant="ghost"
                        onClick={() => handleAdd(s)}
                        disabled={addingKey === key}
                        leading={<Plus className="w-3 h-3" />}
                      >
                        {addingKey === key ? '…' : 'Add'}
                      </Btn2>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </>
      )}
    </div>
  );
}

function SortTh({ label, col, sortKey, sortDir, onToggle }: {
  label: string;
  col: SuggestSortKey;
  sortKey: SuggestSortKey;
  sortDir: 'asc' | 'desc';
  onToggle: (k: SuggestSortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <th className="text-left px-3 py-2">
      <button
        type="button"
        onClick={() => onToggle(col)}
        className={`inline-flex items-center gap-1 hover:text-n-800 ${active ? 'text-n-900' : ''}`}
      >
        {label}
        {active && (sortDir === 'asc'
          ? <ArrowUp className="w-2.5 h-2.5" />
          : <ArrowDown className="w-2.5 h-2.5" />)}
      </button>
    </th>
  );
}

function ThreatsTable({ threats, onDelete }: {
  threats: ThreatSummary[];
  onDelete?: (t: ThreatSummary) => void;
}) {
  if (threats.length === 0) {
    return (
      <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-6 text-center">
        <div className="text-[12.5px] text-n-500">No threats yet — add one above.</div>
      </div>
    );
  }
  return (
    <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 overflow-hidden">
      <table className="w-full text-[12.5px]">
        <thead className="bg-n-50 border-b border-n-150">
          <tr className="text-[10.5px] font-mono uppercase text-n-500 tracking-[0.4px]">
            <th className="text-left px-3 py-2">Adversary → Action</th>
            <th className="text-left px-3 py-2">Target</th>
            <th className="text-left px-3 py-2">Likelihood</th>
            <th className="text-left px-3 py-2">Impact</th>
            <th className="text-left px-3 py-2">IRV</th>
            <th className="text-left px-3 py-2">Vuln.</th>
            <th className="text-left px-3 py-2">Priority</th>
            {onDelete && <th className="text-right px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {threats.map((t) => (
            <tr key={t.id} className="border-b border-n-100">
              <td className="px-3 py-2.5 text-n-900">
                <div>{t.adversaryType} → {t.actionType}</div>
                {t.complianceTags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.complianceTags.map((tag) => (
                      <Pill key={tag} variant="accent">{COMPLIANCE_TAG_LABEL[tag]}</Pill>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-3 py-2.5 text-n-700">{t.targetAssetName ?? '—'}</td>
              <td className="px-3 py-2.5 font-mono text-n-700">{t.likelihoodScore ?? '—'}</td>
              <td className="px-3 py-2.5 font-mono text-n-700">{t.impactScore ?? '—'}</td>
              <td className="px-3 py-2.5">
                {t.irv ? <RiskBadge level={IRV_TO_LEVEL[t.irv]} /> : <span className="text-n-400 text-[11px]">—</span>}
              </td>
              <td className="px-3 py-2.5 text-n-700">{t.vulnerabilityRating ? VULN_LABEL[t.vulnerabilityRating] : '—'}</td>
              <td className="px-3 py-2.5">
                {t.riskTreatmentPriority
                  ? <RiskBadge level={PRIORITY_TO_LEVEL[t.riskTreatmentPriority]} value={t.riskTreatmentPriority} />
                  : <span className="text-n-400 text-[11px]">—</span>}
              </td>
              {onDelete && (
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(t)}
                    className="w-7 h-7 inline-flex items-center justify-center text-n-500 hover:bg-bad-bg hover:text-bad rounded-r1"
                    aria-label="Delete threat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── STEP 3: Likelihood ────────────────────────────────────

function LikelihoodStep({ assessment, onChanged }: {
  assessment: AssessmentDetail; onChanged: () => Promise<void>;
}) {
  return (
    <PerThreatRatingStep
      assessment={assessment}
      onChanged={onChanged}
      title="Step 3 — Likelihood"
      subtitle="Rate how likely each threat is to occur (1 = very low, 5 = very high)"
      scoreKey="likelihood"
      renderControls={(t) => (
        <LikelihoodControl
          threat={t}
          onSave={async (score, rationale) => {
            await assessmentsApi.rateLikelihood(assessment.id, t.id, score, rationale);
            await onChanged();
          }}
        />
      )}
    />
  );
}

const SCORE_LABELS_5 = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'] as const;

function ScoreButtons({
  value, onChange, ariaLabel,
}: { value: number; onChange: (n: number) => void; ariaLabel?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n === value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(n)}
            title={SCORE_LABELS_5[n - 1]}
            className={`flex-1 h-7 rounded-r2 text-[11.5px] font-semibold border transition-colors ${
              on
                ? 'bg-a-500 text-white border-a-600 shadow-sh1'
                : 'bg-white text-n-700 border-n-200 hover:border-n-300 hover:bg-n-50'
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

function SaveStatusBadge({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === 'error') return <span className="text-[11px] font-mono text-bad">Error: {error}</span>;
  if (status === 'saving') return <span className="text-[11px] font-mono text-n-500">Saving…</span>;
  if (status === 'saved') return <span className="text-[11px] font-mono text-ok">Saved</span>;
  if (status === 'dirty') return <span className="text-[11px] font-mono text-warn">Unsaved…</span>;
  return <span className="text-[11px] font-mono text-n-400">Auto-saves on change</span>;
}

function useDebouncedAutoSave<T>(
  value: T,
  initial: T,
  delayMs: number,
  canSave: (v: T) => boolean,
  save: (v: T) => Promise<void>,
) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const savedKeyRef = useRef<string>(JSON.stringify(initial));
  const saveRef = useRef(save);
  saveRef.current = save;
  const valueRef = useRef<T>(value);
  valueRef.current = value;
  const key = JSON.stringify(value);

  useEffect(() => {
    if (key === savedKeyRef.current) return;
    if (!canSave(valueRef.current)) { setStatus('dirty'); return; }
    setStatus('dirty');
    const t = setTimeout(async () => {
      setStatus('saving');
      setError(null);
      const snapshot = valueRef.current;
      const snapshotKey = JSON.stringify(snapshot);
      try {
        await saveRef.current(snapshot);
        savedKeyRef.current = snapshotKey;
        setStatus('saved');
      } catch (e) {
        setError(await extractError(e));
        setStatus('error');
      }
    }, delayMs);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { status, error };
}

function LikelihoodControl({ threat, onSave }: {
  threat: ThreatSummary;
  onSave: (score: number, rationale: string) => Promise<void>;
}) {
  const initialScore = threat.likelihoodScore ?? 3;
  const initialRationale = threat.likelihoodRationale ?? '';
  const [score, setScore] = useState<number>(initialScore);
  const [rationale, setRationale] = useState(initialRationale);

  const { status, error } = useDebouncedAutoSave(
    { score, rationale },
    { score: initialScore, rationale: initialRationale },
    800,
    (v) => v.rationale.trim().length > 0,
    (v) => onSave(v.score, v.rationale),
  );

  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      <div className="col-span-4">
        <Lbl>Score — {SCORE_LABELS_5[score - 1]}</Lbl>
        <ScoreButtons value={score} onChange={setScore} ariaLabel="Likelihood score" />
      </div>
      <div className="col-span-6">
        <Lbl>Rationale</Lbl>
        <input value={rationale} onChange={(e) => setRationale(e.target.value)} className={INPUT_CLS} placeholder="Why this score?" />
      </div>
      <div className="col-span-2 flex items-end h-full pb-[2px]">
        <SaveStatusBadge status={status} error={error} />
      </div>
    </div>
  );
}

// ── STEP 4: Impact ────────────────────────────────────────

function ImpactStep({ assessment, onChanged }: {
  assessment: AssessmentDetail; onChanged: () => Promise<void>;
}) {
  return (
    <PerThreatRatingStep
      assessment={assessment}
      onChanged={onChanged}
      title="Step 4 — Impact"
      subtitle="Rate consequence across 5 dimensions; composite = highest of the five; IRV auto-computes"
      scoreKey="impact"
      renderControls={(t) => (
        <ImpactControl
          threat={t}
          onSave={async (breakdown, rationale) => {
            await assessmentsApi.rateImpact(assessment.id, t.id, breakdown, rationale);
            await onChanged();
          }}
        />
      )}
    />
  );
}

const IMPACT_DIMS: Array<keyof ImpactBreakdown> = ['people', 'property', 'operations', 'reputation', 'financial'];

function ImpactControl({ threat, onSave }: {
  threat: ThreatSummary;
  onSave: (breakdown: ImpactBreakdown, rationale: string) => Promise<void>;
}) {
  const initial: ImpactBreakdown = {
    people: (threat.impactBreakdown?.people as number) ?? 3,
    property: (threat.impactBreakdown?.property as number) ?? 3,
    operations: (threat.impactBreakdown?.operations as number) ?? 3,
    reputation: (threat.impactBreakdown?.reputation as number) ?? 3,
    financial: (threat.impactBreakdown?.financial as number) ?? 3,
  };
  const initialRationale = threat.impactRationale ?? '';
  const [b, setB] = useState<ImpactBreakdown>(initial);
  const [rationale, setRationale] = useState(initialRationale);
  const composite = Math.max(b.people, b.property, b.operations, b.reputation, b.financial);

  const { status, error } = useDebouncedAutoSave(
    { b, rationale },
    { b: initial, rationale: initialRationale },
    800,
    (v) => v.rationale.trim().length > 0,
    (v) => onSave(v.b, v.rationale),
  );

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {IMPACT_DIMS.map((dim) => (
          <div key={dim} className="flex items-center gap-3">
            <span className="w-24 flex-shrink-0 text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">
              {dim}
            </span>
            <div className="flex-1 min-w-0">
              <ScoreButtons
                value={b[dim]}
                onChange={(n) => setB({ ...b, [dim]: n })}
                ariaLabel={`Impact · ${dim}`}
              />
            </div>
            <span className="w-24 flex-shrink-0 text-right text-[11px] text-n-500">
              {SCORE_LABELS_5[b[dim] - 1]}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-dashed border-n-150 pt-2.5">
        <span className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">Composite</span>
        <span className="inline-flex items-center justify-center w-7 h-[22px] rounded-r1 bg-n-75 border border-n-200 font-mono text-[12px] font-bold text-n-900">
          {composite}
        </span>
        <span className="text-[11px] text-n-500">max of the five · IRV = likelihood × composite</span>
      </div>

      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-10">
          <Lbl>Rationale</Lbl>
          <input
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            className={INPUT_CLS}
            placeholder="Why these scores?"
          />
        </div>
        <div className="col-span-2 pb-[2px]">
          <SaveStatusBadge status={status} error={error} />
        </div>
      </div>
    </div>
  );
}

// ── STEP 5: IRV review (read-only) ────────────────────────

function IrvStep({ assessment }: { assessment: AssessmentDetail }) {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-5">
        <h3 className="text-[14px] font-semibold text-n-900 mb-1">Step 5 — IRV Review</h3>
        <p className="text-[12px] text-n-600">
          Review the Inherent Risk Value computed from likelihood × impact. Advance to assess vulnerability.
        </p>
      </div>
      <ThreatsTable threats={assessment.threats} />
    </div>
  );
}

// ── STEP 6: Vulnerability ─────────────────────────────────

const OP_STATUS_PILL: Record<OperationalStatus, 'ok' | 'warn' | 'bad' | 'default'> = {
  OPERATIONAL: 'ok',
  DEGRADED: 'warn',
  FAILED: 'bad',
  UNKNOWN: 'default',
};

function DegradedPostureBanner({ assessment, assets }: { assessment: AssessmentDetail; assets: AssetSummary[] }) {
  const targetIds = useMemo(
    () => Array.from(new Set(assessment.threats.map((t) => t.targetAssetId))),
    [assessment.threats],
  );
  const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const degraded = targetIds
    .map((id) => byId.get(id))
    .filter((a): a is AssetSummary => Boolean(a) && a!.degradedControlPosture);

  if (degraded.length === 0) return null;
  return (
    <div className="bg-warn-bg border border-warn/40 rounded-r3 shadow-sh1 px-3 py-2 flex items-center gap-2 text-[12.5px] text-warn-700" role="status">
      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
      <span>
        <strong className="font-semibold">{degraded.length}</strong> asset{degraded.length === 1 ? '' : 's'} in scope show degraded protective posture
        {degraded.length <= 3
          ? ` (${degraded.map((a) => a.name).join(', ')})`
          : ''}
        — Step 6 ratings should account for the gap.
      </span>
    </div>
  );
}

function ProtectiveCoveragePanel({ assetId, assetName }: { assetId: string; assetName: string | null }) {
  const [items, setItems] = useState<ProtectiveCoverageItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    void (async () => {
      try {
        const res = await assetsApi.protectiveCoverage(assetId);
        if (!cancelled) setItems(res.items);
      } catch (err) {
        if (!cancelled) setError(await extractError(err));
      }
    })();
    return () => { cancelled = true; };
  }, [assetId]);

  if (error) {
    return (
      <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2 mb-3">
        Failed to load protective coverage: {error}
      </div>
    );
  }

  if (items === null) {
    return (
      <div className="text-[12px] text-n-500 bg-n-50 border border-n-150 rounded-r2 px-3 py-2 mb-3">
        Loading protective coverage…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-[12px] text-n-600 bg-n-50 border border-n-150 rounded-r2 px-3 py-2 mb-3 flex items-center gap-2">
        <ShieldAlert className="w-3.5 h-3.5 text-n-500 shrink-0" />
        <span>
          No protective assets linked to <span className="font-medium">{assetName ?? 'this asset'}</span>.
          Add a PROTECTS or MONITORS relationship from a CCTV / KD / SSWiN system to surface its operational status here.
        </span>
      </div>
    );
  }

  const degraded = items.filter((i) => i.operationalStatus !== 'OPERATIONAL');
  const allOk = degraded.length === 0;

  return (
    <div className={`mb-3 border rounded-r2 overflow-hidden ${allOk ? 'border-n-150 bg-white' : 'border-warn/40 bg-warn-bg'}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-n-100 text-[11.5px]">
        {allOk ? (
          <ShieldCheck className="w-3.5 h-3.5 text-ok shrink-0" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5 text-warn shrink-0" />
        )}
        <span className="font-mono uppercase tracking-[0.4px] text-n-700">
          Protective coverage · {items.length} control{items.length === 1 ? '' : 's'}
        </span>
        {!allOk && (
          <span className="ml-auto text-[11px] text-warn-700">
            {degraded.length} non-operational — effective vulnerability may be worse than rated below.
          </span>
        )}
      </div>
      <ul className="divide-y divide-n-100">
        {items.map((it) => (
          <li key={it.protectiveAssetId} className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
            {it.source === 'EDGE' && it.relationshipType ? (
              <Pill variant="outline">{it.relationshipType}</Pill>
            ) : (
              <span title="No explicit PROTECTS / MONITORS edge — inferred from the topology hierarchy. Add an edge to make this part of the formal coverage map.">
                <Pill variant="default">by location</Pill>
              </span>
            )}
            <span className="font-medium text-n-900 truncate">{it.name}</span>
            <span className="font-mono text-[10.5px] text-n-500 tracking-[0.4px]">{it.assetType} · crit {it.criticality}</span>
            <span className="ml-auto">
              <Pill variant={OP_STATUS_PILL[it.operationalStatus]}>
                {OPERATIONAL_STATUS_LABEL[it.operationalStatus]}
              </Pill>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VulnerabilityStep({ assessment, onChanged }: {
  assessment: AssessmentDetail; onChanged: () => Promise<void>;
}) {
  const hasSignificantRisk = assessment.threats.some(
    (t) => (t.likelihoodScore ?? 0) >= 3 || (t.impactScore ?? 0) >= 3,
  );
  const showJustification =
    assessment.evidenceBasis === 'EXPERT_JUDGMENT' && hasSignificantRisk;

  return (
    <div className="space-y-4">
      {showJustification && (
        <ExpertJustificationCard assessment={assessment} onChanged={onChanged} />
      )}
      <PerThreatRatingStep
        assessment={assessment}
        onChanged={onChanged}
        title="Step 6 — Vulnerability"
        subtitle="Rate how well current controls defend against each threat; treatment priority auto-computes"
        scoreKey="vulnerability"
        renderControls={(t) => (
          <>
            <ProtectiveCoveragePanel assetId={t.targetAssetId} assetName={t.targetAssetName} />
            <VulnerabilityControl
              threat={t}
              onSave={async (rating, rationale) => {
                await assessmentsApi.rateVulnerability(assessment.id, t.id, rating, rationale);
                await onChanged();
              }}
            />
          </>
        )}
      />
    </div>
  );
}

function ExpertJustificationCard({ assessment, onChanged }: {
  assessment: AssessmentDetail; onChanged: () => Promise<void>;
}) {
  const [value, setValue] = useState(assessment.expertJustification ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(assessment.expertJustification ?? '');
  }, [assessment.expertJustification]);

  async function handleBlur() {
    const trimmed = value.trim();
    const next = trimmed ? trimmed : null;
    if (next === (assessment.expertJustification ?? null)) return;
    setSaving(true);
    setError(null);
    try {
      await assessmentsApi.update(assessment.id, { expertJustification: next });
      await onChanged();
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  const length = value.trim().length;
  const meetsMin = length >= 100;

  return (
    <div className="bg-white border border-warn/40 rounded-r3 shadow-sh1 p-5">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[14px] font-semibold text-n-900 m-0">
              Expert justification required
            </h3>
            <Pill variant="warn">Expert judgment</Pill>
          </div>
          <p className="text-[12px] text-n-600 leading-snug">
            This assessment is based on expert judgment (no survey linked) and has at least one
            threat rated significant (L ≥ 3 or I ≥ 3). Describe the evidence and reasoning behind
            your control assessment — minimum 100 characters to advance.
          </p>
        </div>
      </div>

      <label className="block mt-3">
        <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-0.5">
          Justification{' '}
          {saving && <span className="ml-1 normal-case tracking-normal text-n-400">saving…</span>}
        </span>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          placeholder="e.g. Physical walkthrough on 2026-04-01 confirmed intrusion-detection coverage on the main entry vector; badge-reader logs reviewed for the last 90 days show no tailgating anomalies…"
          className="w-full min-h-[120px] px-2.5 py-1.5 text-[12.5px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
        />
      </label>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className={meetsMin ? 'text-ok' : 'text-n-500'}>
          {length} / 100 {meetsMin ? '✓' : 'characters minimum'}
        </span>
        {error && <span className="text-bad">{error}</span>}
      </div>
    </div>
  );
}

function VulnerabilityControl({ threat, onSave }: {
  threat: ThreatSummary;
  onSave: (rating: VulnerabilityRating, rationale: string) => Promise<void>;
}) {
  const initialRating = threat.vulnerabilityRating ?? 'BASELINE';
  const initialRationale = threat.vulnerabilityRationale ?? '';
  const [rating, setRating] = useState<VulnerabilityRating>(initialRating);
  const [rationale, setRationale] = useState(initialRationale);

  const { status, error } = useDebouncedAutoSave(
    { rating, rationale },
    { rating: initialRating, rationale: initialRationale },
    800,
    (v) => v.rationale.trim().length > 0,
    (v) => onSave(v.rating, v.rationale),
  );

  return (
    <div className="space-y-3">
      <div>
        <Lbl>Current control state — {VULN_LABEL[rating]}</Lbl>
        <div role="radiogroup" aria-label="Vulnerability rating" className="flex gap-1">
          {VULNERABILITY_RATINGS.map((r) => {
            const on = r === rating;
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setRating(r)}
                className={`flex-1 h-7 px-2 rounded-r2 text-[11.5px] font-semibold border transition-colors ${
                  on
                    ? 'bg-a-500 text-white border-a-600 shadow-sh1'
                    : 'bg-white text-n-700 border-n-200 hover:border-n-300 hover:bg-n-50'
                }`}
              >
                {VULN_LABEL[r]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-10">
          <Lbl>Rationale</Lbl>
          <input
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            className={INPUT_CLS}
            placeholder="Describe existing controls and gaps"
          />
        </div>
        <div className="col-span-2 pb-[2px]">
          <SaveStatusBadge status={status} error={error} />
        </div>
      </div>
    </div>
  );
}

// ── STEP 7: Treatment ────────────────────────────────────

function TreatmentStep({ assessment, actionPlans, onChanged }: {
  assessment: AssessmentDetail;
  actionPlans: ActionPlan[];
  onChanged: () => Promise<void>;
}) {
  const plansByThreat = useMemo(() => {
    const m = new Map<string, ActionPlan[]>();
    for (const p of actionPlans) {
      const list = m.get(p.threatId) ?? [];
      list.push(p);
      m.set(p.threatId, list);
    }
    return m;
  }, [actionPlans]);

  return (
    <PerThreatRatingStep
      assessment={assessment}
      onChanged={onChanged}
      title="Step 7 — Treatment"
      subtitle="Choose a TEAR strategy for each HIGH/HIGHEST threat. REDUCE needs at least one action plan; Transfer/Eliminate/Accept need an ALARP justification."
      scoreKey="treatment"
      sweepContext={{ plansByThreat }}
      renderControls={(t) => (
        <TreatmentControl
          assessmentId={assessment.id}
          threat={t}
          plans={plansByThreat.get(t.id) ?? []}
          onChanged={onChanged}
        />
      )}
    />
  );
}

function TreatmentControl({ assessmentId, threat, plans, onChanged }: {
  assessmentId: string;
  threat: ThreatSummary;
  plans: ActionPlan[];
  onChanged: () => Promise<void>;
}) {
  const priority = threat.riskTreatmentPriority;
  const highPriority = priority === 'HIGH' || priority === 'HIGHEST';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lbl>Treatment priority</Lbl>
        {priority ? (
          <RiskBadge level={PRIORITY_TO_LEVEL[priority]} value={priority} />
        ) : (
          <span className="text-[11px] text-n-400">not computed</span>
        )}
        <span className="flex-1" />
        {threat.tearStrategy && (
          <Pill variant="accent">{TEAR_LABEL[threat.tearStrategy]}</Pill>
        )}
      </div>

      <TearPicker
        assessmentId={assessmentId}
        threat={threat}
        highPriority={highPriority}
        onChanged={onChanged}
      />

      <ThreatTagsEditor
        assessmentId={assessmentId}
        threat={threat}
        onChanged={onChanged}
      />

      {threat.tearStrategy === 'REDUCE' && (
        <ActionPlansBlock
          assessmentId={assessmentId}
          threat={threat}
          plans={plans}
          highPriority={highPriority}
          onChanged={onChanged}
        />
      )}

      {!threat.tearStrategy && highPriority && (
        <div className="bg-warn-bg border border-warn/30 rounded-r2 px-3 py-2 text-[12px] text-warn font-medium">
          {priority} priority — choose a TEAR strategy before submission.
        </div>
      )}
    </div>
  );
}

function TearPicker({ assessmentId, threat, highPriority, onChanged }: {
  assessmentId: string;
  threat: ThreatSummary;
  highPriority: boolean;
  onChanged: () => Promise<void>;
}) {
  const initialStrategy = threat.tearStrategy;
  const initialAlarp = threat.alarpJustification ?? '';
  const [strategy, setStrategy] = useState<TearStrategy | null>(initialStrategy);
  const [alarp, setAlarp] = useState(initialAlarp);

  const needsAlarp = strategy && strategy !== 'REDUCE' && highPriority;

  const { status, error } = useDebouncedAutoSave(
    { strategy, alarp },
    { strategy: initialStrategy, alarp: initialAlarp },
    800,
    (v) => v.strategy != null,
    async (v) => {
      if (!v.strategy) return;
      await assessmentsApi.setTear(assessmentId, threat.id, v.strategy, v.alarp.trim() || null);
      await onChanged();
    },
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Lbl>TEAR strategy</Lbl>
        <span className="flex-1" />
        <SaveStatusBadge status={status} error={error} />
      </div>
      <div role="radiogroup" aria-label="TEAR strategy" className="grid grid-cols-4 gap-1.5">
        {TEAR_STRATEGIES.map((s) => {
          const on = s === strategy;
          const letter = s.charAt(0);
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setStrategy(s)}
              className={`flex flex-col items-start gap-0.5 h-auto px-3 py-2 rounded-r2 border text-left transition-colors ${
                on
                  ? 'bg-a-500 text-white border-a-600 shadow-sh1'
                  : 'bg-white text-n-700 border-n-200 hover:border-n-300 hover:bg-n-50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-r1 font-mono text-[11px] font-bold ${
                  on ? 'bg-white/20 text-white' : 'bg-n-100 text-n-700'
                }`}>
                  {letter}
                </span>
                <span className="text-[12px] font-semibold">{TEAR_LABEL[s]}</span>
              </div>
              <span className={`text-[10.5px] leading-tight ${on ? 'text-white/85' : 'text-n-500'}`}>
                {TEAR_BLURB[s]}
              </span>
            </button>
          );
        })}
      </div>

      {strategy && strategy !== 'REDUCE' && (
        <div>
          <Lbl>ALARP justification {needsAlarp && <span className="text-bad">*</span>}</Lbl>
          <textarea
            value={alarp}
            onChange={(e) => setAlarp(e.target.value)}
            placeholder="Why is this risk tolerable (As Low As Reasonably Practicable)? Cite cost, regulatory stance, or alternative controls."
            className="w-full min-h-[64px] px-2.5 py-1.5 text-[12.5px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
          />
          {needsAlarp && alarp.trim().length === 0 && (
            <div className="text-[11px] text-warn mt-1">Required for {TEAR_LABEL[strategy]} at {threat.riskTreatmentPriority} priority.</div>
          )}
        </div>
      )}
    </div>
  );
}

function ThreatTagsEditor({ assessmentId, threat, onChanged }: {
  assessmentId: string;
  threat: ThreatSummary;
  onChanged: () => Promise<void>;
}) {
  const [tags, setTags] = useState<ComplianceTag[]>(threat.complianceTags);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function update(next: ComplianceTag[]) {
    setTags(next);
    setSaving(true);
    setErr(null);
    try {
      await assessmentsApi.updateThreat(assessmentId, threat.id, { complianceTags: next });
      await onChanged();
    } catch (e) {
      setErr(await extractError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-dashed border-n-150 pt-3 space-y-1">
      <TagMultiSelect value={tags} onChange={update} disabled={saving} />
      {err && <div className="text-[11px] text-bad">{err}</div>}
    </div>
  );
}

function ActionPlansBlock({ assessmentId, threat, plans, highPriority, onChanged }: {
  assessmentId: string;
  threat: ThreatSummary;
  plans: ActionPlan[];
  highPriority: boolean;
  onChanged: () => Promise<void>;
}) {
  const [action, setAction] = useState('');
  const [responsible, setResponsible] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [planTags, setPlanTags] = useState<ComplianceTag[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await actionPlansApi.create(assessmentId, {
        threatId: threat.id,
        actionRequired: action.trim(),
        responsiblePerson: responsible.trim() || null,
        targetDate: targetDate || null,
        complianceTags: planTags.length > 0 ? planTags : undefined,
      });
      setAction(''); setResponsible(''); setTargetDate(''); setPlanTags([]);
      await onChanged();
    } catch (e2) {
      setErr(await extractError(e2));
    } finally {
      setSaving(false);
    }
  }

  async function removePlan(planId: string) {
    if (!window.confirm('Delete this action plan?')) return;
    try {
      await actionPlansApi.remove(planId);
      await onChanged();
    } catch (e2) {
      setErr(await extractError(e2));
    }
  }

  const needsPlan = highPriority && plans.length === 0;

  return (
    <div className="space-y-2 border-t border-dashed border-n-150 pt-3">
      <div className="flex items-center gap-2">
        <Lbl>Action plans</Lbl>
        <span className="flex-1" />
        <span className="text-[11px] font-mono text-n-500">
          {plans.length} plan{plans.length === 1 ? '' : 's'}
        </span>
      </div>

      {needsPlan && (
        <div className="bg-bad-bg border border-bad/30 rounded-r2 px-3 py-2 text-[12px] text-bad font-medium">
          REDUCE strategy at {threat.riskTreatmentPriority} priority requires at least one action plan.
        </div>
      )}

      {plans.length > 0 && (
        <ul className="space-y-1.5">
          {plans.map((p) => (
            <li key={p.id} className="flex items-start gap-2 text-[12.5px] text-n-800 bg-n-25 rounded-r2 px-2.5 py-1.5">
              <div className="flex-1">
                <div>{p.actionRequired}</div>
                <div className="text-[10.5px] font-mono text-n-500 mt-0.5">
                  {p.responsiblePerson ?? 'Unassigned'} · {p.targetDate ?? 'no target date'} · {p.status}
                </div>
                {p.complianceTags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.complianceTags.map((tag) => (
                      <Pill key={tag} variant="accent">{COMPLIANCE_TAG_LABEL[tag]}</Pill>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removePlan(p.id)}
                className="w-6 h-6 inline-flex items-center justify-center text-n-500 hover:bg-bad-bg hover:text-bad rounded-r1"
                aria-label="Delete plan"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="grid grid-cols-12 gap-2">
        <div className="col-span-5">
          <input
            required
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Action required…"
            className={INPUT_CLS}
          />
        </div>
        <div className="col-span-3">
          <input
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            placeholder="Responsible person"
            className={INPUT_CLS}
          />
        </div>
        <div className="col-span-2">
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
        <div className="col-span-2 flex items-end h-full">
          <Btn2 type="submit" variant="secondary" disabled={saving || !action.trim()} leading={<Plus className="w-3.5 h-3.5" />}>
            {saving ? 'Adding…' : 'Add plan'}
          </Btn2>
        </div>
        <div className="col-span-12">
          <TagMultiSelect value={planTags} onChange={setPlanTags} disabled={saving} />
        </div>
        {err && <div className="col-span-12 text-[11.5px] text-bad">{err}</div>}
      </form>
    </div>
  );
}

// ── REVIEW (after step 7 submission) ──────────────────────

function ReviewStep({ assessment, onReview }: {
  assessment: AssessmentDetail;
  onReview: (action: 'approve' | 'reject', notes: string) => Promise<void>;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const isRejected = assessment.reviewStatus === 'REJECTED';
  const isLead = currentUser?.id === assessment.leadAssessorId;
  const canReview = hasPermission(currentUser?.role, 'assessments:review') && !isLead && !isRejected;

  const headerTitle = isRejected ? 'Sent back for revision' : 'Under review';
  const headerCopy = isRejected
    ? 'A reviewer rejected this assessment. The lead assessor should address the notes below and resubmit.'
    : isLead
      ? "You're the lead assessor on this one, so another reviewer must approve it. You'll see their decision here."
      : canReview
        ? 'Review the threats below, then approve or reject with optional notes.'
        : 'A reviewer (not the lead assessor) must approve or reject this assessment.';

  return (
    <div className="space-y-4">
      <div
        className={[
          'bg-white border rounded-r3 shadow-sh1 p-5',
          isRejected ? 'border-bad/30' : 'border-n-150',
        ].join(' ')}
      >
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-[14px] font-semibold text-n-900">{headerTitle}</h3>
          {isRejected && <Pill variant="bad">REJECTED</Pill>}
        </div>
        <p className="text-[12px] text-n-600">{headerCopy}</p>
        {isRejected && assessment.reviewNotes && (
          <div className="mt-3 border-t border-n-100 pt-3">
            <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
              Reviewer notes
            </div>
            <p className="text-[12.5px] text-n-700 whitespace-pre-wrap">{assessment.reviewNotes}</p>
          </div>
        )}
      </div>

      <ThreatsTable threats={assessment.threats} />

      {canReview && (
        <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-5">
          <label className="block mb-3">
            <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
              Review notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[80px] px-2.5 py-1.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
              placeholder="Optional notes to the lead assessor"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Btn2 variant="ghost" disabled={busy} onClick={async () => { setBusy(true); await onReview('reject', notes); setBusy(false); }}>
              <ArrowLeft className="w-3.5 h-3.5" /> Reject
            </Btn2>
            <Btn2 variant="primary" disabled={busy} onClick={async () => { setBusy(true); await onReview('approve', notes); setBusy(false); }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </Btn2>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared: per-threat rating step wrapper ────────────────

type ScoreKey = 'likelihood' | 'impact' | 'vulnerability' | 'treatment';
type SweepContext = { plansByThreat?: Map<string, ActionPlan[]> };

function threatScoreCell(
  t: ThreatSummary,
  scoreKey: ScoreKey,
  ctx?: SweepContext,
): { value: string; filled: boolean } {
  if (scoreKey === 'likelihood') {
    const v = t.likelihoodScore;
    return { value: v == null ? '—' : String(v), filled: v != null };
  }
  if (scoreKey === 'impact') {
    const v = t.impactScore;
    return { value: v == null ? '—' : String(v), filled: v != null };
  }
  if (scoreKey === 'vulnerability') {
    const v = t.vulnerabilityRating;
    const short: Record<string, string> = { STRONG: 'S', BASELINE: 'B', BARELY_ADEQUATE: 'BA', INADEQUATE: 'I' };
    return { value: v == null ? '—' : short[v] ?? '?', filled: v != null };
  }
  const plans = ctx?.plansByThreat?.get(t.id) ?? [];
  const highPrio = t.riskTreatmentPriority === 'HIGH' || t.riskTreatmentPriority === 'HIGHEST';
  if (!highPrio) return { value: '—', filled: true };
  const tearLetter = t.tearStrategy?.charAt(0) ?? null;
  if (!t.tearStrategy) return { value: '—', filled: false };
  if (t.tearStrategy === 'REDUCE') {
    return { value: `R·${plans.length}`, filled: plans.length > 0 };
  }
  const alarpOk = !!t.alarpJustification && t.alarpJustification.trim().length > 0;
  return { value: tearLetter ?? '—', filled: alarpOk };
}

function ThreatsSweepPanel({ threats, selectedId, onSelect, scoreKey, stepLabel, sweepContext }: {
  threats: ThreatSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  scoreKey: ScoreKey;
  stepLabel: string;
  sweepContext?: SweepContext;
}) {
  const pending = threats.filter((t) => !threatScoreCell(t, scoreKey, sweepContext).filled).length;
  return (
    <div className="border-r border-n-150 bg-white flex flex-col min-h-0">
      <div className="px-4 py-2.5 border-b border-n-150 flex items-center gap-2">
        <h3 className="text-[13px] font-semibold text-n-900 m-0">Threats · {stepLabel}</h3>
        {pending > 0 && <Pill variant="warn">{pending} pending</Pill>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {threats.map((t, i) => {
          const cell = threatScoreCell(t, scoreKey, sweepContext);
          const on = t.id === selectedId;
          const id = `T-${String(i + 1).padStart(4, '0')}`;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`w-full text-left px-3.5 py-2.5 border-b border-n-100 cursor-pointer transition-colors ${
                on
                  ? 'bg-a-50 border-l-[3px] border-l-a-500 pl-[13px]'
                  : 'border-l-[3px] border-l-transparent hover:bg-n-50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`font-mono text-[10px] font-semibold ${on ? 'text-a-700' : 'text-n-500'}`}>
                  {id}
                </span>
                <span className="flex-1" />
                {t.irv ? (
                  <RiskBadge level={IRV_TO_LEVEL[t.irv]} />
                ) : (
                  <Pill variant="outline">pending</Pill>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-[22px] rounded-r1 border flex items-center justify-center font-mono text-[12px] font-bold flex-shrink-0 ${
                    cell.filled
                      ? 'bg-n-75 border-n-200 text-n-900'
                      : 'bg-n-100 border-n-200 text-n-400'
                  }`}
                >
                  {cell.value}
                </div>
                <span className={`text-[12.5px] leading-tight ${on ? 'font-semibold text-n-900' : 'font-medium text-n-900'}`}>
                  {t.adversaryType} → {t.actionType}
                </span>
              </div>
              <div className="text-[10.5px] text-n-500 mt-1 truncate">{t.targetAssetName}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThreatContextCard({ threat }: { threat: ThreatSummary }) {
  return (
    <div className="bg-white border border-n-150 rounded-r3 px-3.5 py-2.5 mb-3 shadow-sh1">
      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
        <span className="font-mono text-[10px] text-a-600 font-semibold">THREAT</span>
        <Pill variant="outline">{threat.adversaryType}</Pill>
        <Pill variant="outline">{threat.actionType}</Pill>
        <span className="flex-1" />
        <Lbl>IRV</Lbl>
        {threat.irv ? (
          <RiskBadge level={IRV_TO_LEVEL[threat.irv]} />
        ) : (
          <span className="text-[11px] text-n-400">not scored</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-dashed border-n-150">
        <ThreeA label="Adversary" value={threat.adversaryType} sub={threat.adversaryDescription} />
        <ThreeA label="Asset" value={threat.targetAssetName ?? '—'} sub={null} />
        <ThreeA label="Action" value={threat.actionType} sub={threat.actionDescription} />
      </div>
    </div>
  );
}

function ThreeA({ label, value, sub }: { label: string; value: string; sub: string | null }) {
  return (
    <div>
      <Lbl>{label}</Lbl>
      <div className="text-[13px] font-medium text-n-900 leading-tight">{value}</div>
      {sub && <div className="font-mono text-[10px] text-n-500 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function PerThreatRatingStep({ assessment, title, subtitle, renderControls, scoreKey, sweepContext }: {
  assessment: AssessmentDetail;
  onChanged: () => Promise<void>;
  title: string;
  subtitle: string;
  renderControls: (t: ThreatSummary) => React.ReactNode;
  scoreKey: ScoreKey;
  sweepContext?: SweepContext;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(assessment.threats[0]?.id ?? null);
  const selected = assessment.threats.find((t) => t.id === selectedId) ?? assessment.threats[0] ?? null;

  if (assessment.threats.length === 0) {
    return (
      <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-6 text-center text-[12.5px] text-n-500">
        No threats — go back and add some in Step 2.
      </div>
    );
  }

  return (
    <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 overflow-hidden">
      <div className="border-b border-n-150 px-4 py-3">
        <h3 className="text-[14px] font-semibold text-n-900 m-0">{title}</h3>
        <p className="text-[12px] text-n-600 mt-0.5">{subtitle}</p>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '320px 1fr' }}>
        <ThreatsSweepPanel
          threats={assessment.threats}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          scoreKey={scoreKey}
          stepLabel={title.replace(/^Step \d+ — /, '')}
          sweepContext={sweepContext}
        />
        <div className="p-4 min-w-0">
          {selected ? (
            <div key={selected.id}>
              <ThreatContextCard threat={selected} />
              {renderControls(selected)}
            </div>
          ) : (
            <div className="text-[12.5px] text-n-500">Select a threat from the left.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── shared UI helpers ─────────────────────────────────────

const INPUT_CLS = 'w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none';

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-0.5 capitalize">
      {children}
    </span>
  );
}
