import * as React from 'react';
import type { Assessment } from '@prisma/client';
import type { UserRef } from '../types.js';

function isoDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

function fullName(u: UserRef | null): string {
  if (!u) return '—';
  return `${u.firstName} ${u.lastName}`.trim();
}

export function SignOff({
  assessment,
  leadAssessor,
  reviewer,
  approver,
}: {
  assessment: Assessment;
  leadAssessor: UserRef | null;
  reviewer: UserRef | null;
  approver: UserRef | null;
}) {
  const rows: { role: string; person: UserRef | null; date: Date | null }[] = [
    { role: 'Lead assessor', person: leadAssessor, date: assessment.completedAt },
    { role: 'Reviewer', person: reviewer, date: assessment.completedAt },
    { role: 'Approver (board-level)', person: approver, date: assessment.signedOffAt },
  ];
  return (
    <div className="rep-signoff">
      {rows.map((r) => (
        <div key={r.role} className="rep-signoff__row">
          <div className="rep-kicker">{r.role}</div>
          <div className="rep-signoff__name">{fullName(r.person)}</div>
          <div className="rep-signoff__meta">{r.person?.role ?? ''}</div>
          <div className="rep-signoff__line" />
          <div className="rep-signoff__date">
            <span className="rep-kicker">Date</span>
            <span className="rep-mono">{isoDate(r.date)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
