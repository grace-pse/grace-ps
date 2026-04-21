import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnalystReport, type AnalystReportProps, type SectionKey } from './variants/Analyst.js';
import { REPORT_CSS } from './styles.js';
import type { ReportData } from './types.js';

export type ReportVariant = 'analyst';

export interface RenderReportOptions {
  variant?: ReportVariant;
  sections?: Partial<Record<SectionKey, boolean>>;
  paper?: 'A4' | 'Letter';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderReportHtml(data: ReportData, opts: RenderReportOptions = {}): string {
  const variant = opts.variant ?? 'analyst';
  let body: string;
  switch (variant) {
    case 'analyst': {
      const props: AnalystReportProps = {
        data,
        sections: opts.sections,
        paper: opts.paper ?? 'A4',
      };
      body = renderToStaticMarkup(<AnalystReport {...props} />);
      break;
    }
    default: {
      const exhaustive: never = variant;
      throw new Error(`Unknown report variant: ${String(exhaustive)}`);
    }
  }
  return (
    `<!DOCTYPE html><html><head>` +
    `<meta charset="utf-8">` +
    `<title>${escapeHtml(data.assessment.title)}</title>` +
    `<style>${REPORT_CSS}</style>` +
    `</head><body>${body}</body></html>`
  );
}

export { AnalystReport } from './variants/Analyst.js';
export type { ReportData } from './types.js';
export { buildReportData, AssessmentNotFoundError } from './data.js';
