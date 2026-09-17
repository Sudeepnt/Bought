import type { Session } from '@supabase/supabase-js';

export const DEV_TEST_AUTH_STORAGE_KEY = 'bought-dev-test-auth';
export const DEV_TEST_GOALS_STORAGE_KEY = 'bought-dev-test-goals';
export const DEV_TEST_CATEGORIES_STORAGE_KEY = 'bought-dev-test-categories';
export const DEV_TEST_PROFILE_STORAGE_KEY = 'bought-dev-test-profile';
export const DEV_TEST_AUTH_CODE = '123456';
export const DEV_TEST_USER_ID = '00000000-0000-4000-8000-000000000001';

export function isDevAuthTestMode() {
  return process.env.NODE_ENV === 'development';
}

export function createDevTestSession(): Session {
  const now = new Date().toISOString();
  let goals: string[] = [];
  let categories: string[] = [];
  let profile: Record<string, unknown> = {};
  try {
    const storedGoals = window.localStorage.getItem(DEV_TEST_GOALS_STORAGE_KEY);
    const parsedGoals = storedGoals ? JSON.parse(storedGoals) : [];
    if (Array.isArray(parsedGoals)) {
      goals = parsedGoals.filter(
        (value): value is string => typeof value === 'string',
      );
    }
    const stored = window.localStorage.getItem(DEV_TEST_CATEGORIES_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (Array.isArray(parsed)) {
      categories = parsed.filter(
        (value): value is string => typeof value === 'string',
      );
    }
    const storedProfile = window.localStorage.getItem(
      DEV_TEST_PROFILE_STORAGE_KEY,
    );
    const parsedProfile = storedProfile ? JSON.parse(storedProfile) : {};
    if (
      parsedProfile &&
      typeof parsedProfile === 'object' &&
      !Array.isArray(parsedProfile)
    ) {
      profile = parsedProfile as Record<string, unknown>;
    }
  } catch {
    categories = [];
    profile = {};
  }

  return {
    access_token: 'bought-local-test-access-token',
    refresh_token: 'bought-local-test-refresh-token',
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    token_type: 'bearer',
    user: {
      id: DEV_TEST_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: '123@gmail.com',
      email_confirmed_at: now,
      phone: '',
      confirmed_at: now,
      last_sign_in_at: now,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {
        ...profile,
        email: '123@gmail.com',
        profile_goals: goals,
        preferred_categories: categories,
        profile_completed: profile.profile_completed === true,
      },
      identities: [],
      created_at: now,
      updated_at: now,
      is_anonymous: false,
    },
  } as Session;
}

export function clearDevTestAuth() {
  if (!isDevAuthTestMode()) return;
  window.localStorage.removeItem(DEV_TEST_AUTH_STORAGE_KEY);
  window.localStorage.removeItem(DEV_TEST_GOALS_STORAGE_KEY);
  window.localStorage.removeItem(DEV_TEST_CATEGORIES_STORAGE_KEY);
  window.localStorage.removeItem(DEV_TEST_PROFILE_STORAGE_KEY);
}
