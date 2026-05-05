import { useEffect, type ReactNode } from 'react';
import { useSandboxStore } from '../../stores/sandbox';

interface SandboxBootstrapProps {
  children: ReactNode;
}

/**
 * Wraps the app when running in sandbox mode. Reads `?invite=<token>` (or a
 * previously-stored token from localStorage), exchanges it for a real JWT
 * via `/api/sandbox/login-as`, and only renders children once verified.
 * Without a valid invite, shows an "invite-only" landing.
 */
export function SandboxBootstrap({ children }: SandboxBootstrapProps) {
  const status = useSandboxStore((s) => s.status);
  const errorMessage = useSandboxStore((s) => s.errorMessage);
  const bootstrap = useSandboxStore((s) => s.bootstrap);

  useEffect(() => {
    if (status === 'idle') void bootstrap();
  }, [status, bootstrap]);

  if (status === 'ready') return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-n-50 px-4">
      <div className="max-w-md w-full bg-white rounded-r3 shadow-sh3 p-8 text-center">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.6px] text-a-600 mb-1">
          CSMP demo sandbox
        </div>

        {(status === 'idle' || status === 'verifying') && (
          <>
            <h1 className="text-[18px] font-semibold text-n-900 mb-2">
              Verifying your invite…
            </h1>
            <p className="text-[13px] text-n-500">One moment.</p>
          </>
        )}

        {status === 'invalid' && (
          <>
            <h1 className="text-[18px] font-semibold text-n-900 mb-2">
              Invite required
            </h1>
            <p className="text-[13px] text-n-600 mb-4">
              {errorMessage ??
                'This sandbox is invite-only. Contact the project owner to request access.'}
            </p>
            <p className="text-[11.5px] text-n-500">
              If you were given a link, open it in this browser. The link looks
              like <code>?invite=…</code>.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-[18px] font-semibold text-n-900 mb-2">
              Sandbox unavailable
            </h1>
            <p className="text-[13px] text-n-600">
              {errorMessage ?? 'Try again in a moment.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
