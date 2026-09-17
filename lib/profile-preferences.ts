import type { Session } from '@supabase/supabase-js';

export const PROFILE_PREFERENCES_DISMISSED_METADATA_KEY =
  'profile_preferences_prompt_dismissed';

const PROFILE_PREFERENCES_DISMISSED_STORAGE_PREFIX =
  'bought-profile-preferences-dismissed:';

function storageKey(userId: string) {
  return `${PROFILE_PREFERENCES_DISMISSED_STORAGE_PREFIX}${userId}`;
}

export function hasDismissedProfilePreferences(session: Session | null) {
  if (!session) return false;

  if (
    session.user.user_metadata?.[PROFILE_PREFERENCES_DISMISSED_METADATA_KEY] ===
    true
  ) {
    return true;
  }

  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(storageKey(session.user.id)) === '1';
}

export function rememberDismissedProfilePreferences(userId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(userId), '1');
}
