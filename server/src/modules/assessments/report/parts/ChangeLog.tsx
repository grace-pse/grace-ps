import * as React from 'react';
import type { ChangeLogEntry } from '../types.js';
import { EnumPill } from './Pill.js';

export function ChangeLog({ entries }: { entries: ChangeLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rep-muted" style={{ fontSize: '9.5pt', margin: 0 }}>
        No change-log entries recorded for this assessment.
      </p>
    );
  }
  return (
    <table className="rep-tbl rep-tbl--log">
      <thead>
        <tr>
          <th>Date</th>
          <th>User</th>
          <th>Action</th>
          <th>Detail</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr key={i}>
            <td className="rep-mono">{e.date.toISOString().slice(0, 10)}</td>
            <td>{e.user}</td>
            <td>
              <EnumPill tone="mono">{e.action}</EnumPill>
            </td>
            <td>{e.detail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
