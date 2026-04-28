// Survey run page. Renders the template question tree for an in-progress
// response and autosaves answers/evidenceSource on blur. DRAFT responses
// can be edited or submitted (scoring happens server-side); submitted
// responses are read-only with the computed score/rating shown.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Send, Trash2, TrendingDown, AlertTriangle, CircleAlert, Info } from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Btn2 } from '../components/hifi/Btn2';
import { Pill } from '../components/hifi/Pill';
import { surveysApi, type SurveyDriftResponse, type DiffSeverity } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  type SurveyResponseDetail, type SurveyQuestion, type SurveyRating, type SurveyStatus,
} from '../lib/csmp-types';

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

export function SurveyRunPage() {
  const { id } = useParams({ from: '/protected/surveys/$id' });
  const navigate = useNavigate();

  const [survey, setSurvey] = useState<SurveyResponseDetail | null>(null);
  const [drift, setDrift] = useState<SurveyDriftResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await surveysApi.get(id);
      setSurvey(r);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!survey || survey.status === 'DRAFT') {
      setDrift(null);
      return;
    }
    void (async () => {
      try {
        const r = await surveysApi.drift(survey.id);
        setDrift(r);
      } catch {
        // drift is best-effort — ignore
      }
    })();
  }, [survey]);

  async function saveAnswers(nextAnswers: Record<string, unknown>, fieldKey: string) {
    if (!survey || survey.status !== 'DRAFT') return;
    setSavingField(fieldKey);
    try {
      const updated = await surveysApi.update(survey.id, { answers: nextAnswers });
      setSurvey(updated);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSavingField(null);
    }
  }

  async function saveEvidenceSource(value: string) {
    if (!survey || survey.status !== 'DRAFT') return;
    setSavingField('__evidenceSource');
    try {
      const updated = await surveysApi.update(survey.id, {
        evidenceSource: value.trim() || null,
      });
      setSurvey(updated);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSavingField(null);
    }
  }

  async function handleSubmit() {
    if (!survey) return;
    if (!window.confirm('Submit this survey? Answers will be scored and locked.')) return;
    setSubmitting(true);
    try {
      const updated = await surveysApi.submit(survey.id);
      setSurvey(updated);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!survey) return;
    if (!window.confirm('Delete this draft survey? This cannot be undone.')) return;
    try {
      await surveysApi.remove(survey.id);
      await navigate({ to: '/surveys' });
    } catch (err) {
      setError(await extractError(err));
    }
  }

  const grouped = useMemo(() => {
    if (!survey) return new Map<string, SurveyQuestion[]>();
    const map = new Map<string, SurveyQuestion[]>();
    for (const q of survey.template.schema.questions) {
      const key = q.category ?? 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }
    return map;
  }, [survey]);

  if (loading) {
    return (
      <>
        <Topbar breadcrumbs={<span>Work / Surveys / …</span>} title="Survey" />
        <div className="p-6 text-[12.5px] text-n-500">Loading…</div>
      </>
    );
  }

  if (!survey) {
    return (
      <>
        <Topbar breadcrumbs={<span>Work / Surveys / Not found</span>} title="Survey not found" />
        <div className="p-6 text-[12.5px] text-bad">{error ?? 'Survey not found.'}</div>
      </>
    );
  }

  const readOnly = survey.status !== 'DRAFT';
  const answered = Object.keys(survey.answers ?? {}).length;
  const total = survey.template.schema.questions.length;

  return (
    <>
      <Topbar
        breadcrumbs={
          <span>
            Work / <button
              type="button"
              className="text-a-700 hover:underline"
              onClick={() => void navigate({ to: '/surveys' })}
            >
              Surveys
            </button> / {survey.template.name}
          </span>
        }
        title={survey.template.name}
        subtitle={`${survey.clusterName ?? 'Cluster —'} · ${survey.surveyType.replace('_', ' ')}`}
        actions={
          <div className="flex items-center gap-2">
            <Btn2
              variant="ghost"
              leading={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => void navigate({ to: '/surveys' })}
            >
              Back
            </Btn2>
            {!readOnly && (
              <>
                <Btn2
                  variant="ghost"
                  leading={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={handleDelete}
                >
                  Delete draft
                </Btn2>
                <Btn2
                  variant="primary"
                  leading={<Send className="w-3.5 h-3.5" />}
                  onClick={handleSubmit}
                  disabled={submitting || answered === 0}
                >
                  {submitting ? 'Submitting…' : 'Submit survey'}
                </Btn2>
              </>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {error && (
          <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-4 flex flex-wrap items-center gap-3">
          <Pill variant={STATUS_VARIANT[survey.status]}>{survey.status}</Pill>
          {survey.rating && (
            <Pill variant={RATING_VARIANT[survey.rating]}>{survey.rating.replace('_', ' ')}</Pill>
          )}
          {survey.scorePct != null && (
            <div className="text-[12.5px] text-n-700">
              Score <span className="font-mono font-medium">{survey.scorePct.toFixed(1)}%</span>
            </div>
          )}
          <div className="text-[11.5px] text-n-500 ml-auto">
            {answered} / {total} answered
          </div>
        </div>

        {drift && drift.hasPrevious && drift.diffs.length > 0 && (
          <DriftSection drift={drift} />
        )}

        <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-4">
          <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
            Evidence source
          </div>
          <input
            className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
            placeholder="Walkthrough 2026-04-21, VMS review 2026-04-22, etc."
            defaultValue={survey.evidenceSource ?? ''}
            disabled={readOnly}
            onBlur={(e) => {
              if (e.target.value.trim() !== (survey.evidenceSource ?? '')) {
                void saveEvidenceSource(e.target.value);
              }
            }}
          />
          {savingField === '__evidenceSource' && (
            <div className="text-[10.5px] font-mono text-n-500 mt-1">saving…</div>
          )}
        </div>

        {Array.from(grouped.entries()).map(([category, questions]) => (
          <div
            key={category}
            className="bg-white border border-n-150 rounded-r3 shadow-sh1"
          >
            <div className="px-4 py-2 border-b border-n-150 text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">
              {category}
            </div>
            <div className="divide-y divide-n-100">
              {questions.map((q) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  value={survey.answers[q.id]}
                  disabled={readOnly}
                  saving={savingField === q.id}
                  onChange={(v) => {
                    const next = { ...(survey.answers as Record<string, unknown>) };
                    if (v == null || v === '') delete next[q.id];
                    else next[q.id] = v;
                    setSurvey({ ...survey, answers: next });
                  }}
                  onCommit={(v) => {
                    const next = { ...(survey.answers as Record<string, unknown>) };
                    if (v == null || v === '') delete next[q.id];
                    else next[q.id] = v;
                    void saveAnswers(next, q.id);
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function QuestionRow({
  question, value, disabled, saving, onChange, onCommit,
}: {
  question: SurveyQuestion;
  value: unknown;
  disabled: boolean;
  saving: boolean;
  onChange: (v: unknown) => void;
  onCommit: (v: unknown) => void;
}) {
  const current = typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-2 mb-1.5">
        <div className="flex-1">
          <div className="text-[12.5px] text-n-900">{question.prompt}</div>
          {question.hint && (
            <div className="text-[11px] text-n-500 mt-0.5">{question.hint}</div>
          )}
        </div>
        <Pill variant="outline">weight {question.weight}</Pill>
      </div>

      {question.type === 'yes_no_partial' && (
        <div className="flex gap-1.5">
          {['YES', 'PARTIAL', 'NO'].map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange(opt);
                onCommit(opt);
              }}
              className={[
                'text-[11px] font-medium rounded-r1 px-2 h-7 border',
                current === opt
                  ? 'bg-a-50 text-a-700 border-a-300'
                  : 'bg-white text-n-700 border-n-200 hover:bg-n-75',
                disabled ? 'opacity-60 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {question.type === 'number' && (
        <input
          type="number"
          disabled={disabled}
          defaultValue={current}
          className="w-40 border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
          onBlur={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value);
            onCommit(v);
          }}
        />
      )}

      {question.type === 'text' && (
        <textarea
          disabled={disabled}
          defaultValue={current}
          className="w-full border border-n-200 rounded-r1 px-2 py-1.5 text-[12.5px] min-h-[50px]"
          onBlur={(e) => onCommit(e.target.value)}
        />
      )}

      {question.type === 'select' && (
        <select
          disabled={disabled}
          value={current}
          className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
          onChange={(e) => {
            onChange(e.target.value);
            onCommit(e.target.value);
          }}
        >
          <option value="">—</option>
          {(question.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}

      {saving && (
        <div className="text-[10.5px] font-mono text-n-500 mt-1">saving…</div>
      )}
    </div>
  );
}

const SEVERITY_PILL: Record<DiffSeverity, 'bad' | 'warn' | 'info'> = {
  CRITICAL: 'bad',
  WARN: 'warn',
  INFO: 'info',
};

const SEVERITY_ICON: Record<DiffSeverity, typeof Info> = {
  CRITICAL: CircleAlert,
  WARN: AlertTriangle,
  INFO: Info,
};

function formatAnswer(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function DriftSection({ drift }: { drift: SurveyDriftResponse }) {
  const severity = drift.topSeverity ?? 'INFO';
  return (
    <div className="bg-white border border-n-150 rounded-r3 shadow-sh1">
      <div className="px-4 py-3 border-b border-n-150 flex items-center gap-2">
        <TrendingDown className="w-4 h-4 text-n-500" />
        <div className="flex-1">
          <div className="text-[12.5px] font-medium text-n-900">
            Drift vs previous submission
          </div>
          <div className="text-[11px] text-n-500">
            {drift.previousConductedAt
              ? `Compared against submission on ${new Date(drift.previousConductedAt).toLocaleDateString()}`
              : 'No prior submission found.'}
          </div>
        </div>
        <Pill variant={SEVERITY_PILL[severity]}>{severity.toLowerCase()}</Pill>
      </div>
      <div className="divide-y divide-n-100">
        {drift.diffs.map((d) => {
          const Icon = SEVERITY_ICON[d.severity];
          return (
            <div key={d.questionId} className="px-4 py-2.5 flex items-start gap-2">
              <Icon
                className={[
                  'w-3.5 h-3.5 shrink-0 mt-0.5',
                  d.severity === 'CRITICAL'
                    ? 'text-bad'
                    : d.severity === 'WARN'
                    ? 'text-warn'
                    : 'text-info',
                ].join(' ')}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] text-n-900">{d.prompt}</div>
                <div className="text-[11px] text-n-600 mt-0.5">
                  <span className="font-mono">{formatAnswer(d.from)}</span>
                  <span className="mx-1.5 text-n-400">→</span>
                  <span className="font-mono">{formatAnswer(d.to)}</span>
                </div>
                <div className="text-[10.5px] text-n-500 mt-0.5 italic">{d.reason}</div>
              </div>
              <Pill variant={SEVERITY_PILL[d.severity]}>{d.severity.toLowerCase()}</Pill>
            </div>
          );
        })}
      </div>
    </div>
  );
}
