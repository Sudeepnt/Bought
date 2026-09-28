'use client';

import { useEffect } from 'react';

// Mobile browsers may dim or lock the display during a long take. Keep the
// screen awake while recording when the standard Wake Lock API is available.
export function useRecordingWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let lock: WakeLockSentinel | null = null;

    const acquire = async () => {
      if (
        cancelled ||
        document.visibilityState !== 'visible' ||
        !('wakeLock' in navigator)
      )
        return;
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        // Recording remains usable when a browser or low-power mode denies it.
      }
    };
    const visibilityChanged = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', visibilityChanged);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
