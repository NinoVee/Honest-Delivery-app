import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Header } from '../components/Shared';

export default function Login() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !password) {
      setError('Please enter your name and the password.');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });
      const data = await r.json();
      if (r.ok) {
        router.push('/driver');
      } else {
        setError(data.error || 'Login failed.');
        setSubmitting(false);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Driver Sign In — Honest Care Medical Delivery</title>
      </Head>
      <Header active="driver" />
      <div className="wb-shell">
        <div className="wb-card wb-login-card" style={{ maxWidth: 420, margin: '0 auto' }}>
          <h2>Driver Sign In</h2>
          <form onSubmit={submit}>
            <label>Your name</label>
            <input
              type="text"
              className="wb-input-lg"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John T"
              autoComplete="name"
            />
            <label>Password</label>
            <input
              type="password"
              className="wb-input-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Team password"
              autoComplete="current-password"
            />
            {error && <div className="wb-banner error">{error}</div>}
            <button className="wb-btn teal" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Signing in\u2026' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
