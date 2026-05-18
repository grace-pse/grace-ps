import * as React from 'react';

export function Logo({ size = 18, label = true }: { size?: number; label?: boolean }) {
  const gradId = `lg${size}`;
  return (
    <span className="rep-logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4f56e5" />
            <stop offset="1" stopColor="#3436a4" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="24" height="24" rx="5" fill={`url(#${gradId})`} />
      </svg>
      {label && (
        <span className="rep-logo__wm">
          GRACE<span className="rep-logo__sub">· Engine</span>
        </span>
      )}
    </span>
  );
}

export function Hdr({ title, page }: { title: string; page: string }) {
  return (
    <div className="rep-hdr">
      <div className="rep-hdr__left">
        <Logo size={14} />
        <span>{title}</span>
      </div>
      <div className="rep-hdr__right">{page} · GRACE</div>
    </div>
  );
}

export function Ftr({ orgName, generatedAt, assessmentShortId }: { orgName: string; generatedAt: Date; assessmentShortId: string }) {
  const iso = generatedAt.toISOString().slice(0, 10);
  return (
    <div className="rep-ftr">
      <span>GRACE Engine · Confidential · {orgName}</span>
      <span>
        Generated {iso} · {assessmentShortId}
      </span>
    </div>
  );
}
