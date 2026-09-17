'use client';

import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { ArrowRight, ArrowUpRight, Mail } from 'lucide-react';
import { useBought } from './bought-provider';
import {
  DEV_TEST_AUTH_CODE,
  DEV_TEST_AUTH_STORAGE_KEY,
  isDevAuthTestMode,
} from '@/lib/dev-auth';

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="google-mark" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M21.35 12.27c0-.79-.07-1.54-.23-2.27H12v4.3h5.23a4.47 4.47 0 0 1-1.94 2.93v2.44h3.14c1.84-1.69 2.92-4.18 2.92-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 21.6c2.63 0 4.84-.87 6.45-2.36l-3.14-2.44c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.04H3.28v2.52A9.75 9.75 0 0 0 12 21.6Z"
      />
      <path
        fill="#FBBC05"
        d="M6.53 13.68A5.86 5.86 0 0 1 6.22 12c0-.58.11-1.15.31-1.68V7.8H3.28A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.03 4.2l3.25-2.52Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.28c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.37 14.63 2.4 12 2.4a9.75 9.75 0 0 0-8.72 5.4l3.25 2.52C7.3 8 9.46 6.28 12 6.28Z"
      />
    </svg>
  );
}

export function DropSignIn({
  title = 'YOUR ACCOUNT',
  description = 'Sign in to keep your payment and recordings together. You can resume your broadcast on any device.',
  showGoogle = false,
  mode = 'default',
  onSignedIn,
}: {
  title?: string;
  description?: ReactNode;
  showGoogle?: boolean;
  mode?: 'default' | 'modal';
  onSignedIn?: () => void;
}) {
  const { client, authReady } = useBought();
  const [email, setEmail] = useState(mode === 'modal' ? '123@gmail.com' : '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const localEmailTest = isDevAuthTestMode() && mode === 'modal' && !client;
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!client) {
      if (localEmailTest) {
        if (!sent) {
          setSent(true);
          setError('');
          return;
        }
        if (code.trim() !== DEV_TEST_AUTH_CODE) {
          setError(`For local testing, enter code ${DEV_TEST_AUTH_CODE}.`);
          return;
        }
        window.localStorage.setItem(DEV_TEST_AUTH_STORAGE_KEY, '1');
        onSignedIn?.();
        return;
      }
      setError(
        'Email sign-in is not connected yet. Add the Supabase settings to the local environment.',
      );
      return;
    }
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
      if (sent) {
        onSignedIn?.();
      } else {
        setSent(true);
      }
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
    if (busy) return;
    if (!client) {
      setError(
        'Google sign-in is not connected yet. Add the Supabase settings to the local environment.',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/?auth=google` },
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

  if (mode === 'modal') {
    return (
      <form className="drop-auth sign-in-modal-form" onSubmit={submit}>
        {showGoogle && (
          <button
            className="drop-button profile-google-button"
            disabled={busy || !authReady}
            type="button"
            onClick={() => void signInWithGoogle()}
          >
            <GoogleMark />
            {!authReady
              ? 'CONNECTING…'
              : busy
                ? 'PLEASE WAIT…'
                : !client
                  ? 'GOOGLE SIGN-IN UNAVAILABLE'
                  : 'Continue with Google'}
            <ArrowRight size={17} />
          </button>
        )}
        <div className="drop-auth-divider sign-in-modal-email-divider">
          <span>OR USE EMAIL</span>
        </div>
        <label className="drop-field">
          Email address
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={sent || busy || !authReady}
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
        {sent && localEmailTest && (
          <p className="drop-test-note">
            Local test mode: use code {DEV_TEST_AUTH_CODE}.
          </p>
        )}
        {error && (
          <p className="drop-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="drop-button primary"
          disabled={busy || !authReady}
          type="submit"
        >
          {busy
            ? 'PLEASE WAIT…'
            : sent
              ? 'VERIFY & CONTINUE'
              : !authReady
                ? 'CONNECTING…'
                : 'Continue with Email'}
          <ArrowRight size={17} />
        </button>
      </form>
    );
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
            disabled={busy || !authReady}
            type="button"
            onClick={() => void signInWithGoogle()}
          >
            <GoogleMark />
            {busy
              ? 'PLEASE WAIT…'
              : !client
                ? authReady
                  ? 'GOOGLE SIGN-IN NOT CONNECTED'
                  : 'CONNECTING…'
                : 'CONTINUE WITH GOOGLE'}
            <ArrowUpRight size={17} />
          </button>
          <div className="drop-auth-divider">
            <span>OR USE EMAIL</span>
          </div>
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
          disabled={sent || busy || !authReady}
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
        disabled={busy || !authReady}
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
