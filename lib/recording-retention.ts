export const RECORDING_RETENTION_DAYS = 14;
export const RECORDING_RETENTION_MS =
  RECORDING_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function recordingSavedAt({
  localSavedAt,
  uploadExpiresAt,
  createdAt,
}: {
  localSavedAt?: number;
  uploadExpiresAt?: string | null;
  createdAt: string;
}) {
  if (Number.isFinite(localSavedAt)) return localSavedAt!;
  const uploadExpiry = uploadExpiresAt
    ? new Date(uploadExpiresAt).getTime()
    : Number.NaN;
  if (Number.isFinite(uploadExpiry)) return uploadExpiry - 2 * 60 * 60 * 1000;
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) ? created : Date.now();
}

export function recordingRetention({
  savedAt,
  inUse,
  now = Date.now(),
}: {
  savedAt: number;
  inUse: boolean;
  now?: number;
}) {
  const expiresAt = savedAt + RECORDING_RETENTION_MS;
  const remainingMs = Math.max(0, expiresAt - now);
  const elapsed = Math.max(0, now - savedAt);
  return {
    expiresAt,
    expired: !inUse && remainingMs === 0,
    inUse,
    progress: inUse
      ? 100
      : Math.min(100, (elapsed / RECORDING_RETENTION_MS) * 100),
    remainingMs,
  };
}

export function recordingExpiryLabel(remainingMs: number) {
  if (remainingMs <= 0) return 'Expired';
  const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  if (days >= 2) return `Expires in ${days} days`;
  const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
  if (hours >= 2) return `Expires in ${hours} hours`;
  const minutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
  return `Expires in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}
