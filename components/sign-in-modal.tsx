'use client';

import { BarChart3, Bell, Bookmark, UsersRound, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { BrandLogo } from '@/components/brand-logo';
import { DropSignIn } from '@/components/drop-sign-in';
import Link from '@/components/site-link';
import { SignInCategoryStep } from '@/components/sign-in-category-step';
import { SignInGoalsStep } from '@/components/sign-in-goals-step';
import { useBought } from '@/components/bought-provider';
import {
  DEV_TEST_AUTH_STORAGE_KEY,
  DEV_TEST_CATEGORIES_STORAGE_KEY,
  DEV_TEST_GOALS_STORAGE_KEY,
  isDevAuthTestMode,
} from '@/lib/dev-auth';

const benefits = [
  {
    icon: Bookmark,
    title: 'Follow your favourite categories',
    copy: 'See more of what you care about.',
  },
  {
    icon: UsersRound,
    title: 'Save broadcasts',
    copy: 'Build your own watchlist.',
  },
  {
    icon: Bell,
    title: 'Get notified',
    copy: 'Be the first to see winners, new drops and people you follow.',
  },
  {
    icon: BarChart3,
    title: 'A more relevant BOUGHT',
    copy: 'Help us show you better content, people and opportunities.',
  },
];

export function SignInModal({
  onClose,
  onPreferenceDismissed,
  onComplete,
  startAt = 'sign-in',
}: {
  onClose: () => void;
  onPreferenceDismissed?: () => void;
  onComplete: () => void;
  startAt?: 'sign-in' | 'goals' | 'categories';
}) {
  const { client } = useBought();
  const [step, setStep] = useState<'sign-in' | 'goals' | 'categories'>(
    startAt,
  );
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryError, setCategoryError] = useState('');

  const closeDialog = useCallback(() => {
    if (step !== 'sign-in') onPreferenceDismissed?.();
    onClose();
  }, [onClose, onPreferenceDismissed, step]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDialog();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [closeDialog]);

  return (
    <div
      className="sign-in-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <dialog
        open
        className={`sign-in-dialog${step !== 'sign-in' ? ' is-preference-step' : ''}`}
        aria-modal="true"
        aria-label={
          step === 'goals'
            ? 'What brings you to BOUGHT?'
            : step === 'categories'
              ? 'Choose your categories'
              : 'Sign in to BOUGHT'
        }
      >
        <header className="sign-in-dialog-header">
          <BrandLogo className="sign-in-dialog-brand" />
          <span>
            Step {step === 'sign-in' ? 1 : step === 'goals' ? 2 : 3} of 7
          </span>
          <button type="button" onClick={closeDialog} aria-label="Close sign in">
            <X size={25} strokeWidth={1.7} />
          </button>
        </header>

        {step === 'sign-in' ? (
          <div className="sign-in-dialog-body">
            <p className="sign-in-dialog-lead">
              Create a free profile to make BOUGHT yours.
            </p>

            <div className="sign-in-benefits">
              {benefits.map(({ icon: Icon, title, copy }) => (
                <div className="sign-in-benefit" key={title}>
                  <Icon size={27} strokeWidth={1.6} />
                  <div>
                    <strong>{title}</strong>
                    <span>{copy}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="sign-in-dialog-divider" />
            <DropSignIn
              mode="modal"
              showGoogle
              onSignedIn={() => {
                setPreferenceError('');
                setStep('goals');
              }}
            />
            <p className="sign-in-dialog-fineprint">
              By continuing, you agree to our{' '}
              <Link href="/terms">Terms of Service</Link>.
            </p>
          </div>
        ) : step === 'goals' ? (
          <div className="sign-in-dialog-body sign-in-preference-body">
            <SignInGoalsStep
              busy={preferenceBusy}
              error={preferenceError}
              onContinue={async (goals) => {
                if (preferenceBusy) return;
                if (!client) {
                  if (
                    isDevAuthTestMode() &&
                    window.localStorage.getItem(DEV_TEST_AUTH_STORAGE_KEY) ===
                      '1'
                  ) {
                    window.localStorage.setItem(
                      DEV_TEST_GOALS_STORAGE_KEY,
                      JSON.stringify(goals),
                    );
                    setPreferenceError('');
                    setStep('categories');
                    return;
                  }
                  setPreferenceError(
                    'Your sign-in session is not ready yet. Please try again.',
                  );
                  return;
                }
                setPreferenceBusy(true);
                setPreferenceError('');
                try {
                  const { error } = await client.auth.updateUser({
                    data: { profile_goals: goals },
                  });
                  if (error) throw error;
                  setStep('categories');
                } catch (error) {
                  setPreferenceError(
                    error instanceof Error
                      ? error.message
                      : 'Your preferences could not be saved. Please try again.',
                  );
                } finally {
                  setPreferenceBusy(false);
                }
              }}
            />
          </div>
        ) : (
          <div className="sign-in-dialog-body sign-in-category-body">
            <SignInCategoryStep
              busy={categoryBusy}
              error={categoryError}
              onContinue={async (categories) => {
                if (categoryBusy) return;
                if (!client) {
                  if (
                    isDevAuthTestMode() &&
                    window.localStorage.getItem(DEV_TEST_AUTH_STORAGE_KEY) ===
                      '1'
                  ) {
                    window.localStorage.setItem(
                      DEV_TEST_CATEGORIES_STORAGE_KEY,
                      JSON.stringify(categories),
                    );
                    onComplete();
                    return;
                  }
                  setCategoryError(
                    'Your sign-in session is not ready yet. Please try again.',
                  );
                  return;
                }
                setCategoryBusy(true);
                setCategoryError('');
                try {
                  const { error } = await client.auth.updateUser({
                    data: { preferred_categories: categories },
                  });
                  if (error) throw error;
                  onComplete();
                } catch (error) {
                  setCategoryError(
                    error instanceof Error
                      ? error.message
                      : 'Your categories could not be saved. Please try again.',
                  );
                } finally {
                  setCategoryBusy(false);
                }
              }}
            />
          </div>
        )}
      </dialog>
    </div>
  );
}
