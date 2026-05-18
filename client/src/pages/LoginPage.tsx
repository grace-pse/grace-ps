import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import { Card } from '../components/hifi/Card';
import { Btn2 } from '../components/hifi/Btn2';
import { useAuthStore } from '../stores/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login({ email, password });
      navigate({ to: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-n-50 p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div
            className="w-7 h-7 rounded-[4px]"
            style={{ background: 'linear-gradient(135deg, #4f56e5 0%, #3436a4 100%)' }}
          />
          <div className="text-[15px] font-semibold tracking-[-0.2px] text-n-900">
            GRACE Engine
          </div>
        </div>

        <Card className="p-5">
          <h1 className="text-[17px] font-semibold tracking-[-0.2px] text-n-900 mb-1">
            Sign in
          </h1>
          <p className="text-[11.5px] text-n-500 mb-4">
            Access your risk assessments.
          </p>

          <form onSubmit={onSubmit} className="space-y-3">
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="email"
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="current-password"
            />

            {error && (
              <div className="text-[11.5px] text-bad bg-bad-bg px-2 py-1.5 rounded-r1">
                {error}
              </div>
            )}

            <Btn2
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full"
              leading={<Lock className="w-3.5 h-3.5" />}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Btn2>
          </form>

          <div className="text-[11.5px] text-n-500 mt-4 text-center">
            First time setting up this instance?{' '}
            <a href="/register" className="text-a-600 hover:text-a-700 font-medium">
              Bootstrap the instance
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
        {props.label}
      </div>
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        required
        className="w-full h-8 px-2.5 border border-n-200 rounded-r2 text-[12.5px] bg-white focus:border-a-400 focus:ring-2 focus:ring-a-100 outline-none transition"
      />
    </label>
  );
}
