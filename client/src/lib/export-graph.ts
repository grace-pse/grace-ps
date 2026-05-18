import { toJpeg, toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { Edge, Node } from '@xyflow/react';
import { downloadDataUrl, downloadText } from './download';

export type MermaidNodeMeta = {
  id: string;
  name: string;
  assetType: string;
  criticality: number;
};

export type MermaidEdgeMeta = {
  source: string;
  target: string;
  label: string;
  hierarchy?: boolean;
};

const safeId = (id: string) => 'n_' + id.replace(/[^A-Za-z0-9_]/g, '_');

const escLabel = (s: string) =>
  s
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .slice(0, 80);

export function toMermaid(nodes: MermaidNodeMeta[], edges: MermaidEdgeMeta[]): string {
  const lines: string[] = ['flowchart LR'];
  for (const n of nodes) {
    const label = `${escLabel(n.name)}<br/>[${n.assetType}] C${n.criticality}`;
    lines.push(`  ${safeId(n.id)}["${label}"]`);
  }
  for (const e of edges) {
    const arrow = e.hierarchy ? '-.->' : '-->';
    const lab = escLabel(e.label || (e.hierarchy ? 'contains' : ''));
    if (lab) {
      lines.push(`  ${safeId(e.source)} ${arrow}|${lab}| ${safeId(e.target)}`);
    } else {
      lines.push(`  ${safeId(e.source)} ${arrow} ${safeId(e.target)}`);
    }
  }
  return lines.join('\n') + '\n';
}

export function downloadMermaid(filename: string, mermaid: string) {
  downloadText(filename.endsWith('.mmd') ? filename : `${filename}.mmd`, mermaid, 'text/plain');
}

export function reactFlowMetaFromGraph(
  visibleNodes: Node[],
  visibleEdges: Edge[],
): { nodes: MermaidNodeMeta[]; edges: MermaidEdgeMeta[] } {
  const nodes: MermaidNodeMeta[] = visibleNodes.map((n) => {
    const d = (n.data ?? {}) as { name?: string; assetType?: string; criticality?: number };
    return {
      id: n.id,
      name: d.name ?? n.id,
      assetType: d.assetType ?? 'ASSET',
      criticality: typeof d.criticality === 'number' ? d.criticality : 0,
    };
  });
  const edges: MermaidEdgeMeta[] = visibleEdges.map((e) => ({
    source: e.source,
    target: e.target,
    label: typeof e.label === 'string' ? e.label : '',
    hierarchy: e.id.startsWith('hier-'),
  }));
  return { nodes, edges };
}

const A4_LANDSCAPE_MM = { w: 297, h: 210 };

const captureOptions = (element: HTMLElement) => ({
  pixelRatio: 2,
  backgroundColor: '#fafaf9',
  cacheBust: true,
  filter: (node: HTMLElement) => {
    if (!node?.classList) return true;
    return !(
      node.classList.contains('react-flow__minimap') ||
      node.classList.contains('react-flow__controls') ||
      node.classList.contains('react-flow__attribution') ||
      node.classList.contains('csmp-no-export')
    );
  },
  width: element.clientWidth,
  height: element.clientHeight,
});

export async function exportNodeAsJpeg(element: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toJpeg(element, { ...captureOptions(element), quality: 0.92 });
  downloadDataUrl(filename.endsWith('.jpg') || filename.endsWith('.jpeg') ? filename : `${filename}.jpg`, dataUrl);
}

export async function exportNodeAsPdfLandscape(element: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toPng(element, captureOptions(element));
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load captured image'));
    img.src = dataUrl;
  });

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageW = A4_LANDSCAPE_MM.w;
  const pageH = A4_LANDSCAPE_MM.h;
  const margin = 8;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;

  const aspect = img.width / img.height;
  let drawW = maxW;
  let drawH = drawW / aspect;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = drawH * aspect;
  }
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;

  pdf.addImage(dataUrl, 'PNG', x, y, drawW, drawH, undefined, 'FAST');
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
