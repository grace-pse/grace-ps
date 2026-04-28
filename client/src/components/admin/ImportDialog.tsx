import { useState } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { Btn2 } from '../hifi/Btn2';
import { adminTemplatesApi } from '../../lib/csmp-api';
import { extractError } from '../../lib/api';
import type { OnConflict, AdminImportResult } from '../../lib/csmp-types';
import type { TemplateExportKind } from '@csmp/shared';

interface ImportDialogProps {
  onClose: () => void;
  onImported: (result: AdminImportResult) => void;
  // when `moduleId` present → single-item import; else → package bundle import
  moduleId?: string;
}

type ParsedEnvelope = {
  schemaVersion?: string;
  kind?: TemplateExportKind;
  exportedAt?: string;
  sourceOrigin?: string;
  content?: unknown;
};

export function ImportDialog({ onClose, onImported, moduleId }: ImportDialogProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedEnvelope | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [onConflict, setOnConflict] = useState<OnConflict>('skip');
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setParseError(null);
    setParsed(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const json = JSON.parse(text) as ParsedEnvelope;
      if (json.schemaVersion !== '1.0') {
        setParseError(`Unsupported schemaVersion: ${json.schemaVersion ?? '(missing)'}`);
        return;
      }
      if (!json.kind || !json.content) {
        setParseError('Envelope missing kind or content.');
        return;
      }
      if (moduleId && json.kind === 'package') {
        setParseError('Cannot import a package bundle into a single module.');
        return;
      }
      if (!moduleId && json.kind !== 'package') {
        setParseError(`Expected a "package" bundle, got kind="${json.kind}".`);
        return;
      }
      setParsed(json);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }

  async function handleImport() {
    if (!parsed) return;
    setSaving(true);
    setServerError(null);
    try {
      const result =
        parsed.kind === 'package'
          ? await adminTemplatesApi.importPackage(parsed, onConflict)
          : await adminTemplatesApi.importItem(
              parsed.kind as Exclude<TemplateExportKind, 'package'>,
              parsed,
              { moduleId: moduleId!, onConflict },
            );
      onImported(result);
    } catch (err) {
      setServerError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  function previewSummary() {
    if (!parsed) return null;
    if (parsed.kind === 'package') {
      const c = parsed.content as {
        package: { slug: string; name: string };
        modules: Array<{ slug: string; name: string; assetTemplates: unknown[]; threatTemplates: unknown[]; countermeasureTemplates: unknown[] }>;
      };
      return (
        <>
          <div>Package: <span className="font-medium text-n-800">{c.package.name}</span> <span className="font-mono text-n-500">({c.package.slug})</span></div>
          <div>{c.modules.length} module{c.modules.length === 1 ? '' : 's'}</div>
          <ul className="list-disc list-inside pl-1 text-[11px] text-n-600 space-y-0.5">
            {c.modules.map((m) => (
              <li key={m.slug}>
                {m.name} — {m.assetTemplates.length}A / {m.threatTemplates.length}T / {m.countermeasureTemplates.length}CM
              </li>
            ))}
          </ul>
        </>
      );
    }
    const item = parsed.content as { slug: string; name?: string; scenarioName?: string };
    return (
      <div>
        {parsed.kind}: <span className="font-medium text-n-800">{item.name ?? item.scenarioName}</span>{' '}
        <span className="font-mono text-n-500">({item.slug})</span>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-n-900/40 z-40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-labelledby="import-dialog-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[520px] bg-white rounded-r3 shadow-sh3 z-50 flex flex-col max-h-[80vh]"
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-n-150">
          <h2 id="import-dialog-title" className="text-[14px] font-semibold text-n-900">
            {moduleId ? 'Import template item' : 'Import package bundle'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <label className="block">
            <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">JSON file</div>
            <div className="border border-dashed border-n-200 rounded-r2 px-3 py-4 flex flex-col items-center justify-center gap-1 hover:bg-n-75 cursor-pointer">
              <Upload className="w-5 h-5 text-n-500" />
              <div className="text-[12px] text-n-700">{fileName ?? 'Click to choose a file'}</div>
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </label>

          {parseError && (
            <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {parsed && (
            <div className="border border-n-150 rounded-r2 p-3 text-[12px] text-n-700 space-y-1">
              {previewSummary()}
              {parsed.sourceOrigin && (
                <div className="text-[11px] text-n-500">From: {parsed.sourceOrigin}</div>
              )}
            </div>
          )}

          <div>
            <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">On conflict</div>
            <select
              value={onConflict}
              onChange={(e) => setOnConflict(e.target.value as OnConflict)}
              className="w-full h-8 px-2 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
            >
              <option value="skip">Skip — leave existing slugs untouched</option>
              <option value="overwrite">Overwrite — update existing rows in place</option>
              <option value="rename">Rename — append -imported-N to colliding slugs</option>
            </select>
          </div>

          {serverError && (
            <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
              {serverError}
            </div>
          )}
        </div>

        <footer className="border-t border-n-150 px-5 py-3 flex items-center justify-end gap-2">
          <Btn2 type="button" variant="ghost" onClick={onClose}>Cancel</Btn2>
          <Btn2 type="button" variant="primary" onClick={handleImport} disabled={!parsed || saving}>
            {saving ? 'Importing…' : 'Import'}
          </Btn2>
        </footer>
      </div>
    </>
  );
}
