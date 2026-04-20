import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { UserPlus } from 'lucide-react';
import { Card } from '../components/hifi/Card';
import { Btn2 } from '../components/hifi/Btn2';
import { useAuthStore } from '../stores/auth';

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await register({
        firstName,
        lastName,
        email,
        password,
        organizationName,
        organizationSlug,
      });
      navigate({ to: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-n-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div
            className="w-7 h-7 rounded-[4px]"
            style={{ background: 'linear-gradient(135deg, #4f56e5 0%, #3436a4 100%)' }}
          />
          <div className="text-[15px] font-semibold tracking-[-0.2px] text-n-900">
            CSMP Risk Manager
          </div>
        </div>

        <Card className="p-5">
          <h1 className="text-[17px] font-semibold tracking-[-0.2px] text-n-900 mb-1">
            Register your organization
          </h1>
          <p className="text-[11.5px] text-n-500 mb-4">
            You become the admin for this new workspace.
          </p>

          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" />
              <Field label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
            </div>
            <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="new-password"
            />
            <Field
              label="Organization name"
              value={organizationName}
              onChange={setOrganizationName}
              placeholder="Acme Corp"
            />
            <Field
              label="Organization slug"
              value={organizationSlug}
              onChange={(v) => setOrganizationSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="acme-corp"
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
              leading={<UserPlus className="w-3.5 h-3.5" />}
            >
              {loading ? 'Creating…' : 'Create organization'}
            </Btn2>
          </form>

          <div className="text-[11.5px] text-n-500 mt-4 text-center">
            Already have an account?{' '}
            <a href="/login" className="text-a-600 hover:text-a-700 font-medium">
              Sign in
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
