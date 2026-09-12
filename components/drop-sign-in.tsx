'use client';

import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { ArrowUpRight, Mail } from 'lucide-react';
import { useBought } from './bought-provider';

export function DropSignIn({
  title = 'YOUR ACCOUNT',
  description = 'Sign in to keep your payment and recordings together. You can resume your broadcast on any device.',
  showGoogle = false,
}: {
  title?: string;
  description?: ReactNode;
  showGoogle?: boolean;
}) {
  const { client, authReady } = useBought();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setError('');
    try {
      const { error: authError } = sent
        ? await client.auth.verifyOtp({
            email: email.trim(),
            token: code.trim(),
            type: 'email',
          })
        : await client.auth.signInWithOtp({
            email: email.trim(),
            options: { shouldCreateUser: true },
          });
      if (authError) throw authError;
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Sign-in failed. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!client || busy) return;
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/profile` },
      });
      if (authError) throw authError;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Google sign-in failed. Please try again.',
      );
      setBusy(false);
    }
  }

  return (
    <form className="drop-auth" onSubmit={submit}>
      <div className="drop-section-label">
        <Mail size={16} /> {title}
      </div>
      <p>{description}</p>
      {showGoogle && (
        <>
          <button
            className="drop-button profile-google-button"
            disabled={busy || !client}
            type="button"
            onClick={() => void signInWithGoogle()}
          >
            <span className="google-letter">G</span>
            {busy
              ? 'PLEASE WAIT…'
              : !client
                ? authReady
                  ? 'GOOGLE SIGN-IN NOT CONNECTED'
                  : 'CONNECTING…'
                : 'CONTINUE WITH GOOGLE'}
            <ArrowUpRight size={17} />
          </button>
          <div className="drop-auth-divider"><span>OR USE EMAIL</span></div>
        </>
      )}
      <label className="drop-field">
        Email address
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={sent || busy || !client}
          placeholder="you@example.com"
        />
      </label>
      {sent && (
        <label className="drop-field">
          Code from your email
          <input
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6,10}"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            placeholder="Enter your code"
          />
        </label>
      )}
      {error && (
        <p className="drop-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="drop-button primary"
        disabled={busy || !client}
        type="submit"
      >
        {busy
          ? 'PLEASE WAIT…'
          : sent
            ? 'VERIFY & CONTINUE'
            : !client
              ? authReady
                ? 'EMAIL SIGN-IN NOT CONNECTED'
                : 'CONNECTING…'
              : 'EMAIL ME A CODE'}
        <ArrowUpRight size={17} />
      </button>
      {sent && (
        <button
          type="button"
          className="drop-text-button"
          onClick={() => {
            setSent(false);
            setCode('');
          }}
        >
          Use another email or request a new code
        </button>
      )}
    </form>
  );
}
