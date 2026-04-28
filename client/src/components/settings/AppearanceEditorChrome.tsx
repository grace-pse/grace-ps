import type { ReactNode } from 'react';
import { Btn2 } from '../hifi/Btn2';
import { Pill } from '../hifi/Pill';

interface AppearanceEditorChromeProps {
  title: string;
  subtitle?: string;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
  onSave: () => void;
  onReset: () => void;
  children: ReactNode;
}

export function AppearanceEditorChrome({
  title,
  subtitle,
  dirty,
  saving,
  saved,
  error,
  onSave,
  onReset,
  children,
}: AppearanceEditorChromeProps) {
  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-n-900">{title}</h2>
          {subtitle && <p className="text-[12.5px] text-n-600 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dirty && <Pill variant="warn">Unsaved changes</Pill>}
          {!dirty && saved && <Pill variant="ok">Saved</Pill>}
          <Btn2 variant="secondary" onClick={onReset} disabled={saving}>
            Reset to defaults
          </Btn2>
          <Btn2 onClick={onSave} disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Btn2>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
          {error}
        </div>
      )}

      {children}
    </div>
  );
}
