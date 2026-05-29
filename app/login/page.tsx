'use client';

import { useEffect, useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const check = async () => {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        router.replace('/');
      }
    };
    void check();
  }, [router]);

  const handleRegister = async () => {
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const optionsRes = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error ?? 'Failed to get registration options');

      const response = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), response }),
      });
      const verifyResult = await verifyRes.json();
      if (!verifyRes.ok || !verifyResult.success) {
        throw new Error(verifyResult.error ?? 'Registration failed');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const optionsRes = await fetch('/api/auth/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error ?? 'Failed to get login options');

      const response = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), response }),
      });
      const verifyResult = await verifyRes.json();
      if (!verifyRes.ok || !verifyResult.success) {
        throw new Error(verifyResult.error ?? 'Login failed');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <section className="panel w-full max-w-md p-6 fade-in">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Todo App</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          Passwordless login with passkeys.
        </p>

        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}

        <label className="block text-sm font-medium mb-2" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          className="input mb-4"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="e.g. quanjie"
          disabled={loading}
        />

        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-primary" onClick={handleRegister} disabled={loading}>
            Register
          </button>
          <button className="btn btn-secondary" onClick={handleLogin} disabled={loading}>
            Login
          </button>
        </div>
      </section>
    </main>
  );
}
