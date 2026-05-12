import { useEffect, useState } from 'react';
import { Btn2 } from './hifi/Btn2';
import { assessmentsApi, usersApi, type UserSummary } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import { isSandbox } from '../lib/sandbox';
import type { AssessmentDetail } from '../lib/csmp-types';

const APPROVER_ROLES: UserSummary['role'][] = ['ADMIN', 'REVIEWER', 'LEAD_ASSESSOR'];
const SELECT_CLS =
  'w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none';

function displayName(u: UserSummary) {
  const name = `${u.firstName} ${u.lastName}`.trim();
  return name || u.email;
}

export function ApproverPicker({
  assessment,
  canEdit,
  onChanged,
}: {
  assessment: AssessmentDetail;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const sandbox = isSandbox();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(!sandbox);
  const [selected, setSelected] = useState<string | null>(assessment.approverId);
  const [version, setVersion] = useState<string>(assessment.version);
  const [period, setPeriod] = useState<string>(assessment.period ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sandbox) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await usersApi.list({ active: true });
        if (cancelled) return;
        setUsers(res.items.filter((u) => APPROVER_ROLES.includes(u.role)));
      } catch (err) {
        if (!cancelled) setError(await extractError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sandbox]);

  const dirty =
    selected !== assessment.approverId ||
    version !== assessment.version ||
    (period || null) !== (assessment.period || null);

  async function handleSave() {
    if (!dirty) return;
    setBusy(true);
    setError(null);
    try {
      await assessmentsApi.update(assessment.id, {
        approverId: selected,
        version: version.trim() || undefined,
        period: period.trim() || null,
      });
      await onChanged();
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setBusy(false);
    }
  }

  const currentApprover = users.find((u) => u.id === assessment.approverId);

  return (
    <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-5">
      <div className="mb-4">
        <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
          Report metadata
        </div>
        <h3 className="text-[15px] font-semibold text-n-900">Sign-off &amp; cover details</h3>
        <p className="text-[12px] text-n-600 mt-1">
          Board-level approver and cover-page labels shown on the final PDF report.
        </p>
      </div>

      {error && (
        <div className="mb-3 text-[12px] text-bad bg-bad/10 border border-bad/20 rounded-r2 px-2.5 py-1.5">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {!sandbox && (
          <label className="col-span-2">
            <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-0.5">
              Approver (board-level)
            </span>
            {canEdit ? (
              <select
                className={SELECT_CLS}
                value={selected ?? ''}
                disabled={loading}
                onChange={(e) => setSelected(e.target.value || null)}
              >
                <option value="">— None —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {displayName(u)} ({u.role})
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-[12.5px] text-n-700">
                {currentApprover ? displayName(currentApprover) : '—'}
              </div>
            )}
          </label>
        )}
        <label className="col-span-1">
          <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-0.5">
            Version
          </span>
          {canEdit ? (
            <input
              className={SELECT_CLS}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              maxLength={16}
              placeholder="v1.0"
            />
          ) : (
            <div className="text-[12.5px] text-n-700 font-mono">{assessment.version}</div>
          )}
        </label>
        <label className="col-span-1">
          <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-0.5">
            Period
          </span>
          {canEdit ? (
            <input
              className={SELECT_CLS}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              maxLength={40}
              placeholder="2026 cycle"
            />
          ) : (
            <div className="text-[12.5px] text-n-700">{assessment.period ?? '—'}</div>
          )}
        </label>
      </div>

      {canEdit && (
        <div className="flex justify-end mt-4">
          <Btn2 variant="primary" disabled={!dirty || busy} onClick={handleSave}>
            {busy ? 'Saving…' : 'Save'}
          </Btn2>
        </div>
      )}

      {assessment.signedOffAt && (
        <div className="mt-3 text-[11px] text-n-500">
          Signed off {new Date(assessment.signedOffAt).toISOString().slice(0, 10)}
        </div>
      )}
    </div>
  );
}
